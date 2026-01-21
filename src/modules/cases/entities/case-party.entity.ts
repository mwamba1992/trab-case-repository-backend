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

@Entity('case_parties')
@Index(['caseId'])
export class CaseParty {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'case_id', type: 'uuid' })
  caseId: string;

  @Column({ name: 'party_name', type: 'varchar' })
  partyName: string;

  @Column({ name: 'party_type', type: 'varchar' })
  partyType: string; // 'appellant', 'respondent', 'intervenor'

  @Column({ name: 'tin_number', type: 'varchar', nullable: true })
  tinNumber: string;

  @Column({ type: 'varchar', nullable: true })
  representative: string;

  @Column({ name: 'representative_firm', type: 'varchar', nullable: true })
  representativeFirm: string;

  @Column({ name: 'contact_info', type: 'jsonb', nullable: true })
  contactInfo: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Case, (caseEntity) => caseEntity.parties, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'case_id' })
  case: Case;
}
