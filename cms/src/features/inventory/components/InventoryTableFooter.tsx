"use client";

import React from "react";
import { formatVND } from "@/shared/utils/format";
import type { InventoryViewModel } from "../hooks/useInventoryModule";

export function InventoryTableFooter({ vm }: { vm: InventoryViewModel }) {
  const {
    displayedProducts,
    activeWarehouse,
    activeWarehouseLabel,
    totalStockQty,
    totalCostInventoryValue,
    totalSellInventoryValue,
  } = vm;

  return (
    <>
                {displayedProducts.length > 0 && (
                  <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-extrabold text-slate-900">
                    <tr>
                      <td colSpan={5} className="py-3 px-3 text-right uppercase">
                        Tổng toàn kho {activeWarehouseLabel} ({displayedProducts.length} mặt hàng):
                      </td>
                      {(activeWarehouse === "FLOOR_1" || activeWarehouse === "ALL") && (
                        <td className="py-3 px-2.5 text-right font-mono text-brand-ink">
                          {displayedProducts.reduce(
                            (s, p) => s + (Number(p.stockFloor1 ?? p.stock) || 0),
                            0
                          )}
                        </td>
                      )}
                      {(activeWarehouse === "FLOOR_2" || activeWarehouse === "ALL") && (
                        <td className="py-3 px-2.5 text-right font-mono text-purple-700">
                          {displayedProducts.reduce(
                            (s, p) => s + (Number(p.stockFloor2) || 0),
                            0
                          )}
                        </td>
                      )}
                      {activeWarehouse === "ALL" && (
                        <td className="py-3 px-2.5 text-right font-mono text-slate-900">
                          {totalStockQty}
                        </td>
                      )}
                      <td className="py-3 px-2.5 text-right font-mono text-amber-800 whitespace-nowrap">
                        {formatVND(totalCostInventoryValue)}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono text-brand-ink whitespace-nowrap">
                        {formatVND(totalSellInventoryValue)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
    </>
  );
}
