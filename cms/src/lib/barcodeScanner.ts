"use client";

import { useEffect, useRef } from "react";
import {
  generateVariantProductCode,
  isCompactBarcodeMatchVariant,
  toCompactBarcode128,
} from "./api";

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

/**
 * Khử hiện tượng lặp âm tiết do Unikey/EVKey gửi phím Backspace để xóa chữ cũ rồi gõ lại chữ có dấu
 * khi trình duyệt không xử lý kịp Backspace (VD: "TNN339837XANHDUONGÓNG" -> "TNN339837XANHDUÓNG").
 */
export function collapseUnikeyBackspaceStutter(rawInput: string): string {
  if (!rawInput || typeof rawInput !== "string") return "";
  const nfd = rawInput.normalize("NFD");
  const clusters: Array<{ raw: string; base: string; marks: string }> = [];

  for (let i = 0; i < nfd.length; i++) {
    const ch = nfd[i];
    if (/[\u0300-\u036f]/.test(ch) && clusters.length > 0) {
      clusters[clusters.length - 1].marks += ch;
    } else {
      const isD = ch === "đ" || ch === "Đ";
      const base = isD ? "D" : ch.toUpperCase();
      const marks = isD ? "D_BAR" : "";
      clusters.push({ raw: ch, base, marks });
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < clusters.length; i++) {
      if (!clusters[i].marks) continue;
      for (let len = 8; len >= 1; len--) {
        if (i - len < 0 || i + len > clusters.length) continue;
        let match = true;
        for (let offset = 0; offset < len; offset++) {
          const left = clusters[i - len + offset];
          const right = clusters[i + offset];
          if (left.base !== right.base || !/^[A-Z]$/.test(left.base)) {
            match = false;
            break;
          }
          if (offset === 0) {
            if (
              !right.marks ||
              !right.marks.startsWith(left.marks) ||
              right.marks.length <= left.marks.length
            ) {
              match = false;
              break;
            }
          } else if (left.marks !== right.marks) {
            match = false;
            break;
          }
        }
        if (match) {
          clusters.splice(i - len, len);
          changed = true;
          break outer;
        }
      }
    }
  }

  return clusters
    .map((c) => {
      if (c.marks.includes("D_BAR")) {
        const restMarks = c.marks.replace("D_BAR", "");
        return ("Đ" + restMarks).normalize("NFC");
      }
      return (c.base + c.marks).normalize("NFC");
    })
    .join("");
}

function buildTelexCandidatesFromNormalized(inputStr: string): string[] {
  const results = new Set<string>();
  const hasToneMarks = /[\u0300\u0301\u0303\u0309\u0323]/.test(inputStr.normalize("NFD"));

  const wRestoredInput = inputStr.replace(/[Ưư](?![\u0300-\u036f]*[Ơơ])/g, "W");

  for (const variantStr of [inputStr, wRestoredInput]) {
    const nfd = variantStr.normalize("NFD");
    let inlineTelex = "";
    let deferredTelex = "";
    let pendingModifiers = "";
    let lastBaseVowel = "";

    for (let i = 0; i < nfd.length; i++) {
      const ch = nfd[i];
      if (ch === "đ" || ch === "Đ") {
        inlineTelex += "DD";
        deferredTelex += "DD";
        lastBaseVowel = "";
        continue;
      }
      if (ch === "\u0302") {
        inlineTelex += lastBaseVowel || "";
        deferredTelex += lastBaseVowel || "";
        continue;
      }
      if (NFD_TO_TELEX_KEY[ch]) {
        const tk = NFD_TO_TELEX_KEY[ch];
        inlineTelex += tk;
        pendingModifiers += tk;
        continue;
      }
      const upper = ch.toUpperCase();
      if (/^[0-9]$/.test(upper)) {
        if (pendingModifiers) {
          deferredTelex += pendingModifiers;
          pendingModifiers = "";
        }
        inlineTelex += upper;
        deferredTelex += upper;
      } else if (/^[A-Z]$/.test(upper)) {
        inlineTelex += upper;
        deferredTelex += upper;
        if (/^[AEIOUY]$/.test(upper)) {
          lastBaseVowel = upper;
        }
      }
    }
    if (pendingModifiers) {
      deferredTelex += pendingModifiers;
    }
    if (inlineTelex) results.add(inlineTelex);
    if (deferredTelex) results.add(deferredTelex);
  }

  if (!hasToneMarks) {
    const basic = cleanBarcodeCode(inputStr);
    if (basic) results.add(basic);
    const basicW = cleanBarcodeCode(wRestoredInput);
    if (basicW) results.add(basicW);
  }

  return Array.from(results);
}

