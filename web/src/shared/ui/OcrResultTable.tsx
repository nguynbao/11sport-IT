"use client";

import { Plus, Trash2 } from "lucide-react";
import { formatVND } from "@/shared/utils/format";
import type { CameraScannerState } from "./useCameraScanner";

export default function OcrResultTable({ scanner }: { scanner: CameraScannerState }) {
  const { pasteText, setPasteText, scanning, handleParsePastedText, validOcrCount, mergeDuplicates, setMergeDuplicates, scannedPages, handleClearAllScanned, handleAddOcrRow, activeOcrSuggestIdx, ocrItems, setActiveOcrSuggestIdx, setOcrSuggestHighlightIdx, handleUpdateOcrRow, getOcrRowSuggestions, ocrSuggestHighlightIdx, handleSelectOcrSuggestion, handleRemoveOcrRow } = scanner;

  return (
    <>
            <div className="space-y-3">
              <details className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <summary className="text-xs font-bold text-slate-700 cursor-pointer">
                  Hoặc dán văn bản (mỗi dòng: Tên hàng | ĐVT | Số lượng | Ghi chú)
                </summary>
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  <textarea
                    rows={3}
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Áo Polo V1 (Áo Polo V1 Đỏ size L) | Cái | 20 | Lô 1"
                    className="w-full sm:flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={scanning || !pasteText.trim()}
                    onClick={() => handleParsePastedText(pasteText)}
                    className="min-h-[40px] px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold self-stretch sm:self-end"
                  >
                    Cộng vào bảng
                  </button>
                </div>
              </details>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-sm">
                    Danh sách hàng đã quét ({validOcrCount} dòng — sửa trực tiếp trước khi đưa vào phiếu):
                  </h4>
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mergeDuplicates}
                      onChange={(e) => setMergeDuplicates(e.target.checked)}
                      className="rounded accent-blue-600"
                    />
                    Tự động cộng dồn số lượng khi chụp thêm ảnh có mã hàng trùng
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {scannedPages.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllScanned}
                      className="min-h-[38px] px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Xóa làm lại
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAddOcrRow}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Thêm dòng tay
                  </button>
                </div>
              </div>

              <div
                className={`overflow-x-auto border border-slate-200 rounded-xl max-w-full ${
                  activeOcrSuggestIdx !== null ? "pb-60" : ""
                }`}
              >
                <table className="w-full min-w-[640px] text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 uppercase">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">STT</th>
                      <th className="hidden py-2.5 px-3 min-w-[200px]">Mã hàng (tự sinh)</th>
                      <th className="py-2.5 px-3 min-w-[280px] sm:min-w-[360px]">Tên hàng</th>
                      <th className="py-2.5 px-3 w-24">ĐVT</th>
                      <th className="py-2.5 px-3 w-24 text-right">Số lượng</th>
                      <th className="py-2.5 px-3 min-w-[140px]">Ghi chú</th>
                      <th className="py-2.5 px-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {ocrItems.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-center font-mono font-bold align-top">{idx + 1}</td>
                        <td className="hidden py-2 px-3">
                          <input
                            type="text"
                            value={row.productCode}
                            readOnly
                            placeholder="Tự sinh từ ()..."
                            className="w-full bg-blue-50 text-blue-900 font-mono text-[11px] font-semibold px-2 py-1.5 rounded border border-blue-200"
                          />
                        </td>
                        <td className="py-2 px-3 align-top">
                          <div className="relative">
                            <textarea
                              rows={Math.max(2, Math.ceil((row.productName?.length || 0) / 38))}
                              value={row.productName}
                              onFocus={() => {
                                setActiveOcrSuggestIdx(idx);
                                setOcrSuggestHighlightIdx(0);
                              }}
                              onBlur={() => {
                                setTimeout(() => {
                                  setActiveOcrSuggestIdx((prev) => (prev === idx ? null : prev));
                                }, 180);
                              }}
                              onChange={(e) => {
                                handleUpdateOcrRow(idx, "productName", e.target.value);
                                setActiveOcrSuggestIdx(idx);
                                setOcrSuggestHighlightIdx(0);
                              }}
                              onKeyDown={(e) => {
                                if (activeOcrSuggestIdx !== idx) return;
                                const suggestions = getOcrRowSuggestions(row.productName);
                                if (suggestions.length === 0) return;
                                if (e.key === "ArrowDown") {
                                  e.preventDefault();
                                  setOcrSuggestHighlightIdx((prev) => (prev + 1) % suggestions.length);
                                } else if (e.key === "ArrowUp") {
                                  e.preventDefault();
                                  setOcrSuggestHighlightIdx(
                                    (prev) => (prev - 1 + suggestions.length) % suggestions.length
                                  );
                                } else if (e.key === "Enter" && !e.shiftKey) {
                                  const picked =
                                    suggestions[ocrSuggestHighlightIdx] || suggestions[0];
                                  if (picked && picked.name !== row.productName) {
                                    e.preventDefault();
                                    handleSelectOcrSuggestion(idx, picked);
                                  }
                                } else if (e.key === "Escape") {
                                  setActiveOcrSuggestIdx(null);
                                }
                              }}
                              placeholder="Gõ tên hoặc mã hàng để tìm gợi ý SP trong kho..."
                              className="w-full px-2 py-1.5 rounded border border-slate-300 focus:border-blue-600 focus:outline-none whitespace-pre-wrap break-words leading-snug resize-y"
                            />
                            {activeOcrSuggestIdx === idx &&
                              (() => {
                                const suggestions = getOcrRowSuggestions(row.productName);
                                if (suggestions.length === 0) return null;
                                return (
                                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-xl border-2 border-blue-500 shadow-2xl overflow-hidden min-w-[300px]">
                                    <div className="px-3 py-1 bg-blue-600 text-white text-[10px] font-bold flex items-center justify-between">
                                      <span>📦 Gợi ý SP trong kho ({suggestions.length})</span>
                                      <span className="text-blue-300 font-normal">Bấm chọn</span>
                                    </div>
                                    <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                                      {suggestions.map((p, sIdx) => (
                                        <button
                                          key={p._id}
                                          type="button"
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            handleSelectOcrSuggestion(idx, p);
                                          }}
                                          onMouseEnter={() => setOcrSuggestHighlightIdx(sIdx)}
                                          className={`w-full text-left px-3 py-1.5 transition ${
                                            sIdx === ocrSuggestHighlightIdx
                                              ? "bg-blue-50"
                                              : "hover:bg-slate-50"
                                          }`}
                                        >
                                          <div className="font-bold text-xs text-slate-900 break-words">
                                            {p.name}
                                          </div>
                                          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                                            <span className="font-mono font-bold">{p.code}</span>
                                            <span className="text-brand-ink font-bold">
                                              Tồn: {p.stock} {p.unit || "Cái"} · Bán:{" "}
                                              {formatVND(Number(p.sellingPrice || 0))}
                                            </span>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.unit}
                            onChange={(e) => handleUpdateOcrRow(idx, "unit", e.target.value)}
                            className="w-full px-2 py-1.5 rounded border border-slate-300"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min={1}
                            value={row.expectedQuantity}
                            onChange={(e) =>
                              handleUpdateOcrRow(idx, "expectedQuantity", Math.max(1, Number(e.target.value)))
                            }
                            className="w-full px-2 py-1.5 rounded border border-slate-300 text-right font-mono font-bold"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.note}
                            onChange={(e) => handleUpdateOcrRow(idx, "note", e.target.value)}
                            placeholder="Ghi chú..."
                            className="w-full px-2 py-1.5 rounded border border-slate-300"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveOcrRow(idx)}
                            className="w-10 h-10 inline-flex items-center justify-center text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
    </>
  );
}
