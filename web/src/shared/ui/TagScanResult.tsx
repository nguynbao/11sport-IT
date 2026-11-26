"use client";

import type { CameraScannerState } from "./useCameraScanner";

export default function TagScanResult({ scanner }: { scanner: CameraScannerState }) {
  const { tagQuery, setTagQuery, tagActualQty, setTagActualQty } = scanner;

  return (
    <>
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
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 font-mono text-sm focus:border-blue-600 focus:outline-none"
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
                  className="w-full sm:w-48 px-3.5 py-2.5 rounded-lg border border-slate-300 font-mono text-sm font-bold focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
    </>
  );
}
