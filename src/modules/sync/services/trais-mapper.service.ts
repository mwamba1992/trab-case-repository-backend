import { Injectable, Logger } from '@nestjs/common';
import { Case, CaseType, CaseStatus, CaseOutcome } from '../../cases/entities/case.entity';
import { TraisAppealDto } from '../dto/trais-appeal.dto';

@Injectable()
export class TraisMapperService {
  private readonly logger = new Logger(TraisMapperService.name);

  /**
   * Map TRAIS appeal data to our Case entity
   */
  mapAppealToCase(appeal: TraisAppealDto): Partial<Case> {
    // Extract summons hearing date if available
    const hearingDate = appeal._embedded?.summons?.summonStartDate
      ? this.parseDate(appeal._embedded.summons.summonStartDate)
      : null;

    return {
      // Case identification
      caseNumber: appeal.appealNo,
      traisId: appeal.appealId.toString(),
      title: this.generateTitle(appeal),

      // Dates
      filingDate: this.parseDate(appeal.dateOfFilling),
      decisionDate: this.parseDate(appeal.decidedDate),
      hearingDate,

      // Classification
      caseType: this.mapTaxType(appeal._embedded?.tax?.taxName || appeal.natureOfAppeal),
      status: this.mapStatus(appeal.procedingStatus, appeal.status),
      outcome: this.mapOutcome(appeal.wonBy, appeal.procedingStatus),

      // Parties
      appellant: appeal.appellantName,
      appellantTin: appeal.tinNumber,
      respondent: appeal._embedded?.summons?.respondent || 'Commissioner General, TRA',

      // Decision details
      judges: this.parseJudges(appeal.decidedBy, appeal._embedded?.summons),
      summary: this.cleanSummary(appeal.summaryOfDecree),

      // Tax amounts
      taxAmountDisputed: this.getDisputedAmount(appeal),
      taxAmountAwarded: this.getAllowedAmount(appeal),
      currency: this.getCurrency(appeal),

      // Metadata
      tags: this.generateTags(appeal),
      citation: this.generateCitation(appeal),

      // Source tracking
      sourceUrl: null, // Will be set by sync service
      syncedAt: new Date(),
      publishedAt: this.parseDate(appeal.decidedDate),
    };
  }

  /**
   * Generate case title from appeal data
   */
  private generateTitle(appeal: TraisAppealDto): string {
    return `${appeal.appellantName} vs Commissioner General, TRA`;
  }

  /**
   * Map TRAIS tax type to our CaseType enum
   */
  private mapTaxType(taxName: string): CaseType {
    if (!taxName) return CaseType.OTHER;

    const normalized = taxName.toUpperCase();

    const mapping: Record<string, CaseType> = {
      'VAT': CaseType.VAT,
      'VALUE ADDED TAX': CaseType.VAT,
      'INCOME TAX': CaseType.INCOME_TAX,
      'PAYE': CaseType.INCOME_TAX,
      'CIT': CaseType.INCOME_TAX,
      'CUSTOMS': CaseType.CUSTOMS,
      'CUSTOM': CaseType.CUSTOMS,
      'EXCISE': CaseType.EXCISE,
      'STAMP DUTY': CaseType.STAMP_DUTY,
      'STAMP': CaseType.STAMP_DUTY,
    };

    for (const [key, value] of Object.entries(mapping)) {
      if (normalized.includes(key)) {
        return value;
      }
    }

    return CaseType.OTHER;
  }

  /**
   * Map proceeding status to CaseStatus
   */
  private mapStatus(procedingStatus: string, traisStatus?: string | null): CaseStatus {
    // Check TRAIS status field first if available
    if (traisStatus && traisStatus.toUpperCase() === 'UNPROCESSED') {
      return CaseStatus.PENDING;
    }

    if (!procedingStatus) return CaseStatus.PENDING;

    const normalized = procedingStatus.toUpperCase();

    if (normalized.includes('ALLOWED') || normalized.includes('DISMISSED')) {
      return CaseStatus.DECIDED;
    }
    if (normalized.includes('WITHDRAWN')) {
      return CaseStatus.WITHDRAWN;
    }
    if (normalized.includes('SETTLED')) {
      return CaseStatus.SETTLED;
    }

    return CaseStatus.PENDING;
  }

