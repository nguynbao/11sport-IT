"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  X,
  Check,
  Plus,
  Trash2,
  VideoOff,
  RefreshCw,
  SwitchCamera,
  ImageIcon,
  FileText,
  FileSpreadsheet,
  Loader2,
  ScanLine,
  RotateCcw,
  AlertTriangle,
  Sparkles,
  Images,
} from "lucide-react";
import { apiRequest, generateProductCode, ImportItem } from "@/lib/api";

interface CameraScannerModalProps {
  mode: "OCR_TABLE" | "SCAN_TAG";
  title?: string;
  expectedCodeHint?: string;
  /** Số dòng hàng hợp lệ hiện có ngoài Bảng 6 Cột của phiếu nhập */
  existingItemCount?: number;
  /** modeAction = 'append' (cộng thêm vào phiếu) | 'replace' (thay thế bảng) */
  onConfirmOcrItems?: (items: ImportItem[], modeAction?: "append" | "replace") => void;
  onConfirmTagScan?: (query: string, actualQuantity?: number) => void;
  onClose: () => void;
}

type PreviewKind = "image" | "pdf" | null;
type ScanTargetMode = "append" | "replaceLast";

interface ScannedPage {
  id: string;
  name: string;
  kind: "image" | "pdf" | "text";
  dataUrl: string;
  mime: string;
  items: ImportItem[];
  rawText: string;
}

const MAX_IMAGE_DIM = 1600;
const MAX_PDF_BYTES = 6 * 1024 * 1024;

const createEmptyOcrItem = (stt: number): ImportItem => ({
  stt,
  productName: "",
  productCode: "",
  unit: "Cái",
  expectedQuantity: 1,
  actualQuantity: 1,
  costPrice: 0,
  note: "",
  isChecked: false,
  isConfirmed: false,
});

/** Thu nhỏ & nén ảnh về JPEG để gửi API nhanh, tránh vượt giới hạn dung lượng. */
function compressImageToDataUrl(source: CanvasImageSource, w: number, h: number): string {
  const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function loadImageFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        resolve(compressImageToDataUrl(img, img.naturalWidth, img.naturalHeight));
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không đọc được ảnh (định dạng HEIC có thể chưa được trình duyệt hỗ trợ)."));
    };
    img.src = url;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Không đọc được file."));
    r.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Không đọc được file."));
    r.readAsText(file, "utf-8");
  });
}

function mapApiItems(list: any[]): ImportItem[] {
  return list.map((it: any, idx: number) => {
    const pName = it.productName || it.name || "";
    const qty = Number(it.expectedQuantity ?? it.quantity ?? 1) || 1;
    return {
      stt: idx + 1,
      productName: pName,
      productCode: it.productCode || generateProductCode(pName),
      unit: it.unit || "Cái",
      expectedQuantity: qty,
      actualQuantity: qty,
      costPrice: Number(it.costPrice || 0),
      note: it.note || "",
      isChecked: false,
      isConfirmed: false,
    };
  });
}

/**
 * Cộng thêm các dòng mới quét vào danh sách hiện có:
 * - Bỏ qua các dòng trống.
 * - Nếu mergeDuplicates = true và trùng productCode: cộng dồn expectedQuantity & actualQuantity.
 * - Nếu không trùng (hoặc tắt gộp): nối thêm dòng vào cuối bảng.
 */
