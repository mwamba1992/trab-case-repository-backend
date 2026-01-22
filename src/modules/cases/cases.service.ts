import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case } from './entities/case.entity';
import { CaseDocument } from './entities/case-document.entity';

@Injectable()
export class CasesService {
  constructor(
    @InjectRepository(Case)
    private readonly caseRepository: Repository<Case>,
    @InjectRepository(CaseDocument)
    private readonly documentRepository: Repository<CaseDocument>,
  ) {}

  async findAll(limit = 50, offset = 0) {
    const [cases, total] = await this.caseRepository.findAndCount({
      order: { decisionDate: 'DESC', createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      cases,
      total,
      limit,
      offset,
    };
  }

  async findOne(id: string) {
    return this.caseRepository.findOne({
      where: { id },
      relations: ['documents', 'parties', 'contents'],
    });
  }

  async findByCaseNumber(caseNumber: string) {
    return this.caseRepository.findOne({
      where: { caseNumber },
      relations: ['documents', 'parties', 'contents'],
    });
  }

  async getStats() {
    const total = await this.caseRepository.count();
    
    const byType = await this.caseRepository
      .createQueryBuilder('case')
      .select('case.case_type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('case.case_type')
      .getRawMany();

    const byStatus = await this.caseRepository
      .createQueryBuilder('case')
      .select('case.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('case.status')
      .getRawMany();

    const byOutcome = await this.caseRepository
      .createQueryBuilder('case')
      .select('case.outcome', 'outcome')
      .addSelect('COUNT(*)', 'count')
      .where('case.outcome IS NOT NULL')
      .groupBy('case.outcome')
      .getRawMany();

    const totalTaxDisputed = await this.caseRepository
      .createQueryBuilder('case')
      .select('SUM(case.tax_amount_disputed)', 'total')
      .where('case.tax_amount_disputed IS NOT NULL')
      .getRawOne();

    return {
      total,
      byType: byType.map(item => ({ type: item.type, count: parseInt(item.count) })),
      byStatus: byStatus.map(item => ({ status: item.status, count: parseInt(item.count) })),
      byOutcome: byOutcome.map(item => ({ outcome: item.outcome, count: parseInt(item.count) })),
      totalTaxDisputed: totalTaxDisputed?.total ? parseFloat(totalTaxDisputed.total) : 0,
    };
  }

  async getRecentCases(limit = 10) {
    return this.caseRepository.find({
      order: { decisionDate: 'DESC', createdAt: 'DESC' },
      take: limit,
    });
  }

  async getDocument(documentId: string) {
    return this.documentRepository.findOne({
      where: { id: documentId },
    });
  }

  async getChairpersons() {
    const chairpersons = await this.caseRepository
      .createQueryBuilder('case')
      .select('DISTINCT case.chairperson', 'chairperson')
      .where('case.chairperson IS NOT NULL')
      .orderBy('case.chairperson', 'ASC')
      .getRawMany();

    return chairpersons
      .map(item => item.chairperson)
      .filter(chairperson => chairperson && chairperson.trim());
  }
}
