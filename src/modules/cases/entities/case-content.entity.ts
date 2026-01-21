import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Case } from './case.entity';
import { CaseDocument } from './case-document.entity';

@Entity('case_content')
@Index(['caseId'])
@Index(['documentId', 'pageNumber'])
export class CaseContent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'case_id', type: 'uuid' })
  caseId: string;

  @Column({ name: 'document_id', type: 'uuid', nullable: true })
  documentId: string | null;

  @Column({ name: 'page_number', type: 'integer', nullable: true })
  pageNumber: number | null;

  @Column({ name: 'raw_text', type: 'text', nullable: true })
  rawText: string | null;

  @Column({ name: 'cleaned_text', type: 'text', nullable: true })
  cleanedText: string | null;

  @Column({ name: 'page_count', type: 'integer', nullable: true })
  pageCount: number | null;

  @Column({ name: 'word_count', type: 'integer', nullable: true })
  wordCount: number | null;

  @Column({ type: 'varchar', default: 'en' })
  language: string;

  @Column({ name: 'ocr_confidence', type: 'float', nullable: true })
  ocrConfidence: number | null;

  @Column({ name: 'ocr_engine', type: 'varchar', nullable: true })
  ocrEngine: string | null;

  @Column({ name: 'tsvector_content', type: 'tsvector', nullable: true, select: false })
  tsvectorContent: any;

  @Column({ name: 'embedding', type: 'vector', length: 384, nullable: true, select: false })
  embedding: number[] | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @Column({ name: 'processed_at', type: 'timestamp with time zone', nullable: true })
  processedAt: Date | null;

  // Relations
  @ManyToOne(() => Case, (caseEntity) => caseEntity.contents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'case_id' })
  case: Case;

  @ManyToOne(() => CaseDocument, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'document_id' })
  document: CaseDocument;
}
