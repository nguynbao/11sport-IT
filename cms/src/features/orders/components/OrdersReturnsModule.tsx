"use client";

import React, { useState } from "react";
import { Order, ReturnReceipt } from "@/shared/types";
import { getStoredUser } from "@/shared/api/client";
import { canProcessReturn } from "@/config/roles";
import { useOrdersReturns } from "../hooks/useOrdersReturns";
import { OrdersTableSection } from "./OrdersTableSection";
import { ReturnsTableSection } from "./ReturnsTableSection";
import OrderDetailModal from "./OrderDetailModal";
import ReturnDetailModal from "./ReturnDetailModal";
import ReturnRefundModal from "./ReturnRefundModal";
import ReturnReceiptPrintModal from "./ReturnReceiptPrintModal";

interface OrdersReturnsModuleProps {
  onOpenInvoice: (order: Order) => void;
}

export default function OrdersReturnsModule({
  onOpenInvoice,
}: OrdersReturnsModuleProps) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<ReturnReceipt | null>(null);
  const [returnOrder, setReturnOrder] = useState<Order | null>(null);
  const [printableReturn, setPrintableReturn] = useState<ReturnReceipt | null>(null);
  const currentUserRole = String(getStoredUser()?.role || "").toUpperCase();
  const canReturn = canProcessReturn(currentUserRole);
  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    paymentFilter,
    setPaymentFilter,
    debtFilter,
    setDebtFilter,
    returnTypeFilter,
    setReturnTypeFilter,
    actionMsg,
    loadData,
    displayedOrders,
    displayedReturns,
    ordPage,
    ordPageSize,
    ordTotal,
    ordTotalPages,
    setOrdPage,
    setOrdPageSize,
    retPage,
    retPageSize,
    retTotal,
    retTotalPages,
    setRetPage,
    setRetPageSize,
    handleConfirmDraft,
    handleDeleteDraft,
  } = useOrdersReturns({ onOpenInvoice });

  return (
    <div className="space-y-6">
      <OrdersTableSection
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        paymentFilter={paymentFilter}
        setPaymentFilter={setPaymentFilter}
        debtFilter={debtFilter}
        setDebtFilter={setDebtFilter}
        actionMsg={actionMsg}
        displayedOrders={displayedOrders}
        ordPage={ordPage}
        ordPageSize={ordPageSize}
        ordTotal={ordTotal}
        ordTotalPages={ordTotalPages}
        setOrdPage={setOrdPage}
        setOrdPageSize={setOrdPageSize}
        canReturn={canReturn}
        onSelectOrder={setSelectedOrder}
        onOpenInvoice={onOpenInvoice}
        onOpenReturn={setReturnOrder}
        onConfirmDraft={handleConfirmDraft}
        onDeleteDraft={handleDeleteDraft}
      />

      <ReturnsTableSection
        displayedReturns={displayedReturns}
        returnTypeFilter={returnTypeFilter}
        setReturnTypeFilter={setReturnTypeFilter}
        retPage={retPage}
        retPageSize={retPageSize}
        retTotal={retTotal}
        retTotalPages={retTotalPages}
        setRetPage={setRetPage}
        setRetPageSize={setRetPageSize}
        onSelectReturn={setSelectedReturn}
        onPrintReturn={setPrintableReturn}
      />

      <OrderDetailModal
        order={selectedOrder}
        relatedReturns={
          selectedOrder
            ? displayedReturns.filter(
                (r) =>
                  String(r.orderId) === String(selectedOrder._id) ||
                  r.orderCode === (selectedOrder.orderCode || selectedOrder.code)
              )
            : []
        }
        canReturn={canReturn}
        onClose={() => setSelectedOrder(null)}
        onOpenInvoice={onOpenInvoice}
        onOpenReturn={(ord) => setReturnOrder(ord)}
        onSelectReturn={(r) => {
          setSelectedOrder(null);
          setSelectedReturn(r);
        }}
      />

      <ReturnDetailModal
        returnReceipt={selectedReturn}
        onClose={() => setSelectedReturn(null)}
        onPrint={(r) => setPrintableReturn(r)}
      />

      <ReturnRefundModal
        order={returnOrder}
        onClose={() => setReturnOrder(null)}
        onSuccess={async (created) => {
          setReturnOrder(null);
          await loadData();
          if (created) setPrintableReturn(created);
        }}
      />

      <ReturnReceiptPrintModal
        returnReceipt={printableReturn}
        onClose={() => setPrintableReturn(null)}
      />
    </div>
  );
}
