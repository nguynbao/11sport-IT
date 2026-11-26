import { ScanBarcode, AlertCircle, CheckCircle2, RotateCcw } from "lucide-react";
import type { InventoryCtx } from "./inventoryCtx";

type Props = Pick<InventoryCtx, "showScannerPanel" | "scannedCheckCounts" | "lastScanFeedback" | "scannerEnabled" | "setScannerEnabled" | "scannerInput" | "setScannerInput" | "handleBarcodeScanForInventoryCheck" | "onlyShowScanned" | "setOnlyShowScanned" | "lastScannedProdId" | "setScannedCheckCounts" | "setScannedVariantCounts" | "setLastScannedProdId" | "setLastScannedVariantCode" | "setLastScanFeedback">;

export default function InventoryScannerPanel({ showScannerPanel, scannedCheckCounts, lastScanFeedback, scannerEnabled, setScannerEnabled, scannerInput, setScannerInput, handleBarcodeScanForInventoryCheck, onlyShowScanned, setOnlyShowScanned, lastScannedProdId, setScannedCheckCounts, setScannedVariantCounts, setLastScannedProdId, setLastScannedVariantCode, setLastScanFeedback }: Props) {
  return (
    <>
    {(showScannerPanel || Object.keys(scannedCheckCounts).length > 0 || lastScanFeedback) && (
      <div className="rounded-xl border border-blue-300 bg-blue-50/50 p-3 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <ScanBarcode className="w-4 h-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-blue-950">
                  Máy Quét Label — Quét Kiểm Hàng &amp; Đối Chiếu Tồn Kho
                </span>
                <button
                  type="button"
                  onClick={() => setScannerEnabled((v) => !v)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold transition ${
                    scannerEnabled
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {scannerEnabled ? "● ĐANG BẬT MÁY QUÉT (TỰ ĐỘNG)" : "○ ĐÃ TẮT MÁY QUÉT"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!scannerInput.trim()) return;
                handleBarcodeScanForInventoryCheck(scannerInput);
                setScannerInput("");
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                data-barcode-input="true"
                value={scannerInput}
                onChange={(e) => setScannerInput(e.target.value)}
                placeholder="Quét hoặc gõ mã SP + Enter..."
                className="w-48 sm:w-56 px-3 py-1.5 rounded-lg border border-blue-400 bg-white text-xs font-mono font-extrabold text-slate-900 uppercase focus:border-blue-600 focus:outline-none"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold whitespace-nowrap shadow-xs"
              >
                +1 Kiểm
              </button>
            </form>

            {Object.keys(scannedCheckCounts).length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setOnlyShowScanned((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-extrabold transition ${
                    onlyShowScanned
                      ? "bg-blue-700 text-white border-blue-700"
                      : "bg-white text-brand-ink border-blue-300 hover:bg-blue-50"
                  }`}
                >
                  {onlyShowScanned
                    ? `Đang lọc mã đã quét (${Object.keys(scannedCheckCounts).length})`
                    : `Chỉ hiện mã đã quét (${Object.keys(scannedCheckCounts).length})`}
                </button>
                {lastScannedProdId && (scannedCheckCounts[lastScannedProdId] || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setScannedCheckCounts((prev) => {
                        const cur = prev[lastScannedProdId] || 0;
                        const copy = { ...prev };
                        if (cur <= 1) delete copy[lastScannedProdId];
                        else copy[lastScannedProdId] = cur - 1;
                        return copy;
                      });
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1"
                    title="Trừ 1 số lượng kiểm của mã vừa quét"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Hoàn tác -1
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setScannedCheckCounts({});
                    setScannedVariantCounts({});
                    setLastScannedProdId(null);
                    setLastScannedVariantCode(null);
                    setOnlyShowScanned(false);
                    setLastScanFeedback(null);
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold"
                >
                  Reset bộ đếm
                </button>
              </>
            )}
          </div>
        </div>

        {lastScanFeedback && (
          <div
            className={`mt-2.5 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between gap-2 border ${
              lastScanFeedback.type === "success"
                ? "bg-blue-100/90 border-blue-300 text-blue-950"
                : lastScanFeedback.type === "warning"
                  ? "bg-amber-100/90 border-amber-300 text-amber-950"
                  : "bg-red-100/90 border-red-300 text-red-900"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {lastScanFeedback.type === "error" ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-brand-ink" />
              )}
              <span className="truncate">{lastScanFeedback.message}</span>
            </div>
            <span className="text-[10px] font-mono opacity-75 shrink-0">
              {lastScanFeedback.time}
            </span>
          </div>
        )}
      </div>
    )}
    </>
  );
}
