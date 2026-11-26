import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type {
  Product,
  ProductVariant,
  Category,
  Order,
  Promotion,
  DiscountType,
  ServiceOrdersMeta,
} from "@/shared/types";
import { apiRequest, getStoredUser } from "@/shared/api/client";
import { lookupProductByCodeApi } from "@/shared/api/catalogLookup";
import {
  cleanPhoneDigits,
  formatNumberDots,
  formatPhone,
  formatVariantLabel,
  formatVND,
  parseNumberDots,
} from "@/shared/utils/format";
import {
  findVariantByColorSize,
  resolveVariantCode,
  variantEffectiveSellingPrice,
} from "@/shared/utils/productCode";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { filterAndRankBySearch } from "@/shared/lib/search";
import {
  cleanBarcodeCode,
  findProductAndVariantByScannedBarcode,
  findProductByScannedBarcode,
  getBarcodeCandidates,
  playScannerBeep,
  useHardwareBarcodeScanner,
} from "@/shared/lib/barcodeScanner";
import {
  PINNED_GIFTS_STORAGE_KEY,
  POS_DRAFTS_STORAGE_KEY,
  MAX_DRAFTS,
  DEFAULT_NOTE,
  INITIAL_DRAFT_ID,
  SPLIT_METHOD_OPTIONS,
  cartUnitPrice,
  productDisplayPrice,
  getCartLineKey,
  createEmptyDraftData,
  generateDraftId,
  createDraft,
  isDraftEmpty,
  type GiftCartItem,
  type PosTabProps,
  type CartItem,
  type SortByOption,
  type SplitMethodType,
  type SplitPaymentItem,
  type PaymentMethodType,
  type DraftOrderData,
  type DraftOrder,
} from "../types";

