import { formatNumberDots, parseNumberDots } from "@/shared/utils/format";
import { Plus, X } from "lucide-react";
import { SPLIT_METHOD_OPTIONS } from "../types";
import type { PosCtx } from "../hooks/usePosTab";

type SplitPaymentPanelProps = Pick<
  PosCtx,
  "paymentMethod" | "splitPayments" | "setSplitPayments" | "setShowSplitDropdown"
  | "showSplitDropdown" | "totalAmount" | "setDebtDueDate" | "debtDueDate"
> & {
};

export function SplitPaymentPanel({
  paymentMethod,
  splitPayments,
  setSplitPayments,
  setShowSplitDropdown,
  showSplitDropdown,
  totalAmount,
  setDebtDueDate,
  debtDueDate,
}: SplitPaymentPanelProps) {
  return (
    <>
      {paymentMethod === "OTHER" &&
            (() => {
              const selectedMethods = splitPayments.map((s) => s.method);
              const remainingOptions = SPLIT_METHOD_OPTIONS.filter(
                (opt) => !selectedMethods.includes(opt.value)
              );
              const hasDebtOption = selectedMethods.includes("DEBT");

              const addDaysToInputDate = (days: number) => {
                const d = new Date();
                d.setDate(d.getDate() + days);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, "0");
                const dd = String(d.getDate()).padStart(2, "0");
                return `${yyyy}-${mm}-${dd}`;
              };

              return (
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {splitPayments.map((sp) => {
                        const label =
                          SPLIT_METHOD_OPTIONS.find(
                            (o) => o.value === sp.method
                          )?.label || sp.method;
                        const isDebt = sp.method === "DEBT";
                        return (
                          <div
                            key={sp.method}
                            className={`h-7 px-2.5 rounded-md text-white text-[11px] font-bold flex items-center gap-1.5 ${
                              isDebt ? "bg-amber-600" : "bg-blue-600"
                            }`}
                          >
                            <span>{label}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setSplitPayments((prev) =>
                                  prev.filter(
                                    (item) => item.method !== sp.method
                                  )
                                );
                              }}
                              className="w-3.5 h-3.5 rounded-full flex items-center justify-center bg-black/20 hover:bg-black/40"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        );
                      })}

                      {remainingOptions.length > 0 && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setShowSplitDropdown((prev) => !prev)
                            }
                            className="h-7 px-2.5 rounded-md border border-dashed border-blue-600 bg-white text-brand-ink font-extrabold text-xs flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          {showSplitDropdown && (
                            <div className="absolute left-0 top-8 z-20 w-48 rounded-xl bg-white border border-slate-200 shadow-lg py-1 overflow-hidden">
                              {remainingOptions.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => {
                                    setSplitPayments((prev) => {
                                      if (opt.value === "DEBT") {
                                        const nonDebtSum = prev
                                          .filter(
                                            (item) => item.method !== "DEBT"
                                          )
                                          .reduce(
                                            (sum, item) =>
                                              sum + (Number(item.amount) || 0),
                                            0
                                          );
                                        const remaining = Math.max(
                                          0,
                                          totalAmount - nonDebtSum
                                        );
                                        return [
                                          ...prev,
                                          {
                                            method: opt.value,
                                            amount: remaining,
                                          },
                                        ];
                                      }
                                      return [
                                        ...prev,
                                        { method: opt.value, amount: 0 },
                                      ];
                                    });
                                    setShowSplitDropdown(false);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-xs font-bold flex items-center justify-between hover:bg-blue-50 text-slate-700"
                                >
                                  <span>{opt.label}</span>
                                  <Plus className="w-3.5 h-3.5 text-brand-ink" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {!hasDebtOption && (
                      <button
                        type="button"
                        onClick={() => {
                          setSplitPayments((prev) => {
                            const nonDebtSum = prev
                              .filter((item) => item.method !== "DEBT")
                              .reduce(
                                (sum, item) => sum + (Number(item.amount) || 0),
                                0
                              );
                            const remaining = Math.max(
                              0,
                              totalAmount - nonDebtSum
                            );
                            return [
                              ...prev,
                              { method: "DEBT", amount: remaining },
                            ];
                          });
                        }}
                        className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[10px] font-extrabold"
                      >
                        + Công nợ
                      </button>
                    )}
                  </div>

                  {splitPayments.length > 0 && (
                    <div className="space-y-1.5 pt-1.5 border-t border-slate-200/80">
                      {splitPayments.map((sp) => {
                        const label =
                          SPLIT_METHOD_OPTIONS.find(
                            (o) => o.value === sp.method
                          )?.label || sp.method;
                        const isDebt = sp.method === "DEBT";
                        return (
                          <div
                            key={sp.method}
                            className="flex items-center justify-between gap-2"
                          >
                            <span
                              className={`text-[11px] font-bold w-24 shrink-0 ${
                                isDebt ? "text-amber-800" : "text-slate-700"
                              }`}
                            >
                              {label}:
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={
                                sp.amount > 0 ? formatNumberDots(sp.amount) : ""
                              }
                              onChange={(e) => {
                                const val = parseNumberDots(e.target.value);
                                setSplitPayments((prev) => {
                                  const next = prev.map((item) =>
                                    item.method === sp.method
                                      ? { ...item, amount: val }
                                      : item
                                  );
                                  if (
                                    sp.method !== "DEBT" &&
                                    next.some((i) => i.method === "DEBT")
                                  ) {
                                    const nonDebtSum = next
                                      .filter((i) => i.method !== "DEBT")
                                      .reduce(
                                        (sum, i) =>
                                          sum + (Number(i.amount) || 0),
                                        0
                                      );
                                    const autoDebt = Math.max(
                                      0,
                                      totalAmount - nonDebtSum
                                    );
                                    return next.map((i) =>
                                      i.method === "DEBT"
                                        ? { ...i, amount: autoDebt }
                                        : i
                                    );
                                  }
                                  return next;
                                });
                              }}
                              placeholder="0"
                              className="flex-1 px-2.5 py-1 rounded border border-slate-300 bg-white font-mono font-bold text-right text-xs"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {hasDebtOption && (
                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 space-y-1.5 text-[11px]">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="font-bold text-amber-900">
                          Hẹn trả nợ:
                        </span>
                        <div className="flex gap-1">
                          {[3, 7, 14, 30].map((days) => (
                            <button
                              key={days}
                              type="button"
                              onClick={() =>
                                setDebtDueDate(addDaysToInputDate(days))
                              }
                              className="px-1.5 py-0.5 rounded bg-white border border-amber-300 text-[10px] font-bold text-amber-900"
                            >
                              +{days}N
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        type="date"
                        value={debtDueDate}
                        onChange={(e) => setDebtDueDate(e.target.value)}
                        className="w-full px-2 py-1 rounded border border-amber-300 bg-white font-mono text-xs"
                      />
                    </div>
                  )}
                </div>
              );
            })()}
    </>
  );
}
