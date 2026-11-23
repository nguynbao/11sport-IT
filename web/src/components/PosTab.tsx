"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Product,
  ProductVariant,
  Category,
  Order,
  Promotion,
  DiscountType,
  ServiceOrdersMeta,
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
  resolveVariantCode,
  findVariantByColorSize,
  variantEffectiveSellingPrice,
  lookupProductByCodeApi,
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
import PosServiceSection from "./PosServiceSection";
import {
  cleanBarcodeCode,
  findProductAndVariantByScannedBarcode,
  findProductByScannedBarcode,
  getBarcodeCandidates,
  playScannerBeep,
  useHardwareBarcodeScanner,
} from "@/lib/barcodeScanner";
import {
  ColorSwatchBadge,
  getColorBoxBorderStyle,
  resolveVariantColorHexes,
} from "./ColorSwatchPicker";

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
  discountInputMode?: "NONE" | "PERCENT" | "AMOUNT" | "PRICE";
  customPriceText?: string;
  isManualDiscount?: boolean;
  autoPromoName?: string;
}

/** R8 (v5.0): giá bán hiệu lực của dòng giỏ hàng = giá biến thể (Màu+Size) nếu > 0, ngược lại giá gốc */
const cartUnitPrice = (ci: { product: Product; color?: string; size?: string }): number =>
  Math.round(variantEffectiveSellingPrice(ci.product, findVariantByColorSize(ci.product, ci.color, ci.size)) || 0);

/** Giá hiển thị của sản phẩm trên lưới POS: giá gốc, hoặc giá thấp nhất của biến thể nếu gốc chưa có giá */
const productDisplayPrice = (p: Product): { price: number; minPrice: number; maxPrice: number; hasVariantPrices: boolean } => {
  const vars = Array.isArray(p.variants) ? p.variants : [];
  const prices = vars.map((v) => variantEffectiveSellingPrice(p, v)).filter((x) => x > 0);
  const base = Number(p.sellingPrice || 0);
  const hasVariantPrices = vars.some((v) => Number(v.sellingPrice || 0) > 0 && Number(v.sellingPrice) !== base);
  const minPrice = prices.length ? Math.min(...prices) : base;
  const maxPrice = prices.length ? Math.max(...prices) : base;
  if (base > 0) return { price: base, minPrice: Math.min(minPrice, base), maxPrice: Math.max(maxPrice, base), hasVariantPrices };
  return { price: minPrice, minPrice, maxPrice, hasVariantPrices };
};

const getCartLineKey = (productId: string, color?: string, size?: string): string =>
  `${productId}__${String(color || "").trim().toLowerCase()}__${String(size || "").trim().toUpperCase()}`;

type SortByOption = "CATEGORY" | "NAME_ASC" | "PRICE_ASC" | "PRICE_DESC" | "STOCK_DESC";
type SplitMethodType = "CASH" | "BANKING" | "CARD" | "DEBT";

interface SplitPaymentItem {
  method: SplitMethodType;
  amount: number;
}

const SPLIT_METHOD_OPTIONS: { value: SplitMethodType; label: string }[] = [
  { value: "CASH", label: "Tiền mặt" },
  { value: "BANKING", label: "Chuyển khoản" },
  { value: "CARD", label: "Card" },
  { value: "DEBT", label: "Công nợ (Trả sau)" },
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
  billDiscountInputMode?: "NONE" | "PERCENT" | "AMOUNT" | "PRICE";
  billCustomPriceText?: string;
  customerPhone: string;
  customerName: string;
  isExistingCustomer: boolean;
  customerOrders: Order[];
  customerDebtSummary?: {
    totalDebtAmount: number;
    unpaidOrdersCount: number;
    overdueOrdersCount: number;
  } | null;
  paymentMethod: PaymentMethodType;
  splitPayments: SplitPaymentItem[];
  debtDueDate?: string;
  hasCardFee: boolean;
  cardFeePercent?: number;
  note: string;
  editingServerDraftOrder?: Order | null;
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
  customerDebtSummary: null,
  paymentMethod: "CASH",
  splitPayments: [],
  debtDueDate: "",
  hasCardFee: true,
  cardFeePercent: 1.8,
  note: DEFAULT_NOTE,
  editingServerDraftOrder: null,
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
  !d.customerName.trim() &&
  !d.editingServerDraftOrder;

const INITIAL_DRAFT_ID = "draft_initial";

export default function PosTab({ onOpenInvoice }: PosTabProps) {
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
