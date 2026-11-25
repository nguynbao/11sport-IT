"use client";

import React from "react";
import { PaginationBar } from "@/shared/ui/PaginationBar";

export interface InventoryPaginationBarProps {
  totalItems: number;
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (sz: number) => void;
  itemLabel?: string;
}

export function InventoryPaginationBar({
  totalItems,
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = "mặt hàng",
}: InventoryPaginationBarProps) {
  return (
    <PaginationBar
      totalItems={totalItems}
      page={page}
      totalPages={totalPages}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      itemLabel={itemLabel}
      pageSizeOptions={[10, 15, 25, 50, 100]}
      showAllOption
    />
  );
}
