"use client";

import ExportExcelButton from "@/shared/ui/ExportExcelButton";
import { formatVND } from "@/shared/utils/format";
import { exportInventoryReport } from "../exports";
import { InventoryViewModel } from "../hooks/useInventoryModule";

export function InventoryReportTab({ vm }: { vm: InventoryViewModel }) {
  const {
    subTab,
    activeWarehouse,
    reportRows,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    setReportPage,
    reportPageSize,
    setReportPageSize,
    loadReport,
    filteredReportRows,
    reportTotalPages,
    safeReportPage,
    pagedReportRows,
    renderPaginationBar,
  } = vm;

  return (
    <>
      {/* SUB-TAB 2: BÁO CÁO TỒN KHO THEO KỲ (SỐ LƯỢNG + GIÁ GỐC + GIÁ BÁN) */}
      {subTab === "REPORT" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Báo cáo Kế toán Tồn kho theo kỳ — Số lượng, Giá vốn & Giá niêm yết (BR-06)
              </h3>
              <p className="text-xs text-slate-500">
                Công thức chuẩn:{" "}
                <strong className="text-slate-800">
                  Số lượng Tồn cuối kỳ = Tồn đầu kỳ + Nhập trong kỳ − Bán trong kỳ ± Điều chỉnh (Tách riêng Kho Tầng 1 & Kho Tầng 2)
                </strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
              />
              <span className="text-xs text-slate-400">đến</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
              />
              <button
                type="button"
                onClick={loadReport}
                className="px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold"
              >
                Lọc kỳ báo cáo
              </button>
              <ExportExcelButton
                onExport={() => exportInventoryReport(reportRows, fromDate, toDate)}
                disabled={reportRows.length === 0}
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table data-cards className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
                <tr>
                  <th className="py-3 px-3">Mã sản phẩm</th>
                  <th className="py-3 px-3">Tên sản phẩm</th>
                  <th className="py-3 px-2.5 text-center">ĐVT</th>
                  <th className="py-3 px-2.5 text-right">Đầu Kỳ</th>
                  <th className="py-3 px-2.5 text-right text-teal-300">+ Nhập</th>
                  <th className="py-3 px-2.5 text-right text-amber-300">− Bán</th>
                  <th className="py-3 px-2.5 text-right text-teal-300">± Đ.Chỉnh</th>
                  <th className="py-3 px-2.5 text-right text-teal-300 bg-slate-800 whitespace-nowrap">
                    🏢 Tồn Tầng 1
                  </th>
                  <th className="py-3 px-2.5 text-right text-teal-300 bg-slate-800 whitespace-nowrap">
                    🏬 Tồn Tầng 2
                  </th>
                  <th className="py-3 px-3 text-right font-extrabold bg-slate-200/70 text-slate-900 whitespace-nowrap">
                    = Tổng 2 Kho
                  </th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Giá vốn (VND)</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Giá niêm yết (VND)</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap bg-amber-50 text-amber-800">
                    Tổng vốn tồn
                  </th>
                  <th className="py-3 px-3 text-right whitespace-nowrap bg-teal-50 text-brand-ink">
                    Tổng giá niêm yết tồn
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pagedReportRows.map((r, i) => {
                  const cost = Number(r.costPrice) || 0;
                  const sell = Number(r.sellingPrice) || 0;
                  const f1 = Number(r.stockFloor1 ?? r.closingStock) || 0;
                  const f2 = Number(r.stockFloor2) || 0;
                  const closing = Number(r.closingStock) || 0;
                  const activeQty = activeWarehouse === "FLOOR_1" ? f1 : activeWarehouse === "FLOOR_2" ? f2 : closing;
                  return (
                    <tr key={r.productId || i} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-mono font-bold">{r.productCode}</td>
                      <td className="py-3 px-3 font-semibold">{r.productName}</td>
                      <td className="py-3 px-2.5 text-center">{r.unit}</td>
                      <td className="py-3 px-2.5 text-right font-mono font-bold">
                        {r.openingStock}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono font-bold text-brand-ink">
                        +{r.importedQty}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono font-bold text-amber-700">
                        -{r.soldQty}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono font-bold text-brand-ink">
                        {r.adjustedAndReturnedQty > 0
                          ? `+${r.adjustedAndReturnedQty}`
                          : r.adjustedAndReturnedQty}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono font-bold text-brand-ink bg-teal-50/40">
                        {f1}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono font-bold text-brand-ink bg-teal-50/40">
                        {f2}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900 bg-slate-50">
                        {closing}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                        {cost > 0 ? formatVND(cost) : <span className="text-slate-400">0 VND</span>}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {sell > 0 ? formatVND(sell) : <span className="text-amber-700">0 VND</span>}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-amber-800 bg-amber-50/40 whitespace-nowrap">
                        {formatVND(activeQty * cost)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-brand-ink bg-teal-50/40 whitespace-nowrap">
                        {formatVND(activeQty * sell)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {reportRows.length > 0 && (
                <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-extrabold text-slate-900">
                  <tr>
                    <td colSpan={3} className="py-3 px-3 text-right uppercase">
                      Tổng cộng ({reportRows.length} SP):
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono">
                      {reportRows.reduce((s, r) => s + (Number(r.openingStock) || 0), 0)}
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono text-brand-ink">
                      +{reportRows.reduce((s, r) => s + (Number(r.importedQty) || 0), 0)}
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono text-amber-700">
                      -{reportRows.reduce((s, r) => s + (Number(r.soldQty) || 0), 0)}
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono text-brand-ink">
                      {reportRows.reduce((s, r) => s + (Number(r.adjustedAndReturnedQty) || 0), 0)}
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono text-brand-ink">
                      {reportRows.reduce((s, r) => s + (Number(r.stockFloor1 ?? r.closingStock) || 0), 0)}
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono text-brand-ink">
                      {reportRows.reduce((s, r) => s + (Number(r.stockFloor2) || 0), 0)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {reportRows.reduce((s, r) => s + (Number(r.closingStock) || 0), 0)}
                    </td>
                    <td colSpan={2}></td>
                    <td className="py-3 px-3 text-right font-mono text-amber-800 whitespace-nowrap">
                      {formatVND(
                        reportRows.reduce(
                          (s, r) => s + (Number(r.closingStock) || 0) * (Number(r.costPrice) || 0),
                          0
                        )
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-brand-ink whitespace-nowrap">
                      {formatVND(
                        reportRows.reduce(
                          (s, r) => s + (Number(r.closingStock) || 0) * (Number(r.sellingPrice) || 0),
                          0
                        )
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {renderPaginationBar({
            totalItems: filteredReportRows.length,
            page: safeReportPage,
            totalPages: reportTotalPages,
            pageSize: reportPageSize,
            onPageChange: setReportPage,
            onPageSizeChange: setReportPageSize,
            itemLabel: "mặt hàng trong báo cáo",
          })}
        </div>
      )}

    </>
  );
}
