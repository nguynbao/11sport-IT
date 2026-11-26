import React from "react";
import { Rocket, Search, ChevronLeft, ChevronRight, AlertTriangle, Tag } from "lucide-react";
import { formatVND } from "@/shared/utils/format";
import type { MarketingPushState } from "../hooks/useMarketingPushProducts";

export default function PushProductsTable({ p }: { p: MarketingPushState }) {
  const { loading, pushFilter, setPushFilter, pushSearch, setPushSearch, pushPage, setPushPage, pushPageSize, setPushPageSize, counts, filteredPushProducts, pushTotalPages, pagedPushProducts } = p;
  return (
      <div className="bg-white rounded-2xl border-2 border-amber-200 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 mb-1">
              <Rocket className="w-3.5 h-3.5 text-amber-600" />
              CẦN ĐẨY MẠNH BÁN HÀNG / TỐI ƯU KHO
            </div>
            <h3 className="font-extrabold text-slate-900 text-base">
              Các Sản Phẩm Đang Cần Đẩy Mạnh ({filteredPushProducts.length} mặt hàng)
            </h3>
            <p className="text-xs text-slate-500">
              Hệ thống tự động phát hiện các mặt hàng tồn kho cao nhưng bán chậm/chưa phát sinh đơn, đọng vốn lớn, đang nằm ở Kho Tầng 2 mà Tầng 1 = 0, hoặc chưa đặt giá niêm yết.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={pushSearch}
                onChange={(e) => setPushSearch(e.target.value)}
                placeholder="Tìm mã, tên SP hoặc danh mục..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:border-amber-500 focus:outline-none"
              />
            </div>

            <select
              value={pushFilter}
              onChange={(e) => setPushFilter(e.target.value as MarketingPushState["pushFilter"])}
              className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50/60 text-xs font-bold text-slate-900"
            >
              <option value="ALL">Tất cả SP cần đẩy mạnh ({counts.all})</option>
              <option value="ZERO_SALES">Chưa bán được chiếc nào ({counts.zeroSales})</option>
              <option value="HIGH_CAPITAL">Đọng vốn cao ≥ 2tr ({counts.highCapital})</option>
              <option value="FLOOR2_ONLY">Tầng 1 = 0, nằm ở Tầng 2 ({counts.floor2Only})</option>
              <option value="NO_PRICE">Chưa đặt giá niêm yết ({counts.noPrice})</option>
            </select>

            <select
              value={pushPageSize}
              onChange={(e) => setPushPageSize(Number(e.target.value))}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
            >
              <option value={10}>10 dòng / trang</option>
              <option value={15}>15 dòng / trang</option>
              <option value={30}>30 dòng / trang</option>
              <option value={50}>50 dòng / trang</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table data-cards className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
              <tr>
                <th className="py-3 px-3 text-center w-14">STT</th>
                <th className="py-3 px-3">Mã & Tên sản phẩm</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-right">Tồn kho hiện tại</th>
                <th className="py-3 px-3 text-right">Đã bán trong kỳ</th>
                <th className="py-3 px-3 text-right">Giá vốn / Giá niêm yết</th>
                <th className="py-3 px-3 text-right bg-amber-950 text-amber-300">
                  Vốn đang đọng
                </th>
                <th className="py-3 px-3">Lý do cần đẩy mạnh</th>
                <th className="py-3 px-3">Đề xuất hành động Marketing / Kho</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500 font-semibold">
                    Đang tải danh sách sản phẩm cần đẩy mạnh...
                  </td>
                </tr>
              ) : pagedPushProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500">
                    Không có sản phẩm nào khớp với điều kiện lọc hiện tại.
                  </td>
                </tr>
              ) : (
                pagedPushProducts.map((p, idx) => (
                  <tr
                    key={p.productId || p.productCode}
                    className="hover:bg-amber-50/30 transition"
                  >
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-500">
                      {(pushPage - 1) * pushPageSize + idx + 1}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{p.productName}</div>
                      <div className="font-mono text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Tag className="w-3 h-3 text-slate-400" />
                        {p.productCode}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        {p.categoryName}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                      <div className="font-extrabold text-slate-900">
                        {p.stock} {p.unit}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        🏢 T1: <b className="text-brand-ink">{p.stockFloor1}</b> · 🏬 T2:{" "}
                        <b className="text-purple-700">{p.stockFloor2}</b>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">
                      {p.netSoldQty} {p.unit}
                    </td>
                    <td className="py-3 px-3 text-right font-mono whitespace-nowrap">
                      <div className="text-slate-600">Gốc: {formatVND(p.costPrice)}</div>
                      <div className="font-bold text-brand-ink">
                        Bán: {formatVND(p.sellingPrice)}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-extrabold text-amber-800 bg-amber-50/40 whitespace-nowrap">
                      {formatVND(p.inventoryCostValue)}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-1">
                        {p.pushReasons.map((reason, rIdx) => (
                          <span
                            key={rIdx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-semibold text-[11px]"
                          >
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            {reason}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-[11px] font-semibold text-slate-800">
                        💡 {p.suggestedAction}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {filteredPushProducts.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-slate-600">
            <span>
              Hiển thị{" "}
              <strong>
                {(pushPage - 1) * pushPageSize + 1}–
                {Math.min(pushPage * pushPageSize, filteredPushProducts.length)}
              </strong>{" "}
              trên tổng <strong>{filteredPushProducts.length}</strong> sản phẩm cần đẩy mạnh
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={pushPage <= 1}
                onClick={() => setPushPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Trước
              </button>
              <span className="px-3 py-1.5 font-mono font-bold text-slate-900">
                Trang {pushPage} / {pushTotalPages}
              </span>
              <button
                type="button"
                disabled={pushPage >= pushTotalPages}
                onClick={() => setPushPage((p) => Math.min(pushTotalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-100 font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                Tiếp <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
  );
}
