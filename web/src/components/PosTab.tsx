"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Product,
  ProductVariant,
  Category,
  Order,
  Promotion,
  DiscountType,
  apiRequest,
  formatVND,
  formatNumberDots,
  parseNumberDots,
  formatPhone,
  cleanPhoneDigits,
  formatDateTime,
  getStoredUser,
  useDebounce,
  filterAndRankBySearch,
  formatVariantLabel,
  generateVariantProductCode,
} from "@/lib/api";
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
} from "lucide-react";
import {
  cleanBarcodeCode,
  findProductAndVariantByScannedBarcode,
  findProductByScannedBarcode,
  getBarcodeCandidates,
  playScannerBeep,
  useHardwareBarcodeScanner,
} from "@/lib/barcodeScanner";

const PINNED_GIFTS_STORAGE_KEY = "11sport_pos_pinned_gift_ids";

interface GiftCartItem {
  product: Product;
  quantity: number;
  color?: string;
  size?: string;
  isAutoPromo?: boolean;
  promoName?: string;
}

interface PosTabProps {
  onOpenInvoice: (order: Order) => void;
}

interface CartItem {
  product: Product;
  color?: string;
  size?: string;
  quantity: number;
  discountType: DiscountType;
  discountValue: number;
  isManualDiscount?: boolean;
  autoPromoName?: string;
}

const getCartLineKey = (productId: string, color?: string, size?: string): string =>
  `${productId}__${String(color || "").trim().toLowerCase()}__${String(size || "").trim().toUpperCase()}`;

type SortByOption = "CATEGORY" | "NAME_ASC" | "PRICE_ASC" | "PRICE_DESC" | "STOCK_DESC";
type SplitMethodType = "CASH" | "BANKING" | "CARD";

interface SplitPaymentItem {
  method: SplitMethodType;
  amount: number;
}

const SPLIT_METHOD_OPTIONS: { value: SplitMethodType; label: string }[] = [
  { value: "CASH", label: "Tiền mặt" },
  { value: "BANKING", label: "Chuyển khoản" },
  { value: "CARD", label: "Card" },
];

// ===== Nhiều đơn hàng song song (đơn nháp) =====
const POS_DRAFTS_STORAGE_KEY = "11sport_pos_drafts_v1";
const MAX_DRAFTS = 10;
const DEFAULT_NOTE = "Giá đã bao gồm thuế";

type PaymentMethodType = "CASH" | "BANKING" | "CARD" | "OTHER";

interface DraftOrderData {
  cart: CartItem[];
  giftCart: GiftCartItem[];
  billDiscountType: DiscountType;
  billDiscountValue: number;
  customerPhone: string;
  customerName: string;
  isExistingCustomer: boolean;
  customerOrders: Order[];
  paymentMethod: PaymentMethodType;
  splitPayments: SplitPaymentItem[];
  hasCardFee: boolean;
  note: string;
}

interface DraftOrder extends DraftOrderData {
  id: string;
  seq: number;
}

const createEmptyDraftData = (): DraftOrderData => ({
  cart: [],
  giftCart: [],
  billDiscountType: "NONE",
  billDiscountValue: 0,
  customerPhone: "",
  customerName: "",
  isExistingCustomer: false,
  customerOrders: [],
  paymentMethod: "CASH",
  splitPayments: [],
  hasCardFee: true,
  note: DEFAULT_NOTE,
});

