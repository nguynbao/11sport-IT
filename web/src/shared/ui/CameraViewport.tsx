"use client";

import { Camera, VideoOff, RefreshCw, SwitchCamera, FileText, Loader2, RotateCcw, Images } from "lucide-react";
import type { CameraScannerState } from "./useCameraScanner";

export default function CameraViewport({ scanner }: { scanner: CameraScannerState }) {
  const { mode, dragOver, setDragOver, handleDrop, videoRef, cameraActive, previewKind, previewUrl, previewName, startingCamera, startCamera, scannedPages, scanTarget, validOcrCount, handleSelectScannedPage, scanning, scanningProgressText, stopCamera, handleCapture, handleSwitchCamera, handleStartCaptureMore, setScanTarget, imageInputRef, handleRetakeLast, lastPayload, runOcrScanSingle } = scanner;

  return (
    <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`relative w-full bg-black rounded-xl overflow-hidden aspect-[4/3] sm:aspect-video max-h-[50vh] ${
              dragOver ? "ring-4 ring-blue-500" : ""
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
                    <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
                    <p className="text-sm">Đang mở Camera...</p>
                  </>
                ) : (
                  <>
                    <Camera className="w-12 h-12 text-blue-400" />
                    <p className="text-sm">
                      Camera đang tắt. Bấm “Mở Camera” để chụp thêm hoặc tải nhiều ảnh lên cùng lúc.
                    </p>
                    <button
                      type="button"
                      onClick={() => startCamera()}
                      className="mt-1 min-h-[44px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
                    >
                      Mở Camera
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Banner thông báo khi đang mở Camera ở chế độ CHỤP THÊM */}
            {cameraActive && !previewKind && mode === "OCR_TABLE" && scannedPages.length > 0 && (
              <div className="absolute top-3 inset-x-3 flex items-center justify-between gap-2 bg-blue-950/85 border border-blue-400/60 text-white px-3 py-1.5 rounded-lg text-xs">
                <span className="font-bold text-blue-300">
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
              <div className="pointer-events-none absolute inset-6 sm:inset-10 border-2 border-dashed border-blue-400/70 rounded-lg" />
            )}

            {/* Overlay đang quét */}
            {scanning && (
              <div className="absolute inset-0 bg-slate-900/75 flex flex-col items-center justify-center text-white gap-2 p-4 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
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
                  className="w-[72px] h-[72px] rounded-full bg-white border-[5px] border-blue-500 shadow-xl active:scale-90 transition flex items-center justify-center"
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
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-slate-950 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 shadow-lg"
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
    </>
  );
}
