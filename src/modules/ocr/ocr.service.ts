import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs/promises';
import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import { CaseDocument, OcrStatus } from '../cases/entities/case-document.entity';
import { CaseContent } from '../cases/entities/case-content.entity';
import { EmbeddingsService } from '../embeddings/embeddings.service';

export interface OcrResult {
  documentId: string;
  totalPages: number;
  processedPages: number;
  failedPages: number;
  avgConfidence: number;
  status: OcrStatus;
  error?: string;
}

export interface PageContent {
  pageNumber: number;
  rawText: string;
  cleanedText: string;
  wordCount: number;
}

@Injectable()
export class OcrService implements OnModuleInit {
  private readonly logger = new Logger(OcrService.name);
  private isProcessing = false;
  private readonly batchSize = 5; // Process 5 documents at a time

  constructor(
    @InjectRepository(CaseDocument)
    private documentRepository: Repository<CaseDocument>,
    @InjectRepository(CaseContent)
    private contentRepository: Repository<CaseContent>,
    private embeddingsService: EmbeddingsService,
  ) {}

  /**
   * Run on application startup - check for pending OCR documents
   */
  async onModuleInit() {
    this.logger.log('🚀 Application started - checking for pending OCR documents...');

    // Add a small delay to ensure database connections and embeddings are ready
    setTimeout(async () => {
      try {
        const pendingCount = await this.documentRepository.count({
          where: { ocrStatus: OcrStatus.PENDING },
        });

        if (pendingCount === 0) {
          this.logger.log('✓ No pending OCR documents found on startup');
          return;
        }

        this.logger.log(`📄 Found ${pendingCount} pending OCR documents on startup, processing batch...`);

        this.isProcessing = true;
        const result = await this.processPendingDocuments();

        this.logger.log(
          `✓ Startup OCR processing completed: ${result.successful} successful, ${result.failed} failed`,
        );
      } catch (error) {
        this.logger.error('Startup OCR processing failed', error.stack);
      } finally {
        this.isProcessing = false;
      }
    }, 5000); // Wait 5 seconds for embeddings service to be ready
  }

