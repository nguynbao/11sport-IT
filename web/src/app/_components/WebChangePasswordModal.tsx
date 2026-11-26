"use client";

import React from "react";
import { AlertCircle, CheckCircle2, KeyRound, X } from "lucide-react";

interface WebChangePasswordModalProps {
  username: string;
  isOpen: boolean;
  currentPassword: string;
  onCurrentPasswordChange: (val: string) => void;
  newPassword: string;
  onNewPasswordChange: (val: string) => void;
  confirmPassword: string;
  onConfirmPasswordChange: (val: string) => void;
  pwdSaving: boolean;
  pwdMessage: { type: "success" | "error"; text: string } | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function WebChangePasswordModal({
  username,
  isOpen,
  currentPassword,
  onCurrentPasswordChange,
  newPassword,
  onNewPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  pwdSaving,
  pwdMessage,
  onClose,
  onSubmit,
}: WebChangePasswordModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-4 print:hidden">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="bg-blue-600 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <h3 className="font-extrabold text-sm">Đổi mật khẩu tài khoản ({username})</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-blue-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4">
          {pwdMessage && (
            <div
              className={`p-3 rounded-xl border text-xs font-bold flex items-start gap-2 ${
                pwdMessage.type === "success"
                  ? "bg-blue-50 border-blue-200 text-brand-ink"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}
            >
              {pwdMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{pwdMessage.text}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Mật khẩu hiện tại *
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => onCurrentPasswordChange(e.target.value)}
              placeholder="Nhập mật khẩu đang sử dụng..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Mật khẩu mới *
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => onNewPasswordChange(e.target.value)}
              placeholder="Tối thiểu 4 ký tự..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Xác nhận mật khẩu mới *
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
              placeholder="Nhập lại mật khẩu mới..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={pwdSaving}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-extrabold"
            >
              {pwdSaving ? "Đang lưu..." : "Lưu mật khẩu mới"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