export function mergeOcrItemsList(
  existing: ImportItem[],
  incoming: ImportItem[],
  mergeDuplicates: boolean
): { merged: ImportItem[]; addedRows: number; mergedRows: number } {
  const base = existing.filter((i) => i.productName.trim() !== "").map((i) => ({ ...i }));
  let addedRows = 0;
  let mergedRows = 0;

  for (const raw of incoming) {
    const pName = (raw.productName || "").trim();
    if (!pName) continue;
    const pCode = raw.productCode || generateProductCode(pName);
    const qty = Math.max(1, Number(raw.expectedQuantity) || 1);

    if (mergeDuplicates && pCode) {
      const foundIdx = base.findIndex(
        (b) => (b.productCode || generateProductCode(b.productName)) === pCode
      );
      if (foundIdx >= 0) {
        const target = base[foundIdx];
        const nextQty = (Number(target.expectedQuantity) || 0) + qty;
        base[foundIdx] = {
          ...target,
          expectedQuantity: nextQty,
          actualQuantity: nextQty,
          note:
            raw.note && raw.note !== target.note
              ? [target.note, raw.note].filter(Boolean).join("; ")
              : target.note,
        };
        mergedRows++;
        continue;
      }
    }

    base.push({
      ...raw,
      productName: pName,
      productCode: pCode,
      expectedQuantity: qty,
      actualQuantity: qty,
    });
    addedRows++;
  }

  const finalItems =
    base.length > 0
      ? base.map((it, idx) => ({ ...it, stt: idx + 1 }))
      : [createEmptyOcrItem(1)];

  return { merged: finalItems, addedRows, mergedRows };
}

