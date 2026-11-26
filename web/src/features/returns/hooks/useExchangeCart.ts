import { useState, useEffect, useMemo, useCallback } from "react";
import type { Product } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { formatNumberDots } from "@/shared/utils/format";
import { filterAndRankBySearch } from "@/shared/lib/search";
import { findVariantByColorSize } from "@/shared/utils/productCode";
import {
  type ExchangeItemForm,
  type ExchangeOption,
  exchangeUnitPrice,
} from "../types";

export function useExchangeCart() {
  const [sellableProducts, setSellableProducts] = useState<Product[]>([]);
  const [exchangeRows, setExchangeRows] = useState<ExchangeItemForm[]>([]);
  const [exchangeSearch, setExchangeSearch] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);

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

  const applySellableList = useCallback(
    (rawList: Product[]) => {
      setSellableProducts(filterValidSellableProducts(rawList));
    },
    [filterValidSellableProducts]
  );

  useEffect(() => {
    if (sellableProducts.length === 0 && !loadingProducts) {
      reloadSellableProducts();
    }
  }, [sellableProducts.length, loadingProducts, reloadSellableProducts]);

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

  return {
    exchangeRows,
    setExchangeRows,
    exchangeSearch,
    setExchangeSearch,
    loadingProducts,
    reloadSellableProducts,
    applySellableList,
    exchangeOptions,
    filteredExchangeOptions,
    selectedQtyByOptionKey,
    handleAddExchangeOption,
    handleChangeExchangeDiscount,
    handleChangeExchangeDesiredPrice,
    handleExchangeSearchKeyDown,
  };
}