  /**
   * Process a document - extract text page by page and generate embeddings
   */
  async processDocument(documentId: string): Promise<OcrResult> {
    const result: OcrResult = {
      documentId,
      totalPages: 0,
      processedPages: 0,
      failedPages: 0,
      avgConfidence: 0,
      status: OcrStatus.PROCESSING,
    };

    try {
      // Get document
      const document = await this.documentRepository.findOne({
        where: { id: documentId },
      });

      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      // Update status to processing
      await this.documentRepository.update(documentId, {
        ocrStatus: OcrStatus.PROCESSING,
        ocrError: null,
      });

      this.logger.log(`Processing document: ${document.fileName}`);

      // Extract text from PDF page by page
      const pages = await this.extractTextFromPdf(document.filePath);
      result.totalPages = pages.length;

      // Update page count
      await this.documentRepository.update(documentId, {
        pageCount: pages.length,
      });

      // Process each page
      for (const page of pages) {
        try {
          await this.processPage(document.caseId, documentId, page);
          result.processedPages++;
        } catch (error) {
          this.logger.error(
            `Failed to process page ${page.pageNumber}: ${error.message}`,
          );
          result.failedPages++;
        }
      }

      // Update document status
      if (result.failedPages === 0) {
        result.status = OcrStatus.COMPLETED;
        await this.documentRepository.update(documentId, {
          ocrStatus: OcrStatus.COMPLETED,
          processedAt: new Date(),
        });
      } else if (result.processedPages === 0) {
        result.status = OcrStatus.FAILED;
        await this.documentRepository.update(documentId, {
          ocrStatus: OcrStatus.FAILED,
          ocrError: 'All pages failed to process',
        });
      } else {
        result.status = OcrStatus.MANUAL_REVIEW;
        await this.documentRepository.update(documentId, {
          ocrStatus: OcrStatus.MANUAL_REVIEW,
          ocrError: `${result.failedPages} pages failed to process`,
        });
      }

      this.logger.log(
        `Document processed: ${result.processedPages}/${result.totalPages} pages successful`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to process document: ${error.message}`, error.stack);
      result.status = OcrStatus.FAILED;
      result.error = error.message;

      await this.documentRepository.update(documentId, {
        ocrStatus: OcrStatus.FAILED,
        ocrError: error.message,
      });

      return result;
    }
  }

  /**
   * Extract text from PDF page by page using OCR for scanned documents
   */
  private async extractTextFromPdf(filePath: string): Promise<PageContent[]> {
    let parser: PDFParse | null = null;
    let worker: any = null;

    try {
      // Read PDF file
      const dataBuffer = await fs.readFile(filePath);

      // Create PDFParse instance
      parser = new PDFParse({ data: dataBuffer });

      // First try to extract embedded text
      const textResult = await parser.getText();

      // Check if PDF has meaningful embedded text (not just page markers)
      // Remove page markers like "-- N of M --" and check remaining text
      const textWithoutMarkers = textResult.text.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '').trim();
      const hasEmbeddedText = textWithoutMarkers.length > 500; // At least 500 chars of actual content

      const pages: PageContent[] = [];

      if (hasEmbeddedText) {
        // PDF has embedded text, use it directly
        this.logger.log('PDF has embedded text, using text extraction');
        for (const pageResult of textResult.pages) {
          const rawText = pageResult.text;
          const cleanedText = this.cleanText(rawText);
          const wordCount = this.countWords(cleanedText);

          pages.push({
            pageNumber: pageResult.num,
            rawText,
            cleanedText,
            wordCount,
          });
        }
      } else {
        // PDF is scanned images, use OCR
        this.logger.log('PDF is scanned, using OCR for text extraction');

        // Extract images from PDF
        const imageResult = await parser.getImage({
          imageDataUrl: true,
          imageBuffer: false,
        });

        // Initialize Tesseract worker
        worker = await createWorker('eng');

        // Process each page image with OCR
        for (const pagImages of imageResult.pages) {
          const pageNumber = pagImages.pageNumber;

          if (pagImages.images.length === 0) {
            // No images on this page, create empty content
            pages.push({
              pageNumber,
              rawText: '',
              cleanedText: '',
              wordCount: 0,
            });
            continue;
          }

          // Get the largest image from the page (likely the full page scan)
          const largestImage = pagImages.images.reduce((prev, current) =>
            prev.width * prev.height > current.width * current.height
              ? prev
              : current,
          );

          // Perform OCR on the image
          const {
            data: { text },
          } = await worker.recognize(largestImage.dataUrl);

          const cleanedText = this.cleanText(text);
          const wordCount = this.countWords(cleanedText);

          pages.push({
            pageNumber,
            rawText: text,
            cleanedText,
            wordCount,
          });

          this.logger.debug(
            `OCR completed for page ${pageNumber}: ${wordCount} words`,
          );
        }
      }

      // Clean up
      if (parser) await parser.destroy();
      if (worker) await worker.terminate();

      return pages;
    } catch (error) {
      // Clean up on error
      if (parser) await parser.destroy().catch(() => {});
      if (worker) await worker.terminate().catch(() => {});

      this.logger.error(`Failed to extract text from PDF: ${error.message}`);
      throw error;
    }
  }


  /**
   * Process a single page - save content and generate embedding
   */
  private async processPage(
    caseId: string,
    documentId: string,
    page: PageContent,
  ): Promise<void> {
    // Check if page already processed
    const existing = await this.contentRepository.findOne({
      where: {
        documentId,
        pageNumber: page.pageNumber,
      },
    });

    if (existing) {
      this.logger.debug(`Page ${page.pageNumber} already processed, skipping`);
      return;
    }

    // Generate embedding for cleaned text
    let embedding: number[] | null = null;
    try {
      if (page.cleanedText.length > 50) {
        // Only generate embedding if text is substantial
        embedding = await this.embeddingsService.generateEmbedding(
          page.cleanedText,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to generate embedding for page ${page.pageNumber}: ${error.message}`,
      );
    }

    // Create content record
    const content = this.contentRepository.create({
      caseId,
      documentId,
      pageNumber: page.pageNumber,
      rawText: page.rawText,
      cleanedText: page.cleanedText,
      wordCount: page.wordCount,
      language: 'en',
      ocrEngine: 'pdf-parse',
      embedding: embedding,
      processedAt: new Date(),
    });

    await this.contentRepository.save(content);

    // Update tsvector for full-text search
    await this.updateFullTextSearch(content.id, page.cleanedText);

    this.logger.debug(`Page ${page.pageNumber} processed successfully`);
  }

  /**
   * Update PostgreSQL full-text search vector
   */
  private async updateFullTextSearch(
    contentId: string,
    text: string,
  ): Promise<void> {
    await this.contentRepository.query(
      `UPDATE case_content
       SET tsvector_content = to_tsvector('english', $1)
       WHERE id = $2`,
      [text, contentId],
    );
  }

