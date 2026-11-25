"use client";

import React from "react";

export function CmsRoleBadge({ role, compact = false }: { role?: string; compact?: boolean }) {
  const r = String(role || "").toUpperCase();
  if (r === "CEO") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">
        {compact ? "CEO" : "CEO (Giám đốc)"}
      </span>
    );
  }
  if (r === "ADMIN") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200 whitespace-nowrap">
        {compact ? "ADMIN" : "ADMIN (Quản lý)"}
      </span>
    );
  }
  if (r === "ACCOUNTANT") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-teal-100 text-brand-ink border border-teal-200 whitespace-nowrap">
        {compact ? "ACCOUNTANT" : "ACCOUNTANT (Kế toán & Kho)"}
      </span>
    );
  }
  if (r === "SALES") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-teal-100 text-brand-ink border border-teal-200 whitespace-nowrap">
        {compact ? "SALES" : "SALES (Bán hàng)"}
      </span>
    );
  }
  return null;
}
