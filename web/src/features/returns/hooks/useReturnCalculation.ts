import { useState, useEffect, useMemo } from "react";
import type { Order, ReturnCalculateResult, ReturnReceipt } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
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

  return {
    serverCalc,
    localCalc,
    returnSubtotal,
    refundedCardFee,
    returnTotal,
    exchangeRawSubtotal,
    exchangeDiscountTotal,
    exchangeTotal,
    netDifference,
    refundAmount,
    debtBefore,
    debtReduction,
    cashRefund,
    debtAfter,
  };
}
