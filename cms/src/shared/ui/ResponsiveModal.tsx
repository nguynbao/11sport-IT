"use client";

import React from "react";
import { X } from "lucide-react";

export interface ResponsiveModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  maxWidthClass?: string;
  headerClassName?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function ResponsiveModal({
  open,
  onClose,
  title,
  subtitle,
  maxWidthClass = "max-w-2xl",
  headerClassName = "bg-teal-600 text-white",
  footer,
  children,
}: ResponsiveModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/65 backdrop-blur-xs p-0 sm:p-4 print:hidden"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${maxWidthClass} max-h-[92dvh] sm:max-h-[90vh] flex flex-col bg-white rounded-t-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden`}
      >
        <div className={`px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-3 shrink-0 ${headerClassName}`}>
          <div className="min-w-0">
            {subtitle && (
              <div className="text-[11px] font-bold uppercase tracking-wider opacity-85 truncate">
                {subtitle}
              </div>
            )}
            <div className="font-extrabold text-sm sm:text-base truncate">{title}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-2 rounded-xl hover:bg-black/15 transition shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>

        {footer && (
          <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-slate-50 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
