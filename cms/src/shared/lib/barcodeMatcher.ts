"use client";

import { useEffect, useRef } from "react";
import {
  generateVariantProductCode,
  isCompactBarcodeMatchVariant,
  toCompactBarcode128,
} from "@/shared/utils/productCode";

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
export function parseVariantSuffix(rawSuffix: string): { color: string; size: string } {
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

/** Sản phẩm có thể quét: hỗ trợ mã mới (server sinh) + mã cũ (legacyCode/legacyVariantCode) — v5.0 */
