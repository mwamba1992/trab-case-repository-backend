import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('System')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'API health check' })
  @ApiResponse({ status: 200, description: 'API is running' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('scheduler/status')
  @ApiOperation({ summary: 'Get scheduled tasks status' })
  @ApiResponse({ status: 200, description: 'Scheduler status information' })
  getSchedulerStatus(): {
    enabled: true;
    scheduledTasks: Array<{
      name: string;
      schedule: string;
      description: string;
      nextRun: string;
    }>;
    uptime: number;
  } {
    return {
      enabled: true,
      scheduledTasks: [
        {
          name: 'File Scanner',
          schedule: '*/10 * * * *',
          description: 'Scans local directory for unprocessed PDF files and imports them',
          nextRun: 'Every 10 minutes',
        },
        {
          name: 'OCR Processor',
          schedule: '*/10 * * * *',
          description: 'Processes pending documents with OCR and generates embeddings',
          nextRun: 'Every 10 minutes',
        },
        {
          name: 'Incremental Sync',
          schedule: '0 2 * * *',
          description: 'Syncs updated cases from TRAIS API',
          nextRun: 'Daily at 2:00 AM',
        },
      ],
      uptime: process.uptime(),
    };
  }
}
