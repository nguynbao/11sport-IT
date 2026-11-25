"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

interface QuickConsultFormProps {
  variant?: "sidebar" | "horizontal";
  title?: string;
  subtitle?: string;
  sourceUrl?: string;
}

const INPUT_CLS =
  "w-full h-[38px] px-3 rounded-none border border-[#dddddd] bg-white text-[13.5px] text-[#0a0a0a] placeholder:text-[#888888] focus:outline-none focus:border-[#224e40]";

/**
 * 1:1 mipik.vn Consultation / Contact Form:
 * - `sidebar`: dark #224e40 header bar + #f2f2f2 body + sharp inputs + left-aligned #224e40 button
 * - `horizontal`: full-width sharp registration form for Contact / About pages
 */
export function QuickConsultForm({
  variant = "sidebar",
  title,
  subtitle,
  sourceUrl,
}: QuickConsultFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const isHorizontal = variant === "horizontal";
  const resolvedTitle =
    title || (isHorizontal ? "ĐĂNG KÝ TƯ VẤN" : "GỬI CÂU HỎI TƯ VẤN");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !message.trim()) return;
    setSubmitting(true);
    setFeedback(null);

    const combinedMessage =
      isHorizontal && address.trim()
        ? `[Địa chỉ: ${address.trim()}] ${message.trim()}`
        : message.trim();

    try {
      const res = await apiFetch<{ message?: string }>("/public/contact", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          message: combinedMessage,
          sourceUrl:
            sourceUrl ||
            (typeof window !== "undefined" ? window.location.pathname : undefined),
        }),
      });
      setFeedback({
        type: "success",
        text:
          res?.message ||
          "Đã nhận câu hỏi! Tư vấn viên 11Sport sẽ liên hệ lại sớm.",
      });
      setName("");
      setPhone("");
      setEmail("");
      setAddress("");
      setMessage("");
    } catch {
      setFeedback({
        type: "error",
        text: "Không thể gửi yêu cầu lúc này. Vui lòng gọi Hotline 0909 888 128.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (isHorizontal) {
    return (
      <section className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-[17px] sm:text-[19px] font-bold uppercase tracking-wide text-[#0a0a0a]">
            {resolvedTitle}
          </h3>
          {subtitle && (
            <p className="text-[13.5px] text-[#555555]">{subtitle}</p>
          )}
        </div>

        {feedback && (
          <div
            role="status"
            className={`p-3 rounded-none border text-[13px] font-medium ${
              feedback.type === "success"
                ? "bg-[#f8f9f5] border-[#dce5da] text-[#204b3e]"
                : "bg-[#fef2f2] border-[#dd3333]/30 text-[#b91c1c]"
            }`}
          >
            {feedback.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label htmlFor="consult-h-name" className="sr-only">
                Họ và tên
              </label>
              <input
                id="consult-h-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Họ và tên *"
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label htmlFor="consult-h-phone" className="sr-only">
                Số điện thoại
              </label>
              <input
                id="consult-h-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Số điện thoại *"
                className={`${INPUT_CLS} tabular-nums`}
              />
            </div>

            <div>
              <label htmlFor="consult-h-email" className="sr-only">
                Email
              </label>
              <input
                id="consult-h-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label htmlFor="consult-h-address" className="sr-only">
                Địa chỉ liên hệ
              </label>
              <input
                id="consult-h-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Địa chỉ liên hệ"
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div>
            <label htmlFor="consult-h-message" className="sr-only">
              Nội dung tư vấn
            </label>
            <textarea
              id="consult-h-message"
              rows={4}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Nội dung cần tư vấn (chọn vợt 14mm/16mm, đặt lịch thử vợt...) *"
              className="w-full p-3 rounded-none border border-[#dddddd] bg-white text-[13.5px] text-[#0a0a0a] placeholder:text-[#888888] focus:outline-none focus:border-[#224e40]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="h-[39px] px-6 rounded-none bg-[#224e40] hover:bg-[#193b30] text-white text-[12.5px] font-bold uppercase tracking-wider transition-colors disabled:opacity-60"
          >
            {submitting ? "ĐANG GỬI..." : "GỬI LIÊN HỆ"}
          </button>
        </form>
      </section>
    );
  }

  return (
    <div className="rounded-none border border-[#e5e5e5] bg-[#f2f2f2] overflow-hidden">
      <div className="bg-[#224e40] px-4 py-2.5 text-center">
        <h2 className="text-[13.5px] font-bold uppercase tracking-wide text-white">
          {resolvedTitle}
        </h2>
      </div>

      <div className="p-4 space-y-3">
        {feedback && (
          <div
            role="status"
            className={`p-2.5 rounded-none border text-xs font-medium ${
              feedback.type === "success"
                ? "bg-[#f8f9f5] border-[#dce5da] text-[#204b3e]"
                : "bg-[#fef2f2] border-[#dd3333]/30 text-[#b91c1c]"
            }`}
          >
            {feedback.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div>
            <label htmlFor="consult-name" className="sr-only">
              Họ và tên
            </label>
            <input
              id="consult-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Họ và tên *"
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label htmlFor="consult-phone" className="sr-only">
              Số điện thoại
            </label>
            <input
              id="consult-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Số điện thoại *"
              className={`${INPUT_CLS} tabular-nums`}
            />
          </div>

          <div>
            <label htmlFor="consult-email" className="sr-only">
              Email
            </label>
            <input
              id="consult-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label htmlFor="consult-message" className="sr-only">
              Nội dung
            </label>
            <textarea
              id="consult-message"
              rows={4}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Nội dung *"
              className="w-full p-3 rounded-none border border-[#dddddd] bg-white text-[13.5px] text-[#0a0a0a] placeholder:text-[#888888] focus:outline-none focus:border-[#224e40]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="h-[39px] px-5 rounded-none bg-[#224e40] hover:bg-[#193b30] text-white text-[12.5px] font-bold uppercase tracking-wider transition-colors disabled:opacity-60"
          >
            {submitting ? "ĐANG GỬI..." : "GỬI CÂU HỎI"}
          </button>
        </form>
      </div>
    </div>
  );
}
