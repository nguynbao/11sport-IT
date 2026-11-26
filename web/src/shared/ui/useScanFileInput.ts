"use client";

import React from "react";
import {
  MAX_PDF_BYTES,
  loadImageFromFile,
  readFileAsDataUrl,
  readFileAsText,
  type PreviewKind,
  type ScanTargetMode,
} from "./cameraScannerHelpers";

interface UseScanFileInputOptions {
  mode: "OCR_TABLE" | "SCAN_TAG";
  stopCamera: () => void;
  setPreviewUrl: (v: string | null) => void;
  setPreviewKind: (v: PreviewKind) => void;
  setPreviewName: (v: string) => void;
  runOcrScanSingle: (dataUrl: string, mime: string, sourceName?: string, targetMode?: ScanTargetMode) => Promise<void>;
  setScanError: (v: string) => void;
  setScanningProgressText: (v: string) => void;
  handleParsePastedText: (text: string, sourceLabel?: string) => Promise<void>;
  setTagQuery: (v: string) => void;
  setScanTarget: (v: ScanTargetMode) => void;
  setDragOver: (v: boolean) => void;
}

/** Xử lý chọn/kéo thả file (ảnh, PDF, TXT/CSV), hỗ trợ nhiều file. */
export function useScanFileInput({
  mode,
  stopCamera,
  setPreviewUrl,
  setPreviewKind,
  setPreviewName,
  runOcrScanSingle,
  setScanError,
  setScanningProgressText,
  handleParsePastedText,
  setTagQuery,
  setScanTarget,
  setDragOver,
}: UseScanFileInputOptions) {
  const processSingleFile = async (file: File, targetMode: ScanTargetMode = "append") => {
    const name = file.name;
    const lower = name.toLowerCase();
    if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|bmp|gif)$/.test(lower)) {
      const dataUrl = await loadImageFromFile(file);
      stopCamera();
      setPreviewUrl(dataUrl);
      setPreviewKind("image");
      setPreviewName(name);
      await runOcrScanSingle(dataUrl, "image/jpeg", name, targetMode);
      return;
    }

    if (file.type === "application/pdf" || lower.endsWith(".pdf")) {
      if (file.size > MAX_PDF_BYTES) {
        setScanError(`File PDF "${name}" quá lớn (tối đa 6MB).`);
        return;
      }
      const dataUrl = await readFileAsDataUrl(file);
      stopCamera();
      setPreviewUrl(null);
      setPreviewKind("pdf");
      setPreviewName(name);
      await runOcrScanSingle(dataUrl, "application/pdf", name, targetMode);
      return;
    }

    if (/\.(txt|csv|tsv)$/.test(lower) || file.type.startsWith("text/")) {
      const text = await readFileAsText(file);
      const normalized = lower.endsWith(".csv") ? text.replace(/,/g, "|") : text;
      if (mode === "OCR_TABLE") {
        await handleParsePastedText(normalized, name);
      } else {
        const first = normalized.split(/\r?\n/).find((l) => l.trim()) || "";
        setTagQuery(first.trim());
      }
      setPreviewName(name);
      return;
    }

    setScanError(`Định dạng "${name}" chưa hỗ trợ. Chọn ảnh (JPG/PNG/WEBP), PDF, hoặc TXT/CSV.`);
  };

  const processMultipleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setScanError("");

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (files.length > 1) {
        setScanningProgressText(`Đang quét ảnh ${i + 1}/${files.length}: ${file.name}...`);
      } else {
        setScanningProgressText(`Đang quét ${file.name}...`);
      }
      try {
        await processSingleFile(file, "append");
      } catch (err: any) {
        setScanError(err?.message || `Không xử lý được file ${file.name}.`);
      }
    }
    setScanningProgressText("");
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = ""; // cho phép chọn lại cùng file
    if (files.length > 0) {
      setScanTarget("append");
      await processMultipleFiles(files);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    if (files.length > 0) {
      setScanTarget("append");
      await processMultipleFiles(files);
    }
  };

  return { handleFileInput, handleDrop };
}
