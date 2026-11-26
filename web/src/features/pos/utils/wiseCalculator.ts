export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
}

export interface WiseRateResponse {
  data?: {
    sourceCurrency: string;
    targetCurrency: string;
    rate: number;
    inverseRate: number;
    rateDisplay: string;
    rateTimestamp: string;
  };
  message?: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: "VND", name: "Việt Nam Đồng", symbol: "₫", decimals: 0 },
  { code: "USD", name: "Đô la Mỹ", symbol: "$", decimals: 2 },
  { code: "PHP", name: "Peso Philippines", symbol: "₱", decimals: 2 },
  { code: "EUR", name: "Euro", symbol: "€", decimals: 2 },
  { code: "GBP", name: "Bảng Anh", symbol: "£", decimals: 2 },
  { code: "AUD", name: "Đô la Úc", symbol: "A$", decimals: 2 },
  { code: "SGD", name: "Đô la Singapore", symbol: "S$", decimals: 2 },
  { code: "CAD", name: "Đô la Canada", symbol: "C$", decimals: 2 },
  { code: "JPY", name: "Yên Nhật", symbol: "¥", decimals: 0 },
  { code: "KRW", name: "Won Hàn Quốc", symbol: "₩", decimals: 0 },
  { code: "THB", name: "Baht Thái", symbol: "฿", decimals: 2 },
  { code: "CHF", name: "Franc Thụy Sĩ", symbol: "CHF", decimals: 2 },
  { code: "CNY", name: "Nhân dân tệ", symbol: "¥", decimals: 2 },
  { code: "HKD", name: "Đô la Hồng Kông", symbol: "HK$", decimals: 2 },
  { code: "MYR", name: "Ringgit Malaysia", symbol: "RM", decimals: 2 },
  { code: "TWD", name: "Đài tệ", symbol: "NT$", decimals: 0 },
];

// Format số có dấu phẩy phân cách hàng nghìn (VD: 20000 -> 20,000)
export function formatNumber(amount: number, maxDecimals = 2): string {
  if (!Number.isFinite(amount)) return "0";
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

// Tự động format từng con số bên trong biểu thức máy tính (VD: "20000+5000*2" -> "20,000+5,000*2")
export function formatExpressionDisplay(rawExpr: string): string {
  if (!rawExpr) return "0";
  return rawExpr.replace(/\d+(\.\d*)?/g, (match) => {
    const parts = match.split(".");
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.length > 1 ? `${intPart}.${parts[1]}` : intPart;
  });
}

// Tính giá trị biểu thức (+, -, *, :)
export function evaluateExpression(rawExpr: string): number {
  const cleaned = rawExpr
    .replace(/,/g, "")
    .replace(/:/g, "/")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/[^0-9+\-*/.]/g, "")
    .trim();

  if (!cleaned) return 0;

  try {
    const safeExpr = cleaned.replace(/[+\-*/.]+$/, "");
    if (!safeExpr) return 0;
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${safeExpr})`)();
    if (typeof result === "number" && Number.isFinite(result) && result >= 0) {
      return result;
    }
    return 0;
  } catch {
    return 0;
  }
}