export function usePosTab({ onOpenInvoice }: PosTabProps) {
  const [posMode, setPosMode] = useState<"PRODUCTS" | "SERVICES">("PRODUCTS");
  const [posSubView, setPosSubView] = useState<"FAST" | "CATALOG" | "DRAFTS">("FAST");
  const [showCheckoutDrawer, setShowCheckoutDrawer] = useState(false);
  const [showCategoryFilterPopover, setShowCategoryFilterPopover] = useState(false);
  const [catalogViewMode, setCatalogViewMode] = useState<"COMPACT" | "DETAILED">("COMPACT");
  const [catalogPage, setCatalogPage] = useState(1);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [expandedDiscountKey, setExpandedDiscountKey] = useState<string | null>(null);
  const [nowClock, setNowClock] = useState<string>("");
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const billPriceInputRef = useRef<HTMLInputElement>(null);
  const [serviceMeta, setServiceMeta] = useState<ServiceOrdersMeta | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [allCatalogProducts, setAllCatalogProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activePromotions, setActivePromotions] = useState<Promotion[]>([]);
  const [appliedPromosSummary, setAppliedPromosSummary] = useState<
    { _id: string; code: string; name: string; multiplier: number; details: string[] }[]
  >([]);
  const [autoBillPromoName, setAutoBillPromoName] = useState<string>("");
  const [isManualBillDiscount, setIsManualBillDiscount] = useState<boolean>(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortByOption>("CATEGORY");
  const [search, setSearch] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Máy quét mã vạch (Label Barcode Scanner) cho Bán hàng POS
  const [scannerEnabled, setScannerEnabled] = useState<boolean>(true);
  const [scannerInput, setScannerInput] = useState<string>("");
  const [lastScanBanner, setLastScanBanner] = useState<{
    type: "success" | "warning" | "error";
    code: string;
    message: string;
    time: string;
  } | null>(null);
  const scannerInputRef = useRef<HTMLInputElement>(null);

  // Giỏ hàng bán & Giỏ hàng tặng (tách riêng)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [giftCart, setGiftCart] = useState<GiftCartItem[]>([]);

  // Popup chọn Size & Màu sắc khi bán sản phẩm có nhiều phân loại
  const [variantPickerProduct, setVariantPickerProduct] = useState<Product | null>(null);
  const [pickerColorFilter, setPickerColorFilter] = useState<string>("ALL");
  const [pickerSearch, setPickerSearch] = useState<string>("");
  const [expandedCardVarIds, setExpandedCardVarIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setPickerColorFilter("ALL");
    setPickerSearch("");
  }, [variantPickerProduct]);

  useEffect(() => {
    const updateClock = () => {
      const d = new Date();
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");
      setNowClock(`${dd}/${mm}/${yyyy}  ${hh}:${min}`);
    };
    updateClock();
    const timer = setInterval(updateClock, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleExpandCardVariants = (prodId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCardVarIds((prev) => {
      const next = new Set(prev);
      if (next.has(prodId)) next.delete(prodId);
      else next.add(prodId);
      return next;
    });
  };

  // Popup chọn sản phẩm tặng
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftSearch, setGiftSearch] = useState("");
  const [giftCategoryId, setGiftCategoryId] = useState("");
  const [pinnedGiftIds, setPinnedGiftIds] = useState<string[]>([]);

  // Giảm giá Bill
  const [billDiscountType, setBillDiscountType] = useState<DiscountType>("NONE");
  const [billDiscountValue, setBillDiscountValue] = useState<number>(0);
  const [billDiscountInputMode, setBillDiscountInputMode] = useState<
    "NONE" | "PERCENT" | "AMOUNT" | "PRICE"
  >("NONE");
  const [billCustomPriceText, setBillCustomPriceText] = useState<string>("");

  // Thông tin khách hàng
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [customerDebtSummary, setCustomerDebtSummary] = useState<{
    totalDebtAmount: number;
    unpaidOrdersCount: number;
    overdueOrdersCount: number;
  } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  // Thanh toán
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("CASH");
  const [splitPayments, setSplitPayments] = useState<SplitPaymentItem[]>([]);
  const [debtDueDate, setDebtDueDate] = useState<string>("");
  const [showSplitDropdown, setShowSplitDropdown] = useState<boolean>(false);
  const [hasCardFee, setHasCardFee] = useState<boolean>(true);
  const [cardFeePercent, setCardFeePercent] = useState<number>(1.8);
  const [note, setNote] = useState(DEFAULT_NOTE);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [savedDraftOrders, setSavedDraftOrders] = useState<Order[]>([]);
  const [loadingSavedDrafts, setLoadingSavedDrafts] = useState(false);
  const [editingServerDraftOrder, setEditingServerDraftOrder] = useState<Order | null>(null);

  const [drafts, setDrafts] = useState<DraftOrder[]>(() => [
    { id: INITIAL_DRAFT_ID, seq: 1, ...createEmptyDraftData() },
  ]);
  const [activeDraftId, setActiveDraftId] = useState<string>(INITIAL_DRAFT_ID);
  const activeDraftIdRef = useRef<string>(INITIAL_DRAFT_ID);
  const [draftsHydrated, setDraftsHydrated] = useState(false);

  useEffect(() => {
    activeDraftIdRef.current = activeDraftId;
  }, [activeDraftId]);

  const getCurrentDraftData = (): DraftOrderData => ({
    cart,
    giftCart,
    billDiscountType,
    billDiscountValue,
    billDiscountInputMode,
    billCustomPriceText,
    customerPhone,
    customerName,
    isExistingCustomer,
    customerOrders,
    customerDebtSummary,
    paymentMethod,
    splitPayments,
    debtDueDate,
    hasCardFee,
    cardFeePercent,
    note,
    editingServerDraftOrder,
  });

  const applyDraftData = (d: DraftOrderData) => {
    setCart(d.cart || []);
    setGiftCart(d.giftCart || []);
    const loadedBillDiscountType = d.billDiscountType || "NONE";
    setBillDiscountType(loadedBillDiscountType);
    setBillDiscountValue(Number(d.billDiscountValue) || 0);
    setBillDiscountInputMode(
      d.billDiscountInputMode ||
        (loadedBillDiscountType === "PERCENT"
          ? "PERCENT"
          : loadedBillDiscountType === "AMOUNT"
            ? "AMOUNT"
            : "NONE")
    );
    setBillCustomPriceText(d.billCustomPriceText || "");
    setIsManualBillDiscount(
      (Number(d.billDiscountValue) || 0) > 0 || d.billDiscountInputMode === "PRICE"
    );
    setAutoBillPromoName("");
    setAppliedPromosSummary([]);
    setCustomerPhone(d.customerPhone || "");
    setCustomerName(d.customerName || "");
    setIsExistingCustomer(!!d.isExistingCustomer);
    setCustomerOrders(Array.isArray(d.customerOrders) ? d.customerOrders : []);
    setCustomerDebtSummary(d.customerDebtSummary || null);
    setPaymentMethod(d.paymentMethod || "CASH");
    setSplitPayments(Array.isArray(d.splitPayments) ? d.splitPayments : []);
    setDebtDueDate(typeof d.debtDueDate === "string" ? d.debtDueDate : "");
    setHasCardFee(true);
    setCardFeePercent(Number(d.cardFeePercent) === 4 ? 4 : 1.8);
    setNote(typeof d.note === "string" ? d.note : DEFAULT_NOTE);
    setEditingServerDraftOrder(d.editingServerDraftOrder || null);
    setShowSplitDropdown(false);
    setLookingUp(false);
    setErrorMsg("");
    setSuccessMsg("");
  };

  const liveDrafts = useMemo<DraftOrder[]>(
    () =>
      drafts.map((d) =>
        d.id === activeDraftId
          ? {
            ...d,
            cart,
            giftCart,
            billDiscountType,
            billDiscountValue,
            billDiscountInputMode,
            billCustomPriceText,
            customerPhone,
            customerName,
            isExistingCustomer,
            customerOrders,
            customerDebtSummary,
            paymentMethod,
            splitPayments,
            debtDueDate,
            hasCardFee,
            cardFeePercent,
            note,
            editingServerDraftOrder,
          }
          : d
      ),
    [
      drafts,
      activeDraftId,
      cart,
      giftCart,
      billDiscountType,
      billDiscountValue,
      billDiscountInputMode,
      billCustomPriceText,
      customerPhone,
      customerName,
      isExistingCustomer,
      customerOrders,
      customerDebtSummary,
      paymentMethod,
      splitPayments,
      debtDueDate,
      hasCardFee,
      cardFeePercent,
      note,
      editingServerDraftOrder,
    ]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(POS_DRAFTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const userId = getStoredUser()?._id || "";
        if (
          parsed &&
          parsed.userId === userId &&
          Array.isArray(parsed.drafts) &&
          parsed.drafts.length > 0
        ) {
          const loaded: DraftOrder[] = parsed.drafts
            .filter((d: any) => d && typeof d.id === "string")
            .slice(0, MAX_DRAFTS)
            .map((d: any, idx: number) => ({
              ...createEmptyDraftData(),
              ...d,
              seq: Number(d.seq) || idx + 1,
            }));
          if (loaded.length > 0) {
            const active =
              loaded.find((d) => d.id === parsed.activeDraftId) || loaded[0];
            setDrafts(loaded);
            setActiveDraftId(active.id);
            activeDraftIdRef.current = active.id;
            applyDraftData(active);
          }
        }
      }
    } catch {
      // ignore
    }
    setDraftsHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!draftsHydrated || typeof window === "undefined") return;
    try {
      sessionStorage.setItem(
        POS_DRAFTS_STORAGE_KEY,
        JSON.stringify({
          userId: getStoredUser()?._id || "",
          activeDraftId,
          drafts: liveDrafts,
        })
      );
    } catch {
      // ignore
    }
  }, [draftsHydrated, liveDrafts, activeDraftId]);

  const handleSwitchDraft = (targetId: string) => {
    if (submitting || targetId === activeDraftId) return;
    const target = drafts.find((d) => d.id === targetId);
    if (!target) return;
    const current = getCurrentDraftData();
    setDrafts((prev) =>
      prev.map((d) => (d.id === activeDraftId ? { ...d, ...current } : d))
    );
    applyDraftData(target);
    setActiveDraftId(targetId);
    activeDraftIdRef.current = targetId;
  };

  const handleAddDraft = () => {
    if (submitting) return;
    if (drafts.length >= MAX_DRAFTS) {
      setErrorMsg(
        `Chỉ mở tối đa ${MAX_DRAFTS} đơn cùng lúc. Vui lòng hoàn tất hoặc đóng bớt đơn.`
      );
      return;
    }
    const nextSeq = drafts.reduce((m, d) => Math.max(m, d.seq), 0) + 1;
    const newDraft = createDraft(nextSeq);
    const current = getCurrentDraftData();
    setDrafts((prev) => [
      ...prev.map((d) => (d.id === activeDraftId ? { ...d, ...current } : d)),
      newDraft,
    ]);
    applyDraftData(newDraft);
    setActiveDraftId(newDraft.id);
    activeDraftIdRef.current = newDraft.id;
  };

  const removeDraft = (draftId: string) => {
    const idx = liveDrafts.findIndex((d) => d.id === draftId);
    const remaining = liveDrafts.filter((d) => d.id !== draftId);

    if (remaining.length === 0) {
      const fresh = createDraft(1);
      setDrafts([fresh]);
      applyDraftData(fresh);
      setActiveDraftId(fresh.id);
      activeDraftIdRef.current = fresh.id;
      return;
    }

    setDrafts(remaining);
    if (draftId === activeDraftId) {
      const next = remaining[Math.min(Math.max(idx, 0), remaining.length - 1)];
      applyDraftData(next);
      setActiveDraftId(next.id);
      activeDraftIdRef.current = next.id;
    }
  };

  const handleCloseDraft = (draftId: string) => {
    if (submitting) return;
    const d = liveDrafts.find((x) => x.id === draftId);
    if (!d) return;
    if (
      !isDraftEmpty(d) &&
      typeof window !== "undefined" &&
      !window.confirm(
        `Hủy "Đơn ${d.seq}"${d.customerName ? ` (${d.customerName})` : ""}? Giỏ hàng của đơn này sẽ bị xóa.`
      )
    ) {
      return;
    }
    removeDraft(draftId);
  };

  const catalogById = useMemo(() => {
    const map = new Map<string, Product>();
    allCatalogProducts.forEach((p) => map.set(p._id, p));
    products.forEach((p) => map.set(p._id, p));
    return map;
  }, [allCatalogProducts, products]);

  useEffect(() => {
    if (catalogById.size === 0) return;
    const refresh = <T extends { product: Product }>(items: T[]): T[] => {
      if (!Array.isArray(items)) return [];
      let changed = false;
      const next = items.map((it) => {
        const fresh = catalogById.get(it.product._id);
        if (fresh && fresh !== it.product) {
          changed = true;
          return { ...it, product: fresh };
        }
        return it;
      });
      return changed ? next : items;
    };
    setCart((prev) => refresh(prev));
    setGiftCart((prev) => refresh(prev));
    setDrafts((prev) =>
      prev.map((d) => {
        const c = refresh(d.cart || []);
        const g = refresh(d.giftCart || []);
        return c === d.cart && g === d.giftCart ? d : { ...d, cart: c, giftCart: g };
      })
    );
  }, [catalogById]);

  const getDirectFloor1Stock = (p: Product): number => {
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

  const getFloor1Stock = (p: Product): number => {
    const direct = getDirectFloor1Stock(p);
    const unpackable = Math.max(0, Number(p.maxUnpackableFloor1) || 0);
    return direct + unpackable;
  };

  const getVariantFloor1Stock = (
    p: Product,
    color?: string,
    size?: string
  ): number => {
    const unpackable = Math.max(0, Number(p.maxUnpackableFloor1) || 0);
    if (Array.isArray(p.variants) && p.variants.length > 0 && (color || size)) {
      const cNorm = String(color || "").trim().toLowerCase();
      const sNorm = String(size || "").trim().toUpperCase();
      const matched = p.variants.find(
        (v) =>
          String(v.color || "").trim().toLowerCase() === cNorm &&
          String(v.size || "").trim().toUpperCase() === sNorm
      );
      if (matched) {
        return Math.max(0, Number(matched.stockFloor1 ?? matched.stock) || 0) + unpackable;
      }
    }
    return getFloor1Stock(p);
  };

  const getCategoryName = (p: Product): string => {
    if (p.categoryName) return p.categoryName;
    if (typeof p.categoryId === "object" && p.categoryId?.name) {
      return p.categoryId.name;
    }
    const rawId = String(p.categoryId || "").trim();
    const found = categories.find(
      (c) =>
        c._id === rawId ||
        (p.categoryCode && c.code?.toLowerCase() === p.categoryCode.toLowerCase()) ||
        (rawId && (c.code?.toLowerCase() === rawId.toLowerCase() || c.name?.toLowerCase() === rawId.toLowerCase()))
    );
    return found?.name || "Khác";
  };

  const getCategoryId = (p: Product): string => {
    if (typeof p.categoryId === "object" && p.categoryId?._id) {
      return p.categoryId._id;
    }
    const rawId = String(p.categoryId || "").trim();
    if (rawId && categories.some((c) => c._id === rawId)) {
      return rawId;
    }
    const byCodeOrName = categories.find(
      (c) =>
        (p.categoryCode && c.code?.toLowerCase() === p.categoryCode.toLowerCase()) ||
        (p.categoryName && c.name?.toLowerCase() === p.categoryName.toLowerCase()) ||
        (rawId && (c.code?.toLowerCase() === rawId.toLowerCase() || c.name?.toLowerCase() === rawId.toLowerCase()))
    );
    return byCodeOrName?._id || rawId;
  };

  const fetchCategories = useCallback(async () => {
    try {
      const res = await apiRequest<Category[]>("/categories");
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch {
      // ignore
    }
  }, []);

  const fetchActivePromotions = useCallback(async () => {
    try {
      const res = await apiRequest<Promotion[]>("/promotions?activeOnly=true");
      setActivePromotions(Array.isArray(res.data) ? res.data : []);
    } catch {
      // ignore
    }
  }, []);

  const debouncedSearch = useDebounce(search, 400);
  const debouncedGiftSearch = useDebounce(giftSearch, 300);
  const debouncedCustomerPhone = useDebounce(customerPhone, 500);
  const phoneTypedByUserRef = useRef(false);

  const fetchSellableProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const q = new URLSearchParams();
      if (debouncedSearch.trim()) q.set("search", debouncedSearch.trim());
      const res = await apiRequest<Product[]>(`/products?${q.toString()}`);
      const list = Array.isArray(res.data) ? res.data : [];
      setProducts(list);
      if (!debouncedSearch.trim()) {
        setAllCatalogProducts(list);
      } else {
        setAllCatalogProducts((prev) => {
          if (prev.length === 0) return list;
          const byId = new Map(prev.map((p) => [p._id, p]));
          list.forEach((p) => byId.set(p._id, p));
          return Array.from(byId.values());
        });
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể tải danh sách sản phẩm");
    } finally {
      setLoadingProducts(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchCategories();
    fetchActivePromotions();
    apiRequest("/service-orders")
      .then((res) => {
        if (res.meta) setServiceMeta(res.meta as unknown as ServiceOrdersMeta);
      })
      .catch(() => {});
  }, [fetchCategories, fetchActivePromotions]);

  const fetchSavedDraftOrders = useCallback(async () => {
    setLoadingSavedDrafts(true);
    try {
      const res = await apiRequest<Order[]>("/orders?status=DRAFT");
      setSavedDraftOrders(Array.isArray(res.data) ? res.data : []);
    } catch {
      // ignore
    } finally {
      setLoadingSavedDrafts(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedDraftOrders();
  }, [fetchSavedDraftOrders]);

  // Tự động làm mới danh sách bản nháp khi qua 00:00 sang ngày mới
  useEffect(() => {
    let lastDay = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
    const timer = setInterval(() => {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (today !== lastDay) {
        lastDay = today;
        setSavedDraftOrders([]);
        setCustomerOrders([]);
        fetchSavedDraftOrders();
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [fetchSavedDraftOrders]);

  useEffect(() => {
    fetchSellableProducts();
  }, [fetchSellableProducts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(PINNED_GIFTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setPinnedGiftIds(parsed.map(String));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const togglePinGiftProduct = (productId: string) => {
    setPinnedGiftIds((prev) => {
      const exists = prev.includes(productId);
      const next = exists ? prev.filter((id) => id !== productId) : [productId, ...prev];
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(PINNED_GIFTS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const floor1Products = useMemo(() => {
    return products.filter((p) => getFloor1Stock(p) > 0);
  }, [products]);

  const filteredAndSortedProducts = useMemo(() => {
    const categoryFiltered = floor1Products.filter((p) => {
      if (selectedCategoryId && getCategoryId(p) !== selectedCategoryId) {
        return false;
      }
      return true;
    });

    const hasSearch = search.trim().length > 0;
    const searched = hasSearch
      ? filterAndRankBySearch(categoryFiltered, search, (p) => [
        { text: p.code, weight: 1.5 },
        { text: p.barcode, weight: 1.5 },
        { text: p.name, weight: 1.3 },
        { text: p.brand, weight: 1.1 },
        { text: getCategoryName(p), weight: 0.9 },
        { text: p.categoryCode, weight: 0.9 },
        {
          text: (p.variants || [])
            .map(
              (v) =>
                `${v.variantCode || resolveVariantCode(p, p.code, v.color, v.size)} ${v.color} ${v.size}`
            )
            .join(" "),
          weight: 1.4,
        },
        { text: p.unit, weight: 0.6 },
      ])
      : categoryFiltered;

    if (hasSearch && sortBy === "CATEGORY") {
      return searched;
    }

    const sorted = [...searched];
    sorted.sort((a, b) => {
      if (sortBy === "CATEGORY") {
        const catA = getCategoryName(a);
        const catB = getCategoryName(b);
        const cmpCat = catA.localeCompare(catB, "vi");
        if (cmpCat !== 0) return cmpCat;
        return a.name.localeCompare(b.name, "vi");
      }
      if (sortBy === "NAME_ASC") {
        return a.name.localeCompare(b.name, "vi");
      }
      if (sortBy === "PRICE_ASC") {
        return (Number(a.sellingPrice) || 0) - (Number(b.sellingPrice) || 0);
      }
      if (sortBy === "PRICE_DESC") {
        return (Number(b.sellingPrice) || 0) - (Number(a.sellingPrice) || 0);
      }
      if (sortBy === "STOCK_DESC") {
        return getFloor1Stock(b) - getFloor1Stock(a);
      }
      return 0;
    });

    return sorted;
  }, [floor1Products, selectedCategoryId, search, sortBy, categories]);

  const groupedByCategory = useMemo(() => {
    const groups = new Map<string, Product[]>();
    filteredAndSortedProducts.forEach((p) => {
      const catName = getCategoryName(p);
      const list = groups.get(catName) || [];
      list.push(p);
      groups.set(catName, list);
    });
    return Array.from(groups.entries());
  }, [filteredAndSortedProducts, categories]);

  const handleLookupPhone = async (phoneValue: string) => {
    const clean = cleanPhoneDigits(phoneValue);
    if (clean.length < 9) {
      setIsExistingCustomer(false);
      setCustomerOrders([]);
      setCustomerDebtSummary(null);
      return;
    }
    setLookingUp(true);
    const draftIdAtStart = activeDraftIdRef.current;
    try {
      const res = await apiRequest<any>(`/customers/lookup?phone=${encodeURIComponent(clean)}`);
      if (activeDraftIdRef.current !== draftIdAtStart) return;
      const customer = res.data?.customer || res.data;
      const orders = res.data?.orders || [];
      if (customer && (customer.fullName || customer.name || customer.customerName)) {
        setCustomerName(customer.fullName || customer.name || customer.customerName);
        setIsExistingCustomer(true);
        setCustomerOrders(Array.isArray(orders) ? orders : []);
        setCustomerDebtSummary(res.data?.debtSummary || null);
      } else {
        setIsExistingCustomer(false);
        setCustomerOrders([]);
        setCustomerDebtSummary(null);
      }
    } catch {
      setIsExistingCustomer(false);
      setCustomerOrders([]);
      setCustomerDebtSummary(null);
    } finally {
      setLookingUp(false);
    }
  };

  useEffect(() => {
    if (!phoneTypedByUserRef.current) return;
    const clean = cleanPhoneDigits(debouncedCustomerPhone);
    if (clean.length < 9) {
      setIsExistingCustomer(false);
      setCustomerOrders([]);
      setCustomerDebtSummary(null);
      return;
    }
    handleLookupPhone(debouncedCustomerPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedCustomerPhone]);

  const getCartQty = (productId: string): number => {
    return cart
      .filter((c) => c.product._id === productId)
      .reduce((sum, c) => sum + c.quantity, 0);
  };

  const getCartVariantQty = (productId: string, color?: string, size?: string): number => {
    const key = getCartLineKey(productId, color, size);
    return cart
      .filter((c) => getCartLineKey(c.product._id, c.color, c.size) === key)
      .reduce((sum, c) => sum + c.quantity, 0);
  };

  const getGiftQty = (productId: string): number => {
    return giftCart
      .filter((g) => g.product._id === productId)
      .reduce((sum, g) => sum + g.quantity, 0);
  };

  const getProductPromotions = useCallback(
    (p: Product): Promotion[] => {
      const catId = getCategoryId(p);
      return activePromotions.filter((promo) => {
        if (!promo.isCurrentlyActive) return false;
        if (promo.conditionType === "BUY_PRODUCTS") {
          return (promo.conditionProductIds || []).includes(p._id);
        }
        if (promo.conditionType === "BUY_CATEGORY") {
          return (promo.conditionCategoryIds || []).includes(catId);
        }
        return promo.conditionType === "ALL_PRODUCTS";
      });
    },
    [activePromotions, categories]
  );

  const applyPromotionsForCart = useCallback(
    (
      rawNextCart: CartItem[],
      currentGiftCart: GiftCartItem[],
      promos: Promotion[] = activePromotions
    ) => {
      const rawCartAmount = rawNextCart.reduce(
        (s, ci) => s + cartUnitPrice(ci) * ci.quantity,
        0
      );

      const nextAppliedSummary: {
        _id: string;
        code: string;
        name: string;
        multiplier: number;
        details: string[];
      }[] = [];

      const autoGiftMap = new Map<
        string,
        {
          giftInfo: any;
          requestedQty: number;
          promoNames: string[];
        }
      >();

      const itemDiscMap = new Map<
        string,
        {
          discountType: DiscountType;
          discountValue: number;
          discountPerUnit: number;
          promoName: string;
        }
      >();

      let bestBillDisc: {
        discountType: DiscountType;
        discountValue: number;
        estAmount: number;
        promoName: string;
      } | null = null;

      for (const promo of promos) {
        if (!promo.isCurrentlyActive) continue;

        let matchingItems: CartItem[] = [];
        if (promo.conditionType === "BUY_PRODUCTS") {
          const setIds = new Set((promo.conditionProductIds || []).map(String));
          matchingItems = rawNextCart.filter((ci) =>
            setIds.has(String(ci.product._id))
          );
        } else if (promo.conditionType === "BUY_CATEGORY") {
          const setCatIds = new Set(
            (promo.conditionCategoryIds || []).map(String)
          );
          matchingItems = rawNextCart.filter((ci) =>
            setCatIds.has(getCategoryId(ci.product))
          );
        } else {
          matchingItems = [...rawNextCart];
        }

        const matchedQty = matchingItems.reduce((s, ci) => s + ci.quantity, 0);
        const minQty = Math.max(1, Number(promo.minQuantity) || 1);
        const minOrderAmt = Math.max(0, Number(promo.minOrderAmount) || 0);

        if (
          matchingItems.length === 0 ||
          matchedQty < minQty ||
          rawCartAmount < minOrderAmt
        ) {
          continue;
        }

        const multiplier =
          promo.multiplyGiftByConditionQty !== false
            ? Math.max(1, Math.floor(matchedQty / minQty))
            : 1;

        const details: string[] = [];

        for (const g of promo.giftItems || []) {
          const gid = String(g.productId);
          const addQty = Math.max(1, Number(g.quantity) || 1) * multiplier;
          const prev = autoGiftMap.get(gid);
          if (prev) {
            prev.requestedQty += addQty;
            if (!prev.promoNames.includes(promo.name)) {
              prev.promoNames.push(promo.name);
            }
          } else {
            autoGiftMap.set(gid, {
              giftInfo: g,
              requestedQty: addQty,
              promoNames: [promo.name],
            });
          }
          details.push(`🎁 Tặng ${addQty} ${g.unit || "Cái"} ${g.productName}`);
        }

        if (
          promo.itemDiscountType &&
          promo.itemDiscountType !== "NONE" &&
          promo.itemDiscountValue > 0
        ) {
          for (const ci of matchingItems) {
            const pid = ci.product._id;
            const origPrice = cartUnitPrice(ci);
            const discPerUnit =
              promo.itemDiscountType === "PERCENT"
                ? Math.round((origPrice * promo.itemDiscountValue) / 100)
                : Math.min(origPrice, Math.round(promo.itemDiscountValue));

            const prev = itemDiscMap.get(pid);
            if (!prev || discPerUnit > prev.discountPerUnit) {
              itemDiscMap.set(pid, {
                discountType: promo.itemDiscountType as DiscountType,
                discountValue: promo.itemDiscountValue,
                discountPerUnit: discPerUnit,
                promoName: promo.name,
              });
            }
          }
          details.push(
            `🏷️ Giảm ${promo.itemDiscountType === "PERCENT"
              ? `${promo.itemDiscountValue}%`
              : `${formatVND(promo.itemDiscountValue)}/SP`
            }`
          );
        }

        if (
          promo.billDiscountType &&
          promo.billDiscountType !== "NONE" &&
          promo.billDiscountValue > 0
        ) {
          const estAmt =
            promo.billDiscountType === "PERCENT"
              ? Math.round((rawCartAmount * promo.billDiscountValue) / 100)
              : Math.min(rawCartAmount, Math.round(promo.billDiscountValue));
          if (!bestBillDisc || estAmt > bestBillDisc.estAmount) {
            bestBillDisc = {
              discountType: promo.billDiscountType as DiscountType,
              discountValue: promo.billDiscountValue,
              estAmount: estAmt,
              promoName: promo.name,
            };
          }
          details.push(
            `🧾 Giảm Bill ${promo.billDiscountType === "PERCENT"
              ? `${promo.billDiscountValue}%`
              : formatVND(promo.billDiscountValue)
            }`
          );
        }

        nextAppliedSummary.push({
          _id: promo._id,
          code: promo.code,
          name: promo.name,
          multiplier,
          details,
        });
      }

      const nextCartWithDiscounts: CartItem[] = rawNextCart.map((c) => {
        if (c.isManualDiscount) return c;
        const autoDisc = itemDiscMap.get(c.product._id);
        if (autoDisc) {
          return {
            ...c,
            discountType: autoDisc.discountType,
            discountValue: autoDisc.discountValue,
            autoPromoName: autoDisc.promoName,
          };
        }
        if (c.autoPromoName) {
          return {
            ...c,
            discountType: "NONE",
            discountValue: 0,
            autoPromoName: undefined,
          };
        }
        return c;
      });

      const manualGifts = currentGiftCart
        .filter((g) => !g.isAutoPromo)
        .map((g) => {
          const inSale = nextCartWithDiscounts
            .filter((c) => c.product._id === g.product._id)
            .reduce((s, c) => s + c.quantity, 0);
          const maxGift = Math.max(0, getFloor1Stock(g.product) - inSale);
          return maxGift > 0
            ? { ...g, quantity: Math.min(g.quantity, maxGift) }
            : null;
        })
        .filter(Boolean) as GiftCartItem[];

      const autoGifts: GiftCartItem[] = [];
      for (const [gid, entry] of Array.from(autoGiftMap.entries())) {
        const foundProd =
          catalogById.get(gid) ||
          products.find((p) => p._id === gid) ||
          ({
            _id: gid,
            code: entry.giftInfo.productCode || "",
            name: entry.giftInfo.productName || "Sản phẩm tặng kèm",
            categoryId: "",
            unit: entry.giftInfo.unit || "Cái",
            sellingPrice: Number(entry.giftInfo.sellingPrice) || 0,
            stockFloor1: Number(entry.giftInfo.stockFloor1) || 0,
            stock: Number(entry.giftInfo.stockFloor1) || 0,
          } as Product);

        const floor1Stock = getFloor1Stock(foundProd);
        const inSale = nextCartWithDiscounts
          .filter((c) => c.product._id === gid)
          .reduce((s, c) => s + c.quantity, 0);
        const inManual =
          manualGifts.find((m) => m.product._id === gid)?.quantity || 0;
        const available = Math.max(0, floor1Stock - inSale - inManual);
        const finalQty = Math.min(entry.requestedQty, available);

        if (finalQty > 0) {
          autoGifts.push({
            product: foundProd,
            quantity: finalQty,
            isAutoPromo: true,
            promoName: entry.promoNames.join(", "),
          });
        }
      }

      setCart(nextCartWithDiscounts);
      setGiftCart([...autoGifts, ...manualGifts]);
      setAppliedPromosSummary(nextAppliedSummary);

      if (!isManualBillDiscount) {
        if (bestBillDisc) {
          setBillDiscountType(bestBillDisc.discountType);
          setBillDiscountValue(bestBillDisc.discountValue);
          setAutoBillPromoName(bestBillDisc.promoName);
        } else if (autoBillPromoName) {
          setBillDiscountType("NONE");
          setBillDiscountValue(0);
          setAutoBillPromoName("");
        }
      }
    },
    [
      activePromotions,
      products,
      categories,
      isManualBillDiscount,
      autoBillPromoName,
    ]
  );

  // Mở popup chọn Size/Màu nếu sản phẩm có nhiều phân loại, hoặc thêm thẳng nếu chỉ có 1 phân loại
  const handleSelectProductForPos = (product: Product) => {
    const namedVariants = (product.variants || []).filter(
      (v) => (v.color || v.size) && (Number(v.stockFloor1 ?? v.stock) || 0) > 0
    );
    if (namedVariants.length > 1) {
      setVariantPickerProduct(product);
      return;
    }
    if (namedVariants.length === 1) {
      handleAddToCart(product, namedVariants[0].color, namedVariants[0].size);
      return;
    }
    const allNamed = (product.variants || []).filter((v) => v.color || v.size);
    if (allNamed.length > 0) {
      setVariantPickerProduct(product);
      return;
    }
    handleAddToCart(product, product.color || "", product.size || "");
  };

  const handleAddToCart = (
    product: Product,
    colorParam?: string,
    sizeParam?: string
  ): boolean => {
    setErrorMsg("");
    const color = String(colorParam ?? product.color ?? "").trim();
    const size = String(sizeParam ?? product.size ?? "").trim().toUpperCase();

    const floor1Stock = getFloor1Stock(product);
    const variantStock = getVariantFloor1Stock(product, color, size);
    const variantLabel = formatVariantLabel(color, size);

    if (cartUnitPrice({ product, color, size }) <= 0) {
      setErrorMsg(
        `Sản phẩm "${product.name}" chưa có giá niêm yết (> 0). Vui lòng cập nhật giá trên CMS trước khi bán.`
      );
      return false;
    }
    if (floor1Stock <= 0 || variantStock <= 0) {
      setErrorMsg(
        `Sản phẩm "${product.name}"${variantLabel ? ` (${variantLabel})` : ""} đã hết hàng tại Kho Tầng 1.`
      );
      return false;
    }

    const manualGiftedQty = giftCart
      .filter((g) => !g.isAutoPromo && g.product._id === product._id)
      .reduce((s, g) => s + g.quantity, 0);
    const totalSaleForProd = getCartQty(product._id);

    if (totalSaleForProd + manualGiftedQty + 1 > floor1Stock) {
      setErrorMsg(
        `Không được vượt tổng số lượng Kho Tầng 1 (${floor1Stock} ${product.unit}) của "${product.name}".`
      );
      return false;
    }

    const lineKey = getCartLineKey(product._id, color, size);
    const existing = cart.find(
      (c) => getCartLineKey(c.product._id, c.color, c.size) === lineKey
    );
    const currentVariantQty = existing ? existing.quantity : 0;

    if ((color || size) && currentVariantQty + 1 > variantStock) {
      setErrorMsg(
        `Phân loại "${variantLabel}" của "${product.name}" chỉ còn ${variantStock} ${product.unit} tại Kho Tầng 1.`
      );
      return false;
    }

    const nextCart: CartItem[] = existing
      ? cart.map((c) =>
        getCartLineKey(c.product._id, c.color, c.size) === lineKey
          ? { ...c, quantity: c.quantity + 1 }
          : c
      )
      : [
        ...cart,
        {
          product,
          color,
          size,
          quantity: 1,
          discountType: "NONE",
          discountValue: 0,
        },
      ];

    applyPromotionsForCart(nextCart, giftCart);
    return true;
  };

  /**
   * Xử lý khi Máy Quét Label bắn mã sản phẩm vào màn hình POS (Quét bán hàng):
   * - Tự động khử lỗi bộ gõ Tiếng Việt (Unikey Telex) & khớp Mã SP chung (hoặc kèm Size/Màu).
   * - Nếu SP chỉ có 1 phân loại còn hàng ở Tầng 1: cộng ngay +1 vào Giỏ hàng + phát tiếng Bíp.
   * - Nếu SP có nhiều Size/Màu ở Tầng 1: bật Popup chọn nhanh Size/Màu (hỗ trợ bấm phím số 1..9).
   */
  const handleBarcodeScanForPos = async (rawInput: string) => {
    const trimmed = String(rawInput || "").trim();
    if (!trimmed) return;

    const nowStr = new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const candidates = getBarcodeCandidates(trimmed);
    const displayCode = candidates[1] || candidates[0] || cleanBarcodeCode(trimmed) || trimmed.toUpperCase();

    const sourceCatalog = allCatalogProducts.length > 0 ? allCatalogProducts : products;
    let scanRes = findProductAndVariantByScannedBarcode(sourceCatalog, trimmed);
    // v5.0: tra cứu server theo mã mới / mã con / mã cũ (legacy) / mã rút gọn tem cũ
    if (!scanRes) {
      try {
        const hit = await lookupProductByCodeApi(trimmed);
        if (hit?.product) {
          const v = hit.variant;
          scanRes = {
            product: hit.product,
            matchedVariant: v
              ? {
                  ...v,
                  variantCode: v.variantCode || v.barcode || hit.product.code,
                  stockFloor1: Number(v.stockFloor1 || 0),
                  stockFloor2: Number(v.stockFloor2 || 0),
                  stock: Number(v.stock || 0),
                }
              : undefined,
            isVariantExactMatch: Boolean(v),
          };
        }
      } catch {
        // ignore -> thử tải lại danh mục
      }
    }
    if (!scanRes) {
      try {
        const freshRes = await apiRequest<Product[]>("/products");
        const freshPool = Array.isArray(freshRes.data) ? freshRes.data : [];
        if (freshPool.length > 0) {
          setAllCatalogProducts(freshPool);
          scanRes = findProductAndVariantByScannedBarcode(freshPool, trimmed);
        }
      } catch {
        // ignore network error
      }
    }
    const matchedProduct = scanRes?.product || null;

    if (!matchedProduct) {
      playScannerBeep("error");
      const msg = `Không tìm thấy sản phẩm có mã "${displayCode}" trong danh mục kho!`;
      setErrorMsg(msg);
      setLastScanBanner({
        type: "error",
        code: displayCode,
        message: msg,
        time: nowStr,
      });
      return;
    }

    if (productDisplayPrice(matchedProduct).price <= 0) {
      playScannerBeep("error");
      const msg = `Mã ${matchedProduct.code} ("${matchedProduct.name}") chưa có giá niêm yết (> 0đ). Vui lòng cập nhật giá trên CMS.`;
      setErrorMsg(msg);
      setLastScanBanner({
        type: "error",
        code: matchedProduct.code,
        message: msg,
        time: nowStr,
      });
      return;
    }

    const f1Stock = getFloor1Stock(matchedProduct);
    const f2Stock = Number(matchedProduct.stockFloor2 || 0);
    if (f1Stock <= 0) {
      playScannerBeep("error");
      const msg = `Mã ${matchedProduct.code} ("${matchedProduct.name}") đã HẾT HÀNG tại Kho Tầng 1${f2Stock > 0 ? ` (Đang còn ${f2Stock} ${matchedProduct.unit} ở Kho Tầng 2)` : ""
        }!`;
      setErrorMsg(msg);
      setLastScanBanner({
        type: "error",
        code: matchedProduct.code,
        message: msg,
        time: nowStr,
      });
      return;
    }

    // Nếu quét trúng trực tiếp Mã con thuộc tính (VD: GASIA221401DO38) -> Cộng thẳng phân loại đó vào giỏ!
    if (scanRes?.matchedVariant && scanRes.isVariantExactMatch) {
      const exactVar = scanRes.matchedVariant;
      const childCode =
        exactVar.variantCode ||
        resolveVariantCode(matchedProduct, matchedProduct.code, exactVar.color, exactVar.size);
      const added = handleAddToCart(matchedProduct, exactVar.color, exactVar.size);
      if (added) {
        playScannerBeep("success");
        const vLabel = formatVariantLabel(exactVar.color, exactVar.size);
        const newQtyInCart =
          getCartVariantQty(matchedProduct._id, exactVar.color, exactVar.size) + 1;
        setLastScanBanner({
          type: "success",
          code: childCode,
          message: `Đã quét mã con ${childCode} → +1 "${matchedProduct.name}"${vLabel ? ` (${vLabel})` : ""
            } • ${formatVND(cartUnitPrice({ product: matchedProduct, color: exactVar.color, size: exactVar.size }))} (Trong giỏ: ${newQtyInCart} ${matchedProduct.unit})`,
          time: nowStr,
        });
        setVariantPickerProduct(null);
      } else {
        playScannerBeep("error");
      }
      return;
    }

    const availableVariants = (matchedProduct.variants || []).filter(
      (v) => (v.color || v.size) && (Number(v.stockFloor1 ?? v.stock) || 0) > 0
    );

    // Kiểm tra nếu chuỗi quét có hậu tố chỉ định rõ Size / Màu (VD: "GASIA221401 41" hoặc "GASIA221401-L")
    const parts = trimmed.split(/[-_/:|\s]+/).slice(1);
    if (parts.length > 0 && availableVariants.length > 0) {
      const suffixNorm = cleanBarcodeCode(parts.join(""));
      const matchedVariant = availableVariants.find((v) => {
        const vSize = cleanBarcodeCode(v.size || "");
        const vColor = cleanBarcodeCode(v.color || "");
        const vCombo = cleanBarcodeCode(`${v.color || ""}${v.size || ""}`);
        return (
          suffixNorm === vSize ||
          suffixNorm === vColor ||
          suffixNorm === vCombo ||
          cleanBarcodeCode(`${v.size || ""}${v.color || ""}`) === suffixNorm
        );
      });
      if (matchedVariant) {
        const added = handleAddToCart(matchedProduct, matchedVariant.color, matchedVariant.size);
        if (added) {
          playScannerBeep("success");
          const vLabel = formatVariantLabel(matchedVariant.color, matchedVariant.size);
          setLastScanBanner({
            type: "success",
            code: matchedProduct.code,
            message: `Đã quét ${matchedProduct.code} → +1 "${matchedProduct.name}" (${vLabel}) • ${formatVND(cartUnitPrice({ product: matchedProduct, color: matchedVariant.color, size: matchedVariant.size }))}`,
            time: nowStr,
          });
          setVariantPickerProduct(null);
        } else {
          playScannerBeep("error");
        }
        return;
      }
    }

    // Nếu sản phẩm có từ 2 phân loại (Màu/Size) trở lên đang còn tồn ở Tầng 1 -> Mở Popup chọn nhanh
    if (availableVariants.length > 1) {
      playScannerBeep("warning");
      setVariantPickerProduct(matchedProduct);
      setLastScanBanner({
        type: "warning",
        code: matchedProduct.code,
        message: `Đã quét ${matchedProduct.code} ("${matchedProduct.name}") — Bấm phím số [1..${availableVariants.length}] hoặc click chọn Màu/Size để thêm vào giỏ!`,
        time: nowStr,
      });
      return;
    }

    // Nếu chỉ có 1 phân loại còn hàng hoặc sản phẩm không chia Size/Màu -> Thêm thẳng +1 vào giỏ
    const targetColor =
      availableVariants.length === 1
        ? availableVariants[0].color
        : matchedProduct.color || "";
    const targetSize =
      availableVariants.length === 1
        ? availableVariants[0].size
        : matchedProduct.size || "";

    const added = handleAddToCart(matchedProduct, targetColor, targetSize);
    if (added) {
      playScannerBeep("success");
      const vLabel = formatVariantLabel(targetColor, targetSize);
      const newQtyInCart = getCartVariantQty(matchedProduct._id, targetColor, targetSize) + 1;
      setLastScanBanner({
        type: "success",
        code: matchedProduct.code,
        message: `Đã quét ${matchedProduct.code} → +1 "${matchedProduct.name}"${vLabel ? ` (${vLabel})` : ""
          } • ${formatVND(cartUnitPrice({ product: matchedProduct, color: targetColor, size: targetSize }))} (Trong giỏ: ${newQtyInCart} ${matchedProduct.unit})`,
        time: nowStr,
      });
      setVariantPickerProduct(null);
    } else {
      playScannerBeep("error");
      setLastScanBanner({
        type: "error",
        code: matchedProduct.code,
        message: `Không thể thêm thêm "${matchedProduct.name}" (Đã chạm trần tồn Kho Tầng 1: ${f1Stock} ${matchedProduct.unit}).`,
        time: nowStr,
      });
    }
  };

  // Lắng nghe máy quét mã vạch toàn cục (không cần đặt chuột vào ô input vẫn quét bán hàng được)
  useHardwareBarcodeScanner({
    enabled: scannerEnabled && !showGiftModal && posMode === "PRODUCTS",
    onScan: (scannedCode) => {
      handleBarcodeScanForPos(scannedCode);
    },
  });

  // Phím tắt chọn nhanh biến thể [1..9] hoặc Escape khi Popup chọn Size/Màu đang mở
  useEffect(() => {
    if (!variantPickerProduct || typeof window === "undefined") return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toUpperCase() || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Escape") {
        e.preventDefault();
        setVariantPickerProduct(null);
        return;
      }

      if (/^[1-9]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        const variants = variantPickerProduct.variants || [];
        const picked = variants[idx];
        if (picked) {
          const vFloor1 = Math.max(0, Number(picked.stockFloor1 ?? picked.stock) || 0);
          const inCartQty = getCartVariantQty(
            variantPickerProduct._id,
            picked.color,
            picked.size
          );
          if (vFloor1 > 0 && inCartQty < vFloor1) {
            e.preventDefault();
            const added = handleAddToCart(variantPickerProduct, picked.color, picked.size);
            if (added) {
              playScannerBeep("success");
              const vLabel = formatVariantLabel(picked.color, picked.size);
              setLastScanBanner({
                type: "success",
                code: variantPickerProduct.code,
                message: `Đã chọn [${idx + 1}] ${vLabel} của "${variantPickerProduct.name}" (+1 vào giỏ hàng)`,
                time: new Date().toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }),
              });
              setVariantPickerProduct(null);
            }
          }
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const handleChangeQty = (
    productId: string,
    newQty: number,
    color?: string,
    size?: string
  ) => {
    setErrorMsg("");
    const lineKey = getCartLineKey(productId, color, size);
    const manualGiftedQty = giftCart
      .filter((g) => !g.isAutoPromo && g.product._id === productId)
      .reduce((s, g) => s + g.quantity, 0);

    const otherVariantsQty = cart
      .filter(
        (c) =>
          c.product._id === productId &&
          getCartLineKey(c.product._id, c.color, c.size) !== lineKey
      )
      .reduce((s, c) => s + c.quantity, 0);

    const nextCart = cart
      .map((c) => {
        if (getCartLineKey(c.product._id, c.color, c.size) !== lineKey) return c;
        if (newQty <= 0) return null;
        const floor1Stock = getFloor1Stock(c.product);
        const variantStock = getVariantFloor1Stock(c.product, c.color, c.size);
        const maxByTotal = Math.max(
          0,
          floor1Stock - manualGiftedQty - otherVariantsQty
        );
        const maxAllowedForSale =
          c.color || c.size ? Math.min(maxByTotal, variantStock) : maxByTotal;

        if (newQty > maxAllowedForSale) {
          const vLabel = formatVariantLabel(c.color, c.size);
          setErrorMsg(
            `Không được vượt tồn Kho Tầng 1 của "${c.product.name}"${vLabel ? ` (${vLabel})` : ""} (Tối đa: ${maxAllowedForSale} ${c.product.unit}).`
          );
          return maxAllowedForSale > 0
            ? { ...c, quantity: maxAllowedForSale }
            : null;
        }
        return { ...c, quantity: newQty };
      })
      .filter(Boolean) as CartItem[];

    applyPromotionsForCart(nextCart, giftCart);
  };

  const handleAddGiftProduct = (product: Product) => {
    setErrorMsg("");
    const floor1Stock = getFloor1Stock(product);
    const saleQty = getCartQty(product._id);
    if (floor1Stock - saleQty <= 0) {
      setErrorMsg(
        `Sản phẩm "${product.name}" không còn đủ tồn Kho Tầng 1 để tặng thêm (Tồn T1: ${floor1Stock}, đang bán: ${saleQty}).`
      );
      return;
    }

    setGiftCart((prev) => {
      const existing = prev.find((g) => g.product._id === product._id);
      const currentGiftQty = existing ? existing.quantity : 0;
      if (saleQty + currentGiftQty + 1 > floor1Stock) {
        setErrorMsg(
          `Không được tặng vượt tồn Kho Tầng 1 (${floor1Stock} ${product.unit}) của "${product.name}".`
        );
        return prev;
      }
      if (existing) {
        return prev.map((g) =>
          g.product._id === product._id ? { ...g, quantity: g.quantity + 1 } : g
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleChangeGiftQty = (productId: string, newQty: number) => {
    setErrorMsg("");
    const saleQty = getCartQty(productId);
    setGiftCart((prev) =>
      prev
        .map((g) => {
          if (g.product._id !== productId) return g;
          if (newQty <= 0) return null;
          const floor1Stock = getFloor1Stock(g.product);
          const maxGiftAllowed = Math.max(0, floor1Stock - saleQty);
          if (newQty > maxGiftAllowed) {
            setErrorMsg(
              `Không được tặng vượt tồn Kho Tầng 1 của "${g.product.name}" (Tối đa tặng thêm: ${maxGiftAllowed} ${g.product.unit}).`
            );
            return maxGiftAllowed > 0 ? { ...g, quantity: maxGiftAllowed } : null;
          }
          return { ...g, quantity: newQty };
        })
        .filter(Boolean) as GiftCartItem[]
    );
  };

  const pinnedFloor1Count = useMemo(
    () => floor1Products.filter((p) => pinnedGiftIds.includes(p._id)).length,
    [floor1Products, pinnedGiftIds]
  );

  const popupGiftProducts = useMemo(() => {
    const q = debouncedGiftSearch.trim();

    const categoryFiltered = floor1Products.filter((p) => {
      if (giftCategoryId === "PINNED") {
        if (!pinnedGiftIds.includes(p._id)) return false;
      } else if (
        giftCategoryId &&
        giftCategoryId !== "ALL" &&
        getCategoryId(p) !== giftCategoryId
      ) {
        return false;
      }
      return true;
    });

    if (q) {
      return filterAndRankBySearch(categoryFiltered, q, (p) => [
        { text: p.code, weight: 1.5 },
        { text: p.barcode, weight: 1.5 },
        { text: p.name, weight: 1.3 },
        { text: getCategoryName(p), weight: 0.9 },
      ]);
    }

    return [...categoryFiltered].sort((a, b) => {
      const aPinned = pinnedGiftIds.includes(a._id);
      const bPinned = pinnedGiftIds.includes(b._id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      if (aPinned && bPinned) {
        return pinnedGiftIds.indexOf(a._id) - pinnedGiftIds.indexOf(b._id);
      }
      return (a.name || "").localeCompare(b.name || "", "vi");
    });
  }, [floor1Products, giftCategoryId, debouncedGiftSearch, pinnedGiftIds, categories]);

  const handleChangeItemDiscount = (
    productId: string,
    discountType: DiscountType,
    rawVal: number,
    color?: string,
    size?: string,
    discountInputMode?: "NONE" | "PERCENT" | "AMOUNT" | "PRICE",
    customPriceText?: string
  ) => {
    const lineKey = getCartLineKey(productId, color, size);
    setCart((prev) =>
      prev.map((c) => {
        if (getCartLineKey(c.product._id, c.color, c.size) !== lineKey) return c;
        const origPrice = cartUnitPrice(c);
        let cleanVal = Math.max(0, rawVal);
        if (discountType === "PERCENT") {
          cleanVal = Math.min(100, cleanVal);
        } else if (discountType === "AMOUNT") {
          cleanVal = Math.min(origPrice, Math.round(cleanVal));
        } else {
          cleanVal = 0;
        }
        const resolvedMode =
          discountInputMode ||
          (discountType === "PERCENT"
            ? "PERCENT"
            : discountType === "AMOUNT"
              ? "AMOUNT"
              : "NONE");
        return {
          ...c,
          discountType,
          discountValue: cleanVal,
          discountInputMode: resolvedMode,
          customPriceText:
            resolvedMode === "PRICE"
              ? customPriceText !== undefined
                ? customPriceText
                : formatNumberDots(Math.max(0, origPrice - cleanVal))
              : undefined,
          isManualDiscount: true,
          autoPromoName: undefined,
        };
      })
    );
  };

  const handleChangeItemDesiredPrice = (
    productId: string,
    rawText: string,
    color?: string,
    size?: string
  ) => {
    const lineKey = getCartLineKey(productId, color, size);
    const digits = rawText.replace(/[^\d]/g, "");
    setCart((prev) =>
      prev.map((c) => {
        if (getCartLineKey(c.product._id, c.color, c.size) !== lineKey) return c;
        const origPrice = cartUnitPrice(c);
        if (!digits) {
          return {
            ...c,
            discountType: "NONE",
            discountValue: 0,
            discountInputMode: "NONE",
            customPriceText: "",
            isManualDiscount: false,
            autoPromoName: undefined,
          };
        }
        const enteredPrice = Math.min(origPrice, Math.max(0, Number(digits) || 0));
        const computedDiscount = Math.max(0, origPrice - enteredPrice);
        return {
          ...c,
          discountType: computedDiscount > 0 ? "AMOUNT" : "NONE",
          discountValue: computedDiscount,
          discountInputMode: "PRICE",
          customPriceText: formatNumberDots(enteredPrice),
          isManualDiscount: computedDiscount > 0,
          autoPromoName: undefined,
        };
      })
    );
  };

  const getItemPricing = (item: CartItem) => {
    const originalUnitPrice = cartUnitPrice(item);
    const discountPerUnit =
      item.discountType === "PERCENT"
        ? Math.round((originalUnitPrice * item.discountValue) / 100)
        : item.discountType === "AMOUNT"
          ? Math.min(originalUnitPrice, Math.round(item.discountValue))
          : 0;
    const unitPrice = Math.max(0, originalUnitPrice - discountPerUnit);
    const discountAmount = discountPerUnit * item.quantity;
    const lineTotal = unitPrice * item.quantity;
    return {
      originalUnitPrice,
      discountPerUnit,
      unitPrice,
      discountAmount,
      lineTotal,
    };
  };

  const giftUnitsCount = giftCart.reduce((sum, g) => sum + g.quantity, 0);

  const rawSubtotal = cart.reduce(
    (sum, item) => sum + cartUnitPrice(item) * item.quantity,
    0
  );
  const itemDiscountTotal = cart.reduce(
    (sum, item) => sum + getItemPricing(item).discountAmount,
    0
  );
  const subtotal = cart.reduce(
    (sum, item) => sum + getItemPricing(item).lineTotal,
    0
  );

  // Tự động tính lại giảm giá Bill khi giỏ hàng (subtotal) thay đổi mà nhân viên đang nhập giá Bill mục tiêu (PRICE)
  useEffect(() => {
    if (billDiscountInputMode !== "PRICE" || !billCustomPriceText) return;
    if (subtotal <= 0) {
      setBillDiscountType("NONE");
      setBillDiscountInputMode("NONE");
      setBillCustomPriceText("");
      setBillDiscountValue(0);
      setIsManualBillDiscount(false);
      return;
    }
    const rawTarget = parseNumberDots(billCustomPriceText);
    const clampedTarget = Math.min(subtotal, Math.max(0, rawTarget));
    const recomputedDiscount = Math.max(0, subtotal - clampedTarget);
    const nextType: DiscountType = recomputedDiscount > 0 ? "AMOUNT" : "NONE";
    const formattedTarget = formatNumberDots(clampedTarget);

    if (billDiscountType !== nextType) {
      setBillDiscountType(nextType);
    }
    if (billDiscountValue !== recomputedDiscount) {
      setBillDiscountValue(recomputedDiscount);
    }
    if (billCustomPriceText !== formattedTarget) {
      setBillCustomPriceText(formattedTarget);
    }
  }, [
    subtotal,
    billDiscountInputMode,
    billCustomPriceText,
    billDiscountType,
    billDiscountValue,
  ]);

  const cleanBillDiscountValue =
    billDiscountInputMode === "PRICE" && billCustomPriceText !== ""
      ? Math.max(
          0,
          subtotal - Math.min(subtotal, Math.max(0, parseNumberDots(billCustomPriceText)))
        )
      : billDiscountType === "PERCENT"
        ? Math.min(100, Math.max(0, billDiscountValue))
        : billDiscountType === "AMOUNT"
          ? Math.min(subtotal, Math.max(0, Math.round(billDiscountValue)))
          : 0;

  const billDiscountAmount =
    billDiscountInputMode === "PRICE" && billCustomPriceText !== ""
      ? cleanBillDiscountValue
      : billDiscountType === "PERCENT"
        ? Math.round((subtotal * cleanBillDiscountValue) / 100)
        : billDiscountType === "AMOUNT"
          ? cleanBillDiscountValue
          : 0;

  const afterBillDiscount = Math.max(0, subtotal - billDiscountAmount);
  const cardFee =
    paymentMethod === "CARD" ? Math.round((afterBillDiscount * cardFeePercent) / 100) : 0;
  const totalAmount = afterBillDiscount + cardFee;

  useEffect(() => {
    if (paymentMethod !== "OTHER") return;
    setSplitPayments((prev) => {
      if (!prev.some((s) => s.method === "DEBT")) return prev;
      const nonDebtSum = prev
        .filter((s) => s.method !== "DEBT")
        .reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
      const expectedDebt = Math.max(0, totalAmount - nonDebtSum);
      const curDebt = prev.find((s) => s.method === "DEBT")?.amount ?? 0;
      if (curDebt === expectedDebt) return prev;
      return prev.map((s) => (s.method === "DEBT" ? { ...s, amount: expectedDebt } : s));
    });
  }, [totalAmount, paymentMethod]);

  const currentDebtAmount = useMemo(() => {
    if (paymentMethod !== "OTHER") return 0;
    return Math.min(
      totalAmount,
      splitPayments
        .filter((sp) => sp.method === "DEBT")
        .reduce((sum, sp) => sum + Math.max(0, Number(sp.amount) || 0), 0)
    );
  }, [paymentMethod, splitPayments, totalAmount]);

  const currentPaidNowAmount = useMemo(() => {
    if (paymentMethod !== "OTHER") return totalAmount;
    return Math.max(0, totalAmount - currentDebtAmount);
  }, [paymentMethod, totalAmount, currentDebtAmount]);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const cleanPhone = cleanPhoneDigits(customerPhone);
    if (!cleanPhone) {
      setErrorMsg("Vui lòng nhập Số điện thoại khách hàng (bắt buộc).");
      return;
    }
    if (!customerName.trim()) {
      setErrorMsg("Vui lòng nhập Tên khách hàng (bắt buộc).");
      return;
    }
    if (cart.length === 0 && giftCart.length === 0) {
      setErrorMsg("Giỏ hàng đang trống. Vui lòng chọn ít nhất 1 sản phẩm.");
      return;
    }

    const combinedQtyByProd = new Map<string, { prod: Product; qty: number }>();
    for (const c of cart) {
      const cur = combinedQtyByProd.get(c.product._id)?.qty || 0;
      combinedQtyByProd.set(c.product._id, { prod: c.product, qty: cur + c.quantity });
    }
    for (const g of giftCart) {
      const cur = combinedQtyByProd.get(g.product._id)?.qty || 0;
      combinedQtyByProd.set(g.product._id, { prod: g.product, qty: cur + g.quantity });
    }
    for (const [, entry] of Array.from(combinedQtyByProd.entries())) {
      const f1 = getFloor1Stock(entry.prod);
      if (entry.qty > f1) {
        setErrorMsg(
          `Sản phẩm "${entry.prod.name}" vượt quá tồn Kho Tầng 1 hiện có (${f1} ${entry.prod.unit}).`
        );
        return;
      }
    }

    if (paymentMethod === "OTHER" && splitPayments.length === 0) {
      setErrorMsg("Vui lòng bấm vào ô (+) để chọn hình thức thanh toán.");
      return;
    }

    const formattedSplitDetail =
      paymentMethod === "OTHER"
        ? splitPayments
          .map((sp) => {
            const label =
              SPLIT_METHOD_OPTIONS.find((o) => o.value === sp.method)?.label ||
              sp.method;
            return `${label}: ${formatNumberDots(sp.amount || 0)}`;
          })
          .join(" + ")
        : "";

    setSubmitting(true);
    try {
      const payload = {
        customerPhone: cleanPhone,
        customerName: customerName.trim(),
        paymentMethod,
        paymentMethodDetail: formattedSplitDetail,
        splitPayments: paymentMethod === "OTHER" ? splitPayments : [],
        debtAmount: currentDebtAmount,
        debtDueDate: currentDebtAmount > 0 && debtDueDate ? debtDueDate : null,
        hasCardFee: paymentMethod === "CARD",
        cardFeePercent: paymentMethod === "CARD" ? cardFeePercent : 0,
        billDiscountType: cleanBillDiscountValue > 0 ? billDiscountType : "NONE",
        billDiscountValue: cleanBillDiscountValue,
        note: note.trim() || "Giá đã bao gồm thuế",
        items: [
          ...cart.map((c) => ({
            productId: c.product._id,
            color: c.color || "",
            size: c.size || "",
            quantity: c.quantity,
            isGift: false,
            discountType: c.discountValue > 0 ? c.discountType : "NONE",
            discountValue: c.discountValue,
          })),
          ...giftCart.map((g) => ({
            productId: g.product._id,
            color: g.color || "",
            size: g.size || "",
            quantity: g.quantity,
            isGift: true,
            discountType: "GIFT" as DiscountType,
            discountValue: 100,
          })),
        ],
      };

      const endpoint = editingServerDraftOrder
        ? `/orders/${editingServerDraftOrder._id}/confirm`
        : "/orders";
      const res = await apiRequest<Order>(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const createdOrder = res.data;
      const createdMsg = `Tạo đơn hàng ${createdOrder.orderCode || createdOrder.code || ""} thành công!`;
      const hasOtherDrafts = drafts.length > 1;
      setShowCheckoutDrawer(false);
      removeDraft(activeDraftId);
      setSuccessMsg(
        hasOtherDrafts
          ? `${createdMsg} Đã chuyển sang đơn đang chờ tiếp theo.`
          : createdMsg
      );
      setEditingServerDraftOrder(null);
      fetchSellableProducts();
      fetchActivePromotions();
      fetchSavedDraftOrders();
      onOpenInvoice(createdOrder);
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi khi tạo đơn bán hàng");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveOrderAsDraft = async (e: React.MouseEvent<HTMLButtonElement>) => {
    setErrorMsg("");
    setSuccessMsg("");

    const form = e.currentTarget.form;
    if (form && !form.reportValidity()) {
      return;
    }

    const cleanPhone = cleanPhoneDigits(customerPhone);
    if (!cleanPhone) {
      setErrorMsg("Vui lòng nhập Số điện thoại khách hàng (bắt buộc khi lưu bản nháp).");
      return;
    }
    if (!customerName.trim()) {
      setErrorMsg("Vui lòng nhập Tên khách hàng (bắt buộc khi lưu bản nháp).");
      return;
    }
    if (cart.length === 0 && giftCart.length === 0) {
      setErrorMsg("Giỏ hàng đang trống. Vui lòng chọn ít nhất 1 sản phẩm để lưu nháp.");
      return;
    }

    const formattedSplitDetail =
      paymentMethod === "OTHER"
        ? splitPayments
          .map((sp) => {
            const label =
              SPLIT_METHOD_OPTIONS.find((o) => o.value === sp.method)?.label ||
              sp.method;
            return `${label}: ${formatNumberDots(sp.amount || 0)}`;
          })
          .join(" + ")
        : "";

    setSavingDraft(true);
    try {
      const payload = {
        status: "DRAFT",
        isDraft: true,
        customerPhone: cleanPhone,
        customerName: customerName.trim(),
        paymentMethod,
        paymentMethodDetail: formattedSplitDetail,
        splitPayments: paymentMethod === "OTHER" ? splitPayments : [],
        debtAmount: currentDebtAmount,
        debtDueDate: currentDebtAmount > 0 && debtDueDate ? debtDueDate : null,
        hasCardFee: paymentMethod === "CARD",
        cardFeePercent: paymentMethod === "CARD" ? cardFeePercent : 0,
        billDiscountType: cleanBillDiscountValue > 0 ? billDiscountType : "NONE",
        billDiscountValue: cleanBillDiscountValue,
        note: note.trim() || "Giá đã bao gồm thuế",
        items: [
          ...cart.map((c) => ({
            productId: c.product._id,
            color: c.color || "",
            size: c.size || "",
            quantity: c.quantity,
            isGift: false,
            discountType: c.discountValue > 0 ? c.discountType : "NONE",
            discountValue: c.discountValue,
          })),
          ...giftCart.map((g) => ({
            productId: g.product._id,
            color: g.color || "",
            size: g.size || "",
            quantity: g.quantity,
            isGift: true,
            discountType: "GIFT" as DiscountType,
            discountValue: 100,
          })),
        ],
      };

      const res = editingServerDraftOrder
        ? await apiRequest<Order>(`/orders/${editingServerDraftOrder._id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        })
        : await apiRequest<Order>("/orders", {
          method: "POST",
          body: JSON.stringify(payload),
        });

      const savedOrder = res.data;
      const code = savedOrder.orderCode || savedOrder.code || "";
      setShowCheckoutDrawer(false);
      setEditingServerDraftOrder(null);
      removeDraft(activeDraftId);
      setSuccessMsg(`Đã lưu bản nháp hóa đơn ${code}`);
      fetchSavedDraftOrders();
      onOpenInvoice(savedOrder);
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi khi lưu bản nháp hóa đơn");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleLoadServerDraftToPos = (ord: Order) => {
    setErrorMsg("");
    setSuccessMsg("");
    const saleItems: CartItem[] = [];
    const giftItems: GiftCartItem[] = [];

    for (const it of ord.items || []) {
      const prodId = String(it.productId || "");
      const fallbackQty = Math.max(1, Number(it.quantity) || 1);
      const foundProd =
        catalogById.get(prodId) ||
        products.find((p) => p._id === prodId) ||
        ({
          _id: prodId,
          code: it.productCode || "",
          name: it.productName || "Sản phẩm",
          categoryId: "",
          unit: it.unit || "Cái",
          sellingPrice: Number(it.originalUnitPrice ?? it.unitPrice) || 0,
          stockFloor1: fallbackQty,
          stock: fallbackQty,
        } as Product);

      if (it.isGift || it.discountType === "GIFT") {
        giftItems.push({
          product: foundProd,
          color: it.color || "",
          size: it.size || "",
          quantity: Number(it.quantity) || 1,
        });
      } else {
        saleItems.push({
          product: foundProd,
          color: it.color || "",
          size: it.size || "",
          quantity: Number(it.quantity) || 1,
          discountType: (it.discountType as DiscountType) || "NONE",
          discountValue: Number(it.discountValue) || 0,
          isManualDiscount: (Number(it.discountValue) || 0) > 0,
        });
      }
    }

    const draftData: DraftOrderData = {
      cart: saleItems,
      giftCart: giftItems,
      billDiscountType: (ord.billDiscountType as DiscountType) || "NONE",
      billDiscountValue: Number(ord.billDiscountValue) || 0,
      customerPhone: ord.customerPhone ? formatPhone(ord.customerPhone) : "",
      customerName:
        ord.customerName === "Khách lẻ (Bản nháp)" ? "" : ord.customerName || "",
      isExistingCustomer: false,
      customerOrders: [],
      paymentMethod: (ord.paymentMethod as PaymentMethodType) || "CASH",
      splitPayments: Array.isArray(ord.splitPayments)
        ? (ord.splitPayments as SplitPaymentItem[])
        : [],
      debtDueDate: ord.debtDueDate
        ? new Date(ord.debtDueDate).toISOString().slice(0, 10)
        : "",
      hasCardFee: true,
      cardFeePercent: Number(ord.cardFeePercent) === 4 ? 4 : 1.8,
      note: ord.note || DEFAULT_NOTE,
      editingServerDraftOrder: ord,
    };

    const current = getCurrentDraftData();
    const existingTab = liveDrafts.find(
      (d) => d.editingServerDraftOrder?._id === ord._id
    );

    if (existingTab) {
      setDrafts((prev) =>
        prev.map((d) => {
          if (d.id === existingTab.id) return { ...d, ...draftData };
          if (d.id === activeDraftId) return { ...d, ...current };
          return d;
        })
      );
      applyDraftData(draftData);
      setActiveDraftId(existingTab.id);
      activeDraftIdRef.current = existingTab.id;
    } else if (!isDraftEmpty(current) && drafts.length < MAX_DRAFTS) {
      const nextSeq = drafts.reduce((m, d) => Math.max(m, d.seq), 0) + 1;
      const newTab: DraftOrder = {
        id: generateDraftId(),
        seq: nextSeq,
        ...draftData,
      };
      setDrafts((prev) => [
        ...prev.map((d) => (d.id === activeDraftId ? { ...d, ...current } : d)),
        newTab,
      ]);
      applyDraftData(draftData);
      setActiveDraftId(newTab.id);
      activeDraftIdRef.current = newTab.id;
    } else {
      setDrafts((prev) =>
        prev.map((d) => (d.id === activeDraftId ? { ...d, ...draftData } : d))
      );
      applyDraftData(draftData);
    }

    setSuccessMsg(
      `Đang mở bản nháp ${ord.orderCode || ord.code} (Người tạo: ${ord.createdByName || "Nhân viên"}).`
    );
  };

  const handleQuickConfirmServerDraft = async (ord: Order) => {
    const code = ord.orderCode || ord.code || "";
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Xác nhận thanh toán cho bản nháp ${code}?\nHệ thống sẽ thực hiện TRỪ TỒN KHO TẦNG 1 ngay bây giờ.`
      )
    ) {
      return;
    }
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await apiRequest<Order>(`/orders/${ord._id}/confirm`, {
        method: "POST",
        body: JSON.stringify({
          customerName: ord.customerName || "Khách lẻ",
          customerPhone: ord.customerPhone || "0000000000",
        }),
      });
      const editingTab = liveDrafts.find(
        (d) => d.editingServerDraftOrder?._id === ord._id
      );
      if (editingTab) {
        removeDraft(editingTab.id);
      } else if (editingServerDraftOrder?._id === ord._id) {
        setEditingServerDraftOrder(null);
      }
      setSuccessMsg(
        `Đã xác nhận thanh toán & trừ kho thành công cho hóa đơn ${code}!`
      );
      fetchSellableProducts();
      fetchSavedDraftOrders();
      onOpenInvoice(res.data);
    } catch (err: any) {
      fetchSellableProducts();
      setErrorMsg(err?.message || "Không thể chốt thanh toán bản nháp");
    }
  };

  const handleDeleteServerDraft = async (ord: Order) => {
    const code = ord.orderCode || ord.code || "";
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Xóa bản nháp hóa đơn ${code}?`)
    ) {
      return;
    }
    setErrorMsg("");
    try {
      await apiRequest(`/orders/${ord._id}`, { method: "DELETE" });
      const editingTab = liveDrafts.find(
        (d) => d.editingServerDraftOrder?._id === ord._id
      );
      if (editingTab) {
        removeDraft(editingTab.id);
      } else if (editingServerDraftOrder?._id === ord._id) {
        setEditingServerDraftOrder(null);
      }
      setSuccessMsg(`Đã xóa bản nháp hóa đơn ${code}.`);
      fetchSavedDraftOrders();
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể xóa bản nháp");
    }
  };
  return {
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
    setNowClock,
    searchBoxRef,
    billPriceInputRef,
    serviceMeta,
    setServiceMeta,
    products,
    setProducts,
    allCatalogProducts,
    setAllCatalogProducts,
    categories,
    setCategories,
    activePromotions,
    setActivePromotions,
    appliedPromosSummary,
    setAppliedPromosSummary,
    autoBillPromoName,
    setAutoBillPromoName,
    isManualBillDiscount,
    setIsManualBillDiscount,
    selectedCategoryId,
    setSelectedCategoryId,
    sortBy,
    setSortBy,
    search,
    setSearch,
    loadingProducts,
    setLoadingProducts,
    scannerEnabled,
    setScannerEnabled,
    scannerInput,
    setScannerInput,
    lastScanBanner,
    setLastScanBanner,
    scannerInputRef,
    cart,
    setCart,
    giftCart,
    setGiftCart,
    variantPickerProduct,
    setVariantPickerProduct,
    pickerColorFilter,
    setPickerColorFilter,
    pickerSearch,
    setPickerSearch,
    expandedCardVarIds,
    setExpandedCardVarIds,
    toggleExpandCardVariants,
    showGiftModal,
    setShowGiftModal,
    giftSearch,
    setGiftSearch,
    giftCategoryId,
    setGiftCategoryId,
    pinnedGiftIds,
    setPinnedGiftIds,
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
    setLookingUp,
    paymentMethod,
    setPaymentMethod,
    splitPayments,
    setSplitPayments,
    debtDueDate,
    setDebtDueDate,
    showSplitDropdown,
    setShowSplitDropdown,
    hasCardFee,
    setHasCardFee,
    cardFeePercent,
    setCardFeePercent,
    note,
    setNote,
    submitting,
    setSubmitting,
    errorMsg,
    setErrorMsg,
    successMsg,
    setSuccessMsg,
    savingDraft,
    setSavingDraft,
    savedDraftOrders,
    setSavedDraftOrders,
    loadingSavedDrafts,
    setLoadingSavedDrafts,
    editingServerDraftOrder,
    setEditingServerDraftOrder,
    drafts,
    setDrafts,
    activeDraftId,
    setActiveDraftId,
    activeDraftIdRef,
    draftsHydrated,
    setDraftsHydrated,
    getCurrentDraftData,
    applyDraftData,
    liveDrafts,
    handleSwitchDraft,
    handleAddDraft,
    removeDraft,
    handleCloseDraft,
    catalogById,
    getDirectFloor1Stock,
    getFloor1Stock,
    getVariantFloor1Stock,
    getCategoryName,
    getCategoryId,
    fetchCategories,
    fetchActivePromotions,
    debouncedSearch,
    debouncedGiftSearch,
    debouncedCustomerPhone,
    phoneTypedByUserRef,
    fetchSellableProducts,
    fetchSavedDraftOrders,
    togglePinGiftProduct,
    floor1Products,
    filteredAndSortedProducts,
    groupedByCategory,
    handleLookupPhone,
    getCartQty,
    getCartVariantQty,
    getGiftQty,
    getProductPromotions,
    applyPromotionsForCart,
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
    cleanBillDiscountValue,
    billDiscountAmount,
    afterBillDiscount,
    cardFee,
    totalAmount,
    currentDebtAmount,
    currentPaidNowAmount,
    handleCreateOrder,
    handleSaveOrderAsDraft,
    handleLoadServerDraftToPos,
    handleQuickConfirmServerDraft,
    handleDeleteServerDraft,
  };
}
