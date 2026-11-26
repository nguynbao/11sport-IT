"use client";

import React from "react";
import { AlertCircle, KeyRound, LogIn, User } from "lucide-react";

interface WebAuthGateProps {
  checkingAuth: boolean;
  username: string;
  onUsernameChange: (val: string) => void;
  password: string;
  onPasswordChange: (val: string) => void;
  loginLoading: boolean;
  loginError: string;
  onLoginSubmit: (e: React.FormEvent) => void;
}

export default function WebAuthGate({
  checkingAuth,
  username,
  onUsernameChange,
  password,
  onPasswordChange,
  loginLoading,
  loginError,
  onLoginSubmit,
}: WebAuthGateProps) {
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700">
        <div className="text-sm font-semibold text-slate-600">
          Đang kiểm tra phiên đăng nhập...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/70 to-white px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div className="bg-white text-slate-900 px-6 py-6 text-center border-b border-slate-100">
          <img
            src="/logo-11sport.svg"
            alt="11Sport Logo"
            className="h-16 w-auto object-contain mx-auto mb-3"
          />
          <h1 className="text-xl font-extrabold tracking-tight">
            ĐĂNG NHẬP 11SPORT POS & KHO
          </h1>
        </div>

        <form onSubmit={onLoginSubmit} className="p-4 sm:p-6 space-y-4">
          {loginError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{loginError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Tên đăng nhập (Username)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={username}
                onChange={(e) => onUsernameChange(e.target.value)}
                placeholder="Nhập username"
                autoComplete="username"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Mật khẩu (Password)
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                placeholder="Nhập mật khẩu..."
                autoComplete="current-password"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loginLoading}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition"
          >
            <LogIn className="w-4 h-4" />
            {loginLoading ? "Đang xác thực..." : "Đăng nhập vào Hệ thống"}
          </button>
        </form>
      </div>
    </div>
  );
}
