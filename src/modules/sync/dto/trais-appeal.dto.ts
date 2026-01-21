// DTOs based on actual TRAIS API response structure

export class TraisStatusTrendDto {
  id: string;
  createdAt: string;
  updatedAt: string;
  appealStatusTrendDesc: string;
  appealStatusTrendName: string;
  active: boolean;
}

export class TraisAppealAmountDto {
  amountOnDispute: number;
  allowedAmount: number | null;
  currencyName: string;
  amountDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

export class TraisTaxDto {
  id: string;
  taxName: string;
  taxDesc: string;
  active: boolean;
}

export class TraisBillDto {
  billId: string;
  billControlNumber: string;
  billPayed: boolean;
  billedAmount: number;
  paidAmount: number;
  billDescription: string;
  expiryDate: string;
  generatedDate: string;
  payerName: string;
  payerEmail: string;
  payerPhone: string;
  currency: string;
  financialYear: string;
}

export class TraisSummonsDto {
  summonId: number;
  summonNo: string;
  createdDate: string;
  appeleant: string;
  respondent: string;
  judge: string;
  venue: string;
  summonStartDate: string;
  summonEndDate: string;
  time: string;
  memberOne: string;
  memberTwo: string;
  taxType: string;
  summonType: string;
  received: boolean;
}

export class TraisAppealEmbeddedDto {
  statusTrend: TraisStatusTrendDto;
  appealAmount: TraisAppealAmountDto[];
  tax: TraisTaxDto;
  billId?: TraisBillDto;
  summons?: TraisSummonsDto;
}

export class TraisAppealDto {
  appealId: number;
  appealNo: string;
  dateOfFilling: string; // Note: TRAIS has typo "Filling" instead of "Filing"
  natureOfAppeal: string;
  remarks: string;
  taxedOff: string | null;
  assNo: string;
  billNo: string | null;
  bankNo: string | null;
  wonBy: string; // "Appealant" | "Respondent" | "Both"
  status: string | null;
  noticeNumber: string;
  currencyOfAmountOnDispute: string | null;
  createdDate: string | null;
  approvedDate: string | null;
  outcomeOfDecision: string | null;
  decidedDate: string;
  decidedBy: string; // Judge name
  appellantName: string;
  dateOfTheLastOrder: string | null;
  concludingDate: string | null;
  procedingStatus: string; // "APPEAL ALLOWED" | "APPEAL DISMISSED" etc.
  summaryOfDecree: string;
  copyOfJudgement: string;
  decreeReceivedBy: string | null;
  isFilledTrat: boolean | null;
  action: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  tinNumber: string;
  email: string | null;
  phone: string | null;
  natOfBus: string | null;
  initiatedForDelete: boolean;
  deletedInitiatedBy: string | null;
  loaded: boolean;
  _embedded: TraisAppealEmbeddedDto;
}

export class TraisAppealListResponseDto {
  _embedded?: {
    appeals?: TraisAppealDto[];
  };
  _links?: any;
  page?: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
}
