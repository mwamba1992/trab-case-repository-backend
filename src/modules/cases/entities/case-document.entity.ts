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

export enum OcrStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  MANUAL_REVIEW = 'manual_review',
}

@Entity('case_documents')
@Index(['caseId'])
export class CaseDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'case_id', type: 'uuid' })
  caseId: string;

  @Column({ name: 'document_type', type: 'varchar' })
  documentType: string; // 'decision', 'ruling', 'order', 'submission'

  @Column({ name: 'file_name', type: 'varchar' })
  fileName: string;

  @Column({ name: 'file_path', type: 'varchar' })
  filePath: string;

  @Column({ name: 'file_size', type: 'bigint', nullable: true })
  fileSize: number;

  @Column({ name: 'mime_type', type: 'varchar', nullable: true })
  mimeType: string;

  @Column({ name: 'file_hash', type: 'varchar', nullable: true })
  fileHash: string;

  @Column({
    name: 'ocr_status',
    type: 'enum',
    enum: OcrStatus,
    default: OcrStatus.PENDING,
  })
  ocrStatus: OcrStatus;

  @Column({ name: 'ocr_error', type: 'text', nullable: true })
  ocrError: string | null;

  @Column({ name: 'page_count', type: 'integer', nullable: true })
  pageCount: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @Column({ name: 'processed_at', type: 'timestamp with time zone', nullable: true })
  processedAt: Date | null;

  // Relations
  @ManyToOne(() => Case, (caseEntity) => caseEntity.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'case_id' })
  case: Case;
}
