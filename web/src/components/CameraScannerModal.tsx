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
} from "lucide-react";
import { apiRequest, generateProductCode, ImportItem } from "@/lib/api";

interface CameraScannerModalProps {
  mode: "OCR_TABLE" | "SCAN_TAG";
  title?: string;
  expectedCodeHint?: string;
  onConfirmOcrItems?: (items: ImportItem[]) => void;
  onConfirmTagScan?: (query: string, actualQuantity?: number) => void;
  onClose: () => void;
}

type PreviewKind = "image" | "pdf" | null;

const MAX_IMAGE_DIM = 1600;
const MAX_PDF_BYTES = 6 * 1024 * 1024;

const createEmptyOcrItem = (stt: number): ImportItem => ({
  stt,
  productName: "",
  productCode: "",
  unit: "Cái",
  expectedQuantity: 1,
  actualQuantity: 1,
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
      note: it.note || "",
      isChecked: false,
      isConfirmed: false,
    };
  });
}

export default function CameraScannerModal({
  mode,
  title,
  expectedCodeHint,
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

  const [scanning, setScanning] = useState(false);
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
            "Trình duyệt không hỗ trợ Camera (cần HTTPS). Hãy dùng nút 'Chụp bằng ứng dụng Camera' hoặc tải ảnh lên."
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

  const runOcrScan = async (dataUrl: string, mime: string) => {
    setScanning(true);
    setScanError("");
    setScanInfo("");
    setRawText("");
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
      setRawText(String(d.rawText || ""));
      const engineLabel = d.engine === "gemini" ? "AI Gemini" : "Tesseract";

      if (mode === "OCR_TABLE") {
        const list = Array.isArray(d.items) ? d.items : [];
        if (list.length === 0) {
          setScanError(
            "Không nhận diện được dòng hàng nào. Hãy chụp lại rõ nét, đủ sáng, chụp thẳng bảng hàng."
          );
          return;
        }
        setOcrItems(mapApiItems(list));
        setScanInfo(`Đã quét được ${list.length} dòng hàng (${engineLabel}). Vui lòng kiểm tra & sửa lại nếu cần.`);
      } else {
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
      setPreviewUrl(dataUrl);
      setPreviewKind("image");
      setPreviewName("Ảnh chụp từ Camera");
      stopCamera();
      await runOcrScan(dataUrl, "image/jpeg");
    } catch (err: any) {
      setScanError(err?.message || "Không chụp được ảnh.");
    }
  };

  const handleRetake = () => {
    setPreviewUrl(null);
    setPreviewKind(null);
    setScanError("");
    setScanInfo("");
    startCamera();
  };

  /* ------------------------------- File inputs ------------------------------ */

  const processFile = async (file: File) => {
    setScanError("");
    setScanInfo("");
    const name = file.name.toLowerCase();
    try {
      if (file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|bmp|gif)$/.test(name)) {
        const dataUrl = await loadImageFromFile(file);
        stopCamera();
        setPreviewUrl(dataUrl);
        setPreviewKind("image");
        setPreviewName(file.name);
        await runOcrScan(dataUrl, "image/jpeg");
        return;
      }

      if (file.type === "application/pdf" || name.endsWith(".pdf")) {
        if (file.size > MAX_PDF_BYTES) {
          setScanError("File PDF quá lớn (tối đa 6MB).");
          return;
        }
        const dataUrl = await readFileAsDataUrl(file);
        stopCamera();
        setPreviewUrl(null);
        setPreviewKind("pdf");
        setPreviewName(file.name);
        await runOcrScan(dataUrl, "application/pdf");
        return;
      }

      if (/\.(txt|csv|tsv)$/.test(name) || file.type.startsWith("text/")) {
        const text = await readFileAsText(file);
        // CSV dùng dấu phẩy → đổi sang | để server tách cột
        const normalized = name.endsWith(".csv") ? text.replace(/,/g, "|") : text;
        if (mode === "OCR_TABLE") {
          await handleParsePastedText(normalized);
        } else {
          const first = normalized.split(/\r?\n/).find((l) => l.trim()) || "";
          setTagQuery(first.trim());
        }
        setPreviewName(file.name);
        return;
      }

      setScanError("Định dạng chưa hỗ trợ. Chọn ảnh (JPG/PNG/WEBP), PDF, hoặc TXT/CSV.");
    } catch (err: any) {
      setScanError(err?.message || "Không xử lý được file.");
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // cho phép chọn lại cùng 1 file
    if (file) await processFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  };

  const handleParsePastedText = async (text: string) => {
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
        setOcrItems(mapApiItems(list));
        setScanInfo(`Đã tách ${list.length} dòng hàng từ văn bản.`);
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

  const validOcrCount = ocrItems.filter((i) => i.productName.trim()).length;

  const closeModal = () => {
    stopCamera();
    onClose();
  };

  /* --------------------------------- Render --------------------------------- */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[96vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base sm:text-lg">
              {title ||
                (mode === "OCR_TABLE"
                  ? "Kiểm hàng: Chụp / Tải phiếu giao hàng"
                  : "Quét Tag kiểm hàng thực tế")}
            </h3>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
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
            className={`relative w-full bg-black rounded-xl overflow-hidden aspect-[4/3] sm:aspect-video max-h-[55vh] ${
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
                    <p className="text-sm">Camera đang tắt. Bấm “Mở Camera” hoặc kéo-thả / tải file lên.</p>
                    <button
                      type="button"
                      onClick={() => startCamera()}
                      className="mt-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold"
                    >
                      Mở Camera
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Khung căn chỉnh khi đang ngắm */}
            {cameraActive && !previewKind && (
              <div className="pointer-events-none absolute inset-6 sm:inset-10 border-2 border-dashed border-emerald-400/70 rounded-lg" />
            )}

            {/* Overlay đang quét */}
            {scanning && (
              <div className="absolute inset-0 bg-slate-900/70 flex flex-col items-center justify-center text-white gap-2">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
                <p className="text-sm font-semibold">Đang quét & nhận diện chữ...</p>
                <p className="text-xs text-slate-300">Có thể mất 5–20 giây</p>
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

            {/* Sau khi chụp / tải file */}
            {previewKind && !scanning && (
              <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="px-4 py-2 rounded-lg bg-white/90 hover:bg-white text-slate-900 text-xs font-bold flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" /> Chụp lại
                </button>
                {lastPayload && (
                  <button
                    type="button"
                    onClick={() => runOcrScan(lastPayload.dataUrl, lastPayload.mime)}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-4 h-4" /> Quét lại
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ===== Tùy chọn tải file ===== */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <ImageIcon className="w-4 h-4" /> Ảnh từ thư viện
            </button>
            <button
              type="button"
              onClick={() => nativeCameraInputRef.current?.click()}
              className="px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <Camera className="w-4 h-4" /> Chụp bằng app Camera
            </button>
            <button
              type="button"
              onClick={() => pdfInputRef.current?.click()}
              className="px-3 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <FileText className="w-4 h-4" /> Tải file PDF
            </button>
            <button
              type="button"
              onClick={() => textInputRef.current?.click()}
              className="px-3 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" /> Tải TXT / CSV
            </button>

            <input ref={imageInputRef} type="file" accept="image/*" onChange={handleFileInput} className="hidden" />
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
            Trên máy tính có thể kéo-thả file trực tiếp vào khung camera. Hỗ trợ JPG / PNG / WEBP / PDF / TXT / CSV.
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
            <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex gap-2">
              <Sparkles className="w-4 h-4 shrink-0" /> {scanInfo}
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
                <div className="flex gap-2 mt-2">
                  <textarea
                    rows={3}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Áo Polo V1 (Áo Polo V1 Đỏ size L) | Cái | 20 | Lô 1"
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:border-emerald-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={scanning || !pasteText.trim()}
                    onClick={() => handleParsePastedText(pasteText)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold self-end"
                  >
                    Tách vào bảng
                  </button>
                </div>
              </details>

              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm">
                  Kết quả (sửa trực tiếp từng ô trước khi đưa vào phiếu):
                </h4>
                <button
                  type="button"
                  onClick={handleAddOcrRow}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Thêm dòng
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900 text-white uppercase">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">STT</th>
                      <th className="py-2.5 px-3 min-w-[200px]">Mã hàng (tự sinh)</th>
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
                        <td className="py-2 px-3">
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
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
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
            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
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
                  className="w-48 px-3.5 py-2.5 rounded-lg border border-slate-300 font-mono text-sm font-bold focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 px-4 sm:px-6 py-3.5 flex items-center justify-end gap-3 border-t border-slate-200">
          <button
            type="button"
            onClick={closeModal}
            className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm"
          >
            Hủy bỏ
          </button>

          {mode === "OCR_TABLE" ? (
            <button
              type="button"
              disabled={validOcrCount === 0 || scanning}
              onClick={() => {
                stopCamera();
                onConfirmOcrItems?.(ocrItems.filter((i) => i.productName.trim() !== ""));
                onClose();
              }}
              className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm flex items-center gap-2 shadow"
            >
              <Check className="w-4 h-4" />
              Đưa {validOcrCount} dòng vào phiếu nhập
            </button>
          ) : (
            <button
              type="button"
              disabled={!tagQuery.trim() || scanning}
              onClick={() => {
                stopCamera();
                onConfirmTagScan?.(tagQuery.trim(), tagActualQty);
                onClose();
              }}
              className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm flex items-center gap-2 shadow"
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
