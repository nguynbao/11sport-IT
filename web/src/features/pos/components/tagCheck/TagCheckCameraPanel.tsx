import React from "react";
import { Camera, SwitchCamera, Search, Undo2 } from "lucide-react";
import type { TagCheckScannerState } from "../../hooks/useTagCheckScanner";
import { ChooseOverlay, ProcessingOverlay, ResultOverlay } from "./TagCheckOverlays";

export default function TagCheckCameraPanel({ s }: { s: TagCheckScannerState }) {
  const { phase, busy, cameraActive, frozenUrl, cameraError, lastAddedIndex } = s;
  return (
    <div className="lg:col-span-3 space-y-3">
      <div className="relative w-full bg-black rounded-xl overflow-hidden aspect-[4/3] sm:aspect-video max-h-[55vh]">
        <video
          ref={s.videoRef}
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-cover ${cameraActive ? "" : "hidden"}`}
        />
        {/* Ảnh vừa chụp được giữ lại trong lúc xử lý / hiển thị kết quả */}
        {frozenUrl && phase !== "live" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={frozenUrl} alt="Ảnh tag vừa chụp" className="absolute inset-0 w-full h-full object-cover" />
        )}

        {!cameraActive && !frozenUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 text-sm p-4 text-center gap-2">
            <Camera className="w-8 h-8" />
            {cameraError || "Đang mở camera..."}
          </div>
        )}

        {/* Khung ngắm + nút chụp */}
        {cameraActive && phase === "live" && (
          <>
            <div className="pointer-events-none absolute inset-x-[12%] inset-y-[14%] border-2 border-dashed border-amber-400/80 rounded-lg" />
            <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-2">
              <span className="px-2.5 py-1 rounded-full bg-black/60 text-white text-[11px] font-bold">
                Đưa tag (tên + mã vạch + SKU) vào khung rồi bấm chụp (Space)
              </span>
              <button
                type="button"
                onClick={s.handleSwitchCamera}
                className="w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center"
                title="Đổi camera"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={s.handleCapture}
              disabled={busy}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white/90 border-4 border-amber-400 shadow-lg flex items-center justify-center active:scale-95 transition disabled:opacity-50"
              title="Chụp & kiểm tra"
            >
              <Camera className="w-7 h-7 text-slate-900" />
            </button>
          </>
        )}

        {/* Vòng loading + bộ đếm giây */}
        {phase === "processing" && (
          <ProcessingOverlay elapsedMs={s.elapsedMs} processingText={s.processingText} />
        )}

        {/* Kết quả: tick hoặc cảnh báo */}
        {phase === "result" && s.result && <ResultOverlay result={s.result} onBack={s.backToLive} />}

        {/* Chọn dòng khi trùng nhiều dòng */}
        {phase === "choose" && (
          <ChooseOverlay
            candidates={s.candidates}
            busy={busy}
            onPick={s.handlePickCandidate}
            onBack={s.backToLive}
          />
        )}
      </div>

      {/* Hoàn tác + nhập tay */}
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          disabled={busy || lastAddedIndex === null}
          onClick={() => lastAddedIndex !== null && s.runRowAction({ rowIndex: lastAddedIndex, delta: -1 })}
          className="min-h-[44px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          title="Bỏ 1 chiếc vừa quét nhầm"
        >
          <Undo2 className="w-4 h-4" /> Hoàn tác lần quét
        </button>
        <form onSubmit={s.handleManualSubmit} className="flex gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              data-barcode-input="true"
              value={s.manualQuery}
              onChange={(e) => s.setManualQuery(e.target.value)}
              placeholder="Bắn súng mã vạch hoặc nhập mã SKU / tên hàng (+1)..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-base sm:text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !s.manualQuery.trim()}
            className="px-4 min-h-[44px] rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-50"
          >
            Kiểm
          </button>
        </form>
      </div>
    </div>
  );
}
