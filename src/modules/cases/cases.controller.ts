import { Controller, Get, Param, Query, Res, NotFoundException, StreamableFile, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasesService } from './cases.service';

@ApiTags('Cases')
@Controller('cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all cases with pagination' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated list of cases',
  })
  async findAll(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.casesService.findAll(
      limit ? parseInt(String(limit)) : 50,
      offset ? parseInt(String(offset)) : 0,
    );
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get case statistics for dashboard' })
  @ApiResponse({
    status: 200,
    description: 'Returns statistics about cases',
  })
  async getStats() {
    return this.casesService.getStats();
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent cases' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Returns recent cases',
  })
  async getRecentCases(@Query('limit') limit?: number) {
    return this.casesService.getRecentCases(
      limit ? parseInt(String(limit)) : 10,
    );
  }

  @Get('chairpersons')
  @ApiOperation({ summary: 'Get list of unique chairpersons' })
  @ApiResponse({
    status: 200,
    description: 'Returns unique list of chairpersons',
  })
  async getChairpersons() {
    return this.casesService.getChairpersons();
  }

  @Get('number/:caseNumber')
  @ApiOperation({ summary: 'Get case by case number' })
  @ApiResponse({
    status: 200,
    description: 'Returns case details',
  })
  @ApiResponse({
    status: 404,
    description: 'Case not found',
  })
  async findByCaseNumber(@Param('caseNumber') caseNumber: string) {
    return this.casesService.findByCaseNumber(caseNumber);
  }

  @Get('documents/:documentId/stream')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Stream case document PDF file (requires authentication)' })
  @ApiQuery({ name: 'download', required: false, type: Boolean, description: 'Set to true to download instead of inline preview' })
  @ApiResponse({
    status: 200,
    description: 'Returns the PDF file stream for inline preview',
    content: {
      'application/pdf': {},
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 404,
    description: 'Document not found',
  })
  async streamDocument(
    @Param('documentId') documentId: string,
    @Query('download') download: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(documentId)) {
      throw new BadRequestException('Invalid document ID format');
    }

    const document = await this.casesService.getDocument(documentId);

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (!existsSync(document.filePath)) {
      throw new NotFoundException('File not found on server');
    }

    const file = createReadStream(document.filePath);
    const isDownload = download === 'true' || download === '1';

    // Security headers
    res.set({
      'Content-Type': document.mimeType || 'application/pdf',
      'Content-Disposition': isDownload
        ? `attachment; filename="${document.fileName}"`
        : `inline; filename="${document.fileName}"`,
      'Content-Security-Policy': "default-src 'none'; script-src 'none'; object-src 'self'",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Cache-Control': 'private, max-age=3600', // Cache for 1 hour, private
      'Content-Length': document.fileSize?.toString() || undefined,
    });

    return new StreamableFile(file);
  }

  @Get(':id/documents')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all documents for a case' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of documents for the case',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 404,
    description: 'Case not found',
  })
  async getCaseDocuments(@Param('id') id: string) {
    const caseData = await this.casesService.findOne(id);

    if (!caseData) {
      throw new NotFoundException('Case not found');
    }

    return {
      caseId: caseData.id,
      caseNumber: caseData.caseNumber,
      documents: caseData.documents || [],
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get case by ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns case details',
  })
  @ApiResponse({
    status: 404,
    description: 'Case not found',
  })
  async findOne(@Param('id') id: string) {
    return this.casesService.findOne(id);
  }
}
