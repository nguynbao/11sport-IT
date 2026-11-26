import { Plus, X, ArrowUpDown } from "lucide-react";
import { MAX_DRAFTS } from "../types";
import type { PosCtx } from "../hooks/usePosTab";

type DraftTabsProps = Pick<
  PosCtx,
  "liveDrafts" | "activeDraftId" | "handleSwitchDraft" | "submitting"
  | "handleCloseDraft" | "handleAddDraft"
>;

export function DraftTabs({
  liveDrafts,
  activeDraftId,
  handleSwitchDraft,
  submitting,
  handleCloseDraft,
  handleAddDraft,
}: DraftTabsProps) {
  return (
    <div className="flex items-end gap-1 overflow-x-auto max-w-full pt-1">
                {liveDrafts.map((d) => {
                  const isActive = d.id === activeDraftId;
                  const qty =
                    d.cart.reduce((s, i) => s + i.quantity, 0) +
                    d.giftCart.reduce((s, g) => s + g.quantity, 0);
                  return (
                    <div
                      key={d.id}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => handleSwitchDraft(d.id)}
                      title={
                        submitting
                          ? "Đang tạo đơn, vui lòng chờ..."
                          : `Chuyển sang Hóa đơn ${d.seq}`
                      }
                      className={`group flex items-center gap-2 pl-3 pr-2 py-2 rounded-t-lg text-xs font-extrabold transition shrink-0 ${
                        isActive
                          ? "bg-[#ebedf0] text-slate-900 shadow-xs"
                          : "bg-blue-700 text-white/90 hover:bg-blue-800"
                      } ${
                        submitting && !isActive
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer"
                      }`}
                    >
                      <ArrowUpDown className="w-3 h-3 opacity-75" />
                      <span>Hóa đơn {d.seq}</span>
                      {qty > 0 && (
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                            isActive
                              ? "bg-blue-600 text-white"
                              : "bg-white/20 text-white"
                          }`}
                        >
                          {qty}
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseDraft(d.id);
                        }}
                        title={`Đóng Hóa đơn ${d.seq}`}
                        className={`p-0.5 rounded-full transition ${
                          isActive
                            ? "text-slate-500 hover:bg-slate-300 hover:text-slate-900"
                            : "text-white/70 hover:bg-white/20 hover:text-white"
                        }`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={handleAddDraft}
                  disabled={submitting || liveDrafts.length >= MAX_DRAFTS}
                  title="Tạo thêm hóa đơn mới"
                  className="mb-1.5 ml-1 w-7 h-7 rounded-full border border-white/40 hover:bg-white/20 flex items-center justify-center text-white disabled:opacity-40 transition shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
  );
}
