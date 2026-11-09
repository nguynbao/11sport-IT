"use client";

import React, { useCallback, useRef, useState } from "react";
import { MapPin, AlertTriangle, RefreshCw, X } from "lucide-react";
import { GeoCoords, GeoError, GeoErrorCode, GEO_ERROR_MESSAGES, getFreshPosition } from "@/lib/geolocation";

interface ModalProps {
  code: GeoErrorCode;
  retrying: boolean;
  onRetry: () => void;
  onClose: () => void;
}

/** Popup yêu cầu bật GPS khi chấm công (không có GPS -> không cho check-in/check-out). */
export function GpsPermissionModal({ code, retrying, onRetry, onClose }: ModalProps) {
  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-5 space-y-3 text-xs text-slate-800">
        <div className="flex items-start justify-between gap-3">
          <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
            Cần bật định vị (GPS) để chấm công
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{GEO_ERROR_MESSAGES[code]}</span>
        </div>

        {code === "PERMISSION_DENIED" && (
          <div className="space-y-1.5 text-slate-600 leading-relaxed">
            <p className="font-bold text-slate-800">Cách cấp quyền vị trí:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                <b>Chrome / Edge / Cốc Cốc:</b> bấm biểu tượng 🔒 bên trái thanh địa chỉ → <b>Vị trí</b> →{" "}
                <b>Cho phép</b>, rồi tải lại trang.
              </li>
              <li>
                <b>Safari (iPhone):</b> Cài đặt → Quyền riêng tư &amp; Bảo mật → Dịch vụ định vị → bật, và mục{" "}
                <b>Trang web Safari</b> chọn <b>Khi dùng ứng dụng</b>.
              </li>
              <li>
                <b>Android:</b> bật <b>Vị trí</b> trên thanh trạng thái, rồi cấp quyền vị trí cho trình duyệt.
              </li>
            </ul>
          </div>
        )}

        {(code === "POSITION_UNAVAILABLE" || code === "TIMEOUT") && (
          <div className="space-y-1.5 text-slate-600 leading-relaxed">
            <p className="font-bold text-slate-800">Vui lòng kiểm tra:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                <b>macOS:</b> Cài đặt hệ thống → Quyền riêng tư &amp; Bảo mật → <b>Dịch vụ định vị</b> → bật cho trình
                duyệt.
              </li>
              <li>
                <b>Windows:</b> Cài đặt → Quyền riêng tư &amp; bảo mật → <b>Vị trí</b> → bật.
              </li>
              <li>
                <b>Điện thoại:</b> bật <b>Vị trí/GPS</b> và Wi-Fi để định vị chính xác hơn.
              </li>
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          {code === "PERMISSION_DENIED" && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-3.5 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Tải lại trang
            </button>
          )}
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} />
            {retrying ? "Đang lấy vị trí..." : "Bật định vị & thử lại"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook bắt buộc lấy GPS tươi trước khi thực hiện hành động chấm công.
 * - withGps(action): lấy vị trí ngay lúc bấm; thành công -> chạy action(coords).
 * - Thất bại -> hiện popup; bấm "thử lại" thành công sẽ tự chạy tiếp action đang chờ.
 */
export function useGpsGate() {
  const [gpsError, setGpsError] = useState<GeoErrorCode | null>(null);
  const [locating, setLocating] = useState(false);
  const pendingActionRef = useRef<((coords: GeoCoords) => void | Promise<void>) | null>(null);

  const attempt = useCallback(async () => {
    setLocating(true);
    let coords: GeoCoords;
    try {
      coords = await getFreshPosition();
    } catch (err) {
      setGpsError(err instanceof GeoError ? err.code : "POSITION_UNAVAILABLE");
      setLocating(false);
      return;
    }
    setGpsError(null);
    setLocating(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (action) await action(coords);
  }, []);

  const withGps = useCallback(
    (action: (coords: GeoCoords) => void | Promise<void>) => {
      pendingActionRef.current = action;
      return attempt();
    },
    [attempt]
  );

  const closeGpsModal = useCallback(() => {
    pendingActionRef.current = null;
    setGpsError(null);
  }, []);

  const gpsModal = gpsError ? (
    <GpsPermissionModal code={gpsError} retrying={locating} onRetry={attempt} onClose={closeGpsModal} />
  ) : null;

  return { withGps, locating, gpsModal };
}
