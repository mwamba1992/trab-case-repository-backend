import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { CaseContent } from '../cases/entities/case-content.entity';
import { CaseDocument } from '../cases/entities/case-document.entity';
import { EmbeddingsModule } from '../embeddings/embeddings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CaseContent, CaseDocument]),
    EmbeddingsModule,
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
