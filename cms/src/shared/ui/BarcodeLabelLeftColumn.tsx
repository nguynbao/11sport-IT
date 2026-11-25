"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchFirstOkJson } from "@/shared/api/localFetch";
import { Product } from "@/shared/types";
import { apiRequest } from "@/shared/api/client";
import { formatNumberDots, parseNumberDots } from "@/shared/utils/format";
import { generateVariantProductCode, toCompactBarcode128 } from "@/shared/utils/productCode";
import {
  Printer,
  X,
  Plus,
  Minus,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Usb,
  Layers,
  MonitorCheck
} from "lucide-react";
import { BarcodeLabelViewModel } from "./useBarcodeLabelModal";
import { BarcodeLabelItemList } from "./BarcodeLabelItemList";
import { sanitizeAscii } from "./barcodeLabelCode128";

export function BarcodeLabelLeftColumn({ vm }: { vm: BarcodeLabelViewModel }) {
  const {
    title,
    shopName,
    normalizedItems,
    quantities,
    setQuantities,
    setCustomPrices,
    showPrice,
    setShowPrice,
    showShopName,
    setShowShopName,
    showProductName,
    setShowProductName,
    nameFontSizePx,
    setNameFontSizePx,
    wrapProductName,
    setWrapProductName,
    getEffectiveNameFontPx,
    printers,
    selectedPrinter,
    isScanningPrinters,
    fetchPrintersList,
    getEffectiveItemPrice,
    currentPrinterObj,
    totalLabels,
    updateQty,
    setExactQty,
    handleSelectPrinter,
    previewItem,
  } = vm;

  return (
    <>
          {/* Left column: Printer + Options + Product list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* 1. KẾT NỐI MÁY IN */}
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

            {/* 2. Tuỳ chọn hiển thị & Cỡ chữ tên sản phẩm */}
            <div
              style={{
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: "10px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 10
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 10
                }}
              >
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#1e293b",
                      cursor: "pointer"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={showShopName}
                      onChange={(e) => setShowShopName(e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: "#0284c7" }}
                    />
                    In tên cửa hàng ({shopName})
                  </label>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#1e293b",
                      cursor: "pointer"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={showProductName}
                      onChange={(e) => setShowProductName(e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: "#0284c7" }}
                    />
                    In tên sản phẩm
                  </label>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#1e293b",
                      cursor: "pointer"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={showPrice}
                      onChange={(e) => setShowPrice(e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: "#0284c7" }}
                    />
                    In giá niêm yết
                  </label>
                </div>

                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#0284c7",
                    backgroundColor: "#e0f2fe",
                    padding: "3px 8px",
                    borderRadius: 6
                  }}
                >
                  2 tem / hàng (35×20mm)
                </span>
              </div>

              {showProductName && (
                <div
                  style={{
                    paddingTop: 9,
                    borderTop: "1px dashed #cbd5e1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>
                      Cỡ chữ tên SP:
                    </span>
                    {[
                      { label: "Tự động", val: 0 },
                      { label: "Nhỏ", val: 14 },
                      { label: "Vừa", val: 18 },
                      { label: "Lớn", val: 22 }
                    ].map((opt) => {
                      const active = nameFontSizePx === opt.val;
                      return (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setNameFontSizePx(opt.val)}
                          style={{
                            padding: "3px 8px",
                            fontSize: 11.5,
                            fontWeight: 700,
                            borderRadius: 6,
                            border: active ? "1px solid #0284c7" : "1px solid #cbd5e1",
                            backgroundColor: active ? "#0284c7" : "#ffffff",
                            color: active ? "#ffffff" : "#334155",
                            cursor: "pointer"
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}

                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        backgroundColor: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 6,
                        padding: "1px 4px",
                        marginLeft: 2
                      }}
                    >
                      <button
                        type="button"
                        title="Giảm cỡ chữ tên sản phẩm"
                        onClick={() => {
                          const cur =
                            nameFontSizePx > 0
                              ? nameFontSizePx
                              : getEffectiveNameFontPx(previewItem?.name || "", 0);
                          setNameFontSizePx(Math.max(10, cur - 1));
                        }}
                        style={{
                          width: 20,
                          height: 20,
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#334155"
                        }}
                      >
                        <Minus size={12} />
                      </button>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: "#0f172a",
                          minWidth: 36,
                          textAlign: "center"
                        }}
                      >
                        {nameFontSizePx === 0 ? "Auto" : `${nameFontSizePx}px`}
                      </span>
                      <button
                        type="button"
                        title="Tăng cỡ chữ tên sản phẩm"
                        onClick={() => {
                          const cur =
                            nameFontSizePx > 0
                              ? nameFontSizePx
                              : getEffectiveNameFontPx(previewItem?.name || "", 0);
                          setNameFontSizePx(Math.min(26, cur + 1));
                        }}
                        style={{
                          width: 20,
                          height: 20,
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#334155"
                        }}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "#334155",
                      cursor: "pointer"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={wrapProductName}
                      onChange={(e) => setWrapProductName(e.target.checked)}
                      style={{ width: 14, height: 14, accentColor: "#0284c7" }}
                    />
                    Tự xuống 2 dòng khi tên dài
                  </label>
                </div>
              )}
            </div>

            <BarcodeLabelItemList vm={vm} />
          </div>

    </>
  );
}
