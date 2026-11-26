import { Calculator, ArrowUpDown, RefreshCw, X } from "lucide-react";
import {
  CURRENCIES,
  formatNumber,
  formatExpressionDisplay,
} from "../../utils/wiseCalculator";
import WiseKeypad from "./WiseKeypad";
import type { useWiseCalculator } from "../../hooks/useWiseCalculator";

type WiseCalc = ReturnType<typeof useWiseCalculator>;

export default function WiseCalculatorPanel({ calc }: { calc: WiseCalc }) {
  const {
    setIsOpen,
    sourceCurrency,
    setSourceCurrency,
    targetCurrency,
    setTargetCurrency,
    rawExpression,
    rate,
    rateDisplay,
    loading,
    errorMsg,
    fetchWiseRate,
    numericInput,
    hasOperator,
    convertedValue,
    targetDecimals,
    handleSwap,
    handleKeyPress,
    handleInputChange,
  } = calc;

  return (
    <div className="mb-2.5 ml-2 sm:ml-4 w-[320px] sm:w-[340px] max-w-[calc(100vw-16px)] bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
      {/* Header gọn */}
      <div className="bg-blue-600 text-white px-3.5 py-2.5 border-b border-blue-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white text-brand-ink flex items-center justify-center font-bold shadow-xs">
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
            <div className="text-xs font-mono text-brand-ink font-bold pt-0.5 border-t border-slate-200">
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
            className="px-3 py-1 rounded-full bg-white hover:bg-blue-50 text-brand-ink border border-blue-200 text-[11px] font-bold flex items-center gap-1 transition shadow-xs"
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
            <span className="text-[11px] font-bold uppercase tracking-wide text-brand-ink">
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

          <div className="w-full text-2xl sm:text-3xl font-black font-mono text-brand-ink break-all leading-tight">
            {rate !== null
              ? `${formatNumber(convertedValue, targetDecimals)} ${targetCurrency}`
              : "..."}
          </div>
        </div>

        {/* Bàn phím máy tính (+, -, *, :) */}
        <WiseKeypad onKeyPress={handleKeyPress} />
      </div>
    </div>
  );
}
