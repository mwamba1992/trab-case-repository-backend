import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaseContent } from '../cases/entities/case-content.entity';
import { CaseDocument } from '../cases/entities/case-document.entity';
import { EmbeddingsService } from '../embeddings/embeddings.service';

export interface SearchResult {
  documentId: string;
  documentName: string;
  caseId: string;
  pageNumber: number;
  content: string;
  score: number;
  matchType: 'full-text' | 'semantic' | 'hybrid';
  caseMetadata: {
    caseNumber: string;
    caseType: string;
    appellant: string;
    respondent: string;
    filingDate: string | null;
    hearingDate: string | null;
    decisionDate: string | null;
    status: string | null;
    taxAmountDisputed: number | null;
    chairperson: string | null;
    boardMembers: string[] | null;
  };
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalResults: number;
  searchType: 'full-text' | 'semantic' | 'hybrid';
  executionTimeMs: number;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectRepository(CaseContent)
    private contentRepository: Repository<CaseContent>,
    @InjectRepository(CaseDocument)
    private documentRepository: Repository<CaseDocument>,
    private embeddingsService: EmbeddingsService,
  ) {}

  /**
   * Full-text search using PostgreSQL tsvector
   */
  async fullTextSearch(query: string, limit = 10): Promise<SearchResponse> {
    const startTime = Date.now();

    this.logger.log(`Full-text search for: "${query}"`);

    // Perform full-text search with ranking
    const sqlQuery = `
      SELECT
        c.id,
        c.document_id,
        c.case_id,
        c.page_number,
        c.cleaned_text,
        d.file_name,
        cs.case_number,
        cs.case_type,
        cs.appellant,
        cs.respondent,
        cs.filing_date,
        cs.hearing_date,
        cs.decision_date,
        cs.outcome,
        cs.tax_amount_disputed,
        cs.chairperson,
        cs.board_members,
        ts_rank(c.tsvector_content, plainto_tsquery('english', $1)) as rank
      FROM case_content c
      JOIN case_documents d ON c.document_id = d.id
      JOIN cases cs ON c.case_id = cs.id
      WHERE c.tsvector_content @@ plainto_tsquery('english', $1)
      ORDER BY rank DESC
      LIMIT $2
    `;

    const rawResults = await this.contentRepository.query(sqlQuery, [
      query,
      limit,
    ]);

    const results: SearchResult[] = rawResults.map((row) => ({
      documentId: row.document_id,
      documentName: row.file_name,
      caseId: row.case_id,
      pageNumber: row.page_number,
      content: this.truncateContent(row.cleaned_text, query),
      score: parseFloat(row.rank),
      matchType: 'full-text',
      caseMetadata: {
        caseNumber: row.case_number,
        caseType: row.case_type,
        appellant: row.appellant,
        respondent: row.respondent,
        filingDate: row.filing_date,
        hearingDate: row.hearing_date,
        decisionDate: row.decision_date,
        status: row.outcome,
        taxAmountDisputed: row.tax_amount_disputed
          ? parseFloat(row.tax_amount_disputed)
          : null,
        chairperson: row.chairperson,
        boardMembers: row.board_members,
      },
    }));

    const executionTimeMs = Date.now() - startTime;

    return {
      query,
      results,
      totalResults: results.length,
      searchType: 'full-text',
      executionTimeMs,
    };
  }

  /**
   * Vector semantic search using pgvector
   */
  async semanticSearch(query: string, limit = 10): Promise<SearchResponse> {
    const startTime = Date.now();

    this.logger.log(`Semantic search for: "${query}"`);

    // Generate embedding for the query
    const queryEmbedding = await this.embeddingsService.generateEmbedding(
      query,
    );

    // Convert to PostgreSQL array format
    const embeddingStr = `[${queryEmbedding.join(',') }]`;

    // Perform vector similarity search using cosine distance
    const sqlQuery = `
      SELECT
        c.id,
        c.document_id,
        c.case_id,
        c.page_number,
        c.cleaned_text,
        d.file_name,
        cs.case_number,
        cs.case_type,
        cs.appellant,
        cs.respondent,
        cs.filing_date,
        cs.hearing_date,
        cs.decision_date,
        cs.outcome,
        cs.tax_amount_disputed,
        cs.chairperson,
        cs.board_members,
        1 - (c.embedding <=> $1::vector) as similarity
      FROM case_content c
      JOIN case_documents d ON c.document_id = d.id
      JOIN cases cs ON c.case_id = cs.id
      WHERE c.embedding IS NOT NULL
      ORDER BY c.embedding <=> $1::vector
      LIMIT $2
    `;

    const rawResults = await this.contentRepository.query(sqlQuery, [
      embeddingStr,
      limit,
    ]);

    const results: SearchResult[] = rawResults.map((row) => ({
      documentId: row.document_id,
      documentName: row.file_name,
      caseId: row.case_id,
      pageNumber: row.page_number,
      content: this.truncateContent(row.cleaned_text, query),
      score: parseFloat(row.similarity),
      matchType: 'semantic',
      caseMetadata: {
        caseNumber: row.case_number,
        caseType: row.case_type,
        appellant: row.appellant,
        respondent: row.respondent,
        filingDate: row.filing_date,
        hearingDate: row.hearing_date,
        decisionDate: row.decision_date,
        status: row.outcome,
        taxAmountDisputed: row.tax_amount_disputed
          ? parseFloat(row.tax_amount_disputed)
          : null,
        chairperson: row.chairperson,
        boardMembers: row.board_members,
      },
    }));

    const executionTimeMs = Date.now() - startTime;

    return {
      query,
      results,
      totalResults: results.length,
      searchType: 'semantic',
      executionTimeMs,
    };
  }

  /**
   * Hybrid search combining full-text and semantic search
   */
  async hybridSearch(
    query: string,
    limit = 10,
    fullTextWeight = 0.5,
    semanticWeight = 0.5,
  ): Promise<SearchResponse> {
    const startTime = Date.now();

    this.logger.log(`Hybrid search for: "${query}"`);

    // Generate embedding for the query
    const queryEmbedding = await this.embeddingsService.generateEmbedding(
      query,
    );
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Perform hybrid search with weighted scoring
    const sqlQuery = `
      WITH full_text_scores AS (
        SELECT
          c.id,
          c.document_id,
          c.case_id,
          c.page_number,
          c.cleaned_text,
          d.file_name,
          cs.case_number,
          cs.case_type,
          cs.appellant,
          cs.respondent,
          cs.filing_date,
          cs.hearing_date,
          cs.decision_date,
          cs.outcome,
          cs.tax_amount_disputed,
          cs.chairperson,
          cs.board_members,
          ts_rank(c.tsvector_content, plainto_tsquery('english', $1)) as ft_score
        FROM case_content c
        JOIN case_documents d ON c.document_id = d.id
        JOIN cases cs ON c.case_id = cs.id
        WHERE c.tsvector_content @@ plainto_tsquery('english', $1)
      ),
      semantic_scores AS (
        SELECT
          c.id,
          c.document_id,
          c.case_id,
          c.page_number,
          c.cleaned_text,
          d.file_name,
          cs.case_number,
          cs.case_type,
          cs.appellant,
          cs.respondent,
          cs.filing_date,
          cs.hearing_date,
          cs.decision_date,
          cs.outcome,
          cs.tax_amount_disputed,
          cs.chairperson,
          cs.board_members,
          1 - (c.embedding <=> $2::vector) as sem_score
        FROM case_content c
        JOIN case_documents d ON c.document_id = d.id
        JOIN cases cs ON c.case_id = cs.id
        WHERE c.embedding IS NOT NULL
      )
      SELECT
        COALESCE(ft.id, sem.id) as id,
        COALESCE(ft.document_id, sem.document_id) as document_id,
        COALESCE(ft.case_id, sem.case_id) as case_id,
        COALESCE(ft.page_number, sem.page_number) as page_number,
        COALESCE(ft.cleaned_text, sem.cleaned_text) as cleaned_text,
        COALESCE(ft.file_name, sem.file_name) as file_name,
        COALESCE(ft.case_number, sem.case_number) as case_number,
        COALESCE(ft.case_type, sem.case_type) as case_type,
        COALESCE(ft.appellant, sem.appellant) as appellant,
        COALESCE(ft.respondent, sem.respondent) as respondent,
        COALESCE(ft.filing_date, sem.filing_date) as filing_date,
        COALESCE(ft.hearing_date, sem.hearing_date) as hearing_date,
        COALESCE(ft.decision_date, sem.decision_date) as decision_date,
        COALESCE(ft.outcome, sem.outcome) as outcome,
        COALESCE(ft.tax_amount_disputed, sem.tax_amount_disputed) as tax_amount_disputed,
        COALESCE(ft.chairperson, sem.chairperson) as chairperson,
        COALESCE(ft.board_members, sem.board_members) as board_members,
        (COALESCE(ft.ft_score, 0) * $3 + COALESCE(sem.sem_score, 0) * $4) as hybrid_score,
        COALESCE(ft.ft_score, 0) as ft_score,
        COALESCE(sem.sem_score, 0) as sem_score
      FROM full_text_scores ft
      FULL OUTER JOIN semantic_scores sem ON ft.id = sem.id
      ORDER BY hybrid_score DESC
      LIMIT $5
    `;

    const rawResults = await this.contentRepository.query(sqlQuery, [
      query,
      embeddingStr,
      fullTextWeight,
      semanticWeight,
      limit,
    ]);

    const results: SearchResult[] = rawResults.map((row) => ({
      documentId: row.document_id,
      documentName: row.file_name,
      caseId: row.case_id,
      pageNumber: row.page_number,
      content: this.truncateContent(row.cleaned_text, query),
      score: parseFloat(row.hybrid_score),
      matchType: 'hybrid',
      caseMetadata: {
        caseNumber: row.case_number,
        caseType: row.case_type,
        appellant: row.appellant,
        respondent: row.respondent,
        filingDate: row.filing_date,
        hearingDate: row.hearing_date,
        decisionDate: row.decision_date,
        status: row.outcome,
        taxAmountDisputed: row.tax_amount_disputed
          ? parseFloat(row.tax_amount_disputed)
          : null,
        chairperson: row.chairperson,
        boardMembers: row.board_members,
      },
    }));

    const executionTimeMs = Date.now() - startTime;

    return {
      query,
      results,
      totalResults: results.length,
      searchType: 'hybrid',
      executionTimeMs,
    };
  }

  /**
   * Truncate content and highlight query terms
   */
  private truncateContent(text: string, query: string, maxLength = 300): string {
    if (!text) return '';

    // Find the position of the first query term
    const queryTerms = query.toLowerCase().split(/\s+/);
    const lowerText = text.toLowerCase();

    let bestPosition = 0;
    for (const term of queryTerms) {
      const pos = lowerText.indexOf(term);
      if (pos !== -1) {
        bestPosition = pos;
        break;
      }
    }

    // Extract snippet around the match
    const snippetStart = Math.max(0, bestPosition - 100);
    const snippetEnd = Math.min(text.length, snippetStart + maxLength);
    let snippet = text.substring(snippetStart, snippetEnd);

    // Add ellipsis if truncated
    if (snippetStart > 0) snippet = '...' + snippet;
    if (snippetEnd < text.length) snippet = snippet + '...';

    return snippet.trim();
  }
}
