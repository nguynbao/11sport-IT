import { Search } from "lucide-react";
import type { ReturnCtx } from "./returnCtx";

type Props = Pick<ReturnCtx, "orderCodeInput" | "setOrderCodeInput" | "handleSearchOrder" | "loading" | "matchingRecentOrders" | "prepareOrderForReturn">;

export default function OrderSearchBox({ orderCodeInput, setOrderCodeInput, handleSearchOrder, loading, matchingRecentOrders, prepareOrderForReturn }: Props) {
  return (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5">
    <h2 className="text-base sm:text-lg font-bold text-slate-900">
      Đổi Hàng Tại Quầy (BR-15, BR-16)
    </h2>
    <p className="text-xs text-slate-500 mt-0.5">
      Nhập mã đơn hàng cần đổi sang sản phẩm mới. Hệ thống kiểm tra số lượng đã mua/đã đổi, cộng lại kho cho hàng{" "}
      <strong>Còn bán được (GOOD)</strong> và tự động tính chênh lệch giá khi đổi sản phẩm.
    </p>

    <form onSubmit={handleSearchOrder} className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
      <div className="relative w-full sm:flex-1 sm:max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={orderCodeInput}
          onChange={(e) => setOrderCodeInput(e.target.value)}
          placeholder="Nhập Mã đơn hàng gốc (VD: HD-0162)..."
          className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 font-mono text-sm focus:border-blue-600 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm"
      >
        {loading ? "Đang kiểm tra..." : "Kiểm tra Đơn hàng"}
      </button>
    </form>

    {/* Chọn nhanh từ các đơn gần đây (hoặc khớp từ khóa đang gõ) */}
    {matchingRecentOrders.length > 0 && (
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500">
          {orderCodeInput.trim() ? "Đơn hàng khớp tìm kiếm:" : "Chọn nhanh đơn hàng gần đây:"}
        </span>
        {matchingRecentOrders.map((o) => {
          const code = o.orderCode || o.code || o._id;
          return (
            <button
              key={o._id}
              type="button"
              onClick={() => prepareOrderForReturn(o)}
              className="min-h-[36px] max-w-full truncate px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-brand-ink text-xs font-mono font-bold text-slate-700"
            >
              {code} ({o.customerName})
            </button>
          );
        })}
      </div>
    )}
  </div>
  );
}
