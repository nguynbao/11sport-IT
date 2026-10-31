"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Product,
  Category,
  Order,
  DiscountType,
  apiRequest,
  formatVND,
  formatNumberDots,
  parseNumberDots,
  formatPhone,
  cleanPhoneDigits,
  formatDateTime,
  getStoredUser,
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
} from "lucide-react";

const PINNED_GIFTS_STORAGE_KEY = "11sport_pos_pinned_gift_ids";

interface GiftCartItem {
  product: Product;
  quantity: number;
}

interface PosTabProps {
  onOpenInvoice: (order: Order) => void;
}

interface CartItem {
  product: Product;
  quantity: number;
  discountType: DiscountType;
  discountValue: number;
}

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
// Nhiều khách tới mua cùng lúc: Sales mở nhiều tab đơn, chuyển qua lại, mỗi tab giữ giỏ hàng/khách/thanh toán riêng.
// Lưu sessionStorage để không mất khi chuyển tab Kho/Khách hàng hoặc reload; xóa khi đăng xuất / đóng trình duyệt.
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortByOption>("CATEGORY");
  const [search, setSearch] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Giỏ hàng bán & Giỏ hàng tặng (tách riêng)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [giftCart, setGiftCart] = useState<GiftCartItem[]>([]);

  // Popup chọn sản phẩm tặng (chỉ có tìm kiếm, dropdown category & ghim sản phẩm trong popup này)
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

  // Danh sách đơn nháp (nhiều khách cùng lúc). State bên trên luôn là dữ liệu của đơn đang mở (activeDraftId);
  // các đơn khác được lưu trong `drafts` và nạp lại khi chuyển tab.
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

  // Danh sách đơn với dữ liệu mới nhất của đơn đang mở (dùng để hiển thị tab & lưu sessionStorage)
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

  // Nạp lại đơn nháp từ sessionStorage (chỉ của đúng nhân viên đang đăng nhập)
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

  // Lưu đơn nháp vào sessionStorage mỗi khi thay đổi
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
      // ignore (quota...)
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

  // Xóa 1 đơn khỏi danh sách; nếu là đơn đang mở thì chuyển sang đơn kế bên (hoặc tạo đơn trống mới)
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

  // Số lượng sản phẩm đang được giữ ở các đơn nháp KHÁC (để Sales biết, tránh bán trùng hàng cuối)
  const reservedInOtherDrafts = useMemo(() => {
    const map = new Map<string, number>();
    drafts.forEach((d) => {
      if (d.id === activeDraftId) return;
      d.cart.forEach((c) =>
        map.set(c.product._id, (map.get(c.product._id) || 0) + c.quantity)
      );
      d.giftCart.forEach((g) =>
        map.set(g.product._id, (map.get(g.product._id) || 0) + g.quantity)
      );
    });
    return map;
  }, [drafts, activeDraftId]);

  // Khi danh sách sản phẩm tải lại (VD: sau khi chốt 1 đơn), cập nhật tồn kho mới nhất vào giỏ của mọi đơn nháp
  useEffect(() => {
    if (products.length === 0) return;
    const byId = new Map(products.map((p) => [p._id, p]));
    const refresh = <T extends { product: Product }>(items: T[]): T[] => {
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
        const c = refresh(d.cart);
        const g = refresh(d.giftCart);
        return c === d.cart && g === d.giftCart ? d : { ...d, cart: c, giftCart: g };
      })
    );
  }, [products]);

  const getFloor1Stock = (p: Product): number => {
    return Math.max(0, Number(p.stockFloor1 ?? p.stock) || 0);
  };

  const getCategoryName = (p: Product): string => {
    if (p.categoryName) return p.categoryName;
    if (typeof p.categoryId === "object" && p.categoryId?.name) {
      return p.categoryId.name;
    }
    const found = categories.find((c) => c._id === String(p.categoryId));
    return found?.name || "Khác";
  };

  const getCategoryId = (p: Product): string => {
    if (typeof p.categoryId === "object" && p.categoryId?._id) {
      return p.categoryId._id;
    }
    return String(p.categoryId || "");
  };

  const fetchCategories = useCallback(async () => {
    try {
      const res = await apiRequest<Category[]>("/categories");
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch {
      // ignore
    }
  }, []);

  const fetchSellableProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const q = new URLSearchParams();
      if (search.trim()) q.set("search", search.trim());
      const res = await apiRequest<Product[]>(`/products?${q.toString()}`);
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể tải danh sách sản phẩm");
    } finally {
      setLoadingProducts(false);
    }
  }, [search]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchSellableProducts();
  }, [fetchSellableProducts]);

  // Đọc danh sách sản phẩm ghim trong Popup Tặng hàng từ localStorage
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

  // Chỉ lấy các sản phẩm có ở Kho Tầng 1 (stockFloor1 > 0), không hiển thị sản phẩm ở Kho Tầng 2
  const floor1Products = useMemo(() => {
    return products.filter((p) => getFloor1Stock(p) > 0);
  }, [products]);

  // Lọc và sắp xếp sản phẩm theo Category
  const filteredAndSortedProducts = useMemo(() => {
    const filtered = floor1Products.filter((p) => {
      if (selectedCategoryId && getCategoryId(p) !== selectedCategoryId) {
        return false;
      }
      return true;
    });

    const sorted = [...filtered];
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
  }, [floor1Products, selectedCategoryId, sortBy, categories]);

  // Nhóm sản phẩm theo Category khi chọn chế độ sắp xếp theo Category
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

  // Tự động tra cứu khách hàng theo SĐT
  const handleLookupPhone = async (phoneValue: string) => {
    const clean = cleanPhoneDigits(phoneValue);
    if (clean.length < 9) {
      setIsExistingCustomer(false);
      setCustomerOrders([]);
      return;
    }
    setLookingUp(true);
    // Ghi nhớ đơn đang tra cứu: nếu Sales chuyển sang đơn khác trong lúc chờ thì bỏ qua kết quả
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

  const getCartQty = (productId: string): number => {
    return cart.find((c) => c.product._id === productId)?.quantity || 0;
  };

  const getGiftQty = (productId: string): number => {
    return giftCart.find((g) => g.product._id === productId)?.quantity || 0;
  };

  const handleAddToCart = (product: Product) => {
    setErrorMsg("");
    const floor1Stock = getFloor1Stock(product);
    if (product.sellingPrice <= 0) {
      setErrorMsg(
        `Sản phẩm "${product.name}" chưa có giá bán lẻ (> 0). Vui lòng cập nhật giá trên CMS trước khi bán.`
      );
      return;
    }
    if (floor1Stock <= 0) {
      setErrorMsg(
        `Sản phẩm "${product.name}" đã hết hàng tại Kho Tầng 1 (Tồn Tầng 1: 0). Nhân viên bán hàng chỉ được phép bán số lượng có tại Kho Tầng 1.`
      );
      return;
    }

    const giftedQty = getGiftQty(product._id);

    setCart((prev) => {
      const existing = prev.find((c) => c.product._id === product._id);
      const currentSaleQty = existing ? existing.quantity : 0;
      if (currentSaleQty + giftedQty + 1 > floor1Stock) {
        setErrorMsg(
          `Không được vượt số lượng Kho Tầng 1 (${floor1Stock} ${product.unit}) của "${product.name}" (đang bán ${currentSaleQty}, tặng ${giftedQty}).`
        );
        return prev;
      }
      if (existing) {
        return prev.map((c) =>
          c.product._id === product._id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          discountType: "NONE",
          discountValue: 0,
        },
      ];
    });
  };

  const handleChangeQty = (productId: string, newQty: number) => {
    setErrorMsg("");
    const giftedQty = getGiftQty(productId);
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.product._id !== productId) return c;
          if (newQty <= 0) return null;
          const floor1Stock = getFloor1Stock(c.product);
          const maxAllowedForSale = Math.max(0, floor1Stock - giftedQty);
          if (newQty > maxAllowedForSale) {
            setErrorMsg(
              `Không được vượt số lượng Kho Tầng 1 của "${c.product.name}" (Tồn T1: ${floor1Stock}, đang tặng: ${giftedQty}).`
            );
            return maxAllowedForSale > 0 ? { ...c, quantity: maxAllowedForSale } : null;
          }
          return { ...c, quantity: newQty };
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Thêm / chỉnh số lượng sản phẩm tặng (0 VND - trừ Kho Tầng 1)
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

  // Danh sách sản phẩm trong Popup Tặng hàng:
  // - Ban đầu (khi chưa tìm kiếm & chưa chọn Category): CHỈ hiển thị các sản phẩm ĐÃ GHIM (nếu chưa ghim thì trang trống).
  // - Khi gõ tìm kiếm hoặc chọn Category: hiển thị kết quả để người dùng bấm Ghim / Chọn tặng.
  const isSearchingOrFilteringGift =
    giftSearch.trim().length > 0 || giftCategoryId !== "";

  const popupGiftProducts = useMemo(() => {
    const q = giftSearch.trim().toLowerCase();

    if (!q && !giftCategoryId) {
      // Ban đầu chỉ hiện các sản phẩm đã ghim
      return floor1Products
        .filter((p) => pinnedGiftIds.includes(p._id))
        .sort((a, b) => pinnedGiftIds.indexOf(a._id) - pinnedGiftIds.indexOf(b._id));
    }

    const filtered = floor1Products.filter((p) => {
      if (giftCategoryId && giftCategoryId !== "ALL" && getCategoryId(p) !== giftCategoryId) {
        return false;
      }
      if (q) {
        const matchName = p.name.toLowerCase().includes(q);
        const matchCode = p.code.toLowerCase().includes(q);
        const matchBarcode = (p.barcode || "").toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchBarcode) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      const aPinned = pinnedGiftIds.includes(a._id);
      const bPinned = pinnedGiftIds.includes(b._id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      if (aPinned && bPinned) {
        return pinnedGiftIds.indexOf(a._id) - pinnedGiftIds.indexOf(b._id);
      }
      return a.name.localeCompare(b.name, "vi");
    });
  }, [floor1Products, giftCategoryId, giftSearch, pinnedGiftIds]);

  const handleChangeItemDiscount = (
    productId: string,
    discountType: DiscountType,
    rawVal: number
  ) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.product._id !== productId) return c;
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
        };
      })
    );
  };

  // Tính toán giảm giá từng sản phẩm & giảm giá Bill
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

    // Kiểm tra lại tổng tồn kho Tầng 1 (hàng bán + hàng tặng) trước khi gửi
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
            quantity: c.quantity,
            isGift: false,
            discountType: c.discountValue > 0 ? c.discountType : "NONE",
            discountValue: c.discountValue,
          })),
          ...giftCart.map((g) => ({
            productId: g.product._id,
            quantity: g.quantity,
            isGift: true,
            discountType: "GIFT" as DiscountType,
            discountValue: 100,
          })),
        ],
      };

      const res = await apiRequest<Order>("/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const createdOrder = res.data;
      const createdMsg = `Tạo đơn hàng ${createdOrder.orderCode || createdOrder.code || ""} thành công!`;
      // Đóng đơn vừa thanh toán xong; nếu còn đơn khác đang chờ thì tự chuyển sang đơn đó
      const hasOtherDrafts = drafts.length > 1;
      removeDraft(activeDraftId);
      setSuccessMsg(
        hasOtherDrafts
          ? `${createdMsg} Đã chuyển sang đơn đang chờ tiếp theo.`
          : createdMsg
      );
      fetchSellableProducts();
      onOpenInvoice(createdOrder);
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi khi tạo đơn bán hàng");
    } finally {
      setSubmitting(false);
    }
  };

  const renderProductCard = (p: Product) => {
    const floor1Stock = getFloor1Stock(p);
    const canSell = p.sellingPrice > 0 && floor1Stock > 0;
    const catName = getCategoryName(p);

    return (
      <div
        key={p._id}
        onClick={() => canSell && handleAddToCart(p)}
        className={`p-3.5 rounded-xl border transition flex flex-col justify-between ${canSell
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
                className={`text-xs font-extrabold px-2 py-0.5 rounded whitespace-nowrap ${floor1Stock > 0
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
          <div className="font-mono text-[10px] text-slate-400 mt-0.5 break-all">
            Mã: {p.code}
          </div>
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
              handleAddToCart(p);
            }}
            className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 ${canSell
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : "bg-slate-200 text-slate-500"
              }`}
          >
            <Plus className="w-3.5 h-3.5" /> Chọn bán
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
      {/* Thanh tab: Nhiều đơn hàng song song (nhiều khách mua cùng lúc) */}
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
                    isActive ? "hover:bg-white/20 text-white" : "hover:bg-red-100 text-slate-400 hover:text-red-600"
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
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 md:p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Danh mục Hàng hóa tại Quầy POS (Kho Tầng 1)
              </h2>
              <p className="text-xs text-slate-500">
                Nhân viên bán hàng <strong>chỉ bán số lượng tại Kho Tầng 1</strong> (không vượt tồn Kho Tầng 1).
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Quét mã / tìm tên sản phẩm..."
                className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Thanh chọn nhanh Category & Sắp xếp theo Category */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCategoryId("")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${selectedCategoryId === ""
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
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${selectedCategoryId === cat._id
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
            <div className="space-y-5 max-h-[60vh] lg:max-h-[640px] overflow-y-auto pr-1">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] lg:max-h-[640px] overflow-y-auto pr-1">
              {filteredAndSortedProducts.map((p) => renderProductCard(p))}
            </div>
          )}
        </div>
      </div>

      {/* Cột phải (5 phần): Thông tin Khách hàng, Giỏ hàng (Giảm giá SP), Giảm giá Bill & Thanh toán */}
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
                    const formatted = formatPhone(e.target.value);
                    setCustomerPhone(formatted);
                    handleLookupPhone(formatted);
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

            {/* Lịch sử mua nhanh của khách quen */}
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

          {/* 2. Danh sách Giỏ hàng + Giảm giá từng sản phẩm (% hoặc VND) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase text-slate-700">
                2. Giỏ hàng & Giảm giá từng Sản phẩm
              </label>
              <span className="text-[11px] text-slate-500">
                Tối đa theo tồn Kho Tầng 1
              </span>
            </div>
            {cart.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                Chưa có sản phẩm nào trong giỏ hàng
              </div>
            ) : (
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl max-h-80 overflow-y-auto">
                {cart.map((item) => {
                  const floor1Max = getFloor1Stock(item.product);
                  const pricing = getItemPricing(item);
                  return (
                    <div key={item.product._id} className="p-3 space-y-2 text-xs">
                      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
                        <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
                          <div className="font-semibold text-slate-900 break-words">
                            {item.product.name}
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
                            <span>× {item.quantity} {item.product.unit}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                              Tồn T1: {floor1Max}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleChangeQty(item.product._id, item.quantity - 1)
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
                                Math.max(1, Number(e.target.value))
                              )
                            }
                            className="w-12 text-center font-mono font-bold border border-slate-300 rounded py-1"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleChangeQty(item.product._id, item.quantity + 1)
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
                          onClick={() => handleChangeQty(item.product._id, 0)}
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
                                0
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
                                  Number(e.target.value)
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
                                  parseNumberDots(e.target.value)
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

          {/* Box Tặng sản phẩm (Không tính tiền, hiện trên Bill & trừ Kho Tầng 1) */}
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
                <Gift className="w-3.5 h-3.5" />
                + Tặng sản phẩm
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
                            🎁 Hàng tặng (0đ)
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

          {/* 3. Giảm giá tổng Bill (Hóa đơn) — Có thể áp dụng cùng lúc với giảm giá SP */}
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
                className={`py-2 px-2 rounded-lg border text-xs font-bold transition ${billDiscountType === "NONE"
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
                className={`py-2 px-2 rounded-lg border text-xs font-bold transition ${billDiscountType === "PERCENT"
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
                className={`py-2 px-2 rounded-lg border text-xs font-bold transition ${billDiscountType === "AMOUNT"
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

          {/* 4. Phương thức thanh toán (Grid 2x2) & Phí quẹt thẻ 3% */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase text-slate-700">
              4. Phương thức thanh toán
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPaymentMethod("CASH")}
                className={`min-h-[52px] py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 text-center transition ${paymentMethod === "CASH"
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
                className={`min-h-[52px] py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 text-center transition ${paymentMethod === "BANKING"
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
                className={`min-h-[52px] py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 text-center transition ${paymentMethod === "CARD"
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
                className={`min-h-[52px] py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 text-center transition ${paymentMethod === "OTHER"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
              >
                <Layers className="w-4 h-4" />
                <span>Khác (Tùy chọn)</span>
              </button>
            </div>

            {paymentMethod === "OTHER" && (() => {
              const selectedMethods = splitPayments.map((s) => s.method);
              const remainingOptions = SPLIT_METHOD_OPTIONS.filter(
                (opt) => !selectedMethods.includes(opt.value)
              );

              return (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  {/* Hàng các Box phương thức đã chọn + Box (+) thêm tiếp */}
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

                    {/* Box (+) hiển thị khi vẫn còn phương thức chưa chọn */}
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

                  {/* Danh sách ô nhập tiền trả cho từng phần */}
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
                    className={`min-h-[40px] flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs font-semibold ${hasCardFee
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
                    className={`min-h-[40px] flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs font-semibold ${!hasCardFee
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
        </form>
      </div>

      {/* POPUP CHỌN SẢN PHẨM TẶNG KÈM (Có Tìm kiếm, Dropdown Category & Ghim sản phẩm riêng trong Popup) */}
      {showGiftModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
            {/* Header Popup */}
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

            {/* Thanh công cụ: Ô tìm kiếm + Dropdown Category */}
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
                    📌 Sản phẩm đã ghim ({pinnedGiftIds.length})
                  </option>
                  <option value="ALL">
                    📂 Xem tất cả Category ({floor1Products.length})
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

            {/* Danh sách sản phẩm trong Popup (Ban đầu trống, chỉ hiện sản phẩm đã ghim) */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-2.5">
              {popupGiftProducts.length === 0 ? (
                <div className="py-14 px-4 text-center space-y-2">
                  <Pin className="w-8 h-8 text-amber-400 mx-auto" />
                  <div className="text-sm font-bold text-slate-700">
                    {!isSearchingOrFilteringGift
                      ? "Chưa có sản phẩm tặng nào được ghim"
                      : "Không tìm thấy sản phẩm phù hợp trong Kho Tầng 1"}
                  </div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {!isSearchingOrFilteringGift
                      ? "Hãy gõ vào ô tìm kiếm hoặc chọn Category ở trên để tìm sản phẩm và bấm nút 📌 Ghim. Các sản phẩm đã ghim sẽ hiển thị cố định tại đây."
                      : "Vui lòng thử từ khóa khác hoặc chọn danh mục khác."}
                  </p>
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
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                {catName}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Tồn T1: {remainingForGift} {p.unit}
                              </span>
                            </div>

                            {/* Nút Ghim sản phẩm (Chỉ có trong Popup này) */}
                            <button
                              type="button"
                              onClick={() => togglePinGiftProduct(p._id)}
                              className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 border transition shrink-0 ${isPinned
                                ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-700"
                                }`}
                              title={
                                isPinned
                                  ? "Bỏ ghim sản phẩm này"
                                  : "Ghim sản phẩm này lên đầu danh sách tặng"
                              }
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

            {/* Footer Popup */}
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
