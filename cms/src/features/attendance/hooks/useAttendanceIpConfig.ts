import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { StaffUser } from "@/shared/types";
import { fetchAttendanceConfig, updateAttendanceConfigApi } from "../api";

export function useAttendanceIpConfig(currentUser: StaffUser | null) {
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


  return {
    loading,
    saving,
    detectedClientIp,
    isCurrentIpAllowed,
    officeName,
    setOfficeName,
    office2Name,
    setOffice2Name,
    allowedIpsText,
    setAllowedIpsText,
    allowedIps2Text,
    setAllowedIps2Text,
    office1Domain,
    setOffice1Domain,
    office2Domain,
    setOffice2Domain,
    requireIp,
    setRequireIp,
    updatedBy,
    updatedAt,
    toastMessage,
    setToastMessage,
    canEdit,
    loadConfig,
    handleCopyIp,
    handleAddCurrentIpToBranch1,
    handleAddCurrentIpToBranch2,
    handleSave,
  };
}
