"use client";

import React from "react";
import type { ImportItem, ImportReceipt } from "@/shared/types";
import { useTagCheckScanner } from "../hooks/useTagCheckScanner";
import TagCheckHeader from "./tagCheck/TagCheckHeader";
import TagCheckCameraPanel from "./tagCheck/TagCheckCameraPanel";
import TagCheckItemList from "./tagCheck/TagCheckItemList";

/**
 * Bước 4 — Chụp tag kiểm tra thực tế (ĐẾM TỪNG CHIẾC, TỐI ĐA <= 5 GIÂY)
 * - Mở modal: tự động gửi ping đánh thức server (/health) và duy trì mỗi 8 phút.
 * - Khi bấm chụp:
 *   1) Cắt vùng khung ngắm trung tâm & nén JPEG <= 960px (quality 0.8, ~60-110KB).
 *   2) Dùng BarcodeDetector (nếu trình duyệt hỗ trợ) đọc mã vạch EAN-13/Code-128 trong ~30ms.
 *      Nếu mã vạch đã được ghi nhớ trên dòng hàng -> gửi mỗi mã vạch, khớp tức thì (~0.1s).
 *   3) Gọi 1 request duy nhất POST /imports/:id/scan-tag (gộp OCR + đối chiếu + đếm chiếc, hạn chót <= 5s).
 */
interface TagCheckScannerModalProps {
  receiptId: string;
  items: ImportItem[];
  onReceiptUpdate: (receipt: ImportReceipt) => void;
  onClose: () => void;
}

export default function TagCheckScannerModal(props: TagCheckScannerModalProps) {
  const s = useTagCheckScanner(props);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[96vh]">
        <TagCheckHeader
          percent={s.percent}
          scannedUnits={s.scannedUnits}
          expectedUnits={s.expectedUnits}
          fullRows={s.fullRows}
          totalRows={s.totalRows}
          onClose={s.closeModal}
        />

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-5 gap-4">
          <TagCheckCameraPanel s={s} />
          <TagCheckItemList
            items={props.items}
            allDone={s.allDone}
            totalRows={s.totalRows}
            scannedUnits={s.scannedUnits}
            expectedUnits={s.expectedUnits}
            highlightIndex={s.highlightIndex}
            busy={s.busy}
            onRowAction={s.runRowAction}
          />
        </div>

        <div className="border-t border-slate-200 px-3 sm:px-5 py-3 flex justify-end">
          <button
            type="button"
            onClick={s.closeModal}
            className={`w-full sm:w-auto px-6 min-h-[44px] rounded-xl font-extrabold text-sm ${
              s.allDone ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-slate-200 text-slate-900"
            }`}
          >
            {s.allDone ? "Xong — Đóng & Hoàn thành nhập kho" : "Đóng (tiếp tục sau)"}
          </button>
        </div>
      </div>
    </div>
  );
}
