"use client";

import { useEffect, useRef } from "react";
import { generateVariantProductCode } from "./api";

/**
 * Chuẩn hóa chuỗi mã vạch về dạng IN HOA VIẾT LIỀN (chỉ giữ A-Z và 0-9).
 */
export function cleanBarcodeCode(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

/**
 * Bản đồ chuyển đổi dấu thanh & dấu mũ Tiếng Việt (NFD) ngược về phím gõ Telex.
 * Khắc phục triệt để lỗi khi máy tính đang bật Unikey / EVKey (Telex) lúc máy quét mã vạch bắn chuỗi ký tự.
 */
const NFD_TO_TELEX_KEY: Record<string, string> = {
  "\u0301": "S", // Dấu sắc
  "\u0300": "F", // Dấu huyền
  "\u0309": "R", // Dấu hỏi
  "\u0303": "X", // Dấu ngã
  "\u0323": "J", // Dấu nặng
  "\u0306": "W", // Dấu á (Ă)
  "\u031B": "W", // Dấu móc (Ơ, Ư)
};

export function getBarcodeCandidates(rawInput: string): string[] {
  if (!rawInput || typeof rawInput !== "string") return [];
  const trimmed = rawInput.trim();
  if (!trimmed) return [];

  const candidates = new Set<string>();

  const basicClean = cleanBarcodeCode(trimmed);
  if (basicClean) candidates.add(basicClean);

  const nfd = trimmed.normalize("NFD");
  let inlineTelex = "";
  let delayedTones = "";
  let lastBaseVowel = "";

  for (let i = 0; i < nfd.length; i++) {
    const ch = nfd[i];
    if (ch === "đ" || ch === "Đ") {
      inlineTelex += "DD";
      lastBaseVowel = "";
      continue;
    }
    if (ch === "\u0302") {
      inlineTelex += lastBaseVowel || "";
      continue;
    }
    if (NFD_TO_TELEX_KEY[ch]) {
      const telexKey = NFD_TO_TELEX_KEY[ch];
      inlineTelex += telexKey;
      delayedTones += telexKey;
      continue;
    }
    const upper = ch.toUpperCase();
    if (/^[A-Z0-9]$/.test(upper)) {
      if (/^[0-9]$/.test(upper) && delayedTones) {
        delayedTones = "";
      }
      inlineTelex += upper;
      if (/^[AEIOUY]$/.test(upper)) {
        lastBaseVowel = upper;
      }
    }
  }

  if (inlineTelex) {
    candidates.add(inlineTelex);
  }

  let deferredTelex = "";
  let pendingModifiers = "";
  let prevVowelForCircumflex = "";

  for (let i = 0; i < nfd.length; i++) {
    const ch = nfd[i];
    if (ch === "đ" || ch === "Đ") {
      deferredTelex += "DD";
      prevVowelForCircumflex = "";
      continue;
    }
    if (ch === "\u0302") {
      deferredTelex += prevVowelForCircumflex || "";
      continue;
    }
    if (NFD_TO_TELEX_KEY[ch]) {
      pendingModifiers += NFD_TO_TELEX_KEY[ch];
      continue;
    }
    const upper = ch.toUpperCase();
    if (/^[0-9]$/.test(upper)) {
      if (pendingModifiers) {
        deferredTelex += pendingModifiers;
        pendingModifiers = "";
      }
      deferredTelex += upper;
    } else if (/^[A-Z]$/.test(upper)) {
      deferredTelex += upper;
      if (/^[AEIOUY]$/.test(upper)) {
        prevVowelForCircumflex = upper;
      }
    }
  }
  if (pendingModifiers) {
    deferredTelex += pendingModifiers;
  }
  if (deferredTelex) {
    candidates.add(deferredTelex);
  }

  return Array.from(candidates);
}

function isOrderedSubsequence(sub: string, target: string): boolean {
  let i = 0;
  let j = 0;
  while (i < sub.length && j < target.length) {
    if (sub[i] === target[j]) {
      i++;
    }
    j++;
  }
  return i === sub.length;
}

export function isScannedCodeMatch(
  rawScanned: string,
  productCode?: string,
  productBarcode?: string
): boolean {
  if (!rawScanned) return false;
  const targets = [
    cleanBarcodeCode(productCode || ""),
    cleanBarcodeCode(productBarcode || ""),
  ].filter(Boolean);
  if (targets.length === 0) return false;

  const candidates = getBarcodeCandidates(rawScanned);
  for (const t of targets) {
    if (candidates.includes(t)) return true;
  }

  const inlineCandidate = candidates[1] || candidates[0] || "";
  const basicBase = candidates[0] || "";
  if (!inlineCandidate || !basicBase) return false;

  const scannedDigits = inlineCandidate.replace(/[^0-9]/g, "");
  const sortedScannedChars = inlineCandidate.split("").sort().join("");

  for (const t of targets) {
    if (t.length !== inlineCandidate.length) continue;
    const targetDigits = t.replace(/[^0-9]/g, "");
    if (scannedDigits !== targetDigits) continue;
    const sortedTargetChars = t.split("").sort().join("");
    if (
      sortedScannedChars === sortedTargetChars &&
      isOrderedSubsequence(basicBase, t)
    ) {
      return true;
    }
  }

  return false;
}

export interface ScannedProductVariantMatch<T> {
  product: T;
  matchedVariant?: {
    variantKey?: string;
    color: string;
    size: string;
    variantCode: string;
    stockFloor1: number;
    stockFloor2: number;
    stock: number;
  };
  isVariantExactMatch: boolean;
}

/**
 * Tìm sản phẩm VÀ biến thể (Màu, Size) tương ứng theo chuỗi mã vạch vừa quét.
 * - Ưu tiên 1: Khớp chính xác Mã con theo thuộc tính (VD: GASIA221401DO38 -> Giày Asia Đỏ Size 38).
 * - Ưu tiên 2: Khớp Mã gốc của sản phẩm (VD: GASIA221401).
 */
export function findProductAndVariantByScannedBarcode<
  T extends {
    code?: string;
    barcode?: string;
    variants?: Array<{
      variantKey?: string;
      color: string;
      size: string;
      variantCode?: string;
      barcode?: string;
      stockFloor1: number;
      stockFloor2: number;
      stock: number;
    }>;
  }
>(products: T[], rawScanned: string): ScannedProductVariantMatch<T> | undefined {
  if (!rawScanned || !Array.isArray(products) || products.length === 0) {
    return undefined;
  }

  // 1. Ưu tiên khớp Mã con (variantCode) của từng thuộc tính (color, size)
  for (const p of products) {
    if (Array.isArray(p.variants) && p.variants.length > 0) {
      for (const v of p.variants) {
        const vCode =
          v.variantCode || generateVariantProductCode(p.code, v.color, v.size);
        if (vCode && isScannedCodeMatch(rawScanned, vCode, v.barcode || vCode)) {
          return {
            product: p,
            matchedVariant: {
              ...v,
              variantCode: vCode,
            },
            isVariantExactMatch: Boolean(v.color || v.size),
          };
        }
      }
    }
  }

  // 2. Khớp Mã gốc của sản phẩm
  const exactRoot = products.find((p) =>
    isScannedCodeMatch(rawScanned, p.code, p.barcode)
  );
  if (exactRoot) {
    const singleVariant =
      Array.isArray(exactRoot.variants) && exactRoot.variants.length === 1
        ? {
            ...exactRoot.variants[0],
            variantCode:
              exactRoot.variants[0].variantCode ||
              generateVariantProductCode(
                exactRoot.code,
                exactRoot.variants[0].color,
                exactRoot.variants[0].size
              ),
          }
        : undefined;
    return {
      product: exactRoot,
      matchedVariant: singleVariant,
      isVariantExactMatch: Boolean(singleVariant),
    };
  }

  // 3. Nếu mã quét có dấu phân cách (VD: GASIA221401-DO-38)
  const parts = rawScanned.trim().split(/[-_/:|\s]+/);
  if (parts.length > 1 && parts[0].length >= 4) {
    const basePart = parts[0];
    const byBase = products.find((p) =>
      isScannedCodeMatch(basePart, p.code, p.barcode)
    );
    if (byBase) {
      return {
        product: byBase,
        isVariantExactMatch: false,
      };
    }
  }

  return undefined;
}

export function findProductByScannedBarcode<
  T extends {
    code?: string;
    barcode?: string;
    variants?: Array<{
      variantKey?: string;
      color: string;
      size: string;
      variantCode?: string;
      barcode?: string;
      stockFloor1: number;
      stockFloor2: number;
      stock: number;
    }>;
  }
>(products: T[], rawScanned: string): T | undefined {
  return findProductAndVariantByScannedBarcode(products, rawScanned)?.product;
}

export function playScannerBeep(kind: "success" | "warning" | "error" = "success") {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (kind === "success") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1180, ctx.currentTime);
      osc.frequency.setValueAtTime(1560, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
      osc.onended = () => ctx.close().catch(() => {});
    } else if (kind === "warning") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(740, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.09);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
      osc.onended = () => ctx.close().catch(() => {});
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(240, ctx.currentTime);
      osc.frequency.setValueAtTime(180, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.32);
      osc.onended = () => ctx.close().catch(() => {});
    }
  } catch {
    // ignore audio error
  }
}

