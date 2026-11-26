"use client";

import { Camera, ImageIcon, FileText, FileSpreadsheet } from "lucide-react";
import type { CameraScannerState } from "./useCameraScanner";

export default function ScanUploadOptions({ scanner }: { scanner: CameraScannerState }) {
  const { mode, scanning, setScanTarget, imageInputRef, nativeCameraInputRef, pdfInputRef, textInputRef, handleFileInput } = scanner;

  return (
    <>
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
              className="min-h-[44px] px-2 sm:px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 text-center"
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
              className="min-h-[44px] px-2 sm:px-3 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 text-center"
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
    </>
  );
}
