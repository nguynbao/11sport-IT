import { AlertTriangle, Clock } from "lucide-react";

export function LateReasonSection({
  diffLateMinutes,
  effectiveEndLabel,
  lateReason,
  setLateReason,
}: {
  diffLateMinutes: number;
  effectiveEndLabel: string;
  lateReason: string;
  setLateReason: (v: string) => void;
}) {
  return (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
              <label className="flex items-center gap-1.5 text-rose-900 font-extrabold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  Lý Do Check-out / Gửi Phiếu Trễ ({diffLateMinutes} phút sau {effectiveEndLabel}) *
                </span>
              </label>
              <p className="text-[11px] text-rose-700">
                Bạn đang xác nhận gửi bàn giao trễ quá 5 phút sau giờ kết ca. Vui lòng nhập lý do để HR xem xét:
              </p>
              <textarea
                rows={2}
                value={lateReason}
                onChange={(e) => setLateReason(e.target.value)}
                placeholder="VD: Ở lại tư vấn khách muộn / kiểm hàng cuối ca..."
                className="w-full px-3.5 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-rose-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>
  );
}

export function CheckoutTimeNotice({
  isReachedCheckoutTime,
  effectiveEndLabel,
}: {
  isReachedCheckoutTime: boolean;
  effectiveEndLabel: string;
}) {
  return (
          <div className="p-3 rounded-xl bg-slate-100 text-[11px] text-slate-600 flex items-start gap-2">
            <Clock className="w-4 h-4 text-brand-ink shrink-0 mt-0.5" />
            <div>
              {isReachedCheckoutTime ? (
                <>
                  Khi bấm <b>Xác nhận gửi bàn giao & Check-out</b>, hệ thống sẽ{" "}
                  <b>chốt ngay giờ ra ca của bạn tại thời điểm bấm nút này</b> (kể cả khi nhân viên ca sau đếm lại trễ 15 phút mới bấm xác nhận).
                </>
              ) : (
                <>
                  Chưa tới giờ tan ca (<b>{effectiveEndLabel}</b>). Bạn có thể bấm <b>Lưu bản nháp</b> để cập nhật số lượng đếm được trong ca làm việc.
                </>
              )}
            </div>
          </div>
  );
}
