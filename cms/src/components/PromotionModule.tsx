"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Promotion,
  PromotionConditionType,
  PromotionDiscountType,
  Product,
  Category,
  apiRequest,
  formatVND,
  formatNumberDots,
  parseNumberDots,
  formatDateTime,
  filterAndRankBySearch,
} from "@/lib/api";
import {
  Gift,
  Plus,
  Search,
  Calendar,
  Infinity as InfinityIcon,
  Tag,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  Pencil,
  Trash2,
  X,
  Layers,
  ShoppingBag,
  Sparkles,
  Clock,
  Check,
} from "lucide-react";

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
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE_NOW" | "PERMANENT" | "SCHEDULED" | "INACTIVE"
  >("ALL");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Modal Tạo / Sửa chương trình khuyến mãi
  const [showModal, setShowModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "PAUSED">("ACTIVE");
  const [isPermanent, setIsPermanent] = useState<boolean>(true);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [conditionType, setConditionType] =
    useState<PromotionConditionType>("BUY_PRODUCTS");
  const [conditionProductIds, setConditionProductIds] = useState<string[]>([]);
  const [conditionCategoryIds, setConditionCategoryIds] = useState<string[]>([]);
  const [minQuantity, setMinQuantity] = useState<number>(1);
  const [minOrderAmount, setMinOrderAmount] = useState<number>(0);

  // Tìm kiếm sản phẩm điều kiện trong Modal
  const [condProdSearch, setCondProdSearch] = useState("");
  const [condProdCatId, setCondProdCatId] = useState("");

  // Quà tặng kèm
  const [giftItems, setGiftItems] = useState<
    { productId: string; quantity: number }[]
  >([]);
  const [multiplyGiftByConditionQty, setMultiplyGiftByConditionQty] =
    useState<boolean>(true);
  const [giftProdSearch, setGiftProdSearch] = useState("");
  const [giftProdCatId, setGiftProdCatId] = useState("");

  // Giảm giá sản phẩm & Giảm giá Bill
  const [itemDiscountType, setItemDiscountType] =
    useState<PromotionDiscountType>("NONE");
  const [itemDiscountValue, setItemDiscountValue] = useState<number>(0);
  const [billDiscountType, setBillDiscountType] =
    useState<PromotionDiscountType>("NONE");
  const [billDiscountValue, setBillDiscountValue] = useState<number>(0);

  const getFloor1Stock = (p: Product): number => {
    const f1 = Number(p.stockFloor1);
    const f2 = Number(p.stockFloor2);
    const total = Math.max(0, Number(p.stock) || 0);
    if (
      p.stockFloor1 === undefined ||
      p.stockFloor1 === null ||
      ((isNaN(f1) || f1 === 0) && (isNaN(f2) || f2 === 0) && total > 0)
    ) {
      return total;
    }
    return Math.max(0, f1 || 0);
  };

  const getCategoryId = (p: Product): string => {
    if (typeof p.categoryId === "object" && p.categoryId?._id) {
      return p.categoryId._id;
    }
    return String(p.categoryId || "");
  };

  const getCategoryName = (p: Product): string => {
    if (p.categoryName) return p.categoryName;
    if (typeof p.categoryId === "object" && p.categoryId?.name) {
      return p.categoryId.name;
    }
    const cid = getCategoryId(p);
    return categories.find((c) => c._id === cid)?.name || "Khác";
  };

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const [promoRes, prodRes, catRes] = await Promise.all([
        apiRequest<Promotion[]>("/promotions"),
        apiRequest<Product[]>("/products"),
        apiRequest<Category[]>("/categories"),
      ]);
      setPromotions(Array.isArray(promoRes.data) ? promoRes.data : []);
      setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
    } catch (err: any) {
      setErrorMsg(
        err?.message || "Không thể tải danh sách chương trình khuyến mãi."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const productById = useMemo(
    () => new Map(products.map((p) => [p._id, p])),
    [products]
  );

  // Mở Modal Tạo mới
  const handleOpenCreateModal = () => {
    setEditingPromo(null);
    setName("");
    setDescription("");
    setStatus("ACTIVE");
    setIsPermanent(true);
    setStartDate("");
    setEndDate("");
    setConditionType("BUY_PRODUCTS");
    setConditionProductIds([]);
    setConditionCategoryIds([]);
    setMinQuantity(1);
    setMinOrderAmount(0);
    setCondProdSearch("");
    setCondProdCatId("");

    setGiftItems([]);
    setMultiplyGiftByConditionQty(true);
    setGiftProdSearch("");
    // Mặc định ưu tiên lọc Category Phụ kiện nếu có để Admin chọn quà tặng nhanh
    const accessoryCat = categories.find(
      (c) =>
        c.name.toLowerCase().includes("phụ kiện") ||
        c.code.toUpperCase().includes("PHU_KIEN") ||
        c.code.toUpperCase() === "PK"
    );
    setGiftProdCatId(accessoryCat ? accessoryCat._id : "");

    setItemDiscountType("NONE");
    setItemDiscountValue(0);
    setBillDiscountType("NONE");
    setBillDiscountValue(0);
    setErrorMsg("");
    setShowModal(true);
  };

  // Mở Modal Chỉnh sửa
  const handleOpenEditModal = (promo: Promotion) => {
    setEditingPromo(promo);
    setName(promo.name || "");
    setDescription(promo.description || "");
    setStatus(promo.status || "ACTIVE");
    setIsPermanent(promo.isPermanent !== false);
    setStartDate(toDateTimeLocalInput(promo.startDate));
    setEndDate(toDateTimeLocalInput(promo.endDate));
    setConditionType(promo.conditionType || "BUY_PRODUCTS");
    setConditionProductIds(
      Array.isArray(promo.conditionProductIds) ? [...promo.conditionProductIds] : []
    );
    setConditionCategoryIds(
      Array.isArray(promo.conditionCategoryIds)
        ? [...promo.conditionCategoryIds]
        : []
    );
    setMinQuantity(Math.max(1, Number(promo.minQuantity) || 1));
    setMinOrderAmount(Math.max(0, Number(promo.minOrderAmount) || 0));
    setCondProdSearch("");
    setCondProdCatId("");

    setGiftItems(
      Array.isArray(promo.giftItems)
        ? promo.giftItems.map((g) => ({
            productId: g.productId,
            quantity: Math.max(1, Number(g.quantity) || 1),
          }))
        : []
    );
    setMultiplyGiftByConditionQty(promo.multiplyGiftByConditionQty !== false);
    setGiftProdSearch("");
    setGiftProdCatId("");

    setItemDiscountType(promo.itemDiscountType || "NONE");
    setItemDiscountValue(Number(promo.itemDiscountValue) || 0);
    setBillDiscountType(promo.billDiscountType || "NONE");
    setBillDiscountValue(Number(promo.billDiscountValue) || 0);
    setErrorMsg("");
    setShowModal(true);
  };

  const applyQuickDuration = (days: number) => {
    setIsPermanent(false);
    const now = new Date();
    const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    end.setHours(23, 59, 0, 0);
    setStartDate(toDateTimeLocalInput(now.toISOString()));
    setEndDate(toDateTimeLocalInput(end.toISOString()));
  };

  const toggleConditionProduct = (productId: string) => {
    setConditionProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const toggleConditionCategory = (categoryId: string) => {
    setConditionCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleAddGiftItem = (productId: string) => {
    setGiftItems((prev) => {
      const existing = prev.find((g) => g.productId === productId);
      if (existing) {
        return prev.map((g) =>
          g.productId === productId ? { ...g, quantity: g.quantity + 1 } : g
        );
      }
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const handleChangeGiftItemQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setGiftItems((prev) => prev.filter((g) => g.productId !== productId));
      return;
    }
    setGiftItems((prev) =>
      prev.map((g) => (g.productId === productId ? { ...g, quantity: qty } : g))
    );
  };

  // Lọc sản phẩm cho bảng chọn điều kiện
  const filteredConditionProducts = useMemo(() => {
    const byCat = products.filter((p) => {
      if (condProdCatId && getCategoryId(p) !== condProdCatId) return false;
      return true;
    });
    if (!condProdSearch.trim()) return byCat;
    return filterAndRankBySearch(byCat, condProdSearch, (p) => [
      { text: p.code, weight: 1.5 },
      { text: p.name, weight: 1.3 },
      { text: getCategoryName(p), weight: 0.9 },
    ]);
  }, [products, condProdCatId, condProdSearch, categories]);

  // Lọc sản phẩm cho bảng chọn quà tặng kèm
  const filteredGiftProducts = useMemo(() => {
    const byCat = products.filter((p) => {
      if (giftProdCatId && getCategoryId(p) !== giftProdCatId) return false;
      return true;
    });
    if (!giftProdSearch.trim()) return byCat;
    return filterAndRankBySearch(byCat, giftProdSearch, (p) => [
      { text: p.code, weight: 1.5 },
      { text: p.name, weight: 1.3 },
      { text: getCategoryName(p), weight: 0.9 },
    ]);
  }, [products, giftProdCatId, giftProdSearch, categories]);

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!name.trim()) {
      setErrorMsg("Vui lòng nhập Tên chương trình khuyến mãi.");
      return;
    }

    if (conditionType === "BUY_PRODUCTS" && conditionProductIds.length === 0) {
      setErrorMsg("Vui lòng chọn ít nhất 1 sản phẩm điều kiện mua.");
      return;
    }

    if (conditionType === "BUY_CATEGORY" && conditionCategoryIds.length === 0) {
      setErrorMsg("Vui lòng chọn ít nhất 1 danh mục (Category) điều kiện mua.");
      return;
    }

    if (!isPermanent && !startDate && !endDate) {
      setErrorMsg(
        "Vui lòng chọn thời gian bắt đầu / kết thúc hoặc bật chế độ Chạy vĩnh viễn."
      );
      return;
    }

    const hasGift = giftItems.length > 0;
    const hasItemDisc = itemDiscountType !== "NONE" && itemDiscountValue > 0;
    const hasBillDisc = billDiscountType !== "NONE" && billDiscountValue > 0;

    if (!hasGift && !hasItemDisc && !hasBillDisc) {
      setErrorMsg(
        "Vui lòng cấu hình ít nhất 1 ưu đãi: Tặng kèm phụ kiện/sản phẩm HOẶC Giảm giá sản phẩm HOẶC Giảm giá tổng Bill."
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        status,
        isPermanent,
        startDate: isPermanent || !startDate ? null : new Date(startDate).toISOString(),
        endDate: isPermanent || !endDate ? null : new Date(endDate).toISOString(),
        conditionType,
        conditionProductIds,
        conditionCategoryIds,
        minQuantity: Math.max(1, Math.round(Number(minQuantity) || 1)),
        minOrderAmount: Math.max(0, Math.round(Number(minOrderAmount) || 0)),
        giftItems,
        multiplyGiftByConditionQty,
        itemDiscountType: hasItemDisc ? itemDiscountType : "NONE",
        itemDiscountValue: hasItemDisc ? itemDiscountValue : 0,
        billDiscountType: hasBillDisc ? billDiscountType : "NONE",
        billDiscountValue: hasBillDisc ? billDiscountValue : 0,
      };

      if (editingPromo) {
        await apiRequest(`/promotions/${editingPromo._id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setSuccessMsg(
          `Đã cập nhật chương trình khuyến mãi "${payload.name}" thành công!`
        );
      } else {
        await apiRequest("/promotions", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccessMsg(
          `Đã tạo chương trình khuyến mãi "${payload.name}" thành công!`
        );
      }

      setShowModal(false);
      fetchAllData();
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể lưu chương trình khuyến mãi.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (promo: Promotion) => {
    setErrorMsg("");
    setSuccessMsg("");
    const nextStatus = promo.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      await apiRequest(`/promotions/${promo._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setSuccessMsg(
        nextStatus === "ACTIVE"
          ? `Đã bật chương trình "${promo.name}".`
          : `Đã tạm dừng chương trình "${promo.name}".`
      );
      fetchAllData();
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể đổi trạng thái chương trình.");
    }
  };

  const handleDeletePromo = async (promo: Promotion) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Bạn có chắc chắn muốn xóa chương trình khuyến mãi "${promo.name}" (${promo.code})?`
      )
    ) {
      return;
    }
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await apiRequest(`/promotions/${promo._id}`, {
        method: "DELETE",
      });
      setSuccessMsg(`Đã xóa chương trình khuyến mãi "${promo.name}".`);
      fetchAllData();
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể xóa chương trình khuyến mãi.");
    }
  };

  // Lọc và tìm kiếm danh sách CTKM hiển thị
  const filteredPromotions = useMemo(() => {
    const byStatus = promotions.filter((p) => {
      if (statusFilter === "ACTIVE_NOW") return !!p.isCurrentlyActive;
      if (statusFilter === "PERMANENT") return !!p.isPermanent;
      if (statusFilter === "SCHEDULED") return !p.isPermanent;
      if (statusFilter === "INACTIVE") return !p.isCurrentlyActive;
      return true;
    });

    if (!search.trim()) return byStatus;
    return filterAndRankBySearch(byStatus, search, (p) => [
      { text: p.code, weight: 1.5 },
      { text: p.name, weight: 1.4 },
      { text: p.description, weight: 0.9 },
      ...(p.conditionProducts || []).map((cp) => ({
        text: cp.productName,
        weight: 1.2,
      })),
      ...(p.conditionCategories || []).map((cc) => ({
        text: cc.categoryName,
        weight: 1.1,
      })),
      ...(p.giftItems || []).map((g) => ({ text: g.productName, weight: 1.2 })),
    ]);
  }, [promotions, statusFilter, search]);

  const kpiStats = useMemo(() => {
    const total = promotions.length;
    const activeNow = promotions.filter((p) => p.isCurrentlyActive).length;
    const permanent = promotions.filter(
      (p) => p.isCurrentlyActive && p.isPermanent
    ).length;
    const pausedOrExpired = total - activeNow;
    return { total, activeNow, permanent, pausedOrExpired };
  }, [promotions]);

  const renderEffectiveBadge = (promo: Promotion) => {
    switch (promo.effectiveStatus) {
      case "RUNNING_PERMANENT":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
            <InfinityIcon className="w-3.5 h-3.5" />
            Đang chạy (Vĩnh viễn)
          </span>
        );
      case "RUNNING":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Đang chạy (Còn hạn)
          </span>
        );
      case "UPCOMING":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
            <Clock className="w-3.5 h-3.5" />
            Sắp diễn ra
          </span>
        );
      case "EXPIRED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 border border-slate-300">
            <Calendar className="w-3.5 h-3.5" />
            Đã hết hạn
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
            <PauseCircle className="w-3.5 h-3.5" />
            Đang tạm dừng
          </span>
        );
    }
  };

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
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 shadow-md transition"
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

          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <div className="text-[11px] font-bold uppercase text-emerald-800">
              Đang chạy hiệu lực
            </div>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1 font-mono">
              {kpiStats.activeNow}
            </div>
            <div className="text-[11px] text-emerald-700 mt-0.5">
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
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
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
                label: `♾️ Chạy vĩnh viễn (${
                  promotions.filter((p) => p.isPermanent).length
                })`,
              },
              {
                id: "SCHEDULED",
                label: `📅 Có thời hạn (${
                  promotions.filter((p) => !p.isPermanent).length
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                  statusFilter === tab.id
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
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
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-emerald-600 focus:outline-none"
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
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow"
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
                className={`p-4 sm:p-5 transition hover:bg-slate-50/80 ${
                  promo.isCurrentlyActive ? "" : "opacity-80 bg-slate-50/40"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Cột trái: Tên, Mã, Thời gian & Điều kiện */}
                  <div className="space-y-2.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-slate-900 text-white">
                        {promo.code}
                      </span>
                      {renderEffectiveBadge(promo)}
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        {promo.isPermanent ? (
                          <>
                            <InfinityIcon className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Thời gian: Chạy vĩnh viễn</span>
                          </>
                        ) : (
                          <>
                            <Calendar className="w-3.5 h-3.5 text-blue-600" />
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
                        <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                        <span>Điều kiện khi Sales thêm giỏ hàng:</span>
                        <span className="text-blue-700 font-extrabold">
                          {promo.conditionType === "BUY_PRODUCTS" &&
                            `Mua từ ${promo.minQuantity} sản phẩm chỉ định`}
                          {promo.conditionType === "BUY_CATEGORY" &&
                            `Mua từ ${promo.minQuantity} sản phẩm thuộc Danh mục chỉ định`}
                          {promo.conditionType === "ALL_PRODUCTS" &&
                            `Áp dụng mọi sản phẩm (SL tối thiểu: ${promo.minQuantity})`}
                        </span>
                        {promo.minOrderAmount > 0 && (
                          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-[11px] font-bold">
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
                                className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold"
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
                            🎁 Mặc định tặng kèm (0 VND ·{" "}
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
                                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                    (g.stockFloor1 ?? 0) > 0
                                      ? "bg-emerald-50 text-emerald-700"
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
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition w-full justify-center ${
                        promo.status === "ACTIVE"
                          ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700"
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

      {/* MODAL TẠO / SỬA CHƯƠNG TRÌNH KHUYẾN MÃI */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header Modal */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Gift className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base">
                    {editingPromo
                      ? `Chỉnh sửa Chương trình Khuyến mãi (${editingPromo.code})`
                      : "Tạo Chương trình Khuyến mãi mới"}
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Khi Sales bấm thêm sản phẩm vào giỏ hàng POS, hệ thống sẽ tự động kiểm tra và thêm phụ kiện tặng kèm / giảm giá theo cấu hình dưới đây
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body Form */}
            <form
              onSubmit={handleSubmitForm}
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6"
            >
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* PHẦN 1: THÔNG TIN CƠ BẢN & THỜI GIAN CHƯƠNG TRÌNH */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="text-xs font-extrabold uppercase text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  1. Thông tin Chương trình & Thời gian hiệu lực
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-8">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tên chương trình khuyến mãi *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="VD: Mua Vợt Pickleball mặc định tặng kèm 1 Quấn cán..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Trạng thái kích hoạt
                    </label>
                    <select
                      value={status}
                      onChange={(e) =>
                        setStatus(e.target.value as "ACTIVE" | "PAUSED")
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-800 focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="ACTIVE">🟢 Đang bật (ACTIVE)</option>
                      <option value="PAUSED">⏸ Tạm dừng (PAUSED)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mô tả / Ghi chú cho Sales (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="VD: Áp dụng cho mọi khách mua lẻ tại quầy..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                {/* Chọn Thời gian chạy: Chạy vĩnh viễn vs Có thời hạn */}
                <div className="space-y-3 pt-2 border-t border-slate-200/80">
                  <label className="block text-xs font-bold text-slate-700">
                    Thời gian chạy chương trình:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsPermanent(true)}
                      className={`p-3 rounded-xl border text-left transition flex items-center gap-3 ${
                        isPermanent
                          ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      <InfinityIcon className="w-5 h-5 shrink-0" />
                      <div>
                        <div className="text-xs font-extrabold">
                          Chạy vĩnh viễn (Không giới hạn ngày)
                        </div>
                        <div
                          className={`text-[11px] ${
                            isPermanent ? "text-emerald-100" : "text-slate-500"
                          }`}
                        >
                          Luôn tự động áp dụng khi chương trình đang bật
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPermanent(false)}
                      className={`p-3 rounded-xl border text-left transition flex items-center gap-3 ${
                        !isPermanent
                          ? "bg-blue-600 text-white border-blue-700 shadow-xs"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      <Calendar className="w-5 h-5 shrink-0" />
                      <div>
                        <div className="text-xs font-extrabold">
                          Cài đặt thời gian bắt đầu / kết thúc
                        </div>
                        <div
                          className={`text-[11px] ${
                            !isPermanent ? "text-blue-100" : "text-slate-500"
                          }`}
                        >
                          Tự động kích hoạt khi đến hạn & tự ngắt khi hết hạn
                        </div>
                      </div>
                    </button>
                  </div>

                  {!isPermanent && (
                    <div className="p-3.5 rounded-xl bg-white border border-blue-200 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-blue-900">
                          Chọn khoảng thời gian hiệu lực:
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => applyQuickDuration(7)}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold border border-blue-200"
                          >
                            + 7 ngày tới
                          </button>
                          <button
                            type="button"
                            onClick={() => applyQuickDuration(30)}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold border border-blue-200"
                          >
                            + 30 ngày tới
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Bắt đầu từ ngày / giờ
                          </label>
                          <input
                            type="datetime-local"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Kết thúc vào ngày / giờ
                          </label>
                          <input
                            type="datetime-local"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* PHẦN 2: ĐIỀU KIỆN MUA SẢN PHẨM GÌ */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div className="text-xs font-extrabold uppercase text-slate-800 flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-blue-600" />
                  2. Điều kiện áp dụng (Khi khách mua sản phẩm gì?)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setConditionType("BUY_PRODUCTS")}
                    className={`p-3 rounded-xl border text-left text-xs font-bold transition ${
                      conditionType === "BUY_PRODUCTS"
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    <div>🛍️ Mua Sản phẩm cụ thể</div>
                    <div
                      className={`text-[11px] font-normal mt-0.5 ${
                        conditionType === "BUY_PRODUCTS"
                          ? "text-slate-300"
                          : "text-slate-500"
                      }`}
                    >
                      Chọn 1 hoặc nhiều sản phẩm trong kho
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConditionType("BUY_CATEGORY")}
                    className={`p-3 rounded-xl border text-left text-xs font-bold transition ${
                      conditionType === "BUY_CATEGORY"
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    <div>📂 Mua theo Danh mục (Category)</div>
                    <div
                      className={`text-[11px] font-normal mt-0.5 ${
                        conditionType === "BUY_CATEGORY"
                          ? "text-slate-300"
                          : "text-slate-500"
                      }`}
                    >
                      VD: Cứ mua bất kỳ sản phẩm thuộc danh mục Vợt
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConditionType("ALL_PRODUCTS")}
                    className={`p-3 rounded-xl border text-left text-xs font-bold transition ${
                      conditionType === "ALL_PRODUCTS"
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    <div>🌐 Tất cả sản phẩm / Toàn đơn</div>
                    <div
                      className={`text-[11px] font-normal mt-0.5 ${
                        conditionType === "ALL_PRODUCTS"
                          ? "text-slate-300"
                          : "text-slate-500"
                      }`}
                    >
                      Áp dụng cho mọi sản phẩm hoặc theo tổng tiền đơn
                    </div>
                  </button>
                </div>

                {/* Chọn sản phẩm điều kiện nếu BUY_PRODUCTS */}
                {conditionType === "BUY_PRODUCTS" && (
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        Đã chọn ({conditionProductIds.length}) sản phẩm điều kiện:
                      </span>
                      <div className="flex items-center gap-2">
                        {filteredConditionProducts.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const ids = filteredConditionProducts.map(
                                (p) => p._id
                              );
                              setConditionProductIds((prev) =>
                                Array.from(new Set([...prev, ...ids]))
                              );
                            }}
                            className="text-[11px] font-bold text-emerald-700 hover:underline"
                          >
                            + Chọn tất cả SP đang lọc ({filteredConditionProducts.length})
                          </button>
                        )}
                        {conditionProductIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setConditionProductIds([])}
                            className="text-[11px] font-bold text-red-600 hover:underline"
                          >
                            Bỏ chọn hết
                          </button>
                        )}
                      </div>
                    </div>

                    {conditionProductIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 rounded-lg bg-emerald-50/60 border border-emerald-200">
                        {conditionProductIds.map((pid) => {
                          const prod = productById.get(pid);
                          return (
                            <span
                              key={pid}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-900 text-xs font-semibold"
                            >
                              <span>{prod?.name || pid}</span>
                              <button
                                type="button"
                                onClick={() => toggleConditionProduct(pid)}
                                className="text-slate-400 hover:text-red-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-7 relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={condProdSearch}
                          onChange={(e) => setCondProdSearch(e.target.value)}
                          placeholder="Tìm sản phẩm điều kiện (VD: Vợt Joola, Selkirk...)"
                          className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs focus:border-emerald-600 focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-5">
                        <select
                          value={condProdCatId}
                          onChange={(e) => setCondProdCatId(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                        >
                          <option value="">📂 Tất cả danh mục ({products.length})</option>
                          {categories.map((c) => (
                            <option key={c._id} value={c._id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                      {filteredConditionProducts.map((p) => {
                        const checked = conditionProductIds.includes(p._id);
                        return (
                          <div
                            key={p._id}
                            onClick={() => toggleConditionProduct(p._id)}
                            className={`px-3 py-2 flex items-center justify-between gap-2 text-xs cursor-pointer transition ${
                              checked
                                ? "bg-emerald-50 font-bold text-emerald-900"
                                : "hover:bg-slate-50 text-slate-800"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                                  checked
                                    ? "bg-emerald-600 border-emerald-600 text-white"
                                    : "border-slate-300 bg-white"
                                }`}
                              >
                                {checked && <Check className="w-3 h-3" />}
                              </div>
                              <span className="truncate">{p.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                              <span className="text-slate-500">
                                {formatVND(p.sellingPrice)}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                T1: {getFloor1Stock(p)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Chọn danh mục điều kiện nếu BUY_CATEGORY */}
                {conditionType === "BUY_CATEGORY" && (
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="text-xs font-bold text-slate-800">
                      Chọn danh mục (Category) được áp dụng chương trình:
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {categories.map((cat) => {
                        const checked = conditionCategoryIds.includes(cat._id);
                        return (
                          <button
                            key={cat._id}
                            type="button"
                            onClick={() => toggleConditionCategory(cat._id)}
                            className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition ${
                              checked
                                ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            <span className="truncate">{cat.name}</span>
                            {checked && <Check className="w-4 h-4 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Số lượng tối thiểu & Giá trị đơn tối thiểu */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Số lượng sản phẩm mua tối thiểu để kích hoạt
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={minQuantity}
                      onChange={(e) =>
                        setMinQuantity(Math.max(1, Number(e.target.value) || 1))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Giá trị đơn tối thiểu (VND · Để 0 nếu không yêu cầu)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={
                        minOrderAmount > 0 ? formatNumberDots(minOrderAmount) : ""
                      }
                      onChange={(e) =>
                        setMinOrderAmount(parseNumberDots(e.target.value))
                      }
                      placeholder="0 VND (Không yêu cầu)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono font-bold text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* PHẦN 3: ƯU ĐÃI TỰ ĐỘNG (TẶNG KÈM PHỤ KIỆN / GIẢM TIỀN) */}
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-4">
                <div className="text-xs font-extrabold uppercase text-amber-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  3. Quyền lợi Khuyến mãi (Tự động tặng kèm phụ kiện hoặc Giảm tiền khi thêm giỏ hàng)
                </div>

                {/* 3A. Tặng kèm sản phẩm / phụ kiện */}
                <div className="bg-white p-3.5 rounded-xl border border-amber-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
                      <Gift className="w-4 h-4 text-amber-600" />
                      A. Mặc định Tặng kèm Phụ kiện / Sản phẩm (0 VND · Trừ Kho Tầng 1)
                    </div>
                    <label className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={multiplyGiftByConditionQty}
                        onChange={(e) =>
                          setMultiplyGiftByConditionQty(e.target.checked)
                        }
                        className="rounded border-amber-400"
                      />
                      Nhân số lượng quà tặng theo số lượng mua (Mua 1 tặng 1 → Mua 2 tặng 2)
                    </label>
                  </div>

                  {/* Danh sách quà tặng đã chọn */}
                  {giftItems.length > 0 ? (
                    <div className="divide-y divide-amber-100 border border-amber-200 rounded-xl bg-amber-50/40">
                      {giftItems.map((g) => {
                        const prod = productById.get(g.productId);
                        return (
                          <div
                            key={g.productId}
                            className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-slate-900">
                                🎁 {prod?.name || g.productId}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                Giá gốc bán lẻ: {formatVND(prod?.sellingPrice || 0)} → Tặng 0 VND · Tồn T1:{" "}
                                {prod ? getFloor1Stock(prod) : 0} {prod?.unit || "Cái"}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-slate-600">
                                SL tặng:
                              </span>
                              <input
                                type="number"
                                min={1}
                                value={g.quantity}
                                onChange={(e) =>
                                  handleChangeGiftItemQty(
                                    g.productId,
                                    Math.max(1, Number(e.target.value) || 1)
                                  )
                                }
                                className="w-14 px-2 py-1 rounded border border-amber-300 bg-white font-mono font-bold text-center text-xs"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleChangeGiftItemQty(g.productId, 0)
                                }
                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 italic">
                      Chưa chọn sản phẩm/phụ kiện tặng kèm. Tìm và bấm <strong>+ Chọn tặng</strong> ở danh sách dưới đây nếu chương trình có tặng quà.
                    </div>
                  )}

                  {/* Tìm & chọn phụ kiện tặng kèm */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-7 relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={giftProdSearch}
                        onChange={(e) => setGiftProdSearch(e.target.value)}
                        placeholder="Tìm phụ kiện / sản phẩm tặng kèm (VD: Quấn cán, Dán viền...)"
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs focus:border-amber-600 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <select
                        value={giftProdCatId}
                        onChange={(e) => setGiftProdCatId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                      >
                        <option value="">📂 Tất cả danh mục ({products.length})</option>
                        {categories.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                    {filteredGiftProducts.map((p) => {
                      const selectedGift = giftItems.find(
                        (g) => g.productId === p._id
                      );
                      return (
                        <div
                          key={p._id}
                          className="px-3 py-2 flex items-center justify-between gap-2 text-xs hover:bg-amber-50/40"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-900 truncate">
                              {p.name}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {getCategoryName(p)} · Giá: {formatVND(p.sellingPrice)} · Tồn T1:{" "}
                              {getFloor1Stock(p)} {p.unit}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddGiftItem(p._id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 transition ${
                              selectedGift
                                ? "bg-amber-600 text-white"
                                : "bg-amber-100 hover:bg-amber-200 text-amber-900"
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {selectedGift
                              ? `Đang tặng (${selectedGift.quantity})`
                              : "Chọn tặng"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3B & 3C: Giảm giá trên sản phẩm mua & Giảm giá tổng Bill */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Giảm giá sản phẩm */}
                  <div className="bg-white p-3.5 rounded-xl border border-amber-200 space-y-2.5">
                    <div className="text-xs font-extrabold text-rose-800 flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-rose-600" />
                      B. Tự động Giảm giá trên Sản phẩm mua
                    </div>
                    <select
                      value={itemDiscountType}
                      onChange={(e) => {
                        setItemDiscountType(
                          e.target.value as PromotionDiscountType
                        );
                        setItemDiscountValue(0);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                    >
                      <option value="NONE">Không giảm giá SP</option>
                      <option value="PERCENT">Giảm theo % trên từng SP</option>
                      <option value="AMOUNT">Giảm số tiền (VND / 1 SP)</option>
                    </select>

                    {itemDiscountType === "PERCENT" && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={itemDiscountValue || ""}
                          onChange={(e) =>
                            setItemDiscountValue(
                              Math.min(100, Math.max(0, Number(e.target.value)))
                            )
                          }
                          placeholder="VD: 10"
                          className="w-full px-3 py-2 rounded-lg border border-rose-300 font-mono font-bold text-sm"
                        />
                        <span className="font-bold text-rose-700 text-xs shrink-0">
                          % / SP
                        </span>
                      </div>
                    )}

                    {itemDiscountType === "AMOUNT" && (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={
                            itemDiscountValue > 0
                              ? formatNumberDots(itemDiscountValue)
                              : ""
                          }
                          onChange={(e) =>
                            setItemDiscountValue(parseNumberDots(e.target.value))
                          }
                          placeholder="VD: 50.000"
                          className="w-full px-3 py-2 rounded-lg border border-rose-300 font-mono font-bold text-sm"
                        />
                        <span className="font-bold text-rose-700 text-xs shrink-0">
                          VND / SP
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Giảm giá tổng Bill */}
                  <div className="bg-white p-3.5 rounded-xl border border-amber-200 space-y-2.5">
                    <div className="text-xs font-extrabold text-rose-800 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-rose-600" />
                      C. Tự động Giảm giá trên Tổng Bill
                    </div>
                    <select
                      value={billDiscountType}
                      onChange={(e) => {
                        setBillDiscountType(
                          e.target.value as PromotionDiscountType
                        );
                        setBillDiscountValue(0);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                    >
                      <option value="NONE">Không giảm tổng Bill</option>
                      <option value="PERCENT">Giảm tổng Bill theo %</option>
                      <option value="AMOUNT">Giảm tổng Bill số tiền (VND)</option>
                    </select>

                    {billDiscountType === "PERCENT" && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={billDiscountValue || ""}
                          onChange={(e) =>
                            setBillDiscountValue(
                              Math.min(100, Math.max(0, Number(e.target.value)))
                            )
                          }
                          placeholder="VD: 5"
                          className="w-full px-3 py-2 rounded-lg border border-rose-300 font-mono font-bold text-sm"
                        />
                        <span className="font-bold text-rose-700 text-xs shrink-0">
                          % Bill
                        </span>
                      </div>
                    )}

                    {billDiscountType === "AMOUNT" && (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={
                            billDiscountValue > 0
                              ? formatNumberDots(billDiscountValue)
                              : ""
                          }
                          onChange={(e) =>
                            setBillDiscountValue(parseNumberDots(e.target.value))
                          }
                          placeholder="VD: 100.000"
                          className="w-full px-3 py-2 rounded-lg border border-rose-300 font-mono font-bold text-sm"
                        />
                        <span className="font-bold text-rose-700 text-xs shrink-0">
                          VND
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Modal */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs sm:text-sm font-extrabold shadow-md transition"
                >
                  {submitting
                    ? "Đang lưu..."
                    : editingPromo
                    ? "Lưu cập nhật Chương trình"
                    : "Tạo Chương trình Khuyến mãi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
