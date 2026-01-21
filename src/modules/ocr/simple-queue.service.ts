import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OcrService, OcrResult } from './ocr.service';

export interface QueueJob {
  id: string;
  documentId: string;
  caseId: string;
  fileName: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;
  result?: OcrResult;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

@Injectable()
export class SimpleQueueService implements OnModuleInit {
  private readonly logger = new Logger(SimpleQueueService.name);
  private queue: QueueJob[] = [];
  private isProcessing = false;
  private jobIdCounter = 0;

  constructor(private readonly ocrService: OcrService) {}

  onModuleInit() {
    this.logger.log('Simple Queue Service initialized');
    // Start processing queue in background
    this.processQueue();
  }

  /**
   * Add a job to the queue
   */
  addJob(documentId: string, caseId: string, fileName: string): QueueJob {
    const job: QueueJob = {
      id: `job_${++this.jobIdCounter}_${Date.now()}`,
      documentId,
      caseId,
      fileName,
      status: 'waiting',
      progress: 0,
      createdAt: new Date(),
    };

    this.queue.push(job);
    this.logger.log(`Job added to queue: ${job.id} (${fileName})`);

    // Trigger queue processing
    if (!this.isProcessing) {
      this.processQueue();
    }

    return job;
  }

  /**
   * Process queue continuously
   */
  private async processQueue() {
    if (this.isProcessing) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const job = this.queue.find((j) => j.status === 'waiting');

      if (!job) {
        // No waiting jobs
        break;
      }

      await this.processJob(job);
    }

    this.isProcessing = false;
  }

  /**
   * Process a single job
   */
  private async processJob(job: QueueJob) {
    job.status = 'active';
    job.startedAt = new Date();
    job.progress = 10;

    this.logger.log(`Processing job: ${job.id} (${job.fileName})`);

    try {
      // Process the document
      const result = await this.ocrService.processDocument(job.documentId);

      job.result = result;
      job.status = 'completed';
      job.progress = 100;
      job.completedAt = new Date();

      this.logger.log(
        `Job completed: ${job.id} - ${result.processedPages}/${result.totalPages} pages`,
      );
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date();

      this.logger.error(`Job failed: ${job.id} - ${error.message}`);
    }
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): QueueJob | undefined {
    return this.queue.find((j) => j.id === jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): QueueJob[] {
    return [...this.queue];
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    total: number;
  } {
    return {
      waiting: this.queue.filter((j) => j.status === 'waiting').length,
      active: this.queue.filter((j) => j.status === 'active').length,
      completed: this.queue.filter((j) => j.status === 'completed').length,
      failed: this.queue.filter((j) => j.status === 'failed').length,
      total: this.queue.length,
    };
  }

  /**
   * Clear completed jobs (cleanup)
   */
  clearCompleted() {
    const before = this.queue.length;
    this.queue = this.queue.filter(
      (j) => j.status !== 'completed' && j.status !== 'failed',
    );
    const removed = before - this.queue.length;

    if (removed > 0) {
      this.logger.log(`Cleared ${removed} completed/failed jobs from queue`);
    }

    return removed;
  }

  /**
   * Get recent jobs (last 50)
   */
  getRecentJobs(limit = 50): QueueJob[] {
    return this.queue.slice(-limit).reverse();
  }
}
