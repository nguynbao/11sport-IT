import { useState, useMemo } from "react";
import type {
  ServiceType,
  ServicePaymentMethod,
  ServiceDiscountType,
} from "@/shared/types";
import { parseNumberDots } from "@/shared/utils/format";
import {
  type ServiceDiscountMode,
  type ServiceCartLine,
  type PaymentTimingMode,
  computeServiceLinePricing,
} from "../types";

export function useServiceCart({ onAddLine }: { onAddLine?: () => void }) {
  const [serviceCart, setServiceCart] = useState<ServiceCartLine[]>([]);
  const [billDiscountMode, setBillDiscountMode] = useState<ServiceDiscountMode>("NONE");
  const [billDiscountInput, setBillDiscountInput] = useState<string>("");
  const [paymentTiming, setPaymentTiming] = useState<PaymentTimingMode>("LATER");
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<ServicePaymentMethod>("CASH");
  const [cardFeePercent, setCardFeePercent] = useState<number>(1.8);

  const handleAddServiceType = (st: ServiceType) => {
    onAddLine?.();
    setServiceCart((prev) => [
      ...prev,
      {
        key: `${st._id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        serviceTypeId: st._id,
        serviceCode: st.code,
        serviceName: st.name,
        unit: st.unit || "Cây",
        defaultPrice: st.defaultPrice,
        unitPrice: st.defaultPrice,
        quantity: 1,
        discountMode: "NONE",
        discountInput: "",
        itemNote: "",
      },
    ]);
  };

  const handleUpdateLine = (
    key: string,
    patch: Partial<
      Pick<
        ServiceCartLine,
        "unitPrice" | "quantity" | "discountMode" | "discountInput" | "itemNote"
      >
    >
  ) => {
    setServiceCart((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  };

  const handleRemoveLine = (key: string) => {
    setServiceCart((prev) => prev.filter((l) => l.key !== key));
  };

  const {
    rawSubtotal,
    itemDiscountTotal,
    subtotal,
    billDiscountType,
    billDiscountValue,
    billDiscountAmount,
    afterBillDiscount,
    cardFee,
    totalAmount,
  } = useMemo(() => {
    let raw = 0;
    let itemDisc = 0;
    let sub = 0;
    for (const item of serviceCart) {
      const p = computeServiceLinePricing(item);
      raw += p.grossLine;
      itemDisc += p.discountAmount;
      sub += p.lineTotal;
    }

    let bType: ServiceDiscountType = "NONE";
    let bVal = 0;
    let bAmt = 0;
    if (billDiscountMode === "PERCENT") {
      const pct = Math.min(100, Math.max(0, Number(billDiscountInput) || 0));
      bAmt = Math.round((sub * pct) / 100);
      bType = pct > 0 ? "PERCENT" : "NONE";
      bVal = pct;
    } else if (billDiscountMode === "AMOUNT") {
      const amt = Math.min(sub, parseNumberDots(billDiscountInput));
      bAmt = amt;
      bType = amt > 0 ? "AMOUNT" : "NONE";
      bVal = amt;
    } else if (billDiscountMode === "PRICE") {
      const desired =
        billDiscountInput.trim() === ""
          ? sub
          : Math.min(sub, parseNumberDots(billDiscountInput));
      bAmt = Math.max(0, sub - desired);
      bType = bAmt > 0 ? "AMOUNT" : "NONE";
      bVal = bAmt;
    }

    const afterBill = Math.max(0, sub - bAmt);
    const pctCard = cardFeePercent === 4 ? 4 : 1.8;
    const fee =
      paymentMethod === "CARD"
        ? Math.round((afterBill * pctCard) / 100)
        : 0;
    const total = afterBill + fee;

    return {
      rawSubtotal: raw,
      itemDiscountTotal: itemDisc,
      subtotal: sub,
      billDiscountType: bType,
      billDiscountValue: bVal,
      billDiscountAmount: bAmt,
      afterBillDiscount: afterBill,
      cardFee: fee,
      totalAmount: total,
    };
  }, [
    serviceCart,
    billDiscountMode,
    billDiscountInput,
    paymentMethod,
    cardFeePercent,
  ]);

  const computedPaidAmount = useMemo(() => {
    if (paymentTiming === "FULL") return totalAmount;
    if (paymentTiming === "LATER") return 0;
    return Math.min(totalAmount, Math.max(0, depositAmount));
  }, [paymentTiming, totalAmount, depositAmount]);

  const computedRemainingAmount = Math.max(0, totalAmount - computedPaidAmount);

  const handleSelectPaymentMethod = (pm: ServicePaymentMethod) => {
    setPaymentMethod(pm);
  };

  const resetCart = () => {
    setServiceCart([]);
    setBillDiscountMode("NONE");
    setBillDiscountInput("");
    setPaymentTiming("LATER");
    setDepositAmount(0);
    setPaymentMethod("CASH");
    setCardFeePercent(1.8);
  };

  return {
    serviceCart,
    setServiceCart,
    billDiscountMode,
    setBillDiscountMode,
    billDiscountInput,
    setBillDiscountInput,
    paymentTiming,
    setPaymentTiming,
    depositAmount,
    setDepositAmount,
    paymentMethod,
    cardFeePercent,
    setCardFeePercent,
    handleAddServiceType,
    handleUpdateLine,
    handleRemoveLine,
    rawSubtotal,
    itemDiscountTotal,
    subtotal,
    billDiscountType,
    billDiscountValue,
    billDiscountAmount,
    afterBillDiscount,
    cardFee,
    totalAmount,
    computedPaidAmount,
    computedRemainingAmount,
    handleSelectPaymentMethod,
    resetCart,
  };
}
