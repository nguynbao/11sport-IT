"use client";

import React from "react";
import type { DiscountType, Product, ProductVariant } from "@/shared/types";
import { getStoredUser } from "@/shared/api/client";
import {
  formatVND,
  formatNumberDots,
  parseNumberDots,
  formatPhone,
  cleanPhoneDigits,
  formatDateTime,
  formatVariantLabel,
} from "@/shared/utils/format";
import {
  resolveVariantCode,
  findVariantByColorSize,
  variantEffectiveSellingPrice,
} from "@/shared/utils/productCode";
import { playScannerBeep } from "@/shared/lib/barcodeScanner";
import {
  Search,
  ShoppingCart,
  UserCheck,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Landmark,
  Printer,
  CheckCircle2,
  AlertCircle,
  History,
  Tag,
  Gift,
  Pin,
  X,
  ArrowUpDown,
  Layers,
  Sparkles,
  FileText,
  Save,
  ScanLine,
  Zap,
  ChevronDown,
  ChevronUp,
  Wrench,
  LayoutGrid,
  MoreVertical,
  Pencil,
  User,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
  List,
  Package,
} from "lucide-react";
import { PosServiceSection } from "@/features/services";
import {
  ColorSwatchBadge,
  getColorBoxBorderStyle,
  resolveVariantColorHexes,
} from "@/shared/ui/ColorSwatchPicker";
import {
  MAX_DRAFTS,
  SPLIT_METHOD_OPTIONS,
  cartUnitPrice,
  productDisplayPrice,
  getCartLineKey,
  isDraftEmpty,
  type PaymentMethodType,
  type PosTabProps,
  type SplitMethodType,
  type SortByOption,
} from "../types";
import { usePosTab } from "../hooks/usePosTab";

