import React from "react";
import { CheckCircle2, AlertTriangle, XCircle, Undo2, HelpCircle } from "lucide-react";
import type { Candidate, ResultKind, ScanResult } from "../../utils/tagCheckTypes";

const resultStyle: Record<ResultKind, { box: string; icon: React.ReactNode }> = {
  added: { box: "bg-blue-600 text-white", icon: <CheckCircle2 className="w-14 h-14" /> },
  full: { box: "bg-blue-600 text-white", icon: <CheckCircle2 className="w-14 h-14" /> },
  undone: { box: "bg-blue-600 text-white", icon: <Undo2 className="w-14 h-14" /> },
  alreadyFull: { box: "bg-amber-400 text-slate-950", icon: <AlertTriangle className="w-14 h-14" /> },
  notfound: { box: "bg-red-600 text-white", icon: <XCircle className="w-14 h-14" /> },
  unreadable: { box: "bg-slate-700 text-white", icon: <HelpCircle className="w-14 h-14" /> },
  error: { box: "bg-red-700 text-white", icon: <XCircle className="w-14 h-14" /> },
};

export function ProcessingOverlay({ elapsedMs, processingText }: { elapsedMs: number; processingText: string }) {
  return (
    <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-3 text-white p-4 text-center">
      <div className="relative flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-white/25 border-t-amber-400 animate-spin" />
        <span className="absolute text-xs font-mono font-extrabold text-amber-300">
          {(elapsedMs / 1000).toFixed(1)}s
        </span>
      </div>
      <div className="text-sm font-bold">{processingText}</div>
      <div className="text-[11px] text-slate-300">Mục tiêu ≤ 5.0s · Tự động dùng model dự phòng nếu chậm</div>
    </div>
  );
}

export function ResultOverlay({ result, onBack }: { result: ScanResult; onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="absolute inset-0 bg-black/40 flex items-center justify-center p-4"
      title="Chụp tiếp"
    >
      <div
        className={`w-full max-w-sm rounded-2xl px-5 py-5 shadow-2xl flex flex-col items-center text-center gap-2 ${
          resultStyle[result.kind].box
        }`}
      >
        {resultStyle[result.kind].icon}
        <div className="text-lg font-extrabold leading-tight">{result.title}</div>
        {result.detail && <div className="text-xs font-semibold opacity-90">{result.detail}</div>}
        {result.badge && (
          <div className="px-2.5 py-0.5 rounded-full bg-black/20 text-[11px] font-mono font-bold">
            {result.badge}
          </div>
        )}
        <div className="mt-1 text-[11px] font-bold underline opacity-90">
          {result.kind === "added" || result.kind === "full" || result.kind === "undone"
            ? "Tự quay lại camera..."
            : "Chạm để chụp lại / chụp tiếp"}
        </div>
      </div>
    </button>
  );
}

interface ChooseProps {
  candidates: Candidate[];
  busy: boolean;
  onPick: (index: number) => void;
  onBack: () => void;
}

export function ChooseOverlay({ candidates, busy, onPick, onBack }: ChooseProps) {
  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-3">
      <div className="w-full max-w-md bg-white rounded-xl p-3 space-y-2 max-h-full overflow-y-auto">
        <div className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4" /> Tag khớp nhiều dòng — chọn đúng dòng:
        </div>
        {candidates.map((c) => {
          const full = (Number(c.scannedQuantity) || 0) >= Math.max(1, Number(c.expectedQuantity) || 0);
          return (
            <button
              key={c.index}
              type="button"
              disabled={busy}
              onClick={() => onPick(c.index)}
              className="w-full text-left px-3 py-2 min-h-[44px] rounded-lg border border-slate-200 hover:border-amber-500 text-xs"
            >
              <span className="font-bold">#{c.index + 1}</span> {c.productName}
              <span className={`ml-1 font-bold ${full ? "text-brand-ink" : "text-amber-700"}`}>
                ({c.scannedQuantity ?? 0}/{c.expectedQuantity ?? 0})
              </span>
            </button>
          );
        })}
        <button type="button" onClick={onBack} className="text-xs text-slate-600 underline">
          Bỏ qua, chụp lại
        </button>
      </div>
    </div>
  );
}
