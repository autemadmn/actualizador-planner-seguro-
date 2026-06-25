import type ExcelJS from 'exceljs';

export type TrackingSourceKind = 'master' | 'direct';
export type TrackingDeliveryType = 'I' | 'M' | 'M-T' | 'O' | 'Sin tipo';
export type TrackingOwnerSource = 'assigned' | 'lead' | 'none';
export type TrackingDateState = 'completed' | 'overdue' | 'planned' | 'tbd' | 'unknown';

export interface ParsedTrackingWorkbook {
  fileName: string;
  workbook: ExcelJS.Workbook;
}

export interface TrackingColumnInfo {
  key: TrackingColumnKey;
  index: number;
  header: string;
}

export type TrackingColumnKey =
  | 'division'
  | 'product'
  | 'hardwareVersion'
  | 'projectLead'
  | 'manualUser'
  | 'documentDetail'
  | 'inputType'
  | 'manualType'
  | 'translatedManualType'
  | 'outputType'
  | 'plannedPublicationDate'
  | 'plannedPublicationWeek'
  | 'realPublicationDate'
  | 'realPublicationWeek'
  | 'status'
  | 'areaPerson'
  | 'expectedReceptionDate'
  | 'expectedReceptionWeek'
  | 'realReceptionDate'
  | 'realReceptionWeek'
  | 'deadlineToMeetManualDate'
  | 'manualDeliveryDeadline'
  | 'estimatedTime'
  | 'dedicatedTime'
  | 'comments'
  | 'notes';

export interface TrackingDateValue {
  raw: string;
  display: string;
  canonical: string | null;
  isPending: boolean;
  isWeekReference: boolean;
}

export interface TrackingRow {
  id: string;
  rowNumber: number;
  division: string;
  product: string;
  hardwareVersion: string;
  projectLead: string;
  manualUser: string;
  documentDetail: string;
  deliveryType: TrackingDeliveryType;
  deliveryTypeDetail: string;
  status: string;
  areaPerson: string;
  owner: string;
  ownerSource: TrackingOwnerSource;
  plannedPublicationDate: TrackingDateValue;
  plannedPublicationWeek: string;
  realPublicationDate: TrackingDateValue;
  realPublicationWeek: string;
  expectedReceptionDate: TrackingDateValue;
  expectedReceptionWeek: string;
  realReceptionDate: TrackingDateValue;
  realReceptionWeek: string;
  deadlineToMeetManualDate: TrackingDateValue;
  manualDeliveryDeadline: TrackingDateValue;
  estimatedTime: string;
  dedicatedTime: string;
  comments: string;
  notes: string;
  naturalKey: string;
  dateState: TrackingDateState;
  searchText: string;
}

export interface ParsedTrackingSheet {
  fileName: string;
  sheetName: string;
  sourceKind: TrackingSourceKind;
  headerRowNumber: number;
  columns: TrackingColumnInfo[];
  rows: TrackingRow[];
}
