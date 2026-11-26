"use client";

import { useState, useRef, useEffect, useCallback } from "react";

/** Điều khiển luồng camera (getUserMedia). resetPreview được gọi khi camera mở thành công. */
export function useCameraStream(resetPreview: () => void) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraActive, setCameraActive] = useState(false);
  const [startingCamera, setStartingCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");

  /* ----------------------------- Camera control ----------------------------- */

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(
    async (facing: "environment" | "user" = facingMode) => {
      setCameraError("");
      setStartingCamera(true);
      try {
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            "Trình duyệt không hỗ trợ Camera (cần HTTPS). Hãy dùng nút 'Chụp bằng app Camera' hoặc tải nhiều ảnh lên."
          );
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facing },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }

        streamRef.current = stream;
        resetPreview();
        setCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err: any) {
        setCameraActive(false);
        if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
          setCameraError(
            "Bạn đã chặn quyền Camera. Bấm biểu tượng ổ khóa trên thanh địa chỉ → Cho phép Camera, hoặc dùng các tùy chọn tải file bên dưới."
          );
        } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
          setCameraError("Không tìm thấy Camera trên thiết bị. Vui lòng tải ảnh/file lên.");
        } else {
          setCameraError(err?.message || "Không thể mở Camera. Vui lòng tải ảnh/file lên.");
        }
      } finally {
        setStartingCamera(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [facingMode]
  );

  useEffect(() => {
    startCamera("environment");
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  const handleSwitchCamera = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    startCamera(next);
  };

  return {
    videoRef,
    facingMode,
    cameraActive,
    startingCamera,
    cameraError,
    startCamera,
    stopCamera,
    handleSwitchCamera,
  };
}