const generateDraftId = () =>
  `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const createDraft = (seq: number): DraftOrder => ({
  id: generateDraftId(),
  seq,
  ...createEmptyDraftData(),
});

const isDraftEmpty = (d: DraftOrderData) =>
  d.cart.length === 0 &&
  d.giftCart.length === 0 &&
  !d.customerPhone.trim() &&
  !d.customerName.trim();

const INITIAL_DRAFT_ID = "draft_initial";

export default function PosTab({ onOpenInvoice }: PosTabProps) {
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

  // Popup chọn sản phẩm tặng
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftSearch, setGiftSearch] = useState("");
  const [giftCategoryId, setGiftCategoryId] = useState("");
  const [pinnedGiftIds, setPinnedGiftIds] = useState<string[]>([]);

  // Giảm giá Bill
  const [billDiscountType, setBillDiscountType] = useState<DiscountType>("NONE");
  const [billDiscountValue, setBillDiscountValue] = useState<number>(0);

  // Thông tin khách hàng
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [lookingUp, setLookingUp] = useState(false);

  // Thanh toán
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>("CASH");
  const [splitPayments, setSplitPayments] = useState<SplitPaymentItem[]>([]);
  const [showSplitDropdown, setShowSplitDropdown] = useState<boolean>(false);
  const [hasCardFee, setHasCardFee] = useState<boolean>(true);
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
    customerPhone,
    customerName,
    isExistingCustomer,
    customerOrders,
    paymentMethod,
    splitPayments,
    hasCardFee,
    note,
  });

  const applyDraftData = (d: DraftOrderData) => {
    setCart(d.cart || []);
    setGiftCart(d.giftCart || []);
    setBillDiscountType(d.billDiscountType || "NONE");
    setBillDiscountValue(Number(d.billDiscountValue) || 0);
    setCustomerPhone(d.customerPhone || "");
    setCustomerName(d.customerName || "");
    setIsExistingCustomer(!!d.isExistingCustomer);
    setCustomerOrders(Array.isArray(d.customerOrders) ? d.customerOrders : []);
    setPaymentMethod(d.paymentMethod || "CASH");
    setSplitPayments(Array.isArray(d.splitPayments) ? d.splitPayments : []);
    setHasCardFee(d.hasCardFee !== false);
    setNote(typeof d.note === "string" ? d.note : DEFAULT_NOTE);
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
              customerPhone,
              customerName,
              isExistingCustomer,
              customerOrders,
              paymentMethod,
              splitPayments,
              hasCardFee,
              note,
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
      customerPhone,
      customerName,
      isExistingCustomer,
      customerOrders,
      paymentMethod,
      splitPayments,
      hasCardFee,
      note,
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

  const reservedInOtherDrafts = useMemo(() => {
    const map = new Map<string, number>();
    drafts.forEach((d) => {
      if (d.id === activeDraftId) return;
      (d.cart || []).forEach((c) =>
        map.set(c.product._id, (map.get(c.product._id) || 0) + c.quantity)
      );
      (d.giftCart || []).forEach((g) =>
        map.set(g.product._id, (map.get(g.product._id) || 0) + g.quantity)
      );
    });
    return map;
  }, [drafts, activeDraftId]);

  useEffect(() => {
    if (products.length === 0) return;
    const byId = new Map(products.map((p) => [p._id, p]));
    const refresh = <T extends { product: Product }>(items: T[]): T[] => {
      if (!Array.isArray(items)) return [];
      let changed = false;
      const next = items.map((it) => {
        const fresh = byId.get(it.product._id);
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
  }, [products]);

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

  const getVariantFloor1Stock = (
    p: Product,
    color?: string,
    size?: string
  ): number => {
    if (Array.isArray(p.variants) && p.variants.length > 0 && (color || size)) {
      const cNorm = String(color || "").trim().toLowerCase();
      const sNorm = String(size || "").trim().toUpperCase();
      const matched = p.variants.find(
        (v) =>
          String(v.color || "").trim().toLowerCase() === cNorm &&
          String(v.size || "").trim().toUpperCase() === sNorm
      );
      if (matched) {
        return Math.max(0, Number(matched.stockFloor1 ?? matched.stock) || 0);
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
                  `${v.variantCode || generateVariantProductCode(p.code, v.color, v.size)} ${v.color} ${v.size}`
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
      } else {
        setIsExistingCustomer(false);
        setCustomerOrders([]);
      }
    } catch {
      setIsExistingCustomer(false);
      setCustomerOrders([]);
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
        (s, ci) => s + (Number(ci.product.sellingPrice) || 0) * ci.quantity,
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
            const origPrice = Math.round(Number(ci.product.sellingPrice) || 0);
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
            `🏷️ Giảm ${
              promo.itemDiscountType === "PERCENT"
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
            `🧾 Giảm Bill ${
              promo.billDiscountType === "PERCENT"
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

    if (product.sellingPrice <= 0) {
      setErrorMsg(
        `Sản phẩm "${product.name}" chưa có giá bán lẻ (> 0). Vui lòng cập nhật giá trên CMS trước khi bán.`
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
  const handleBarcodeScanForPos = (rawInput: string) => {
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
    const scanRes = findProductAndVariantByScannedBarcode(sourceCatalog, trimmed);
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

    if (Number(matchedProduct.sellingPrice) <= 0) {
      playScannerBeep("error");
      const msg = `Mã ${matchedProduct.code} ("${matchedProduct.name}") chưa có giá bán lẻ (> 0đ). Vui lòng cập nhật giá trên CMS.`;
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
      const msg = `Mã ${matchedProduct.code} ("${matchedProduct.name}") đã HẾT HÀNG tại Kho Tầng 1${
        f2Stock > 0 ? ` (Đang còn ${f2Stock} ${matchedProduct.unit} ở Kho Tầng 2)` : ""
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
        generateVariantProductCode(matchedProduct.code, exactVar.color, exactVar.size);
      const added = handleAddToCart(matchedProduct, exactVar.color, exactVar.size);
      if (added) {
        playScannerBeep("success");
        const vLabel = formatVariantLabel(exactVar.color, exactVar.size);
        const newQtyInCart =
          getCartVariantQty(matchedProduct._id, exactVar.color, exactVar.size) + 1;
        setLastScanBanner({
          type: "success",
          code: childCode,
          message: `Đã quét mã con ${childCode} → +1 "${matchedProduct.name}"${
            vLabel ? ` (${vLabel})` : ""
          } • ${formatVND(matchedProduct.sellingPrice)} (Trong giỏ: ${newQtyInCart} ${matchedProduct.unit})`,
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
            message: `Đã quét ${matchedProduct.code} → +1 "${matchedProduct.name}" (${vLabel}) • ${formatVND(matchedProduct.sellingPrice)}`,
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
        message: `Đã quét ${matchedProduct.code} → +1 "${matchedProduct.name}"${
          vLabel ? ` (${vLabel})` : ""
        } • ${formatVND(matchedProduct.sellingPrice)} (Trong giỏ: ${newQtyInCart} ${matchedProduct.unit})`,
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
    enabled: scannerEnabled && !showGiftModal,
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
    size?: string
  ) => {
    const lineKey = getCartLineKey(productId, color, size);
    setCart((prev) =>
      prev.map((c) => {
        if (getCartLineKey(c.product._id, c.color, c.size) !== lineKey) return c;
        const origPrice = Math.round(Number(c.product.sellingPrice) || 0);
        let cleanVal = Math.max(0, rawVal);
        if (discountType === "PERCENT") {
          cleanVal = Math.min(100, cleanVal);
        } else if (discountType === "AMOUNT") {
          cleanVal = Math.min(origPrice, Math.round(cleanVal));
        } else {
          cleanVal = 0;
        }
        return {
          ...c,
          discountType,
          discountValue: cleanVal,
          isManualDiscount: true,
          autoPromoName: undefined,
        };
      })
    );
  };

  const getItemPricing = (item: CartItem) => {
    const originalUnitPrice = Math.round(Number(item.product.sellingPrice) || 0);
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
    (sum, item) => sum + Math.round(Number(item.product.sellingPrice) || 0) * item.quantity,
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

  const cleanBillDiscountValue =
    billDiscountType === "PERCENT"
      ? Math.min(100, Math.max(0, billDiscountValue))
      : billDiscountType === "AMOUNT"
        ? Math.min(subtotal, Math.max(0, Math.round(billDiscountValue)))
        : 0;

  const billDiscountAmount =
    billDiscountType === "PERCENT"
      ? Math.round((subtotal * cleanBillDiscountValue) / 100)
      : billDiscountType === "AMOUNT"
        ? cleanBillDiscountValue
        : 0;

  const afterBillDiscount = Math.max(0, subtotal - billDiscountAmount);
  const cardFee =
    paymentMethod === "CARD" && hasCardFee ? Math.round(afterBillDiscount * 0.03) : 0;
  const totalAmount = afterBillDiscount + cardFee;

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
        hasCardFee: paymentMethod === "CARD" ? hasCardFee : false,
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
        hasCardFee: paymentMethod === "CARD" ? hasCardFee : false,
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

  const getDraftOrderStockShortages = (ord: Order) => {
    if (products.length === 0) return [];
    const reqMap = new Map<
      string,
      { name: string; unit: string; requested: number }
    >();
    for (const it of ord.items || []) {
      const pid = String(it.productId || "");
      const qty = Math.max(1, Number(it.quantity) || 1);
      const prev = reqMap.get(pid);
      if (prev) {
        prev.requested += qty;
      } else {
        reqMap.set(pid, {
          name: it.productName || "Sản phẩm",
          unit: it.unit || "Cái",
          requested: qty,
        });
      }
    }
    const shortages: {
      name: string;
      unit: string;
      requested: number;
      available: number;
    }[] = [];
    for (const [pid, info] of Array.from(reqMap.entries())) {
      const prod = products.find((p) => p._id === pid);
      const available = prod ? getFloor1Stock(prod) : 0;
      if (available < info.requested) {
        shortages.push({
          ...info,
          available,
        });
      }
    }
    return shortages;
  };

  const handleLoadServerDraftToPos = (ord: Order) => {
    setErrorMsg("");
    setSuccessMsg("");
    const saleItems: CartItem[] = [];
    const giftItems: GiftCartItem[] = [];

    for (const it of ord.items || []) {
      const prodId = String(it.productId || "");
      const foundProd =
        products.find((p) => p._id === prodId) ||
        ({
          _id: prodId,
          code: it.productCode || "",
          name: it.productName || "Sản phẩm",
          categoryId: "",
          unit: it.unit || "Cái",
          sellingPrice: Number(it.originalUnitPrice ?? it.unitPrice) || 0,
          stockFloor1: 0,
          stock: 0,
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

    setEditingServerDraftOrder(ord);
    setCart(saleItems);
    setGiftCart(giftItems);
    setBillDiscountType((ord.billDiscountType as DiscountType) || "NONE");
    setBillDiscountValue(Number(ord.billDiscountValue) || 0);
    setCustomerPhone(ord.customerPhone ? formatPhone(ord.customerPhone) : "");
    setCustomerName(
      ord.customerName === "Khách lẻ (Bản nháp)" ? "" : ord.customerName || ""
    );
    setPaymentMethod((ord.paymentMethod as PaymentMethodType) || "CASH");
    setHasCardFee(ord.hasCardFee !== false);
    setNote(ord.note || DEFAULT_NOTE);
    setSuccessMsg(
      `Đang mở bản nháp ${ord.orderCode || ord.code} (Người tạo: ${ord.createdByName || "Nhân viên"}).`
    );
    const shortages = getDraftOrderStockShortages(ord);
    if (shortages.length > 0) {
      setErrorMsg(
        `Lưu ý: Trong kho Tầng 1 hiện không đủ hàng cho bản nháp này: ${shortages
          .map(
            (s) =>
              `${s.name} (Tồn T1 còn ${s.available} ${s.unit}, đơn cần ${s.requested} ${s.unit})`
          )
          .join("; ")}. Vui lòng chỉnh lại số lượng hoặc xuất thêm hàng xuống Tầng 1 trước khi chốt thanh toán.`
      );
    }
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
      if (editingServerDraftOrder?._id === ord._id) {
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
      if (editingServerDraftOrder?._id === ord._id) {
        setEditingServerDraftOrder(null);
      }
      setSuccessMsg(`Đã xóa bản nháp hóa đơn ${code}.`);
      fetchSavedDraftOrders();
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể xóa bản nháp");
    }
  };

  const renderProductCard = (p: Product) => {
    const floor1Stock = getFloor1Stock(p);
    const canSell = p.sellingPrice > 0 && floor1Stock > 0;
    const catName = getCategoryName(p);
    const matchedPromos = getProductPromotions(p);
    const namedVariants = (p.variants || []).filter((v) => v.color || v.size);

    return (
      <div
        key={p._id}
        onClick={() => canSell && handleSelectProductForPos(p)}
        className={`p-3.5 rounded-xl border transition flex flex-col justify-between ${
          canSell
            ? "border-slate-200 hover:border-emerald-500 hover:shadow-md cursor-pointer bg-white"
            : "border-slate-200 bg-slate-50 opacity-70 cursor-not-allowed"
        }`}
      >
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 truncate">
              {catName}
            </span>
            <div className="text-right shrink-0">
              <span
                className={`text-xs font-extrabold px-2 py-0.5 rounded whitespace-nowrap ${
                  floor1Stock > 0
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-red-50 text-red-600 border border-red-200"
                }`}
              >
                🏢 Kho Tầng 1: {floor1Stock} {p.unit}
              </span>
            </div>
          </div>
          <h3 className="font-semibold text-slate-900 text-sm mt-2 break-words">
            {p.name}
          </h3>
          <div className="font-mono text-[10px] font-bold text-slate-500 mt-0.5 break-all">
            Mã: {p.code}
          </div>

          {/* Hiển thị nhanh các nút Chọn trực tiếp Size / Màu sắc trên thẻ sản phẩm */}
          {namedVariants.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {namedVariants.map((v, idx) => {
                const vStock = Math.max(0, Number(v.stockFloor1 ?? v.stock) || 0);
                const inCart = getCartVariantQty(p._id, v.color, v.size);
                return (
                  <button
                    key={`${v.color}-${v.size}-${idx}`}
                    type="button"
                    disabled={!canSell || vStock <= 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToCart(p, v.color, v.size);
                    }}
                    title={`Bấm để thêm nhanh ${formatVariantLabel(v.color, v.size)}`}
                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border transition ${
                      vStock <= 0
                        ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                        : inCart > 0
                          ? "bg-indigo-600 text-white border-indigo-700 shadow-xs"
                          : "bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200"
                    }`}
                  >
                    <span>
                      {v.color || "Mặc định"}
                      {v.size ? ` • ${v.size}` : ""}
                    </span>
                    <span className="font-mono font-extrabold">({vStock})</span>
                  </button>
                );
              })}
            </div>
          )}

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
          {(reservedInOtherDrafts.get(p._id) || 0) > 0 && (
            <div className="mt-1 inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
              ⏳ Đơn khác đang giữ: {reservedInOtherDrafts.get(p._id)} {p.unit}
            </div>
          )}
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
          {p.sellingPrice > 0 ? (
            <span className="font-mono font-extrabold text-emerald-700 text-base">
              {formatVND(p.sellingPrice)}
            </span>
          ) : (
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
              Chưa có giá bán (0 VND)
            </span>
          )}

          <button
            type="button"
            disabled={!canSell}
            onClick={(e) => {
              e.stopPropagation();
              handleSelectProductForPos(p);
            }}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 ${
              canSell
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
      {/* Thanh tab: Nhiều đơn hàng song song */}
      <div className="lg:col-span-12 bg-white rounded-xl shadow-sm border border-slate-200 p-2.5 md:p-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-extrabold uppercase text-slate-500 shrink-0 pr-1">
            <ShoppingCart className="w-3.5 h-3.5 text-emerald-600" />
            Đơn đang mở ({liveDrafts.length}/{MAX_DRAFTS})
          </span>
          {liveDrafts.map((d) => {
            const isActive = d.id === activeDraftId;
            const qty =
              d.cart.reduce((s, i) => s + i.quantity, 0) +
              d.giftCart.reduce((s, g) => s + g.quantity, 0);
            const customerLabel =
              d.customerName.trim() || (d.customerPhone.trim() ? d.customerPhone : "Khách mới");
            return (
              <div
                key={d.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => handleSwitchDraft(d.id)}
                title={submitting ? "Đang tạo đơn, vui lòng chờ..." : `Chuyển sang Đơn ${d.seq}`}
                className={`group flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-lg border text-xs shrink-0 transition select-none ${
                  isActive
                    ? "bg-emerald-600 border-emerald-700 text-white shadow-sm"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300"
                } ${submitting && !isActive ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div className="flex flex-col leading-tight min-w-0">
                  <span className="font-extrabold">Đơn {d.seq}</span>
                  <span
                    className={`text-[10px] truncate max-w-[120px] ${
                      isActive ? "text-emerald-50" : "text-slate-500"
                    }`}
                  >
                    {customerLabel}
                  </span>
                </div>
                <span
                  className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {qty} SP
                </span>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseDraft(d.id);
                  }}
                  title={`Hủy Đơn ${d.seq}`}
                  aria-label={`Hủy Đơn ${d.seq}`}
                  className={`p-1 rounded-md transition disabled:cursor-not-allowed ${
                    isActive
                      ? "hover:bg-white/20 text-white"
                      : "hover:bg-red-100 text-slate-400 hover:text-red-600"
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
            className="flex items-center gap-1 min-h-[40px] px-3 py-1.5 rounded-lg border border-dashed border-emerald-400 text-emerald-700 text-xs font-extrabold hover:bg-emerald-50 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm đơn mới
          </button>
        </div>
      </div>

      {/* Cột trái (7 phần): Tìm kiếm, Lọc/Sắp xếp theo Category & Chọn sản phẩm */}
      <div className="lg:col-span-7 lg:relative">
        <div className="flex flex-col gap-4 lg:absolute lg:inset-0">
          <div className="flex flex-col flex-1 min-h-0">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 md:p-4 flex flex-col flex-1 min-h-0 gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Danh mục Hàng hóa tại Quầy POS (Kho Tầng 1)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Quét mã vạch (HOALIỀN) hoặc bấm chọn Size/Màu. <strong>Chỉ bán tồn Kho Tầng 1</strong>.
                  </p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && search.trim()) {
                        e.preventDefault();
                        handleBarcodeScanForPos(search.trim());
                        setSearch("");
                      }
                    }}
                    placeholder="Tìm tên hàng, hãng, size, màu..."
                    className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* KHUNG ĐIỀU KHIỂN MÁY QUÉT LABEL — QUÉT BÁN HÀNG TỨC THÌ */}
              <div className="rounded-xl border-2 border-emerald-500/80 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950 text-white p-3 space-y-2 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                      <ScanLine className="w-4 h-4 text-emerald-400" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-extrabold uppercase tracking-wide text-emerald-300">
                          Máy Quét Label — Quét Bán Hàng
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            scannerEnabled
                              ? "bg-emerald-500 text-slate-950"
                              : "bg-slate-700 text-slate-300"
                          }`}
                        >
                          <Zap className="w-3 h-3" />
                          {scannerEnabled
                            ? "ĐANG BẬT (Bóp cò quét ở bất kỳ đâu)"
                            : "ĐANG TẠM TẮT"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Cầm máy quét bắn thẳng vào tem mã vạch sản phẩm (Tự động khử lỗi bộ gõ Tiếng Việt Unikey &amp; cộng +1 vào giỏ).
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setScannerEnabled((prev) => !prev)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border transition shrink-0 ${
                      scannerEnabled
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-400"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600"
                    }`}
                  >
                    {scannerEnabled ? "🟢 Đang nhận máy quét" : "⚪ Bật nhận máy quét"}
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!scannerInput.trim()) return;
                    handleBarcodeScanForPos(scannerInput.trim());
                    setScannerInput("");
                  }}
                  className="flex flex-col sm:flex-row gap-2"
                >
                  <div className="relative flex-1">
                    <ScanLine className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5" />
                    <input
                      ref={scannerInputRef}
                      type="text"
                      data-barcode-input="true"
                      value={scannerInput}
                      onChange={(e) => setScannerInput(e.target.value)}
                      placeholder="Quét mã sản phẩm vào đây (VD: GASIA221401) hoặc bóp cò máy quét..."
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800/90 border border-slate-600 focus:border-emerald-400 text-white placeholder:text-slate-400 text-xs sm:text-sm font-mono font-bold focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!scannerInput.trim()}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-extrabold text-xs whitespace-nowrap transition"
                  >
                    + Thêm vào giỏ (Enter)
                  </button>
                </form>

                {lastScanBanner && (
                  <div
                    className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between gap-2 border ${
                      lastScanBanner.type === "success"
                        ? "bg-emerald-950/90 border-emerald-500/60 text-emerald-200"
                        : lastScanBanner.type === "warning"
                        ? "bg-amber-950/90 border-amber-400/70 text-amber-200"
                        : "bg-red-950/90 border-red-500/70 text-red-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {lastScanBanner.type === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      <span className="truncate">{lastScanBanner.message}</span>
                    </div>
                    <span className="text-[10px] font-mono opacity-75 shrink-0">
                      {lastScanBanner.time}
                    </span>
                  </div>
                )}
              </div>

              {/* Thanh chọn nhanh Category & Sắp xếp */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId("")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                      selectedCategoryId === ""
                        ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                        : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                    }`}
                  >
                    Tất cả ({floor1Products.length})
                  </button>
                  {categories.map((cat) => {
                    const count = floor1Products.filter((p) => getCategoryId(p) === cat._id).length;
                    return (
                      <button
                        key={cat._id}
                        type="button"
                        onClick={() => setSelectedCategoryId(cat._id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                          selectedCategoryId === cat._id
                            ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-emerald-50"
                        }`}
                      >
                        {cat.name} ({count})
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortByOption)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white text-slate-800 focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="CATEGORY">📂 Xếp theo Category (Danh mục)</option>
                    <option value="NAME_ASC">🔤 Tên sản phẩm (A → Z)</option>
                    <option value="STOCK_DESC">📦 Tồn Kho Tầng 1 (Nhiều → Ít)</option>
                    <option value="PRICE_ASC">💰 Giá bán (Thấp → Cao)</option>
                    <option value="PRICE_DESC">💎 Giá bán (Cao → Thấp)</option>
                  </select>
                </div>
              </div>

              {loadingProducts ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  Đang tải danh sách sản phẩm...
                </div>
              ) : filteredAndSortedProducts.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  Không tìm thấy sản phẩm phù hợp.
                </div>
              ) : sortBy === "CATEGORY" ? (
                <div className="space-y-5 flex-1 min-h-0 max-h-[60vh] lg:max-h-none overflow-y-auto pr-1">
                  {groupedByCategory.map(([catName, catProducts]) => (
                    <div key={catName} className="space-y-2.5">
                      <div className="sticky top-0 z-10 bg-slate-900 text-white px-3 py-2 rounded-lg flex items-center justify-between shadow-sm">
                        <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-emerald-400" />
                          Danh mục: {catName}
                        </span>
                        <span className="text-[11px] font-mono bg-white/15 px-2 py-0.5 rounded">
                          {catProducts.length} mặt hàng · Tồn Tầng 1:{" "}
                          {catProducts.reduce((s, p) => s + getFloor1Stock(p), 0)}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {catProducts.map((p) => renderProductCard(p))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 content-start flex-1 min-h-0 max-h-[60vh] lg:max-h-none overflow-y-auto pr-1">
                  {filteredAndSortedProducts.map((p) => renderProductCard(p))}
                </div>
              )}
            </div>
          </div>

          {/* Danh sách Hóa đơn nháp đã lưu trên hệ thống */}
          <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-3.5 sm:p-4 space-y-2.5 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs sm:text-sm font-extrabold uppercase text-slate-900">
                  Hóa đơn nháp đã lưu ({savedDraftOrders.length})
                </h3>
              </div>
            </div>

            {loadingSavedDrafts ? (
              <div className="py-3 text-center text-xs text-slate-500">
                Đang tải danh sách bản nháp...
              </div>
            ) : savedDraftOrders.length === 0 ? (
              <div className="py-3 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                Chưa có hóa đơn nháp nào được lưu.
              </div>
            ) : (
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {savedDraftOrders.map((ord) => {
                  const code = ord.orderCode || ord.code || "";
                  const isBeingEdited = editingServerDraftOrder?._id === ord._id;
                  const totalQty = (ord.items || []).reduce(
                    (s, it) => s + (Number(it.quantity) || 0),
                    0
                  );
                  return (
                    <div
                      key={ord._id}
                      className={`p-2.5 rounded-xl border text-xs space-y-1.5 transition ${
                        isBeingEdited
                          ? "border-amber-500 bg-amber-50/70"
                          : "border-slate-200 bg-slate-50/70 hover:border-amber-300"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-slate-900">
                            {code}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                            NHÁP
                          </span>
                        </div>
                        <span className="font-mono font-extrabold text-emerald-700 text-sm">
                          {formatVND(ord.totalAmount)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                        <span>
                          Khách:{" "}
                          <strong className="text-slate-800">
                            {ord.customerName || "Khách lẻ"}
                          </strong>{" "}
                          {ord.customerPhone ? `(${formatPhone(ord.customerPhone)})` : ""}
                        </span>
                        <span>
                          {totalQty} SP · {formatDateTime(ord.createdAt)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span>
                          Người tạo nháp:{" "}
                          <strong className="text-slate-700">
                            {ord.createdByName || "Nhân viên bán hàng"}
                          </strong>
                        </span>
                        {(() => {
                          const shortages = getDraftOrderStockShortages(ord);
                          if (shortages.length === 0) return null;
                          return (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-300">
                              ⚠️ Hết/thiếu tồn Kho T1:{" "}
                              {shortages
                                .map(
                                  (s) =>
                                    `${s.name} (còn ${s.available}/${s.requested})`
                                )
                                .join(", ")}
                            </span>
                          );
                        })()}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/80">
                        <button
                          type="button"
                          onClick={() => handleLoadServerDraftToPos(ord)}
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 font-bold text-[11px] transition"
                        >
                          ✏️ Mở sửa trên POS
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickConfirmServerDraft(ord)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition"
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
                          title="Xóa bản nháp"
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
        </div>
      </div>

      {/* Cột phải (5 phần): Thông tin Khách hàng, Giỏ hàng, Giảm giá Bill & Thanh toán */}
      <div className="lg:col-span-5 space-y-4">
        <form
          onSubmit={handleCreateOrder}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-5 space-y-4 sm:space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">
                Phiếu Bán Hàng POS · Đơn{" "}
                {liveDrafts.find((d) => d.id === activeDraftId)?.seq ?? 1}
              </h2>
            </div>
            <span className="text-xs font-mono bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-semibold">
              {cart.reduce((s, i) => s + i.quantity, 0)} sản phẩm (Kho Tầng 1)
            </span>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {editingServerDraftOrder && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <span className="font-extrabold">
                    Đang sửa bản nháp:{" "}
                    {editingServerDraftOrder.orderCode || editingServerDraftOrder.code}
                  </span>
                  <div className="text-[11px] text-amber-800">
                    Bấm &ldquo;Cập nhật bản nháp&rdquo; hoặc &ldquo;Xác nhận thanh toán&rdquo; để chốt.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingServerDraftOrder(null)}
                className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-bold text-[11px] shrink-0"
              >
                Thoát sửa nháp
              </button>
            </div>
          )}

          {/* 1. Tra cứu SĐT Khách hàng */}
          <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase text-slate-700">
                1. Thông tin Khách hàng (Tra cứu SĐT)
              </label>
              {isExistingCustomer && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  <UserCheck className="w-3.5 h-3.5" /> Khách quen ({customerOrders.length} đơn)
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Số điện thoại *
                </label>
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
                    }
                  }}
                  placeholder="VD: 0945 xxx xxx"
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm focus:border-emerald-600 focus:outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Họ tên khách hàng * {lookingUp && "(Đang tìm...)"}
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Tự điền nếu khách cũ..."
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none bg-white"
                />
              </div>
            </div>

            {customerOrders.length > 0 && (
              <div className="pt-2 border-t border-slate-200">
                <div className="text-[11px] font-semibold text-slate-600 flex items-center gap-1 mb-1.5">
                  <History className="w-3.5 h-3.5 text-emerald-600" />
                  Đơn mua gần đây của khách:
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {customerOrders.slice(0, 3).map((ord) => (
                    <div
                      key={ord._id}
                      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs bg-white px-2.5 py-1.5 rounded border border-slate-200"
                    >
                      <span className="font-mono font-semibold text-slate-800">
                        {ord.orderCode || ord.code}
                      </span>
                      <span className="text-slate-500">{formatDateTime(ord.createdAt)}</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {formatVND(ord.totalAmount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenInvoice(ord)}
                        className="min-h-[32px] px-1 text-blue-600 hover:underline font-semibold flex items-center gap-0.5"
                      >
                        <Printer className="w-3 h-3" /> PDF
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Danh sách Giỏ hàng + Giảm giá từng sản phẩm */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase text-slate-700">
                2. Giỏ hàng & Giảm giá từng Sản phẩm
              </label>
              <span className="text-[11px] text-slate-500">
                Tối đa theo tồn Kho Tầng 1
              </span>
            </div>

            {appliedPromosSummary.length > 0 && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5">
                <div className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    🎉 Chương trình Khuyến mãi tự động áp dụng (
                    {appliedPromosSummary.length}):
                  </span>
                </div>
                <div className="space-y-1">
                  {appliedPromosSummary.map((ap) => (
                    <div
                      key={ap._id}
                      className="text-[11px] bg-white px-2.5 py-1.5 rounded-lg border border-emerald-200 flex flex-wrap items-center justify-between gap-1"
                    >
                      <span className="font-bold text-slate-900">
                        {ap.name}{" "}
                        {ap.multiplier > 1 && (
                          <span className="font-mono text-emerald-700">
                            (×{ap.multiplier} suất)
                          </span>
                        )}
                      </span>
                      <span className="font-semibold text-emerald-700">
                        {ap.details.join(" · ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cart.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                Chưa có sản phẩm nào trong giỏ hàng
              </div>
            ) : (
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl max-h-80 overflow-y-auto">
                {cart.map((item) => {
                  const floor1Max = getVariantFloor1Stock(
                    item.product,
                    item.color,
                    item.size
                  );
                  const pricing = getItemPricing(item);
                  const vLabel = formatVariantLabel(item.color, item.size);
                  const lineKey = getCartLineKey(
                    item.product._id,
                    item.color,
                    item.size
                  );
                  return (
                    <div key={lineKey} className="p-3 space-y-2 text-xs">
                      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
                        <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
                          <div className="font-semibold text-slate-900 break-words flex items-center gap-1.5 flex-wrap">
                            <span>{item.product.name}</span>
                            {vLabel && (
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-300">
                                {vLabel}
                              </span>
                            )}
                            {item.autoPromoName && (
                              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                                🎉 KM: {item.autoPromoName}
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                            {pricing.discountPerUnit > 0 ? (
                              <>
                                <span className="line-through text-slate-400">
                                  {formatVND(pricing.originalUnitPrice)}
                                </span>
                                <span className="font-bold text-emerald-700">
                                  {formatVND(pricing.unitPrice)}
                                </span>
                              </>
                            ) : (
                              <span>{formatVND(pricing.originalUnitPrice)}</span>
                            )}
                            <span>
                              × {item.quantity} {item.product.unit}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                              Tồn T1: {floor1Max}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
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
                            className="w-8 h-8 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
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
                            className="w-12 text-center font-mono font-bold border border-slate-300 rounded py-1"
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
                            className="w-8 h-8 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="ml-auto sm:ml-0 text-right font-mono font-bold text-slate-900 w-24 shrink-0">
                          {formatVND(pricing.lineTotal)}
                        </div>

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
                          className="w-8 h-8 shrink-0 flex items-center justify-center text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Dòng chỉnh giảm giá riêng cho sản phẩm này */}
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/80">
                        <div className="flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-rose-600" />
                          <span className="text-[11px] font-bold text-slate-700">
                            Giảm giá SP:
                          </span>
                          <select
                            value={item.discountType}
                            onChange={(e) =>
                              handleChangeItemDiscount(
                                item.product._id,
                                e.target.value as DiscountType,
                                0,
                                item.color,
                                item.size
                              )
                            }
                            className="px-2 py-1 rounded border border-slate-300 bg-white text-[11px] font-semibold"
                          >
                            <option value="NONE">Không giảm</option>
                            <option value="PERCENT">Giảm theo %</option>
                            <option value="AMOUNT">Giảm tiền (VND/SP)</option>
                          </select>
                        </div>

                        {item.discountType === "PERCENT" && (
                          <div className="flex items-center gap-1.5">
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
                                  item.size
                                )
                              }
                              placeholder="0"
                              className="w-16 px-2 py-1 rounded border border-rose-300 font-mono font-bold text-right text-xs"
                            />
                            <span className="font-bold text-rose-700">%</span>
                            {pricing.discountAmount > 0 && (
                              <span className="font-mono text-[11px] font-bold text-rose-600">
                                (−{formatVND(pricing.discountAmount)})
                              </span>
                            )}
                          </div>
                        )}

                        {item.discountType === "AMOUNT" && (
                          <div className="flex items-center gap-1.5">
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
                                  item.size
                                )
                              }
                              placeholder="0"
                              className="w-24 px-2 py-1 rounded border border-rose-300 font-mono font-bold text-right text-xs"
                            />
                            <span className="font-bold text-rose-700 text-[11px]">
                              VND/SP
                            </span>
                            {pricing.discountAmount > 0 && (
                              <span className="font-mono text-[11px] font-bold text-rose-600">
                                (−{formatVND(pricing.discountAmount)})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Box Tặng sản phẩm */}
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase text-amber-900 flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-amber-600" />
                Tặng sản phẩm
              </label>
              <button
                type="button"
                onClick={() => {
                  setGiftSearch("");
                  setGiftCategoryId("");
                  setShowGiftModal(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                <Gift className="w-3.5 h-3.5" />+ Tặng sản phẩm
              </button>
            </div>

            {giftCart.length === 0 ? (
              <div className="text-[11px] text-amber-800/80 flex items-center justify-between">
                <span>Chưa có sản phẩm tặng kèm trong đơn này.</span>
                <button
                  type="button"
                  onClick={() => {
                    setGiftSearch("");
                    setGiftCategoryId("");
                    setShowGiftModal(true);
                  }}
                  className="font-bold text-amber-800 underline hover:text-amber-950"
                >
                  Chọn quà tặng →
                </button>
              </div>
            ) : (
              <div className="divide-y divide-amber-200/80 bg-white border border-amber-200 rounded-lg overflow-hidden">
                {giftCart.map((gItem) => {
                  const floor1Max = Math.max(
                    0,
                    getFloor1Stock(gItem.product) - getCartQty(gItem.product._id)
                  );
                  return (
                    <div
                      key={gItem.product._id}
                      className="p-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5 flex-wrap">
                          <span>{gItem.product.name}</span>
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                            {gItem.isAutoPromo
                              ? `🎁 ${gItem.promoName || "CTKM"}`
                              : "🎁 Hàng tặng (0đ)"}
                          </span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="line-through text-slate-400">
                            {formatVND(gItem.product.sellingPrice)}
                          </span>
                          <span className="font-bold text-amber-700">0 VND</span>
                          <span>
                            × {gItem.quantity} {gItem.product.unit}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            handleChangeGiftQty(gItem.product._id, gItem.quantity - 1)
                          }
                          className="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
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
                          className="w-11 text-center font-mono font-bold border border-amber-300 rounded py-0.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleChangeGiftQty(gItem.product._id, gItem.quantity + 1)
                          }
                          className="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="font-mono font-extrabold text-amber-700 w-16 text-right shrink-0">
                        0 VND
                      </div>

                      <button
                        type="button"
                        onClick={() => handleChangeGiftQty(gItem.product._id, 0)}
                        className="w-7 h-7 shrink-0 flex items-center justify-center text-red-500 hover:bg-red-50 rounded"
                        title="Xóa hàng tặng"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Giảm giá tổng Bill */}
          <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase text-rose-900 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-rose-600" />
                3. Giảm giá Tổng Bill (Áp dụng cùng giảm giá SP)
              </label>
              {billDiscountAmount > 0 && (
                <span className="text-xs font-mono font-extrabold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                  −{formatVND(billDiscountAmount)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setBillDiscountType("NONE");
                  setBillDiscountValue(0);
                }}
                className={`py-2 px-2 rounded-lg border text-xs font-bold transition ${
                  billDiscountType === "NONE"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
              >
                Không giảm Bill
              </button>
              <button
                type="button"
                onClick={() => {
                  setBillDiscountType("PERCENT");
                  setBillDiscountValue(0);
                }}
                className={`py-2 px-2 rounded-lg border text-xs font-bold transition ${
                  billDiscountType === "PERCENT"
                    ? "bg-rose-600 text-white border-rose-700"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-rose-50"
                }`}
              >
                Giảm Bill theo %
              </button>
              <button
                type="button"
                onClick={() => {
                  setBillDiscountType("AMOUNT");
                  setBillDiscountValue(0);
                }}
                className={`py-2 px-2 rounded-lg border text-xs font-bold transition ${
                  billDiscountType === "AMOUNT"
                    ? "bg-rose-600 text-white border-rose-700"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-rose-50"
                }`}
              >
                Giảm Bill số tiền
              </button>
            </div>

            {billDiscountType === "PERCENT" && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs font-semibold text-slate-700">
                  Mức giảm Bill (%):
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={billDiscountValue || ""}
                  onChange={(e) =>
                    setBillDiscountValue(
                      Math.min(100, Math.max(0, Number(e.target.value)))
                    )
                  }
                  placeholder="VD: 10"
                  className="w-24 px-3 py-1.5 rounded-lg border border-rose-300 font-mono font-bold text-right text-sm bg-white"
                />
                <span className="text-xs font-bold text-rose-700">
                  % (= −{formatVND(billDiscountAmount)})
                </span>
              </div>
            )}

            {billDiscountType === "AMOUNT" && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs font-semibold text-slate-700">
                  Số tiền giảm Bill:
                </span>
                <div className="relative flex-1">
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
                    placeholder="VD: 50.000"
                    className="w-full pl-3 pr-12 py-1.5 rounded-lg border border-rose-300 font-mono font-bold text-right text-sm bg-white"
                  />
                  <span className="absolute right-3 top-2 text-[11px] font-bold text-slate-500">
                    VND
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 4. Phương thức thanh toán */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase text-slate-700">
              4. Phương thức thanh toán
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentMethod("CASH")}
                className={`min-h-[52px] py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 text-center transition ${
                  paymentMethod === "CASH"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Banknote className="w-4 h-4" />
                Tiền mặt
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("BANKING")}
                className={`min-h-[52px] py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 text-center transition ${
                  paymentMethod === "BANKING"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Landmark className="w-4 h-4" />
                Chuyển khoản
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("CARD")}
                className={`min-h-[52px] py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 text-center transition ${
                  paymentMethod === "CARD"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Quẹt Thẻ
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("OTHER")}
                className={`min-h-[52px] py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 text-center transition ${
                  paymentMethod === "OTHER"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Khác (Tùy chọn)</span>
              </button>
            </div>

            {paymentMethod === "OTHER" &&
              (() => {
                const selectedMethods = splitPayments.map((s) => s.method);
                const remainingOptions = SPLIT_METHOD_OPTIONS.filter(
                  (opt) => !selectedMethods.includes(opt.value)
                );

                return (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {splitPayments.map((sp) => {
                        const label =
                          SPLIT_METHOD_OPTIONS.find((o) => o.value === sp.method)?.label ||
                          sp.method;
                        return (
                          <div
                            key={sp.method}
                            className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 shadow-xs"
                          >
                            <span>{label}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setSplitPayments((prev) =>
                                  prev.filter((item) => item.method !== sp.method)
                                );
                              }}
                              className="w-4 h-4 rounded-full bg-emerald-700 hover:bg-emerald-800 flex items-center justify-center text-white"
                              title="Xóa phương thức này"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}

                      {remainingOptions.length > 0 && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowSplitDropdown((prev) => !prev)}
                            className="h-9 min-w-[44px] px-3 rounded-lg border-2 border-dashed border-emerald-500 bg-white hover:bg-emerald-50 text-emerald-700 font-extrabold text-sm flex items-center justify-center gap-1 transition"
                            title="Thêm phương thức thanh toán"
                          >
                            <Plus className="w-4 h-4" />
                          </button>

                          {showSplitDropdown && (
                            <div className="absolute left-0 top-10 z-20 w-44 rounded-xl bg-white border border-slate-200 shadow-lg py-1 overflow-hidden">
                              {remainingOptions.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => {
                                    setSplitPayments((prev) => [
                                      ...prev,
                                      { method: opt.value, amount: 0 },
                                    ]);
                                    setShowSplitDropdown(false);
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center justify-between transition"
                                >
                                  <span>{opt.label}</span>
                                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {splitPayments.length > 0 && (
                      <div className="space-y-2 pt-1 border-t border-slate-200/80">
                        {splitPayments.map((sp) => {
                          const label =
                            SPLIT_METHOD_OPTIONS.find((o) => o.value === sp.method)?.label ||
                            sp.method;
                          return (
                            <div
                              key={sp.method}
                              className="flex items-center justify-between gap-3"
                            >
                              <span className="text-xs font-bold text-slate-800 w-28 shrink-0">
                                {label} :
                              </span>
                              <div className="relative flex-1">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={sp.amount > 0 ? formatNumberDots(sp.amount) : ""}
                                  onChange={(e) => {
                                    const val = parseNumberDots(e.target.value);
                                    setSplitPayments((prev) =>
                                      prev.map((item) =>
                                        item.method === sp.method
                                          ? { ...item, amount: val }
                                          : item
                                      )
                                    );
                                  }}
                                  placeholder="0"
                                  className="w-full pl-3 pr-12 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-right text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                                />
                                <span className="absolute right-3 top-1.5 text-[11px] font-bold text-slate-400">
                                  VND
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

            {paymentMethod === "CARD" && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                <div className="text-xs font-bold text-amber-900">
                  Tùy chọn phí quẹt thẻ (BR-12):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label
                    className={`min-h-[40px] flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs font-semibold ${
                      hasCardFee
                        ? "border-amber-600 bg-white text-amber-900"
                        : "border-amber-200 text-slate-600"
                    }`}
                  >
                    <input
                      type="radio"
                      checked={hasCardFee}
                      onChange={() => setHasCardFee(true)}
                    />
                    Có phí 3% (+{formatVND(Math.round(afterBillDiscount * 0.03))})
                  </label>
                  <label
                    className={`min-h-[40px] flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs font-semibold ${
                      !hasCardFee
                        ? "border-amber-600 bg-white text-amber-900"
                        : "border-amber-200 text-slate-600"
                    }`}
                  >
                    <input
                      type="radio"
                      checked={!hasCardFee}
                      onChange={() => setHasCardFee(false)}
                    />
                    Không phí (0 VND)
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* 5. Ghi chú & Tổng kết thanh toán */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
              Ghi chú hóa đơn
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-sm"
            />
          </div>

          <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2">
            <div className="flex justify-between gap-2 text-xs text-slate-300">
              <span>Tổng tiền hàng (giá niêm yết):</span>
              <span className="font-mono font-semibold">{formatVND(rawSubtotal)}</span>
            </div>
            {giftUnitsCount > 0 && (
              <div className="flex justify-between gap-2 text-xs text-amber-300">
                <span>🎁 Hàng tặng kèm (trừ Kho Tầng 1):</span>
                <span className="font-mono font-semibold">
                  {giftUnitsCount} sản phẩm (0 VND)
                </span>
              </div>
            )}
            {itemDiscountTotal > 0 && (
              <div className="flex justify-between gap-2 text-xs text-rose-300">
                <span>Giảm giá trên sản phẩm:</span>
                <span className="font-mono font-semibold">
                  −{formatVND(itemDiscountTotal)}
                </span>
              </div>
            )}
            <div className="flex justify-between gap-2 text-xs text-slate-200">
              <span>Tạm tính sau giảm SP (Subtotal):</span>
              <span className="font-mono font-semibold">{formatVND(subtotal)}</span>
            </div>
            {billDiscountAmount > 0 && (
              <div className="flex justify-between gap-2 text-xs text-rose-300">
                <span>
                  Giảm giá Bill (
                  {billDiscountType === "PERCENT"
                    ? `${cleanBillDiscountValue}%`
                    : "Tiền mặt"}
                  ):
                </span>
                <span className="font-mono font-semibold">
                  −{formatVND(billDiscountAmount)}
                </span>
              </div>
            )}
            {paymentMethod === "CARD" && (
              <div className="flex justify-between gap-2 text-xs text-amber-300">
                <span>Phí quẹt thẻ ({hasCardFee ? "3%" : "0%"}):</span>
                <span className="font-mono font-semibold">+{formatVND(cardFee)}</span>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm sm:text-base font-extrabold pt-2 border-t border-slate-700">
              <span>KHÁCH CẦN THANH TOÁN:</span>
              <span className="font-mono text-emerald-400 text-lg">
                {formatVND(totalAmount)}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || (cart.length === 0 && giftCart.length === 0)}
            className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition"
          >
            <Printer className="w-5 h-5" />
            {submitting
              ? "Đang xử lý đơn hàng..."
              : "XÁC NHẬN THANH TOÁN & XUẤT HÓA ĐƠN PDF"}
          </button>
          <button
            type="button"
            disabled={
              submitting ||
              savingDraft ||
              (cart.length === 0 && giftCart.length === 0)
            }
            onClick={handleSaveOrderAsDraft}
            className="w-full py-3 px-4 rounded-xl bg-amber-50 hover:bg-amber-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 text-amber-900 border-2 border-amber-400 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition"
          >
            <Save className="w-4 h-4 text-amber-700" />
            {savingDraft
              ? "Đang lưu bản nháp..."
              : editingServerDraftOrder
                ? `CẬP NHẬT BẢN NHÁP ${editingServerDraftOrder.orderCode || editingServerDraftOrder.code}`
                : "LƯU BẢN NHÁP HÓA ĐƠN"}
          </button>
        </form>
      </div>

      {/* POPUP CHỌN PHÂN LOẠI (MÀU SẮC & SIZE) KHI QUÉT MÃ CHUNG HOẶC BẤM CHỌN BÁN */}
      {variantPickerProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-mono text-emerald-400 font-bold">
                  Mã SP chung: {variantPickerProduct.code}
                </div>
                <h3 className="font-extrabold text-base mt-0.5">
                  {variantPickerProduct.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setVariantPickerProduct(null)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3 max-h-[65vh] overflow-y-auto">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                <span>
                  Chọn <strong>Màu sắc &amp; Size</strong> (hoặc bấm phím số{" "}
                  <strong className="font-mono text-emerald-700">[1..9]</strong> trên bàn phím):
                </span>
                <span className="font-mono font-extrabold text-emerald-700">
                  Giá: {formatVND(variantPickerProduct.sellingPrice)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(variantPickerProduct.variants || []).map((v: ProductVariant, idx: number) => {
                  const vFloor1 = Math.max(0, Number(v.stockFloor1 ?? v.stock) || 0);
                  const inCartQty = getCartVariantQty(
                    variantPickerProduct._id,
                    v.color,
                    v.size
                  );
                  const canPick = vFloor1 > 0 && inCartQty < vFloor1;

                  return (
                    <button
                      key={`${v.color}-${v.size}-${idx}`}
                      type="button"
                      disabled={!canPick}
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
                      className={`p-3 rounded-xl border text-left transition flex items-center justify-between gap-2 ${
                        canPick
                          ? "border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 bg-white cursor-pointer"
                          : "border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {idx < 9 && (
                          <span className="mt-0.5 w-5 h-5 rounded bg-slate-900 text-amber-300 font-mono text-[10px] font-extrabold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                        )}
                        <div>
                          <div className="font-extrabold text-xs text-slate-900">
                            {v.color || "Mặc định"}
                            {v.size ? ` • Size ${v.size}` : ""}
                          </div>
                          <div className="font-mono text-[10px] font-bold text-indigo-700 mt-0.5">
                            Mã con:{" "}
                            {v.variantCode ||
                              generateVariantProductCode(
                                variantPickerProduct.code,
                                v.color,
                                v.size
                              )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Tồn Tầng 1:{" "}
                            <strong className="font-mono text-emerald-700">
                              {vFloor1} {variantPickerProduct.unit}
                            </strong>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {inCartQty > 0 && (
                          <div className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded mb-1">
                            Trong giỏ: {inCartQty}
                          </div>
                        )}
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold">
                          <Plus className="w-3 h-3" /> Chọn
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setVariantPickerProduct(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

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
                        className={`p-3 rounded-xl border transition flex flex-col justify-between gap-2 ${
                          isPinned
                            ? "border-amber-400 bg-amber-50/40 shadow-xs"
                            : "border-slate-200 bg-white hover:border-amber-400"
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                {catName}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Tồn T1: {remainingForGift} {p.unit}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => togglePinGiftProduct(p._id)}
                              className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 border transition shrink-0 ${
                                isPinned
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
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                                remainingForGift > 0
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
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition"
              >
                Xong / Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
