import { useState, useEffect, useRef } from "react";
import type { ServiceOrder, ServiceOrdersMeta } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { cleanPhoneDigits } from "@/shared/utils/format";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { computeServiceLinePricing, getTodayStr } from "../types";
import {
  printServiceReceipt,
  type ServicePrintMode,
} from "../utils/printServiceReceipt";
import { useServiceTypes } from "./useServiceTypes";
import { useServiceOrders } from "./useServiceOrders";
import { useServiceCollect } from "./useServiceCollect";
import { useServiceCart } from "./useServiceCart";

export function usePosService({
  onMetaChange,
}: {
  onMetaChange?: (meta: ServiceOrdersMeta) => void;
}) {
  const { serviceTypes, loadingTypes, fetchServiceTypes } = useServiceTypes();
  const orders = useServiceOrders({ onMetaChange });
  const { fetchServiceOrders } = orders;

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const cart = useServiceCart({ onAddLine: () => setErrorMsg("") });
  const {
    serviceCart,
    paymentMethod,
    cardFeePercent,
    billDiscountType,
    billDiscountValue,
    computedPaidAmount,
  } = cart;
  const collect = useServiceCollect({ fetchServiceOrders, setErrorMsg, setSuccessMsg });

  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const [lookingUpCustomer, setLookingUpCustomer] = useState(false);

  const [receivedDate, setReceivedDate] = useState<string>(getTodayStr());
  const [dueDate, setDueDate] = useState<string>("");
  const [dueDaysInput, setDueDaysInput] = useState<string>("");
  const [leftView, setLeftView] = useState<"COMPOSE" | "ORDERS">("COMPOSE");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // Modal in phiếu dịch vụ (In 2 bản: Bản giao khách + Bản lưu shop, khổ K80)
  const [printOrder, setPrintOrder] = useState<ServiceOrder | null>(null);
  const servicePrintRef = useRef<HTMLDivElement>(null);

  const handlePrintServiceReceipt = (mode: ServicePrintMode = "SPLIT_2_BILLS") =>
    printServiceReceipt(servicePrintRef.current, printOrder, mode);

  // Tự động tra cứu khách hàng khi nhập SĐT
  const debouncedPhone = useDebounce(customerPhone, 300);
  useEffect(() => {
    const digits = cleanPhoneDigits(debouncedPhone);
    if (digits.length < 9) {
      setIsExistingCustomer(false);
      return;
    }
    let cancelled = false;
    setLookingUpCustomer(true);
    apiRequest<{
      found: boolean;
      customer: { _id: string; name: string; phone: string } | null;
    }>(`/customers/lookup?phone=${encodeURIComponent(digits)}`)
      .then((res) => {
        if (cancelled) return;
        if (res.data?.found && res.data.customer) {
          setIsExistingCustomer(true);
          setCustomerName((prev) => prev.trim() || res.data.customer!.name || "");
        } else {
          setIsExistingCustomer(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsExistingCustomer(false);
      })
      .finally(() => {
        if (!cancelled) setLookingUpCustomer(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedPhone]);

  const handleCreateServiceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const cleanPhone = cleanPhoneDigits(customerPhone);
    if (!cleanPhone) {
      setErrorMsg("Vui lòng nhập Số điện thoại khách hàng (bắt buộc).");
      return;
    }
    if (!customerName.trim()) {
      setErrorMsg("Vui lòng nhập Tên khách hàng (bắt buộc).");
      return;
    }
    if (!receivedDate) {
      setErrorMsg("Vui lòng chọn Ngày gửi.");
      return;
    }
    if (!dueDate) {
      setErrorMsg("Vui lòng chọn Ngày hẹn trả khách.");
      return;
    }
    if (serviceCart.length === 0) {
      setErrorMsg("Vui lòng chọn ít nhất 1 dịch vụ.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customerName: customerName.trim(),
        customerPhone: cleanPhone,
        receivedAt: receivedDate,
        dueAt: dueDate,
        items: serviceCart.map((l) => {
          const p = computeServiceLinePricing(l);
          return {
            serviceTypeId: l.serviceTypeId,
            serviceCode: l.serviceCode,
            serviceName: l.serviceName,
            unit: l.unit,
            defaultPrice: l.defaultPrice,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            discountType: p.discountType,
            discountValue: p.discountValue,
            discountAmount: p.discountAmount,
            itemNote: l.itemNote.trim(),
          };
        }),
        billDiscountType,
        billDiscountValue,
        hasCardFee: paymentMethod === "CARD",
        cardFeePercent: paymentMethod === "CARD" ? (cardFeePercent === 4 ? 4 : 1.8) : 0,
        paidAmount: computedPaidAmount,
        paymentMethod,
        note: note.trim(),
      };

      const res = await apiRequest<ServiceOrder>("/service-orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const created = res.data;
      setSuccessMsg(
        `Đã tạo phiếu dịch vụ ${created.orderCode} cho khách ${created.customerName}!`
      );
      cart.resetCart();
      setCustomerPhone("");
      setCustomerName("");
      setIsExistingCustomer(false);
      setReceivedDate(getTodayStr());
      setDueDate("");
      setDueDaysInput("");
      setNote("");
      fetchServiceOrders();
      setPrintOrder(created);
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể tạo phiếu dịch vụ");
    } finally {
      setSubmitting(false);
    }
  };

  return {
    serviceTypes,
    loadingTypes,
    ...cart,
    customerPhone,
    setCustomerPhone,
    customerName,
    setCustomerName,
    isExistingCustomer,
    setIsExistingCustomer,
    lookingUpCustomer,
    receivedDate,
    setReceivedDate,
    dueDate,
    setDueDate,
    dueDaysInput,
    setDueDaysInput,
    leftView,
    setLeftView,
    note,
    setNote,
    submitting,
    errorMsg,
    setErrorMsg,
    successMsg,
    setSuccessMsg,
    ...orders,
    ...collect,
    printOrder,
    setPrintOrder,
    servicePrintRef,
    handlePrintServiceReceipt,
    fetchServiceTypes,
    handleCreateServiceOrder,
  };
}

export type PosServiceState = ReturnType<typeof usePosService>;
