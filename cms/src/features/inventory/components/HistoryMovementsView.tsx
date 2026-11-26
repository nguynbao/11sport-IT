"use client";

import ExportExcelButton from "@/shared/ui/ExportExcelButton";
import { formatDateTime,formatVND } from "@/shared/utils/format";
import { exportMovements } from "../exports";
import { InventoryViewModel } from "../hooks/useInventoryModule";
import { CmsRoleBadge } from "./CmsRoleBadge";

export function HistoryMovementsView({ vm }: { vm: InventoryViewModel }) {
  const {
    historyView,
    activeWarehouse,
    movements,
    movementType,
    setMovementType,
    setMovPage,
    movPageSize,
    setMovPageSize,
    productByCode,
    filteredMovements,
    movTotalPages,
    safeMovPage,
    pagedMovements,
    renderPaginationBar,
  } = vm;

  return (
    <>
          {/* GÓC NHÌN 2: SỔ XUẤT NHẬP TỒN (STOCK MOVEMENTS) */}
          {historyView === "MOVEMENTS" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Sổ Xuất Nhập Tồn —{" "}
                {activeWarehouse === "FLOOR_1"
                  ? "🏢 Kho Tầng 1"
                  : activeWarehouse === "FLOOR_2"
                    ? "🏬 Kho Tầng 2"
                    : "📊 Cả 2 Kho"}
              </h3>
              <p className="text-xs text-slate-500">
                Lưu vết toàn bộ lịch sử biến động tồn kho kèm Kho tầng, Số lượng, Giá vốn, Giá niêm yết, mã chứng từ và nhân viên thực hiện.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ExportExcelButton
                onExport={() => exportMovements(movements, movementType)}
                disabled={movements.length === 0}
              />
              <select
                value={movementType}
                onChange={(e) => setMovementType(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
              >
                <option value="">Tất cả loại giao dịch</option>
                <option value="IMPORT">IMPORT (Nhập kho)</option>
                <option value="SALE">SALE (Bán hàng)</option>
                <option value="RETURN">RETURN (Trả hàng)</option>
                <option value="EXCHANGE_IN">EXCHANGE_IN (Nhận hàng đổi)</option>
                <option value="EXCHANGE_OUT">EXCHANGE_OUT (Xuất hàng đổi)</option>
                <option value="ADJUSTMENT">ADJUSTMENT (Điều chỉnh kho)</option>
                <option value="TRANSFER">TRANSFER (Xuất kho chuyển tầng PXK)</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table data-cards className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
                <tr>
                  <th className="py-3 px-3">Thời gian</th>
                  <th className="py-3 px-3">Kho tầng</th>
                  <th className="py-3 px-3">Loại</th>
                  <th className="py-3 px-3">Sản phẩm</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">SL Biến động</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">SL Tồn sau GD</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Giá vốn (VND)</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Giá niêm yết (VND)</th>
                  <th className="py-3 px-3">Người thực hiện (Vai trò)</th>
                  <th className="py-3 px-3">Chứng từ</th>
                  <th className="py-3 px-3">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedMovements.map((m) => {
                  const fallbackProd = productByCode.get(m.productCode);
                  const cost = Number(m.costPrice ?? fallbackProd?.costPrice ?? 0);
                  const sell = Number(m.sellingPrice ?? fallbackProd?.sellingPrice ?? 0);
                  const loc = m.warehouseLocation || "FLOOR_1";
                  return (
                    <tr key={m._id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                        {formatDateTime(m.createdAt)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${loc === "FLOOR_2"
                            ? "bg-teal-100 text-brand-ink"
                            : "bg-teal-100 text-brand-ink"
                            }`}
                        >
                          {loc === "FLOOR_2" ? "🏬 Kho Tầng 2" : "🏢 Kho Tầng 1"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold">{m.type}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{m.productName}</div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {m.productCode}
                        </div>
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-extrabold ${m.quantityChange > 0 ? "text-brand-ink" : "text-red-600"
                          }`}
                      >
                        {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {m.balanceAfter}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-800 whitespace-nowrap">
                        {cost > 0 ? formatVND(cost) : <span className="text-slate-400">0 VND</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-brand-ink whitespace-nowrap">
                        {sell > 0 ? formatVND(sell) : <span className="text-slate-400">0 VND</span>}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800">
                            {m.performedByName || "Hệ thống"}
                          </span>
                          <CmsRoleBadge role={m.performedByRole} compact />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-brand-ink whitespace-nowrap">
                        {m.referenceCode || "-"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{m.note || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {renderPaginationBar({
            totalItems: filteredMovements.length,
            page: safeMovPage,
            totalPages: movTotalPages,
            pageSize: movPageSize,
            onPageChange: setMovPage,
            onPageSizeChange: setMovPageSize,
            itemLabel: "bút toán sổ kho",
          })}
        </div>
      )}

    </>
  );
}
