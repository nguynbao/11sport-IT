"use client";

import React from "react";
import type { Order } from "@/shared/types";
import { useCustomerTab } from "../hooks/useCustomerTab";
import { CustomerSearchCard } from "./CustomerSearchCard";
import { CustomerProfileSummary } from "./CustomerProfileSummary";
import { CustomerOrdersTable } from "./CustomerOrdersTable";
import { CustomerReturnsList } from "./CustomerReturnsList";

interface CustomerTabProps {
  onOpenInvoice: (order: Order) => void;
}

export default function CustomerTab({ onOpenInvoice }: CustomerTabProps) {
  const {
    phone,
    customerInfo,
    orders,
    returns,
    filteredCustomers,
    loading,
    errorMsg,
    handleLookup,
    handlePhoneInputChange,
    handleSelectSuggestion,
    ordersPagination,
  } = useCustomerTab();

  return (
    <div className="space-y-4 md:space-y-6">
      <CustomerSearchCard
        phone={phone}
        loading={loading}
        filteredCustomers={filteredCustomers}
        onPhoneChange={handlePhoneInputChange}
        onSubmit={() => handleLookup()}
        onSelectSuggestion={handleSelectSuggestion}
      />

      {errorMsg && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm font-semibold">
          {errorMsg}
        </div>
      )}

      {customerInfo && (
        <div className="space-y-4 md:space-y-6">
          <CustomerProfileSummary
            customerInfo={customerInfo}
            fallbackPhone={phone}
            orders={orders}
          />

          <CustomerOrdersTable
            totalOrdersCount={ordersPagination.total}
            pagedOrders={ordersPagination.items}
            page={ordersPagination.page}
            pageSize={ordersPagination.pageSize}
            totalPages={ordersPagination.totalPages}
            onPageChange={ordersPagination.setPage}
            onPageSizeChange={ordersPagination.setPageSize}
            onOpenInvoice={onOpenInvoice}
          />

          <CustomerReturnsList returns={returns} />
        </div>
      )}
    </div>
  );
}
