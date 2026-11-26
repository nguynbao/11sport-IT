"use client";

import React from "react";
import { Usb, RefreshCw } from "lucide-react";
import type { SystemPrinterInfo } from "./barcodeLabelTypes";

interface BarcodePrinterPanelProps {
  printers: SystemPrinterInfo[];
  selectedPrinter: string;
  currentPrinterObj: SystemPrinterInfo | null;
  isScanningPrinters: boolean;
  fetchPrintersList: () => void;
  handleSelectPrinter: (name: string) => void;
}

export default function BarcodePrinterPanel({
  printers,
  selectedPrinter,
  currentPrinterObj,
  isScanningPrinters,
  fetchPrintersList,
  handleSelectPrinter
}: BarcodePrinterPanelProps) {
  return (
  <div
    style={{
      backgroundColor: "#f0fdf4",
      border: "1.5px solid #86efac",
      borderRadius: 12,
      padding: 12
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: "#14532d",
          textTransform: "uppercase",
          display: "flex",
          alignItems: "center",
          gap: 6
        }}
      >
        <Usb size={14} color="#16a34a" />
        Máy in tem nhiệt (Khổ 2 cột 70 × 20 mm)
      </div>
      <button
        type="button"
        onClick={fetchPrintersList}
        disabled={isScanningPrinters}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontSize: 11,
          fontWeight: 700,
          color: "#15803d",
          backgroundColor: "#dcfce7",
          border: "1px solid #86efac",
          borderRadius: 6,
          padding: "3px 8px",
          cursor: isScanningPrinters ? "wait" : "pointer"
        }}
      >
        <RefreshCw size={11} className={isScanningPrinters ? "animate-spin" : ""} />
        {isScanningPrinters ? "Đang quét..." : "Quét lại"}
      </button>
    </div>

    {printers.length > 0 ? (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <select
          value={selectedPrinter}
          onChange={(e) => handleSelectPrinter(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1.5px solid #22c55e",
            backgroundColor: "#ffffff",
            fontSize: 13,
            fontWeight: 700,
            color: "#0f172a",
            outline: "none",
            cursor: "pointer"
          }}
        >
          {printers.map((p) => (
            <option key={p.Name} value={p.Name}>
              {p.IsOnline ? "🟢 [ĐANG BẬT]" : "⚪ [OFFLINE]"} {p.Name} ({p.PortName})
              {p.IsThermal ? " — Máy in tem nhiệt" : ""}
            </option>
          ))}
        </select>

        {currentPrinterObj && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 11,
              color: currentPrinterObj.IsOnline ? "#15803d" : "#b45309",
              backgroundColor: currentPrinterObj.IsOnline ? "#dcfce7" : "#fef3c7",
              padding: "5px 9px",
              borderRadius: 6,
              fontWeight: 600
            }}
          >
            <span>
              Cổng: <strong>{currentPrinterObj.PortName}</strong> • Khổ:{" "}
              <strong>70×20mm (2 cột)</strong>
            </span>
            <span>
              {currentPrinterObj.IsOnline ? "✓ Sẵn sàng in" : "⚠ Offline"}
            </span>
          </div>
        )}
      </div>
    ) : (
      <div
        style={{
          fontSize: 12,
          color: "#475569",
          backgroundColor: "#ffffff",
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px dashed #cbd5e1"
        }}
      >
        {isScanningPrinters
          ? "Đang tìm máy in Xprinter trên thiết bị..."
          : "Nếu dùng trên máy tính khác, hãy chạy file KetNoiMayInTem-11Sport.bat hoặc bấm 'In qua trình duyệt (Ctrl+P)'."}
      </div>
    )}
  </div>
  );
}
