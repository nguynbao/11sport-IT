import { Send, Save, Clock } from "lucide-react";

interface Props {
  isPending: boolean;
  submitting: boolean;
  loading: boolean;
  isReachedCheckoutTime: boolean;
  shiftCode: "SHIFT_1" | "SHIFT_2" | "BOTH";
  effectiveEndLabel: string;
  onClose: () => void;
  handleSaveDraft: () => void;
}

export default function ShiftHandoverFooter({
  isPending,
  submitting,
  loading,
  isReachedCheckoutTime,
  shiftCode,
  effectiveEndLabel,
  onClose,
  handleSaveDraft,
}: Props) {
  return (
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Đóng
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {!isPending && (
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={submitting || loading}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{submitting ? "Đang lưu..." : "Lưu Bản Nháp"}</span>
                </button>
              )}

              {isReachedCheckoutTime ? (
                <button
                  type="submit"
                  disabled={submitting || loading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-lg transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {submitting
                      ? "Đang gửi..."
                      : shiftCode === "SHIFT_1"
                      ? "Xác Nhận Gửi Ca 2 & Check-out"
                      : "Xác Nhận Gửi Bàn Giao & Check-out"}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  title={`Chờ đến đúng giờ tan ca (${effectiveEndLabel}) để mở nút Xác nhận gửi bàn giao & Check-out`}
                  className="px-4 py-2.5 bg-slate-200 text-slate-500 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-not-allowed"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Mở xác nhận lúc {effectiveEndLabel}</span>
                </button>
              )}
            </div>
          </div>
  );
}
