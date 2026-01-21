import { Controller, Get, Query, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SearchService, SearchResponse } from './search.service';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('full-text')
  @ApiOperation({ summary: 'Full-text search using PostgreSQL tsvector' })
  @ApiQuery({ name: 'q', description: 'Search query', required: true })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of results',
    required: false,
    type: Number,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Search results from full-text search',
  })
  async fullTextSearch(
    @Query('q') query: string,
    @Query('limit') limit?: number,
  ): Promise<SearchResponse> {
    return this.searchService.fullTextSearch(query, limit || 10);
  }

  @Get('semantic')
  @ApiOperation({ summary: 'Semantic search using vector embeddings' })
  @ApiQuery({ name: 'q', description: 'Search query', required: true })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of results',
    required: false,
    type: Number,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Search results from semantic vector search',
  })
  async semanticSearch(
    @Query('q') query: string,
    @Query('limit') limit?: number,
  ): Promise<SearchResponse> {
    return this.searchService.semanticSearch(query, limit || 10);
  }

  @Get('hybrid')
  @ApiOperation({
    summary: 'Hybrid search combining full-text and semantic search',
  })
  @ApiQuery({ name: 'q', description: 'Search query', required: true })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of results',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'ftWeight',
    description: 'Full-text search weight (0-1)',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'semWeight',
    description: 'Semantic search weight (0-1)',
    required: false,
    type: Number,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Search results from hybrid search',
  })
  async hybridSearch(
    @Query('q') query: string,
    @Query('limit') limit?: number,
    @Query('ftWeight') ftWeight?: number,
    @Query('semWeight') semWeight?: number,
  ): Promise<SearchResponse> {
    return this.searchService.hybridSearch(
      query,
      limit || 10,
      ftWeight || 0.5,
      semWeight || 0.5,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Default search (uses hybrid search)' })
  @ApiQuery({ name: 'q', description: 'Search query', required: true })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of results',
    required: false,
    type: Number,
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Search results' })
  async search(
    @Query('q') query: string,
    @Query('limit') limit?: number,
  ): Promise<SearchResponse> {
    return this.searchService.hybridSearch(query, limit || 10);
  }
}
