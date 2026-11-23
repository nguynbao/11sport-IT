"use client";

import React, { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "11sport-theme";

export function applyTheme(mode: "light" | "dark") {
  document.documentElement.classList.toggle("dark", mode === "dark");
  try {
    localStorage.setItem(KEY, mode);
  } catch {}
}

/** Mục chuyển chế độ sáng/tối trong drawer menu phải */
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    applyTheme(next ? "dark" : "light");
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      title="Chuyển chế độ sáng / tối"
      onClick={toggle}
      className="w-full text-left px-2.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2.5 text-slate-700 hover:bg-slate-100 transition"
    >
      <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
        {dark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      </span>
      <span className="flex-1 truncate">
        Chế độ {dark ? "tối" : "sáng"}
      </span>
      <span
        className={`relative w-9 h-5 rounded-full shrink-0 transition-colors ${dark ? "bg-[#E8B020]" : "bg-[#8C8C8C]"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${dark ? "translate-x-4" : ""}`}
        />
      </span>
    </button>
  );
}
