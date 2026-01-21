import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Case } from '../../cases/entities/case.entity';
import { CaseContent } from '../../cases/entities/case-content.entity';

@Entity('case_embeddings')
@Index(['caseId', 'chunkIndex'], { unique: true })
@Index(['caseId'])
export class CaseEmbedding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'case_id', type: 'uuid' })
  caseId: string;

  @Column({ name: 'content_id', type: 'uuid', nullable: true })
  contentId: string;

  @Column({ name: 'chunk_index' })
  chunkIndex: number;

  @Column({ name: 'chunk_text', type: 'text' })
  chunkText: string;

  @Column({ name: 'chunk_start', nullable: true })
  chunkStart: number;

  @Column({ name: 'chunk_end', nullable: true })
  chunkEnd: number;

  // Vector column - stored as array for pgvector
  // Note: pgvector uses 'vector' type, but TypeORM doesn't have native support
  // We'll use 'float8' array and let PostgreSQL handle the vector conversion
  @Column('float8', { array: true })
  embedding: number[];

  @Column({ name: 'model_name', nullable: true })
  modelName: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Case, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'case_id' })
  case: Case;

  @ManyToOne(() => CaseContent, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'content_id' })
  content: CaseContent;
}
