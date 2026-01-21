import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';
import { SimpleQueueService } from './simple-queue.service';
import { CaseDocument } from '../cases/entities/case-document.entity';
import { CaseContent } from '../cases/entities/case-content.entity';
import { EmbeddingsModule } from '../embeddings/embeddings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CaseDocument, CaseContent]),
    EmbeddingsModule,
  ],
  controllers: [OcrController],
  providers: [OcrService, SimpleQueueService],
  exports: [OcrService, SimpleQueueService],
})
export class OcrModule {}
