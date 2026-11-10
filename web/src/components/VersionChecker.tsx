"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { RefreshCw, Sparkles, X } from "lucide-react";

const CLIENT_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || "";
const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 phút
const MIN_CHECK_GAP_MS = 10 * 1000; // Tránh gọi liên tục trong 10 giây

export default function VersionChecker() {
  const [hasNewVersion, setHasNewVersion] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const initialBuildIdRef = useRef<string>(CLIENT_BUILD_ID);
  const lastCheckAtRef = useRef<number>(0);

  const checkVersion = useCallback(async (force = false) => {
    if (typeof window === "undefined") return;
    const now = Date.now();
    if (!force && now - lastCheckAtRef.current < MIN_CHECK_GAP_MS) return;
    lastCheckAtRef.current = now;

    try {
      const res = await fetch(`/api/version?t=${now}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      const serverBuildId = String(data?.buildId || "").trim();
      if (!serverBuildId || serverBuildId === "dev") return;

      if (!initialBuildIdRef.current) {
        initialBuildIdRef.current = serverBuildId;
        return;
      }

      if (serverBuildId !== initialBuildIdRef.current) {
        setHasNewVersion(true);
      }
    } catch {
      // Bỏ qua lỗi mạng tạm thời trên di động
    }
  }, []);

  useEffect(() => {
    const initTimer = window.setTimeout(() => {
      checkVersion(true);
    }, 3000);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        checkVersion(false);
      }
    }, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkVersion(false);
      }
    };

    const handleFocus = () => {
      checkVersion(false);
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        checkVersion(true);
      }
    };

    const handleOnline = () => {
      checkVersion(true);
    };

    const handleError = (event: ErrorEvent) => {
      const msg = String(event?.message || "");
      if (
        msg.includes("ChunkLoadError") ||
        msg.includes("Loading chunk") ||
        msg.includes("Failed to fetch dynamically imported module")
      ) {
        setHasNewVersion(true);
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = String(event?.reason?.message || event?.reason || "");
      if (
        msg.includes("ChunkLoadError") ||
        msg.includes("Loading chunk") ||
        msg.includes("Failed to fetch dynamically imported module")
      ) {
        setHasNewVersion(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("online", handleOnline);
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.clearTimeout(initTimer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, [checkVersion]);

  const handleReloadNow = async () => {
    setIsReloading(true);
    try {
      if ("caches" in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((key) => window.caches.delete(key)));
      }
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }
    } catch {
      // Bỏ qua nếu trình duyệt không hỗ trợ
    }
    window.location.reload();
  };

  if (!hasNewVersion) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 inset-x-3 sm:inset-x-auto sm:right-5 sm:bottom-5 z-[9999] max-w-md mx-auto sm:mx-0"
    >
      <div className="flex items-center gap-3 rounded-2xl bg-slate-900/95 text-white px-4 py-3.5 shadow-2xl border border-emerald-500/40 backdrop-blur-md">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight text-white">
            Đã có phiên bản mới!
          </p>
          <p className="mt-0.5 text-xs text-slate-300 leading-snug">
            Bấm cập nhật để tải tính năng và dữ liệu mới nhất.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleReloadNow}
            disabled={isReloading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-sm transition disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isReloading ? "animate-spin" : ""}`} />
            {isReloading ? "Đang tải..." : "Cập nhật ngay"}
          </button>
          <button
            type="button"
            onClick={() => setHasNewVersion(false)}
            title="Để sau"
            aria-label="Đóng thông báo cập nhật"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
