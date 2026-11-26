"use client";

import React from "react";
import { toCompactBarcode128 } from "@/shared/utils/productCode";
import type { NormalizedLabelItem } from "./barcodeLabelTypes";
import { getEffectiveNameFontPx } from "./barcodeLabelTypes";
import { renderCode128SvgString, sanitizeAscii } from "./barcodeLabelCode128";

interface BarcodeStickerPreviewProps {
  item: NormalizedLabelItem | undefined;
  indexLabel: string;
  effPrice: number;
  shopName: string;
  showShopName: boolean;
  showProductName: boolean;
  showPrice: boolean;
  wrapProductName: boolean;
  nameFontSizePx: number;
}

export default function BarcodeStickerPreview({
  item,
  indexLabel,
  effPrice,
  shopName,
  showShopName,
  showProductName,
  showPrice,
  wrapProductName,
  nameFontSizePx
}: BarcodeStickerPreviewProps) {
  if (!item) return null;
  const cleanCode = toCompactBarcode128(sanitizeAscii(item.code), 200);
  const effective203Px = getEffectiveNameFontPx(item.name, nameFontSizePx);
  const previewNameFontPx = Math.round(effective203Px * 0.62 * 10) / 10;
  const isTwoLinePreview =
    showProductName && wrapProductName && (item.name || "").trim().length > 18;
  const previewBarHeight = !showProductName ? 58 : isTwoLinePreview ? 34 : 44;

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 132,
        backgroundColor: "#ffffff",
        border: "1.5px dashed #64748b",
        borderRadius: 6,
        padding: "3px 8px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        textAlign: "center",
        boxShadow: "0 4px 10px rgba(0, 0, 0, 0.08)",
        color: "#000000",
        position: "relative"
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          right: 4,
          fontSize: 8.5,
          fontWeight: 700,
          color: "#64748b"
        }}
      >
        {indexLabel}
      </span>

      {showShopName && (
        <div
          style={{
            width: "100%",
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 900,
            lineHeight: 1.05,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            borderBottom: "2px solid #000000",
            paddingBottom: 2
          }}
        >
          {shopName}
        </div>
      )}

      {showProductName && (
        <div
          style={{
            width: "100%",
            flexShrink: 0,
            fontSize: previewNameFontPx,
            fontWeight: 800,
            lineHeight: 1.05,
            ...(wrapProductName
              ? {
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical" as const,
                  whiteSpace: "normal",
                  overflow: "hidden",
                  wordBreak: "break-word" as const
                }
              : {
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                })
          }}
        >
          {item.name}
        </div>
      )}

      <div
        style={{
          width: "88%",
          height: previewBarHeight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
        dangerouslySetInnerHTML={{
          __html: renderCode128SvgString(cleanCode, previewBarHeight)
        }}
      />

      <div
        style={{
          width: "100%",
          flexShrink: 0,
          fontFamily: "Consolas, 'Courier New', monospace",
          fontSize: 10.2,
          fontWeight: 800,
          lineHeight: 1.05,
          letterSpacing: "0.06em",
          whiteSpace: "nowrap",
          overflow: "hidden"
        }}
      >
        {cleanCode}
      </div>

      {showPrice && (
        effPrice > 0 ? (
          <div style={{ width: "100%", flexShrink: 0, fontSize: 15, fontWeight: 900, lineHeight: 1.05 }}>
            {effPrice.toLocaleString("vi-VN")} đ
          </div>
        ) : (
          <div style={{ width: "100%", flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: "#dc2626", lineHeight: 1.05 }}>
            Chưa nhập giá niêm yết
          </div>
        )
      )}
    </div>
  );
}
