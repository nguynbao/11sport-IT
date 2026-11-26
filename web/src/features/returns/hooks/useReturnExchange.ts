import { useState, useEffect, useMemo, useCallback } from "react";
import type { Order, Product, ReturnCalculateResult, ReturnReceipt } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { formatNumberDots, formatVND } from "@/shared/utils/format";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { filterAndRankBySearch } from "@/shared/lib/search";
import { findVariantByColorSize } from "@/shared/utils/productCode";
import {
  type ExchangeItemForm,
  type ExchangeOption,
  type ReturnItemForm,
  exchangeUnitPrice,
  getExchangeItemPricing,
} from "../types";

export function useReturnExchange() {
  const [orderCodeInput, setOrderCodeInput] = useState("");
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [sellableProducts, setSellableProducts] = useState<Product[]>([]);
  const [recentReturns, setRecentReturns] = useState<ReturnReceipt[]>([]);

  const mode = "EXCHANGE" as const;
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
      const hasPrice =
        Number(p.sellingPrice) > 0 || (p.variants || []).some((v) => Number(v.sellingPrice || 0) > 0);
      return hasPrice && directF1 + unpackF1 > 0;
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

  const filteredExchangeOptions = useMemo(() => {
    const q = exchangeSearch.trim();
    if (!q) return exchangeOptions.slice(0, 24);
    return filterAndRankBySearch(exchangeOptions, q, (opt) => [
      { text: opt.variantCode, weight: 1.7 },
      { text: opt.product.code, weight: 1.6 },
      { text: opt.product.legacyCode, weight: 1.4 },
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
        originalUnitPrice: Number((it as any).originalUnitPrice || it.unitPrice || 0),
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
      try {
        const res = await apiRequest<Order>(`/orders/by-code/${encodeURIComponent(code)}`);
        if (res.data) {
          prepareOrderForReturn(res.data);
          return;
        }
      } catch {
        // Fallback tìm trong danh sách đơn hàng
      }

      const listRes = await apiRequest<Order[]>(
        `/orders?search=${encodeURIComponent(code)}&forReturn=true`
      );
      const list = Array.isArray(listRes.data) ? listRes.data : [];
      const found =
        list.find(
          (o) =>
            (o.orderCode || o.code || "").toUpperCase() === code.toUpperCase() || o._id === code
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
          discountType: "NONE",
          discountValue: 0,
          discountInputMode: "NONE",
        },
      ];
    });
  }, []);

  const handleChangeExchangeDiscount = (
    optionKey: string,
    discountType: "NONE" | "PERCENT" | "AMOUNT",
    rawVal: number,
    discountInputMode?: "NONE" | "PERCENT" | "AMOUNT" | "PRICE",
    customPriceText?: string
  ) => {
    setExchangeRows((prev) =>
      prev.map((ex) => {
        if (ex.optionKey !== optionKey) return ex;
        const origPrice = exchangeUnitPrice(ex);
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
          ...ex,
          discountType,
          discountValue: cleanVal,
          discountInputMode: resolvedMode,
          customPriceText:
            resolvedMode === "PRICE"
              ? customPriceText !== undefined
                ? customPriceText
                : formatNumberDots(Math.max(0, origPrice - cleanVal))
              : undefined,
        };
      })
    );
  };

  const handleChangeExchangeDesiredPrice = (optionKey: string, rawText: string) => {
    const digits = rawText.replace(/[^\d]/g, "");
    setExchangeRows((prev) =>
      prev.map((ex) => {
        if (ex.optionKey !== optionKey) return ex;
        const origPrice = exchangeUnitPrice(ex);
        if (!digits) {
          return {
            ...ex,
            discountType: "NONE",
            discountValue: 0,
            discountInputMode: "NONE",
            customPriceText: "",
          };
        }
        const enteredPrice = Math.min(origPrice, Math.max(0, Number(digits) || 0));
        const computedDiscount = Math.max(0, origPrice - enteredPrice);
        return {
          ...ex,
          discountType: computedDiscount > 0 ? "AMOUNT" : "NONE",
          discountValue: computedDiscount,
          discountInputMode: "PRICE",
          customPriceText: formatNumberDots(enteredPrice),
        };
      })
    );
  };

  const handleExchangeSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = exchangeSearch.trim().toUpperCase();
    if (!q || filteredExchangeOptions.length === 0) return;

    const exactBarcodeOrCode = filteredExchangeOptions.find(
      (opt) =>
        opt.variantCode.toUpperCase() === q ||
        (opt.product.code || "").toUpperCase() === q ||
        (opt.product.legacyCode || "").toUpperCase() === q ||
        (opt.product.legacyCodes || []).some((c) => c.toUpperCase() === q) ||
        (() => {
          const v = findVariantByColorSize(opt.product, opt.color, opt.size);
          return Boolean(
            v &&
              (String(v.legacyVariantCode || "").toUpperCase() === q ||
                (v.legacyVariantCodes || []).some((c) => c.toUpperCase() === q))
          );
        })() ||
        (opt.product.barcode || "").toUpperCase() === q
    );
    const target = exactBarcodeOrCode || filteredExchangeOptions[0];
    if (target) {
      handleAddExchangeOption(target);
      if (exactBarcodeOrCode) {
        setExchangeSearch("");
      }
    }
  };

  const [serverCalc, setServerCalc] = useState<ReturnCalculateResult | null>(null);

  useEffect(() => {
    const activeReturns = returnRows.filter((r) => r.quantity > 0);
    if (!selectedOrder || activeReturns.length === 0) {
      setServerCalc(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await apiRequest<ReturnCalculateResult>("/returns/calculate", {
          method: "POST",
          body: JSON.stringify({
            orderId: selectedOrder._id,
            type: mode,
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
                ? exchangeRows.map((ex) => {
                    const pricing = getExchangeItemPricing(ex);
                    return {
                      productId: ex.product._id,
                      color: ex.color,
                      size: ex.size,
                      quantity: ex.quantity,
                      originalUnitPrice: pricing.originalUnitPrice,
                      discountType: ex.discountValue > 0 ? ex.discountType : "NONE",
                      discountValue: ex.discountValue > 0 ? ex.discountValue : 0,
                      unitPrice: pricing.unitPrice,
                    };
                  })
                : [],
          }),
        });
        if (!cancelled && res.data) {
          setServerCalc(res.data);
        }
      } catch {
        if (!cancelled) setServerCalc(null);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedOrder, mode, returnRows, exchangeRows]);

  const localCalc = useMemo(() => {
    if (!selectedOrder) {
      return {
        unitRefundPrices: [] as number[],
        lineRefundTotals: [] as number[],
        returnSubtotal: 0,
        refundedCardFee: 0,
        returnTotal: 0,
        exchangeRawSubtotal: 0,
        exchangeDiscountTotal: 0,
        exchangeTotal: 0,
        netDifference: 0,
        refundAmount: 0,
        additionalCharge: 0,
        debtBefore: 0,
        debtReduction: 0,
        cashRefund: 0,
        debtAfter: 0,
      };
    }

    const orderItems = Array.isArray(selectedOrder.items) ? selectedOrder.items : [];
    const orderSubtotalS = Math.max(
      0,
      Number(selectedOrder.subtotal) ||
        orderItems.reduce(
          (sum, it) =>
            sum +
            (Boolean(it.isGift) || it.discountType === "GIFT"
              ? 0
              : Math.max(
                  0,
                  Number(it.lineTotal) ||
                    Math.max(0, Number(it.unitPrice) || 0) * Math.max(0, Number(it.quantity) || 0)
                )),
          0
        )
    );
    const orderBillDiscB = Math.min(
      orderSubtotalS,
      Math.max(0, Math.round(Number(selectedOrder.billDiscountAmount) || 0))
    );

    const paidLineIndices = orderItems
      .map((it, idx) => ({ it, idx }))
      .filter(({ it }) => {
        const lTotal =
          Number(it.lineTotal) ||
          Math.max(0, Number(it.unitPrice) || 0) * Math.max(0, Number(it.quantity) || 0);
        return !it.isGift && it.discountType !== "GIFT" && lTotal > 0;
      })
      .map(({ idx }) => idx);
    const lastPaidIdx = paidLineIndices.length > 0 ? paidLineIndices[paidLineIndices.length - 1] : -1;

    const lineNetAmounts: number[] = [];
    let allocatedBillDisc = 0;
    for (let idx = 0; idx < orderItems.length; idx++) {
      const it = orderItems[idx];
      const lineTotal = Math.max(
        0,
        Number(it.lineTotal) ||
          Math.max(0, Number(it.unitPrice) || 0) * Math.max(0, Number(it.quantity) || 0)
      );
      if (it.isGift || it.discountType === "GIFT" || lineTotal <= 0 || orderSubtotalS <= 0 || orderBillDiscB <= 0) {
        lineNetAmounts[idx] = lineTotal;
        continue;
      }
      let bShare = 0;
      if (idx === lastPaidIdx) {
        bShare = Math.max(0, orderBillDiscB - allocatedBillDisc);
      } else {
        bShare = Math.min(
          Math.max(0, orderBillDiscB - allocatedBillDisc),
          Math.round((lineTotal / orderSubtotalS) * orderBillDiscB)
        );
      }
      allocatedBillDisc += bShare;
      lineNetAmounts[idx] = Math.max(0, lineTotal - bShare);
    }

    const orderNetGoods = Math.max(0, orderSubtotalS - orderBillDiscB);
    const unitRefundPrices: number[] = [];
    const lineRefundTotals: number[] = [];
    let calcReturnSubtotal = 0;

    for (let i = 0; i < returnRows.length; i++) {
      const r = returnRows[i];
      const ordItem = orderItems[r.lineIndex];
      const q_i = Math.max(1, Number(ordItem?.quantity || r.maxReturnable || 1));
      const alreadyReturned = Math.min(q_i, Math.max(0, Number(ordItem?.returnedQuantity || 0)));
      const N_i = lineNetAmounts[r.lineIndex] ?? Math.max(0, Math.round(r.unitPrice * q_i));
      const unitRefundPrice = r.isGift ? 0 : Math.max(0, Math.round(N_i / q_i));
      unitRefundPrices[i] = unitRefundPrice;

      if (r.quantity <= 0 || r.isGift) {
        lineRefundTotals[i] = 0;
        continue;
      }
      const alreadyAllocNet =
        alreadyReturned >= q_i
          ? N_i
          : alreadyReturned > 0
            ? Math.round((alreadyReturned / q_i) * N_i)
            : 0;
      const remainingNetForLine = Math.max(0, N_i - alreadyAllocNet);
      const isReturningRemainingAll = alreadyReturned + r.quantity >= q_i;
      const lineRefundTotal = isReturningRemainingAll
        ? remainingNetForLine
        : Math.min(remainingNetForLine, Math.round((r.quantity / q_i) * N_i));
      lineRefundTotals[i] = lineRefundTotal;
      calcReturnSubtotal += lineRefundTotal;
    }

    let calcRefundedCardFee = 0;
    const orderCardFee = Math.max(0, Math.round(Number(selectedOrder.cardFee) || 0));
    if (orderCardFee > 0 && calcReturnSubtotal > 0) {
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
        calcRefundedCardFee = remainingCardFee;
      } else {
        const baseForFee =
          orderNetGoods > 0 ? orderNetGoods : Math.max(0, Number(selectedOrder.subtotal) || 0);
        calcRefundedCardFee =
          baseForFee > 0
            ? Math.min(remainingCardFee, Math.round((calcReturnSubtotal / baseForFee) * orderCardFee))
            : remainingCardFee;
      }
    }

    const calcReturnTotal = calcReturnSubtotal + calcRefundedCardFee;
    const calcExchangeRawSubtotal =
      mode === "EXCHANGE"
        ? exchangeRows.reduce(
            (sum, r) => sum + getExchangeItemPricing(r).originalUnitPrice * r.quantity,
            0
          )
        : 0;
    const calcExchangeDiscountTotal =
      mode === "EXCHANGE"
        ? exchangeRows.reduce((sum, r) => sum + getExchangeItemPricing(r).discountAmount, 0)
        : 0;
    const calcExchangeTotal =
      mode === "EXCHANGE"
        ? exchangeRows.reduce((sum, r) => sum + getExchangeItemPricing(r).lineTotal, 0)
        : 0;
    const calcNetDifference = calcExchangeTotal - calcReturnTotal;
    const calcRefundAmount = calcNetDifference < 0 ? Math.abs(calcNetDifference) : 0;
    const calcAdditionalCharge = calcNetDifference > 0 ? calcNetDifference : 0;
    const calcDebtBefore = Math.max(0, Math.round(Number(selectedOrder.debtAmount) || 0));
    const calcDebtReduction = Math.min(calcDebtBefore, calcRefundAmount);
    const calcCashRefund = Math.max(0, calcRefundAmount - calcDebtReduction);
    const calcDebtAfter = Math.max(0, calcDebtBefore - calcDebtReduction);

    return {
      unitRefundPrices,
      lineRefundTotals,
      returnSubtotal: calcReturnSubtotal,
      refundedCardFee: calcRefundedCardFee,
      returnTotal: calcReturnTotal,
      exchangeRawSubtotal: calcExchangeRawSubtotal,
      exchangeDiscountTotal: calcExchangeDiscountTotal,
      exchangeTotal: calcExchangeTotal,
      netDifference: calcNetDifference,
      refundAmount: calcRefundAmount,
      additionalCharge: calcAdditionalCharge,
      debtBefore: calcDebtBefore,
      debtReduction: calcDebtReduction,
      cashRefund: calcCashRefund,
      debtAfter: calcDebtAfter,
    };
  }, [selectedOrder, returnRows, exchangeRows, mode, recentReturns]);

  const returnSubtotal = serverCalc?.returnSubtotal ?? localCalc.returnSubtotal;
  const refundedCardFee = serverCalc?.refundedCardFee ?? localCalc.refundedCardFee;
  const returnTotal = serverCalc?.returnTotal ?? localCalc.returnTotal;
  const exchangeRawSubtotal = localCalc.exchangeRawSubtotal ?? 0;
  const exchangeDiscountTotal = localCalc.exchangeDiscountTotal ?? 0;
  const exchangeTotal = serverCalc?.exchangeTotal ?? localCalc.exchangeTotal;
  const netDifference = serverCalc?.netDifference ?? localCalc.netDifference;
  const refundAmount = serverCalc?.refundAmount ?? localCalc.refundAmount;
  const debtBefore = serverCalc?.debtBefore ?? localCalc.debtBefore;
  const debtReduction = serverCalc?.debtReduction ?? localCalc.debtReduction;
  const cashRefund = serverCalc?.cashRefund ?? localCalc.cashRefund;
  const debtAfter = serverCalc?.debtAfter ?? localCalc.debtAfter;

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
            ? exchangeRows.map((ex) => {
                const pricing = getExchangeItemPricing(ex);
                return {
                  productId: ex.product._id,
                  color: ex.color,
                  size: ex.size,
                  quantity: ex.quantity,
                  originalUnitPrice: pricing.originalUnitPrice,
                  discountType: ex.discountValue > 0 ? ex.discountType : "NONE",
                  discountValue: ex.discountValue > 0 ? ex.discountValue : 0,
                  unitPrice: pricing.unitPrice,
                };
              })
            : [],
      };

      const res = await apiRequest<any>("/returns", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const createdReturn = res.data?.returnExchange || res.data;
      const updatedOrder: Order | undefined = res.data?.order;

      const createdDebtReduction = Number(createdReturn?.debtReduction || 0);
      const createdRefundAmount = Number(
        createdReturn?.refundAmount ?? Math.max(0, -Number(createdReturn?.netDifference || 0))
      );
      const createdCashRefund = Number(
        createdReturn?.cashRefund ?? Math.max(0, createdRefundAmount - createdDebtReduction)
      );
      const createdDebtAfter = Number(createdReturn?.debtAfter ?? updatedOrder?.debtAmount ?? 0);

      setSuccessMsg(
        createdDebtReduction > 0
          ? `Đã xử lý phiếu ${
              createdReturn?.returnCode || createdReturn?.code || "Trả/Đổi"
            } thành công! Tổng tiền hoàn trả: ${formatVND(
              createdRefundAmount
            )} · Cấn trừ vào công nợ đơn gốc: -${formatVND(
              createdDebtReduction
            )} (Nợ còn lại: ${formatVND(
              createdDebtAfter
            )}) · Tiền mặt/CK thực hoàn cho khách: ${formatVND(createdCashRefund)}.`
          : `Đã xử lý phiếu ${
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

  return {
    orderCodeInput,
    setOrderCodeInput,
    selectedOrder,
    recentReturns,
    mode,
    refundMethod,
    setRefundMethod,
    note,
    setNote,
    returnRows,
    setReturnRows,
    exchangeRows,
    setExchangeRows,
    exchangeSearch,
    setExchangeSearch,
    loading,
    loadingProducts,
    submitting,
    errorMsg,
    successMsg,
    reloadSellableProducts,
    exchangeOptions,
    filteredExchangeOptions,
    selectedQtyByOptionKey,
    matchingRecentOrders,
    prepareOrderForReturn,
    handleSearchOrder,
    handleAddExchangeOption,
    handleChangeExchangeDiscount,
    handleChangeExchangeDesiredPrice,
    handleExchangeSearchKeyDown,
    serverCalc,
    localCalc,
    returnSubtotal,
    refundedCardFee,
    returnTotal,
    exchangeRawSubtotal,
    exchangeDiscountTotal,
    exchangeTotal,
    netDifference,
    refundAmount,
    debtBefore,
    debtReduction,
    cashRefund,
    debtAfter,
    handleSubmitReturnExchange,
  };
}
