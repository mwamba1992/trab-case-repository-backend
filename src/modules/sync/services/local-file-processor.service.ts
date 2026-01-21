import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case } from '../../cases/entities/case.entity';
import { CaseDocument, OcrStatus } from '../../cases/entities/case-document.entity';
import { TraisClientService } from './trais-client.service';
import { TraisMapperService } from './trais-mapper.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface ProcessResult {
  totalFiles: number;
  processed: number;
  skipped: number;
  failed: number;
  errors: string[];
}

@Injectable()
export class LocalFileProcessorService {
  private readonly logger = new Logger(LocalFileProcessorService.name);
  private readonly sourceDir = '/Users/mwendavano/trab/files';

  constructor(
    @InjectRepository(Case)
    private caseRepository: Repository<Case>,
    @InjectRepository(CaseDocument)
    private documentRepository: Repository<CaseDocument>,
    private traisClient: TraisClientService,
    private traisMapper: TraisMapperService,
  ) {}

  /**
   * Process all unprocessed PDF files from local directory
   */
  async processLocalFiles(): Promise<ProcessResult> {
    const result: ProcessResult = {
      totalFiles: 0,
      processed: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    try {
      this.logger.log(`Scanning directory: ${this.sourceDir}`);

      // Check if directory exists
      try {
        await fs.access(this.sourceDir);
      } catch {
        throw new Error(`Directory not found: ${this.sourceDir}`);
      }

      // Read all files from directory
      const files = await fs.readdir(this.sourceDir);

      // Filter PDF files with Appeal pattern
      const pdfFiles = files.filter(
        (file) => file.endsWith('.pdf') && file.startsWith('Appeal_'),
      );

      result.totalFiles = pdfFiles.length;
      this.logger.log(`Found ${pdfFiles.length} PDF files to process`);

      // Process each file
      for (const filename of pdfFiles) {
        try {
          const processed = await this.processFile(filename);

          if (processed.skipped) {
            result.skipped++;
            this.logger.debug(`Skipped: ${filename} (already processed)`);
          } else {
            result.processed++;
            this.logger.log(`✓ Processed: ${filename}`);
          }
        } catch (error) {
          result.failed++;
          result.errors.push(`${filename}: ${error.message}`);
          this.logger.error(`✗ Failed: ${filename}`, error.stack);
        }
      }

      this.logger.log(
        `Processing complete: ${result.processed} processed, ${result.skipped} skipped, ${result.failed} failed`,
      );
    } catch (error) {
      result.errors.push(`Processing failed: ${error.message}`);
      this.logger.error('Processing failed', error.stack);
    }

    return result;
  }

  /**
   * Process a single PDF file
   */
  private async processFile(filename: string): Promise<{ skipped: boolean }> {
    // Extract appealId from filename (Appeal_45851.pdf -> 45851)
    const appealId = this.extractAppealId(filename);

    if (!appealId) {
      throw new Error(`Could not extract appeal ID from filename: ${filename}`);
    }

    this.logger.debug(`Processing ${filename} (Appeal ID: ${appealId})`);

    // Check if already processed
    const existingCase = await this.caseRepository.findOne({
      where: { traisId: appealId.toString() },
      relations: ['documents'],
    });

    // Check if document already exists
    if (existingCase?.documents?.some((doc) => doc.fileName === filename)) {
      return { skipped: true };
    }

    // Fetch appeal metadata from TRAIS
    const appeal = await this.traisClient.getAppealById(appealId);

    // Create or update case
    let caseEntity: Case;

    if (existingCase) {
      // Update existing case
      const caseData = this.traisMapper.mapAppealToCase(appeal);
      Object.assign(existingCase, caseData);
      caseEntity = await this.caseRepository.save(existingCase);
    } else {
      // Create new case
      const caseData = this.traisMapper.mapAppealToCase(appeal);
      caseEntity = this.caseRepository.create(caseData);
      caseEntity = await this.caseRepository.save(caseEntity);
    }

    // Copy PDF to uploads directory
    const pdfInfo = await this.copyPdfToUploads(filename, appeal.appealNo);

    // Update case with PDF info
    await this.caseRepository.update(caseEntity.id, {
      pdfUrl: pdfInfo.url,
      pdfHash: pdfInfo.hash,
    });

    // Create document record
    await this.createDocumentRecord(caseEntity.id, filename, pdfInfo);

    return { skipped: false };
  }

  /**
   * Extract appeal ID from filename
   * Appeal_45851.pdf -> 45851
   */
  private extractAppealId(filename: string): number | null {
    const match = filename.match(/Appeal_(\d+)\.pdf$/i);
    if (!match) return null;

    const appealId = parseInt(match[1], 10);
    return isNaN(appealId) ? null : appealId;
  }

  /**
   * Copy PDF from source directory to uploads directory
   */
  private async copyPdfToUploads(
    filename: string,
    appealNo: string,
  ): Promise<{ path: string; url: string; hash: string; size: number }> {
    const sourcePath = path.join(this.sourceDir, filename);
    const uploadsDir = path.join(process.cwd(), 'uploads', 'decisions');

    // Ensure uploads directory exists
    await fs.mkdir(uploadsDir, { recursive: true });

    // Read file
    const buffer = await fs.readFile(sourcePath);

    // Generate filename from appeal number
    const sanitizedFileName = appealNo.replace(/[^a-zA-Z0-9-]/g, '_');
    const destPath = path.join(uploadsDir, `${sanitizedFileName}.pdf`);

    // Copy file
    await fs.writeFile(destPath, buffer);

    // Calculate hash
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    return {
      path: destPath,
      url: `/uploads/decisions/${sanitizedFileName}.pdf`,
      hash,
      size: buffer.length,
    };
  }

  /**
   * Create document record in database
   */
  private async createDocumentRecord(
    caseId: string,
    filename: string,
    pdfInfo: { path: string; url: string; hash: string; size: number },
  ): Promise<CaseDocument> {
    const document = this.documentRepository.create({
      caseId,
      documentType: 'decision',
      fileName: filename,
      filePath: pdfInfo.path,
      fileSize: pdfInfo.size,
      mimeType: 'application/pdf',
      fileHash: pdfInfo.hash,
      ocrStatus: OcrStatus.PENDING,
      pageCount: null,
    });

    return this.documentRepository.save(document);
  }

  /**
   * Get list of unprocessed files
   */
  async getUnprocessedFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.sourceDir);
      const pdfFiles = files.filter(
        (file) => file.endsWith('.pdf') && file.startsWith('Appeal_'),
      );

