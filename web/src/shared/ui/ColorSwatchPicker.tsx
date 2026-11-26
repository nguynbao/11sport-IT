"use client";

import React, { useState, useRef, useEffect } from "react";
import { Palette, Check, X, Plus } from "lucide-react";

import {
  SPORT_COLOR_PALETTE,
  getColorBoxBorderStyle,
  sanitizeHexList,
  inferColorHexesFromText,
  resolveVariantColorHexes,
} from "./colorPalette";
export type { SportColorPreset } from "./colorPalette";
export {
  SPORT_COLOR_PALETTE,
  sanitizeHexList,
  inferColorHexesFromText,
  resolveVariantColorHexes,
  getColorBoxBorderStyle,
} from "./colorPalette";

/**
 * Ô vuông nhỏ hiển thị 1 hoặc nhiều màu cạnh tên màu (chia vạch màu trực quan)
 */
export function ColorSwatchBadge({
  hexes,
  colorName,
  size = "sm",
}: {
  hexes?: string[];
  colorName?: string;
  size?: "xs" | "sm" | "md";
}) {
  const resolved = resolveVariantColorHexes(colorName, hexes);
  if (resolved.length === 0) {
    return (
      <span
        className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0 inline-block"
        title={colorName || "Mặc định"}
      />
    );
  }

  const sizeCls =
    size === "xs"
      ? "w-3.5 h-3.5 rounded-[3px]"
      : size === "md"
        ? "w-5 h-5 rounded-md"
        : "w-4 h-4 rounded";

  return (
    <span
      title={
        colorName
          ? `${colorName} (${resolved.length} màu: ${resolved.join(", ")})`
          : `${resolved.length} màu: ${resolved.join(", ")}`
      }
      className={`inline-flex overflow-hidden border border-slate-400/80 shadow-2xs shrink-0 align-middle ${sizeCls}`}
    >
      {resolved.map((hex, i) => (
        <span
          key={`${hex}-${i}`}
          className="flex-1 h-full"
          style={{
            backgroundColor: hex,
            borderLeft: i > 0 ? "1px solid rgba(15,23,42,0.15)" : undefined,
          }}
        />
      ))}
    </span>
  );
}

/**
 * Ô nhập Màu sắc tích hợp nút nhỏ chọn 1 hoặc nhiều màu trực quan + viền (border) theo màu đã chọn.
 */
