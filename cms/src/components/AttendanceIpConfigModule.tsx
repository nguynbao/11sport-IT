"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  StaffUser,
  AttendanceConfig,
  fetchAttendanceConfig,
  updateAttendanceConfigApi,
} from "@/lib/api";
import {
  Wifi,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Save,
  RefreshCw,
  Copy,
  Plus,
  Trash2,
  Globe,
  ShieldCheck,
  Info,
  X,
  Radio,
} from "lucide-react";

interface Props {
  currentUser: StaffUser | null;
  isModal?: boolean;
  onClose?: () => void;
}

export default function AttendanceIpConfigModule({
  currentUser,
  isModal = false,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detectedClientIp, setDetectedClientIp] = useState<string>("");
  const [isCurrentIpAllowed, setIsCurrentIpAllowed] = useState<boolean>(false);

  // Form states
  const [officeName, setOfficeName] = useState("");
  const [office2Name, setOffice2Name] = useState("");
  const [allowedIpsText, setAllowedIpsText] = useState("");
  const [allowedIps2Text, setAllowedIps2Text] = useState("");
  const [office1Domain, setOffice1Domain] = useState("");
  const [office2Domain, setOffice2Domain] = useState("");
  const [requireIp, setRequireIp] = useState(true);
  const [updatedBy, setUpdatedBy] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");

  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const canEdit = Boolean(
    currentUser && ["HR", "ADMIN", "CEO"].includes(currentUser.role)
  );

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAttendanceConfig();
      const cfg = data.config;
      setDetectedClientIp(data.detectedClientIp || "");
      setIsCurrentIpAllowed(Boolean(data.isCurrentIpAllowed));

      setOfficeName(
        cfg.officeName || "Cơ sở 1: Showroom 11Sport - 24 Tố Hữu, Hoà Cường, Đà Nẵng"
      );
      setOffice2Name(
        cfg.office2Name || "Cơ sở 2: Văn phòng 11Sport - 89 Lê Thanh Nghị, Hòa Cường, Đà Nẵng"
      );
      setAllowedIpsText(Array.isArray(cfg.allowedIps) ? cfg.allowedIps.join("\n") : "");
      setAllowedIps2Text(Array.isArray(cfg.allowedIps2) ? cfg.allowedIps2.join("\n") : "");
      setOffice1Domain(cfg.office1Domain || "");
      setOffice2Domain(cfg.office2Domain || "");
      setRequireIp(typeof cfg.requireIp === "boolean" ? cfg.requireIp : true);
      setUpdatedBy(cfg.updatedBy || "");
      setUpdatedAt(cfg.updatedAt ? new Date(cfg.updatedAt).toLocaleString("vi-VN") : "");
    } catch (err: any) {
      showToast(err?.message || "Không thể tải cấu hình IP chấm công", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleCopyIp = () => {
    if (!detectedClientIp) return;
    navigator.clipboard.writeText(detectedClientIp);
    showToast(`Đã sao chép IP: ${detectedClientIp}`, "info");
  };

  const handleAddCurrentIpToBranch1 = () => {
    if (!detectedClientIp) return;
    const currentList = allowedIpsText
      .split(/[\n,]+/)
      .map((ip) => ip.trim())
      .filter(Boolean);
    if (!currentList.includes(detectedClientIp)) {
      currentList.push(detectedClientIp);
      setAllowedIpsText(currentList.join("\n"));
      showToast(
        `Đã thêm IP ${detectedClientIp} vào ô Cơ sở 1 — nhớ bấm "Lưu Cấu Hình IP (2 Cơ Sở)" bên dưới để áp dụng!`,
        "info"
      );
    } else {
      showToast(`IP ${detectedClientIp} đã có trong danh sách Cơ sở 1`, "info");
    }
  };

  const handleAddCurrentIpToBranch2 = () => {
    if (!detectedClientIp) return;
    const currentList = allowedIps2Text
      .split(/[\n,]+/)
      .map((ip) => ip.trim())
      .filter(Boolean);
    if (!currentList.includes(detectedClientIp)) {
      currentList.push(detectedClientIp);
      setAllowedIps2Text(currentList.join("\n"));
      showToast(
        `Đã thêm IP ${detectedClientIp} vào ô Cơ sở 2 — nhớ bấm "Lưu Cấu Hình IP (2 Cơ Sở)" bên dưới để áp dụng!`,
        "info"
      );
    } else {
      showToast(`IP ${detectedClientIp} đã có trong danh sách Cơ sở 2`, "info");
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canEdit) {
      showToast("Chỉ HR, Quản trị viên (ADMIN) hoặc CEO mới có quyền lưu cấu hình", "error");
      return;
    }

    setSaving(true);
    try {
      const allowedIps = allowedIpsText
        .split(/[\n,]+/)
        .map((ip) => ip.trim())
        .filter(Boolean);

      const allowedIps2 = allowedIps2Text
        .split(/[\n,]+/)
        .map((ip) => ip.trim())
        .filter(Boolean);

      const res = await updateAttendanceConfigApi({
        officeName: officeName.trim(),
        office2Name: office2Name.trim(),
        allowedIps,
        allowedIps2,
        office1Domain: office1Domain.trim(),
        office2Domain: office2Domain.trim(),
        requireIp,
      });

      setDetectedClientIp(res.detectedClientIp || detectedClientIp);
      setIsCurrentIpAllowed(Boolean(res.isCurrentIpAllowed));
      setUpdatedBy(res.config.updatedBy || currentUser?.fullName || "");
      setUpdatedAt(new Date().toLocaleString("vi-VN"));

      showToast(res.message || "Đã lưu cấu hình IP chấm công cho cả 2 cơ sở thành công!", "success");
    } catch (err: any) {
      showToast(err?.message || "Lỗi khi lưu cấu hình IP", "error");
    } finally {
      setSaving(false);
    }
  };

  const containerContent = (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-xl text-sm font-semibold flex items-center justify-between gap-3 shadow-md border animate-in fade-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === "success"
              ? "bg-teal-50 text-teal-900 border-teal-200"
              : toastMessage.type === "error"
              ? "bg-rose-50 text-rose-900 border-rose-200"
              : "bg-teal-50 text-teal-900 border-teal-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === "success" && <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />}
            {toastMessage.type === "error" && <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />}
            {toastMessage.type === "info" && <Info className="w-5 h-5 text-teal-600 shrink-0" />}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Info Banner */}
      <div className="bg-white text-slate-900 rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-teal-50 text-teal-600 rounded-xl border border-teal-200">
                <Wifi className="w-5 h-5" />
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900">
                Cấu Hình IP Wi-Fi Chấm Công (2 Cơ Sở)
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
              HR, Quản trị viên (Admin) và CEO có quyền thiết lập dải IP Public hoặc Domain DDNS của mạng Wi-Fi tại cả 2 cơ sở.
              Nhân viên chỉ chấm công hợp lệ khi kết nối đúng mạng Wi-Fi công ty.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadConfig}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-600" : "text-teal-600"}`} />
              <span>Làm mới</span>
            </button>
            {isModal && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Thẻ IP Hiện Tại Của Máy */}
        <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-600">IP Public hiện tại của bạn:</span>
            <span className="font-mono font-bold bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-teal-700">
              {detectedClientIp || "Đang kiểm tra..."}
            </span>
            <button
              type="button"
              onClick={handleCopyIp}
              title="Sao chép IP"
              className="p-1.5 hover:bg-teal-50 rounded-md text-slate-600 hover:text-teal-600 transition cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <span
              className={`px-2 py-0.5 rounded-full font-bold text-[11px] flex items-center gap-1 ${
                isCurrentIpAllowed
                  ? "bg-teal-50 text-teal-700 border border-teal-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              {isCurrentIpAllowed ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-teal-600" />
                  Mạng công ty hợp lệ
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  Chưa thuộc mạng cho phép
                </>
              )}
            </span>
          </div>

          {canEdit && detectedClientIp && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddCurrentIpToBranch1}
                className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-[11px] transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Gán vào Cơ sở 1
              </button>
              <button
                type="button"
                onClick={handleAddCurrentIpToBranch2}
                className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-[11px] transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Gán vào Cơ sở 2
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Form Cấu Hình 2 Cơ Sở */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CỘT 1: CƠ SỞ 1 */}
          <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Cơ Sở 1 (Showroom)</h3>
                <p className="text-xs text-slate-500">Mạng Wi-Fi tại Showroom trưng bày & bán hàng</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên Cơ Sở 1</label>
                <input
                  type="text"
                  value={officeName}
                  onChange={(e) => setOfficeName(e.target.value)}
                  disabled={!canEdit}
                  placeholder="Showroom 11Sport - 24 Tố Hữu, Đà Nẵng"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-slate-800 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Danh sách IP Wi-Fi / WAN cho phép (Cơ sở 1)
                </label>
                <p className="text-[11px] text-slate-500 mb-1.5">
                  Mỗi IP hoặc dải IP trên một dòng (hoặc ngăn cách bởi dấu phẩy). Hỗ trợ dải tiền tố (VD:{" "}
                  <code className="text-teal-700 font-mono">113.22.236.</code>).
                </p>
                <textarea
                  rows={4}
                  value={allowedIpsText}
                  onChange={(e) => setAllowedIpsText(e.target.value)}
                  disabled={!canEdit}
                  placeholder="113.22.236.87&#10;113.22.236.6&#10;113.22.236."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-xs text-slate-800 disabled:bg-slate-50 leading-relaxed"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  <span>Domain DDNS Cơ sở 1 (Tùy chọn)</span>
                </label>
                <input
                  type="text"
                  value={office1Domain}
                  onChange={(e) => setOffice1Domain(e.target.value)}
                  disabled={!canEdit}
                  placeholder="11sport2.myddns.me"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-slate-800 disabled:bg-slate-50"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Nếu mạng dùng Dynamic DNS (No-IP, DuckDNS), Server sẽ tự động phân giải IP Public mỗi 5 phút.
                </p>
              </div>
            </div>
          </div>

          {/* CỘT 2: CƠ SỞ 2 */}
          <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Cơ Sở 2 (Văn Phòng)</h3>
                <p className="text-xs text-slate-500">Mạng Wi-Fi tại Văn phòng điều hành & kế toán</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tên Cơ Sở 2</label>
                <input
                  type="text"
                  value={office2Name}
                  onChange={(e) => setOffice2Name(e.target.value)}
                  disabled={!canEdit}
                  placeholder="Văn phòng 11Sport - 89 Lê Thanh Nghị, Đà Nẵng"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-slate-800 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Danh sách IP Wi-Fi / WAN cho phép (Cơ sở 2)
                </label>
                <p className="text-[11px] text-slate-500 mb-1.5">
                  Mỗi IP hoặc dải IP trên một dòng (hoặc ngăn cách bởi dấu phẩy). Hỗ trợ dải tiền tố (VD:{" "}
                  <code className="text-teal-700 font-mono">116.110.151.</code>).
                </p>
                <textarea
                  rows={4}
                  value={allowedIps2Text}
                  onChange={(e) => setAllowedIps2Text(e.target.value)}
                  disabled={!canEdit}
                  placeholder="171.231.188.171&#10;116.110.151.140"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-xs text-slate-800 disabled:bg-slate-50 leading-relaxed"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  <span>Domain DDNS Cơ sở 2 (Tùy chọn)</span>
                </label>
                <input
                  type="text"
                  value={office2Domain}
                  onChange={(e) => setOffice2Domain(e.target.value)}
                  disabled={!canEdit}
                  placeholder="11sport.myddns.me"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-slate-800 disabled:bg-slate-50"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Domain DDNS của mạng chi nhánh thứ hai để hệ thống tự động cập nhật IP khi đổi mạng.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tuỳ chọn chung & Lưu */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={requireIp}
                onChange={(e) => setRequireIp(e.target.checked)}
                disabled={!canEdit}
                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
              />
              <span className="font-extrabold text-sm text-slate-800">
                Bắt buộc kiểm tra IP Wi-Fi công ty khi chấm công (Khuyến nghị BẬT)
              </span>
            </label>
            <p className="text-xs text-slate-500 pl-6">
              Khi bật, nhân viên tại cơ sở phải kết nối đúng Wi-Fi của Cơ sở 1 hoặc Cơ sở 2 để Check-in/Check-out (đơn WFH đã duyệt được miễn trừ).
            </p>
            {updatedBy && (
              <p className="text-[11px] text-slate-400 pl-6 pt-1">
                Lần cập nhật cuối: bởi <strong>{updatedBy}</strong> lúc <em>{updatedAt}</em>
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isModal && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                Đóng
              </button>
            )}

            {canEdit && (
              <button
                type="submit"
                disabled={saving || loading}
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Lưu Cấu Hình IP (2 Cơ Sở)</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto p-5 sm:p-7">
          {containerContent}
        </div>
      </div>
    );
  }

  return containerContent;
}
