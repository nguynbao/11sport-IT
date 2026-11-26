import { useState, useEffect, useMemo } from "react";
import type { Order, ReturnCalculateResult, ReturnReceipt } from "@/shared/types";
import { apiRequest, getStoredUser } from "@/shared/api/client";
import { canOverrideExchangeDowngrade } from "@/config/roles";
import { type ExchangeItemForm, type ReturnItemForm, getExchangeItemPricing } from "../types";
import { calcReturnLocal } from "../utils/calcReturn";

interface Params {
  selectedOrder: Order | null;
  returnRows: ReturnItemForm[];
  exchangeRows: ExchangeItemForm[];
  recentReturns: ReturnReceipt[];
  mode: "EXCHANGE";
}

export function useReturnCalculation({
  selectedOrder,
  returnRows,
  exchangeRows,
  recentReturns,
  mode,
}: Params) {
  const [serverCalc, setServerCalc] = useState<ReturnCalculateResult | null>(null);

  useEffect(() => {
    const activeReturns = returnRows.filter((r) => r.quantity > 0);
    if (!selectedOrder || activeReturns.length === 0) {
      setServerCalc(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await apiRequest<ReturnCalculateResult>("/returns/calculate", {
          method: "POST",
          body: JSON.stringify({
            orderId: selectedOrder._id,
            type: mode,
            returnItems: activeReturns.map((r) => ({
              lineIndex: r.lineIndex,
              productId: r.productId,
              color: r.color,
              size: r.size,
              quantity: r.quantity,
              condition: r.condition,
            })),
            exchangeItems:
              mode === "EXCHANGE"
                ? exchangeRows.map((ex) => {
                    const pricing = getExchangeItemPricing(ex);
                    return {
                      productId: ex.product._id,
                      color: ex.color,
                      size: ex.size,
                      quantity: ex.quantity,
                      originalUnitPrice: pricing.originalUnitPrice,
                      discountType: ex.discountValue > 0 ? ex.discountType : "NONE",
                      discountValue: ex.discountValue > 0 ? ex.discountValue : 0,
                      unitPrice: pricing.unitPrice,
                    };
                  })
                : [],
          }),
        });
        if (!cancelled && res.data) {
          setServerCalc(res.data);
        }
      } catch {
        if (!cancelled) setServerCalc(null);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedOrder, mode, returnRows, exchangeRows]);

  const localCalc = useMemo(
    () => calcReturnLocal(selectedOrder, returnRows, exchangeRows, recentReturns, mode),
    [selectedOrder, returnRows, exchangeRows, mode, recentReturns]
  );

  const returnSubtotal = serverCalc?.returnSubtotal ?? localCalc.returnSubtotal;
  const refundedCardFee = serverCalc?.refundedCardFee ?? localCalc.refundedCardFee;
  const returnTotal = serverCalc?.returnTotal ?? localCalc.returnTotal;
  const exchangeRawSubtotal = localCalc.exchangeRawSubtotal ?? 0;
  const exchangeDiscountTotal = localCalc.exchangeDiscountTotal ?? 0;
  const exchangeTotal = serverCalc?.exchangeTotal ?? localCalc.exchangeTotal;
  const netDifference = serverCalc?.netDifference ?? localCalc.netDifference;
  const refundAmount = serverCalc?.refundAmount ?? localCalc.refundAmount;
  const debtBefore = serverCalc?.debtBefore ?? localCalc.debtBefore;
  const debtReduction = serverCalc?.debtReduction ?? localCalc.debtReduction;
  const cashRefund = serverCalc?.cashRefund ?? localCalc.cashRefund;
  const debtAfter = serverCalc?.debtAfter ?? localCalc.debtAfter;

  const localReturnListedTotal = useMemo(
    () =>
      returnRows.reduce(
        (s, r) =>
          s +
          (r.quantity > 0 && !r.isGift
            ? Math.max(0, Math.round(r.originalUnitPrice || r.unitPrice || 0)) * r.quantity
            : 0),
        0
      ),
    [returnRows]
  );
  const localExchangeListedTotal = useMemo(
    () =>
      exchangeRows.reduce(
        (s, ex) => s + getExchangeItemPricing(ex).originalUnitPrice * ex.quantity,
        0
      ),
    [exchangeRows]
  );

  const returnListedTotal = serverCalc?.returnListedTotal ?? localReturnListedTotal;
  const exchangeListedTotal = serverCalc?.exchangeListedTotal ?? localExchangeListedTotal;
  const listedShortfall =
    serverCalc?.listedShortfall ?? Math.max(0, returnListedTotal - exchangeListedTotal);
  const isDowngrade =
    serverCalc?.isDowngrade ??
    (mode === "EXCHANGE" && exchangeRows.length > 0 && exchangeListedTotal < returnListedTotal);
  const userRole = String(getStoredUser()?.role || "").toUpperCase();
  const canOverrideDowngrade =
    serverCalc?.canOverrideDowngrade ?? canOverrideExchangeDowngrade(userRole);
  const isDowngradeBlocked = isDowngrade && !canOverrideDowngrade;

  return {
    serverCalc,
    localCalc,
    returnSubtotal,
    refundedCardFee,
    returnTotal,
    exchangeRawSubtotal,
    exchangeDiscountTotal,
    exchangeTotal,
    returnListedTotal,
    exchangeListedTotal,
    listedShortfall,
    isDowngrade,
    canOverrideDowngrade,
    isDowngradeBlocked,
    netDifference,
    refundAmount,
    debtBefore,
    debtReduction,
    cashRefund,
    debtAfter,
  };
}
