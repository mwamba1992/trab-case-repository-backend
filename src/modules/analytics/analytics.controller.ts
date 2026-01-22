import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get comprehensive dashboard statistics' })
  @ApiResponse({
    status: 200,
    description: 'Returns dashboard overview and recent activity',
  })
  async getDashboardStats() {
    return this.analyticsService.getDashboardStats();
  }

  @Get('chairpersons')
  @ApiOperation({ summary: 'Get chairperson performance statistics' })
  @ApiResponse({
    status: 200,
    description: 'Returns statistics for each chairperson',
  })
  async getChairpersonStats() {
    return this.analyticsService.getChairpersonStats();
  }

  @Get('tax-types')
  @ApiOperation({ summary: 'Get statistics by tax type' })
  @ApiResponse({
    status: 200,
    description: 'Returns case statistics grouped by tax type',
  })
  async getTaxTypeStats() {
    return this.analyticsService.getTaxTypeStats();
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get case volume trends over time' })
  @ApiQuery({
    name: 'groupBy',
    required: false,
    enum: ['month', 'quarter', 'year'],
    description: 'Time period grouping',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of periods to return',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns time series data for case volume',
  })
  async getTimeSeriesData(
    @Query('groupBy') groupBy?: 'month' | 'quarter' | 'year',
    @Query('limit') limit?: number,
  ) {
    return this.analyticsService.getTimeSeriesData(
      groupBy || 'month',
      limit ? parseInt(String(limit)) : 12,
    );
  }

  @Get('outcomes')
  @ApiOperation({ summary: 'Get outcome distribution' })
  @ApiResponse({
    status: 200,
    description: 'Returns distribution of case outcomes',
  })
  async getOutcomeDistribution() {
    return this.analyticsService.getOutcomeDistribution();
  }

  @Get('top-appellants')
  @ApiOperation({ summary: 'Get top appellants by case count' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of appellants to return',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns top appellants with win rates',
  })
  async getTopAppellants(@Query('limit') limit?: number) {
    return this.analyticsService.getTopAppellants(
      limit ? parseInt(String(limit)) : 10,
    );
  }

  @Get('citations')
  @ApiOperation({ summary: 'Get citation statistics' })
  @ApiResponse({
    status: 200,
    description: 'Returns most cited statutes and cases',
  })
  async getCitationStats() {
    return this.analyticsService.getCitationStats();
  }
}