export default function CameraScannerModal({
  mode,
  title,
  expectedCodeHint,
  existingItemCount = 0,
  onConfirmOcrItems,
  onConfirmTagScan,
  onClose,
}: CameraScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);

  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraActive, setCameraActive] = useState(false);
  const [startingCamera, setStartingCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<PreviewKind>(null);
  const [previewName, setPreviewName] = useState("");
  const [lastPayload, setLastPayload] = useState<{ dataUrl: string; mime: string } | null>(null);

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
  const [ocrItems, setOcrItems] = useState<ImportItem[]>([createEmptyOcrItem(1)]);

  const [tagQuery, setTagQuery] = useState(expectedCodeHint || "");
  const [tagActualQty, setTagActualQty] = useState<number>(1);

  /* ----------------------------- Camera control ----------------------------- */

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(
    async (facing: "environment" | "user" = facingMode) => {
      setCameraError("");
      setStartingCamera(true);
      try {
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            "Trình duyệt không hỗ trợ Camera (cần HTTPS). Hãy dùng nút 'Chụp bằng app Camera' hoặc tải nhiều ảnh lên."
          );
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facing },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }

        streamRef.current = stream;
        setPreviewUrl(null);
        setPreviewKind(null);
        setCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err: any) {
        setCameraActive(false);
        if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
          setCameraError(
            "Bạn đã chặn quyền Camera. Bấm biểu tượng ổ khóa trên thanh địa chỉ → Cho phép Camera, hoặc dùng các tùy chọn tải file bên dưới."
          );
        } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
          setCameraError("Không tìm thấy Camera trên thiết bị. Vui lòng tải ảnh/file lên.");
        } else {
          setCameraError(err?.message || "Không thể mở Camera. Vui lòng tải ảnh/file lên.");
        }
      } finally {
        setStartingCamera(false);
      }
    },
    [facingMode]
  );

  useEffect(() => {
    startCamera("environment");
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  const handleSwitchCamera = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    startCamera(next);
  };

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

  /* ------------------------------- File inputs (Multi-file) ------------------------------ */

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

  /* ------------------------------- Table edit ------------------------------- */

  const handleUpdateOcrRow = (index: number, field: keyof ImportItem, value: any) => {
    setOcrItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      if (field === "productName") item.productCode = generateProductCode(String(value));
      if (field === "expectedQuantity") item.actualQuantity = Number(value) || 0;
      next[index] = item;
      return next;
    });
  };

  const handleAddOcrRow = () => setOcrItems((prev) => [...prev, createEmptyOcrItem(prev.length + 1)]);

  const handleRemoveOcrRow = (index: number) => {
    setOcrItems((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      if (filtered.length === 0) return [createEmptyOcrItem(1)];
      return filtered.map((it, idx) => ({ ...it, stt: idx + 1 }));
    });
  };

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

  /* --------------------------------- Render --------------------------------- */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-3 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ScanLine className="w-5 h-5 text-emerald-400 shrink-0" />
            <h3 className="font-bold text-base sm:text-lg truncate">
              {title ||
                (mode === "OCR_TABLE"
                  ? "Kiểm hàng: Chụp / Tải nhiều ảnh phiếu giao hàng"
                  : "Quét Tag kiểm hàng thực tế")}
            </h3>
            {mode === "OCR_TABLE" && scannedPages.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-extrabold whitespace-nowrap">
                {scannedPages.length} ảnh · {validOcrCount} dòng
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* ===== Khung Camera / Preview ===== */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`relative w-full bg-black rounded-xl overflow-hidden aspect-[4/3] sm:aspect-video max-h-[50vh] ${
              dragOver ? "ring-4 ring-emerald-500" : ""
            }`}
          >
            {/* video luôn nằm trong DOM để ref không null */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover ${
                cameraActive && !previewKind ? "block" : "hidden"
              }`}
            />

            {previewKind === "image" && previewUrl && (
              <img
                src={previewUrl}
                alt="Ảnh cần quét"
                className="absolute inset-0 w-full h-full object-contain bg-black"
              />
            )}

            {previewKind === "pdf" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-2">
                <FileText className="w-14 h-14 text-red-400" />
                <div className="text-sm font-semibold px-4 text-center break-all">{previewName}</div>
              </div>
            )}

            {!cameraActive && !previewKind && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-slate-300 gap-2 p-6">
                {startingCamera ? (
                  <>
                    <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
                    <p className="text-sm">Đang mở Camera...</p>
                  </>
                ) : (
                  <>
                    <Camera className="w-12 h-12 text-emerald-400" />
                    <p className="text-sm">
                      Camera đang tắt. Bấm “Mở Camera” để chụp thêm hoặc tải nhiều ảnh lên cùng lúc.
                    </p>
                    <button
                      type="button"
                      onClick={() => startCamera()}
                      className="mt-1 min-h-[44px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold"
                    >
                      Mở Camera
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Banner thông báo khi đang mở Camera ở chế độ CHỤP THÊM */}
            {cameraActive && !previewKind && mode === "OCR_TABLE" && scannedPages.length > 0 && (
              <div className="absolute top-3 inset-x-3 flex items-center justify-between gap-2 bg-emerald-950/85 border border-emerald-400/60 text-white px-3 py-1.5 rounded-lg text-xs">
                <span className="font-bold text-emerald-300">
                  {scanTarget === "replaceLast"
                    ? `🔄 Đang chụp lại Ảnh #${scannedPages.length}`
                    : `➕ Đang chụp thêm Ảnh #${scannedPages.length + 1} (sẽ cộng vào ${validOcrCount} dòng đã có)`}
                </span>
                <button
                  type="button"
                  onClick={() => handleSelectScannedPage(scannedPages[scannedPages.length - 1])}
                  className="underline text-slate-200 hover:text-white whitespace-nowrap"
                >
                  Xem ảnh trước
                </button>
              </div>
            )}

            {/* Khung căn chỉnh khi đang ngắm */}
            {cameraActive && !previewKind && (
              <div className="pointer-events-none absolute inset-6 sm:inset-10 border-2 border-dashed border-emerald-400/70 rounded-lg" />
            )}

            {/* Overlay đang quét */}
            {scanning && (
              <div className="absolute inset-0 bg-slate-900/75 flex flex-col items-center justify-center text-white gap-2 p-4 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
                <p className="text-sm font-semibold">
                  {scanningProgressText || "Đang quét & nhận diện chữ..."}
                </p>
                <p className="text-xs text-slate-300">
                  Dữ liệu mới sẽ tự động được cộng thêm vào bảng kết quả bên dưới
                </p>
              </div>
            )}

            {/* Thanh điều khiển chụp */}
            {cameraActive && !previewKind && !scanning && (
              <div className="absolute bottom-0 inset-x-0 pb-4 pt-10 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-center gap-8">
                <button
                  type="button"
                  onClick={stopCamera}
                  title="Tắt Camera"
                  className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center backdrop-blur"
                >
                  <VideoOff className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={handleCapture}
                  title="Chụp & Quét"
                  aria-label="Chụp ảnh"
                  className="w-[72px] h-[72px] rounded-full bg-white border-[5px] border-emerald-500 shadow-xl active:scale-90 transition flex items-center justify-center"
                >
                  <Camera className="w-7 h-7 text-slate-900" />
                </button>
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  title="Đổi camera trước/sau"
                  className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center backdrop-blur"
                >
                  <SwitchCamera className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Sau khi chụp / tải file: Nút CHỤP THÊM + TẢI THÊM ẢNH nổi bật để cộng thêm */}
            {previewKind && !scanning && (
              <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 via-black/70 to-transparent flex flex-wrap items-center justify-center gap-2">
                {mode === "OCR_TABLE" && (
                  <>
                    <button
                      type="button"
                      onClick={handleStartCaptureMore}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 shadow-lg"
                    >
                      <Camera className="w-4 h-4" />
                      📷 Chụp thêm ảnh (+cộng vào phiếu)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setScanTarget("append");
                        imageInputRef.current?.click();
                      }}
                      className="min-h-[42px] px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow"
                    >
                      <Images className="w-4 h-4" />
                      ➕ Tải thêm ảnh
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleRetakeLast}
                  className="min-h-[40px] px-3.5 py-2 rounded-lg bg-white/90 hover:bg-white text-slate-900 text-xs font-bold flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" /> Chụp lại ảnh này
                </button>
                {lastPayload && (
                  <button
                    type="button"
                    onClick={() =>
                      runOcrScanSingle(lastPayload.dataUrl, lastPayload.mime, previewName || "Ảnh", "replaceLast")
                    }
                    className="min-h-[40px] px-3.5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-4 h-4" /> Quét lại
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ===== Dải các ảnh đã quét (khi quét từ 1 ảnh trở lên ở chế độ OCR_TABLE) ===== */}
          {mode === "OCR_TABLE" && scannedPages.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-700">
                  Các ảnh / trang đã quét ({scannedPages.length} ảnh → tổng {validOcrCount} dòng hàng):
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={scanning}
                    onClick={handleStartCaptureMore}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1"
                  >
                    <Camera className="w-3.5 h-3.5" /> + Chụp thêm
                  </button>
                  <button
                    type="button"
                    disabled={scanning}
                    onClick={() => {
                      setScanTarget("append");
                      imageInputRef.current?.click();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Thêm nhiều ảnh
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {scannedPages.map((p, idx) => {
                  const isSelected = activePageId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectScannedPage(p)}
                      className={`shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left text-xs transition ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-50 text-emerald-950 font-bold"
                          : "border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
                      }`}
                    >
                      {p.kind === "image" && p.dataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.dataUrl}
                          alt={p.name}
                          className="w-9 h-9 rounded object-cover border border-slate-200"
                        />
                      ) : (
                        <FileText className="w-6 h-6 text-slate-500" />
                      )}
                      <div>
                        <div className="truncate max-w-[130px]">
                          #{idx + 1} {p.name}
                        </div>
                        <div className="text-[10px] text-emerald-700 font-semibold">
                          +{p.items.length} dòng
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== Tùy chọn tải file (Hỗ trợ chọn NHIỀU ẢNH cùng lúc) ===== */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              disabled={scanning}
              onClick={() => {
                setScanTarget("append");
                imageInputRef.current?.click();
              }}
              className="min-h-[44px] px-2 sm:px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 text-center"
            >
              <ImageIcon className="w-4 h-4 shrink-0" />
              {mode === "OCR_TABLE" ? "Chọn 1 hoặc nhiều ảnh" : "Ảnh từ thư viện"}
            </button>
            <button
              type="button"
              disabled={scanning}
              onClick={() => {
                setScanTarget("append");
                nativeCameraInputRef.current?.click();
              }}
              className="min-h-[44px] px-2 sm:px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 text-center"
            >
              <Camera className="w-4 h-4 shrink-0" /> Chụp bằng app Camera
            </button>
            <button
              type="button"
              disabled={scanning}
              onClick={() => {
                setScanTarget("append");
                pdfInputRef.current?.click();
              }}
              className="min-h-[44px] px-2 sm:px-3 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 text-center"
            >
              <FileText className="w-4 h-4 shrink-0" /> Tải file PDF
            </button>
            <button
              type="button"
              disabled={scanning}
              onClick={() => {
                setScanTarget("append");
                textInputRef.current?.click();
              }}
              className="min-h-[44px] px-2 sm:px-3 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 text-center"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" /> Tải TXT / CSV
            </button>

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple={mode === "OCR_TABLE"}
              onChange={handleFileInput}
              className="hidden"
            />
            <input
              ref={nativeCameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileInput}
              className="hidden"
            />
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple={mode === "OCR_TABLE"}
              onChange={handleFileInput}
              className="hidden"
            />
            <input
              ref={textInputRef}
              type="file"
              accept=".txt,.csv,.tsv,text/plain,text/csv"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>
          <p className="text-[11px] text-slate-500 -mt-2">
            Có thể chọn <strong>nhiều hình ảnh cùng lúc</strong> hoặc bấm <strong>“📷 Chụp thêm ảnh”</strong> liên tiếp — các dòng quét được sẽ tự động cộng dồn vào bảng bên dưới.
          </p>

          {/* ===== Thông báo ===== */}
          {cameraError && (
            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {cameraError}
            </div>
          )}
          {scanError && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {scanError}
            </div>
          )}
          {scanInfo && (
            <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>{scanInfo}</span>
              </div>
              {mode === "OCR_TABLE" && !scanning && (
                <button
                  type="button"
                  onClick={handleStartCaptureMore}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 shrink-0"
                >
                  <Camera className="w-3.5 h-3.5" /> Chụp thêm ảnh
                </button>
              )}
            </div>
          )}
          {rawText && (
            <div className="text-xs">
              <button
                type="button"
                onClick={() => setShowRaw((v) => !v)}
                className="text-slate-600 underline"
              >
                {showRaw ? "Ẩn" : "Xem"} văn bản gốc đọc được
              </button>
              {showRaw && (
                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded p-2 text-[11px] text-slate-700">
                  {rawText}
                </pre>
              )}
            </div>
          )}

          {/* ===== Kết quả ===== */}
          {mode === "OCR_TABLE" ? (
            <div className="space-y-3">
              <details className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <summary className="text-xs font-bold text-slate-700 cursor-pointer">
                  Hoặc dán văn bản (mỗi dòng: Tên hàng | ĐVT | Số lượng | Ghi chú)
                </summary>
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  <textarea
                    rows={3}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Áo Polo V1 (Áo Polo V1 Đỏ size L) | Cái | 20 | Lô 1"
                    className="w-full sm:flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:border-emerald-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={scanning || !pasteText.trim()}
                    onClick={() => handleParsePastedText(pasteText)}
                    className="min-h-[40px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold self-stretch sm:self-end"
                  >
                    Cộng vào bảng
                  </button>
                </div>
              </details>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-sm">
                    Danh sách hàng đã quét ({validOcrCount} dòng — sửa trực tiếp trước khi đưa vào phiếu):
                  </h4>
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mergeDuplicates}
                      onChange={(e) => setMergeDuplicates(e.target.checked)}
                      className="rounded accent-emerald-600"
                    />
                    Tự động cộng dồn số lượng khi chụp thêm ảnh có mã hàng trùng
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {scannedPages.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllScanned}
                      className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Xóa làm lại
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAddOcrRow}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Thêm dòng tay
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl max-w-full">
                <table className="w-full min-w-[640px] text-xs text-left">
                  <thead className="bg-slate-900 text-white uppercase">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">STT</th>
                      <th className="hidden py-2.5 px-3 min-w-[200px]">Mã hàng (tự sinh)</th>
                      <th className="py-2.5 px-3 min-w-[260px]">Tên hàng</th>
                      <th className="py-2.5 px-3 w-24">ĐVT</th>
                      <th className="py-2.5 px-3 w-24 text-right">Số lượng</th>
                      <th className="py-2.5 px-3 min-w-[140px]">Ghi chú</th>
                      <th className="py-2.5 px-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {ocrItems.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-center font-mono font-bold">{idx + 1}</td>
                        <td className="hidden py-2 px-3">
                          <input
                            type="text"
                            value={row.productCode}
                            readOnly
                            placeholder="Tự sinh từ ()..."
                            className="w-full bg-emerald-50 text-emerald-900 font-mono text-[11px] font-semibold px-2 py-1.5 rounded border border-emerald-200"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.productName}
                            onChange={(e) => handleUpdateOcrRow(idx, "productName", e.target.value)}
                            placeholder="Tên hàng kèm (mã trong ngoặc)..."
                            className="w-full px-2 py-1.5 rounded border border-slate-300 focus:border-emerald-600 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.unit}
                            onChange={(e) => handleUpdateOcrRow(idx, "unit", e.target.value)}
                            className="w-full px-2 py-1.5 rounded border border-slate-300"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min={1}
                            value={row.expectedQuantity}
                            onChange={(e) =>
                              handleUpdateOcrRow(idx, "expectedQuantity", Math.max(1, Number(e.target.value)))
                            }
                            className="w-full px-2 py-1.5 rounded border border-slate-300 text-right font-mono font-bold"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.note}
                            onChange={(e) => handleUpdateOcrRow(idx, "note", e.target.value)}
                            placeholder="Ghi chú..."
                            className="w-full px-2 py-1.5 rounded border border-slate-300"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveOcrRow(idx)}
                            className="w-10 h-10 inline-flex items-center justify-center text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-4 bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Mã hàng / Tên hàng đọc từ Tag (có thể sửa):
                </label>
                <input
                  type="text"
                  value={tagQuery}
                  onChange={(e) => setTagQuery(e.target.value)}
                  placeholder="Chụp tag hoặc nhập mã/tên hàng..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 font-mono text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Số lượng thực tế kiểm đếm:
                </label>
                <input
                  type="number"
                  min={0}
                  value={tagActualQty}
                  onChange={(e) => setTagActualQty(Math.max(0, Number(e.target.value)))}
                  className="w-full sm:w-48 px-3.5 py-2.5 rounded-lg border border-slate-300 font-mono text-sm font-bold focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-3 sm:px-6 py-3 sm:py-3.5 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 border-t border-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={closeModal}
              className="min-h-[44px] px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm"
            >
              Hủy bỏ
            </button>
            {mode === "OCR_TABLE" && validOcrCount > 0 && (
              <button
                type="button"
                disabled={scanning}
                onClick={handleStartCaptureMore}
                className="min-h-[44px] px-4 py-2.5 rounded-lg border border-emerald-600 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-sm flex items-center justify-center gap-1.5"
              >
                <Camera className="w-4 h-4 text-emerald-700" />
                Chụp thêm ảnh (+)
              </button>
            )}
          </div>

          {mode === "OCR_TABLE" ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {existingItemCount > 0 && (
                <button
                  type="button"
                  disabled={validOcrCount === 0 || scanning}
                  onClick={() => {
                    stopCamera();
                    onConfirmOcrItems?.(
                      ocrItems.filter((i) => i.productName.trim() !== ""),
                      "replace"
                    );
                    onClose();
                  }}
                  className="min-h-[44px] px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold text-xs sm:text-sm"
                  title="Xóa các dòng cũ trên phiếu và thay bằng danh sách vừa quét"
                >
                  Thay thế bảng ({validOcrCount} dòng)
                </button>
              )}
              <button
                type="button"
                disabled={validOcrCount === 0 || scanning}
                onClick={() => {
                  stopCamera();
                  onConfirmOcrItems?.(
                    ocrItems.filter((i) => i.productName.trim() !== ""),
                    existingItemCount > 0 ? "append" : "replace"
                  );
                  onClose();
                }}
                className="min-h-[44px] px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow"
              >
                <Check className="w-4 h-4" />
                {existingItemCount > 0
                  ? `Cộng thêm ${validOcrCount} dòng vào phiếu nhập`
                  : `Đưa ${validOcrCount} dòng vào phiếu nhập`}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={!tagQuery.trim() || scanning}
              onClick={() => {
                stopCamera();
                onConfirmTagScan?.(tagQuery.trim(), tagActualQty);
                onClose();
              }}
              className="min-h-[44px] px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow"
            >
              <Check className="w-4 h-4" />
              Xác nhận đối chiếu Tag
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
