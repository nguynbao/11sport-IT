import { Coins, FileText } from "lucide-react";
import { formatMoneyInput, parseMoneyInput } from "../../utils/shiftHandover";

export function CashSection({
  cashBalance,
  setCashBalance,
}: {
  cashBalance: number;
  setCashBalance: (v: number) => void;
}) {
  return (
          <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-2">
            <label className="flex items-center gap-2 text-amber-950 font-extrabold text-xs">
              <Coins className="w-4 h-4 text-amber-600" />
              <span>2. Tiền Mặt Trong Quầy (VND) *</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              required
              value={formatMoneyInput(cashBalance)}
              onChange={(e) => setCashBalance(parseMoneyInput(e.target.value))}
              placeholder="Nhập số tiền mặt hiện có trong quầy..."
              className="w-full px-3.5 py-2.5 bg-white text-slate-900 placeholder:text-slate-400 border border-amber-300 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
  );
}

export function NoteSection({
  note,
  setNote,
  diffCategoriesCount,
}: {
  note: string;
  setNote: (v: string) => void;
  diffCategoriesCount: number;
}) {
  return (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <label className="flex items-center justify-between text-slate-800 font-extrabold text-xs">
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>3. Lý Do / Ghi Chú Bàn Giao (Có thể ghi hoặc không)</span>
              </span>
              {diffCategoriesCount > 0 && (
                <span className="text-[11px] font-bold text-amber-700">
                  Đang lệch {diffCategoriesCount} nhóm hàng
                </span>
              )}
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi lý do nếu lệch số lượng hoặc ghi chú dặn ca sau (không bắt buộc)..."
              className="w-full px-3.5 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
  );
}
