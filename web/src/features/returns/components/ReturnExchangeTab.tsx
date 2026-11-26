"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import { useReturnExchange } from "../hooks/useReturnExchange";
import OrderSearchBox from "./OrderSearchBox";
import OrderInfoHeader from "./OrderInfoHeader";
import ReturnItemsTable from "./ReturnItemsTable";
import ExchangePicker from "./ExchangePicker";
import ExchangeCart from "./ExchangeCart";
import ReturnSummary from "./ReturnSummary";
import RecentReturnsTable from "./RecentReturnsTable";
import ReturnReceiptPrintModal from "./ReturnReceiptPrintModal";

export default function ReturnExchangeTab() {
  const ctx = useReturnExchange();
  const {
    selectedOrder,
    recentReturns,
    mode,
    errorMsg,
    successMsg,
    printableReturn,
    setPrintableReturn,
    handleSubmitReturnExchange,
  } = ctx;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
        Lưu ý: Trên Web POS chỉ hỗ trợ <strong>Đổi hàng</strong>. Trường hợp <strong>Trả hàng hoàn tiền</strong> vui lòng liên hệ Kế toán hoặc Quản lý (thực hiện trên CMS).
      </div>

      {/* Khung tìm đơn hàng gốc */}
      <OrderSearchBox {...ctx} />

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-brand-ink text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Chi tiết xử lý Trả / Đổi khi đã chọn đơn gốc */}
      {selectedOrder && (
        <form
          onSubmit={handleSubmitReturnExchange}
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 sm:p-5 space-y-4 sm:space-y-6"
        >
          {/* Header thông tin đơn gốc */}
          <OrderInfoHeader selectedOrder={selectedOrder} />

          {/* 1. Bảng chọn sản phẩm đổi & tình trạng hàng */}
          <ReturnItemsTable {...ctx} />

          {/* 2. Nếu là ĐỔI HÀNG: Tìm kiếm & chọn sản phẩm mới từ Kho Tầng 1 */}
          {mode === "EXCHANGE" && (
            <div className="space-y-3 bg-blue-50/50 p-3 sm:p-4 rounded-xl border border-blue-200">
              <ExchangePicker {...ctx} />

              {/* Bảng sản phẩm đổi mới đã chọn */}
              <ExchangeCart {...ctx} />
            </div>
          )}

          {/* 3. Hình thức thanh toán hoàn/thu & Tổng kết tiền chênh lệch */}
          <ReturnSummary {...ctx} selectedOrder={selectedOrder} />
        </form>
      )}

      {/* Danh sách phiếu trả/đổi gần đây */}
      <RecentReturnsTable recentReturns={recentReturns} onPrintReturn={(r) => setPrintableReturn(r)} />

      {/* Modal in bill phiếu đổi hàng */}
      <ReturnReceiptPrintModal
        returnReceipt={printableReturn}
        onClose={() => setPrintableReturn(null)}
      />
    </div>
  );
}
