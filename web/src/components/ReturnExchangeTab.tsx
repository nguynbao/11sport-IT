"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Order,
  Product,
  ReturnReceipt,
  apiRequest,
  formatVND,
  formatDateTime,
  formatPhone,
  useDebounce,
  filterAndRankBySearch,
} from "@/lib/api";
import {
  Search,
  RotateCcw,
  ArrowLeftRight,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
} from "lucide-react";

interface ReturnItemForm {
  lineIndex: number;
  productId: string;
  productCode: string;
  productName: string;
  color: string;
  size: string;
  isGift: boolean;
  unitPrice: number;
  maxReturnable: number;
  quantity: number;
  condition: "GOOD" | "DAMAGED";
}

interface ExchangeOption {
  optionKey: string;
  product: Product;
  color: string;
  size: string;
  colorHexes: string[];
  variantCode: string;
  displayName: string;
  directFloor1: number;
  unpackableFloor1: number;
  stockFloor1: number;
}

interface ExchangeItemForm {
  optionKey: string;
  product: Product;
  color: string;
  size: string;
  variantCode: string;
  displayName: string;
  stockFloor1: number;
  quantity: number;
}

export default function ReturnExchangeTab() {
  const [orderCodeInput, setOrderCodeInput] = useState("");
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [sellableProducts, setSellableProducts] = useState<Product[]>([]);
  const [recentReturns, setRecentReturns] = useState<ReturnReceipt[]>([]);

  // Form trả/đổi
  const [mode, setMode] = useState<"RETURN" | "EXCHANGE">("RETURN");
  const [refundMethod, setRefundMethod] = useState<"CASH" | "BANKING" | "CARD">("CASH");
  const [note, setNote] = useState("");
  const [returnRows, setReturnRows] = useState<ReturnItemForm[]>([]);
  const [exchangeRows, setExchangeRows] = useState<ExchangeItemForm[]>([]);
  const [exchangeSearch, setExchangeSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const filterValidSellableProducts = useCallback((rawList: Product[]) => {
    if (!Array.isArray(rawList)) return [];
    return rawList.filter((p) => {
      const directF1 = Number(p.stockFloor1 ?? p.stock) || 0;
      const unpackF1 = Math.max(0, Number(p.maxUnpackableFloor1) || 0);
      return Number(p.sellingPrice) > 0 && directF1 + unpackF1 > 0;
    });
  }, []);

  const reloadSellableProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const prodRes = await apiRequest<Product[]>("/products?onlySellable=true");
      if (Array.isArray(prodRes.data)) {
        setSellableProducts(filterValidSellableProducts(prodRes.data));
      }
    } catch {
      // ignore
    } finally {
      setLoadingProducts(false);
    }
  }, [filterValidSellableProducts]);

  const loadInitialLists = useCallback(async () => {
    const [ordSettled, prodSettled, retSettled] = await Promise.allSettled([
      apiRequest<Order[]>("/orders"),
      apiRequest<Product[]>("/products?onlySellable=true"),
      apiRequest<ReturnReceipt[]>("/returns"),
    ]);

    if (ordSettled.status === "fulfilled" && Array.isArray(ordSettled.value.data)) {
      setRecentOrders(ordSettled.value.data);
    }
    if (prodSettled.status === "fulfilled" && Array.isArray(prodSettled.value.data)) {
      setSellableProducts(filterValidSellableProducts(prodSettled.value.data));
    }
    if (retSettled.status === "fulfilled" && Array.isArray(retSettled.value.data)) {
      setRecentReturns(retSettled.value.data);
    }
  }, [filterValidSellableProducts]);

  useEffect(() => {
    loadInitialLists();
  }, [loadInitialLists]);

  useEffect(() => {
    if (mode === "EXCHANGE" && sellableProducts.length === 0 && !loadingProducts) {
      reloadSellableProducts();
    }
  }, [mode, sellableProducts.length, loadingProducts, reloadSellableProducts]);

  // Danh sách tùy chọn sản phẩm đổi mới (trải phẳng theo từng phân loại Màu/Size có tồn khả dụng Kho Tầng 1 > 0)
  const exchangeOptions: ExchangeOption[] = useMemo(() => {
    const opts: ExchangeOption[] = [];
    for (const p of sellableProducts) {
      const unpackF1 = Math.max(0, Number(p.maxUnpackableFloor1) || 0);
      const variants = Array.isArray(p.variants) ? p.variants : [];

      if (variants.length > 0) {
        for (const v of variants) {
          const directF1 = Math.max(0, Number(v.stockFloor1) || 0);
          const availF1 = directF1 + unpackF1;
          if (availF1 <= 0) continue;

          const c = String(v.color || "").trim();
          const s = String(v.size || "").trim();
          const parts: string[] = [];
          if (c) parts.push(`Màu: ${c}`);
          if (s) parts.push(`Size: ${s}`);
          const displayName = parts.length > 0 ? `${p.name} (${parts.join(" - ")})` : p.name;
          const vCode = String(v.variantCode || v.barcode || p.code || "").trim();

          opts.push({
            optionKey: `${p._id}__${c}__${s}`,
            product: p,
            color: c,
            size: s,
            colorHexes: Array.isArray(v.colorHexes) ? v.colorHexes : [],
            variantCode: vCode,
            displayName,
            directFloor1: directF1,
            unpackableFloor1: unpackF1,
            stockFloor1: availF1,
          });
        }
      } else {
        const directF1 = Math.max(0, Number(p.stockFloor1 ?? p.stock) || 0);
        const availF1 = directF1 + unpackF1;
        if (availF1 > 0) {
          opts.push({
            optionKey: `${p._id}____`,
            product: p,
            color: "",
            size: "",
            colorHexes: Array.isArray(p.colorHexes) ? p.colorHexes : [],
            variantCode: String(p.barcode || p.code || "").trim(),
            displayName: p.name,
            directFloor1: directF1,
            unpackableFloor1: unpackF1,
            stockFloor1: availF1,
          });
        }
      }
    }
    return opts;
  }, [sellableProducts]);

  // Lọc & xếp hạng thông minh danh sách sản phẩm đổi mới theo ô search
  const filteredExchangeOptions = useMemo(() => {
    const q = exchangeSearch.trim();
    if (!q) return exchangeOptions.slice(0, 24);
    return filterAndRankBySearch(exchangeOptions, q, (opt) => [
      { text: opt.variantCode, weight: 1.7 },
      { text: opt.product.code, weight: 1.6 },
      { text: opt.product.barcode, weight: 1.5 },
      { text: opt.displayName, weight: 1.4 },
      { text: opt.product.name, weight: 1.3 },
      { text: opt.color, weight: 1.1 },
      { text: opt.size, weight: 1.1 },
      { text: opt.product.brand, weight: 1.0 },
      { text: opt.product.categoryName, weight: 0.8 },
    ]).slice(0, 30);
  }, [exchangeOptions, exchangeSearch]);

  const selectedQtyByOptionKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of exchangeRows) {
      map.set(r.optionKey, r.quantity);
    }
    return map;
  }, [exchangeRows]);

  // Debounce từ khóa tìm kiếm đơn hàng gốc (350ms) để gợi ý thông minh theo mã đơn / SĐT / tên khách
  const debouncedOrderQuery = useDebounce(orderCodeInput, 350);

  const matchingRecentOrders = useMemo(() => {
    if (!debouncedOrderQuery.trim()) return recentOrders.slice(0, 6);
    return filterAndRankBySearch(recentOrders, debouncedOrderQuery, (o) => [
      { text: o.orderCode || o.code, weight: 1.6 },
      { text: o.customerPhone, weight: 1.5 },
      { text: o.customerName, weight: 1.3 },
      ...(o.items || []).flatMap((it) => [
        { text: it.productCode, weight: 1.1 },
        { text: it.productName, weight: 1.0 },
      ]),
    ]).slice(0, 8);
  }, [recentOrders, debouncedOrderQuery]);

  const prepareOrderForReturn = useCallback((ord: Order, preserveMessages = false) => {
    setSelectedOrder(ord);
    setOrderCodeInput(ord.orderCode || ord.code || "");
    if (!preserveMessages) {
      setErrorMsg("");
      setSuccessMsg("");
    }

    const rows: ReturnItemForm[] = (ord.items || []).map((it, idx) => {
      const alreadyReturned = Number(it.returnedQuantity || 0);
      const maxReturnable = Math.max(0, Number(it.quantity) - alreadyReturned);
      return {
        lineIndex: idx,
        productId: it.productId,
        productCode: it.productCode,
        productName: it.productName,
        color: String(it.color || "").trim(),
        size: String(it.size || "").trim(),
        isGift: Boolean(it.isGift) || it.discountType === "GIFT",
        unitPrice: Number(it.unitPrice),
        maxReturnable,
        quantity: 0,
        condition: "GOOD",
      };
    });
    setReturnRows(rows);
    setExchangeRows([]);
    setExchangeSearch("");
  }, []);

  const handleSearchOrder = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const code = orderCodeInput.trim();
    if (!code) return;

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      // Thử tra theo endpoint /orders/by-code/:code trước, nếu không có thì lọc từ /orders
      try {
        const res = await apiRequest<Order>(
          `/orders/by-code/${encodeURIComponent(code)}`
        );
        if (res.data) {
          prepareOrderForReturn(res.data);
          return;
        }
      } catch {
        // Fallback tìm trong danh sách đơn hàng
      }

      const listRes = await apiRequest<Order[]>(
        `/orders?search=${encodeURIComponent(code)}`
      );
      const list = Array.isArray(listRes.data) ? listRes.data : [];
      const found =
        list.find(
          (o) =>
            (o.orderCode || o.code || "").toUpperCase() === code.toUpperCase() ||
            o._id === code
        ) || list[0];
      if (!found) {
        setSelectedOrder(null);
        setErrorMsg(`Không tìm thấy đơn hàng với mã hoặc từ khóa "${code}".`);
      } else {
        prepareOrderForReturn(found);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi khi tra cứu đơn hàng gốc.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddExchangeOption = useCallback((opt: ExchangeOption) => {
    setExchangeRows((prev) => {
      const existing = prev.find((r) => r.optionKey === opt.optionKey);
      if (existing) {
        if (existing.quantity + 1 > opt.stockFloor1) return prev;
        return prev.map((r) =>
          r.optionKey === opt.optionKey
            ? { ...r, stockFloor1: opt.stockFloor1, quantity: r.quantity + 1 }
            : r
        );
      }
      return [
        ...prev,
        {
          optionKey: opt.optionKey,
          product: opt.product,
          color: opt.color,
          size: opt.size,
          variantCode: opt.variantCode,
          displayName: opt.displayName,
          stockFloor1: opt.stockFloor1,
          quantity: 1,
        },
      ];
    });
  }, []);

  const handleExchangeSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    // Chặn Enter submit nhầm form xác nhận Trả/Đổi hàng
    e.preventDefault();
    const q = exchangeSearch.trim().toUpperCase();
    if (!q || filteredExchangeOptions.length === 0) return;

    const exactBarcodeOrCode = filteredExchangeOptions.find(
      (opt) =>
        opt.variantCode.toUpperCase() === q ||
        (opt.product.code || "").toUpperCase() === q ||
        (opt.product.barcode || "").toUpperCase() === q
    );
    const target =
      exactBarcodeOrCode ||
      (filteredExchangeOptions.length === 1 ? filteredExchangeOptions[0] : filteredExchangeOptions[0]);
    if (target) {
      handleAddExchangeOption(target);
      if (exactBarcodeOrCode) {
        setExchangeSearch("");
      }
    }
  };

  // Tính toán tài chính (bao gồm hoàn lại phí quẹt thẻ tương ứng nếu đơn gốc có thu phí thẻ)
  const returnSubtotal = returnRows.reduce(
    (sum, r) => sum + r.unitPrice * r.quantity,
    0
  );
  const refundedCardFee = useMemo(() => {
    if (!selectedOrder || returnSubtotal <= 0) return 0;
    const orderCardFee = Math.max(0, Math.round(Number(selectedOrder.cardFee) || 0));
    if (orderCardFee <= 0) return 0;

    const orderReturns: ReturnReceipt[] = Array.isArray((selectedOrder as any).returns)
      ? (selectedOrder as any).returns
      : recentReturns.filter(
          (r) =>
            r.orderId === selectedOrder._id ||
            r.orderCode === (selectedOrder.orderCode || selectedOrder.code)
        );
    const alreadyRefunded = orderReturns.reduce(
      (sum, r) => sum + Math.max(0, Math.round(Number(r.refundedCardFee) || 0)),
      0
    );
    const remainingCardFee = Math.max(0, orderCardFee - alreadyRefunded);

    const allPaidLinesReturned =
      returnRows.some((r) => r.quantity > 0) &&
      returnRows.every((r) => r.unitPrice <= 0 || r.quantity >= r.maxReturnable);

    if (allPaidLinesReturned) {
      return remainingCardFee;
    }
    const orderSubtotal = Math.max(0, Number(selectedOrder.subtotal) || 0);
    return orderSubtotal > 0
      ? Math.min(remainingCardFee, Math.round((returnSubtotal / orderSubtotal) * orderCardFee))
      : remainingCardFee;
  }, [selectedOrder, returnSubtotal, returnRows, recentReturns]);

  const returnTotal = returnSubtotal + refundedCardFee;
  const exchangeTotal =
    mode === "EXCHANGE"
      ? exchangeRows.reduce(
          (sum, r) => sum + r.product.sellingPrice * r.quantity,
          0
        )
      : 0;
  const netDifference = exchangeTotal - returnTotal;

  const handleSubmitReturnExchange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setErrorMsg("");
    setSuccessMsg("");

    const activeReturns = returnRows.filter((r) => r.quantity > 0);
    if (activeReturns.length === 0) {
      setErrorMsg("Vui lòng chọn ít nhất 1 sản phẩm khách trả lại ở Mục 1 (số lượng > 0).");
      return;
    }

    if (mode === "EXCHANGE" && exchangeRows.length === 0) {
      setErrorMsg(
        "Bạn đang chọn chế độ ĐỔI HÀNG. Vui lòng tìm và bấm '+ Chọn đổi' ít nhất 1 sản phẩm mới ở Mục 2."
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        orderId: selectedOrder._id,
        type: mode,
        refundMethod,
        note:
          note.trim() ||
          (mode === "EXCHANGE" ? "Khách đổi hàng tại quầy" : "Khách trả hàng tại quầy"),
        returnItems: activeReturns.map((r) => ({
          lineIndex: r.lineIndex,
          productId: r.productId,
          color: r.color,
          size: r.size,
          quantity: r.quantity,
          condition: r.condition,
        })),
        exchangeItems:
          mode === "EXCHANGE"
            ? exchangeRows.map((ex) => ({
                productId: ex.product._id,
                color: ex.color,
                size: ex.size,
                quantity: ex.quantity,
              }))
            : [],
      };

      const res = await apiRequest<any>("/returns", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const createdReturn = res.data?.returnExchange || res.data;
      const updatedOrder: Order | undefined = res.data?.order;

      setSuccessMsg(
        `Đã xử lý phiếu ${
          createdReturn?.returnCode || createdReturn?.code || "Trả/Đổi"
        } thành công! Tồn kho và trạng thái đơn gốc đã được cập nhật.`
      );
      setNote("");
      await loadInitialLists();

      if (updatedOrder && updatedOrder._id) {
        prepareOrderForReturn(updatedOrder, true);
      } else {
        try {
          const freshOrd = await apiRequest<Order>(
            `/orders/by-code/${encodeURIComponent(
              selectedOrder.orderCode || selectedOrder.code || selectedOrder._id
            )}`
          );
          if (freshOrd.data) {
            prepareOrderForReturn(freshOrd.data, true);
          }
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi khi xác nhận phiếu Trả/Đổi hàng.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Khung tìm đơn hàng gốc */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5">
        <h2 className="text-base sm:text-lg font-bold text-slate-900">
          Trả Hàng & Đổi Hàng Tại Quầy (BR-14, BR-15, BR-16)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Nhập mã đơn hàng cần trả/đổi. Hệ thống kiểm tra số lượng đã mua/đã trả, cộng lại kho cho hàng{" "}
          <strong>Còn bán được (GOOD)</strong> và tự động hoàn lại cả{" "}
          <strong>phí quẹt thẻ</strong> tương ứng (nếu đơn gốc có thu phí thẻ).
        </p>

        <form onSubmit={handleSearchOrder} className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="relative w-full sm:flex-1 sm:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={orderCodeInput}
              onChange={(e) => setOrderCodeInput(e.target.value)}
              placeholder="Nhập Mã đơn hàng gốc (VD: HD-0162)..."
              className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 font-mono text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm"
          >
            {loading ? "Đang kiểm tra..." : "Kiểm tra Đơn hàng"}
          </button>
        </form>

        {/* Chọn nhanh từ các đơn gần đây (hoặc khớp từ khóa đang gõ) */}
        {matchingRecentOrders.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">
              {orderCodeInput.trim() ? "Đơn hàng khớp tìm kiếm:" : "Chọn nhanh đơn hàng gần đây:"}
            </span>
            {matchingRecentOrders.map((o) => {
              const code = o.orderCode || o.code || o._id;
              return (
                <button
                  key={o._id}
                  type="button"
                  onClick={() => prepareOrderForReturn(o)}
                  className="min-h-[36px] max-w-full truncate px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-xs font-mono font-bold text-slate-700"
                >
                  {code} ({o.customerName})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Chi tiết xử lý Trả / Đổi khi đã chọn đơn gốc */}
      {selectedOrder && (
        <form
          onSubmit={handleSubmitReturnExchange}
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5 space-y-4 sm:space-y-6"
        >
          {/* Header thông tin đơn gốc */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4 bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase text-slate-500">
                Đơn hàng gốc đang chọn
              </div>
              <div className="text-base sm:text-lg font-mono font-extrabold text-slate-900 break-words">
                {selectedOrder.orderCode || selectedOrder.code} — {selectedOrder.customerName}
                {selectedOrder.customerPhone ? ` (${formatPhone(selectedOrder.customerPhone)})` : ""}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Ngày mua: {formatDateTime(selectedOrder.createdAt)} · Tiền hàng:{" "}
                <strong className="font-mono">{formatVND(selectedOrder.subtotal)}</strong> · Phí
                thẻ:{" "}
                <strong className="font-mono">{formatVND(selectedOrder.cardFee)}</strong>{" "}
                {Number(selectedOrder.cardFee) > 0 ? (
                  <span className="text-emerald-700 font-semibold">
                    (Có hoàn lại phí thẻ cho khách khi trả/đổi)
                  </span>
                ) : (
                  <span>(Không thu phí thẻ)</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-2 lg:shrink-0">
              <button
                type="button"
                onClick={() => setMode("RETURN")}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                  mode === "RETURN"
                    ? "bg-emerald-600 text-white shadow"
                    : "bg-white border border-slate-300 text-slate-700"
                }`}
              >
                <RotateCcw className="w-4 h-4" /> TRẢ HÀNG HOÀN TIỀN
              </button>
              <button
                type="button"
                onClick={() => setMode("EXCHANGE")}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                  mode === "EXCHANGE"
                    ? "bg-emerald-600 text-white shadow"
                    : "bg-white border border-slate-300 text-slate-700"
                }`}
              >
                <ArrowLeftRight className="w-4 h-4" /> ĐỔI SANG SẢN PHẨM MỚI
              </button>
            </div>
          </div>

          {/* 1. Bảng chọn sản phẩm trả lại & tình trạng hàng */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-slate-900 text-sm">
                1. Chọn sản phẩm khách trả lại & Tình trạng hàng (GOOD / DAMAGED):
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setReturnRows((prev) =>
                      prev.map((r) => ({ ...r, quantity: r.maxReturnable }))
                    )
                  }
                  disabled={returnRows.every((r) => r.maxReturnable === 0)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold disabled:opacity-50"
                >
                  Chọn trả toàn bộ đơn
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setReturnRows((prev) => prev.map((r) => ({ ...r, quantity: 0 })))
                  }
                  disabled={returnRows.every((r) => r.quantity === 0)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-50"
                >
                  Đặt lại về 0
                </button>
              </div>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-xl max-w-full">
              <table className="w-full min-w-[840px] text-xs text-left">
                <thead className="bg-slate-900 text-white uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Sản phẩm trong đơn</th>
                    <th className="py-2.5 px-3 text-right">Đơn giá gốc</th>
                    <th className="py-2.5 px-3 text-center">Còn có thể trả</th>
                    <th className="py-2.5 px-3 text-center w-40">Số lượng trả</th>
                    <th className="py-2.5 px-3 w-64">Tình trạng hàng trả về (BR-15)</th>
                    <th className="py-2.5 px-3 text-right">Thành tiền hoàn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {returnRows.map((row, idx) => (
                    <tr
                      key={`${row.lineIndex}-${row.productId}-${row.color}-${row.size}`}
                      className={row.quantity > 0 ? "bg-emerald-50/40" : "hover:bg-slate-50"}
                    >
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                          <span>{row.productName}</span>
                          {row.isGift && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                              🎁 Hàng tặng
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                          <span>{row.productCode}</span>
                          {(row.color || row.size) && (
                            <span className="font-sans text-[11px] font-semibold text-emerald-700">
                              {[
                                row.color ? `Màu: ${row.color}` : "",
                                row.size ? `Size: ${row.size}` : "",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold">
                        {formatVND(row.unitPrice)}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700">
                        {row.maxReturnable}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            disabled={row.quantity <= 0}
                            onClick={() =>
                              setReturnRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, quantity: Math.max(0, r.quantity - 1) } : r
                                )
                              )
                            }
                            className="w-8 h-9 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={row.maxReturnable}
                            disabled={row.maxReturnable === 0}
                            value={row.quantity}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.preventDefault();
                            }}
                            onChange={(e) => {
                              const val = Math.min(
                                row.maxReturnable,
                                Math.max(0, Number(e.target.value) || 0)
                              );
                              setReturnRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, quantity: val } : r
                                )
                              );
                            }}
                            className="w-16 min-h-[36px] px-1.5 py-1 rounded border border-slate-300 text-center font-mono font-bold"
                          />
                          <button
                            type="button"
                            disabled={row.quantity >= row.maxReturnable}
                            onClick={() =>
                              setReturnRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        quantity: Math.min(r.maxReturnable, r.quantity + 1),
                                      }
                                    : r
                                )
                              )
                            }
                            className="w-8 h-9 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-emerald-50 hover:border-emerald-400 disabled:opacity-40"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <select
                          disabled={row.quantity === 0}
                          value={row.condition}
                          onChange={(e) =>
                            setReturnRows((prev) =>
                              prev.map((r, i) =>
                                i === idx
                                  ? {
                                      ...r,
                                      condition: e.target.value as "GOOD" | "DAMAGED",
                                    }
                                  : r
                              )
                            )
                          }
                          className="w-full min-h-[40px] px-2.5 py-1.5 rounded border border-slate-300 bg-white font-semibold"
                        >
                          <option value="GOOD">
                            Còn bán được (GOOD) — Cộng lại Kho
                          </option>
                          <option value="DAMAGED">
                            Hỏng / Lỗi (DAMAGED) — Không cộng Kho
                          </option>
                        </select>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900">
                        {formatVND(row.unitPrice * row.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Nếu là ĐỔI HÀNG: Tìm kiếm & chọn sản phẩm mới từ Kho Tầng 1 */}
          {mode === "EXCHANGE" && (
            <div className="space-y-3 bg-emerald-50/50 p-3 sm:p-4 rounded-xl border border-emerald-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    2. Tìm & chọn sản phẩm mới xuất kho đổi cho khách (Kho Tầng 1):
                  </h3>
                  <p className="text-[11px] text-slate-600">
                    Gõ tên sản phẩm, mã SP, mã vạch / mã biến thể, màu sắc hoặc size để tìm nhanh (hoặc quét mã vạch và nhấn Enter).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={reloadSellableProducts}
                  disabled={loadingProducts}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingProducts ? "animate-spin" : ""}`} />
                  {loadingProducts ? "Đang tải..." : "Làm mới tồn kho"}
                </button>
              </div>

              {/* Ô Input Search sản phẩm để đổi */}
              <div className="relative">
                <Search className="w-4 h-4 text-emerald-600 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={exchangeSearch}
                  onChange={(e) => setExchangeSearch(e.target.value)}
                  onKeyDown={handleExchangeSearchKeyDown}
                  placeholder="Tìm sản phẩm đổi theo tên, mã SP, mã vạch, màu sắc, size..."
                  className="w-full min-h-[44px] pl-10 pr-10 py-2.5 rounded-xl border border-emerald-300 bg-white text-sm font-medium focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none"
                />
                {exchangeSearch && (
                  <button
                    type="button"
                    onClick={() => setExchangeSearch("")}
                    className="w-8 h-8 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 absolute right-2 top-1.5 rounded-lg hover:bg-slate-100"
                    title="Xóa từ khóa"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Danh sách kết quả gợi ý sản phẩm đổi */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
                  <span className="font-semibold">
                    {exchangeSearch.trim()
                      ? `Kết quả khớp "${exchangeSearch.trim()}" (${filteredExchangeOptions.length})`
                      : `Gợi ý sản phẩm sẵn sàng xuất đổi tại Kho Tầng 1 (${exchangeOptions.length} phân loại)`}
                  </span>
                  {exchangeSearch.trim() && filteredExchangeOptions.length > 0 && (
                    <span className="text-emerald-700 font-semibold hidden sm:inline">
                      Nhấn Enter để thêm nhanh kết quả đầu tiên
                    </span>
                  )}
                </div>

                {loadingProducts && exchangeOptions.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    Đang tải danh sách sản phẩm Kho Tầng 1...
                  </div>
                ) : filteredExchangeOptions.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    {exchangeSearch.trim()
                      ? `Không tìm thấy sản phẩm nào tại Kho Tầng 1 khớp với "${exchangeSearch.trim()}".`
                      : "Hiện không có sản phẩm nào còn tồn khả dụng tại Kho Tầng 1."}
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {filteredExchangeOptions.map((opt) => {
                      const chosenQty = selectedQtyByOptionKey.get(opt.optionKey) || 0;
                      const outOfRemaining = chosenQty >= opt.stockFloor1;
                      return (
                        <div
                          key={opt.optionKey}
                          className="px-3 py-2.5 hover:bg-emerald-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>{opt.product.name}</span>
                              {opt.color && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-800">
                                  {opt.colorHexes.length > 0 && (
                                    <span
                                      className="w-2.5 h-2.5 rounded-full border border-slate-300 shrink-0"
                                      style={{ backgroundColor: opt.colorHexes[0] }}
                                    />
                                  )}
                                  Màu: {opt.color}
                                </span>
                              )}
                              {opt.size && (
                                <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-[11px] font-bold text-indigo-800">
                                  Size: {opt.size}
                                </span>
                              )}
                              {chosenQty > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                                  Đã chọn: {chosenQty}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap mt-0.5">
                              <span className="font-mono font-semibold text-slate-700">
                                {opt.variantCode}
                              </span>
                              {opt.product.brand && <span>· {opt.product.brand}</span>}
                              {opt.product.categoryName && (
                                <span>· {opt.product.categoryName}</span>
                              )}
                              <span className="text-emerald-700 font-semibold">
                                · Tồn T1: {opt.directFloor1}
                                {opt.unpackableFloor1 > 0
                                  ? ` (+${opt.unpackableFloor1} tách bộ)`
                                  : ""}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            <span className="font-mono font-extrabold text-xs sm:text-sm text-emerald-700">
                              {formatVND(opt.product.sellingPrice)}
                            </span>
                            <button
                              type="button"
                              disabled={outOfRemaining}
                              onClick={() => handleAddExchangeOption(opt)}
                              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold inline-flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              {outOfRemaining ? "Đã tối đa tồn" : "Chọn đổi"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bảng sản phẩm đổi mới đã chọn */}
              {exchangeRows.length === 0 ? (
                <div className="p-3 rounded-xl border border-dashed border-emerald-300 bg-white/80 text-center text-xs text-slate-600">
                  Chưa có sản phẩm đổi mới nào được chọn. Hãy gõ tìm sản phẩm ở ô phía trên và bấm{" "}
                  <strong>+ Chọn đổi</strong>.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white max-w-full">
                  <table className="w-full min-w-[620px] text-xs text-left">
                    <thead className="bg-slate-800 text-white uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Sản phẩm đổi mới đã chọn</th>
                        <th className="py-2.5 px-3 text-right">Đơn giá</th>
                        <th className="py-2.5 px-3 text-center w-36">Số lượng đổi</th>
                        <th className="py-2.5 px-3 text-right">Thành tiền</th>
                        <th className="py-2.5 px-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {exchangeRows.map((ex, i) => (
                        <tr key={ex.optionKey}>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900">{ex.displayName}</div>
                            <div className="font-mono text-[11px] text-slate-500">
                              {ex.variantCode || ex.product.code} · Tối đa khả dụng: {ex.stockFloor1}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold">
                            {formatVND(ex.product.sellingPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                disabled={ex.quantity <= 1}
                                onClick={() =>
                                  setExchangeRows((prev) =>
                                    prev.map((r, idx) =>
                                      idx === i
                                        ? { ...r, quantity: Math.max(1, r.quantity - 1) }
                                        : r
                                    )
                                  )
                                }
                                className="w-8 h-9 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min={1}
                                max={ex.stockFloor1}
                                value={ex.quantity}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") e.preventDefault();
                                }}
                                onChange={(e) => {
                                  const val = Math.min(
                                    ex.stockFloor1,
                                    Math.max(1, Number(e.target.value) || 1)
                                  );
                                  setExchangeRows((prev) =>
                                    prev.map((r, idx) =>
                                      idx === i ? { ...r, quantity: val } : r
                                    )
                                  );
                                }}
                                className="w-14 min-h-[36px] px-1.5 py-1 rounded border border-slate-300 text-center font-mono font-bold"
                              />
                              <button
                                type="button"
                                disabled={ex.quantity >= ex.stockFloor1}
                                onClick={() =>
                                  setExchangeRows((prev) =>
                                    prev.map((r, idx) =>
                                      idx === i
                                        ? {
                                            ...r,
                                            quantity: Math.min(ex.stockFloor1, r.quantity + 1),
                                          }
                                        : r
                                    )
                                  )
                                }
                                className="w-8 h-9 inline-flex items-center justify-center rounded border border-slate-300 bg-white hover:bg-emerald-50 hover:border-emerald-400 disabled:opacity-40"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {formatVND(ex.product.sellingPrice * ex.quantity)}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setExchangeRows((prev) =>
                                  prev.filter((_, idx) => idx !== i)
                                )
                              }
                              className="w-9 h-9 inline-flex items-center justify-center text-red-500 hover:bg-red-50 rounded"
                              title="Xóa dòng đổi"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 3. Hình thức thanh toán hoàn/thu & Tổng kết tiền chênh lệch */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-start">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Hình thức thanh toán hoàn / thu thêm
                </label>
                <select
                  value={refundMethod}
                  onChange={(e) =>
                    setRefundMethod(e.target.value as "CASH" | "BANKING" | "CARD")
                  }
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white font-semibold"
                >
                  <option value="CASH">Tiền mặt (CASH)</option>
                  <option value="BANKING">Chuyển khoản (BANKING)</option>
                  <option value="CARD">Thẻ (CARD)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Ghi chú lý do Trả / Đổi
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                  placeholder="VD: Đổi size rộng hơn / Hàng lỗi đường may..."
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-xl space-y-2">
              <div className="flex justify-between gap-2 text-xs text-slate-300">
                <span>Tiền hàng trả lại (Giá sản phẩm):</span>
                <span className="font-mono font-bold text-amber-400">
                  {formatVND(returnSubtotal)}
                </span>
              </div>
              {Number(selectedOrder.cardFee) > 0 && (
                <div className="flex justify-between gap-2 text-xs text-emerald-300">
                  <span>
                    Hoàn lại phí quẹt thẻ
                    {selectedOrder.cardFeePercent ? ` (${selectedOrder.cardFeePercent}%)` : ""}:
                  </span>
                  <span className="font-mono font-bold">
                    +{formatVND(refundedCardFee)}
                  </span>
                </div>
              )}
              {refundedCardFee > 0 && (
                <div className="flex justify-between gap-2 text-xs text-slate-200">
                  <span>Tổng giá trị hoàn từ đơn cũ:</span>
                  <span className="font-mono font-bold text-amber-300">
                    {formatVND(returnTotal)}
                  </span>
                </div>
              )}
              {mode === "EXCHANGE" && (
                <div className="flex justify-between gap-2 text-xs text-slate-300">
                  <span>Tổng giá trị hàng đổi mới:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {formatVND(exchangeTotal)}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-700 flex flex-wrap justify-between items-center gap-x-2 gap-y-1">
                <span className="text-sm font-extrabold uppercase">
                  {netDifference > 0
                    ? "Khách cần trả thêm:"
                    : netDifference < 0
                    ? "Cửa hàng hoàn lại khách:"
                    : "Chênh lệch thanh toán:"}
                </span>
                <span
                  className={`font-mono text-xl font-extrabold ${
                    netDifference > 0 ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {formatVND(Math.abs(netDifference))}
                </span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[48px] mt-3 py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-lg"
              >
                {submitting
                  ? "Đang xử lý..."
                  : mode === "EXCHANGE"
                  ? "XÁC NHẬN PHIẾU ĐỔI HÀNG"
                  : "XÁC NHẬN PHIẾU TRẢ HÀNG & HOÀN TIỀN"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Danh sách phiếu trả/đổi gần đây */}
      {recentReturns.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5">
          <h3 className="font-bold text-slate-900 text-sm mb-3">
            Lịch sử Phiếu Trả / Đổi Hàng gần đây
          </h3>
          <div className="overflow-x-auto border border-slate-200 rounded-xl max-w-full">
            <table className="w-full min-w-[760px] text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 uppercase">
                <tr>
                  <th className="py-2.5 px-3">Mã Phiếu</th>
                  <th className="py-2.5 px-3">Đơn gốc</th>
                  <th className="py-2.5 px-3">Loại</th>
                  <th className="py-2.5 px-3 text-right">Tiền hàng trả</th>
                  <th className="py-2.5 px-3 text-right">Tiền hàng đổi</th>
                  <th className="py-2.5 px-3 text-right">Chênh lệch</th>
                  <th className="py-2.5 px-3">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {recentReturns.slice(0, 8).map((r) => (
                  <tr key={r._id}>
                    <td className="py-2.5 px-3 font-mono font-bold">
                      {r.returnCode || r.code}
                    </td>
                    <td className="py-2.5 px-3 font-mono">{r.orderCode}</td>
                    <td className="py-2.5 px-3 font-bold">
                      {r.type === "EXCHANGE" ? "Đổi hàng" : "Trả hàng"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      <div>{formatVND(r.returnTotal)}</div>
                      {Number(r.refundedCardFee) > 0 && (
                        <div className="text-[10px] text-emerald-700 font-sans font-semibold">
                          (gồm phí thẻ {formatVND(Number(r.refundedCardFee))})
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {formatVND(r.exchangeTotal)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                      {r.netDifference < 0
                        ? `Hoàn khách ${formatVND(Math.abs(r.netDifference))}`
                        : r.netDifference > 0
                        ? `Thu thêm ${formatVND(r.netDifference)}`
                        : "0 ₫"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {formatDateTime(r.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
