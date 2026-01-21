import { Injectable } from '@nestjs/common';
import { TraisAppealDto } from '../dto/trais-appeal.dto';

/**
 * Dashboard Metadata Interface
 * Contains important information for dashboard analytics
 */
export interface DashboardMetadata {
  // Case identification
  appealId: number;
  appealNo: string;
  tinNumber: string;

  // Contact info
  email: string | null;
  phone: string | null;

  // Status tracking
  status: string | null; // TRAIS internal status
  procedingStatus: string;
  outcomeOfDecision: string | null;

  // Financial
  billedAmount: number | null;
  paidAmount: number | null;
  billPayed: boolean | null;
  billControlNumber: string | null;

  // Hearing/Summons info
  hearingVenue: string | null;
  hearingDate: string | null;
  hearingTime: string | null;
  summonsReceived: boolean | null;

  // Metadata
  createdBy: string;
  updatedBy: string;
  taxedOffice: string | null;
  natureOfAppeal: string;
}

@Injectable()
export class MetadataExtractorService {
  /**
   * Extract dashboard-relevant metadata from TRAIS appeal
   */
  extractDashboardMetadata(appeal: TraisAppealDto): DashboardMetadata {
    const bill = appeal._embedded?.billId;
    const summons = appeal._embedded?.summons;

    return {
      // Case identification
      appealId: appeal.appealId,
      appealNo: appeal.appealNo,
      tinNumber: appeal.tinNumber,

      // Contact info
      email: appeal.email || bill?.payerEmail || null,
      phone: appeal.phone || bill?.payerPhone || null,

      // Status tracking
      status: appeal.status,
      procedingStatus: appeal.procedingStatus,
      outcomeOfDecision: appeal.outcomeOfDecision,

      // Financial
      billedAmount: bill?.billedAmount || null,
      paidAmount: bill?.paidAmount || null,
      billPayed: bill?.billPayed || null,
      billControlNumber: bill?.billControlNumber || null,

      // Hearing/Summons info
      hearingVenue: summons?.venue || null,
      hearingDate: summons?.summonStartDate || null,
      hearingTime: summons?.time || null,
      summonsReceived: summons?.received || null,

      // Metadata
      createdBy: appeal.createdBy,
      updatedBy: appeal.updatedBy,
      taxedOffice: appeal.taxedOff,
      natureOfAppeal: appeal.natureOfAppeal,
    };
  }

  /**
   * Calculate case statistics for dashboard
   */
  calculateStatistics(appeals: TraisAppealDto[]): {
    total: number;
    byStatus: Record<string, number>;
    byOutcome: Record<string, number>;
    byTaxType: Record<string, number>;
    totalDisputed: number;
    totalAllowed: number;
    pendingPayments: number;
    upcomingHearings: number;
  } {
    const stats = {
      total: appeals.length,
      byStatus: {} as Record<string, number>,
      byOutcome: {} as Record<string, number>,
      byTaxType: {} as Record<string, number>,
      totalDisputed: 0,
      totalAllowed: 0,
      pendingPayments: 0,
      upcomingHearings: 0,
    };

    for (const appeal of appeals) {
      // Count by status
      const status = appeal.procedingStatus || 'Unknown';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

      // Count by outcome
      const outcome = appeal.wonBy || 'Pending';
      stats.byOutcome[outcome] = (stats.byOutcome[outcome] || 0) + 1;

      // Count by tax type
      const taxType = appeal._embedded?.tax?.taxName || 'Other';
      stats.byTaxType[taxType] = (stats.byTaxType[taxType] || 0) + 1;

      // Sum amounts
      const amounts = appeal._embedded?.appealAmount || [];
      stats.totalDisputed += amounts.reduce((sum, amt) => sum + (amt.amountOnDispute || 0), 0);
      stats.totalAllowed += amounts.reduce((sum, amt) => sum + (amt.allowedAmount || 0), 0);

      // Count pending payments
      if (appeal._embedded?.billId && !appeal._embedded.billId.billPayed) {
        stats.pendingPayments++;
      }

      // Count upcoming hearings
      if (appeal._embedded?.summons) {
        const hearingDate = new Date(appeal._embedded.summons.summonStartDate);
        if (hearingDate > new Date() && !appeal._embedded.summons.received) {
          stats.upcomingHearings++;
        }
      }
    }

    return stats;
  }

  /**
   * Extract contact information for notifications
   */
  extractContactInfo(appeal: TraisAppealDto): {
    appellant: string;
    email: string | null;
    phone: string | null;
    tinNumber: string;
  } {
    const bill = appeal._embedded?.billId;

    return {
      appellant: appeal.appellantName,
      email: appeal.email || bill?.payerEmail || null,
      phone: appeal.phone || bill?.payerPhone || null,
      tinNumber: appeal.tinNumber,
    };
  }
}
