"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  ImagePlus,
  Loader2,
  Lock,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { extractWebImageUrl, resolveWebMediaUrl, uploadWebImageFile } from "@/lib/webApi";

export function SeoCharacterBar({
  label,
  value,
  min,
  max,
  onChange,
  multiline = false,
  placeholder,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  onChange: (val: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const len = value.length;
  const pct = Math.min(100, Math.round((len / max) * 100));
  const status = len === 0 ? "empty" : len < min ? "short" : len <= max ? "good" : "over";

  const barColor =
    status === "good"
      ? "bg-emerald-500"
      : status === "over"
        ? "bg-red-500"
        : "bg-slate-400";

  const badgeClass =
    status === "good"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : status === "over"
        ? "text-red-700 bg-red-50 border-red-200"
        : "text-slate-600 bg-slate-100 border-slate-200";

  const statusText =
    status === "good"
      ? "Đạt chuẩn"
      : status === "over"
        ? `Vượt quá ${len - max} ký tự`
        : status === "short"
          ? `Nên thêm ${min - len} ký tự`
          : `Khuyến nghị ${min}–${max} ký tự`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-bold text-slate-700 uppercase">{label}</label>
        <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${badgeClass}`}>
          {len} / {max} ký tự · {statusText}
        </span>
      </div>
      {multiline ? (
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
        />
      )}
      <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full transition-all duration-200 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ImageUploadField({
  label,
  value,
  onChange,
  hint,
  required,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
  required?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    setUploading(true);
    try {
      const url = await uploadWebImageFile(file);
      onChange(url);
    } catch (error: any) {
      setErr(error?.message || "Upload ảnh thất bại");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const isCloudinary = Boolean(value && value.includes("res.cloudinary.com"));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs font-bold text-slate-700 uppercase">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {isCloudinary && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700">
            <Cloud className="w-3 h-3" /> Cloudinary CDN
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Dán URL ảnh hoặc tải ảnh lên..."
          className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-slate-300 text-sm focus:border-teal-600 focus:outline-none"
        />
        <label className="min-h-[40px] px-3 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          <span>{uploading ? "Đang tải..." : "Tải ảnh"}</span>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleFile} className="hidden" />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            title="Xóa ảnh"
            className="min-h-[40px] px-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
      {err && <p className="text-xs font-semibold text-red-600">{err}</p>}
      {extractWebImageUrl(value) && (
        <div className="mt-1.5 inline-flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 bg-slate-50">
          <img
            src={resolveWebMediaUrl(value)}
            alt={label}
            className="h-14 w-24 object-cover rounded-lg bg-white"
          />
          <span className="text-[11px] font-mono text-slate-500 max-w-[240px] truncate">
            {extractWebImageUrl(value)}
          </span>
        </div>
      )}
    </div>
  );
}

export function MultiImageUploadField({
  label = "Danh sách ảnh sản phẩm",
  values = [],
  onChange,
  maxImages = 10,
  hint,
}: {
  label?: string;
  values: string[];
  onChange: (urls: string[]) => void;
  maxImages?: number;
  hint?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const [customUrl, setCustomUrl] = useState("");

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setErr("");

    const remainingSlots = maxImages - values.length;
    if (remainingSlots <= 0) {
      setErr(`Đã đạt giới hạn tối đa ${maxImages} ảnh`);
      return;
    }

    const filesToUpload = files.slice(0, remainingSlots);
    setUploading(true);

    try {
      const uploadedUrls: string[] = [];
      for (const file of filesToUpload) {
        const url = await uploadWebImageFile(file);
        if (url) uploadedUrls.push(url);
      }
      onChange([...values, ...uploadedUrls]);
    } catch (error: any) {
      setErr(error?.message || "Tải một số ảnh thất bại");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleRemove = (index: number) => {
    const updated = [...values];
    updated.splice(index, 1);
    onChange(updated);
  };

  const handleSetPrimary = (index: number) => {
    if (index <= 0 || index >= values.length) return;
    const updated = [...values];
    const [target] = updated.splice(index, 1);
    updated.unshift(target);
    onChange(updated);
  };

  const handleAddCustomUrl = () => {
    const trimmed = customUrl.trim();
    if (!trimmed) return;
    if (values.length >= maxImages) {
      setErr(`Đã đạt giới hạn tối đa ${maxImages} ảnh`);
      return;
    }
    onChange([...values, trimmed]);
    setCustomUrl("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs font-bold text-slate-700 uppercase">
          {label} ({values.length}/{maxImages})
        </label>
        <span className="text-[11px] text-slate-500 font-medium">
          Ảnh đầu tiên là ảnh đại diện chính
        </span>
      </div>

      {/* Grid danh sách ảnh */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
        {values.map((url, idx) => {
          const isPrimary = idx === 0;
          const isCloud = url.includes("res.cloudinary.com");
          return (
            <div
              key={`${url}-${idx}`}
              className={`group relative rounded-xl border overflow-hidden bg-slate-50 aspect-square flex flex-col justify-between ${
                isPrimary ? "border-teal-500 ring-2 ring-teal-500/20" : "border-slate-200"
              }`}
            >
              <img
                src={resolveWebMediaUrl(url)}
                alt={`Ảnh ${idx + 1}`}
                className="w-full h-full object-cover"
              />

              {/* Badges */}
              <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
                {isPrimary && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-600 text-white shadow-sm flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" /> Chính
                  </span>
                )}
                {isCloud && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/60 text-white backdrop-blur-sm">
                    CDN
                  </span>
                )}
              </div>

              {/* Action Overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                {!isPrimary && (
                  <button
                    type="button"
                    onClick={() => handleSetPrimary(idx)}
                    title="Đặt làm ảnh chính"
                    className="p-1.5 rounded-lg bg-white/90 text-slate-700 hover:bg-teal-600 hover:text-white transition shadow-sm text-xs font-bold"
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  title="Xóa ảnh này"
                  className="p-1.5 rounded-lg bg-white/90 text-red-600 hover:bg-red-600 hover:text-white transition shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Nút Upload thêm ảnh */}
        {values.length < maxImages && (
          <label className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-xl aspect-square flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-teal-600 bg-slate-50/50 hover:bg-teal-50/30 cursor-pointer transition p-2 text-center">
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
            ) : (
              <ImagePlus className="w-5 h-5" />
            )}
            <span className="text-[11px] font-bold leading-tight">
              {uploading ? "Đang tải..." : "Thêm ảnh"}
            </span>
            <span className="text-[9px] text-slate-400">Chọn 1 hoặc nhiều</span>
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleFiles}
              disabled={uploading}
              className="hidden"
            />
          </label>
        )}
      </div>

      {/* Dán URL phụ nhanh */}
      <div className="flex items-center gap-2 pt-1">
        <input
          type="text"
          value={customUrl}
          onChange={(e) => setCustomUrl(e.target.value)}
          placeholder="Hoặc dán URL ảnh trực tiếp vào đây..."
          className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 text-xs focus:border-teal-600 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleAddCustomUrl}
          disabled={!customUrl.trim() || values.length >= maxImages}
          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-bold transition"
        >
          Thêm link
        </button>
      </div>

      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
      {err && <p className="text-xs font-semibold text-red-600">{err}</p>}
    </div>
  );
}

export function TabFeedbackBanner({
  error,
  success,
  onClear,
}: {
  error?: string;
  success?: string;
  onClear?: () => void;
}) {
  if (!error && !success) return null;
  return (
    <div className="space-y-2">
      {error && (
        <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          {onClear && (
            <button type="button" onClick={onClear} className="p-1 hover:bg-red-100 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
          {onClear && (
            <button type="button" onClick={onClear} className="p-1 hover:bg-emerald-100 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function TabLoadingState({ label = "Đang tải dữ liệu..." }: { label?: string }) {
  return (
    <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
      <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
      <span className="text-xs font-semibold">{label}</span>
    </div>
  );
}

export function TabEmptyState({
  title,
  desc,
}: {
  title: string;
  desc?: string;
}) {
  return (
    <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-slate-300 bg-slate-50">
      <ImagePlus className="w-8 h-8 text-slate-400 mx-auto mb-2" />
      <p className="text-sm font-bold text-slate-700">{title}</p>
      {desc && <p className="text-xs text-slate-500 mt-1">{desc}</p>}
    </div>
  );
}

export function AdminOnlyBadge({ text = "Chỉ ADMIN được sửa cấu hình kỹ thuật" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
      <Lock className="w-3.5 h-3.5 shrink-0" />
      <span>{text}</span>
    </span>
  );
}
