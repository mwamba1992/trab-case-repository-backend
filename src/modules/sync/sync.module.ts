import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { TraisClientService } from './services/trais-client.service';
import { TraisMapperService } from './services/trais-mapper.service';
import { MetadataExtractorService } from './services/metadata-extractor.service';
import { LocalFileProcessorService } from './services/local-file-processor.service';
import { Case } from '../cases/entities/case.entity';
import { CaseDocument } from '../cases/entities/case-document.entity';
import * as https from 'https';

@Module({
  imports: [
    TypeOrmModule.forFeature([Case, CaseDocument]),
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false, // Allow self-signed certificates
      }),
    }),
  ],
  controllers: [SyncController],
  providers: [
    SyncService,
    TraisClientService,
    TraisMapperService,
    MetadataExtractorService,
    LocalFileProcessorService,
  ],
  exports: [
    SyncService,
    TraisClientService,
    MetadataExtractorService,
    LocalFileProcessorService,
  ],
})
export class SyncModule {}
