/**
 * Lấy vị trí GPS "tươi" tại đúng thời điểm chấm công.
 * - Không dùng cache (maximumAge = 0), không có tọa độ thay thế.
 * - Thất bại -> ném GeoError để UI hiện popup hướng dẫn bật định vị.
 */

export type GeoErrorCode =
  | "UNSUPPORTED"
  | "INSECURE"
  | "PERMISSION_DENIED"
  | "POSITION_UNAVAILABLE"
  | "TIMEOUT";

export class GeoError extends Error {
  code: GeoErrorCode;
  constructor(code: GeoErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "GeoError";
  }
}

export interface GeoCoords {
  lat: number;
  lng: number;
  accuracy: number;
}

export const GEO_ERROR_MESSAGES: Record<GeoErrorCode, string> = {
  UNSUPPORTED: "Trình duyệt/thiết bị này không hỗ trợ định vị GPS.",
  INSECURE: "Định vị chỉ hoạt động trên kết nối bảo mật (https).",
  PERMISSION_DENIED: "Bạn chưa cấp quyền truy cập vị trí cho trang web này.",
  POSITION_UNAVAILABLE: "Không xác định được vị trí. Dịch vụ định vị của thiết bị có thể đang tắt.",
  TIMEOUT: "Lấy vị trí quá lâu. Vui lòng thử lại.",
};

export function getFreshPosition(timeoutMs = 15000): Promise<GeoCoords> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new GeoError("UNSUPPORTED", GEO_ERROR_MESSAGES.UNSUPPORTED));
      return;
    }
    if (window.isSecureContext === false) {
      reject(new GeoError("INSECURE", GEO_ERROR_MESSAGES.INSECURE));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        const code: GeoErrorCode =
          err.code === err.PERMISSION_DENIED
            ? "PERMISSION_DENIED"
            : err.code === err.TIMEOUT
              ? "TIMEOUT"
              : "POSITION_UNAVAILABLE";
        reject(new GeoError(code, GEO_ERROR_MESSAGES[code]));
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });
}