      // Check which files are already processed
      const unprocessed: string[] = [];

      for (const filename of pdfFiles) {
        const appealId = this.extractAppealId(filename);
        if (!appealId) continue;

        const existingCase = await this.caseRepository.findOne({
          where: { traisId: appealId.toString() },
          relations: ['documents'],
        });

        // Check if document already exists
        const alreadyProcessed = existingCase?.documents?.some(
          (doc) => doc.fileName === filename,
        );

        if (!alreadyProcessed) {
          unprocessed.push(filename);
        }
      }

      return unprocessed;
    } catch (error) {
      this.logger.error('Failed to get unprocessed files', error.stack);
      return [];
    }
  }

  /**
   * Get processing statistics
   */
  async getStats(): Promise<{
    totalFilesInDirectory: number;
    processedFiles: number;
    unprocessedFiles: number;
    files: string[];
  }> {
    try {
      const files = await fs.readdir(this.sourceDir);
      const pdfFiles = files.filter(
        (file) => file.endsWith('.pdf') && file.startsWith('Appeal_'),
      );

      const unprocessedFiles = await this.getUnprocessedFiles();

      return {
        totalFilesInDirectory: pdfFiles.length,
        processedFiles: pdfFiles.length - unprocessedFiles.length,
        unprocessedFiles: unprocessedFiles.length,
        files: unprocessedFiles,
      };
    } catch (error) {
      this.logger.error('Failed to get stats', error.stack);
      return {
        totalFilesInDirectory: 0,
        processedFiles: 0,
        unprocessedFiles: 0,
        files: [],
      };
    }
  }
}
