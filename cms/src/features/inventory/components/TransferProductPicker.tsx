"use client";

import {
ColorInputWithPicker,
ColorSwatchBadge,
getColorBoxBorderStyle,
resolveVariantColorHexes,
} from "@/shared/ui/ColorSwatchPicker";
import {
Plus,
Search,
X
} from "lucide-react";
import { InventoryViewModel } from "../hooks/useInventoryModule";


export function TransferProductPicker({ vm }: { vm: InventoryViewModel }) {
  const {
    products,
    transferDirection,
    transferProductId,
    setTransferProductId,
    transferColor,
    setTransferColor,
    transferSize,
    setTransferSize,
    transferQty,
    setTransferQty,
    transferSearch,
    setTransferSearch,
    transferSuggestOpen,
    setTransferSuggestOpen,
    sourceFloorProducts,
    getSourceFloorStock,
    getVariantSourceFloorStock,
    getProductSourceVariants,
    handleSelectTransferProduct,
    handleAddTransferItem,
  } = vm;

  return (
    <>
            {/* BƯỚC 2: TÌM NHANH & THÊM SẢN PHẨM VÀO PHIẾU (KHÔNG ĐỔ LIST DÀI) */}
            {(() => {
              const activeTransferProdId = transferProductId;
              const selectedTransferProd = activeTransferProdId
                ? products.find((p) => p._id === activeTransferProdId)
                : undefined;
              const availVars = getProductSourceVariants(selectedTransferProd);
              const effectiveColor =
                transferColor ||
                (availVars.length > 0 && !transferSize
                  ? availVars[0].color || ""
                  : "");
              const effectiveSize =
                transferSize ||
                (availVars.length > 0 && !transferColor
                  ? availVars[0].size || ""
                  : "");

              const uniqueColorOptions: Array<{ color: string; totalStock: number }> = [];
              for (const v of availVars) {
                const cName = String(v.color || "").trim();
                const existingColor = uniqueColorOptions.find(
                  (c) => c.color.toLowerCase() === cName.toLowerCase()
                );
                const vStock = getVariantSourceFloorStock(v);
                if (existingColor) existingColor.totalStock += vStock;
                else uniqueColorOptions.push({ color: cName, totalStock: vStock });
              }

              const varsForSelectedColor =
                availVars.filter(
                  (v) =>
                    String(v.color || "").trim().toLowerCase() ===
                    String(effectiveColor || "").trim().toLowerCase()
                ).length > 0
                  ? availVars.filter(
                    (v) =>
                      String(v.color || "").trim().toLowerCase() ===
                      String(effectiveColor || "").trim().toLowerCase()
                  )
                  : availVars;

              const quickSuggestions = sourceFloorProducts.slice(0, 12);

              return (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                  <datalist id="transfer-size-presets">
                    {["S", "M", "L", "XL", "XXL", "36", "37", "38", "39", "40", "41", "42", "43", "44"].map(
                      (sz) => (
                        <option key={sz} value={sz} />
                      )
                    )}
                  </datalist>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                    {/* Ô tìm kiếm thông minh có dropdown gợi ý */}
                    <div className="md:col-span-5 relative">
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                        Tìm &amp; chọn SP tại {transferDirection === "F1_TO_F2" ? "Kho Tầng 1" : "Kho Tầng 2"}
                      </label>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={transferSearch}
                          onFocus={() => setTransferSuggestOpen(true)}
                          onBlur={() => setTimeout(() => setTransferSuggestOpen(false), 180)}
                          onChange={(e) => {
                            setTransferSearch(e.target.value);
                            setTransferSuggestOpen(true);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (quickSuggestions.length > 0) {
                                const first = quickSuggestions[0];
                                handleSelectTransferProduct(first._id);
                                setTransferSearch(`${first.name} (${first.code})`);
                                setTransferSuggestOpen(false);
                              }
                            }
                          }}
                          placeholder={
                            selectedTransferProd
                              ? `${selectedTransferProd.name} (${selectedTransferProd.code})`
                              : "Gõ tên, mã gốc hoặc mã con..."
                          }
                          className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold focus:outline-none focus:border-teal-500"
                        />
                        {(transferSearch || transferProductId) && (
                          <button
                            type="button"
                            onClick={() => {
                              setTransferSearch("");
                              setTransferProductId("");
                              setTransferColor("");
                              setTransferSize("");
                              setTransferSuggestOpen(true);
                            }}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700"
                            title="Xóa lựa chọn"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {transferSuggestOpen && (
                        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100">
                          {quickSuggestions.length === 0 ? (
                            <div className="p-3 text-xs text-slate-400 text-center">
                              Không tìm thấy sản phẩm còn tồn ở kho đầu dời.
                            </div>
                          ) : (
                            quickSuggestions.map((p) => {
                              const avail = getSourceFloorStock(p);
                              const isPicked = p._id === activeTransferProdId;
                              return (
                                <button
                                  key={p._id}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectTransferProduct(p._id);
                                    setTransferSearch(`${p.name} (${p.code})`);
                                    setTransferSuggestOpen(false);
                                  }}
                                  className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 hover:bg-teal-50 transition ${
                                    isPicked ? "bg-teal-50/80" : ""
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-900 truncate">{p.name}</div>
                                    <div className="font-mono text-[10px] text-slate-500">{p.code}</div>
                                  </div>
                                  <span className="px-2 py-0.5 rounded bg-teal-100 text-brand-ink font-mono font-bold text-[11px] shrink-0">
                                    Tồn: {avail} {p.unit}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold uppercase text-brand-ink mb-1">
                        Màu sắc
                      </label>
                      {uniqueColorOptions.length > 0 ? (
                        <select
                          value={String(effectiveColor || "").trim().toLowerCase()}
                          onChange={(e) => {
                            const nextColorLower = e.target.value;
                            const matchedColorVars = availVars.filter(
                              (v) =>
                                String(v.color || "").trim().toLowerCase() ===
                                nextColorLower
                            );
                            if (matchedColorVars.length > 0) {
                              setTransferColor(matchedColorVars[0].color || "");
                              setTransferSize(matchedColorVars[0].size || "");
                            } else {
                              setTransferColor("");
                              setTransferSize("");
                            }
                          }}
                          className="w-full px-2.5 py-2 rounded-xl border border-indigo-300 text-xs bg-white font-bold text-slate-900"
                        >
                          {uniqueColorOptions.map((cOpt, cIdx) => (
                            <option
                              key={`${cOpt.color}_${cIdx}`}
                              value={cOpt.color.toLowerCase()}
                            >
                              {cOpt.color || "Mặc định"} ({cOpt.totalStock})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <ColorInputWithPicker
                          value={transferColor}
                          onChange={(nextColor) => setTransferColor(nextColor)}
                          placeholder="Màu sắc..."
                        />
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold uppercase text-brand-ink mb-1">
                        Size
                      </label>
                      {varsForSelectedColor.length > 0 ? (
                        <select
                          value={String(effectiveSize || "").trim().toUpperCase()}
                          onChange={(e) => {
                            const nextSizeUpper = e.target.value;
                            const matchedVar = varsForSelectedColor.find(
                              (v) =>
                                String(v.size || "").trim().toUpperCase() ===
                                nextSizeUpper
                            );
                            if (matchedVar) {
                              setTransferColor(matchedVar.color || effectiveColor || "");
                              setTransferSize(matchedVar.size || "");
                            } else {
                              setTransferSize(e.target.value);
                            }
                          }}
                          className="w-full px-2.5 py-2 rounded-xl border border-indigo-300 text-xs bg-white font-mono font-bold text-slate-900"
                        >
                          {varsForSelectedColor.map((v, sIdx) => {
                            const szTrim = String(v.size || "").trim();
                            const szVal = szTrim.toUpperCase();
                            const vStock = getVariantSourceFloorStock(v);
                            return (
                              <option key={`${szVal}_${sIdx}`} value={szVal}>
                                {szTrim ? `${szTrim} (Tồn: ${vStock})` : `Không size (${vStock})`}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <input
                          type="text"
                          list="transfer-size-presets"
                          value={transferSize}
                          onChange={(e) => setTransferSize(e.target.value.toUpperCase())}
                          placeholder="VD: M, L, 41"
                          className="w-full px-2.5 py-2 rounded-xl border border-indigo-300 text-xs bg-white font-mono font-bold uppercase text-slate-900"
                        />
                      )}
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                        SL
                      </label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={transferQty}
                        onChange={(e) =>
                          setTransferQty(Math.max(1, Math.round(Number(e.target.value) || 1)))
                        }
                        className="w-full px-2 py-2 rounded-xl border border-slate-300 font-mono text-sm font-extrabold text-right bg-white"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <button
                        type="button"
                        disabled={!selectedTransferProd}
                        onClick={() =>
                          handleAddTransferItem(
                            activeTransferProdId,
                            transferQty,
                            effectiveColor,
                            effectiveSize
                          )
                        }
                        className="w-full py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        Thêm vào phiếu
                      </button>
                    </div>
                  </div>

                  {/* Sản phẩm đang chọn + chip Màu/Size để bấm 1 chạm thêm nhanh */}
                  {selectedTransferProd && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-slate-700">
                          Đang chọn: <span className="text-brand-ink">{selectedTransferProd.name}</span>
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          ({selectedTransferProd.code} · Tồn {getSourceFloorStock(selectedTransferProd)} {selectedTransferProd.unit})
                        </span>
                      </div>

                      {availVars.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {availVars.map((v, vIdx) => {
                            const vStock = getVariantSourceFloorStock(v);
                            const isSelectedVar =
                              String(v.color || "").trim().toLowerCase() ===
                              String(effectiveColor || "").trim().toLowerCase() &&
                              String(v.size || "").trim().toUpperCase() ===
                              String(effectiveSize || "").trim().toUpperCase();
                            const hexes = resolveVariantColorHexes(v.color, v.colorHexes);
                            return (
                              <button
                                key={`${v.color}-${v.size}-${vIdx}`}
                                type="button"
                                onClick={() => {
                                  setTransferColor(v.color || "");
                                  setTransferSize(v.size || "");
                                  handleAddTransferItem(
                                    activeTransferProdId,
                                    1,
                                    v.color || "",
                                    v.size || ""
                                  );
                                }}
                                style={getColorBoxBorderStyle(
                                  hexes,
                                  isSelectedVar ? "#eef2ff" : "#ffffff",
                                  2
                                )}
                                title="Bấm để thêm +1 biến thể này vào phiếu"
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-bold transition cursor-pointer ${isSelectedVar
                                  ? "ring-1 ring-indigo-600 text-indigo-950"
                                  : "border-slate-200 text-slate-800 hover:bg-indigo-50"
                                  }`}
                              >
                                <ColorSwatchBadge
                                  hexes={v.colorHexes}
                                  colorName={v.color || "Mặc định"}
                                  size="xs"
                                />
                                <span>{v.color || "Mặc định"}</span>
                                {Boolean(v.size?.trim()) && (
                                  <span className="font-mono text-brand-ink">· {v.size?.trim()}</span>
                                )}
                                <span className="font-mono text-brand-ink">({vStock})</span>
                                <span className="text-[10px] text-brand-ink font-extrabold">+1</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

    </>
  );
}
