import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Case } from '../cases/entities/case.entity';
import { TraisClientService } from './services/trais-client.service';
import { TraisMapperService } from './services/trais-mapper.service';
import { TraisAppealDto } from './dto/trais-appeal.dto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface SyncResult {
  success: boolean;
  processed: number;
  created: number;
  updated: number;
  failed: number;
  errors: string[];
  duration: number;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private isSyncing = false;

  constructor(
    @InjectRepository(Case)
    private caseRepository: Repository<Case>,
    private traisClient: TraisClientService,
    private traisMapper: TraisMapperService,
  ) {}

  /**
   * Sync all appeals from TRAIS (full sync)
   */
  async syncAll(options?: { maxPages?: number }): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    const startTime = Date.now();

    const result: SyncResult = {
      success: true,
      processed: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
      duration: 0,
    };

    try {
      this.logger.log('Starting full sync from TRAIS...');

      // Get total count
      const total = await this.traisClient.getTotalCount();
      this.logger.log(`Total appeals in TRAIS: ${total}`);

      const pageSize = 50;
      const maxPages = options?.maxPages || Math.ceil(total / pageSize);

      // Fetch and process pages
      for (let page = 0; page < maxPages; page++) {
        try {
          this.logger.debug(`Processing page ${page + 1}/${maxPages}`);

          const response = await this.traisClient.getAppeals(page, pageSize);
          const appeals = response._embedded?.appeals || [];

          if (appeals.length === 0) {
            this.logger.debug('No more appeals to process');
            break;
          }

          // Process each appeal
          for (const appeal of appeals) {
            try {
              const syncResult = await this.syncSingleAppeal(appeal);
              result.processed++;

              if (syncResult.created) {
                result.created++;
              } else if (syncResult.updated) {
                result.updated++;
              }
            } catch (error) {
              result.failed++;
              result.errors.push(`Appeal ${appeal.appealNo}: ${error.message}`);
              this.logger.error(`Failed to sync appeal ${appeal.appealNo}`, error.stack);
            }
          }

          // Add small delay between pages to avoid overwhelming the API
          await this.delay(500);
        } catch (error) {
          result.errors.push(`Page ${page}: ${error.message}`);
          this.logger.error(`Failed to process page ${page}`, error.stack);
        }
      }

      result.success = result.failed === 0;
      result.duration = Date.now() - startTime;

      this.logger.log(
        `Sync completed: ${result.created} created, ${result.updated} updated, ${result.failed} failed in ${result.duration}ms`,
      );
    } catch (error) {
      result.success = false;
      result.errors.push(error.message);
      this.logger.error('Sync failed', error.stack);
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  /**
   * Sync appeals updated since last sync (incremental sync)
   */
  async syncIncremental(): Promise<SyncResult> {
    const startTime = Date.now();

    const result: SyncResult = {
      success: true,
      processed: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
      duration: 0,
    };

    try {
      this.logger.log('Starting incremental sync...');

      // Find the most recent sync date
      const lastSyncedCase = await this.caseRepository
        .createQueryBuilder('case')
        .where('case.synced_at IS NOT NULL')
        .orderBy('case.synced_at', 'DESC')
        .getOne();

      const since = lastSyncedCase?.syncedAt || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days

      this.logger.log(`Syncing appeals updated since ${since.toISOString()}`);

      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const response = await this.traisClient.getUpdatedAppeals(since, page, 50);
        const appeals = response._embedded?.appeals || [];

        if (appeals.length === 0) {
          hasMore = false;
          break;
        }

        for (const appeal of appeals) {
          try {
            const syncResult = await this.syncSingleAppeal(appeal);
            result.processed++;

            if (syncResult.created) {
              result.created++;
            } else if (syncResult.updated) {
              result.updated++;
            }
          } catch (error) {
            result.failed++;
            result.errors.push(`Appeal ${appeal.appealNo}: ${error.message}`);
          }
        }

        page++;
        await this.delay(500);
      }

      result.duration = Date.now() - startTime;
      this.logger.log(`Incremental sync completed: ${result.created} created, ${result.updated} updated`);
    } catch (error) {
      result.success = false;
      result.errors.push(error.message);
      this.logger.error('Incremental sync failed', error.stack);
    }

    return result;
  }

  /**
   * Sync a single appeal by ID
   */
  async syncAppealById(appealId: number): Promise<{ created: boolean; updated: boolean }> {
    this.logger.log(`Syncing appeal ${appealId}...`);

    const appeal = await this.traisClient.getAppealById(appealId);
    return this.syncSingleAppeal(appeal);
  }

  /**
   * Process and save a single appeal
   */
  private async syncSingleAppeal(appeal: TraisAppealDto): Promise<{ created: boolean; updated: boolean }> {
    // Map TRAIS data to our Case entity
    const caseData = this.traisMapper.mapAppealToCase(appeal);

    // Populate chairperson from judges array if mapper didn't set it
    // This must be done AFTER mapping but BEFORE saving
    if (caseData.judges && caseData.judges.length > 0) {
      if (!caseData.chairperson || caseData.chairperson.trim() === '') {
        caseData.chairperson = caseData.judges[0];
        this.logger.debug(`Populated chairperson from judges: ${caseData.chairperson}`);
      }
      if (caseData.judges.length > 1 && (!caseData.boardMembers || caseData.boardMembers.length === 0)) {
        caseData.boardMembers = caseData.judges.slice(1);
        this.logger.debug(`Populated board members from judges: ${caseData.boardMembers.length}`);
      }
    }

    // Check if case already exists
    let existingCase = await this.caseRepository.findOne({
      where: [{ traisId: appeal.appealId.toString() }, { caseNumber: appeal.appealNo }],
    });

    let created = false;
    let updated = false;

    if (existingCase) {
      // Update existing case
      Object.assign(existingCase, caseData);
      existingCase.syncedAt = new Date();
      await this.caseRepository.save(existingCase);
      updated = true;
      this.logger.debug(`Updated case ${appeal.appealNo}`);
    } else {
      // Create new case
      const newCase = this.caseRepository.create(caseData);
      existingCase = await this.caseRepository.save(newCase);
      created = true;
      this.logger.debug(`Created case ${appeal.appealNo}`);
    }

    // Download PDF if available (async, don't wait)
    this.downloadPdfForCase(appeal, existingCase.id).catch((error) => {
      this.logger.warn(`Failed to download PDF for ${appeal.appealNo}: ${error.message}`);
    });

    return { created, updated };
  }

  /**
   * Download and save PDF decision document
   */
  private async downloadPdfForCase(appeal: TraisAppealDto, caseId: string): Promise<void> {
    try {
      // Get PDF filename from copyOfJudgement field (e.g., "Appeal_45851.pdf")
      const pdfFileName = appeal.copyOfJudgement || `Appeal_${appeal.appealId}.pdf`;

      // Skip if no PDF available
      if (!pdfFileName || pdfFileName.trim() === '') {
        this.logger.debug(`No PDF available for ${appeal.appealNo}`);
        return;
      }

      const pdfBuffer = await this.traisClient.downloadDecisionPdf(
        appeal.appealNo,
        appeal.appealId,
        pdfFileName,
      );

      if (!pdfBuffer) {
        this.logger.debug(`Could not download PDF for ${appeal.appealNo} (${pdfFileName})`);
        return;
      }

      // Save PDF to storage
      const uploadsDir = path.join(process.cwd(), 'uploads', 'decisions');
      await fs.mkdir(uploadsDir, { recursive: true });

      // Use case UUID as filename to ensure uniqueness
      // Appeal numbers can be duplicated across different tax types
      // Format: {caseId}.pdf (UUID ensures uniqueness)
      const pdfPath = path.join(uploadsDir, `${caseId}.pdf`);

      await fs.writeFile(pdfPath, pdfBuffer);

      // Calculate hash
      const hash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

      // Update case with PDF info
      await this.caseRepository.update(caseId, {
        pdfUrl: `/uploads/decisions/${caseId}.pdf`,
        pdfHash: hash,
      });

      this.logger.log(`Downloaded PDF for ${appeal.appealNo} (${pdfFileName}, ${pdfBuffer.length} bytes)`);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Scheduled daily incremental sync (runs at 2 AM)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleScheduledSync() {
    this.logger.log('Running scheduled incremental sync...');
    try {
      await this.syncIncremental();
    } catch (error) {
      this.logger.error('Scheduled sync failed', error.stack);
    }
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{
    isSyncing: boolean;
    totalCases: number;
    lastSyncDate: Date | null;
    casesByStatus: any;
  }> {
    const [totalCases, lastSyncedCase, casesByStatus] = await Promise.all([
      this.caseRepository.count(),
      this.caseRepository
        .createQueryBuilder('case')
        .where('case.synced_at IS NOT NULL')
        .orderBy('case.synced_at', 'DESC')
        .getOne(),
      this.caseRepository
        .createQueryBuilder('case')
        .select('case.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('case.status')
        .getRawMany(),
    ]);

    return {
      isSyncing: this.isSyncing,
      totalCases,
      lastSyncDate: lastSyncedCase?.syncedAt || null,
      casesByStatus: casesByStatus.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count, 10);
        return acc;
      }, {}),
    };
  }

  /**
   * Test TRAIS connection
   */
  async testConnection(): Promise<boolean> {
    return this.traisClient.testConnection();
  }

  /**
   * Helper: delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
