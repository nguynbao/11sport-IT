import React from "react";
import { AlertCircle, AlertTriangle, CopyPlus, Loader2 } from "lucide-react";
import type { PreviewCodeResult, Product } from "@/shared/types";

interface Props {
  preview: PreviewCodeResult | null;
  previewLoading: boolean;
  previewError: string;
  conflicts: NonNullable<PreviewCodeResult["conflicts"]>;
  dup: { _id: string; code: string; name?: string } | null;
  isEditing: boolean;
  editingProduct: Product | null;
  submitting: boolean;
  onAddVariantsToExisting: (productId: string) => void;
}

export default function ProductCodeCreatorPreview({
  preview,
  previewLoading,
  previewError,
  conflicts,
  dup,
  isEditing,
  editingProduct,
  submitting,
  onAddVariantsToExisting,
}: Props) {
  return (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2" aria-live="polite">
            <div className="flex items-center gap-2 font-bold text-slate-700 uppercase">
              Mã gốc chuẩn mới (server xem trước) {previewLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            </div>
            {preview ? (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 font-mono">
                  <span className="px-2 py-1 rounded bg-white border border-slate-300 font-bold">
                    {preview.categoryCode}
                  </span>
                  +
                  <span className="px-2 py-1 rounded bg-white border border-slate-300 font-bold">
                    {preview.brandCode}
                  </span>
                  +
                  <span className="px-2 py-1 rounded bg-white border border-slate-300 font-bold">
                    {preview.versionCode}
                  </span>
                  =
                  <span className="px-3 py-1 rounded bg-blue-600 text-white text-sm font-extrabold">
                    {preview.code}
                  </span>
                </div>
                {isEditing && editingProduct && preview.code !== editingProduct.code && (
                  <p className="text-[11px] text-brand-ink font-semibold">
                    ℹ️ Mã gốc sẽ đổi từ <strong className="font-mono">{editingProduct.code}</strong> sang{" "}
                    <strong className="font-mono">{preview.code}</strong> (mã cũ được tự động lưu vào{" "}
                    <code className="font-mono">legacyCode</code> để vẫn quét được tem cũ).
                  </p>
                )}
              </div>
            ) : (
              <p className="text-slate-500">
                {previewError || "Chọn Danh mục, Thương hiệu và nhập Version để xem mã."}
              </p>
            )}
            {preview && previewError === "" && conflicts.length > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-bold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <div>
                  Mã trùng với sản phẩm khác (R10) — hãy sửa Version code hoặc mã màu:
                  <ul className="list-disc ml-4 font-mono">
                    {conflicts.map((c, i) => (
                      <li key={i}>
                        {c.code} ↔ SP {c.productCode}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {dup && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 font-bold flex flex-wrap items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  Đã có sản phẩm cùng Danh mục + Thương hiệu + Version:{" "}
                  <span className="font-mono">{dup.code}</span>
                  {dup.name ? ` — ${dup.name}` : ""}
                </span>
                {!isEditing && (
                  <button
                    type="button"
                    disabled={submitting || !dup._id}
                    onClick={() => onAddVariantsToExisting(dup._id)}
                    className="ml-auto px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white flex items-center gap-1 cursor-pointer"
                  >
                    <CopyPlus className="w-3.5 h-3.5" /> Thêm biến thể vào sản phẩm này
                  </button>
                )}
              </div>
            )}
          </div>
  );
}