export function getBarcodeCandidates(rawInput: string): string[] {
  if (!rawInput || typeof rawInput !== "string") return [];
  const trimmed = rawInput.trim();
  if (!trimmed) return [];

  const candidates = new Set<string>();
  const deStuttered = collapseUnikeyBackspaceStutter(trimmed);
  if (deStuttered && deStuttered !== trimmed) {
    for (const c of buildTelexCandidatesFromNormalized(deStuttered)) {
      candidates.add(c);
    }
  }
  for (const c of buildTelexCandidatesFromNormalized(trimmed)) {
    candidates.add(c);
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
    const compactT = toCompactBarcode128(t, 200);
    if (compactT && candidates.includes(compactT)) return true;
    if (candidates.some((cand) => isCompactBarcodeMatchVariant(cand, t))) return true;
  }

  const deStuttered = collapseUnikeyBackspaceStutter(rawScanned.trim());
  const baseCandidates = [
    cleanBarcodeCode(deStuttered),
    cleanBarcodeCode(deStuttered.replace(/[Ưư]/g, "W")),
    cleanBarcodeCode(rawScanned),
  ].filter(Boolean);

  for (const t of targets) {
    const targetDigits = t.replace(/[^0-9]/g, "");
    const sortedTargetChars = t.split("").sort().join("");

    for (const cand of candidates) {
      if (cand.length !== t.length) continue;
      if (cand.replace(/[^0-9]/g, "") !== targetDigits) continue;
      if (cand.split("").sort().join("") !== sortedTargetChars) continue;
      if (baseCandidates.some((b) => isOrderedSubsequence(b, t))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Tách phần hậu tố [MÀU][SIZE] (VD: "DO38" -> { color: "DO", size: "38" }, "2XL" -> { color: "", size: "2XL" })
 */
function parseVariantSuffix(rawSuffix: string): { color: string; size: string } {
  const clean = cleanBarcodeCode(rawSuffix);
  if (!clean) return { color: "", size: "" };

  const sizeMatch = clean.match(
    /^(.*?)(FREESIZE|XXS|XS|2XL|3XL|4XL|XXL|XXXL|XL|[234][0-9]|S|M|L)$/
  );
  if (sizeMatch) {
    return {
      color: sizeMatch[1] || "",
      size: sizeMatch[2] || "",
    };
  }
  return { color: clean, size: "" };
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
 * - Ưu tiên 3: Khớp Mã có dấu phân cách (VD: GASIA221401-DO-38).
 * - Ưu tiên 4: Khớp tiền tố Mã gốc chuẩn ([A-Z]{2,}[0-9]{6}) + hậu tố thuộc tính [MÀU][SIZE]
 *              (kể cả khi biến thể vừa in chưa kịp đồng bộ giữa các máy).
 */
export function findProductAndVariantByScannedBarcode<
  T extends {
    code?: string;
    barcode?: string;
    stockFloor1?: number;
    stockFloor2?: number;
    stock?: number;
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

  // 1. Ưu tiên khớp Mã con (variantCode) của từng thuộc tính (color, size) — hỗ trợ cả mã rút gọn & mã đầy đủ
  for (const p of products) {
    if (Array.isArray(p.variants) && p.variants.length > 0) {
      for (const v of p.variants) {
        const compactCode = generateVariantProductCode(p.code, v.color, v.size);
        const fullCode = cleanBarcodeCode(`${p.code || ""}${v.color || ""}${v.size || ""}`);
        const vCode = v.variantCode || compactCode;
        if (
          (vCode && isScannedCodeMatch(rawScanned, vCode, v.barcode || vCode)) ||
          (compactCode && isScannedCodeMatch(rawScanned, compactCode)) ||
          (fullCode && isScannedCodeMatch(rawScanned, fullCode))
        ) {
          return {
            product: p,
            matchedVariant: {
              ...v,
              variantCode: compactCode || vCode,
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
    const suffixNorm = cleanBarcodeCode(parts.slice(1).join(""));
    const byBase = products.find((p) =>
      isScannedCodeMatch(basePart, p.code, p.barcode)
    );
    if (byBase) {
      if (suffixNorm && Array.isArray(byBase.variants)) {
        const foundVar = byBase.variants.find((v) => {
          const vc = cleanBarcodeCode(`${v.color || ""}${v.size || ""}`);
          const vs = cleanBarcodeCode(v.size || "");
          const vcol = cleanBarcodeCode(v.color || "");
          return suffixNorm === vc || suffixNorm === vs || suffixNorm === vcol;
        });
        if (foundVar) {
          const vCode =
            foundVar.variantCode ||
            generateVariantProductCode(byBase.code, foundVar.color, foundVar.size);
          return {
            product: byBase,
            matchedVariant: { ...foundVar, variantCode: vCode },
            isVariantExactMatch: true,
          };
        }
      }
      return {
        product: byBase,
        isVariantExactMatch: false,
      };
    }
  }

  // 4. Khớp tiền tố Mã gốc chuẩn ([A-Z]{2,}[0-9]{6}) + hậu tố thuộc tính [MÀU][SIZE] (VD: BSOXTER625170S)
  const candidates = getBarcodeCandidates(rawScanned);
  for (const cand of candidates) {
    const rootPrefixMatch = cand.match(/^([A-Z]{2,}[0-9]{6})([A-Z0-9]+)$/);
    if (!rootPrefixMatch) continue;
    const [, rootCandidate, suffixCandidate] = rootPrefixMatch;
    const matchedProd = products.find(
      (p) => cleanBarcodeCode(p.code || "") === rootCandidate
    );
    if (matchedProd) {
      if (Array.isArray(matchedProd.variants) && matchedProd.variants.length > 0) {
        const matchedVar = matchedProd.variants.find((v) => {
          const vSuffix = cleanBarcodeCode(`${v.color || ""}${v.size || ""}`);
          const vSize = cleanBarcodeCode(v.size || "");
          const vColor = cleanBarcodeCode(v.color || "");
          return (
            suffixCandidate === vSuffix ||
            suffixCandidate === vSize ||
            suffixCandidate === vColor
          );
        });
        if (matchedVar) {
          const vCode =
            matchedVar.variantCode ||
            generateVariantProductCode(
              matchedProd.code,
              matchedVar.color,
              matchedVar.size
            );
          return {
            product: matchedProd,
            matchedVariant: { ...matchedVar, variantCode: vCode },
            isVariantExactMatch: true,
          };
        }
      }

      const parsed = parseVariantSuffix(suffixCandidate);
      const f1 = Number(matchedProd.stockFloor1 ?? matchedProd.stock ?? 0);
      const f2 = Number(matchedProd.stockFloor2 ?? 0);
      return {
        product: matchedProd,
        matchedVariant: {
          color: parsed.color,
          size: parsed.size,
          variantCode: `${rootCandidate}${suffixCandidate}`,
          stockFloor1: f1,
          stockFloor2: f2,
          stock: f1 + f2,
        },
        isVariantExactMatch: Boolean(parsed.color || parsed.size),
      };
    }
  }

  return undefined;
}

export function findProductByScannedBarcode<
  T extends {
    code?: string;
    barcode?: string;
    stockFloor1?: number;
    stockFloor2?: number;
    stock?: number;
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
    keyCount: number;
    startedInEditable: boolean;
    targetElement: HTMLElement | null;
    originalInputValue: string;
    lastAutoScanTime: number;
  }>({
    chars: "",
    firstKeyTime: 0,
    lastKeyTime: 0,
    keyCount: 0,
    startedInEditable: false,
    targetElement: null,
    originalInputValue: "",
    lastAutoScanTime: 0,
  });

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let idleBurstTimer: ReturnType<typeof setTimeout> | null = null;

    const clearIdleTimer = () => {
      if (idleBurstTimer) {
        clearTimeout(idleBurstTimer);
        idleBurstTimer = null;
      }
    };

    const resetBuffer = () => {
      clearIdleTimer();
      bufferRef.current = {
        chars: "",
        firstKeyTime: 0,
        lastKeyTime: 0,
        keyCount: 0,
        startedInEditable: false,
        targetElement: null,
        originalInputValue: "",
        lastAutoScanTime: bufferRef.current.lastAutoScanTime,
      };
    };

    const restoreInputOriginalValue = (
      el: HTMLElement | null,
      origValue: string
    ) => {
      if (!el) return;
      if (el instanceof HTMLInputElement) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        if (setter) {
          setter.call(el, origValue);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      } else if (el instanceof HTMLTextAreaElement) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value"
        )?.set;
        if (setter) {
          setter.call(el, origValue);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
    };

    const resolveEffectiveScannedString = (): string => {
      const buf = bufferRef.current;
      let candidate = buf.chars.trim();
      if (
        buf.startedInEditable &&
        buf.targetElement &&
        (buf.targetElement instanceof HTMLInputElement ||
          buf.targetElement instanceof HTMLTextAreaElement)
      ) {
        const curVal = buf.targetElement.value || "";
        const origVal = buf.originalInputValue || "";
        if (curVal.startsWith(origVal) && curVal.length > origVal.length) {
          const delta = curVal.slice(origVal.length).trim();
          if (delta.length >= minLength) {
            candidate = delta;
          }
        }
      }
      return candidate;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e || typeof e.key !== "string") return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toUpperCase() || "";
      const isDedicatedBarcodeInput =
        target?.getAttribute?.("data-barcode-input") === "true";

      const now = Date.now();

      // Hỗ trợ cả phím Tab, NumpadEnter hoặc máy quét không gửi Enter khi con trỏ đang nằm trong ô data-barcode-input
      if (isDedicatedBarcodeInput) {
        if (
          (e.key === "Tab" || e.code === "NumpadEnter") &&
          target instanceof HTMLInputElement &&
          target.value.trim().length >= minLength
        ) {
          e.preventDefault();
          e.stopPropagation();
          const scannedVal = target.value.trim();
          restoreInputOriginalValue(target, "");
          resetBuffer();
          onScanRef.current(scannedVal);
          return;
        }
        if (e.key === "Enter") {
          resetBuffer();
          return;
        }
        if (e.key?.length === 1 && target instanceof HTMLInputElement) {
          const dGap = bufferRef.current.lastKeyTime
            ? now - bufferRef.current.lastKeyTime
            : 0;
          if (dGap > 120) {
            bufferRef.current.firstKeyTime = now;
            bufferRef.current.keyCount = 0;
          } else if (!bufferRef.current.firstKeyTime) {
            bufferRef.current.firstKeyTime = now;
          }
          bufferRef.current.lastKeyTime = now;
          bufferRef.current.keyCount += 1;
          clearIdleTimer();
          const burstDur = now - bufferRef.current.firstKeyTime;
          const burstAvg =
            burstDur / Math.max(1, bufferRef.current.keyCount);
          if (bufferRef.current.keyCount >= 8 && burstAvg <= 40) {
            idleBurstTimer = setTimeout(() => {
              const val = target.value.trim();
              if (val.length >= 8) {
                restoreInputOriginalValue(target, "");
                bufferRef.current.lastAutoScanTime = Date.now();
                resetBuffer();
                onScanRef.current(val);
              }
            }, 220);
          }
        }
        return;
      }

      const isEditable =
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        Boolean(target?.isContentEditable);

      const buf = bufferRef.current;
      const gap = buf.lastKeyTime ? now - buf.lastKeyTime : 0;

      // 1. Kiểm tra phím kết thúc (Enter / Tab / NumpadEnter) TRƯỚC khi kiểm tra gap
      if (e.key === "Enter" || e.key === "Tab" || e.code === "NumpadEnter") {
        clearIdleTimer();

        if (now - buf.lastAutoScanTime < 350) {
          e.preventDefault();
          e.stopPropagation();
          resetBuffer();
          return;
        }

        const currentChars = resolveEffectiveScannedString();
        if (currentChars.length >= minLength && gap <= 800) {
          const totalDuration =
            (buf.lastKeyTime || now) - (buf.firstKeyTime || now);
          const avgMsPerChar =
            totalDuration / Math.max(1, buf.keyCount || currentChars.length);

          const isFastBurst = avgMsPerChar <= 65 && currentChars.length >= 6;
          if (!buf.startedInEditable || isFastBurst) {
            e.preventDefault();
            e.stopPropagation();

            if (buf.startedInEditable && buf.targetElement) {
              restoreInputOriginalValue(
                buf.targetElement,
                buf.originalInputValue
              );
            }

            buf.lastAutoScanTime = now;
            resetBuffer();
            onScanRef.current(currentChars);
            return;
          }
        }
        resetBuffer();
        return;
      }

      // 2. Xử lý phím Backspace do Unikey/EVKey gửi để xóa ký tự gốc trước khi chèn ký tự có dấu
      if (e.key === "Backspace") {
        if (buf.chars.length > 0 && gap <= 450) {
          buf.chars = buf.chars.slice(0, -1);
          buf.lastKeyTime = now;
        }
        return;
      }

      // 3. Nếu khoảng nghỉ giữa 2 phím quá dài -> xóa buffer cũ để bắt đầu chuỗi mới
      const maxGapMs = isEditable ? 120 : 260;
      if (buf.chars.length > 0 && gap > maxGapMs) {
        resetBuffer();
      }

      if (e.key?.length === 1) {
        if (bufferRef.current.chars.length === 0) {
          bufferRef.current.firstKeyTime = now;
          bufferRef.current.startedInEditable = isEditable;
          bufferRef.current.targetElement = target;
          bufferRef.current.keyCount = 0;
          if (
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement
          ) {
            bufferRef.current.originalInputValue = target.value;
          }
        }
        bufferRef.current.chars += e.key;
        bufferRef.current.lastKeyTime = now;
        bufferRef.current.keyCount += 1;

        // 4. Hỗ trợ máy quét KHÔNG cấu hình hậu tố Enter/Tab:
        // Nếu nhận được chuỗi bắn nhanh (>= 8 ký tự, trung bình <= 45ms/phím), tự động kích hoạt sau 180ms nghỉ
        clearIdleTimer();
        const curLen = bufferRef.current.chars.trim().length;
        const curDur = now - (bufferRef.current.firstKeyTime || now);
        const curAvg = curDur / Math.max(1, bufferRef.current.keyCount);

        if (curLen >= 8 && curAvg <= 45) {
          idleBurstTimer = setTimeout(() => {
            const finalChars = resolveEffectiveScannedString();
            if (finalChars.length >= 8) {
              if (
                bufferRef.current.startedInEditable &&
                bufferRef.current.targetElement
              ) {
                restoreInputOriginalValue(
                  bufferRef.current.targetElement,
                  bufferRef.current.originalInputValue
                );
              }
              bufferRef.current.lastAutoScanTime = Date.now();
              resetBuffer();
              onScanRef.current(finalChars);
            }
          }, 180);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      clearIdleTimer();
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [enabled, minLength]);
}