interface UseHardwareBarcodeScannerOptions {
  enabled?: boolean;
  onScan: (scannedCode: string) => void;
  minLength?: number;
}

export function useHardwareBarcodeScanner({
  enabled = true,
  onScan,
  minLength = 4,
}: UseHardwareBarcodeScannerOptions) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const bufferRef = useRef<{
    chars: string;
    firstKeyTime: number;
    lastKeyTime: number;
    startedInEditable: boolean;
    targetElement: HTMLElement | null;
    originalInputValue: string;
  }>({
    chars: "",
    firstKeyTime: 0,
    lastKeyTime: 0,
    startedInEditable: false,
    targetElement: null,
    originalInputValue: "",
  });

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const resetBuffer = () => {
      bufferRef.current = {
        chars: "",
        firstKeyTime: 0,
        lastKeyTime: 0,
        startedInEditable: false,
        targetElement: null,
        originalInputValue: "",
      };
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toUpperCase() || "";
      const isDedicatedBarcodeInput =
        target?.getAttribute?.("data-barcode-input") === "true";

      if (isDedicatedBarcodeInput) {
        resetBuffer();
        return;
      }

      const isEditable =
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        Boolean(target?.isContentEditable);

      const now = Date.now();
      const buf = bufferRef.current;
      const gap = buf.lastKeyTime ? now - buf.lastKeyTime : 0;

      const maxGapMs = isEditable ? 55 : 160;
      if (buf.chars.length > 0 && gap > maxGapMs) {
        resetBuffer();
      }

      if (e.key === "Enter" || e.key === "Tab") {
        const currentChars = bufferRef.current.chars.trim();
        if (currentChars.length >= minLength) {
          const totalDuration =
            now - (bufferRef.current.firstKeyTime || now);
          const avgMsPerChar =
            totalDuration / Math.max(1, currentChars.length);

          const isFastBurst = avgMsPerChar <= 42 && currentChars.length >= 6;
          if (!bufferRef.current.startedInEditable || isFastBurst) {
            e.preventDefault();
            e.stopPropagation();

            if (
              bufferRef.current.startedInEditable &&
              bufferRef.current.targetElement &&
              (bufferRef.current.targetElement instanceof HTMLInputElement ||
                bufferRef.current.targetElement instanceof HTMLTextAreaElement)
            ) {
              const el = bufferRef.current.targetElement;
              const orig = bufferRef.current.originalInputValue;
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                "value"
              )?.set;
              if (nativeInputValueSetter && el instanceof HTMLInputElement) {
                nativeInputValueSetter.call(el, orig);
                el.dispatchEvent(new Event("input", { bubbles: true }));
              }
            }

            resetBuffer();
            onScanRef.current(currentChars);
            return;
          }
        }
        resetBuffer();
        return;
      }

      if (e.key.length === 1) {
        if (bufferRef.current.chars.length === 0) {
          bufferRef.current.firstKeyTime = now;
          bufferRef.current.startedInEditable = isEditable;
          bufferRef.current.targetElement = target;
          if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement
          ) {
            bufferRef.current.originalInputValue = target.value;
          }
        }
        bufferRef.current.chars += e.key;
        bufferRef.current.lastKeyTime = now;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [enabled, minLength]);
}
