import { useState } from "react";
import type { ServiceOrder, ServicePaymentMethod } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";

export function useServiceCollect({
  fetchServiceOrders,
  setErrorMsg,
  setSuccessMsg,
}: {
  fetchServiceOrders: () => Promise<void>;
  setErrorMsg: (msg: string) => void;
  setSuccessMsg: (msg: string) => void;
}) {
  const [collectModalOrder, setCollectModalOrder] = useState<ServiceOrder | null>(null);
  const [collectAmountInput, setCollectAmountInput] = useState<number>(0);
  const [collectMethod, setCollectMethod] = useState<ServicePaymentMethod>("CASH");
  const [collectCardFeePercent, setCollectCardFeePercent] = useState<number>(1.8);
  const [collectNote, setCollectNote] = useState<string>("");
  const [submittingCollect, setSubmittingCollect] = useState<boolean>(false);

  const handleOpenCollectReadyOrder = (order: ServiceOrder) => {
    setCollectModalOrder(order);
    setCollectAmountInput(order.remainingAmount);
    setCollectMethod(order.paymentMethod || "CASH");
    setCollectCardFeePercent(order.cardFeePercent === 4 ? 4 : 1.8);
    setCollectNote("Thu tiền & trả đồ khi đơn đã làm xong");
  };

  const handleConfirmReturnPaidReadyOrder = async (order: ServiceOrder) => {
    setSubmittingCollect(true);
    setErrorMsg("");
    try {
      await apiRequest(`/service-orders/${order._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "RETURNED" }),
      });
      setSuccessMsg(`Đã xác nhận trả đồ cho đơn ${order.orderCode}!`);
      fetchServiceOrders();
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể xác nhận trả đồ");
    } finally {
      setSubmittingCollect(false);
    }
  };

  const handleConfirmCollectAndReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectModalOrder) return;
    setSubmittingCollect(true);
    setErrorMsg("");
    try {
      const useCardFee = collectMethod === "CARD";
      const pct = useCardFee ? (collectCardFeePercent === 4 ? 4 : 1.8) : 0;
      await apiRequest(`/service-orders/${collectModalOrder._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "RETURNED",
          collectAmount: collectAmountInput,
          paymentMethod: collectMethod,
          hasCardFee: useCardFee,
          cardFeePercent: pct,
          paymentNote:
            collectNote.trim() || "Sales xác nhận thu tiền & trả đồ khi đơn đã xong",
        }),
      });
      setSuccessMsg(
        `Đã xác nhận thu tiền & trả đồ cho đơn ${collectModalOrder.orderCode}!`
      );
      setCollectModalOrder(null);
      fetchServiceOrders();
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể xác nhận thu tiền");
    } finally {
      setSubmittingCollect(false);
    }
  };

  return {
    collectModalOrder,
    setCollectModalOrder,
    collectAmountInput,
    setCollectAmountInput,
    collectMethod,
    setCollectMethod,
    collectCardFeePercent,
    setCollectCardFeePercent,
    collectNote,
    setCollectNote,
    submittingCollect,
    handleOpenCollectReadyOrder,
    handleConfirmReturnPaidReadyOrder,
    handleConfirmCollectAndReturn,
  };
}
