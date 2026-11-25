"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

/**
 * 1:1 mipik.vn Password Reset Page (`/tai-khoan/lost-password`)
 */
export default function LostPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setSubmitted(true);
  };

  return (
    <div className="max-w-container mx-auto px-3.5 sm:px-4 lg:px-5 py-8 lg:py-10 space-y-5">
      <h1 className="text-[20px] sm:text-[22px] font-bold uppercase tracking-wide text-[#0a0a0a] border-b border-[#ececec] pb-3">
        QUÊN MẬT KHẨU
      </h1>

      {submitted ? (
        <div className="max-w-2xl space-y-4">
          <div className="p-4 rounded-none bg-[#f8f9f5] border border-[#dce5da] text-[#204b3e] flex items-start gap-2.5 text-[14px]">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Liên kết đặt lại mật khẩu đã được gửi tới{" "}
              <strong>{identifier}</strong>. Vui lòng kiểm tra hộp thư của bạn.
            </span>
          </div>
          <Link
            href="/tai-khoan"
            className="inline-flex items-center justify-center h-[40px] px-6 rounded-none bg-[#224e40] hover:bg-[#193b30] text-white text-[13px] font-bold uppercase tracking-wider transition-colors"
          >
            QUAY LẠI ĐĂNG NHẬP
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <p className="text-[14px] text-[#333333] leading-relaxed">
            Quên mật khẩu? Vui lòng nhập tên đăng nhập hoặc địa chỉ email. Bạn sẽ
            nhận được một liên kết tạo mật khẩu mới qua email.
          </p>

          <div>
            <label
              htmlFor="reset-identifier"
              className="block text-[13px] font-bold text-[#222222] mb-1.5"
            >
              Tên đăng nhập hoặc email <span className="text-[#dd3333]">*</span>
            </label>
            <input
              id="reset-identifier"
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Nhập email hoặc tên tài khoản..."
              className="w-full h-[40px] px-3 rounded-none border border-[#dddddd] bg-white text-[14px] text-[#0a0a0a] focus:outline-none focus:border-[#224e40]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              className="h-[40px] px-6 rounded-none bg-[#224e40] hover:bg-[#193b30] text-white text-[13px] font-bold uppercase tracking-wider transition-colors"
            >
              ĐẶT LẠI MẬT KHẨU
            </button>

            <Link
              href="/tai-khoan"
              className="text-[13.5px] font-medium text-[#224e40] hover:underline"
            >
              ← Quay lại trang Đăng nhập
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
