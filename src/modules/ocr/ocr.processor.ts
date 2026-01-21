import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { OcrService, OcrResult } from './ocr.service';

export interface OcrJobData {
  documentId: string;
  caseId: string;
  fileName: string;
}

@Processor('ocr')
export class OcrProcessor {
  private readonly logger = new Logger(OcrProcessor.name);

  constructor(private readonly ocrService: OcrService) {}

  @Process('process-document')
  async processDocument(job: Job<OcrJobData>): Promise<OcrResult> {
    const { documentId, fileName } = job.data;

    this.logger.log(`Processing OCR job for document: ${fileName}`);

    try {
      // Update job progress
      await job.progress(10);

      // Process the document
      const result = await this.ocrService.processDocument(documentId);

      // Update job progress based on result
      const progress = Math.floor(
        (result.processedPages / result.totalPages) * 100,
      );
      await job.progress(progress);

      this.logger.log(
        `OCR job completed for ${fileName}: ${result.processedPages}/${result.totalPages} pages`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `OCR job failed for ${fileName}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Process('reprocess-document')
  async reprocessDocument(job: Job<OcrJobData>): Promise<OcrResult> {
    const { documentId, fileName } = job.data;

    this.logger.log(`Reprocessing OCR job for document: ${fileName}`);

    try {
      await job.progress(10);

      const result = await this.ocrService.reprocessDocument(documentId);

      const progress = Math.floor(
        (result.processedPages / result.totalPages) * 100,
      );
      await job.progress(progress);

      this.logger.log(
        `OCR reprocessing completed for ${fileName}: ${result.processedPages}/${result.totalPages} pages`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `OCR reprocessing failed for ${fileName}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