  /**
   * Clean extracted text
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\x20-\x7E\n]/g, '') // Remove non-printable characters
      .replace(/\.{3,}/g, '...') // Normalize ellipsis
      .replace(/\n{3,}/g, '\n\n') // Normalize line breaks
      .trim();
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  }

  /**
   * Get processing status for a document
   */
  async getDocumentStatus(documentId: string): Promise<{
    status: OcrStatus;
    pageCount: number | null;
    processedPages: number;
    error: string | null;
  }> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    const processedPages = await this.contentRepository.count({
      where: { documentId },
    });

    return {
      status: document.ocrStatus,
      pageCount: document.pageCount,
      processedPages,
      error: document.ocrError,
    };
  }

  /**
   * Reprocess a failed document
   */
  async reprocessDocument(documentId: string): Promise<OcrResult> {
    this.logger.log(`Reprocessing document: ${documentId}`);

    // Delete existing content
    await this.contentRepository.delete({ documentId });

    // Reset document status
    await this.documentRepository.update(documentId, {
      ocrStatus: OcrStatus.PENDING,
      ocrError: null,
      pageCount: null,
      processedAt: null,
    });

    // Process again
    return this.processDocument(documentId);
  }

  /**
   * Process pending documents in batch
   */
  async processPendingDocuments(): Promise<{
    processed: number;
    successful: number;
    failed: number;
    results: OcrResult[];
  }> {
    const result = {
      processed: 0,
      successful: 0,
      failed: 0,
      results: [] as OcrResult[],
    };

    try {
      // Get pending documents
      const pendingDocuments = await this.documentRepository.find({
        where: { ocrStatus: OcrStatus.PENDING },
        take: this.batchSize,
        order: { createdAt: 'ASC' },
      });

      if (pendingDocuments.length === 0) {
        this.logger.debug('No pending documents to process');
        return result;
      }

      this.logger.log(`Processing ${pendingDocuments.length} pending documents...`);

      // Process each document
      for (const document of pendingDocuments) {
        try {
          const ocrResult = await this.processDocument(document.id);
          result.results.push(ocrResult);
          result.processed++;

          if (ocrResult.status === OcrStatus.COMPLETED) {
            result.successful++;
          } else {
            result.failed++;
          }

          this.logger.log(
            `Processed document ${document.fileName}: ${ocrResult.status}`,
          );
        } catch (error) {
          result.failed++;
          this.logger.error(
            `Failed to process document ${document.fileName}`,
            error.stack,
          );
        }
      }

      this.logger.log(
        `Batch processing completed: ${result.successful} successful, ${result.failed} failed`,
      );
    } catch (error) {
      this.logger.error('Failed to process pending documents', error.stack);
    }

    return result;
  }

  /**
   * Scheduled task: Process pending OCR documents every 15 minutes
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleScheduledOcrProcessing() {
    if (this.isProcessing) {
      this.logger.debug('OCR processing already in progress, skipping scheduled run');
      return;
    }

    this.logger.log('Running scheduled OCR processing...');

    try {
      this.isProcessing = true;

      // Check for pending documents
      const pendingCount = await this.documentRepository.count({
        where: { ocrStatus: OcrStatus.PENDING },
      });

      if (pendingCount === 0) {
        this.logger.debug('No pending documents for OCR processing');
        return;
      }

      this.logger.log(`Found ${pendingCount} pending documents for OCR processing`);

      // Process pending documents
      const result = await this.processPendingDocuments();

      this.logger.log(
        `Scheduled OCR processing completed: ${result.successful} successful, ${result.failed} failed`,
      );
    } catch (error) {
      this.logger.error('Scheduled OCR processing failed', error.stack);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get OCR processing statistics
   */
  async getProcessingStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    manualReview: number;
    total: number;
  }> {
    const [pending, processing, completed, failed, manualReview, total] = await Promise.all([
      this.documentRepository.count({ where: { ocrStatus: OcrStatus.PENDING } }),
      this.documentRepository.count({ where: { ocrStatus: OcrStatus.PROCESSING } }),
      this.documentRepository.count({ where: { ocrStatus: OcrStatus.COMPLETED } }),
      this.documentRepository.count({ where: { ocrStatus: OcrStatus.FAILED } }),
      this.documentRepository.count({ where: { ocrStatus: OcrStatus.MANUAL_REVIEW } }),
      this.documentRepository.count(),
    ]);

    return {
      pending,
      processing,
      completed,
      failed,
      manualReview,
      total,
    };
  }
}
