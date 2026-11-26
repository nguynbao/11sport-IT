import { formatVND, formatPhone, formatDateTime } from "@/shared/utils/format";
import { Trash2, Printer, X, FileText } from "lucide-react";
import type { Order } from "@/shared/types";
import type { PosCtx } from "../hooks/usePosTab";

type SavedDraftsPanelProps = Pick<
  PosCtx,
  "posSubView" | "savedDraftOrders" | "setPosSubView" | "loadingSavedDrafts"
  | "editingServerDraftOrder" | "liveDrafts" | "handleLoadServerDraftToPos"
  | "handleQuickConfirmServerDraft" | "handleDeleteServerDraft"
> & {
  onOpenInvoice: (order: Order) => void;
};

export function SavedDraftsPanel({
  posSubView,
  savedDraftOrders,
  setPosSubView,
  loadingSavedDrafts,
  editingServerDraftOrder,
  liveDrafts,
  handleLoadServerDraftToPos,
  handleQuickConfirmServerDraft,
  onOpenInvoice,
  handleDeleteServerDraft,
}: SavedDraftsPanelProps) {
  return (
    <>
      {posSubView === "DRAFTS" && (
                  <div className="flex-1 bg-white rounded-xl shadow-xs border border-amber-200 p-3.5 space-y-3 overflow-y-auto">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-600" />
                        <h3 className="text-xs sm:text-sm font-extrabold uppercase text-slate-900">
                          Hóa đơn nháp đã lưu trên hệ thống (
                          {savedDraftOrders.length})
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPosSubView("FAST")}
                        className="text-xs font-bold text-brand-ink hover:underline"
                      >
                        ← Quay lại giỏ hàng
                      </button>
                    </div>

                    {loadingSavedDrafts ? (
                      <div className="py-8 text-center text-xs text-slate-500">
                        Đang tải danh sách bản nháp...
                      </div>
                    ) : savedDraftOrders.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                        Chưa có hóa đơn nháp nào được lưu.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {savedDraftOrders.map((ord) => {
                          const code = ord.orderCode || ord.code || "";
                          const isBeingEdited =
                            editingServerDraftOrder?._id === ord._id ||
                            liveDrafts.some(
                              (d) => d.editingServerDraftOrder?._id === ord._id
                            );
                          const totalQty = (ord.items || []).reduce(
                            (s, it) => s + (Number(it.quantity) || 0),
                            0
                          );
                          return (
                            <div
                              key={ord._id}
                              className={`p-3 rounded-xl border text-xs space-y-2 transition ${
                                isBeingEdited
                                  ? "border-amber-500 bg-amber-50/70"
                                  : "border-slate-200 bg-slate-50/70 hover:border-amber-300"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-extrabold text-slate-900">
                                    {code}
                                  </span>
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                                    NHÁP
                                  </span>
                                </div>
                                <span className="font-mono font-extrabold text-brand-ink text-sm">
                                  {formatVND(ord.totalAmount)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600">
                                <span>
                                  Khách:{" "}
                                  <strong className="text-slate-800">
                                    {ord.customerName || "Khách lẻ"}
                                  </strong>{" "}
                                  {ord.customerPhone
                                    ? `(${formatPhone(ord.customerPhone)})`
                                    : ""}
                                </span>
                                <span>
                                  {totalQty} SP · {formatDateTime(ord.createdAt)}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-200/80">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleLoadServerDraftToPos(ord);
                                    setPosSubView("FAST");
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 font-bold text-[11px] transition"
                                >
                                  ✏️ Mở sửa trên POS
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleQuickConfirmServerDraft(ord)
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition"
                                >
                                  ✓ Chốt TT
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onOpenInvoice(ord)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[11px] flex items-center gap-1 transition"
                                >
                                  <Printer className="w-3 h-3" /> Bill nháp
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteServerDraft(ord)}
                                  className="ml-auto px-2 py-1 rounded-lg text-red-600 hover:bg-red-50 font-bold text-[11px] flex items-center gap-1 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Xóa
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
    </>
  );
}
