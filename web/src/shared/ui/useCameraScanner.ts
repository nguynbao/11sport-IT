"use client";

import { useState, useRef, useCallback } from "react";
import type { ImportItem, Product } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import {
  compressImageToDataUrl,
  createEmptyOcrItem,
  mapApiItems,
  mergeOcrItemsList,
  type PreviewKind,
  type ScanTargetMode,
  type ScannedPage,
} from "./cameraScannerHelpers";
import { useCameraStream } from "./useCameraStream";
import { useOcrItemsEditor } from "./useOcrItemsEditor";
import { useScanFileInput } from "./useScanFileInput";

export interface CameraScannerModalProps {
  mode: "OCR_TABLE" | "SCAN_TAG";
  title?: string;
  expectedCodeHint?: string;
  /** Số dòng hàng hợp lệ hiện có ngoài Bảng 6 Cột của phiếu nhập */
  existingItemCount?: number;
  /** Danh sách sản phẩm có trong kho để gợi ý khi gõ tên hàng */
  catalogProducts?: Product[];
  /** modeAction = 'append' (cộng thêm vào phiếu) | 'replace' (thay thế bảng) */
  onConfirmOcrItems?: (items: ImportItem[], modeAction?: "append" | "replace") => void;
  onConfirmTagScan?: (query: string, actualQuantity?: number) => void;
  onClose: () => void;
}

