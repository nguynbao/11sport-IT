import { Boxes, X } from "lucide-react";

interface Props {
  checkedCategories: string[];
  isReachedCheckoutTime: boolean;
  effectiveEndLabel: string;
  onClose: () => void;
}

export default function ShiftHandoverHeader({
  checkedCategories,
  isReachedCheckoutTime,
  effectiveEndLabel,
  onClose,
}: Props) {
  return (
    <div className="bg-blue-600 text-slate-900 px-4 sm:px-6 py-3.5 sm:py-4 flex items-start sm:items-center justify-between gap-2 shrink-0">
      <div className="flex items-start sm:items-center gap-2.5 min-w-0">
        <div className="p-2 bg-white/30 text-slate-900 rounded-xl shrink-0">
          <Boxes className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 leading-snug">
              Kiểm Hàng &amp; Bàn Giao Ca ({checkedCategories.join(" + ") || "Vợt + ..."})
            </h3>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${
                isReachedCheckoutTime
                  ? "bg-slate-900 text-white"
                  : "bg-white/80 text-slate-900 border border-slate-900/15"
              }`}
            >
              {isReachedCheckoutTime ? "Đúng giờ Check-out" : "Bản nháp trong ca"}
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-900/80 font-medium mt-0.5">
            {isReachedCheckoutTime
              ? "Xác nhận gửi bàn giao cho ca sau • Tính giờ Check-out đúng lúc bấm xác nhận"
              : `Cập nhật nháp trong quá trình làm • Đúng ${effectiveEndLabel} sẽ mở nút Xác nhận Check-out`}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng"
        className="p-1.5 rounded-xl text-slate-900/80 hover:text-slate-900 hover:bg-black/10 transition cursor-pointer shrink-0"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
