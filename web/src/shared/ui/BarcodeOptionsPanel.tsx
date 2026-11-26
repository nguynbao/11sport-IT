"use client";

import React from "react";
import { Plus, Minus } from "lucide-react";
import { getEffectiveNameFontPx } from "./barcodeLabelTypes";

interface BarcodeOptionsPanelProps {
  shopName: string;
  showShopName: boolean;
  setShowShopName: (v: boolean) => void;
  showProductName: boolean;
  setShowProductName: (v: boolean) => void;
  showPrice: boolean;
  setShowPrice: (v: boolean) => void;
  nameFontSizePx: number;
  setNameFontSizePx: (v: number) => void;
  wrapProductName: boolean;
  setWrapProductName: (v: boolean) => void;
  previewItemName: string | undefined;
}

export default function BarcodeOptionsPanel({
  shopName,
  showShopName,
  setShowShopName,
  showProductName,
  setShowProductName,
  showPrice,
  setShowPrice,
  nameFontSizePx,
  setNameFontSizePx,
  wrapProductName,
  setWrapProductName,
  previewItemName
}: BarcodeOptionsPanelProps) {
  return (
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
                    : getEffectiveNameFontPx(previewItemName || "", 0);
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
                    : getEffectiveNameFontPx(previewItemName || "", 0);
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
  );
}
