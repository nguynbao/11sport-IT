"use client";

import { useEffect, useRef } from "react";

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
