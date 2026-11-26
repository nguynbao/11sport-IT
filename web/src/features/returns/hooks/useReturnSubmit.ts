import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Order } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { formatVND } from "@/shared/utils/format";
import { type ExchangeItemForm, type ReturnItemForm, getExchangeItemPricing } from "../types";

interface Params {
  selectedOrder: Order | null;
  returnRows: ReturnItemForm[];
  exchangeRows: ExchangeItemForm[];
  mode: "EXCHANGE";
  setErrorMsg: Dispatch<SetStateAction<string>>;
  setSuccessMsg: Dispatch<SetStateAction<string>>;
  loadInitialLists: () => Promise<void>;
  prepareOrderForReturn: (ord: Order, preserveMessages?: boolean) => void;
}

export function useReturnSubmit({
  selectedOrder,
  returnRows,
  exchangeRows,
  mode,
  setErrorMsg,
  setSuccessMsg,
  loadInitialLists,
  prepareOrderForReturn,
}: Params) {
  const [refundMethod, setRefundMethod] = useState<"CASH" | "BANKING" | "CARD">("CASH");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitReturnExchange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setErrorMsg("");
    setSuccessMsg("");

    const activeReturns = returnRows.filter((r) => r.quantity > 0);
    if (activeReturns.length === 0) {
      setErrorMsg("Vui lòng chọn ít nhất 1 sản phẩm khách trả lại ở Mục 1 (số lượng > 0).");
      return;
    }

    if (mode === "EXCHANGE" && exchangeRows.length === 0) {
      setErrorMsg(
        "Bạn đang chọn chế độ ĐỔI HÀNG. Vui lòng tìm và bấm '+ Chọn đổi' ít nhất 1 sản phẩm mới ở Mục 2."
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        orderId: selectedOrder._id,
        type: mode,
        refundMethod,
        note:
          note.trim() ||
          (mode === "EXCHANGE" ? "Khách đổi hàng tại quầy" : "Khách trả hàng tại quầy"),
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
      };

      const res = await apiRequest<any>("/returns", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const createdReturn = res.data?.returnExchange || res.data;
      const updatedOrder: Order | undefined = res.data?.order;

      const createdDebtReduction = Number(createdReturn?.debtReduction || 0);
      const createdRefundAmount = Number(
        createdReturn?.refundAmount ?? Math.max(0, -Number(createdReturn?.netDifference || 0))
      );
      const createdCashRefund = Number(
        createdReturn?.cashRefund ?? Math.max(0, createdRefundAmount - createdDebtReduction)
      );
      const createdDebtAfter = Number(createdReturn?.debtAfter ?? updatedOrder?.debtAmount ?? 0);

      setSuccessMsg(
        createdDebtReduction > 0
          ? `Đã xử lý phiếu ${
              createdReturn?.returnCode || createdReturn?.code || "Trả/Đổi"
            } thành công! Tổng tiền hoàn trả: ${formatVND(
              createdRefundAmount
            )} · Cấn trừ vào công nợ đơn gốc: -${formatVND(
              createdDebtReduction
            )} (Nợ còn lại: ${formatVND(
              createdDebtAfter
            )}) · Tiền mặt/CK thực hoàn cho khách: ${formatVND(createdCashRefund)}.`
          : `Đã xử lý phiếu ${
              createdReturn?.returnCode || createdReturn?.code || "Trả/Đổi"
            } thành công! Tồn kho và trạng thái đơn gốc đã được cập nhật.`
      );
      setNote("");
      await loadInitialLists();

      if (updatedOrder && updatedOrder._id) {
        prepareOrderForReturn(updatedOrder, true);
      } else {
        try {
          const freshOrd = await apiRequest<Order>(
            `/orders/by-code/${encodeURIComponent(
              selectedOrder.orderCode || selectedOrder.code || selectedOrder._id
            )}`
          );
          if (freshOrd.data) {
            prepareOrderForReturn(freshOrd.data, true);
          }
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi khi xác nhận phiếu Trả/Đổi hàng.");
    } finally {
      setSubmitting(false);
    }
  };

  return { refundMethod, setRefundMethod, note, setNote, submitting, handleSubmitReturnExchange };
}
