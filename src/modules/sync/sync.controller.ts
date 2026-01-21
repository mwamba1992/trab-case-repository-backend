import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  ParseIntPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { SyncService, SyncResult } from './sync.service';
import { LocalFileProcessorService, ProcessResult } from './services/local-file-processor.service';

@ApiTags('Sync')
@Controller('sync')
export class SyncController {
  constructor(
    private readonly syncService: SyncService,
    private readonly localFileProcessor: LocalFileProcessorService,
  ) {}

  @Post('full')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger full sync from TRAIS (admin only)' })
  @ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Sync started' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Sync already in progress' })
  @ApiQuery({ name: 'maxPages', required: false, description: 'Maximum pages to sync' })
  async triggerFullSync(@Query('maxPages', ParseIntPipe) maxPages?: number): Promise<SyncResult> {
    return this.syncService.syncAll({ maxPages });
  }

  @Post('incremental')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger incremental sync (updates only)' })
  @ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Incremental sync started' })
  async triggerIncrementalSync(): Promise<SyncResult> {
    return this.syncService.syncIncremental();
  }

  @Post('appeal/:appealId')
  @ApiOperation({ summary: 'Sync a single appeal by ID' })
  @ApiParam({ name: 'appealId', description: 'TRAIS Appeal ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Appeal synced successfully' })
  async syncSingleAppeal(
    @Param('appealId', ParseIntPipe) appealId: number,
  ): Promise<{ created: boolean; updated: boolean }> {
    return this.syncService.syncAppealById(appealId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get sync status and statistics' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Sync status' })
  async getSyncStatus(): Promise<{
    isSyncing: boolean;
    totalCases: number;
    lastSyncDate: Date | null;
    casesByStatus: any;
  }> {
    return this.syncService.getSyncStatus();
  }

  @Get('test-connection')
  @ApiOperation({ summary: 'Test connection to TRAIS API' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Connection test result' })
  async testConnection(): Promise<{ connected: boolean }> {
    const connected = await this.syncService.testConnection();
    return { connected };
  }

  // Local file processing endpoints

  @Post('process-local-files')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Process all unprocessed PDF files from local directory' })
  @ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Processing started' })
  async processLocalFiles(): Promise<ProcessResult> {
    return this.localFileProcessor.processLocalFiles();
  }

  @Get('local-files/unprocessed')
  @ApiOperation({ summary: 'Get list of unprocessed local files' })
  @ApiResponse({ status: HttpStatus.OK, description: 'List of unprocessed files' })
  async getUnprocessedFiles(): Promise<{ files: string[] }> {
    const files = await this.localFileProcessor.getUnprocessedFiles();
    return { files };
  }

  @Get('local-files/stats')
  @ApiOperation({ summary: 'Get local files processing statistics' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Processing statistics' })
  async getLocalFilesStats(): Promise<{
    totalFilesInDirectory: number;
    processedFiles: number;
    unprocessedFiles: number;
    files: string[];
  }> {
    return this.localFileProcessor.getStats();
  }
}
