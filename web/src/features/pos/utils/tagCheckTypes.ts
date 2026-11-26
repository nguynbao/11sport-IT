export type Phase = "live" | "processing" | "result" | "choose";
export type ResultKind = "added" | "full" | "alreadyFull" | "notfound" | "unreadable" | "error" | "undone";

export interface ScanResult {
  kind: ResultKind;
  title: string;
  detail?: string;
  badge?: string;
  rowIndex?: number;
}

export interface Candidate {
  index: number;
  productCode: string;
  productName: string;
  scannedQuantity?: number;
  expectedQuantity?: number;
}
