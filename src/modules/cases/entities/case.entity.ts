import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { CaseContent } from './case-content.entity';
import { CaseDocument } from './case-document.entity';
import { CaseParty } from './case-party.entity';

export enum CaseType {
  INCOME_TAX = 'income_tax',
  VAT = 'vat',
  CUSTOMS = 'customs',
  EXCISE = 'excise',
  STAMP_DUTY = 'stamp_duty',
  OTHER = 'other',
}

export enum CaseStatus {
  PENDING = 'pending',
  DECIDED = 'decided',
  APPEALED = 'appealed',
  WITHDRAWN = 'withdrawn',
  SETTLED = 'settled',
}

export enum CaseOutcome {
  ALLOWED = 'allowed',
  DISMISSED = 'dismissed',
  PARTIALLY_ALLOWED = 'partially_allowed',
  REMANDED = 'remanded',
  OTHER = 'other',
}

@Entity('cases')
@Index(['caseNumber'])
@Index(['decisionDate'])
@Index(['caseType'])
export class Case {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'case_number', unique: true })
  caseNumber: string;

  @Column({ name: 'trais_id', unique: true, nullable: true })
  traisId: string;

  @Column('text')
  title: string;

  @Column({ name: 'filing_date', type: 'date', nullable: true })
  filingDate: Date | null;

  @Column({ name: 'hearing_date', type: 'date', nullable: true })
  hearingDate: Date | null;

  @Column({ name: 'decision_date', type: 'date', nullable: true })
  decisionDate: Date | null;

  @Column({
    name: 'case_type',
    type: 'enum',
    enum: CaseType,
    nullable: true,
  })
  caseType: CaseType;

  @Column({
    type: 'enum',
    enum: CaseStatus,
    default: CaseStatus.PENDING,
  })
  status: CaseStatus;

  @Column({
    type: 'enum',
    enum: CaseOutcome,
    nullable: true,
  })
  outcome: CaseOutcome | null;

  @Column({ type: 'varchar', nullable: true })
  appellant: string;

  @Column({ name: 'appellant_tin', type: 'varchar', nullable: true })
  appellantTin: string;

  @Column({ type: 'varchar', default: 'Commissioner General, TRA' })
  respondent: string;

  @Column('text', { array: true, nullable: true })
  judges: string[];

  @Column({ type: 'varchar', nullable: true })
  chairperson: string | null;

  @Column('text', { name: 'board_members', array: true, nullable: true })
  boardMembers: string[] | null;

  @Column('text', { nullable: true })
  summary: string;

  @Column('text', { name: 'key_issues', array: true, nullable: true })
  keyIssues: string[];

  @Column('text', { name: 'legal_principles', array: true, nullable: true })
  legalPrinciples: string[];

  @Column('text', { name: 'statutes_cited', array: true, nullable: true })
  statutesCited: string[];

  @Column('text', { name: 'cases_cited', array: true, nullable: true })
  casesCited: string[];

  @Column({ name: 'tax_amount_disputed', type: 'decimal', precision: 18, scale: 2, nullable: true })
  taxAmountDisputed: number | null;

  @Column({ name: 'tax_amount_awarded', type: 'decimal', precision: 18, scale: 2, nullable: true })
  taxAmountAwarded: number | null;

  @Column({ type: 'varchar', default: 'TZS' })
  currency: string;

  @Column('text', { array: true, nullable: true })
  tags: string[];

  @Column({ type: 'varchar', nullable: true })
  citation: string;

  @Column({ name: 'pdf_url', type: 'varchar', nullable: true })
  pdfUrl: string | null;

  @Column({ name: 'pdf_hash', type: 'varchar', nullable: true })
  pdfHash: string | null;

  @Column({ name: 'source_url', type: 'varchar', nullable: true })
  sourceUrl: string | null;

  @Column({ name: 'search_vector', type: 'tsvector', nullable: true, select: false })
  searchVector: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;

  @Column({ name: 'synced_at', type: 'timestamp with time zone', nullable: true })
  syncedAt: Date | null;

  @Column({ name: 'published_at', type: 'timestamp with time zone', nullable: true })
  publishedAt: Date | null;

  // Relations
  @OneToMany(() => CaseContent, (content) => content.case, { cascade: true })
  contents: CaseContent[];

  @OneToMany(() => CaseDocument, (document) => document.case, { cascade: true })
  documents: CaseDocument[];

  @OneToMany(() => CaseParty, (party) => party.case, { cascade: true })
  parties: CaseParty[];
}
