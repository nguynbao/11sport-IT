import { apiRequest } from "@/shared/api/client";
import { filterAndRankBySearch } from "@/shared/lib/search";
import { Category,Product,Promotion,PromotionConditionType,PromotionDiscountType } from "@/shared/types";
import {
Calendar,
CheckCircle2,
Clock,
Infinity as InfinityIcon,
PauseCircle
} from "lucide-react";
import React,{ useCallback,useEffect,useMemo,useState } from "react";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
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


export function usePromotionModule() {
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
        apiRequest<Promotion[]>(API_ENDPOINTS.PROMOTIONS.BASE),
        apiRequest<Product[]>(API_ENDPOINTS.PRODUCTS.BASE),
        apiRequest<Category[]>(API_ENDPOINTS.CATEGORIES.BASE),
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
        await apiRequest(API_ENDPOINTS.PROMOTIONS.byId(editingPromo._id), {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setSuccessMsg(
          `Đã cập nhật chương trình khuyến mãi "${payload.name}" thành công!`
        );
      } else {
        await apiRequest(API_ENDPOINTS.PROMOTIONS.BASE, {
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
      await apiRequest(API_ENDPOINTS.PROMOTIONS.byId(promo._id), {
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
      await apiRequest(API_ENDPOINTS.PROMOTIONS.byId(promo._id), {
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
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-teal-100 text-brand-ink border border-teal-300">
            <InfinityIcon className="w-3.5 h-3.5" />
            Đang chạy (Vĩnh viễn)
          </span>
        );
      case "RUNNING":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-teal-100 text-brand-ink border border-teal-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Đang chạy (Còn hạn)
          </span>
        );
      case "UPCOMING":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-teal-100 text-brand-ink border border-teal-300">
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


  return {
    promotions,
    products,
    categories,
    loading,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    errorMsg,
    successMsg,
    showModal,
    setShowModal,
    editingPromo,
    submitting,
    name,
    setName,
    description,
    setDescription,
    status,
    setStatus,
    isPermanent,
    setIsPermanent,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    conditionType,
    setConditionType,
    conditionProductIds,
    setConditionProductIds,
    conditionCategoryIds,
    minQuantity,
    setMinQuantity,
    minOrderAmount,
    setMinOrderAmount,
    condProdSearch,
    setCondProdSearch,
    condProdCatId,
    setCondProdCatId,
    giftItems,
    multiplyGiftByConditionQty,
    setMultiplyGiftByConditionQty,
    giftProdSearch,
    setGiftProdSearch,
    giftProdCatId,
    setGiftProdCatId,
    itemDiscountType,
    setItemDiscountType,
    itemDiscountValue,
    setItemDiscountValue,
    billDiscountType,
    setBillDiscountType,
    billDiscountValue,
    setBillDiscountValue,
    getFloor1Stock,
    getCategoryName,
    productById,
    handleOpenCreateModal,
    handleOpenEditModal,
    applyQuickDuration,
    toggleConditionProduct,
    toggleConditionCategory,
    handleAddGiftItem,
    handleChangeGiftItemQty,
    filteredConditionProducts,
    filteredGiftProducts,
    handleSubmitForm,
    handleToggleStatus,
    handleDeletePromo,
    filteredPromotions,
    kpiStats,
    renderEffectiveBadge,
  };
}

export type PromotionModuleViewModel = ReturnType<typeof usePromotionModule>;
