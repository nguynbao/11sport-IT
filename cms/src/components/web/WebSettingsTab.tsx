"use client";

import React, { useEffect, useState, useCallback } from "react";
import { apiRequest, UserRole } from "@/lib/api";
import { testCloudinaryConnectionApi, WebShowroomItem, WebSiteSettingData } from "@/lib/webApi";
import {
  AdminOnlyBadge,
  ImageUploadField,
  TabFeedbackBanner,
  TabLoadingState,
} from "./WebShared";
import {
  AlertCircle,
  CheckCircle,
  Cloud,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Plus,
  Save,
  Trash2,
  Zap,
} from "lucide-react";

const DEFAULT_SHOWROOMS: WebShowroomItem[] = [
  { name: "Showroom 1", address: "", hotline: "", hours: "08:30 - 21:30" },
];

export default function WebSettingsTab({ role }: { role: UserRole }) {
  const isAdmin = role === "ADMIN";
  const [form, setForm] = useState<WebSiteSettingData>({
    siteName: "11 Sport",
    showrooms: DEFAULT_SHOWROOMS,
    onlineStockMode: "FLOOR_1",
  });
  const [loading, setLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingTech, setSavingTech] = useState(false);
  const [savingCloudinary, setSavingCloudinary] = useState(false);
  const [testingCloudinary, setTestingCloudinary] = useState(false);
  const [cloudinaryStatus, setCloudinaryStatus] = useState<{
    connected: boolean;
    message: string;
  } | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest<WebSiteSettingData>("/cms/web/settings");
      const d = res.data || {};
      setForm({
        ...d,
        showrooms:
          Array.isArray(d.showrooms) && d.showrooms.length > 0
            ? d.showrooms
            : DEFAULT_SHOWROOMS,
        onlineStockMode: d.onlineStockMode || "FLOOR_1",
      });
    } catch (e: any) {
      setError(e?.message || "Không tải được cấu hình Website");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateShowroom = (idx: number, field: keyof WebShowroomItem, value: string) => {
    setForm((prev) => {
      const list = [...(prev.showrooms || DEFAULT_SHOWROOMS)];
      list[idx] = { ...list[idx], [field]: value };
      return { ...prev, showrooms: list };
    });
  };

  const addShowroom = () => {
    setForm((prev) => {
      const list = [...(prev.showrooms || DEFAULT_SHOWROOMS)];
      list.push({
        name: `Showroom ${list.length + 1}`,
        address: "",
        hotline: "",
        hours: "08:30 - 21:30",
      });
      return { ...prev, showrooms: list };
    });
  };

  const removeShowroom = (idx: number) => {
    setForm((prev) => {
      const list = [...(prev.showrooms || DEFAULT_SHOWROOMS)];
      if (list.length <= 1) return prev;
      list.splice(idx, 1);
      return { ...prev, showrooms: list };
    });
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGeneral(true);
    setError("");
    setSuccess("");
    try {
      // Chỉ gửi các trường hiển thị chung (không chạm technical fields để CEO lưu bình thường)
      await apiRequest("/cms/web/settings", {
        method: "PUT",
        body: JSON.stringify({
          siteName: form.siteName,
          logoUrl: form.logoUrl,
          hotline: form.hotline,
          email: form.email,
          zaloUrl: form.zaloUrl,
          messengerUrl: form.messengerUrl,
          freeShipThreshold: Number(form.freeShipThreshold || 0),
          defaultShippingFee: Number(form.defaultShippingFee || 0),
          showrooms: form.showrooms,
          footerAbout: form.footerAbout,
        }),
      });
      setSuccess("Đã lưu thông tin chung Website!");
      await loadSettings();
    } catch (err: any) {
      setError(err?.message || "Lưu thông tin chung thất bại");
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSaveTechnical = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSavingTech(true);
    setError("");
    setSuccess("");
    try {
      await apiRequest("/cms/web/settings", {
        method: "PUT",
        body: JSON.stringify({
          onlineStockMode: form.onlineStockMode,
        }),
      });
      setSuccess("Đã lưu chế độ kho Online!");
      await loadSettings();
    } catch (err: any) {
      setError(err?.message || "Lưu cấu hình kỹ thuật thất bại");
    } finally {
      setSavingTech(false);
    }
  };

  const handleTestCloudinary = async () => {
    setTestingCloudinary(true);
    setCloudinaryStatus(null);
    setError("");
    try {
      const res = await testCloudinaryConnectionApi({
        cloudName: form.cloudinaryCloudName || "",
        apiKey: form.cloudinaryApiKey || "",
        apiSecret: form.cloudinaryApiSecret || "",
        folder: form.cloudinaryFolder || "11sport-web",
      });
      setCloudinaryStatus({
        connected: res.connected,
        message: res.message || "Kết nối Cloudinary thành công!",
      });
    } catch (err: any) {
      setCloudinaryStatus({
        connected: false,
        message: err?.message || "Kiểm tra kết nối Cloudinary thất bại",
      });
    } finally {
      setTestingCloudinary(false);
    }
  };

  const handleSaveCloudinary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSavingCloudinary(true);
    setError("");
    setSuccess("");
    try {
      await apiRequest("/cms/web/settings", {
        method: "PUT",
        body: JSON.stringify({
          cloudinaryCloudName: form.cloudinaryCloudName || "",
          cloudinaryApiKey: form.cloudinaryApiKey || "",
          cloudinaryApiSecret: form.cloudinaryApiSecret || "",
          cloudinaryFolder: form.cloudinaryFolder || "11sport-web",
        }),
      });
      setSuccess("Đã lưu cấu hình Cloudinary thành công!");
      await loadSettings();
    } catch (err: any) {
      setError(err?.message || "Lưu cấu hình Cloudinary thất bại");
    } finally {
      setSavingCloudinary(false);
    }
  };

  if (loading) return <TabLoadingState />;

  return (
    <div className="space-y-6">
      <TabFeedbackBanner
        error={error}
        success={success}
        onClear={() => {
          setError("");
          setSuccess("");
        }}
      />

      {/* Phần 1: Thông tin chung & 3 Showroom */}
      <form
        onSubmit={handleSaveGeneral}
        className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">
              Thông tin hiển thị, Liên hệ &amp; 3 Showroom
            </h3>
            <p className="text-xs text-slate-500">
              ADMIN và CEO đều có thể cập nhật thông tin thương hiệu, hotline và phí vận chuyển.
            </p>
          </div>
          <button
            type="submit"
            disabled={savingGeneral}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>{savingGeneral ? "Đang lưu..." : "Lưu thông tin chung"}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tên Website</label>
            <input
              type="text"
              value={form.siteName || ""}
              onChange={(e) => setForm({ ...form, siteName: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Hotline chính</label>
            <input
              type="text"
              value={form.hotline || ""}
              onChange={(e) => setForm({ ...form, hotline: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email CSKH</label>
            <input
              type="email"
              value={form.email || ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Zalo OA URL</label>
            <input
              type="text"
              value={form.zaloUrl || ""}
              onChange={(e) => setForm({ ...form, zaloUrl: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Messenger URL</label>
            <input
              type="text"
              value={form.messengerUrl || ""}
              onChange={(e) => setForm({ ...form, messengerUrl: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phí ship (₫)</label>
              <input
                type="number"
                value={form.defaultShippingFee || 0}
                onChange={(e) => setForm({ ...form, defaultShippingFee: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Freeship từ (₫)</label>
              <input
                type="number"
                value={form.freeShipThreshold || 0}
                onChange={(e) => setForm({ ...form, freeShipThreshold: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm"
              />
            </div>
          </div>
        </div>

        <ImageUploadField
          label="Logo Website"
          value={form.logoUrl || ""}
          onChange={(url) => setForm({ ...form, logoUrl: url })}
        />

        <div className="space-y-2.5 pt-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-extrabold text-slate-800 uppercase">
              Hệ thống Showroom ({(form.showrooms || DEFAULT_SHOWROOMS).length})
            </div>
            <button
              type="button"
              onClick={addShowroom}
              className="px-3 py-1.5 rounded-xl border border-teal-600 text-teal-700 hover:bg-teal-50 text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm showroom</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(form.showrooms || DEFAULT_SHOWROOMS).map((sr, idx, arr) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={sr.name}
                    onChange={(e) => updateShowroom(idx, "name", e.target.value)}
                    placeholder={`Showroom ${idx + 1}`}
                    className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                  />
                  {arr.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeShowroom(idx)}
                      title="Xóa showroom này"
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-red-600 hover:bg-red-50 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={sr.address}
                  onChange={(e) => updateShowroom(idx, "address", e.target.value)}
                  placeholder="Địa chỉ chi nhánh..."
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={sr.hotline}
                    onChange={(e) => updateShowroom(idx, "hotline", e.target.value)}
                    placeholder="Hotline"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-xs bg-white"
                  />
                  <input
                    type="text"
                    value={sr.hours || ""}
                    onChange={(e) => updateShowroom(idx, "hours", e.target.value)}
                    placeholder="Giờ mở cửa"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </form>

      {/* Phần 2: Chế độ kho Online (ADMIN ONLY) */}
      <form
        onSubmit={handleSaveTechnical}
        className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-extrabold text-sm text-slate-900">
              Cấu hình Kho Online
            </h3>
            {!isAdmin && <AdminOnlyBadge text="Chỉ ADMIN được sửa cấu hình kho Online" />}
          </div>
          <button
            type="submit"
            disabled={!isAdmin || savingTech}
            title={!isAdmin ? "Chỉ ADMIN được sửa cấu hình kho Online" : "Lưu chế độ kho Online"}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${isAdmin
                ? "bg-teal-600 hover:bg-teal-700 text-white"
                : "bg-slate-200 text-slate-500 cursor-not-allowed"
              }`}
          >
            {!isAdmin ? <Lock className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{savingTech ? "Đang lưu..." : "Lưu chế độ kho"}</span>
          </button>
        </div>

        <div className="max-w-md space-y-2">
          <label className="block text-xs font-bold text-slate-700 uppercase">Chế độ kho Online</label>
          <select
            disabled={!isAdmin}
            value={form.onlineStockMode || "FLOOR_1"}
            onChange={(e) => setForm({ ...form, onlineStockMode: e.target.value as any })}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="FLOOR_1">FLOOR_1 (Chỉ bán tồn kho Tầng 1)</option>
            <option value="ALL">ALL (Gộp Tầng 1 + Tầng 2)</option>
          </select>
        </div>
      </form>

      {/* Phần 3: Cấu hình Lưu trữ Cloudinary (ADMIN ONLY) */}
      <form
        onSubmit={handleSaveCloudinary}
        className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <span>Cấu hình Lưu trữ Đám mây Cloudinary</span>
                {!isAdmin && <AdminOnlyBadge text="Chỉ ADMIN được cấu hình Cloudinary" />}
              </h3>
              <p className="text-xs text-slate-500">
                Tự động tải ảnh Banner &amp; Sản phẩm lên Cloudinary CDN, tối ưu hiển thị cho Website bán hàng.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestCloudinary}
              disabled={!isAdmin || testingCloudinary}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {testingCloudinary ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              <span>{testingCloudinary ? "Đang kiểm tra..." : "Kiểm tra kết nối"}</span>
            </button>
            <button
              type="submit"
              disabled={!isAdmin || savingCloudinary}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${isAdmin
                  ? "bg-teal-600 hover:bg-teal-700 text-white"
                  : "bg-slate-200 text-slate-500 cursor-not-allowed"
                }`}
            >
              {!isAdmin ? <Lock className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>{savingCloudinary ? "Đang lưu..." : "Lưu cấu hình Cloudinary"}</span>
            </button>
          </div>
        </div>

        {cloudinaryStatus && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${cloudinaryStatus.connected
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
          >
            {cloudinaryStatus.connected ? (
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span className="font-semibold">{cloudinaryStatus.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Cloud Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              disabled={!isAdmin}
              value={form.cloudinaryCloudName || ""}
              onChange={(e) => setForm({ ...form, cloudinaryCloudName: e.target.value })}
              placeholder="Ví dụ: dxy12345"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              API Key <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              disabled={!isAdmin}
              value={form.cloudinaryApiKey || ""}
              onChange={(e) => setForm({ ...form, cloudinaryApiKey: e.target.value })}
              placeholder="Ví dụ: 871928471294821"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              API Secret <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showSecret ? "text" : "password"}
                disabled={!isAdmin}
                value={form.cloudinaryApiSecret || ""}
                onChange={(e) => setForm({ ...form, cloudinaryApiSecret: e.target.value })}
                placeholder="Ví dụ: aBcd12345efGh..."
                className="w-full px-3 py-2 pr-10 rounded-xl border border-slate-300 font-mono text-sm disabled:bg-slate-100 disabled:text-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Thư mục lưu trữ (Folder)
            </label>
            <input
              type="text"
              disabled={!isAdmin}
              value={form.cloudinaryFolder || ""}
              onChange={(e) => setForm({ ...form, cloudinaryFolder: e.target.value })}
              placeholder="Mặc định: 11sport-web"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>
        </div>
      </form>
    </div>
  );
}