export function ColorInputWithPicker({
  value,
  colorHexes,
  onChange,
  disabled = false,
  placeholder = "VD: Đỏ, Trắng/Đen...",
  listId,
  className = "",
  compact = false,
}: {
  value: string;
  colorHexes?: string[];
  onChange: (nextColor: string, nextHexes: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  listId?: string;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [customHex, setCustomHex] = useState("#2563EB");
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const activeHexes = resolveVariantColorHexes(value, colorHexes);
  const explicitHexes = sanitizeHexList(colorHexes);

  const updatePopoverPosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popWidth = 288;
    const popHeight = 330;
    let left = rect.left;
    let top = rect.bottom + 6;
    if (typeof window !== "undefined") {
      if (left + popWidth > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - popWidth - 12);
      }
      if (top + popHeight > window.innerHeight - 12 && rect.top > popHeight) {
        top = rect.top - popHeight - 6;
      }
    }
    setPopoverPos({ top, left });
  };

  useEffect(() => {
    if (!open) return;
    updatePopoverPosition();
    const handleOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleScrollOrResize = () => updatePopoverPosition();
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open]);

  const buildPaletteColorLabel = (hexList: string[]): string => {
    return hexList
      .map((h) => {
        const found = SPORT_COLOR_PALETTE.find((p) => p.hex.toUpperCase() === h.toUpperCase());
        return found ? found.name.split("/")[0].trim() : h;
      })
      .join("/");
  };

  const handleToggleHex = (hex: string) => {
    const cleanHex = hex.toUpperCase();
    const currentList = explicitHexes.length > 0 ? explicitHexes : activeHexes;
    const prevAutoLabel = buildPaletteColorLabel(currentList);
    const exists = currentList.includes(cleanHex);
    const nextHexes = exists
      ? currentList.filter((h) => h !== cleanHex)
      : [...currentList, cleanHex];

    const trimmedVal = String(value || "").trim();
    const shouldAutoFillName =
      !trimmedVal ||
      trimmedVal.toLowerCase() === prevAutoLabel.toLowerCase();

    const nextColorName = shouldAutoFillName ? buildPaletteColorLabel(nextHexes) : value;
    onChange(nextColorName, nextHexes);
  };

  const handleTextChange = (nextText: string) => {
    if (!nextText.trim()) {
      onChange("", []);
      return;
    }
    const prevInferred = inferColorHexesFromText(value);
    const inferred = inferColorHexesFromText(nextText);
    const isPrevAutoInferred =
      explicitHexes.length === 0 ||
      explicitHexes.join(",") === prevInferred.join(",");
    const nextHexes =
      isPrevAutoInferred || inferred.length > explicitHexes.length
        ? inferred.length > 0
          ? inferred
          : explicitHexes
        : explicitHexes;
    onChange(nextText, nextHexes);
  };

  const boxBorderStyle = getColorBoxBorderStyle(activeHexes, disabled ? "#f1f5f9" : "#ffffff", 2);

  return (
    <div className={`relative ${className}`}>
      <div
        style={boxBorderStyle}
        className={`flex items-center gap-1 rounded border transition ${
          activeHexes.length === 0
            ? "border-slate-300 focus-within:border-blue-600 bg-white"
            : ""
        } ${disabled ? "bg-slate-100 opacity-80" : "bg-white"} ${
          compact ? "px-1.5 py-0.5" : "px-1.5 py-1"
        }`}
      >
        {/* Ô nhỏ chọn 1 hoặc nhiều màu hiển thị trực quan */}
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          title={
            activeHexes.length > 0
              ? `Đang chọn ${activeHexes.length} màu (${activeHexes.join(", ")}) — Bấm để chọn 1 hoặc nhiều màu`
              : "Bấm để chọn 1 hoặc nhiều màu hiển thị trực quan"
          }
          className="relative flex items-center justify-center w-6 h-6 rounded border border-slate-300 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50 shrink-0 transition cursor-pointer overflow-hidden shadow-2xs"
        >
          {activeHexes.length > 0 ? (
            <span className="flex w-full h-full">
              {activeHexes.map((hex, i) => (
                <span
                  key={`${hex}-${i}`}
                  className="flex-1 h-full"
                  style={{
                    backgroundColor: hex,
                    borderLeft: i > 0 ? "1px solid rgba(15,23,42,0.2)" : undefined,
                  }}
                />
              ))}
            </span>
          ) : (
            <Palette className="w-3.5 h-3.5 text-slate-500" />
          )}
        </button>

        <input
          type="text"
          list={listId}
          disabled={disabled}
          value={value || ""}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={placeholder}
          className="w-full min-w-[70px] bg-transparent text-xs font-semibold text-slate-900 focus:outline-none disabled:text-slate-500"
        />
      </div>

      {/* Popover bảng chọn 1 hoặc nhiều màu */}
      {open && !disabled && (
        <div
          ref={popoverRef}
          style={{ top: popoverPos.top, left: popoverPos.left }}
          className="fixed z-[9999] w-72 bg-white rounded-xl border-2 border-slate-800 shadow-2xl p-3 space-y-2.5 text-left"
        >
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
            <div>
              <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-brand-ink" />
                <span>Chọn 1 hoặc nhiều màu</span>
              </div>
              <div className="text-[10px] text-slate-500">
                Bấm chọn nhiều ô để phối màu &amp; tạo viền box
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Xem trước box viền màu trực quan */}
          <div
            style={getColorBoxBorderStyle(activeHexes, "var(--box-bg, #f8fafc)", 2)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 flex items-center justify-between gap-2 bg-slate-50"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <ColorSwatchBadge hexes={activeHexes} colorName={value} size="sm" />
              <span className="text-xs font-extrabold text-slate-800 truncate">
                {value || "Chưa nhập tên màu"}
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-500 shrink-0">
              {activeHexes.length} màu
            </span>
          </div>

          {/* Lưới 18 màu thể thao phổ biến */}
          <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-0.5">
            {SPORT_COLOR_PALETTE.map((preset) => {
              const isSelected = activeHexes.includes(preset.hex.toUpperCase());
              return (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => handleToggleHex(preset.hex)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                    isSelected
                      ? "bg-indigo-50 border-indigo-600 text-indigo-950 ring-1 ring-indigo-500"
                      : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded border border-slate-400/80 shrink-0 flex items-center justify-center relative"
                    style={{ backgroundColor: preset.hex }}
                  >
                    {isSelected && (
                      <Check
                        className={`w-3 h-3 stroke-[3] ${
                          preset.hex === "#FFFFFF" ||
                          preset.hex === "#EAE0C8" ||
                          preset.hex === "#EAB308"
                            ? "text-slate-900"
                            : "text-white"
                        }`}
                      />
                    )}
                  </span>
                  <span className="truncate flex-1 text-left leading-tight">
                    {preset.name.split("/")[0].trim()}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Chọn thêm mã màu tùy chỉnh & thao tác nhanh */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={customHex}
                onChange={(e) => setCustomHex(e.target.value.toUpperCase())}
                className="w-6 h-6 rounded border border-slate-300 cursor-pointer p-0 bg-transparent"
                title="Chọn màu tùy chỉnh bất kỳ"
              />
              <button
                type="button"
                onClick={() => handleToggleHex(customHex)}
                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Thêm màu khác
              </button>
            </div>

            <div className="flex items-center gap-1">
              {activeHexes.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => onChange(buildPaletteColorLabel(activeHexes), activeHexes)}
                    className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-brand-ink text-[10px] font-bold"
                    title="Điền tên màu theo các ô màu đã chọn"
                  >
                    Điền tên
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(value, [])}
                    className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-bold"
                    title="Xóa các màu đã chọn"
                  >
                    Xóa màu
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
