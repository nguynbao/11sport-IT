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
        <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base">
                  Kiểm Hàng & Bàn Giao Ca ({checkedCategories.join(" + ") || "Vợt + ..."})
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                    isReachedCheckoutTime
                      ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  }`}
                >
                  {isReachedCheckoutTime ? "Đúng giờ Check-out" : "Bản nháp trong ca"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isReachedCheckoutTime
                  ? "Xác nhận gửi bàn giao cho ca sau • Tính giờ Check-out đúng lúc bấm xác nhận"
                  : `Cập nhật nháp trong quá trình làm • Đúng ${effectiveEndLabel} sẽ mở nút Xác nhận Check-out`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-blue-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
  );
}
