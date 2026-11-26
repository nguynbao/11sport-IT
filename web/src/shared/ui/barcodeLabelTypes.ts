export interface BarcodeLabelItem {
  id?: string | number;
  code?: string;
  productCode?: string;
  name?: string;
  productName?: string;
  price?: number;
  sellingPrice?: number;
  color?: string;
  size?: string;
  unit?: string;
  category?: string;
  defaultQty?: number;
}

export interface NormalizedLabelItem {
  id: string;
  code: string;
  baseCode: string;
  name: string;
  attrLabel: string;
  price: number;
  defaultQty: number;
}

export type SystemPrinterInfo = {
  Name: string;
  DriverName: string;
  PortName: string;
  PrinterStatus: string;
  Default: boolean;
  WorkOffline: boolean;
  IsOnline: boolean;
  IsThermal: boolean;
};

// Cấu hình cố định chuẩn máy in tem 2 cột 70 × 20 mm (2 tem 34×20mm + khe giữa 2mm)
export const FIXED_LABEL_CONFIG = {
  id: "70x20_2up",
  name: "Tem đôi 2 cột 70 × 20 mm (2 tem 35×20mm / hàng)",
  columns: 2 as const,
  pageWidthMm: 70,
  pageHeightMm: 20,
  labelWidthMm: 34,
  labelHeightMm: 20,
  colGapMm: 2
};

export const PRINTER_STORAGE_KEY = "11sport_preferred_thermal_printer";

export const getEffectiveNameFontPx = (text: string, customPx: number): number => {
  if (customPx && customPx > 0) {
    return Math.max(10, Math.min(28, customPx));
  }
  const len = (text || "").trim().length;
  if (len <= 14) return 24;
  if (len <= 18) return 21;
  if (len <= 22) return 18;
  if (len <= 28) return 16;
  return 14;
};