export default function PosTab({ onOpenInvoice }: PosTabProps) {
  const {
    posMode,
    setPosMode,
    posSubView,
    setPosSubView,
    showCheckoutDrawer,
    setShowCheckoutDrawer,
    showCategoryFilterPopover,
    setShowCategoryFilterPopover,
    catalogViewMode,
    setCatalogViewMode,
    catalogPage,
    setCatalogPage,
    showSearchDropdown,
    setShowSearchDropdown,
    expandedDiscountKey,
    setExpandedDiscountKey,
    nowClock,
    searchBoxRef,
    billPriceInputRef,
    serviceMeta,
    setServiceMeta,
    categories,
    appliedPromosSummary,
    setIsManualBillDiscount,
    selectedCategoryId,
    setSelectedCategoryId,
    setSortBy,
    search,
    setSearch,
    loadingProducts,
    scannerEnabled,
    setScannerEnabled,
    lastScanBanner,
    setLastScanBanner,
    cart,
    giftCart,
    variantPickerProduct,
    setVariantPickerProduct,
    pickerColorFilter,
    setPickerColorFilter,
    pickerSearch,
    setPickerSearch,
    expandedCardVarIds,
    toggleExpandCardVariants,
    showGiftModal,
    setShowGiftModal,
    giftSearch,
    setGiftSearch,
    giftCategoryId,
    setGiftCategoryId,
    pinnedGiftIds,
    billDiscountType,
    setBillDiscountType,
    billDiscountValue,
    setBillDiscountValue,
    billDiscountInputMode,
    setBillDiscountInputMode,
    billCustomPriceText,
    setBillCustomPriceText,
    customerPhone,
    setCustomerPhone,
    customerName,
    setCustomerName,
    isExistingCustomer,
    setIsExistingCustomer,
    customerOrders,
    setCustomerOrders,
    customerDebtSummary,
    setCustomerDebtSummary,
    lookingUp,
    paymentMethod,
    setPaymentMethod,
    splitPayments,
    setSplitPayments,
    debtDueDate,
    setDebtDueDate,
    showSplitDropdown,
    setShowSplitDropdown,
    setHasCardFee,
    cardFeePercent,
    setCardFeePercent,
    note,
    setNote,
    submitting,
    errorMsg,
    successMsg,
    savingDraft,
    savedDraftOrders,
    loadingSavedDrafts,
    editingServerDraftOrder,
    activeDraftId,
    liveDrafts,
    handleSwitchDraft,
    handleAddDraft,
    removeDraft,
    handleCloseDraft,
    getDirectFloor1Stock,
    getFloor1Stock,
    getVariantFloor1Stock,
    getCategoryName,
    getCategoryId,
    phoneTypedByUserRef,
    togglePinGiftProduct,
    floor1Products,
    filteredAndSortedProducts,
    getCartQty,
    getCartVariantQty,
    getGiftQty,
    getProductPromotions,
    handleSelectProductForPos,
    handleAddToCart,
    handleBarcodeScanForPos,
    handleChangeQty,
    handleAddGiftProduct,
    handleChangeGiftQty,
    pinnedFloor1Count,
    popupGiftProducts,
    handleChangeItemDiscount,
    handleChangeItemDesiredPrice,
    getItemPricing,
    giftUnitsCount,
    rawSubtotal,
    itemDiscountTotal,
    subtotal,
    billDiscountAmount,
    cardFee,
    totalAmount,
    handleCreateOrder,
    handleSaveOrderAsDraft,
    handleLoadServerDraftToPos,
    handleQuickConfirmServerDraft,
    handleDeleteServerDraft,
  } = usePosTab({ onOpenInvoice });

  const renderProductCard = (p: Product) => {
    const directFloor1 = getDirectFloor1Stock(p);
    const unpackableFloor1 = Math.max(0, Number(p.maxUnpackableFloor1) || 0);
    const floor1Stock = getFloor1Stock(p);
    const displayPrice = productDisplayPrice(p);
    const canSell = displayPrice.price > 0 && floor1Stock > 0;
    const catName = getCategoryName(p);
    const matchedPromos = getProductPromotions(p);
    const namedVariants = (p.variants || []).filter((v) => v.color || v.size);

    return (
      <div
        key={p._id}
        onClick={() => canSell && handleSelectProductForPos(p)}
        className={`p-3.5 rounded-xl border transition flex flex-col justify-between ${canSell
          ? "border-slate-200 hover:border-blue-500 hover:shadow-md cursor-pointer bg-white"
          : "border-slate-200 bg-slate-50 opacity-70 cursor-not-allowed"
          }`}
      >
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-brand-ink border border-blue-200 truncate">
              {catName}
            </span>
            <div className="text-right shrink-0 flex flex-col items-end gap-1">
              <span
                className={`text-xs font-extrabold px-2 py-0.5 rounded whitespace-nowrap ${directFloor1 > 0
                  ? "bg-blue-50 text-brand-ink border border-blue-200"
                  : unpackableFloor1 > 0
                    ? "bg-amber-50 text-amber-800 border border-amber-300"
                    : "bg-red-50 text-red-600 border border-red-200"
                  }`}
              >
                {directFloor1 > 0
                  ? `🏢 Kho Tầng 1: ${directFloor1} ${p.unit}`
                  : unpackableFloor1 > 0
                    ? `⚡ Tồn lẻ: 0 • Tự tách từ ${p.parentSetStockFloor1} ${p.parentSetUnit || "Bộ"}`
                    : `🏢 Kho Tầng 1: 0 ${p.unit}`}
              </span>
              {unpackableFloor1 > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100/90 text-amber-950 border border-amber-300 whitespace-nowrap">
                  📦 +{p.parentSetStockFloor1} {p.parentSetUnit || "Bộ"} (= +{unpackableFloor1}{" "}
                  {p.unit})
                </span>
              )}
            </div>
          </div>
          <h3 className="font-semibold text-slate-900 text-sm mt-2 break-words">
            {p.name}
          </h3>
          <div className="font-mono text-[10px] font-bold text-slate-500 mt-0.5 break-all">
            Mã: {p.code}
          </div>
          {p.note && (
            <div className="mt-1 text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 break-words">
              📝 {p.note}
            </div>
          )}

          {/* Hiển thị thông minh phân loại theo từng Nhóm Màu sắc & chip Size gọn gàng */}
          {namedVariants.length > 0 && (() => {
            const byColor = new Map<string, ProductVariant[]>();
            for (const v of namedVariants) {
              const cKey = (v.color || "").trim() || "Mặc định";
              const list = byColor.get(cKey) || [];
              list.push(v);
              byColor.set(cKey, list);
            }
            // Sắp xếp các size tăng dần trong từng nhóm màu
            const colorGroups = Array.from(byColor.entries()).map(([colorLabel, vars]) => {
              const sortedVars = [...vars].sort((a, b) => {
                const sa = parseFloat(String(a.size || "").replace(",", "."));
                const sb = parseFloat(String(b.size || "").replace(",", "."));
                if (!isNaN(sa) && !isNaN(sb) && sa !== sb) return sa - sb;
                return String(a.size || "").localeCompare(String(b.size || ""), "vi");
              });
              const groupStock = sortedVars.reduce(
                (s, v) => s + Math.max(0, Number(v.stockFloor1 ?? v.stock) || 0),
                0
              );
              return { colorLabel, vars: sortedVars, groupStock };
            });

            const isCardExpanded = expandedCardVarIds.has(p._id);
            const MAX_GROUPS_COLLAPSED = 2;
            const MAX_VARS_COLLAPSED = 6;
            const hasMany =
              colorGroups.length > MAX_GROUPS_COLLAPSED ||
              namedVariants.length > MAX_VARS_COLLAPSED;
            const visibleGroups =
              hasMany && !isCardExpanded
                ? colorGroups.slice(0, MAX_GROUPS_COLLAPSED)
                : colorGroups;
            const hiddenGroupCount = Math.max(0, colorGroups.length - visibleGroups.length);

            return (
              <div className="mt-2 space-y-1.5">
                {visibleGroups.map(({ colorLabel, vars, groupStock }) => {
                  const showAllSizes = isCardExpanded || vars.length <= 6;
                  const displayVars = showAllSizes ? vars : vars.slice(0, 5);
                  const hiddenSizes = Math.max(0, vars.length - displayVars.length);
                  const explicitGroupHexes = vars.find(
                    (v) => Array.isArray(v.colorHexes) && v.colorHexes.length > 0
                  )?.colorHexes;
                  const groupHexes = resolveVariantColorHexes(colorLabel, explicitGroupHexes);

                  return (
                    <div
                      key={colorLabel}
                      style={getColorBoxBorderStyle(groupHexes, "var(--box-bg, #f8fafc)", 2)}
                      className={`rounded-lg bg-slate-50/90 border border-slate-200/80 px-2.5 py-1.5 space-y-1.5 ${
                        groupStock > 0 ? "" : "opacity-60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 text-[11px]">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5 min-w-0">
                          <ColorSwatchBadge
                            hexes={groupHexes}
                            colorName={colorLabel}
                            size="xs"
                          />
                          <span className="break-words leading-tight">{colorLabel}</span>
                        </span>
                        <span className="font-mono text-[10px] font-bold text-slate-500 shrink-0">
                          Tồn: <strong className={groupStock > 0 ? "text-brand-ink" : "text-slate-400"}>{groupStock}</strong>
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {displayVars.map((v, idx) => {
                          const vStock = Math.max(0, Number(v.stockFloor1 ?? v.stock) || 0);
                          const inCart = getCartVariantQty(p._id, v.color, v.size);
                          const childCode =
                            v.variantCode ||
                            resolveVariantCode(p, p.code, v.color, v.size);
                          return (
                            <button
                              key={`${v.color}-${v.size}-${idx}`}
                              type="button"
                              disabled={!canSell || vStock <= 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToCart(p, v.color, v.size);
                              }}
                              title={`Mã con: ${childCode} • Bấm để thêm nhanh ${formatVariantLabel(v.color, v.size)}`}
                              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border transition shrink-0 ${vStock <= 0
                                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through"
                                : inCart > 0
                                  ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                                  : "bg-white hover:bg-blue-50 hover:border-blue-400 text-slate-900 border-slate-300 shadow-2xs"
                                }`}
                            >
                              {Boolean(v.size?.trim()) && (
                                <span className="font-extrabold tracking-tight">
                                  {v.size.trim()}
                                </span>
                              )}
                              <span
                                className={`font-mono text-[10px] font-bold ${
                                  vStock <= 0
                                    ? "text-slate-400"
                                    : inCart > 0
                                      ? "text-amber-200"
                                      : "text-brand-ink"
                                }`}
                              >
                                ({vStock})
                              </span>
                              {inCart > 0 && (
                                <span className="px-1 rounded bg-white/20 text-white font-mono text-[9px]">
                                  ✓{inCart}
                                </span>
                              )}
                            </button>
                          );
                        })}
                        {hiddenSizes > 0 && (
                          <button
                            type="button"
                            onClick={(e) => toggleExpandCardVariants(p._id, e)}
                            className="inline-flex items-center text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-brand-ink border border-indigo-200 transition shrink-0"
                          >
                            +{hiddenSizes} size...
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {hasMany && (
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={(e) => toggleExpandCardVariants(p._id, e)}
                      className="inline-flex items-center gap-1 text-[10px] font-extrabold text-brand-ink hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 transition"
                    >
                      {isCardExpanded ? (
                        <>
                          <ChevronUp className="w-3 h-3" />
                          <span>Thu gọn ({namedVariants.length} mã con)</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3" />
                          <span>
                            Xem đủ {namedVariants.length} mã con ({colorGroups.length} màu
                            {hiddenGroupCount > 0 ? ` · ẩn ${hiddenGroupCount} màu` : ""})
                          </span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setVariantPickerProduct(p);
                      }}
                      className="text-[10px] font-bold text-brand-ink hover:underline"
                    >
                      Bảng chọn nhanh →
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {matchedPromos.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {matchedPromos.map((mp) => (
                <span
                  key={mp._id}
                  className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300"
                >
                  <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                  <span>KM: {mp.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
          {displayPrice.price > 0 ? (
            <span className="font-mono font-extrabold text-brand-ink text-base">
              {displayPrice.minPrice > 0 && displayPrice.maxPrice > displayPrice.minPrice ? (
                <>{formatVND(displayPrice.minPrice)} – {formatVND(displayPrice.maxPrice)}</>
              ) : (
                formatVND(displayPrice.price)
              )}
            </span>
          ) : (
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
              Chưa có giá niêm yết (0 VND)
            </span>
          )}

          <button
            type="button"
            disabled={!canSell}
            onClick={(e) => {
              e.stopPropagation();
              handleSelectProductForPos(p);
            }}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 ${canSell
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-slate-200 text-slate-500"
              }`}
          >
            <Plus className="w-3.5 h-3.5" />{" "}
            {namedVariants.length > 1 ? "Chọn Size/Màu" : "Chọn bán"}
          </button>
        </div>
      </div>
    );
  };

  const staffName = getStoredUser()?.fullName || "Nhân viên bán hàng";
  const CATALOG_PAGE_SIZE = catalogViewMode === "COMPACT" ? 18 : 6;
  const totalCatalogPages = Math.max(
    1,
    Math.ceil(filteredAndSortedProducts.length / CATALOG_PAGE_SIZE)
  );
  const safeCatalogPage = Math.min(catalogPage, totalCatalogPages);
  const paginatedCatalogProducts = filteredAndSortedProducts.slice(
    (safeCatalogPage - 1) * CATALOG_PAGE_SIZE,
    safeCatalogPage * CATALOG_PAGE_SIZE
  );
  const totalCartUnits = cart.reduce((s, i) => s + i.quantity, 0);

  const renderCartList = () => (
    <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto pr-1">
      {cart.length === 0 && giftCart.length === 0 ? (
        <div className="flex-1 bg-white/70 dark:bg-[#363636] rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-8 text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-brand-ink flex items-center justify-center">
            <ScanLine className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md">
            <div className="text-sm font-bold text-slate-700">
              Chưa có sản phẩm nào trong Hóa đơn{" "}
              {liveDrafts.find((d) => d.id === activeDraftId)?.seq ?? 1}
            </div>
            <p className="text-xs text-slate-500">
              {posSubView === "CATALOG"
                ? "Bấm chọn sản phẩm ở khung danh mục bên phải, quét mã vạch hoặc tìm kiếm ở thanh trên cùng."
                : "Quét mã vạch sản phẩm, gõ tìm kiếm ở thanh trên cùng hoặc chuyển sang chế độ Bán thường để chọn hàng hóa."}
            </p>
          </div>
        </div>
      ) : (
        <>
          {cart.map((item, idx) => {
            const floor1Max = getVariantFloor1Stock(
              item.product,
              item.color,
              item.size
            );
            const pricing = getItemPricing(item);
            const vLabel = formatVariantLabel(item.color, item.size);
            const matchedVar = findVariantByColorSize(
              item.product,
              item.color,
              item.size
            );
            const itemColorHexes = item.color
              ? resolveVariantColorHexes(item.color, matchedVar?.colorHexes)
              : [];
            const lineKey = getCartLineKey(
              item.product._id,
              item.color,
              item.size
            );
            const displayCode =
              resolveVariantCode(
                item.product,
                item.product.code,
                item.color,
                item.size
              ) || item.product.code;
            const isDiscountOpen = expandedDiscountKey === lineKey;

            return (
              <div
                key={lineKey}
                className="bg-white rounded-xl shadow-xs border border-slate-200/90 px-3 py-2 transition hover:border-blue-400"
              >
                {/* Bố cục 1 dòng gọn gàng cho cả Bán nhanh & Bán thường */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5 text-xs sm:text-sm">
                  <span className="w-5 text-center font-bold text-slate-700 shrink-0">
                    {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleChangeQty(
                        item.product._id,
                        0,
                        item.color,
                        item.size
                      )
                    }
                    title="Xóa sản phẩm khỏi đơn"
                    className="text-slate-400 hover:text-red-600 transition shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-xs text-slate-600 w-24 sm:w-28 truncate shrink-0">
                    {displayCode}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap leading-snug">
                      <span className="truncate">{item.product.name}</span>
                      {vLabel && (
                        <span
                          style={
                            itemColorHexes.length > 0
                              ? getColorBoxBorderStyle(
                                  itemColorHexes,
                                  "var(--box-bg, #f8fafc)",
                                  2
                                )
                              : undefined
                          }
                          className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-50 text-slate-900 border border-slate-200 shrink-0"
                        >
                          {itemColorHexes.length > 0 && (
                            <ColorSwatchBadge
                              hexes={itemColorHexes}
                              colorName={item.color}
                              size="xs"
                            />
                          )}
                          <span>{vLabel}</span>
                        </span>
                      )}
                      {item.autoPromoName && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-100 text-brand-ink border border-blue-200 shrink-0">
                          🎉 {item.autoPromoName}
                        </span>
                      )}
                    </div>
                    {item.quantity > getDirectFloor1Stock(item.product) &&
                      (item.product.packSize || 0) > 0 && (
                        <div className="text-[10px] text-amber-700 font-bold mt-0.5">
                          ⚡ Tự tách{" "}
                          {Math.ceil(
                            (item.quantity -
                              getDirectFloor1Stock(item.product)) /
                              (item.product.packSize || 1)
                          )}{" "}
                          {item.product.parentSetUnit || "Bộ"} khi TT
                        </div>
                      )}
                  </div>

                  {/* Cụm Số lượng gọn gàng: [-] [Input gạch chân đỏ] [+] */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        handleChangeQty(
                          item.product._id,
                          item.quantity - 1,
                          item.color,
                          item.size
                        )
                      }
                      className="w-6 h-6 rounded hover:bg-slate-100 text-slate-500 flex items-center justify-center"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={floor1Max}
                      value={item.quantity}
                      onChange={(e) =>
                        handleChangeQty(
                          item.product._id,
                          Math.max(1, Number(e.target.value)),
                          item.color,
                          item.size
                        )
                      }
                      className="w-10 text-center font-mono font-bold text-slate-900 border-b-2 border-red-500 focus:border-blue-600 focus:outline-none py-0.5 bg-transparent"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        handleChangeQty(
                          item.product._id,
                          item.quantity + 1,
                          item.color,
                          item.size
                        )
                      }
                      title="Tăng số lượng (+1)"
                      className="w-6 h-6 rounded hover:bg-slate-100 text-slate-600 flex items-center justify-center"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Đơn giá */}
                  <div className="w-24 sm:w-28 shrink-0 text-right">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={
                        item.discountInputMode === "PRICE" &&
                        item.customPriceText !== undefined
                          ? item.customPriceText
                          : formatNumberDots(pricing.unitPrice)
                      }
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) =>
                        handleChangeItemDesiredPrice(
                          item.product._id,
                          e.target.value,
                          item.color,
                          item.size
                        )
                      }
                      title="Nhập trực tiếp đơn giá muốn bán cho SP này"
                      className="w-full text-right font-mono font-semibold text-slate-800 border-b border-slate-300 focus:border-blue-600 focus:outline-none py-0.5 bg-transparent"
                    />
                    {pricing.discountPerUnit > 0 && (
                      <div className="text-[10px] font-mono text-rose-600">
                        Gốc:{" "}
                        <span className="line-through">
                          {formatNumberDots(pricing.originalUnitPrice)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Thành tiền */}
                  <div className="w-20 sm:w-24 text-right font-mono font-extrabold text-slate-900 shrink-0">
                    {formatNumberDots(pricing.lineTotal)}
                  </div>

                  {/* Nút ⋮ mở tuỳ chọn giảm giá SP */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedDiscountKey((prev) =>
                        prev === lineKey ? null : lineKey
                      )
                    }
                    title="Tùy chọn giảm giá theo % hoặc số tiền cho sản phẩm này"
                    className={`w-7 h-7 rounded-md flex items-center justify-center transition shrink-0 ${
                      isDiscountOpen || pricing.discountAmount > 0
                        ? "bg-blue-50 text-brand-ink"
                        : "hover:bg-slate-100 text-slate-500"
                    }`}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>

                {/* Ngăn kéo chỉnh Giảm giá SP theo % / VND khi bấm vào dấu ⋮ */}
                {isDiscountOpen && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50/80 px-3 py-2 rounded-lg">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Tag className="w-3.5 h-3.5 text-rose-600" />
                      <span className="font-bold text-slate-700">
                        Giảm giá dòng SP:
                      </span>
                      <select
                        value={item.discountType}
                        onChange={(e) => {
                          const val = e.target.value as DiscountType;
                          handleChangeItemDiscount(
                            item.product._id,
                            val,
                            0,
                            item.color,
                            item.size,
                            val as "NONE" | "PERCENT" | "AMOUNT",
                            ""
                          );
                        }}
                        className="px-2 py-1 rounded border border-slate-300 bg-white text-xs font-semibold"
                      >
                        <option value="NONE">Không giảm</option>
                        <option value="PERCENT">Theo %</option>
                        <option value="AMOUNT">Theo số tiền (VND/SP)</option>
                      </select>

                      {item.discountType === "PERCENT" && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={item.discountValue || ""}
                            onChange={(e) =>
                              handleChangeItemDiscount(
                                item.product._id,
                                "PERCENT",
                                Number(e.target.value),
                                item.color,
                                item.size,
                                "PERCENT"
                              )
                            }
                            placeholder="0"
                            className="w-16 px-2 py-1 rounded border border-rose-300 font-mono font-bold text-right text-xs bg-white"
                          />
                          <span className="font-bold text-rose-700">%</span>
                        </div>
                      )}

                      {item.discountType === "AMOUNT" &&
                        item.discountInputMode !== "PRICE" && (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={
                                item.discountValue > 0
                                  ? formatNumberDots(item.discountValue)
                                  : ""
                              }
                              onChange={(e) =>
                                handleChangeItemDiscount(
                                  item.product._id,
                                  "AMOUNT",
                                  parseNumberDots(e.target.value),
                                  item.color,
                                  item.size,
                                  "AMOUNT"
                                )
                              }
                              placeholder="Số tiền giảm"
                              className="w-28 px-2 py-1 rounded border border-rose-300 font-mono font-bold text-right text-xs bg-white"
                            />
                            <span className="font-bold text-rose-700">đ/SP</span>
                          </div>
                        )}
                    </div>

                    {pricing.discountAmount > 0 && (
                      <span className="font-mono font-bold text-rose-600">
                        Đã giảm: −{formatVND(pricing.discountAmount)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Danh sách Hàng tặng kèm (nếu có) */}
          {giftCart.map((gItem, gIdx) => {
            const floor1Max = Math.max(
              0,
              getFloor1Stock(gItem.product) - getCartQty(gItem.product._id)
            );
            return (
              <div
                key={`gift_${gItem.product._id}`}
                className="bg-amber-50/90 rounded-xl shadow-xs border border-amber-200 px-3.5 py-2.5 flex flex-wrap sm:flex-nowrap items-center gap-3 text-xs sm:text-sm"
              >
                <span className="w-5 text-center font-bold text-amber-800 shrink-0">
                  G{gIdx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleChangeGiftQty(gItem.product._id, 0)}
                  className="text-amber-600 hover:text-red-600 transition shrink-0"
                  title="Xóa hàng tặng"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <span className="font-mono text-xs text-amber-900 w-28 sm:w-32 truncate shrink-0">
                  {gItem.product.code}
                </span>
                <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-900">
                    {gItem.product.name}
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                    {gItem.isAutoPromo
                      ? `🎁 ${gItem.promoName || "CTKM"}`
                      : "🎁 Hàng tặng (0đ)"}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      handleChangeGiftQty(
                        gItem.product._id,
                        gItem.quantity - 1
                      )
                    }
                    className="w-6 h-6 rounded hover:bg-amber-100 text-amber-800 flex items-center justify-center"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={floor1Max}
                    value={gItem.quantity}
                    onChange={(e) =>
                      handleChangeGiftQty(
                        gItem.product._id,
                        Math.max(1, Number(e.target.value))
                      )
                    }
                    className="w-12 text-center font-mono font-bold text-amber-950 border-b-2 border-amber-500 bg-transparent py-0.5"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleChangeGiftQty(
                        gItem.product._id,
                        gItem.quantity + 1
                      )
                    }
                    className="w-6 h-6 rounded hover:bg-amber-100 text-amber-800 flex items-center justify-center"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="w-24 text-right font-mono font-extrabold text-amber-700 shrink-0">
                  0
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );

  const renderCheckoutFormContent = (inDrawer: boolean) => (
    <form
      onSubmit={handleCreateOrder}
      className={`flex-1 min-h-0 bg-white flex flex-col justify-between gap-2 ${
        inDrawer
          ? "h-full p-4 sm:p-5 overflow-hidden"
          : "rounded-xl shadow-xs border border-slate-200 p-3.5 sm:p-4 overflow-hidden"
      }`}
    >
      {/* Khối thông tin phía trên của Panel thanh toán (cho phép cuộn nội bộ nếu màn hình nhỏ) */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-3">
        {/* Dòng 1: Tên nhân viên bán hàng & Ngày giờ hiện tại (+ Nút đóng X nếu là Drawer Bán thường) */}
        <div className="flex items-center justify-between gap-2 text-xs text-slate-700 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
            <User className="w-3.5 h-3.5 text-brand-ink" />
            <span>{staffName}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
            <span>{nowClock}</span>
            {inDrawer && (
              <button
                type="button"
                onClick={() => setShowCheckoutDrawer(false)}
                className="ml-1 w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900"
                title="Đóng bảng thanh toán"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Nếu mở trong Drawer (Bán thường): Hiển thị tên khách hàng nổi bật giống ảnh 2 */}
        {inDrawer && (
          <div className="text-sm font-extrabold text-slate-900">
            {customerName.trim()
              ? `${customerName.trim()} ${customerPhone ? `(${customerPhone})` : ""}`
              : "Khách lẻ"}
          </div>
        )}

        {/* Thông báo lỗi / thành công / đang sửa nháp */}
        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-brand-ink text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {editingServerDraftOrder && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="font-extrabold">
                Đang sửa nháp:{" "}
                {editingServerDraftOrder.orderCode ||
                  editingServerDraftOrder.code}
              </span>
            </div>
            <button
              type="button"
              onClick={() => removeDraft(activeDraftId)}
              className="px-2 py-0.5 rounded bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-bold text-[11px] shrink-0"
            >
              Thoát
            </button>
          </div>
        )}

        {/* Ô Tìm khách hàng (SĐT + Tên khách hàng) */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="tel"
              required
              value={customerPhone}
              onChange={(e) => {
                phoneTypedByUserRef.current = true;
                const formatted = formatPhone(e.target.value);
                setCustomerPhone(formatted);
                if (cleanPhoneDigits(formatted).length < 9) {
                  setIsExistingCustomer(false);
                  setCustomerOrders([]);
                  setCustomerDebtSummary(null);
                }
              }}
              placeholder="Tìm khách hàng - Nhập SĐT (F4) *"
              className="w-full h-9 pl-8 pr-8 rounded-lg bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-blue-600 font-mono text-xs sm:text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:outline-none transition"
            />
            <span className="absolute right-2.5 top-2 text-slate-400">
              <Plus className="w-4 h-4" />
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={
                lookingUp
                  ? "Đang tra cứu khách hàng..."
                  : "Họ tên khách hàng *"
              }
              className="w-full h-9 px-3 rounded-lg bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-blue-600 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition"
            />
            {isExistingCustomer && (
              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold bg-blue-100 text-brand-ink px-2 py-1 rounded-full">
                <UserCheck className="w-3 h-3" /> Khách quen (
                {customerOrders.length})
              </span>
            )}
          </div>

          {/* Cảnh báo công nợ của khách (nếu có) */}
          {(() => {
            const unpaidOrders = customerOrders.filter(
              (o) => o.status !== "DRAFT" && (Number(o.debtAmount) || 0) > 0
            );
            const totalDebt =
              customerDebtSummary && customerDebtSummary.totalDebtAmount > 0
                ? customerDebtSummary.totalDebtAmount
                : unpaidOrders.reduce(
                    (sum, o) => sum + (Number(o.debtAmount) || 0),
                    0
                  );
            const unpaidCount =
              customerDebtSummary && customerDebtSummary.unpaidOrdersCount > 0
                ? customerDebtSummary.unpaidOrdersCount
                : unpaidOrders.length;
            if (unpaidCount === 0 || totalDebt <= 0) return null;
            const nowMs = Date.now();
            const overdueCount =
              customerDebtSummary && customerDebtSummary.overdueOrdersCount > 0
                ? customerDebtSummary.overdueOrdersCount
                : unpaidOrders.filter(
                    (o) =>
                      o.debtDueDate &&
                      new Date(o.debtDueDate).getTime() < nowMs
                  ).length;

            return (
              <div
                className={`p-2.5 rounded-lg border space-y-1 text-xs ${
                  overdueCount > 0
                    ? "bg-red-50 border-red-300 text-red-900"
                    : "bg-amber-50 border-amber-300 text-amber-900"
                }`}
              >
                <div className="flex items-center justify-between gap-2 font-extrabold">
                  <span className="flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Nợ {unpaidCount} đơn:
                  </span>
                  <span className="font-mono text-red-600">
                    {formatVND(totalDebt)}
                  </span>
                </div>
                {unpaidOrders.slice(0, 2).map((ord) => (
                  <div
                    key={ord._id}
                    className="flex items-center justify-between text-[11px] bg-white/80 px-2 py-0.5 rounded"
                  >
                    <span className="font-mono font-semibold">
                      {ord.orderCode || ord.code}
                    </span>
                    <span className="font-mono text-red-600">
                      {formatVND(Number(ord.debtAmount) || 0)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenInvoice(ord)}
                      className="text-brand-ink hover:underline font-bold"
                    >
                      Xem
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Lịch sử đơn gần đây của khách */}
          {customerOrders.length > 0 && (
            <div className="pt-1">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mb-1">
                <History className="w-3 h-3 text-brand-ink" />
                Đơn mua gần đây ({customerOrders.length}):
              </div>
              <div className="space-y-1 max-h-20 overflow-y-auto">
                {customerOrders.slice(0, 3).map((ord) => (
                  <div
                    key={ord._id}
                    className="flex items-center justify-between gap-2 text-[11px] bg-slate-50 px-2 py-1 rounded border border-slate-200/80"
                  >
                    <span className="font-mono font-semibold text-slate-800">
                      {ord.orderCode || ord.code}
                    </span>
                    <span className="font-mono font-bold text-brand-ink">
                      {formatVND(ord.totalAmount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenInvoice(ord)}
                      className="text-brand-ink hover:underline font-semibold flex items-center gap-0.5"
                    >
                      <Printer className="w-3 h-3" /> Bill
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ==================== BẢNG TÍNH TIỀN KIOTVIET ==================== */}
        <div className="pt-3 border-t border-slate-100 space-y-3 text-xs sm:text-sm">
          {/* Tổng tiền hàng + Badge tổng số lượng */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-slate-700 font-medium">Tổng tiền hàng</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-800 font-mono text-xs font-bold">
                {totalCartUnits}
              </span>
            </div>
            <span className="font-mono font-black text-base text-slate-900">
              {formatNumberDots(rawSubtotal)}
            </span>
          </div>

          {/* Giảm giá trên từng sản phẩm (nếu có) */}
          {itemDiscountTotal > 0 && (
            <div className="flex items-center justify-between text-xs text-rose-600">
              <span>Giảm giá sản phẩm</span>
              <span className="font-mono font-bold">
                −{formatNumberDots(itemDiscountTotal)}
              </span>
            </div>
          )}

          {/* Dòng Giảm giá Bill */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-700 font-medium">Giảm giá</span>
                <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 text-[11px] font-extrabold">
                  <button
                    type="button"
                    onClick={() => {
                      setBillDiscountType("AMOUNT");
                      setBillDiscountInputMode("AMOUNT");
                      setBillCustomPriceText("");
                      setIsManualBillDiscount(true);
                    }}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      billDiscountInputMode !== "PERCENT" &&
                      billDiscountInputMode !== "PRICE" &&
                      billDiscountType !== "PERCENT"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    }`}
                  >
                    VND
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBillDiscountType("PERCENT");
                      setBillDiscountValue(0);
                      setBillDiscountInputMode("PERCENT");
                      setBillCustomPriceText("");
                      setIsManualBillDiscount(true);
                    }}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      billDiscountInputMode === "PERCENT" ||
                      (billDiscountType === "PERCENT" &&
                        billDiscountInputMode !== "PRICE")
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    }`}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBillDiscountType("AMOUNT");
                      setBillDiscountValue(0);
                      setBillDiscountInputMode("PRICE");
                      setBillCustomPriceText(
                        subtotal > 0 ? formatNumberDots(subtotal) : ""
                      );
                      setTimeout(() => {
                        billPriceInputRef.current?.focus();
                        billPriceInputRef.current?.select();
                      }, 0);
                    }}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                      billDiscountInputMode === "PRICE"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    }`}
                    title="Nhập tổng tiền muốn thu của khách"
                  >
                    Giá bán
                  </button>
                </div>
              </div>

              {billDiscountInputMode === "PERCENT" ||
              (billDiscountType === "PERCENT" &&
                billDiscountInputMode !== "PRICE") ? (
                <div className="relative w-36">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={billDiscountValue || ""}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                      setIsManualBillDiscount(true);
                      setBillDiscountType("PERCENT");
                      setBillDiscountInputMode("PERCENT");
                      setBillDiscountValue(
                        Math.min(100, Math.max(0, Number(e.target.value)))
                      );
                    }}
                    placeholder="0"
                    className="w-full pr-7 pl-2.5 py-1 rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-500 text-right font-mono font-bold text-slate-900 text-xs sm:text-sm bg-white focus:outline-none"
                  />
                  <span className="absolute right-2.5 top-1.5 text-xs font-bold text-slate-500 pointer-events-none">
                    %
                  </span>
                </div>
              ) : billDiscountInputMode === "PRICE" ? (
                <div className="relative w-36">
                  <input
                    ref={billPriceInputRef}
                    type="text"
                    inputMode="numeric"
                    value={billCustomPriceText}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^\d]/g, "");
                      if (!digits) {
                        setBillDiscountType("NONE");
                        setBillDiscountInputMode("PRICE");
                        setBillCustomPriceText("");
                        setBillDiscountValue(0);
                        setIsManualBillDiscount(false);
                        return;
                      }
                      const enteredPrice = Math.min(
                        subtotal,
                        Math.max(0, Number(digits) || 0)
                      );
                      const computedDiscount = Math.max(
                        0,
                        subtotal - enteredPrice
                      );
                      setIsManualBillDiscount(true);
                      setBillDiscountType(
                        computedDiscount > 0 ? "AMOUNT" : "NONE"
                      );
                      setBillDiscountInputMode("PRICE");
                      setBillCustomPriceText(formatNumberDots(enteredPrice));
                      setBillDiscountValue(computedDiscount);
                    }}
                    placeholder="Nhập giá thu"
                    className="w-full px-2.5 py-1 rounded-lg border border-blue-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-500 text-right font-mono font-bold text-brand-ink text-xs sm:text-sm bg-blue-50/40 focus:outline-none"
                  />
                </div>
              ) : (
                <div className="relative w-36">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={
                      billDiscountAmount > 0
                        ? formatNumberDots(billDiscountAmount)
                        : ""
                    }
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                      const val = parseNumberDots(e.target.value);
                      setIsManualBillDiscount(val > 0);
                      setBillDiscountType(val > 0 ? "AMOUNT" : "NONE");
                      setBillDiscountInputMode(val > 0 ? "AMOUNT" : "NONE");
                      setBillCustomPriceText("");
                      setBillDiscountValue(val);
                    }}
                    placeholder="0"
                    className="w-full px-2.5 py-1 rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-500 text-right font-mono font-bold text-slate-900 text-xs sm:text-sm bg-white focus:outline-none"
                  />
                </div>
              )}
            </div>

            {billDiscountAmount > 0 && (
              <div className="flex items-center justify-end text-[11px] font-mono font-bold text-rose-600">
                Đã giảm: −{formatNumberDots(billDiscountAmount)} đ
              </div>
            )}
          </div>

          {/* Phí quẹt thẻ (nếu chọn Quẹt Thẻ) */}
          {paymentMethod === "CARD" && (
            <div className="flex items-center justify-between text-xs text-amber-700">
              <span>Phí quẹt thẻ ({cardFeePercent}%)</span>
              <span className="font-mono font-bold">
                +{formatNumberDots(cardFee)}
              </span>
            </div>
          )}

          {/* KHÁCH CẦN TRẢ (Số liệu đen bự dễ đọc) */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="font-extrabold text-sm text-slate-900">Khách cần trả</span>
            <span className="font-mono font-black text-2xl text-slate-900">
              {formatNumberDots(totalAmount)}
            </span>
          </div>
        </div>

        {/* ==================== PHƯƠNG THỨC THANH TOÁN (RADIO STYLE GIỐNG ẢNH 2) ==================== */}
        <div className="pt-2 border-t border-slate-100 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 py-1">
            {[
              { id: "CASH", label: "Tiền mặt" },
              { id: "BANKING", label: "Chuyển khoản" },
              { id: "CARD", label: "Thẻ" },
              { id: "OTHER", label: "Khác / Nợ" },
            ].map((pm) => {
              const active = paymentMethod === pm.id;
              return (
                <label
                  key={pm.id}
                  onClick={() => setPaymentMethod(pm.id as PaymentMethodType)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 cursor-pointer select-none"
                >
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition ${
                      active
                        ? "border-blue-600 bg-blue-600"
                        : "border-slate-400 bg-white"
                    }`}
                  >
                    {active && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  <span>{pm.label}</span>
                </label>
              );
            })}
          </div>

          {/* Tùy chọn phí quẹt thẻ (BR-12) */}
          {paymentMethod === "CARD" && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 space-y-1.5 text-xs">
              <div className="font-bold text-amber-900">Mức phí quẹt thẻ:</div>
              <div className="grid grid-cols-2 gap-1.5">
                <label
                  className={`flex items-center gap-1.5 p-1.5 rounded border cursor-pointer text-[11px] font-semibold ${
                    cardFeePercent !== 4
                      ? "border-amber-600 bg-white text-amber-900"
                      : "border-amber-200 text-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    checked={cardFeePercent !== 4}
                    onChange={() => {
                      setHasCardFee(true);
                      setCardFeePercent(1.8);
                    }}
                  />
                  Khách Việt 1.8%
                </label>
                <label
                  className={`flex items-center gap-1.5 p-1.5 rounded border cursor-pointer text-[11px] font-semibold ${
                    cardFeePercent === 4
                      ? "border-amber-600 bg-white text-amber-900"
                      : "border-amber-200 text-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    checked={cardFeePercent === 4}
                    onChange={() => {
                      setHasCardFee(true);
                      setCardFeePercent(4);
                    }}
                  />
                  Nước ngoài 4%
                </label>
              </div>
            </div>
          )}

          {/* Tách thanh toán nhiều phương thức / Ghi công nợ */}
          {paymentMethod === "OTHER" &&
            (() => {
              const selectedMethods = splitPayments.map((s) => s.method);
              const remainingOptions = SPLIT_METHOD_OPTIONS.filter(
                (opt) => !selectedMethods.includes(opt.value)
              );
              const hasDebtOption = selectedMethods.includes("DEBT");

              const addDaysToInputDate = (days: number) => {
                const d = new Date();
                d.setDate(d.getDate() + days);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, "0");
                const dd = String(d.getDate()).padStart(2, "0");
                return `${yyyy}-${mm}-${dd}`;
              };

              return (
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {splitPayments.map((sp) => {
                        const label =
                          SPLIT_METHOD_OPTIONS.find(
                            (o) => o.value === sp.method
                          )?.label || sp.method;
                        const isDebt = sp.method === "DEBT";
                        return (
                          <div
                            key={sp.method}
                            className={`h-7 px-2.5 rounded-md text-white text-[11px] font-bold flex items-center gap-1.5 ${
                              isDebt ? "bg-amber-600" : "bg-blue-600"
                            }`}
                          >
                            <span>{label}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setSplitPayments((prev) =>
                                  prev.filter(
                                    (item) => item.method !== sp.method
                                  )
                                );
                              }}
                              className="w-3.5 h-3.5 rounded-full flex items-center justify-center bg-black/20 hover:bg-black/40"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        );
                      })}

                      {remainingOptions.length > 0 && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setShowSplitDropdown((prev) => !prev)
                            }
                            className="h-7 px-2.5 rounded-md border border-dashed border-blue-600 bg-white text-brand-ink font-extrabold text-xs flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          {showSplitDropdown && (
                            <div className="absolute left-0 top-8 z-20 w-48 rounded-xl bg-white border border-slate-200 shadow-lg py-1 overflow-hidden">
                              {remainingOptions.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => {
                                    setSplitPayments((prev) => {
                                      if (opt.value === "DEBT") {
                                        const nonDebtSum = prev
                                          .filter(
                                            (item) => item.method !== "DEBT"
                                          )
                                          .reduce(
                                            (sum, item) =>
                                              sum + (Number(item.amount) || 0),
                                            0
                                          );
                                        const remaining = Math.max(
                                          0,
                                          totalAmount - nonDebtSum
                                        );
                                        return [
                                          ...prev,
                                          {
                                            method: opt.value,
                                            amount: remaining,
                                          },
                                        ];
                                      }
                                      return [
                                        ...prev,
                                        { method: opt.value, amount: 0 },
                                      ];
                                    });
                                    setShowSplitDropdown(false);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-xs font-bold flex items-center justify-between hover:bg-blue-50 text-slate-700"
                                >
                                  <span>{opt.label}</span>
                                  <Plus className="w-3.5 h-3.5 text-brand-ink" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {!hasDebtOption && (
                      <button
                        type="button"
                        onClick={() => {
                          setSplitPayments((prev) => {
                            const nonDebtSum = prev
                              .filter((item) => item.method !== "DEBT")
                              .reduce(
                                (sum, item) => sum + (Number(item.amount) || 0),
                                0
                              );
                            const remaining = Math.max(
                              0,
                              totalAmount - nonDebtSum
                            );
                            return [
                              ...prev,
                              { method: "DEBT", amount: remaining },
                            ];
                          });
                        }}
                        className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[10px] font-extrabold"
                      >
                        + Công nợ
                      </button>
                    )}
                  </div>

                  {splitPayments.length > 0 && (
                    <div className="space-y-1.5 pt-1.5 border-t border-slate-200/80">
                      {splitPayments.map((sp) => {
                        const label =
                          SPLIT_METHOD_OPTIONS.find(
                            (o) => o.value === sp.method
                          )?.label || sp.method;
                        const isDebt = sp.method === "DEBT";
                        return (
                          <div
                            key={sp.method}
                            className="flex items-center justify-between gap-2"
                          >
                            <span
                              className={`text-[11px] font-bold w-24 shrink-0 ${
                                isDebt ? "text-amber-800" : "text-slate-700"
                              }`}
                            >
                              {label}:
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={
                                sp.amount > 0 ? formatNumberDots(sp.amount) : ""
                              }
                              onChange={(e) => {
                                const val = parseNumberDots(e.target.value);
                                setSplitPayments((prev) => {
                                  const next = prev.map((item) =>
                                    item.method === sp.method
                                      ? { ...item, amount: val }
                                      : item
                                  );
                                  if (
                                    sp.method !== "DEBT" &&
                                    next.some((i) => i.method === "DEBT")
                                  ) {
                                    const nonDebtSum = next
                                      .filter((i) => i.method !== "DEBT")
                                      .reduce(
                                        (sum, i) =>
                                          sum + (Number(i.amount) || 0),
                                        0
                                      );
                                    const autoDebt = Math.max(
                                      0,
                                      totalAmount - nonDebtSum
                                    );
                                    return next.map((i) =>
                                      i.method === "DEBT"
                                        ? { ...i, amount: autoDebt }
                                        : i
                                    );
                                  }
                                  return next;
                                });
                              }}
                              placeholder="0"
                              className="flex-1 px-2.5 py-1 rounded border border-slate-300 bg-white font-mono font-bold text-right text-xs"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {hasDebtOption && (
                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 space-y-1.5 text-[11px]">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="font-bold text-amber-900">
                          Hẹn trả nợ:
                        </span>
                        <div className="flex gap-1">
                          {[3, 7, 14, 30].map((days) => (
                            <button
                              key={days}
                              type="button"
                              onClick={() =>
                                setDebtDueDate(addDaysToInputDate(days))
                              }
                              className="px-1.5 py-0.5 rounded bg-white border border-amber-300 text-[10px] font-bold text-amber-900"
                            >
                              +{days}N
                            </button>
                          ))}
                        </div>
                      </div>
                      <input
                        type="date"
                        value={debtDueDate}
                        onChange={(e) => setDebtDueDate(e.target.value)}
                        className="w-full px-2 py-1 rounded border border-amber-300 bg-white font-mono text-xs"
                      />
                    </div>
                  )}
                </div>
              );
            })()}
        </div>
      </div>

      {/* Khối nút bấm dưới đáy Panel phải: THANH TOÁN (Nút xanh lá lớn chủ đạo) & LƯU NHÁP */}
      <div className="space-y-2 pt-2">
        <button
          type="submit"
          disabled={submitting || (cart.length === 0 && giftCart.length === 0)}
          className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-extrabold text-base tracking-wide uppercase flex items-center justify-center gap-2 shadow-md transition"
        >
          {submitting ? "Đang xử lý..." : "THANH TOÁN"}
        </button>

        <button
          type="button"
          disabled={
            submitting ||
            savingDraft ||
            (cart.length === 0 && giftCart.length === 0)
          }
          onClick={handleSaveOrderAsDraft}
          className="w-full py-2 px-3 rounded-lg bg-slate-100 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300 disabled:opacity-50 text-slate-700 border border-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition"
        >
          <Save className="w-3.5 h-3.5" />
          {savingDraft
            ? "Đang lưu nháp..."
            : editingServerDraftOrder
              ? `Cập nhật nháp ${editingServerDraftOrder.orderCode || editingServerDraftOrder.code}`
              : "Lưu hóa đơn nháp"}
        </button>
      </div>
    </form>
  );

  return (
    <div>
      {posMode === "SERVICES" ? (
        <div className="space-y-3">
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPosMode("PRODUCTS")}
                className="px-4 py-2 rounded-lg text-xs sm:text-sm font-extrabold flex items-center gap-2 bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-brand-ink transition"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>← Quay lại Bán sản phẩm (POS)</span>
              </button>
              <button
                type="button"
                onClick={() => setPosMode("SERVICES")}
                className="px-4 py-2 rounded-lg text-xs sm:text-sm font-extrabold flex items-center gap-2 bg-blue-600 text-white shadow-xs transition"
              >
                <Wrench className="w-4 h-4" />
                <span>Làm dịch vụ (Nhận đồ & Hẹn trả)</span>
                {serviceMeta &&
                  serviceMeta.receivedCount +
                    serviceMeta.inProgressCount +
                    serviceMeta.readyCount >
                    0 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-white/20 text-white">
                      {serviceMeta.receivedCount +
                        serviceMeta.inProgressCount +
                        serviceMeta.readyCount}{" "}
                      đơn chờ
                    </span>
                  )}
                {serviceMeta && serviceMeta.overdueCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-600 text-white">
                    ⚠️ {serviceMeta.overdueCount} quá hạn
                  </span>
                )}
              </button>
            </div>
            <div className="text-xs text-slate-500 hidden md:block pr-2">
              Nhận đồ khách gửi làm dịch vụ (đan vợt, hàn vợt, vệ sinh...) • Hẹn ngày trả & theo dõi tiến độ
            </div>
          </div>
          <PosServiceSection onMetaChange={setServiceMeta} />
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-[#ebedf0] flex flex-col lg:h-[calc(100dvh-90px)] lg:max-h-[calc(100dvh-90px)] min-h-[540px]">
          {/* ==================== THANH HEADER XANH LÁ CHỦ ĐẠO (11 SPORT) ==================== */}
          <div className="bg-blue-600 text-white px-3 pt-2 pb-0 flex flex-wrap items-center justify-between gap-2 select-none shrink-0">
            {/* Bên trái: Ô tìm kiếm hàng hóa + Nút máy quét mã vạch + Các Tab Hóa đơn */}
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              {/* Ô tìm kiếm hàng hóa có Dropdown chọn nhanh */}
              <div ref={searchBoxRef} className="relative w-full sm:w-80 md:w-96 pb-2">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onFocus={() => setShowSearchDropdown(true)}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowSearchDropdown(true);
                    setCatalogPage(1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && search.trim()) {
                      e.preventDefault();
                      handleBarcodeScanForPos(search.trim());
                      setSearch("");
                      setShowSearchDropdown(false);
                    } else if (e.key === "Escape") {
                      setShowSearchDropdown(false);
                    }
                  }}
                  placeholder="Tìm hàng hóa (F3)"
                  className="w-full h-9 pl-9 pr-8 rounded-md bg-white text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-300 shadow-xs"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setShowSearchDropdown(false);
                    }}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* Dropdown gợi ý sản phẩm Kho Tầng 1 */}
                {showSearchDropdown && search.trim().length > 0 && (
                  <div className="pos-search-dropdown absolute left-0 right-0 top-10 z-50 bg-white dark:!bg-[#2D2D2D] text-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:!border-[#505050] max-h-96 overflow-y-auto divide-y divide-slate-100">
                    {filteredAndSortedProducts.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        Không tìm thấy sản phẩm &ldquo;{search}&rdquo; trong Kho Tầng 1.
                      </div>
                    ) : (
                      filteredAndSortedProducts.slice(0, 12).map((p) => {
                        const floor1Stock = getFloor1Stock(p);
                        const namedVars = (p.variants || []).filter(
                          (v) => v.color || v.size
                        );
                        const canSell = floor1Stock > 0;
                        return (
                          <div
                            key={p._id}
                            onClick={() => {
                              if (!canSell) return;
                              handleSelectProductForPos(p);
                              setShowSearchDropdown(false);
                            }}
                            className={`px-3.5 py-2.5 flex items-center justify-between gap-3 transition ${
                              canSell
                                ? "hover:bg-blue-50 cursor-pointer"
                                : "opacity-50 cursor-not-allowed bg-slate-50"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                {p.name}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                <span className="font-mono font-semibold text-brand-ink">
                                  {p.code}
                                </span>
                                <span>•</span>
                                <span>
                                  Tồn T1: {floor1Stock} {p.unit}
                                </span>
                                {namedVars.length > 0 && (() => {
                                  const byCol = new Map<string, { stock: number; hexes?: string[] }>();
                                  for (const v of namedVars) {
                                    const ck = (v.color || "").trim() || "Mặc định";
                                    const cur = byCol.get(ck) || { stock: 0, hexes: v.colorHexes };
                                    cur.stock += Math.max(0, Number(v.stockFloor1 ?? v.stock) || 0);
                                    if (!cur.hexes && Array.isArray(v.colorHexes) && v.colorHexes.length > 0) {
                                      cur.hexes = v.colorHexes;
                                    }
                                    byCol.set(ck, cur);
                                  }
                                  return Array.from(byCol.entries())
                                    .slice(0, 3)
                                    .map(([cLabel, info]) => {
                                      const cHexes = resolveVariantColorHexes(cLabel, info.hexes);
                                      return (
                                        <span
                                          key={cLabel}
                                          style={getColorBoxBorderStyle(cHexes, "var(--box-bg, #f8fafc)", 2)}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 text-slate-800 font-bold text-[10px] border border-slate-200"
                                        >
                                          <ColorSwatchBadge hexes={cHexes} colorName={cLabel} size="xs" />
                                          <span>{cLabel}:</span>
                                          <span className="font-mono text-brand-ink">({info.stock})</span>
                                        </span>
                                      );
                                    });
                                })()}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-mono font-extrabold text-xs sm:text-sm text-brand-ink">
                                {(() => {
                                  const dp = productDisplayPrice(p);
                                  return dp.minPrice > 0 && dp.maxPrice > dp.minPrice
                                    ? `${formatNumberDots(dp.minPrice)} – ${formatNumberDots(dp.maxPrice)}`
                                    : formatNumberDots(dp.price || p.sellingPrice);
                                })()}
                              </div>
                              <div className="text-[10px] text-brand-ink font-bold">
                                {namedVars.length > 1
                                  ? "Chọn Size/Màu"
                                  : "+ Thêm vào đơn"}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Nút bật/tắt chế độ Máy quét mã vạch `[|||]` */}
              <div className="pb-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setScannerEnabled((prev) => !prev)}
                  title={
                    scannerEnabled
                      ? "Máy quét mã vạch ĐANG BẬT (Bấm để tạm tắt)"
                      : "Máy quét mã vạch ĐANG TẮT (Bấm để bật)"
                  }
                  className={`h-9 px-2.5 rounded-md flex items-center gap-1.5 text-xs font-bold transition border ${
                    scannerEnabled
                      ? "bg-white/15 border-white/40 text-white hover:bg-white/25"
                      : "bg-slate-900/40 border-white/10 text-white/60 hover:bg-white/15"
                  }`}
                >
                  <ScanLine className="w-4 h-4" />
                </button>
              </div>

              {/* Danh sách Tab Hóa đơn (Hóa đơn 1, Hóa đơn 2...) */}
              <div className="flex items-end gap-1 overflow-x-auto max-w-full pt-1">
                {liveDrafts.map((d) => {
                  const isActive = d.id === activeDraftId;
                  const qty =
                    d.cart.reduce((s, i) => s + i.quantity, 0) +
                    d.giftCart.reduce((s, g) => s + g.quantity, 0);
                  return (
                    <div
                      key={d.id}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => handleSwitchDraft(d.id)}
                      title={
                        submitting
                          ? "Đang tạo đơn, vui lòng chờ..."
                          : `Chuyển sang Hóa đơn ${d.seq}`
                      }
                      className={`group flex items-center gap-2 pl-3 pr-2 py-2 rounded-t-lg text-xs font-extrabold transition shrink-0 ${
                        isActive
                          ? "bg-[#ebedf0] text-slate-900 shadow-xs"
                          : "bg-blue-700 text-white/90 hover:bg-blue-800"
                      } ${
                        submitting && !isActive
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer"
                      }`}
                    >
                      <ArrowUpDown className="w-3 h-3 opacity-75" />
                      <span>Hóa đơn {d.seq}</span>
                      {qty > 0 && (
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                            isActive
                              ? "bg-blue-600 text-white"
                              : "bg-white/20 text-white"
                          }`}
                        >
                          {qty}
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseDraft(d.id);
                        }}
                        title={`Đóng Hóa đơn ${d.seq}`}
                        className={`p-0.5 rounded-full transition ${
                          isActive
                            ? "text-slate-500 hover:bg-slate-300 hover:text-slate-900"
                            : "text-white/70 hover:bg-white/20 hover:text-white"
                        }`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={handleAddDraft}
                  disabled={submitting || liveDrafts.length >= MAX_DRAFTS}
                  title="Tạo thêm hóa đơn mới"
                  className="mb-1.5 ml-1 w-7 h-7 rounded-full border border-white/40 hover:bg-white/20 flex items-center justify-center text-white disabled:opacity-40 transition shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Thông báo quét mã vạch gần nhất (nếu có) */}
          {lastScanBanner && (
            <div
              className={`mx-3 mt-2 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between gap-2 border ${
                lastScanBanner.type === "success"
                  ? "bg-blue-50 border-blue-300 text-blue-900"
                  : lastScanBanner.type === "warning"
                    ? "bg-amber-50 border-amber-300 text-amber-900"
                    : "bg-red-50 border-red-300 text-red-900"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {lastScanBanner.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-brand-ink shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span className="truncate">{lastScanBanner.message}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-mono opacity-75">
                  {lastScanBanner.time}
                </span>
                <button
                  type="button"
                  onClick={() => setLastScanBanner(null)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ==================== VÙNG NỘI DUNG CHÍNH ==================== */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 p-2.5 sm:p-3 min-h-0 overflow-hidden">
            {/* ==================== CỘT TRÁI: GIỎ HÀNG (7 CỘT Ở BÁN THƯỜNG, 8 CỘT Ở BÁN NHANH) ==================== */}
            <div
              className={`${
                posSubView === "CATALOG" ? "lg:col-span-7" : "lg:col-span-8"
              } flex flex-col justify-between gap-2.5 min-h-0 overflow-hidden`}
            >
              <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
                {/* Banner Chương trình khuyến mãi tự động áp dụng */}
                {appliedPromosSummary.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-extrabold text-blue-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-brand-ink shrink-0" />
                      <span>
                        🎉 Khuyến mãi tự động ({appliedPromosSummary.length}):
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {appliedPromosSummary.map((ap) => (
                        <span
                          key={ap._id}
                          className="text-[11px] bg-white px-2 py-0.5 rounded-md border border-blue-200 font-bold text-brand-ink"
                        >
                          {ap.name}
                          {ap.multiplier > 1 ? ` (×${ap.multiplier})` : ""}:{" "}
                          {ap.details.join(" · ")}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ở cả Bán nhanh (FAST) và Bán thường (CATALOG), cột trái đều hiển thị danh sách sản phẩm trong đơn */}
                {(posSubView === "FAST" || posSubView === "CATALOG") &&
                  renderCartList()}

                {/* CHẾ ĐỘ 3: DANH SÁCH HÓA ĐƠN NHÁP ĐÃ LƯU TRÊN HỆ THỐNG */}
                {posSubView === "DRAFTS" && (
                  <div className="flex-1 bg-white rounded-xl shadow-xs border border-amber-200 p-3.5 space-y-3 overflow-y-auto">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-600" />
                        <h3 className="text-xs sm:text-sm font-extrabold uppercase text-slate-900">
                          Hóa đơn nháp đã lưu trên hệ thống (
                          {savedDraftOrders.length})
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPosSubView("FAST")}
                        className="text-xs font-bold text-brand-ink hover:underline"
                      >
                        ← Quay lại giỏ hàng
                      </button>
                    </div>

                    {loadingSavedDrafts ? (
                      <div className="py-8 text-center text-xs text-slate-500">
                        Đang tải danh sách bản nháp...
                      </div>
                    ) : savedDraftOrders.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                        Chưa có hóa đơn nháp nào được lưu.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {savedDraftOrders.map((ord) => {
                          const code = ord.orderCode || ord.code || "";
                          const isBeingEdited =
                            editingServerDraftOrder?._id === ord._id ||
                            liveDrafts.some(
                              (d) => d.editingServerDraftOrder?._id === ord._id
                            );
                          const totalQty = (ord.items || []).reduce(
                            (s, it) => s + (Number(it.quantity) || 0),
                            0
                          );
                          return (
                            <div
                              key={ord._id}
                              className={`p-3 rounded-xl border text-xs space-y-2 transition ${
                                isBeingEdited
                                  ? "border-amber-500 bg-amber-50/70"
                                  : "border-slate-200 bg-slate-50/70 hover:border-amber-300"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-extrabold text-slate-900">
                                    {code}
                                  </span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                                    NHÁP
                                  </span>
                                </div>
                                <span className="font-mono font-extrabold text-brand-ink text-sm">
                                  {formatVND(ord.totalAmount)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600">
                                <span>
                                  Khách:{" "}
                                  <strong className="text-slate-800">
                                    {ord.customerName || "Khách lẻ"}
                                  </strong>{" "}
                                  {ord.customerPhone
                                    ? `(${formatPhone(ord.customerPhone)})`
                                    : ""}
                                </span>
                                <span>
                                  {totalQty} SP · {formatDateTime(ord.createdAt)}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-200/80">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleLoadServerDraftToPos(ord);
                                    setPosSubView("FAST");
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 font-bold text-[11px] transition"
                                >
                                  ✏️ Mở sửa trên POS
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleQuickConfirmServerDraft(ord)
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition"
                                >
                                  ✓ Chốt TT
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onOpenInvoice(ord)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[11px] flex items-center gap-1 transition"
                                >
                                  <Printer className="w-3 h-3" /> Bill nháp
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteServerDraft(ord)}
                                  className="ml-auto px-2 py-1 rounded-lg text-red-600 hover:bg-red-50 font-bold text-[11px] flex items-center gap-1 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Xóa
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Thanh Ghi chú đơn hàng + Nút Tặng SP dưới đáy cột trái */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-200 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
                <div className="flex items-center gap-2.5 flex-1 min-w-[160px]">
                  <Pencil className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ghi chú đơn hàng"
                    className="w-full text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none bg-transparent"
                  />
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setGiftSearch("");
                      setGiftCategoryId("");
                      setShowGiftModal(true);
                    }}
                    title="Chọn sản phẩm tặng kèm (0đ)"
                    className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Gift className="w-3.5 h-3.5 text-amber-600" />
                    <span>+ Tặng SP</span>
                    {giftUnitsCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-mono text-[10px] font-extrabold">
                        {giftUnitsCount}
                      </span>
                    )}
                  </button>

                  {posSubView === "CATALOG" && (
                    <div className="flex items-center gap-4 text-xs sm:text-sm shrink-0 pl-3 border-l border-slate-200">
                      <span className="text-slate-700 font-medium">
                        Tổng tiền hàng
                      </span>
                      <span className="font-mono font-bold text-slate-800">
                        {totalCartUnits}
                      </span>
                      <span className="font-mono font-extrabold text-slate-900 text-sm sm:text-base">
                        {formatNumberDots(subtotal)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ==================== CỘT PHẢI: TÙY THEO CHẾ ĐỘ BÁN NHANH HAY BÁN THƯỜNG ==================== */}
            {posSubView === "CATALOG" ? (
              /* CHẾ ĐỘ BÁN THƯỜNG (GIỐNG ẢNH 1): Cột phải (5 cột) là Lưới chọn sản phẩm nhanh + Phân trang + Nút THANH TOÁN mở Drawer */
              <div className="lg:col-span-5 bg-white rounded-xl shadow-xs border border-slate-200 p-3.5 flex flex-col justify-between gap-2.5 min-h-0 overflow-hidden">
                {/* Thanh trên cùng của cột phải Bán thường: Tìm khách hàng (F4) + Các nút Lọc Danh mục / Chế độ hiển thị */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => {
                          phoneTypedByUserRef.current = true;
                          const formatted = formatPhone(e.target.value);
                          setCustomerPhone(formatted);
                          if (cleanPhoneDigits(formatted).length < 9) {
                            setIsExistingCustomer(false);
                            setCustomerOrders([]);
                            setCustomerDebtSummary(null);
                          }
                        }}
                        placeholder="Tìm khách hàng (F4)"
                        className="w-full h-9 pl-8 pr-8 rounded-lg bg-slate-100 hover:bg-slate-200/70 focus:bg-white border border-transparent focus:border-blue-600 font-mono text-xs sm:text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCheckoutDrawer(true)}
                        title="Nhập chi tiết tên khách hàng & thanh toán"
                        className="absolute right-2 top-2 text-slate-500 hover:text-brand-ink"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Cụm 3 icon chuẩn KiotViet: Đổi chế độ hiển thị, Lọc Danh mục, Sắp xếp */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setCatalogViewMode((prev) =>
                            prev === "COMPACT" ? "DETAILED" : "COMPACT"
                          );
                          setCatalogPage(1);
                        }}
                        title={
                          catalogViewMode === "COMPACT"
                            ? "Đang ở chế độ Lưới 3 cột chuẩn KiotViet (Bấm để xem thẻ chi tiết)"
                            : "Đang ở chế độ Thẻ chi tiết (Bấm để về lưới gọn 3 cột)"
                        }
                        className={`w-9 h-9 rounded-lg flex items-center justify-center border transition ${
                          catalogViewMode === "DETAILED"
                            ? "bg-blue-50 border-blue-300 text-brand-ink"
                            : "border-transparent hover:bg-slate-100 text-slate-600"
                        }`}
                      >
                        <List className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setShowCategoryFilterPopover((prev) => !prev)
                        }
                        title="Lọc theo Danh mục hàng hóa"
                        className={`w-9 h-9 rounded-lg flex items-center justify-center border transition ${
                          selectedCategoryId || showCategoryFilterPopover
                            ? "bg-blue-50 border-blue-300 text-brand-ink"
                            : "border-transparent hover:bg-slate-100 text-slate-600"
                        }`}
                      >
                        <Filter className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSortBy((prev) =>
                            prev === "NAME_ASC"
                              ? "PRICE_ASC"
                              : prev === "PRICE_ASC"
                                ? "STOCK_DESC"
                                : "NAME_ASC"
                          );
                          setCatalogPage(1);
                        }}
                        title="Đổi cách sắp xếp sản phẩm"
                        className="w-9 h-9 rounded-lg flex items-center justify-center border border-transparent hover:bg-slate-100 text-slate-600 transition"
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Nếu đã nhập SĐT khách hoặc có tên khách -> hiển thị dòng tên khách nhỏ gọn */}
                  {(customerPhone || customerName) && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder={
                          lookingUp
                            ? "Đang tìm khách..."
                            : "Nhập họ tên khách hàng *"
                        }
                        className="flex-1 h-8 px-2.5 rounded-md bg-blue-50/60 border border-blue-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                      {isExistingCustomer && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-brand-ink shrink-0">
                          Khách quen ({customerOrders.length})
                        </span>
                      )}
                    </div>
                  )}

                  {/* Thanh chọn nhanh Danh mục (mở khi bấm nút Filter hoặc đang chọn danh mục) */}
                  {(showCategoryFilterPopover || selectedCategoryId !== "") && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 pb-1.5 border-b border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategoryId("");
                          setCatalogPage(1);
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition border ${
                          selectedCategoryId === ""
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        Tất cả ({floor1Products.length})
                      </button>
                      {categories.map((cat) => {
                        const count = floor1Products.filter(
                          (p) => getCategoryId(p) === cat._id
                        ).length;
                        return (
                          <button
                            key={cat._id}
                            type="button"
                            onClick={() => {
                              setSelectedCategoryId(cat._id);
                              setCatalogPage(1);
                            }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition border ${
                              selectedCategoryId === cat._id
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-blue-50"
                            }`}
                          >
                            {cat.name} ({count})
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Lưới sản phẩm bên phải (3 cột gọn gàng chuẩn ảnh 1 hoặc thẻ chi tiết) */}
                <div className="flex-1 min-h-0 overflow-y-auto py-1">
                  {loadingProducts ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      Đang tải danh mục hàng hóa...
                    </div>
                  ) : paginatedCatalogProducts.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      Không tìm thấy sản phẩm phù hợp.
                    </div>
                  ) : catalogViewMode === "COMPACT" ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {paginatedCatalogProducts.map((p) => {
                        const floor1Stock = getFloor1Stock(p);
                        const displayPrice = productDisplayPrice(p);
                        const canSell =
                          displayPrice.price > 0 && floor1Stock > 0;
                        const inCartQty = getCartQty(p._id);
                        const namedVars = (p.variants || []).filter(
                          (v) => v.color || v.size
                        );

                        return (
                          <button
                            key={p._id}
                            type="button"
                            disabled={!canSell}
                            onClick={() =>
                              canSell && handleSelectProductForPos(p)
                            }
                            title={`${p.name} (${p.code}) • Tồn Tầng 1: ${floor1Stock} ${p.unit}`}
                            className={`group text-left p-2.5 rounded-xl border transition flex flex-col gap-1.5 relative ${
                              inCartQty > 0
                                ? "border-blue-500 bg-blue-50/40 shadow-xs"
                                : canSell
                                  ? "border-slate-200 hover:border-blue-400 hover:shadow-xs bg-white"
                                  : "border-slate-200 opacity-50 cursor-not-allowed bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              {/* Thumbnail / Icon đại diện */}
                              <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200/80 flex flex-col items-center justify-center shrink-0 text-brand-ink font-mono font-extrabold text-[10px] overflow-hidden">
                                <Package className="w-4 h-4 text-brand-ink mb-0.5" />
                                <span className="text-[9px] text-slate-500">
                                  SL:{floor1Stock}
                                </span>
                              </div>

                              {/* Tên SP + Giá bán màu xanh lá */}
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold text-slate-900 line-clamp-2 leading-snug">
                                  {p.name}
                                </div>
                                <div className="font-mono font-extrabold text-xs text-brand-ink mt-0.5 flex items-center gap-1">
                                  <span>
                                    {displayPrice.minPrice > 0 && displayPrice.maxPrice > displayPrice.minPrice
                                      ? `${formatNumberDots(displayPrice.minPrice)} – ${formatNumberDots(displayPrice.maxPrice)}`
                                      : formatNumberDots(displayPrice.price)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Hiển thị các hộp label màu sắc có border theo đúng màu cấu hình (giống ảnh mẫu) */}
                            {namedVars.length > 0 && (() => {
                              const byColor = new Map<string, { stock: number; hexes?: string[] }>();
                              for (const v of namedVars) {
                                const cKey = (v.color || "").trim() || "Mặc định";
                                const prev = byColor.get(cKey) || { stock: 0, hexes: v.colorHexes };
                                prev.stock += Math.max(0, Number(v.stockFloor1 ?? v.stock) || 0);
                                if (!prev.hexes && Array.isArray(v.colorHexes) && v.colorHexes.length > 0) {
                                  prev.hexes = v.colorHexes;
                                }
                                byColor.set(cKey, prev);
                              }
                              const colorEntries = Array.from(byColor.entries());
                              return (
                                <div className="space-y-1 pt-0.5">
                                  {colorEntries.slice(0, 2).map(([cLabel, info]) => {
                                    const cHexes = resolveVariantColorHexes(cLabel, info.hexes);
                                    return (
                                      <div
                                        key={cLabel}
                                        style={getColorBoxBorderStyle(cHexes, "var(--box-bg, #f8fafc)", 2)}
                                        className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-1 flex items-center justify-between gap-1.5 text-[10px]"
                                      >
                                        <span className="font-extrabold text-slate-800 flex items-center gap-1 truncate">
                                          <ColorSwatchBadge hexes={cHexes} colorName={cLabel} size="xs" />
                                          <span className="truncate">{cLabel}:</span>
                                        </span>
                                        <span className="px-1.5 py-0.2 rounded bg-white border border-slate-200 font-mono font-extrabold text-brand-ink shrink-0">
                                          ({info.stock})
                                        </span>
                                      </div>
                                    );
                                  })}
                                  {colorEntries.length > 2 && (
                                    <div className="text-[10px] font-bold text-slate-500 text-right">
                                      +{colorEntries.length - 2} màu khác
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {inCartQty > 0 && (
                              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 rounded-full bg-blue-600 text-white font-mono text-[10px] font-extrabold flex items-center justify-center shadow-xs">
                                {inCartQty}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5 pr-1">
                      {paginatedCatalogProducts.map((p) =>
                        renderProductCard(p)
                      )}
                    </div>
                  )}
                </div>

                {/* Chân cột phải Bán thường: Phân trang `< 1/2 >` bên trái + Nút `THANH TOÁN` lớn bên phải (giống hệt ảnh 1) */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 shrink-0">
                    <button
                      type="button"
                      disabled={safeCatalogPage <= 1}
                      onClick={() =>
                        setCatalogPage((prev) => Math.max(1, prev - 1))
                      }
                      className="w-7 h-7 rounded-full border border-slate-200 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-mono font-semibold px-1">
                      {safeCatalogPage}/{totalCatalogPages}
                    </span>
                    <button
                      type="button"
                      disabled={safeCatalogPage >= totalCatalogPages}
                      onClick={() =>
                        setCatalogPage((prev) =>
                          Math.min(totalCatalogPages, prev + 1)
                        )
                      }
                      className="w-7 h-7 rounded-full border border-slate-200 hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={cart.length === 0 && giftCart.length === 0}
                    onClick={() => setShowCheckoutDrawer(true)}
                    className="flex-1 py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-extrabold text-sm sm:text-base uppercase tracking-wide shadow-md transition text-center"
                  >
                    THANH TOÁN
                  </button>
                </div>
              </div>
            ) : (
              /* CHẾ ĐỘ BÁN NHANH (FAST) / NHÁP: Cột phải (4 cột) hiển thị trực tiếp Panel Khách hàng & Thanh toán */
              <div className="lg:col-span-4 flex flex-col min-h-0 overflow-hidden">
                {renderCheckoutFormContent(false)}
              </div>
            )}
          </div>

          {/* ==================== SLIDE-OVER DRAWER THANH TOÁN KHI Ở CHẾ ĐỘ BÁN THƯỜNG (GIỐNG ẢNH 2) ==================== */}
          {showCheckoutDrawer && (
            <div
              className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-[1px] flex justify-end"
              onClick={() => setShowCheckoutDrawer(false)}
            >
              <div
                className="w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                {renderCheckoutFormContent(true)}
              </div>
            </div>
          )}

          {/* ==================== THANH CHẾ ĐỘ BÁN HÀNG DƯỚI ĐÁY (BÁN NHANH / BÁN THƯỜNG / HÓA ĐƠN NHÁP) ==================== */}
          <div className="bg-white border-t border-slate-200 pl-14 sm:pl-16 pr-3 flex flex-wrap items-center justify-between gap-2 text-xs select-none shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => {
                  setPosSubView("FAST");
                  setShowCheckoutDrawer(false);
                }}
                className={`px-4 py-2.5 font-extrabold flex items-center gap-1.5 border-t-2 transition ${
                  posSubView === "FAST"
                    ? "border-blue-600 text-brand-ink bg-blue-50/50"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Bán nhanh</span>
              </button>

              <button
                type="button"
                onClick={() => setPosSubView("CATALOG")}
                className={`px-4 py-2.5 font-extrabold flex items-center gap-1.5 border-t-2 transition ${
                  posSubView === "CATALOG"
                    ? "border-blue-600 text-brand-ink bg-blue-50/50"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Bán thường</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPosSubView("DRAFTS");
                  setShowCheckoutDrawer(false);
                }}
                className={`px-4 py-2.5 font-extrabold flex items-center gap-1.5 border-t-2 transition ${
                  posSubView === "DRAFTS"
                    ? "border-blue-600 text-brand-ink bg-blue-50/50"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Hóa đơn nháp ({savedDraftOrders.length})</span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-2 py-1.5 text-[11px] text-slate-500">
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-brand-ink font-bold border border-blue-200">
                11 Sport POS • Kho Tầng 1 ({floor1Products.length} SP)
              </span>
            </div>
          </div>

      {/* POPUP CHỌN PHÂN LOẠI (MÀU SẮC & SIZE) KHI QUÉT MÃ CHUNG HOẶC BẤM CHỌN BÁN */}
      {variantPickerProduct && (() => {
        const allVars = variantPickerProduct.variants || [];
        const colorSet = new Map<string, number>();
        for (const v of allVars) {
          const c = (v.color || "").trim() || "Mặc định";
          const vF1 = Math.max(0, Number(v.stockFloor1 ?? v.stock) || 0);
          colorSet.set(c, (colorSet.get(c) || 0) + vF1);
        }
        const colorTabs = Array.from(colorSet.entries());
        const qNorm = pickerSearch.trim().toLowerCase();
        const filteredVars = allVars
          .map((v, originalIdx) => ({ v, originalIdx }))
          .filter(({ v }) => {
            const c = (v.color || "").trim() || "Mặc định";
            if (pickerColorFilter !== "ALL" && c !== pickerColorFilter) return false;
            if (!qNorm) return true;
            const childCode =
              v.variantCode ||
              resolveVariantCode(variantPickerProduct, variantPickerProduct.code, v.color, v.size);
            const text = `${c} ${v.size || ""} ${childCode}`.toLowerCase();
            return text.includes(qNorm);
          });

        // Gom nhóm theo Màu sắc để không lặp lại tên màu ở từng ô và giúp Size luôn hiển thị to, rõ
        const groupedModalColors = (() => {
          const map = new Map<string, { v: ProductVariant; originalIdx: number }[]>();
          for (const item of filteredVars) {
            const c = (item.v.color || "").trim() || "Mặc định";
            const list = map.get(c) || [];
            list.push(item);
            map.set(c, list);
          }
          return Array.from(map.entries()).map(([colorName, items]) => {
            const sortedItems = [...items].sort((a, b) => {
              const sa = parseFloat(String(a.v.size || "").replace(",", "."));
              const sb = parseFloat(String(b.v.size || "").replace(",", "."));
              if (!isNaN(sa) && !isNaN(sb) && sa !== sb) return sa - sb;
              return String(a.v.size || "").localeCompare(String(b.v.size || ""), "vi");
            });
            const totalStock = sortedItems.reduce(
              (sum, it) => sum + Math.max(0, Number(it.v.stockFloor1 ?? it.v.stock) || 0),
              0
            );
            const explicitHexes = sortedItems.find(
              (it) => Array.isArray(it.v.colorHexes) && it.v.colorHexes.length > 0
            )?.v.colorHexes;
            const colorHexes = resolveVariantColorHexes(colorName, explicitHexes);
            return { colorName, items: sortedItems, totalStock, colorHexes };
          });
        })();

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[88vh]">
              <div className="px-5 py-3.5 bg-blue-600 text-white flex items-center justify-between gap-3 shrink-0">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono text-blue-100 font-bold">
                      Mã SP chung: {variantPickerProduct.code}
                    </span>
                    <span className="text-[11px] font-mono bg-white/15 px-2 py-0.5 rounded text-white font-semibold">
                      {allVars.length} mã con · {colorTabs.length} màu
                    </span>
                  </div>
                  <h3 className="font-extrabold text-lg mt-0.5 break-words">
                    {variantPickerProduct.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setVariantPickerProduct(null)}
                  className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center text-white shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-4 sm:px-5 py-3 bg-slate-50 border-b border-slate-200 space-y-2.5 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
                  <span>
                    Bấm trực tiếp vào <strong>ô Size</strong> bên dưới từng màu để thêm vào giỏ:
                  </span>
                  <span className="font-mono font-black text-slate-900 text-base">
                    Giá: {formatVND(productDisplayPrice(variantPickerProduct).price)}
                    {productDisplayPrice(variantPickerProduct).hasVariantPrices ? " (theo biến thể)" : ""}
                  </span>
                </div>

                {/* Bộ lọc nhanh theo Màu sắc + Ô tìm kiếm Size/Mã con */}
                {(colorTabs.length > 1 || allVars.length > 6) && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPickerColorFilter("ALL")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${pickerColorFilter === "ALL"
                          ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                          : "bg-white text-slate-800 border-slate-300 hover:bg-slate-100"
                          }`}
                      >
                        Tất cả màu ({allVars.length})
                      </button>
                      {colorTabs.map(([cName, cStock]) => {
                        const explicitHexes = allVars.find(
                          (v) =>
                            ((v.color || "").trim() || "Mặc định") === cName &&
                            Array.isArray(v.colorHexes) &&
                            v.colorHexes.length > 0
                        )?.colorHexes;
                        const cHexes = resolveVariantColorHexes(cName, explicitHexes);
                        const isSelectedTab = pickerColorFilter === cName;
                        return (
                          <button
                            key={cName}
                            type="button"
                            onClick={() => setPickerColorFilter(cName)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${isSelectedTab
                              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                              : cStock > 0
                                ? "bg-white text-slate-900 border-slate-300 hover:bg-blue-50 hover:border-blue-400"
                                : "bg-white text-slate-400 border-slate-200 opacity-70"
                              }`}
                          >
                            <ColorSwatchBadge hexes={cHexes} colorName={cName} size="xs" />
                            <span>{cName}</span>
                            <span
                              className={`font-mono text-xs px-1.5 py-0.2 rounded font-black ${isSelectedTab
                                ? "bg-white/20 text-white"
                                : cStock > 0
                                  ? "bg-slate-100 text-slate-900"
                                  : "bg-slate-100 text-slate-400"
                                }`}
                            >
                              {cStock}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="relative w-full sm:w-52 shrink-0">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={pickerSearch}
                        onChange={(e) => setPickerSearch(e.target.value)}
                        placeholder="Lọc size, màu, mã con..."
                        className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3.5">
                {groupedModalColors.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">
                    Không có phân loại nào khớp bộ lọc.
                  </div>
                ) : (
                  groupedModalColors.map(({ colorName, items, totalStock, colorHexes }) => {
                    return (
                      <div
                        key={colorName}
                        className={`rounded-xl border border-slate-200 bg-white p-3.5 space-y-3 ${
                          totalStock <= 0 ? "opacity-55" : ""
                        }`}
                      >
                        {/* Tiêu đề Nhóm Màu */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2 min-w-0">
                            <ColorSwatchBadge hexes={colorHexes} colorName={colorName} size="sm" />
                            <span className="font-extrabold text-base text-slate-900 break-words">
                              {colorName}
                            </span>
                            {items.some((x) => Boolean(x.v.size?.trim())) && (
                              <span className="text-xs font-medium text-slate-500 shrink-0">
                                ({items.filter((x) => Boolean(x.v.size?.trim())).length} size)
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-mono font-black text-slate-900 px-2.5 py-1 rounded-lg bg-slate-100 shrink-0 whitespace-nowrap">
                            Tồn T1: {totalStock} {variantPickerProduct.unit}
                          </span>
                        </div>

                        {/* Lưới các ô chọn Size rộng rãi, không bị rớt chữ */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {items.map(({ v, originalIdx }) => {
                            const vFloor1 = Math.max(0, Number(v.stockFloor1 ?? v.stock) || 0);
                            const inCartQty = getCartVariantQty(
                              variantPickerProduct._id,
                              v.color,
                              v.size
                            );
                            const canPick = vFloor1 > 0 && inCartQty < vFloor1;
                            const childCode =
                              v.variantCode ||
                              resolveVariantCode(variantPickerProduct, variantPickerProduct.code,
                                v.color,
                                v.size
                              );
                            const displayPrice = variantEffectiveSellingPrice(variantPickerProduct, v);

                            return (
                              <button
                                key={`${v.color}-${v.size}-${originalIdx}`}
                                type="button"
                                disabled={!canPick}
                                title={`Mã con: ${childCode} • ${formatVariantLabel(v.color, v.size)}`}
                                onClick={() => {
                                  const added = handleAddToCart(variantPickerProduct, v.color, v.size);
                                  if (added) {
                                    playScannerBeep("success");
                                    const vLabel = formatVariantLabel(v.color, v.size);
                                    setLastScanBanner({
                                      type: "success",
                                      code: variantPickerProduct.code,
                                      message: `Đã chọn ${vLabel} của "${variantPickerProduct.name}" (+1 vào giỏ hàng)`,
                                      time: new Date().toLocaleTimeString("vi-VN", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        second: "2-digit",
                                      }),
                                    });
                                    setVariantPickerProduct(null);
                                  }
                                }}
                                className={`relative p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2 ${
                                  canPick
                                    ? inCartQty > 0
                                      ? "border-blue-600 bg-blue-50/60 hover:bg-blue-100/80 hover:shadow-md cursor-pointer shadow-2xs"
                                      : "border-slate-200 hover:border-blue-600 hover:bg-blue-50/80 hover:shadow-md bg-white cursor-pointer shadow-2xs"
                                    : "border-slate-200 bg-slate-100/70 opacity-55 cursor-not-allowed"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  {Boolean(v.size?.trim()) ? (
                                    <div className="flex items-baseline gap-1.5 min-w-0">
                                      <span className="text-[11px] font-bold uppercase text-slate-500 shrink-0">
                                        Size
                                      </span>
                                      <span
                                        className={`font-mono text-xl font-black leading-none ${
                                          vFloor1 <= 0
                                            ? "text-slate-400 line-through"
                                            : "text-slate-900"
                                        }`}
                                      >
                                        {v.size.trim()}
                                      </span>
                                    </div>
                                  ) : (
                                    <span
                                      className={`text-base font-black leading-none ${
                                        vFloor1 <= 0
                                          ? "text-slate-400 line-through"
                                          : "text-slate-900"
                                      }`}
                                    >
                                      {v.color || colorName}
                                    </span>
                                  )}

                                  <span
                                    className={`text-xs font-mono font-bold whitespace-nowrap shrink-0 ${
                                      vFloor1 > 0 ? "text-slate-900" : "text-slate-400"
                                    }`}
                                  >
                                    {vFloor1 > 0
                                      ? `Còn ${vFloor1} ${variantPickerProduct.unit}`
                                      : "Hết hàng"}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                                  <span className="text-sm font-mono font-black text-slate-900 whitespace-nowrap">
                                    {formatVND(displayPrice)}
                                  </span>

                                  {inCartQty > 0 ? (
                                    <span className="text-xs font-mono font-bold text-white bg-blue-600 px-2.5 py-1 rounded-lg shrink-0 whitespace-nowrap">
                                      Đã chọn: {inCartQty}
                                    </span>
                                  ) : canPick ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold shrink-0 whitespace-nowrap">
                                      <Plus className="w-3 h-3" /> Chọn
                                    </span>
                                  ) : null}
                                </div>

                                <div className="font-mono text-[10px] text-slate-500 truncate">
                                  {childCode}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setVariantPickerProduct(null)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* POPUP CHỌN SẢN PHẨM TẶNG KÈM */}
      {showGiftModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3.5 sm:px-6 bg-amber-600 text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Gift className="w-5 h-5 shrink-0" />
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base">
                    Chọn Sản Phẩm Tặng Kèm (Kho Tầng 1)
                  </h3>
                  <p className="text-[11px] text-amber-100">
                    Hàng tặng tính giá 0 VND · Hiển thị trên Bill · Trừ trực tiếp tồn Kho Tầng 1
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGiftModal(false)}
                className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-7 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={giftSearch}
                  onChange={(e) => setGiftSearch(e.target.value)}
                  placeholder="Tìm tên hoặc mã sản phẩm tặng..."
                  className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:border-amber-600 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-5">
                <select
                  value={giftCategoryId}
                  onChange={(e) => setGiftCategoryId(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-800 focus:border-amber-600 focus:outline-none"
                >
                  <option value="">
                    📂 Tất cả sản phẩm · Ưu tiên đã ghim ({floor1Products.length})
                  </option>
                  <option value="PINNED">
                    📌 Chỉ sản phẩm đã ghim ({pinnedFloor1Count})
                  </option>
                  {categories.map((cat) => {
                    const count = floor1Products.filter(
                      (p) => getCategoryId(p) === cat._id
                    ).length;
                    return (
                      <option key={cat._id} value={cat._id}>
                        {cat.name} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-2.5">
              {popupGiftProducts.length === 0 ? (
                <div className="py-14 px-4 text-center space-y-2">
                  <Pin className="w-8 h-8 text-amber-400 mx-auto" />
                  <div className="text-sm font-bold text-slate-700">
                    {giftCategoryId === "PINNED" && !giftSearch.trim()
                      ? "Chưa có sản phẩm tặng nào được ghim"
                      : "Không tìm thấy sản phẩm phù hợp trong Kho Tầng 1"}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {popupGiftProducts.map((p) => {
                    const isPinned = pinnedGiftIds.includes(p._id);
                    const floor1Stock = getFloor1Stock(p);
                    const inSaleCart = getCartQty(p._id);
                    const inGiftCart = getGiftQty(p._id);
                    const remainingForGift = Math.max(0, floor1Stock - inSaleCart);
                    const catName = getCategoryName(p);

                    return (
                      <div
                        key={p._id}
                        className={`p-3 rounded-xl border transition flex flex-col justify-between gap-2 ${isPinned
                          ? "border-amber-400 bg-amber-50/40 shadow-xs"
                          : "border-slate-200 bg-white hover:border-amber-400"
                          }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-brand-ink border border-blue-200">
                                {catName}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-brand-ink border border-blue-200">
                                Tồn T1: {remainingForGift} {p.unit}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => togglePinGiftProduct(p._id)}
                              className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 border transition shrink-0 ${isPinned
                                ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-700"
                                }`}
                            >
                              <Pin className="w-3 h-3" />
                              {isPinned ? "Đã ghim" : "Ghim"}
                            </button>
                          </div>

                          <div className="font-semibold text-slate-900 text-xs sm:text-sm break-words">
                            {p.name}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400">
                            Mã: {p.code}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <div className="font-mono text-xs">
                            <span className="line-through text-slate-400 mr-1.5">
                              {formatVND(p.sellingPrice)}
                            </span>
                            <span className="font-extrabold text-amber-700">0 VND</span>
                          </div>

                          {inGiftCart > 0 ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleChangeGiftQty(p._id, inGiftCart - 1)}
                                className="w-7 h-7 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 flex items-center justify-center font-bold"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="px-2 font-mono font-extrabold text-xs text-amber-800">
                                Đang tặng: {inGiftCart}
                              </span>
                              <button
                                type="button"
                                disabled={inGiftCart >= remainingForGift}
                                onClick={() => handleAddGiftProduct(p)}
                                className="w-7 h-7 rounded bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 text-white flex items-center justify-center font-bold"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={remainingForGift <= 0}
                              onClick={() => handleAddGiftProduct(p)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${remainingForGift > 0
                                ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                                : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                }`}
                            >
                              <Gift className="w-3.5 h-3.5" />
                              Chọn tặng
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-4 py-3 sm:px-6 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-600">
                Đã chọn tặng:{" "}
                <strong className="text-amber-700 font-mono">
                  {giftUnitsCount} sản phẩm
                </strong>{" "}
                ({giftCart.length} mặt hàng · 0 VND)
              </div>
              <button
                type="button"
                onClick={() => setShowGiftModal(false)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold transition"
              >
                Xong / Đóng
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  );
}
