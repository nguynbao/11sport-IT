"use client";

import { useEffect, useRef } from "react";

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
 * Ví dụ: Máy quét bắn "GASIA221401" -> Unikey biến thành "GÁIA221401" -> Khôi phục lại chính xác "GASIA221401".
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
 * Phân tích một chuỗi bất kỳ (có thể đã bị bộ gõ Tiếng Việt Telex biến đổi)
 * thành danh sách các mã sản phẩm ứng viên chuẩn IN HOA VIẾT LIỀN.
 */
export function getBarcodeCandidates(rawInput: string): string[] {
  if (!rawInput || typeof rawInput !== "string") return [];
  const trimmed = rawInput.trim();
  if (!trimmed) return [];

  const candidates = new Set<string>();

  // 1. Chuẩn hóa bỏ dấu thông thường
  const basicClean = cleanBarcodeCode(trimmed);
  if (basicClean) candidates.add(basicClean);

  // 2. Khôi phục chuỗi gõ Telex trực tiếp tại vị trí nguyên âm (VD: GÁIA221401 -> GASIA221401)
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
      // Dấu mũ (Â, Ê, Ô) -> Lặp lại nguyên âm gốc (AA, EE, OO)
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
      // Nếu chuyển sang chữ số mà còn dấu thanh treo ở âm tiết chữ cái trước đó
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

  // 3. Trường hợp phím dấu Telex được gõ sau phụ âm cuối (VD: VANS123456 -> VÁN123456)
  // Tách phần chữ cái đầu và phần số cuối, thử đặt phím dấu ở sau cụm nguyên âm + phụ âm
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

/**
 * Kiểm tra chuỗi `sub` có phải là dãy con có thứ tự (ordered subsequence) của `target` hay không.
 */
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

/**
 * Đối chiếu thông minh mã quét từ máy quét Label với mã sản phẩm (`code` hoặc `barcode`),
 * hỗ trợ khử hoàn toàn lỗi bộ gõ Tiếng Việt (Unikey Telex) và CapsLock.
 */
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

  // Kiểm tra tương đương tổ hợp phím Telex (khi Unikey đảo vị trí dấu thanh vào nguyên âm đứng trước)
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

/**
 * Tìm sản phẩm trong danh sách theo chuỗi mã vạch vừa quét.
 * Hỗ trợ cả trường hợp mã vạch chỉ chứa Mã SP chung (VD: GASIA221401)
 * hoặc mã vạch có hậu tố Màu/Size (VD: GASIA221401-41).
 */
export function findProductByScannedBarcode<
  T extends { code?: string; barcode?: string }
>(products: T[], rawScanned: string): T | undefined {
  if (!rawScanned || !Array.isArray(products) || products.length === 0) {
    return undefined;
  }

  // 1. Tìm khớp chính xác (hoặc tương đương Telex)
  const exact = products.find((p) =>
    isScannedCodeMatch(rawScanned, p.code, p.barcode)
  );
  if (exact) return exact;

  // 2. Nếu mã quét có kèm phân cách biến thể (VD: GASIA221401_41 hoặc GASIA221401-DO-L)
  const parts = rawScanned.trim().split(/[-_/:|\s]+/);
  if (parts.length > 1 && parts[0].length >= 4) {
    const basePart = parts[0];
    const byBase = products.find((p) =>
      isScannedCodeMatch(basePart, p.code, p.barcode)
    );
    if (byBase) return byBase;
  }

  return undefined;
}

/**
 * Phát âm thanh phản hồi tức thì khi quét mã vạch (Web Audio API — không cần file âm thanh ngoài).
 * - "success": Tiếng Bíp cao trong trẻo (nhận mã thành công)
 * - "warning": 2 tiếng Bíp trung (cần chọn Size/Màu hoặc cảnh báo vượt số lượng dự kiến)
 * - "error": Tiếng Bíp trầm dài (không tìm thấy mã hoặc hết hàng)
 */
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
  /** Bật/tắt chế độ lắng nghe máy quét mã vạch toàn cục */
  enabled?: boolean;
  /** Callback nhận chuỗi mã vạch khi máy quét bắn xong (kết thúc bằng Enter/Tab) */
  onScan: (scannedCode: string) => void;
  /** Độ dài tối thiểu của mã vạch (mặc định: 4 ký tự) */
  minLength?: number;
}

/**
 * Hook lắng nghe sự kiện từ Máy Quét Mã Vạch (USB / Bluetooth / 2.4G HID Keyboard).
 * - Tự động bắt mã vạch ngay cả khi người dùng KHÔNG đặt con trỏ chuột vào ô tìm kiếm.
 * - Nếu con trỏ đang đặt trong một ô input thường (như Ghi chú, Tên khách, Giá tiền),
 *   chỉ tự động bắt nếu phát hiện tốc độ bắn phím cực nhanh đặc trưng của máy quét (< 40ms/ký tự)
 *   và chuỗi khớp định dạng Mã sản phẩm, tránh ảnh hưởng tới việc gõ phím bình thường.
 */
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

      // Nếu đang gõ trực tiếp trong ô input chuyên dụng của máy quét -> để sự kiện onKeyDown của ô đó xử lý
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

      // Nếu khoảng nghỉ giữa 2 phím quá dài -> reset bộ đệm
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

          // Nếu không ở trong ô input, hoặc nếu ở trong ô input nhưng tốc độ bắn phím cực nhanh (< 42ms/ký tự)
          const isFastBurst = avgMsPerChar <= 42 && currentChars.length >= 6;
          if (!bufferRef.current.startedInEditable || isFastBurst) {
            e.preventDefault();
            e.stopPropagation();

            // Nếu máy quét lỡ bắn ký tự vào một ô input khác (như ô Ghi chú), khôi phục giá trị cũ của ô đó
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

      // Ghi nhận ký tự in được (bao gồm cả ký tự Tiếng Việt có dấu do Unikey sinh ra)
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
