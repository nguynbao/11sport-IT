"use client";

import {
AlertTriangle,
CheckCircle2,
Layers,
MonitorCheck,
Printer,
Sparkles,
X
} from "lucide-react";
import {
BarcodeLabelItem,
BarcodeLabelModalProps
} from "./barcodeLabelCode128";
import { BarcodeLabelLeftColumn } from "./BarcodeLabelLeftColumn";
import { useBarcodeLabelModal } from "./useBarcodeLabelModal";

export type { BarcodeLabelItem };

export default function BarcodeLabelModal(props: BarcodeLabelModalProps) {
  const vm = useBarcodeLabelModal(props);
  const {
    onClose,
    title,
    selectedPrinter,
    isPrintingDirect,
    printStatusMsg,
    totalLabels,
    totalRows,
    handleDirectWindowsPrint,
    handleBrowserPrintDialog,
    previewItem,
    renderSingleStickerPreview,
  } = vm;

  if (!props.open && !props.isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "rgba(15, 23, 42, 0.72)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 880,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
          overflow: "hidden",
          border: "1px solid #e2e8f0"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 22px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            color: "#ffffff"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: "rgba(56, 189, 248, 0.15)",
                border: "1px solid rgba(56, 189, 248, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#38bdf8"
              }}
            >
              <Printer size={19} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>{title}</h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>
                Cấu hình cố định: Khổ 2 cột 70 × 20 mm (2 tem 35×20mm / hàng) • Chuẩn 203 DPI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              color: "#fff",
              width: 32,
              height: 32,
              borderRadius: 8,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-4 p-3.5 sm:p-5 overflow-y-auto">
      <BarcodeLabelLeftColumn vm={vm} />
          {/* Right column: 2-Column 70x20mm Live Preview + Status */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                alignItems: "center"
              }}
            >
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10
                }}
              >
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: "#475569",
                    textTransform: "uppercase"
                  }}
                >
                  Xem trước 1 hàng 2 cột (70 × 20 mm)
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "#0284c7",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  <Sparkles size={12} /> 2 tem 35×20mm
                </span>
              </div>

              {previewItem ? (
                <div
                  style={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    padding: "10px",
                    backgroundColor: "#e2e8f0",
                    borderRadius: 10
                  }}
                >
                  {renderSingleStickerPreview(previewItem, "Cột 1")}
                  {renderSingleStickerPreview(previewItem, "Cột 2")}
                </div>
              ) : (
                <div style={{ padding: 24, color: "#94a3b8", fontSize: 13 }}>
                  Chưa có sản phẩm để xem trước
                </div>
              )}
            </div>

            {/* Print Status Feedback */}
            {printStatusMsg && (
              <div
                style={{
                  padding: "11px 13px",
                  borderRadius: 12,
                  fontSize: 12.5,
                  fontWeight: 600,
                  lineHeight: 1.45,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  backgroundColor:
                    printStatusMsg.type === "success"
                      ? "#dcfce7"
                      : printStatusMsg.type === "error"
                        ? "#fee2e2"
                        : "#e0f2fe",
                  border:
                    printStatusMsg.type === "success"
                      ? "1px solid #86efac"
                      : printStatusMsg.type === "error"
                        ? "1px solid #fca5a5"
                        : "1px solid #7dd3fc",
                  color:
                    printStatusMsg.type === "success"
                      ? "#14532d"
                      : printStatusMsg.type === "error"
                        ? "#7f1d1d"
                        : "#0c4a6e"
                }}
              >
                {printStatusMsg.type === "success" ? (
                  <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                ) : (
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                )}
                <span>{printStatusMsg.text}</span>
              </div>
            )}

            {/* Info Box */}
            <div
              style={{
                backgroundColor: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 12,
                padding: 12,
                fontSize: 11.5,
                color: "#1e3a8a",
                lineHeight: 1.5
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  marginBottom: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: "#1d4ed8"
                }}
              >
                <MonitorCheck size={14} />
                Đã cố định chuẩn máy in 2 cột 70 × 20 mm (Chống tràn & Chống mất mã):
              </div>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                <li>
                  Mỗi hàng giấy in song song <strong>2 tem (Trái 34mm – Khe giữa 2mm – Phải 34mm)</strong>, tự động bù lề cứng Driver và khóa vùng vẽ riêng từng tem.
                </li>
                <li>
                  Mã vạch chuẩn <strong>1-bit 203 DPI nguyên bản</strong> với vùng trắng tĩnh (Quiet Zone) <strong>≥ 4.0mm hai bên</strong> giúp khi bóc dán lên sản phẩm bất kỳ máy quét nào cũng bắt nhạy tức thì.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 22px",
            borderTop: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12
          }}
        >
          <div style={{ fontSize: 13, color: "#475569" }}>
            Tổng số lượng in:{" "}
            <strong style={{ color: "#0f172a", fontSize: 15 }}>{totalLabels} tem</strong> (
            <strong>{totalRows} hàng</strong> giấy 70×20mm)
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 15px",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: "#334155",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Đóng
            </button>

            <button
              type="button"
              disabled={totalLabels <= 0}
              onClick={handleBrowserPrintDialog}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid #0284c7",
                backgroundColor: "#f0f9ff",
                color: "#0369a1",
                fontSize: 13,
                fontWeight: 700,
                cursor: totalLabels > 0 ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <Layers size={15} />
              In qua trình duyệt (Ctrl+P)
            </button>

            <button
              type="button"
              disabled={totalLabels <= 0 || isPrintingDirect}
              onClick={handleDirectWindowsPrint}
              style={{
                padding: "9px 18px",
                borderRadius: 10,
                border: "none",
                background:
                  totalLabels > 0
                    ? "linear-gradient(135deg, #16a34a 0%, #15803d 100%)"
                    : "#94a3b8",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 700,
                cursor: totalLabels > 0 && !isPrintingDirect ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow:
                  totalLabels > 0 ? "0 4px 12px rgba(22, 163, 74, 0.35)" : "none"
              }}
            >
              <Printer size={16} />
              {isPrintingDirect
                ? "Đang gửi lệnh in..."
                : selectedPrinter
                  ? `In thẳng ra ${selectedPrinter} (${totalLabels} tem)`
                  : `In ngay (${totalLabels} tem)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
