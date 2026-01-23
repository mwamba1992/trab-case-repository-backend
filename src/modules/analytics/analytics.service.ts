import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case } from '../cases/entities/case.entity';

export interface ChairpersonStats {
  chairperson: string;
  totalCases: number;
  decided: number;
  dismissed: number;
  pending: number;
  allowedRate: number;
  dismissedRate: number;
  avgDaysToDecision: number;
}

export interface TaxTypeStats {
  taxType: string;
  totalCases: number;
  allowed: number;
  dismissed: number;
  partlyAllowed: number;
  pending: number;
  successRate: number;
  avgAmountDisputed: number;
  avgAmountAwarded: number;
}

export interface TimeSeriesData {
  period: string;
  totalCases: number;
  decided: number;
  dismissed: number;
  pending: number;
}

export interface OutcomeDistribution {
  outcome: string;
  count: number;
  percentage: number;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(Case)
    private caseRepository: Repository<Case>,
  ) {}

  /**
   * Get comprehensive dashboard statistics
   */
  async getDashboardStats(): Promise<{
    overview: {
      totalCases: number;
      decidedCases: number;
      pendingCases: number;
      totalTaxDisputed: number;
      totalTaxAwarded: number;
      averageDecisionDays: number;
    };
    recentActivity: {
      last30Days: number;
      last90Days: number;
      lastYear: number;
    };
  }> {
    const [
      totalCases,
      taxStats,
      avgDecisionDays,
      last30Days,
      last90Days,
      lastYear,
    ] = await Promise.all([
      this.caseRepository.count(),
      this.caseRepository
        .createQueryBuilder('case')
        .select('SUM(case.tax_amount_disputed)', 'totalDisputed')
        .addSelect('SUM(case.tax_amount_awarded)', 'totalAwarded')
        .where('case.tax_amount_disputed IS NOT NULL')
        .getRawOne(),
      this.getAverageDecisionDays(),
      this.getCasesInLastNDays(30),
      this.getCasesInLastNDays(90),
      this.getCasesInLastNDays(365),
    ]);

    return {
      overview: {
        totalCases,
        decidedCases: totalCases, // All cases in system are decided
        pendingCases: 0, // No pending cases
        totalTaxDisputed: parseFloat(taxStats?.totalDisputed || 0),
        totalTaxAwarded: parseFloat(taxStats?.totalAwarded || 0),
        averageDecisionDays: avgDecisionDays,
      },
      recentActivity: {
        last30Days,
        last90Days,
        lastYear,
      },
    };
  }

  /**
   * Get chairperson performance statistics
   */
  async getChairpersonStats(): Promise<ChairpersonStats[]> {
    const stats = await this.caseRepository
      .createQueryBuilder('case')
      .select('case.chairperson', 'chairperson')
      .addSelect('COUNT(*)', 'totalCases')
      .addSelect('COUNT(*)', 'decided')  // All cases are decided
      .addSelect(
        'SUM(CASE WHEN case.outcome ILIKE \'%dismissed%\' THEN 1 ELSE 0 END)',
        'dismissed',
      )
      .addSelect('0', 'pending')  // No pending cases
      .addSelect(
        'SUM(CASE WHEN case.outcome ILIKE \'%allowed%\' AND case.outcome NOT ILIKE \'%dismissed%\' THEN 1 ELSE 0 END)',
        'allowed',
      )
      .addSelect(
        'AVG(CASE WHEN case.decision_date IS NOT NULL AND case.filing_date IS NOT NULL THEN (case.decision_date - case.filing_date) END)',
        'avgDays',
      )
      .where('case.chairperson IS NOT NULL')
      .andWhere('case.chairperson != \'\'')
      .groupBy('case.chairperson')
      .orderBy('2', 'DESC')  // Order by totalCases (second column)
      .getRawMany();

    return stats.map((stat) => {
      const total = parseInt(stat.totalCases, 10);
      const allowed = parseInt(stat.allowed || 0, 10);
      const dismissed = parseInt(stat.dismissed || 0, 10);

      return {
        chairperson: stat.chairperson,
        totalCases: total,
        decided: parseInt(stat.decided || 0, 10),
        dismissed: dismissed,
        pending: parseInt(stat.pending || 0, 10),
        allowedRate: total > 0 ? (allowed / total) * 100 : 0,
        dismissedRate: total > 0 ? (dismissed / total) * 100 : 0,
        avgDaysToDecision: parseFloat(stat.avgDays || 0),
      };
    });
  }

  /**
   * Get tax type statistics
   */
  async getTaxTypeStats(): Promise<TaxTypeStats[]> {
    const stats = await this.caseRepository
      .createQueryBuilder('case')
      .select('case.case_type', 'taxType')
      .addSelect('COUNT(*)', 'totalCases')
      .addSelect(
        'SUM(CASE WHEN case.outcome ILIKE \'%allowed%\' AND case.outcome NOT ILIKE \'%dismissed%\' AND case.outcome NOT ILIKE \'%partial%\' THEN 1 ELSE 0 END)',
        'allowed',
      )
      .addSelect(
        'SUM(CASE WHEN case.outcome ILIKE \'%dismissed%\' THEN 1 ELSE 0 END)',
        'dismissed',
      )
      .addSelect(
        'SUM(CASE WHEN case.outcome ILIKE \'%partial%\' THEN 1 ELSE 0 END)',
        'partlyAllowed',
      )
      .addSelect('0', 'pending')  // No pending cases
      .addSelect('AVG(case.tax_amount_disputed)', 'avgDisputed')
      .addSelect('AVG(case.tax_amount_awarded)', 'avgAwarded')
      .where('case.case_type IS NOT NULL')
      .groupBy('case.case_type')
      .orderBy('2', 'DESC')  // Order by totalCases (second column)
      .getRawMany();

    return stats.map((stat) => {
      const total = parseInt(stat.totalCases, 10);
      const allowed = parseInt(stat.allowed || 0, 10);
      const partlyAllowed = parseInt(stat.partlyAllowed || 0, 10);

      return {
        taxType: stat.taxType,
        totalCases: total,
        allowed: allowed,
        dismissed: parseInt(stat.dismissed || 0, 10),
        partlyAllowed: partlyAllowed,
        pending: parseInt(stat.pending || 0, 10),
        successRate: total > 0 ? ((allowed + partlyAllowed) / total) * 100 : 0,
        avgAmountDisputed: parseFloat(stat.avgDisputed || 0),
        avgAmountAwarded: parseFloat(stat.avgAwarded || 0),
      };
    });
  }

  /**
   * Get case volume trends over time
   */
  async getTimeSeriesData(
    groupBy: 'month' | 'quarter' | 'year' = 'month',
    limit: number = 12,
  ): Promise<TimeSeriesData[]> {
    let dateFormat: string;
    let dateTrunc: string;

    switch (groupBy) {
      case 'year':
        dateFormat = 'YYYY';
        dateTrunc = 'year';
        break;
      case 'quarter':
        dateFormat = 'YYYY-Q';
        dateTrunc = 'quarter';
        break;
      default:
        dateFormat = 'YYYY-MM';
        dateTrunc = 'month';
    }

    const stats = await this.caseRepository
      .createQueryBuilder('case')
      .select(`TO_CHAR(DATE_TRUNC('${dateTrunc}', case.filing_date), '${dateFormat}')`, 'period')
      .addSelect('COUNT(*)', 'totalCases')
      .addSelect('COUNT(*)', 'decided')  // All cases are decided
      .addSelect(
        'SUM(CASE WHEN case.outcome ILIKE \'%dismissed%\' THEN 1 ELSE 0 END)',
        'dismissed',
      )
      .addSelect('0', 'pending')  // No pending cases
      .where('case.filing_date IS NOT NULL')
      .groupBy('period')
      .orderBy('period', 'DESC')
      .limit(limit)
      .getRawMany();

    return stats.reverse().map((stat) => ({
      period: stat.period,
      totalCases: parseInt(stat.totalCases, 10),
      decided: parseInt(stat.decided || 0, 10),
      dismissed: parseInt(stat.dismissed || 0, 10),
      pending: parseInt(stat.pending || 0, 10),
    }));
  }

  /**
   * Get outcome distribution
   */
  async getOutcomeDistribution(): Promise<OutcomeDistribution[]> {
    const stats = await this.caseRepository
      .createQueryBuilder('case')
      .select('case.outcome', 'outcome')
      .addSelect('COUNT(*)', 'count')
      .where('case.outcome IS NOT NULL')
      .groupBy('case.outcome')
      .orderBy('count', 'DESC')
      .getRawMany();

    const totalWithOutcome = stats.reduce(
      (sum, stat) => sum + parseInt(stat.count, 10),
      0,
    );

    return stats.map((stat) => ({
      outcome: stat.outcome,
      count: parseInt(stat.count, 10),
      percentage:
        totalWithOutcome > 0 ? (parseInt(stat.count, 10) / totalWithOutcome) * 100 : 0,
    }));
  }

  /**
   * Get top appellants by case count
   */
  async getTopAppellants(limit: number = 10): Promise<{
    appellant: string;
    caseCount: number;
    wonCases: number;
    lostCases: number;
    winRate: number;
  }[]> {
    const stats = await this.caseRepository
      .createQueryBuilder('case')
      .select('case.appellant', 'appellant')
      .addSelect('COUNT(*)', 'caseCount')
      .addSelect(
        'SUM(CASE WHEN case.outcome ILIKE \'%allowed%\' AND case.outcome NOT ILIKE \'%dismissed%\' THEN 1 ELSE 0 END)',
        'wonCases',
      )
      .addSelect(
        'SUM(CASE WHEN case.outcome ILIKE \'%dismissed%\' THEN 1 ELSE 0 END)',
        'lostCases',
      )
      .where('case.appellant IS NOT NULL')
      .andWhere('case.appellant != \'\'')
      .groupBy('case.appellant')
      .orderBy('2', 'DESC')  // Order by caseCount (second column)
      .limit(limit)
      .getRawMany();

    return stats.map((stat) => {
      const total = parseInt(stat.caseCount, 10);
      const won = parseInt(stat.wonCases || 0, 10);

      return {
        appellant: stat.appellant,
        caseCount: total,
        wonCases: won,
        lostCases: parseInt(stat.lostCases || 0, 10),
        winRate: total > 0 ? (won / total) * 100 : 0,
      };
    });
  }

  /**
   * Get citation statistics (most cited statutes and cases)
   */
  async getCitationStats(): Promise<{
    topStatutes: { statute: string; count: number }[];
    topCases: { caseRef: string; count: number }[];
  }> {
    // Get top statutes
    const statuteStats = await this.caseRepository
      .createQueryBuilder('case')
      .select('UNNEST(case.statutes_cited)', 'statute')
      .addSelect('COUNT(*)', 'count')
      .where('case.statutes_cited IS NOT NULL')
      .andWhere('array_length(case.statutes_cited, 1) > 0')
      .groupBy('1')  // Group by first column
      .orderBy('2', 'DESC')  // Order by second column
      .limit(10)
      .getRawMany();

    // Get top cited cases
    const caseStats = await this.caseRepository
      .createQueryBuilder('case')
      .select('UNNEST(case.cases_cited)', 'caseref')
      .addSelect('COUNT(*)', 'count')
      .where('case.cases_cited IS NOT NULL')
      .andWhere('array_length(case.cases_cited, 1) > 0')
      .groupBy('1')  // Group by first column
      .orderBy('2', 'DESC')  // Order by second column
      .limit(10)
      .getRawMany();

    return {
      topStatutes: statuteStats.map((s) => ({
        statute: s.statute,
        count: parseInt(s.count, 10),
      })),
      topCases: caseStats.map((c) => ({
        caseRef: c.caseref,  // PostgreSQL returns lowercase alias
        count: parseInt(c.count, 10),
      })),
    };
  }

  /**
   * Helper: Get average days to decision
   */
  private async getAverageDecisionDays(): Promise<number> {
    const result = await this.caseRepository
      .createQueryBuilder('case')
      .select(
        'AVG(CASE WHEN case.decision_date IS NOT NULL AND case.filing_date IS NOT NULL THEN (case.decision_date - case.filing_date) END)',
        'avgDays',
      )
      .getRawOne();

    return parseFloat(result?.avgDays || 0);
  }

  /**
   * Helper: Get cases filed in last N days
   */
  private async getCasesInLastNDays(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.caseRepository
      .createQueryBuilder('case')
      .where('case.filing_date >= :cutoffDate', { cutoffDate })
      .getCount();

    return result;
  }
}
