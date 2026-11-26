import { useState, useEffect, useMemo, useRef } from "react";
import type { Product, Category, Order, Promotion, DiscountType, ServiceOrdersMeta } from "@/shared/types";
import { DEFAULT_NOTE, INITIAL_DRAFT_ID, createEmptyDraftData, type GiftCartItem, type CartItem, type SortByOption, type SplitPaymentItem, type PaymentMethodType, type DraftOrderData, type DraftOrder } from "../types";

/** State cơ bản của POS */
export function usePosState() {
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
  };
}

export type PosStateSlice = ReturnType<typeof usePosState>;
