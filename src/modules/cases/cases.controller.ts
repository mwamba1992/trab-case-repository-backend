import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
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
}
