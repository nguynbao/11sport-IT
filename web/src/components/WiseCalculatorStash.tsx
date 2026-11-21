"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Calculator,
  ArrowUpDown,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Delete,
} from "lucide-react";

interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
}

interface WiseRateResponse {
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

const CURRENCIES: CurrencyOption[] = [
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
function formatNumber(amount: number, maxDecimals = 2): string {
  if (!Number.isFinite(amount)) return "0";
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

// Tự động format từng con số bên trong biểu thức máy tính (VD: "20000+5000*2" -> "20,000+5,000*2")
function formatExpressionDisplay(rawExpr: string): string {
  if (!rawExpr) return "0";
  return rawExpr.replace(/\d+(\.\d*)?/g, (match) => {
    const parts = match.split(".");
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.length > 1 ? `${intPart}.${parts[1]}` : intPart;
  });
}

// Tính giá trị biểu thức (+, -, *, :)
function evaluateExpression(rawExpr: string): number {
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

export default function WiseCalculatorStash() {
  const [isOpen, setIsOpen] = useState(false);
  const [isStashedEdge, setIsStashedEdge] = useState(true);

  const [sourceCurrency, setSourceCurrency] = useState<string>("USD");
  const [targetCurrency, setTargetCurrency] = useState<string>("VND");
  const [rawExpression, setRawExpression] = useState<string>("100");

  // Tỷ giá lấy trực tiếp từ Wise API (không hardcode)
  const [rate, setRate] = useState<number | null>(null);
  const [rateDisplay, setRateDisplay] = useState<string>("Đang lấy tỷ giá Wise...");
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const fetchWiseRate = useCallback(async (src: string, tgt: string) => {
    if (src === tgt) {
      setRate(1);
      setRateDisplay(`1 ${src} = 1 ${tgt}`);
      setErrorMsg("");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const response = await fetch(
        `/api/wise-rate?source=${encodeURIComponent(src)}&target=${encodeURIComponent(tgt)}`,
        { cache: "no-store" }
      );
      const json: WiseRateResponse = await response.json();
      if (!response.ok || !json.data || !(json.data.rate > 0)) {
        throw new Error(json.message || "Không lấy được tỷ giá từ Wise API");
      }
      setRate(json.data.rate);
      setRateDisplay(json.data.rateDisplay);
    } catch (err: any) {
      setRate(null);
      setRateDisplay("Lỗi kết nối Wise API");
      setErrorMsg(err?.message || "Không thể kết nối tới Wise API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchWiseRate(sourceCurrency, targetCurrency);
  }, [isOpen, sourceCurrency, targetCurrency, fetchWiseRate]);

  const numericInput = evaluateExpression(rawExpression);
  const hasOperator = /[+\-*:/.]/.test(rawExpression.replace(/^\d+(\.\d+)?$/, ""));
  const convertedValue = rate !== null ? numericInput * rate : 0;

  const targetDecimals =
    targetCurrency === "VND"
      ? 0
      : convertedValue > 0 && convertedValue < 1
      ? 4
      : 2;

  const handleSwap = () => {
    const prevSrc = sourceCurrency;
    const prevTgt = targetCurrency;
    setSourceCurrency(prevTgt);
    setTargetCurrency(prevSrc);
  };

  const handleKeyPress = (key: string) => {
    if (key === "C") {
      setRawExpression("");
      return;
    }
    if (key === "BACK") {
      setRawExpression((prev) => prev.slice(0, -1));
      return;
    }
    if (key === "=") {
      const val = evaluateExpression(rawExpression);
      const decimals = sourceCurrency === "VND" ? 0 : 2;
      const factor = Math.pow(10, decimals);
      setRawExpression(String(Math.round(val * factor) / factor));
      return;
    }

    const operators = ["+", "-", "*", ":"];
    setRawExpression((prev) => {
      if (operators.includes(key)) {
        if (!prev) return "";
        if (operators.includes(prev.slice(-1))) {
          return prev.slice(0, -1) + key;
        }
        return prev + key;
      }
      if (prev === "0" && key !== ".") {
        return key;
      }
      return prev + key;
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
      .replace(/,/g, "")
      .replace(/\s+/g, "")
      .replace(/\//g, ":")
      .replace(/x|X|×/g, "*")
      .replace(/÷/g, ":")
      .replace(/[^0-9+\-*:/.]/g, "");
    setRawExpression(val);
  };

  return (
    <div className="fixed bottom-5 left-0 z-50 flex flex-col items-start print:hidden select-none">
      {/* Cửa sổ nhỏ Máy tính Đổi tiền đơn giản */}
      {isOpen && (
        <div className="mb-2.5 ml-2 sm:ml-4 w-[320px] sm:w-[340px] max-w-[calc(100vw-16px)] bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          {/* Header gọn */}
          <div className="bg-blue-600 text-white px-3.5 py-2.5 border-b border-blue-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white text-blue-600 flex items-center justify-center font-bold shadow-xs">
                <Calculator className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <div className="font-extrabold text-xs text-white leading-tight">
                  Máy tính Đổi tiền (Wise API)
                </div>
                <div className="text-[10px] text-blue-100 font-mono">
                  {loading ? "Đang cập nhật tỷ giá Wise..." : rateDisplay}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fetchWiseRate(sourceCurrency, targetCurrency)}
                disabled={loading}
                title="Cập nhật tỷ giá trực tiếp từ Wise"
                className="p-1.5 rounded-lg bg-blue-700/70 hover:bg-blue-700 text-white transition"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    loading ? "animate-spin text-white" : ""
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Đóng"
                className="p-1.5 rounded-lg bg-blue-700/70 hover:bg-red-500 text-white transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="p-3 space-y-2.5">
            {errorMsg && (
              <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                {errorMsg}
              </div>
            )}

            {/* Ô 1: Tiền nhập vào (tự động format dấu phẩy, số nằm trọn 1 hàng riêng không bị che) */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 focus-within:border-blue-500 transition space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Số tiền đổi
                </span>

                <select
                  value={sourceCurrency}
                  onChange={(e) => setSourceCurrency(e.target.value)}
                  aria-label="Tiền gốc"
                  className="bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none cursor-pointer"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <input
                type="text"
                inputMode="decimal"
                value={formatExpressionDisplay(rawExpression)}
                onChange={handleInputChange}
                placeholder="0"
                className="w-full bg-transparent text-2xl font-black text-slate-900 focus:outline-none font-mono tracking-tight"
              />

              {hasOperator && (
                <div className="text-xs font-mono text-blue-600 font-bold pt-0.5 border-t border-slate-200">
                  = {formatNumber(numericInput, sourceCurrency === "VND" ? 0 : 2)}{" "}
                  {sourceCurrency}
                </div>
              )}
            </div>

            {/* Nút đảo chiều tiền tệ */}
            <div className="flex items-center justify-center -my-1">
              <button
                type="button"
                onClick={handleSwap}
                className="px-3 py-1 rounded-full bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold flex items-center gap-1 transition shadow-xs"
              >
                <ArrowUpDown className="w-3 h-3" />
                <span>
                  Đảo chiều ({sourceCurrency} ⇄ {targetCurrency})
                </span>
              </button>
            </div>

            {/* Ô 2: Kết quả quy đổi (Tách dòng riêng toàn chiều ngang để không bao giờ bị cắt mất số) */}
            <div className="bg-blue-50/80 rounded-xl p-3 border border-blue-200 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-blue-700">
                  Thành tiền quy đổi
                </span>

                <select
                  value={targetCurrency}
                  onChange={(e) => setTargetCurrency(e.target.value)}
                  aria-label="Tiền quy đổi"
                  className="bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 focus:outline-none cursor-pointer"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full text-2xl sm:text-3xl font-black font-mono text-blue-600 break-all leading-tight">
                {rate !== null
                  ? `${formatNumber(convertedValue, targetDecimals)} ${targetCurrency}`
                  : "..."}
              </div>
            </div>

            {/* Bàn phím máy tính (+, -, *, :) */}
            <div className="grid grid-cols-4 gap-1.5 bg-slate-100 p-2 rounded-xl border border-slate-200">
              {[
                {
                  label: "C",
                  value: "C",
                  style:
                    "bg-red-50 text-red-600 hover:bg-red-100 border-red-200",
                },
                {
                  label: "⌫",
                  value: "BACK",
                  style:
                    "bg-white text-slate-700 hover:bg-slate-50 border-slate-200",
                },
                {
                  label: "000",
                  value: "000",
                  style:
                    "bg-white text-blue-600 hover:bg-blue-50 border-slate-200",
                },
                {
                  label: ":",
                  value: ":",
                  style:
                    "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200",
                },
                { label: "7", value: "7" },
                { label: "8", value: "8" },
                { label: "9", value: "9" },
                {
                  label: "*",
                  value: "*",
                  style:
                    "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200",
                },
                { label: "4", value: "4" },
                { label: "5", value: "5" },
                { label: "6", value: "6" },
                {
                  label: "-",
                  value: "-",
                  style:
                    "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200",
                },
                { label: "1", value: "1" },
                { label: "2", value: "2" },
                { label: "3", value: "3" },
                {
                  label: "+",
                  value: "+",
                  style:
                    "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200",
                },
                { label: "0", value: "0" },
                { label: "00", value: "00" },
                { label: ".", value: "." },
                {
                  label: "=",
                  value: "=",
                  style:
                    "bg-blue-600 text-white hover:bg-blue-700 border-blue-600",
                },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => handleKeyPress(btn.value)}
                  className={`h-10 rounded-lg font-mono font-extrabold text-sm border flex items-center justify-center transition active:scale-95 ${
                    btn.style ||
                    "bg-white hover:bg-blue-50 text-slate-900 border-slate-200"
                  }`}
                >
                  {btn.value === "BACK" ? (
                    <Delete className="w-4 h-4" />
                  ) : (
                    btn.label
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Nút Logo Tròn (Hình Máy Tính) dạng Stash mặc định ở góc trái dưới */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          title="Máy tính đổi tiền nhanh"
          aria-label="Mở máy tính đổi tiền nhanh"
          className={`group relative flex items-center gap-2 bg-gradient-to-br from-blue-500 via-blue-600 to-teal-700 hover:from-blue-400 hover:to-teal-600 text-white shadow-2xl border-2 border-white/90 transition-all duration-300 ${
            isOpen
              ? "ml-3 sm:ml-4 w-13 h-13 p-3.5 rounded-full justify-center ring-4 ring-blue-500/30"
              : isStashedEdge
              ? "w-13 h-13 py-3.5 pl-2.5 pr-3.5 rounded-r-full rounded-l-none justify-end -translate-x-1 hover:translate-x-0"
              : "ml-3 w-13 h-13 p-3.5 rounded-full justify-center hover:scale-105"
          }`}
        >
          <Calculator className="w-6 h-6 text-white stroke-[2.2] shrink-0" />
        </button>

        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsStashedEdge((v) => !v)}
            title={isStashedEdge ? "Kéo nút ra" : "Né gọn vào mép (Stash)"}
            className="h-8 w-5 rounded-r-lg bg-slate-900/90 hover:bg-blue-700 text-blue-400 border border-l-0 border-blue-500/40 flex items-center justify-center shadow-md transition"
          >
            {isStashedEdge ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
