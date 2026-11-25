"use client";

import React from "react";
import { Plus, Minus } from "lucide-react";
import { formatNumberDots, parseNumberDots } from "@/shared/utils/format";
import { toCompactBarcode128 } from "@/shared/utils/productCode";
import { sanitizeAscii } from "./barcodeLabelCode128";
import { BarcodeLabelViewModel } from "./useBarcodeLabelModal";

export function BarcodeLabelItemList({ vm }: { vm: BarcodeLabelViewModel }) {
  const {
    normalizedItems,
    quantities,
    setQuantities,
    setCustomPrices,
    getEffectiveItemPrice,
    totalLabels,
    updateQty,
    setExactQty,
  } = vm;

  return (
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  padding: "9px 14px",
                  backgroundColor: "#f1f5f9",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#334155"
                }}
              >
                <span>DANH SÁCH SẢN PHẨM ({normalizedItems.length})</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      const next: Record<string, number> = {};
                      normalizedItems.forEach((it) => {
                        next[it.id] = 2;
                      });
                      setQuantities(next);
                    }}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#0284c7",
                      background: "#e0f2fe",
                      border: "none",
                      borderRadius: 6,
                      padding: "3px 8px",
                      cursor: "pointer"
                    }}
                  >
                    Đặt tất cả = 2 (1 hàng)
                  </button>
                  <span>Tổng: {totalLabels} tem</span>
                </div>
              </div>

              <div style={{ maxHeight: 250, overflowY: "auto" }}>
                {normalizedItems.map((item) => {
                  const qty = quantities[item.id] || 0;
                  const effPrice = getEffectiveItemPrice(item);
                  const compactCode = toCompactBarcode128(sanitizeAscii(item.code), 200);
                  return (
                    <div
                      key={item.id}
                      style={{
                        padding: "10px 14px",
                        borderBottom: "1px solid #f1f5f9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        backgroundColor: qty > 0 ? "#ffffff" : "#f8fafc"
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#0f172a",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis"
                          }}
                        >
                          {item.name}
                          {item.attrLabel ? (
                            <span style={{ color: "#4338ca", fontWeight: 700, marginLeft: 6, fontSize: 12 }}>
                              ({item.attrLabel})
                            </span>
                          ) : null}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#64748b",
                            display: "flex",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 8,
                            marginTop: 3
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontWeight: 700,
                              color: "#0369a1",
                              backgroundColor: "#e0f2fe",
                              padding: "1px 6px",
                              borderRadius: 4
                            }}
                            title={compactCode !== item.code ? `Mã gốc đầy đủ: ${item.code}` : undefined}
                          >
                            {compactCode}
                          </span>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>Giá:</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={effPrice > 0 ? formatNumberDots(effPrice) : ""}
                              placeholder="Nhập giá niêm yết..."
                              onChange={(e) => {
                                const nextVal = parseNumberDots(e.target.value);
                                setCustomPrices((prev) => ({
                                  ...prev,
                                  [item.id]: nextVal,
                                }));
                              }}
                              style={{
                                width: 92,
                                padding: "2px 6px",
                                borderRadius: 5,
                                border: effPrice > 0 ? "1px solid #cbd5e1" : "1px solid #f59e0b",
                                backgroundColor: effPrice > 0 ? "#ffffff" : "#fffbeb",
                                color: effPrice > 0 ? "#0f172a" : "#b45309",
                                fontFamily: "monospace",
                                fontSize: 11.5,
                                fontWeight: 700,
                                textAlign: "right"
                              }}
                            />
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a" }}>đ</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, -1)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            border: "1px solid #cbd5e1",
                            background: "#fff",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={500}
                          value={qty}
                          onChange={(e) => setExactQty(item.id, parseInt(e.target.value, 10))}
                          style={{
                            width: 52,
                            height: 28,
                            textAlign: "center",
                            border: "1px solid #cbd5e1",
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 700
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, 1)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            border: "1px solid #cbd5e1",
                            background: "#fff",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
  );
}
