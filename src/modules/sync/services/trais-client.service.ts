import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TraisAppealDto, TraisAppealListResponseDto } from '../dto/trais-appeal.dto';

@Injectable()
export class TraisClientService {
  private readonly logger = new Logger(TraisClientService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get('trais.baseUrl') || 'https://trais.mof.go.tz';
  }

  /**
   * Get common headers for requests
   */
  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  /**
   * Get appeal by ID using the correct TRAIS endpoint
   */
  async getAppealById(appealId: number): Promise<TraisAppealDto> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.baseUrl}/appeals/search/findByAppealId`,
          {
            headers: this.getHeaders(),
            params: { appealId },
          },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch appeal ${appealId}`, error.message);
      throw error;
    }
  }

  /**
   * Get list of appeals with pagination
   */
  async getAppeals(
    page = 0,
    size = 50,
    filters?: {
      status?: string;
      taxType?: string;
      decidedDateFrom?: string;
      decidedDateTo?: string;
    },
  ): Promise<TraisAppealListResponseDto> {
    try {
      const params: any = {
        page,
        size,
        sort: 'decidedDate,desc',
      };

      // Add filters if provided
      if (filters?.status) {
        params.status = filters.status;
      }
      if (filters?.taxType) {
        params.taxType = filters.taxType;
      }
      if (filters?.decidedDateFrom) {
        params.decidedDateFrom = filters.decidedDateFrom;
      }
      if (filters?.decidedDateTo) {
        params.decidedDateTo = filters.decidedDateTo;
      }

      this.logger.debug(`Fetching appeals: page=${page}, size=${size}`);

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/api/appeals`, {
          headers: this.getHeaders(),
          params,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch appeals', error.message);
      throw error;
    }
  }

  /**
   * Get appeals updated since a specific date
   */
  async getUpdatedAppeals(since: Date, page = 0, size = 50): Promise<TraisAppealListResponseDto> {
    try {
      const params = {
        page,
        size,
        updatedAt: since.toISOString(),
        sort: 'updatedAt,desc',
      };

      this.logger.debug(`Fetching appeals updated since ${since.toISOString()}`);

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/api/appeals`, {
          headers: this.getHeaders(),
          params,
        }),
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch updated appeals', error.message);
      throw error;
    }
  }

  /**
   * Download PDF decision document
   * PDF naming pattern: Appeal_{appealId}.pdf (e.g., Appeal_46566.pdf)
   */
  async downloadDecisionPdf(
    appealNo: string,
    appealId: number,
    pdfFileName?: string,
  ): Promise<Buffer | null> {
    try {
      // Use the provided PDF filename or construct from appealId
      const filename = pdfFileName || `Appeal_${appealId}.pdf`;

      // Try different possible PDF endpoints
      const possibleUrls = [
        `${this.baseUrl}/api/documents/${filename}`,
        `${this.baseUrl}/appeals/${appealId}/document`,
        `${this.baseUrl}/api/files/${filename}`,
        `${this.baseUrl}/documents/${filename}`,
      ];

      for (const url of possibleUrls) {
        try {
          const response = await firstValueFrom(
            this.httpService.get(url, {
              headers: this.getHeaders(),
              responseType: 'arraybuffer',
              timeout: 30000, // 30 seconds
            }),
          );

          if (response.data && response.data.byteLength > 0) {
            this.logger.log(`Downloaded PDF for appeal ${appealNo} (${filename})`);
            return Buffer.from(response.data);
          }
        } catch (err) {
          // Try next URL
          continue;
        }
      }

      this.logger.warn(`No PDF found for appeal ${appealNo} (${filename})`);
      return null;
    } catch (error) {
      this.logger.error(`Failed to download PDF for appeal ${appealNo}`, error.message);
      return null;
    }
  }

  /**
   * Get total count of appeals
   */
  async getTotalCount(filters?: any): Promise<number> {
    try {
      const response = await this.getAppeals(0, 1, filters);
      return response.page?.totalElements || 0;
    } catch (error) {
      this.logger.error('Failed to get total count', error.message);
      return 0;
    }
  }

  /**
   * Test connection to TRAIS
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to fetch a single appeal to test connectivity
      await this.getAppeals(0, 1);
      return true;
    } catch {
      return false;
    }
  }
}