  /**
   * Map wonBy and procedingStatus to CaseOutcome
   */
  private mapOutcome(wonBy: string, procedingStatus: string): CaseOutcome | null {
    if (!wonBy && !procedingStatus) return null;

    const normalizedWonBy = wonBy?.toUpperCase() || '';
    const normalizedStatus = procedingStatus?.toUpperCase() || '';

    // Check wonBy field
    if (normalizedWonBy.includes('APPELLANT') || normalizedWonBy.includes('APPEALANT')) {
      if (normalizedStatus.includes('PARTIALLY')) {
        return CaseOutcome.PARTIALLY_ALLOWED;
      }
      return CaseOutcome.ALLOWED;
    }

    if (normalizedWonBy.includes('RESPONDENT') || normalizedWonBy.includes('TRA')) {
      return CaseOutcome.DISMISSED;
    }

    // Check proceeding status
    if (normalizedStatus.includes('ALLOWED')) {
      if (normalizedStatus.includes('PARTIALLY')) {
        return CaseOutcome.PARTIALLY_ALLOWED;
      }
      return CaseOutcome.ALLOWED;
    }

    if (normalizedStatus.includes('DISMISSED')) {
      return CaseOutcome.DISMISSED;
    }

    if (normalizedStatus.includes('REMANDED')) {
      return CaseOutcome.REMANDED;
    }

    return CaseOutcome.OTHER;
  }

  /**
   * Parse judge names from decidedBy field and summons data
   */
  private parseJudges(decidedBy: string, summons?: any): string[] {
    const judges = new Set<string>();

    // Add primary judge from decidedBy
    if (decidedBy) {
      decidedBy
        .split(/,|\sand\s|&/)
        .map(j => j.trim())
        .filter(j => j.length > 0)
        .forEach(j => judges.add(j));
    }

    // Add judges from summons if available
    if (summons) {
      if (summons.judge) judges.add(summons.judge);
      if (summons.memberOne) judges.add(summons.memberOne);
      if (summons.memberTwo) judges.add(summons.memberTwo);
    }

    return Array.from(judges).filter(j => j && j.trim().length > 0);
  }

  /**
   * Clean and format summary text
   */
  private cleanSummary(summary: string): string {
    if (!summary) return '';

    return summary
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\.{2,}/g, '.'); // Remove multiple periods
  }

  /**
   * Get disputed amount from embedded data
   */
  private getDisputedAmount(appeal: TraisAppealDto): number | null {
    const amounts = appeal._embedded?.appealAmount;
    if (!amounts || amounts.length === 0) return null;

    // Sum all disputed amounts if multiple
    const total = amounts.reduce((sum, amt) => sum + (amt.amountOnDispute || 0), 0);
    return total > 0 ? total : null;
  }

  /**
   * Get allowed amount from embedded data
   */
  private getAllowedAmount(appeal: TraisAppealDto): number | null {
    const amounts = appeal._embedded?.appealAmount;
    if (!amounts || amounts.length === 0) return null;

    // Sum all allowed amounts if multiple
    const total = amounts.reduce((sum, amt) => sum + (amt.allowedAmount || 0), 0);
    return total > 0 ? total : null;
  }

  /**
   * Get currency from appeal amounts
   */
  private getCurrency(appeal: TraisAppealDto): string {
    const amounts = appeal._embedded?.appealAmount;
    if (!amounts || amounts.length === 0) return 'TZS';

    return amounts[0].currencyName || 'TZS';
  }

  /**
   * Generate tags for the case
   */
  private generateTags(appeal: TraisAppealDto): string[] {
    const tags: string[] = [];

    // Add tax type
    if (appeal._embedded?.tax?.taxName) {
      tags.push(appeal._embedded.tax.taxName);
    }

    // Add outcome
    if (appeal.wonBy) {
      tags.push(appeal.wonBy.toLowerCase());
    }

    // Add status
    if (appeal.procedingStatus) {
      tags.push(appeal.procedingStatus.toLowerCase());
    }

    // Add year
    const year = this.parseDate(appeal.decidedDate)?.getFullYear();
    if (year) {
      tags.push(year.toString());
    }

    return tags.filter((tag, index, self) => self.indexOf(tag) === index); // Remove duplicates
  }

  /**
   * Generate case citation
   */
  private generateCitation(appeal: TraisAppealDto): string {
    const year = this.parseDate(appeal.decidedDate)?.getFullYear();
    if (!year) return appeal.appealNo;

    return `${appeal.appealNo} [${year}] TRAB`;
  }

  /**
   * Parse date string to Date object
   */
  private parseDate(dateString: string): Date | null {
    if (!dateString) return null;

    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  /**
   * Extract key issues from summary (basic implementation)
   */
  extractKeyIssues(summary: string): string[] {
    if (!summary) return [];

    // Look for common patterns that indicate issues
    const issues: string[] = [];
    const sentences = summary.split(/\.\s+/);

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length > 20 && trimmed.length < 200) {
        // Check if it looks like an issue statement
        if (
          trimmed.toLowerCase().includes('whether') ||
          trimmed.toLowerCase().includes('issue') ||
          trimmed.toLowerCase().includes('question')
        ) {
          issues.push(trimmed);
        }
      }
    }

    return issues.slice(0, 5); // Limit to 5 key issues
  }
}
