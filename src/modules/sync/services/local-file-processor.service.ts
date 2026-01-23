import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
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
export class LocalFileProcessorService implements OnModuleInit {
  private readonly logger = new Logger(LocalFileProcessorService.name);
  private readonly sourceDir: string;
  private isProcessing = false;

  constructor(
    @InjectRepository(Case)
    private caseRepository: Repository<Case>,
    @InjectRepository(CaseDocument)
    private documentRepository: Repository<CaseDocument>,
    private traisClient: TraisClientService,
    private traisMapper: TraisMapperService,
    private configService: ConfigService,
  ) {
    // Get source directory from environment variable or use default
    this.sourceDir = this.configService.get<string>(
      'LOCAL_FILES_SOURCE_DIR',
      '/Users/mwendavano/trab/files',
    );
    this.logger.log(`Local files source directory: ${this.sourceDir}`);
  }

  /**
   * Run on application startup - check for unprocessed files
   */
  async onModuleInit() {
    this.logger.log('🚀 Application started - checking for unprocessed files...');

    // Add a small delay to ensure database connections are ready
    setTimeout(async () => {
      try {
        const unprocessed = await this.getUnprocessedFiles();

        if (unprocessed.length === 0) {
          this.logger.log('✓ No unprocessed files found on startup');
          return;
        }

        this.logger.log(`📁 Found ${unprocessed.length} unprocessed files on startup, processing...`);

        this.isProcessing = true;
        const result = await this.processLocalFiles();

        this.logger.log(
          `✓ Startup file processing completed: ${result.processed} processed, ${result.skipped} skipped, ${result.failed} failed`,
        );
      } catch (error) {
        this.logger.error('Startup file processing failed', error.stack);
      } finally {
        this.isProcessing = false;
      }
    }, 3000); // Wait 3 seconds for app to fully initialize
  }

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
    const pdfInfo = await this.copyPdfToUploads(filename, caseEntity.id);

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
    caseId: string,
  ): Promise<{ path: string; url: string; hash: string; size: number }> {
    const sourcePath = path.join(this.sourceDir, filename);
    const uploadsDir = path.join(process.cwd(), 'uploads', 'decisions');

    // Ensure uploads directory exists
    await fs.mkdir(uploadsDir, { recursive: true });

    // Read file
    const buffer = await fs.readFile(sourcePath);

    // Use case UUID as filename to ensure uniqueness
    // Appeal numbers can be duplicated across different tax types
    // Format: {caseId}.pdf (UUID ensures uniqueness)
    const destPath = path.join(uploadsDir, `${caseId}.pdf`);

    // Copy file
    await fs.writeFile(destPath, buffer);

    // Calculate hash
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    return {
      path: destPath,
      url: `/uploads/decisions/${caseId}.pdf`,
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

  /**
   * Scheduled task: Scan and process local files every 10 minutes
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleScheduledFileScan() {
    if (this.isProcessing) {
      this.logger.debug('File processing already in progress, skipping scheduled scan');
      return;
    }

    this.logger.log('Running scheduled file scan...');

    try {
      this.isProcessing = true;
      const unprocessed = await this.getUnprocessedFiles();

      if (unprocessed.length === 0) {
        this.logger.debug('No unprocessed files found');
        return;
      }

      this.logger.log(`Found ${unprocessed.length} unprocessed files, starting processing...`);
      const result = await this.processLocalFiles();

      this.logger.log(
        `Scheduled file scan completed: ${result.processed} processed, ${result.skipped} skipped, ${result.failed} failed`,
      );
    } catch (error) {
      this.logger.error('Scheduled file scan failed', error.stack);
    } finally {
      this.isProcessing = false;
    }
  }
}
