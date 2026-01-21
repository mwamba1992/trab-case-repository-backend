import {
  Controller,
  Post,
  Get,
  Param,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaseDocument, OcrStatus } from '../cases/entities/case-document.entity';
import { OcrService } from './ocr.service';
import { SimpleQueueService, QueueJob } from './simple-queue.service';

@ApiTags('OCR')
@Controller('ocr')
export class OcrController {
  constructor(
    @InjectRepository(CaseDocument)
    private documentRepository: Repository<CaseDocument>,
    private ocrService: OcrService,
    private simpleQueue: SimpleQueueService,
  ) {}

  @Post('process/pending')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Queue all pending documents for OCR processing' })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Documents queued for processing',
  })
  async processPendingDocuments(): Promise<{
    queued: number;
    documents: string[];
    jobs: QueueJob[];
  }> {
    // Find all pending documents
    const pendingDocs = await this.documentRepository.find({
      where: { ocrStatus: OcrStatus.PENDING },
    });

    const jobs: QueueJob[] = [];

    // Queue each document
    for (const doc of pendingDocs) {
      const job = this.simpleQueue.addJob(doc.id, doc.caseId, doc.fileName);
      jobs.push(job);
    }

    return {
      queued: jobs.length,
      documents: jobs.map((j) => j.fileName),
      jobs,
    };
  }

  @Post('process/:documentId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Queue a specific document for OCR processing' })
  @ApiParam({ name: 'documentId', description: 'Document UUID' })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Document queued for processing',
  })
  async processDocument(
    @Param('documentId') documentId: string,
  ): Promise<{ jobId: string; fileName: string; job: QueueJob }> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    const job = this.simpleQueue.addJob(
      document.id,
      document.caseId,
      document.fileName,
    );

    return {
      jobId: job.id,
      fileName: document.fileName,
      job,
    };
  }

  @Post('reprocess/:documentId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Reprocess a failed document' })
  @ApiParam({ name: 'documentId', description: 'Document UUID' })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Document queued for reprocessing',
  })
  async reprocessDocument(
    @Param('documentId') documentId: string,
  ): Promise<{ jobId: string; fileName: string; job: QueueJob }> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // First, reprocess to reset the document
    await this.ocrService.reprocessDocument(documentId);

    // Then queue it
    const job = this.simpleQueue.addJob(
      document.id,
      document.caseId,
      document.fileName,
    );

    return {
      jobId: job.id,
      fileName: document.fileName,
      job,
    };
  }

  @Get('status/:documentId')
  @ApiOperation({ summary: 'Get OCR processing status for a document' })
  @ApiParam({ name: 'documentId', description: 'Document UUID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Document status' })
  async getDocumentStatus(@Param('documentId') documentId: string): Promise<{
    status: OcrStatus;
    pageCount: number | null;
    processedPages: number;
    error: string | null;
  }> {
    return this.ocrService.getDocumentStatus(documentId);
  }

  @Get('queue/stats')
  @ApiOperation({ summary: 'Get OCR queue statistics' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Queue statistics' })
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    total: number;
  }> {
    return this.simpleQueue.getStats();
  }

  @Get('queue/jobs')
  @ApiOperation({ summary: 'Get recent queue jobs' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Recent jobs' })
  async getRecentJobs(): Promise<{ jobs: QueueJob[] }> {
    const jobs = this.simpleQueue.getRecentJobs(50);
    return { jobs };
  }

  @Get('queue/job/:jobId')
  @ApiOperation({ summary: 'Get job status by ID' })
  @ApiParam({ name: 'jobId', description: 'Job ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Job details' })
  async getJobStatus(@Param('jobId') jobId: string): Promise<QueueJob> {
    const job = this.simpleQueue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    return job;
  }

  @Get('documents/stats')
  @ApiOperation({ summary: 'Get document processing statistics' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Document statistics' })
  async getDocumentStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    manualReview: number;
  }> {
    const [total, pending, processing, completed, failed, manualReview] =
      await Promise.all([
        this.documentRepository.count(),
        this.documentRepository.count({
          where: { ocrStatus: OcrStatus.PENDING },
        }),
        this.documentRepository.count({
          where: { ocrStatus: OcrStatus.PROCESSING },
        }),
        this.documentRepository.count({
          where: { ocrStatus: OcrStatus.COMPLETED },
        }),
        this.documentRepository.count({
          where: { ocrStatus: OcrStatus.FAILED },
        }),
        this.documentRepository.count({
          where: { ocrStatus: OcrStatus.MANUAL_REVIEW },
        }),
      ]);

    return {
      total,
      pending,
      processing,
      completed,
      failed,
      manualReview,
    };
  }
}