export function useCameraScanner({
  mode,
  expectedCodeHint,
  catalogProducts = [],
  onClose,
}: CameraScannerModalProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);


  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<PreviewKind>(null);
  const [previewName, setPreviewName] = useState("");
  const [lastPayload, setLastPayload] = useState<{ dataUrl: string; mime: string } | null>(null);

  const {
    videoRef,
    cameraActive,
    startingCamera,
    cameraError,
    startCamera,
    stopCamera,
    handleSwitchCamera,
  } = useCameraStream(() => {
    setPreviewUrl(null);
    setPreviewKind(null);
  });

  const {
    ocrItems,
    setOcrItems,
    activeOcrSuggestIdx,
    setActiveOcrSuggestIdx,
    ocrSuggestHighlightIdx,
    setOcrSuggestHighlightIdx,
    getOcrRowSuggestions,
    handleSelectOcrSuggestion,
    handleUpdateOcrRow,
    handleAddOcrRow,
    handleRemoveOcrRow,
  } = useOcrItemsEditor(catalogProducts);

  // Danh sách các ảnh/trang đã quét trong phiên này & chế độ chụp tiếp theo
  const [scannedPages, setScannedPages] = useState<ScannedPage[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [scanTarget, setScanTarget] = useState<ScanTargetMode>("append");
  const [mergeDuplicates, setMergeDuplicates] = useState(true);

  const [scanning, setScanning] = useState(false);
  const [scanningProgressText, setScanningProgressText] = useState("");
  const [scanError, setScanError] = useState("");
  const [scanInfo, setScanInfo] = useState("");
  const [rawText, setRawText] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [pasteText, setPasteText] = useState("");
  const [tagQuery, setTagQuery] = useState(expectedCodeHint || "");
  const [tagActualQty, setTagActualQty] = useState<number>(1);

  /* ------------------------------- OCR calling ------------------------------ */

  /** Áp dụng danh sách dòng vừa quét từ 1 ảnh/file vào bảng kết quả (cộng thêm hoặc thay ảnh cuối) */
  const applyExtractedItems = useCallback(
    (
      newItems: ImportItem[],
      pageMeta: {
        name: string;
        kind: "image" | "pdf" | "text";
        dataUrl: string;
        mime: string;
        rawText: string;
        engineLabel: string;
      },
      targetMode: ScanTargetMode
    ) => {
      const pageId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newPage: ScannedPage = {
        id: pageId,
        name: pageMeta.name,
        kind: pageMeta.kind,
        dataUrl: pageMeta.dataUrl,
        mime: pageMeta.mime,
        items: newItems,
        rawText: pageMeta.rawText,
      };

      setActivePageId(pageId);
      setRawText((prev) =>
        targetMode === "append" && prev
          ? `${prev}\n--- [${pageMeta.name}] ---\n${pageMeta.rawText}`
          : pageMeta.rawText
      );

      if (targetMode === "replaceLast" && scannedPages.length > 0) {
        // Thay thế trang cuối cùng vừa chụp
        const withoutLast = scannedPages.slice(0, -1);
        const updatedPages = [...withoutLast, newPage];
        setScannedPages(updatedPages);

        let rebuilt: ImportItem[] = [];
        for (const p of updatedPages) {
          rebuilt = mergeOcrItemsList(rebuilt, p.items, mergeDuplicates).merged;
        }
        setOcrItems(rebuilt);
        setScanInfo(
          `Đã quét lại "${pageMeta.name}": ${newItems.length} dòng (${pageMeta.engineLabel}). Tổng cộng ${
            rebuilt.filter((i) => i.productName.trim()).length
          } dòng từ ${updatedPages.length} ảnh.`
        );
        return;
      }

      // Mặc định: Cộng thêm (append) vào danh sách hiện có
      setScannedPages((prev) => [...prev, newPage]);
      setOcrItems((prev) => {
        const hadExisting = prev.some((i) => i.productName.trim() !== "");
        const { merged, addedRows, mergedRows } = mergeOcrItemsList(
          prev,
          newItems,
          mergeDuplicates
        );
        const totalValid = merged.filter((i) => i.productName.trim() !== "").length;
        if (!hadExisting) {
          setScanInfo(
            `Ảnh #1 (${pageMeta.name}): đã quét được ${newItems.length} dòng hàng (${pageMeta.engineLabel}). Bấm "📷 Chụp thêm ảnh" hoặc "🖼️ Tải thêm ảnh" để cộng thêm vào danh sách.`
          );
        } else {
          const mergeNote =
            mergedRows > 0 ? ` (+cộng dồn SL cho ${mergedRows} dòng trùng mã)` : "";
          setScanInfo(
            `Đã cộng thêm từ "${pageMeta.name}": +${addedRows} dòng mới${mergeNote}. Tổng hiện có: ${totalValid} dòng hàng.`
          );
        }
        return merged;
      });
    },
    [mergeDuplicates, scannedPages]
  );

  const runOcrScanSingle = async (
    dataUrl: string,
    mime: string,
    sourceName = "Ảnh chụp",
    targetMode: ScanTargetMode = scanTarget
  ) => {
    setScanning(true);
    setScanError("");
    setLastPayload({ dataUrl, mime });
    try {
      const res = await apiRequest<any>("/imports/ocr-scan", {
        method: "POST",
        body: JSON.stringify({
          mode: mode === "OCR_TABLE" ? "TABLE" : "TAG",
          fileBase64: dataUrl.replace(/^data:[^;]+;base64,/, ""),
          mimeType: mime,
        }),
      });
      const d = res.data || {};
      const engineLabel = d.engine === "gemini" ? "AI Gemini" : "Tesseract";

      if (mode === "OCR_TABLE") {
        const list = Array.isArray(d.items) ? d.items : [];
        if (list.length === 0) {
          setScanError(
            `Không nhận diện được dòng hàng nào trên "${sourceName}". Hãy chụp lại rõ nét, đủ sáng, hoặc bấm "📷 Chụp thêm ảnh".`
          );
          return;
        }
        const mapped = mapApiItems(list);
        applyExtractedItems(
          mapped,
          {
            name: sourceName,
            kind: mime === "application/pdf" ? "pdf" : "image",
            dataUrl,
            mime,
            rawText: String(d.rawText || ""),
            engineLabel,
          },
          targetMode
        );
        setScanTarget("append");
      } else {
        setRawText(String(d.rawText || ""));
        const query = d.productCode || d.productName || "";
        if (!query) {
          setScanError("Không đọc được mã/tên hàng trên tag. Vui lòng chụp lại gần hơn.");
          return;
        }
        setTagQuery(d.productName || d.productCode);
        if (d.quantity) setTagActualQty(Number(d.quantity));
        setScanInfo(`Đã đọc tag (${engineLabel}): ${d.productName || d.productCode}`);
      }
    } catch (err: any) {
      setScanError(err?.message || "Quét OCR thất bại. Vui lòng thử lại.");
    } finally {
      setScanning(false);
      setScanningProgressText("");
    }
  };

  /* ------------------------------- Capture ------------------------------- */

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setScanError("Camera chưa sẵn sàng, vui lòng đợi 1 giây rồi chụp lại.");
      return;
    }
    try {
      const dataUrl = compressImageToDataUrl(video, video.videoWidth, video.videoHeight);
      const nextNum =
        scanTarget === "replaceLast" && scannedPages.length > 0
          ? scannedPages.length
          : scannedPages.length + 1;
      const shotName = `Ảnh chụp #${nextNum}`;
      setPreviewUrl(dataUrl);
      setPreviewKind("image");
      setPreviewName(shotName);
      stopCamera();
      setScanningProgressText(`Đang quét ${shotName}...`);
      await runOcrScanSingle(dataUrl, "image/jpeg", shotName, scanTarget);
    } catch (err: any) {
      setScanError(err?.message || "Không chụp được ảnh.");
    }
  };

  /** Mở camera để CHỤP THÊM ảnh mới và cộng dồn vào danh sách đã quét */
  const handleStartCaptureMore = () => {
    setScanTarget("append");
    setPreviewUrl(null);
    setPreviewKind(null);
    setScanError("");
    startCamera();
  };

  /** Mở camera để chụp lại ảnh vừa chụp bị mờ */
  const handleRetakeLast = () => {
    setScanTarget(scannedPages.length > 0 ? "replaceLast" : "append");
    setPreviewUrl(null);
    setPreviewKind(null);
    setScanError("");
    startCamera();
  };

  /** Xem lại 1 ảnh trong dải các ảnh đã quét */
  const handleSelectScannedPage = (page: ScannedPage) => {
    stopCamera();
    setActivePageId(page.id);
    setPreviewName(page.name);
    if (page.kind === "image") {
      setPreviewUrl(page.dataUrl);
      setPreviewKind("image");
      setLastPayload({ dataUrl: page.dataUrl, mime: page.mime });
    } else if (page.kind === "pdf") {
      setPreviewUrl(null);
      setPreviewKind("pdf");
      setLastPayload({ dataUrl: page.dataUrl, mime: page.mime });
    }
  };


  const handleParsePastedText = async (text: string, sourceLabel = "Văn bản dán") => {
    if (!text.trim()) return;
    setScanning(true);
    setScanError("");
    try {
      const res = await apiRequest<any>("/imports/ocr-preview", {
        method: "POST",
        body: JSON.stringify({ imageText: text }),
      });
      const list = Array.isArray(res.data) ? res.data : res.data?.items || [];
      if (list.length > 0) {
        const mapped = mapApiItems(list);
        applyExtractedItems(
          mapped,
          {
            name: sourceLabel,
            kind: "text",
            dataUrl: "",
            mime: "text/plain",
            rawText: text,
            engineLabel: "Tách dòng",
          },
          "append"
        );
      } else {
        setScanError("Không tách được dòng hàng nào từ văn bản.");
      }
    } catch (err: any) {
      setScanError(err?.message || "Không tách được văn bản.");
    } finally {
      setScanning(false);
    }
  };

  const { handleFileInput, handleDrop } = useScanFileInput({
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
  });

  const handleClearAllScanned = () => {
    setScannedPages([]);
    setActivePageId(null);
    setOcrItems([createEmptyOcrItem(1)]);
    setRawText("");
    setScanInfo("Đã xóa danh sách quét tạm để quét mới từ đầu.");
    setScanError("");
  };

  const validOcrCount = ocrItems.filter((i) => i.productName.trim()).length;

  const closeModal = () => {
    stopCamera();
    onClose();
  };

  return {
    mode,
    videoRef,
    cameraActive,
    startingCamera,
    cameraError,
    startCamera,
    stopCamera,
    handleSwitchCamera,
    imageInputRef,
    nativeCameraInputRef,
    pdfInputRef,
    textInputRef,
    previewUrl,
    previewKind,
    previewName,
    lastPayload,
    scannedPages,
    activePageId,
    scanTarget,
    setScanTarget,
    mergeDuplicates,
    setMergeDuplicates,
    scanning,
    scanningProgressText,
    scanError,
    scanInfo,
    rawText,
    showRaw,
    setShowRaw,
    dragOver,
    setDragOver,
    pasteText,
    setPasteText,
    ocrItems,
    activeOcrSuggestIdx,
    setActiveOcrSuggestIdx,
    ocrSuggestHighlightIdx,
    setOcrSuggestHighlightIdx,
    getOcrRowSuggestions,
    handleSelectOcrSuggestion,
    tagQuery,
    setTagQuery,
    tagActualQty,
    setTagActualQty,
    runOcrScanSingle,
    handleCapture,
    handleStartCaptureMore,
    handleRetakeLast,
    handleSelectScannedPage,
    handleFileInput,
    handleDrop,
    handleParsePastedText,
    handleUpdateOcrRow,
    handleAddOcrRow,
    handleRemoveOcrRow,
    handleClearAllScanned,
    validOcrCount,
    closeModal,
  };
}

export type CameraScannerState = ReturnType<typeof useCameraScanner>;
