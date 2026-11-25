import type { StaffUser } from "@/shared/types";

const RENDER_API_BASE_URL = "https://one1sport-it.onrender.com/api/v1";
const ENV_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || RENDER_API_BASE_URL;

function resolveApiBaseUrl(): string {
  if (typeof window === "undefined") return ENV_API_BASE_URL;
  const host = window.location.hostname;
  const isEnvLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(ENV_API_BASE_URL);
  if (!isEnvLocal) return ENV_API_BASE_URL;

  if (host === "localhost" || host === "127.0.0.1") {
    return ENV_API_BASE_URL;
  }
  if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
    return ENV_API_BASE_URL.replace(/localhost|127\.0\.0\.1/i, host);
  }
  return RENDER_API_BASE_URL;
}


export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("11sport_cms_token");
}

export function getStoredUser(): StaffUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("11sport_cms_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredAuth(token: string, user: StaffUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem("11sport_cms_token", token);
  localStorage.setItem("11sport_cms_user", JSON.stringify(user));
}

export function clearStoredAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("11sport_cms_token");
  localStorage.removeItem("11sport_cms_user");
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T; meta?: any }> {
  const token = getStoredToken();
  const user = getStoredUser();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (user?._id) {
    headers["x-user-id"] = user._id;
  }

  const baseUrl = resolveApiBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (netErr) {
    if (baseUrl !== RENDER_API_BASE_URL) {
      res = await fetch(`${RENDER_API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });
    } else {
      throw netErr;
    }
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !endpoint.startsWith("/auth/login") && typeof window !== "undefined") {
      if (getStoredToken()) {
        clearStoredAuth();
        window.location.reload();
      }
    }
    const errMessage = json?.message || `Lỗi hệ thống (${res.status})`;
    const error: any = new Error(errMessage);
    error.code = json?.code || "API_ERROR";
    error.fields = json?.fields;
    throw error;
  }
  return json;
}

