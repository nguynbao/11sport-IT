"use client";

import { formatDateTime,formatVND } from "@/shared/utils/format";
import {
AlertCircle,
Calendar,
CheckCircle2,
Gift,
Infinity as InfinityIcon,
PauseCircle,
Pencil,
PlayCircle,
Plus,
Search,
ShoppingBag,
Sparkles,
Trash2
} from "lucide-react";
import { usePromotionModule } from "../hooks/usePromotionModule";
import { PromotionFormModal } from "./PromotionFormModal";
function toDateTimeLocalInput(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

export default function PromotionModule() {
  const vm = usePromotionModule();
  const {
    promotions,
    loading,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    errorMsg,
    successMsg,
    showModal,
    name,
    description,
    status,
    isPermanent,
    startDate,
    endDate,
    conditionType,
    minQuantity,
    minOrderAmount,
    giftItems,
    multiplyGiftByConditionQty,
    itemDiscountType,
    itemDiscountValue,
    billDiscountType,
    billDiscountValue,
    handleOpenCreateModal,
    handleOpenEditModal,
    handleToggleStatus,
    handleDeletePromo,
    filteredPromotions,
    kpiStats,
    renderEffectiveBadge,
  } = vm;

  return (
    <div className="space-y-5">
      {/* Header & KPI Cards */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                  Quản lý Chương trình Khuyến mãi & Tặng kèm POS
                </h2>
                <p className="text-xs text-slate-500">
                  Thiết lập chương trình mua sản phẩm tự động tặng kèm phụ kiện (0 VND) hoặc giảm giá tự động khi Sales thêm vào giỏ hàng POS
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            + Tạo Chương trình Khuyến mãi
          </button>
        </div>

        {/* 4 Thẻ thống kê nhanh */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-bold uppercase text-slate-500">
              Tổng Chương trình
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">
              {kpiStats.total}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Toàn hệ thống POS
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-200">
            <div className="text-[11px] font-bold uppercase text-brand-ink">
              Đang chạy hiệu lực
            </div>
            <div className="text-2xl font-extrabold text-brand-ink mt-1 font-mono">
              {kpiStats.activeNow}
            </div>
            <div className="text-[11px] text-brand-ink mt-0.5">
              Tự động kích hoạt tại quầy POS
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
            <div className="text-[11px] font-bold uppercase text-amber-800">
              Chạy vĩnh viễn
            </div>
            <div className="text-2xl font-extrabold text-amber-700 mt-1 font-mono">
              {kpiStats.permanent}
            </div>
            <div className="text-[11px] text-amber-700 mt-0.5">
              Không giới hạn thời gian kết thúc
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200">
            <div className="text-[11px] font-bold uppercase text-slate-600">
              Tạm dừng / Hết hạn
            </div>
            <div className="text-2xl font-extrabold text-slate-700 mt-1 font-mono">
              {kpiStats.pausedOrExpired}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Có thể bật lại bất kỳ lúc nào
            </div>
          </div>
        </div>

        {errorMsg && !showModal && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-brand-ink text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Thanh tìm kiếm & Lọc trạng thái */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "ALL", label: `Tất cả (${promotions.length})` },
              {
                id: "ACTIVE_NOW",
                label: `🟢 Đang chạy (${kpiStats.activeNow})`,
              },
              {
                id: "PERMANENT",
                label: `♾️ Chạy vĩnh viễn (${promotions.filter((p) => p.isPermanent).length
                  })`,
              },
              {
                id: "SCHEDULED",
                label: `📅 Có thời hạn (${promotions.filter((p) => !p.isPermanent).length
                  })`,
              },
              {
                id: "INACTIVE",
                label: `⏸ Tạm dừng / Hết hạn (${kpiStats.pausedOrExpired})`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${statusFilter === tab.id
                    ? "bg-teal-600 text-white border-slate-900 shadow-xs"
                    : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên CTKM, sản phẩm, quà tặng..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Danh sách Chương trình Khuyến mãi */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-slate-500">
            Đang tải danh sách chương trình khuyến mãi...
          </div>
        ) : filteredPromotions.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-3">
            <Gift className="w-10 h-10 text-amber-500 mx-auto" />
            <div className="text-base font-extrabold text-slate-800">
              Chưa có chương trình khuyến mãi nào
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Bấm nút <strong>&ldquo;+ Tạo Chương trình Khuyến mãi&rdquo;</strong> để thiết lập các chương trình như mua Vợt mặc định tặng kèm Quấn cán / Phụ kiện hoặc tự động giảm giá tại quầy POS.
            </p>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow"
            >
              <Plus className="w-4 h-4" />
              Tạo chương trình đầu tiên
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredPromotions.map((promo) => (
              <div
                key={promo._id}
                className={`p-4 sm:p-5 transition hover:bg-slate-50/80 ${promo.isCurrentlyActive ? "" : "opacity-80 bg-slate-50/40"
                  }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Cột trái: Tên, Mã, Thời gian & Điều kiện */}
                  <div className="space-y-2.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-teal-600 text-white">
                        {promo.code}
                      </span>
                      {renderEffectiveBadge(promo)}
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        {promo.isPermanent ? (
                          <>
                            <InfinityIcon className="w-3.5 h-3.5 text-brand-ink" />
                            <span>Thời gian: Chạy vĩnh viễn</span>
                          </>
                        ) : (
                          <>
                            <Calendar className="w-3.5 h-3.5 text-brand-ink" />
                            <span>
                              {promo.startDate
                                ? formatDateTime(promo.startDate)
                                : "Từ ngay bây giờ"}{" "}
                              →{" "}
                              {promo.endDate
                                ? formatDateTime(promo.endDate)
                                : "Không giới hạn"}
                            </span>
                          </>
                        )}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 break-words">
                        {promo.name}
                      </h3>
                      {promo.description && (
                        <p className="text-xs text-slate-600 mt-0.5">
                          {promo.description}
                        </p>
                      )}
                    </div>

                    {/* Điều kiện áp dụng */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 space-y-1.5 text-xs">
                      <div className="font-bold text-slate-700 flex items-center gap-1.5">
                        <ShoppingBag className="w-3.5 h-3.5 text-brand-ink" />
                        <span>Điều kiện khi Sales thêm giỏ hàng:</span>
                        <span className="text-brand-ink font-extrabold">
                          {promo.conditionType === "BUY_PRODUCTS" &&
                            `Mua từ ${promo.minQuantity} sản phẩm chỉ định`}
                          {promo.conditionType === "BUY_CATEGORY" &&
                            `Mua từ ${promo.minQuantity} sản phẩm thuộc Danh mục chỉ định`}
                          {promo.conditionType === "ALL_PRODUCTS" &&
                            `Áp dụng mọi sản phẩm (SL tối thiểu: ${promo.minQuantity})`}
                        </span>
                        {promo.minOrderAmount > 0 && (
                          <span className="px-2 py-0.5 rounded bg-teal-100 text-brand-ink font-mono text-[11px] font-bold">
                            Đơn tối thiểu: {formatVND(promo.minOrderAmount)}
                          </span>
                        )}
                      </div>

                      {promo.conditionType === "BUY_PRODUCTS" &&
                        promo.conditionProducts?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {promo.conditionProducts.map((cp) => (
                              <span
                                key={cp.productId}
                                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 text-[11px] font-semibold"
                              >
                                {cp.productName}
                              </span>
                            ))}
                          </div>
                        )}

                      {promo.conditionType === "BUY_CATEGORY" &&
                        promo.conditionCategories?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {promo.conditionCategories.map((cc) => (
                              <span
                                key={cc.categoryId}
                                className="px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-brand-ink text-[11px] font-bold"
                              >
                                📂 Danh mục: {cc.categoryName}
                              </span>
                            ))}
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Cột giữa: Quyền lợi / Ưu đãi tự động */}
                  <div className="lg:w-96 shrink-0 space-y-2">
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2 text-xs">
                      <div className="font-extrabold text-amber-900 uppercase text-[11px] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        Ưu đãi tự động áp dụng vào Giỏ hàng
                      </div>

                      {/* Quà tặng kèm */}
                      {promo.giftItems && promo.giftItems.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[11px] font-bold text-amber-800">
                            Mặc định tặng kèm (0 VND ·{" "}
                            {promo.multiplyGiftByConditionQty
                              ? "Nhân theo SL mua"
                              : "Cố định 1 suất/đơn"}
                            ):
                          </div>
                          {promo.giftItems.map((g) => (
                            <div
                              key={g.productId}
                              className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-amber-200"
                            >
                              <span className="font-semibold text-slate-900 truncate">
                                {g.productName}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="font-mono font-extrabold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                                  ×{g.quantity} {g.unit}
                                </span>
                                <span
                                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${(g.stockFloor1 ?? 0) > 0
                                      ? "bg-teal-50 text-brand-ink"
                                      : "bg-red-50 text-red-600 font-bold"
                                    }`}
                                >
                                  T1: {g.stockFloor1 ?? 0}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Giảm giá sản phẩm */}
                      {promo.itemDiscountType !== "NONE" &&
                        promo.itemDiscountValue > 0 && (
                          <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 font-bold">
                            <span>🏷️ Giảm giá trực tiếp SP mua:</span>
                            <span className="font-mono">
                              {promo.itemDiscountType === "PERCENT"
                                ? `−${promo.itemDiscountValue}%`
                                : `−${formatVND(promo.itemDiscountValue)}/SP`}
                            </span>
                          </div>
                        )}

                      {/* Giảm giá tổng Bill */}
                      {promo.billDiscountType !== "NONE" &&
                        promo.billDiscountValue > 0 && (
                          <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-700 font-bold">
                            <span>🧾 Giảm giá tổng Bill:</span>
                            <span className="font-mono">
                              {promo.billDiscountType === "PERCENT"
                                ? `−${promo.billDiscountValue}%`
                                : `−${formatVND(promo.billDiscountValue)}`}
                            </span>
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Cột phải: Thao tác Bật/Tắt, Sửa, Xóa */}
                  <div className="flex lg:flex-col items-center justify-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(promo)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition w-full justify-center ${promo.status === "ACTIVE"
                          ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300"
                          : "bg-teal-600 hover:bg-teal-700 text-white border-teal-700"
                        }`}
                    >
                      {promo.status === "ACTIVE" ? (
                        <>
                          <PauseCircle className="w-3.5 h-3.5" />
                          Tạm dừng
                        </>
                      ) : (
                        <>
                          <PlayCircle className="w-3.5 h-3.5" />
                          Kích hoạt
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-2 w-full">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(promo)}
                        className="flex-1 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center justify-center gap-1 border border-slate-300 transition"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePromo(promo)}
                        className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center gap-1 border border-red-200 transition"
                        title="Xóa chương trình"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PromotionFormModal vm={vm} />
    </div>
  );
}
