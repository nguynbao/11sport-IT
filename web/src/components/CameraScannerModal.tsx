"use client";

import React, { useState, useRef, useEffect } from "react";
import { Camera, Upload, Sparkles, X, Check, Plus, Trash2, Video, VideoOff } from "lucide-react";
import { apiRequest, generateProductCode, ImportItem } from "@/lib/api";

interface CameraScannerModalProps {
  mode: "OCR_TABLE" | "SCAN_TAG";
  title?: string;
  expectedCodeHint?: string;
  onConfirmOcrItems?: (items: ImportItem[]) => void;
  onConfirmTagScan?: (query: string, actualQuantity?: number) => void;
  onClose: () => void;
}

const DEFAULT_OCR_SAMPLES: ImportItem[] = [
  {
    stt: 1,
    productName: "Áo Polo Thể thao Unisex V1 (Áo Polo Thể thao Unisex V1 KMAP262510 Đỏ size L)",
    productCode: "AO_POLO_THE_THAO_UNISEX_V1_KMAP262510_DO_SIZE_L",
    unit: "Cái",
    expectedQuantity: 20,
    actualQuantity: 20,
    note: "Hàng mới nguyên kiện",
    isChecked: false,
    isConfirmed: false,
  },
  {
    stt: 2,
    productName: "Quần Short Chạy Bộ Pro (Quần Short Chạy Bộ Pro KMQS2601 Đen size XL)",
    productCode: "QUAN_SHORT_CHAY_BO_PRO_KMQS2601_DEN_SIZE_XL",
    unit: "Cái",
    expectedQuantity: 15,
    actualQuantity: 15,
    note: "Đợt 1",
    isChecked: false,
    isConfirmed: false,
  },
  {
    stt: 3,
    productName: "Giày Cầu Lông 11Sport Speed (Giày Cầu Lông 11Sport Speed GCL2026 Trắng Xanh size 42)",
    productCode: "GIAY_CAU_LONG_11SPORT_SPEED_GCL2026_TRANG_XANH_SIZE_42",
    unit: "Đôi",
    expectedQuantity: 10,
    actualQuantity: 10,
    note: "Full box",
    isChecked: false,
    isConfirmed: false,
  },
];

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
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [loadingOcr, setLoadingOcr] = useState(false);

  // State cho OCR_TABLE
  const [ocrItems, setOcrItems] = useState<ImportItem[]>(DEFAULT_OCR_SAMPLES);

  // State cho SCAN_TAG
  const [tagQuery, setTagQuery] = useState(
    expectedCodeHint || "AO_POLO_THE_THAO_UNISEX_V1_KMAP262510_DO_SIZE_L"
  );
  const [tagActualQty, setTagActualQty] = useState<number>(20);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError("");
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Trình duyệt không hỗ trợ WebRTC Camera.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err: any) {
      setCameraError(
        err?.message || "Không tìm thấy thiết bị Camera hoặc chưa cấp quyền. Bạn có thể tải ảnh hoặc dùng mẫu OCR."
      );
    }
  };

  const handleLoadServerOcrSample = async () => {
    setLoadingOcr(true);
    try {
      const res = await apiRequest<any>("/imports/ocr-preview", {
        method: "POST",
        body: JSON.stringify({ sampleType: "default" }),
      });
      const list = Array.isArray(res.data) ? res.data : res.data?.items || [];
      if (list.length > 0) {
        const mapped: ImportItem[] = list.map((it: any, idx: number) => {
          const pName = it.productName || it.name || "";
          return {
            stt: idx + 1,
            productName: pName,
            productCode: it.productCode || generateProductCode(pName),
            unit: it.unit || "Cái",
            expectedQuantity: Number(it.expectedQuantity ?? it.quantity ?? 10),
            actualQuantity: Number(it.actualQuantity ?? it.expectedQuantity ?? it.quantity ?? 10),
            note: it.note || "",
            isChecked: false,
            isConfirmed: false,
          };
        });
        setOcrItems(mapped);
      } else {
        setOcrItems(DEFAULT_OCR_SAMPLES);
      }
    } catch {
      setOcrItems(DEFAULT_OCR_SAMPLES);
    } finally {
      setLoadingOcr(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (mode === "OCR_TABLE") {
      await handleLoadServerOcrSample();
    } else {
      // Tag scan từ ảnh
      if (expectedCodeHint) {
        setTagQuery(expectedCodeHint);
      }
    }
  };

  const handleUpdateOcrRow = (index: number, field: keyof ImportItem, value: any) => {
    setOcrItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      if (field === "productName") {
        item.productCode = generateProductCode(String(value));
      }
      if (field === "expectedQuantity") {
        item.actualQuantity = Number(value) || 0;
      }
      next[index] = item;
      return next;
    });
  };

  const handleAddOcrRow = () => {
    setOcrItems((prev) => [
      ...prev,
      {
        stt: prev.length + 1,
        productName: "",
        productCode: "",
        unit: "Cái",
        expectedQuantity: 1,
        actualQuantity: 1,
        note: "",
        isChecked: false,
        isConfirmed: false,
      },
    ]);
  };

  const handleRemoveOcrRow = (index: number) => {
    setOcrItems((prev) =>
      prev.filter((_, i) => i !== index).map((it, idx) => ({ ...it, stt: idx + 1 }))
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-lg">
              {title ||
                (mode === "OCR_TABLE"
                  ? "📷 Camera Kiểm Hàng (OCR Bảng 6 Cột)"
                  : "📷 Quét Tag Kiểm Tra Hàng Thực Tế")}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Khung điều khiển Camera & Upload */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="md:col-span-1 flex flex-col items-center justify-center bg-slate-900 rounded-lg min-h-[170px] relative overflow-hidden text-white p-3">
              {cameraActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-40 object-cover rounded"
                />
              ) : (
                <div className="text-center space-y-2">
                  <Camera className="w-10 h-10 text-emerald-400 mx-auto opacity-80" />
                  <p className="text-xs text-slate-300">Khung ngắm Camera thiết bị</p>
                </div>
              )}
            </div>

            <div className="md:col-span-2 flex flex-col justify-between space-y-3">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">
                  Chọn nguồn thu nhận hình ảnh chứng từ / nhãn tag:
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Hỗ trợ bật Webcam trực tiếp, tải file ảnh chụp phiếu giao hàng, hoặc nạp mẫu OCR tự động.
                </p>
                {cameraError && (
                  <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
                    {cameraError}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {!cameraActive ? (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3.5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Video className="w-4 h-4 text-emerald-400" />
                    Bật Camera thiết bị
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-3.5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <VideoOff className="w-4 h-4" />
                    Tắt Camera
                  </button>
                )}

                <label className="px-3.5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  Tải ảnh chứng từ / Tag
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                {mode === "OCR_TABLE" && (
                  <button
                    type="button"
                    onClick={handleLoadServerOcrSample}
                    disabled={loadingOcr}
                    className="px-3.5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    {loadingOcr ? "Đang trích xuất OCR..." : "Lấy mẫu OCR nhanh (API)"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Nội dung theo Mode */}
          {mode === "OCR_TABLE" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Kết quả trích xuất Bảng 6 Cột (Cho phép sửa trực tiếp từng ô):
                  </h4>
                  <p className="text-xs text-slate-500">
                    Khi sửa cột <strong>TÊN HÀNG</strong> có chứa <code>(...)</code>, cột{" "}
                    <strong>MÃ HÀNG</strong> tự động sinh IN HOA KHÔNG DẤU GẠCH CHÂN.
                  </p>
                </div>
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
                      <th className="py-2.5 px-3 min-w-[230px]">MÃ HÀNG (Tự sinh từ `()`)</th>
                      <th className="py-2.5 px-3 min-w-[260px]">TÊN HÀNG</th>
                      <th className="py-2.5 px-3 w-24">ĐVT</th>
                      <th className="py-2.5 px-3 w-28 text-right">SỐ LƯỢNG</th>
                      <th className="py-2.5 px-3 min-w-[140px]">GHI CHÚ</th>
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
                            onChange={(e) =>
                              handleUpdateOcrRow(idx, "productName", e.target.value)
                            }
                            placeholder="VD: Áo Polo V1 (Áo Polo V1 Đỏ size L)"
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
                              handleUpdateOcrRow(
                                idx,
                                "expectedQuantity",
                                Math.max(1, Number(e.target.value))
                              )
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
                  Mã hàng hoặc Tên hàng đọc được từ Tag sản phẩm:
                </label>
                <input
                  type="text"
                  value={tagQuery}
                  onChange={(e) => setTagQuery(e.target.value)}
                  placeholder="Nhập/quét mã hàng hoặc tên hàng trên tag..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 font-mono text-sm focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Số lượng thực tế kiểm đếm được:
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
        <div className="bg-slate-100 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-200">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm"
          >
            Hủy bỏ
          </button>

          {mode === "OCR_TABLE" ? (
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onConfirmOcrItems?.(ocrItems.filter((i) => i.productName.trim() !== ""));
                onClose();
              }}
              className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-2 shadow"
            >
              <Check className="w-4 h-4" />
              Đưa {ocrItems.length} dòng vào Bảng Nhập Kho
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onConfirmTagScan?.(tagQuery.trim(), tagActualQty);
                onClose();
              }}
              className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-2 shadow"
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
