"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { ApiError, apiFetch, isMockApiEnabled } from "@/lib/api";
import {
  formatPhoneVN,
  formatPriceByCurrency,
  isValidPhoneVN,
  normalizePhoneVN,
} from "@/lib/format";
import { calculatePerVariantCartPricing } from "@/lib/pricingAndSearch";
import { useCartStore } from "@/store/cartStore";
import { useCurrencyStore } from "@/store/currencyStore";
import type {
  CartPriceResponse,
  CustomerProfile,
} from "@/types/storefront";

const CUSTOMER_TOKEN_KEY = "11sport_customer_token";

const SHARP_INPUT_CLS =
  "w-full h-[40px] px-3 rounded-none border border-[#dddddd] bg-white text-[14px] text-[#0a0a0a] placeholder:text-[#999999] focus:outline-none focus:border-[#224e40]";
const LABEL_CLS = "block text-[13px] font-bold text-[#222222] mb-1.5";

export function CheckoutClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isCancelled =
    searchParams.get("cancelled") === "1" ||
    searchParams.get("cancel") === "true";
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const currency = useCurrencyStore((s) => s.currency);

  const [mounted, setMounted] = useState(false);
  const [customerToken, setCustomerToken] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactExtra, setContactExtra] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [province, setProvince] = useState("TP. Hồ Chí Minh");
  const [district, setDistrict] = useState("");
  const [note, setNote] = useState("");

  const [shipToDifferent, setShipToDifferent] = useState(false);
  const [altFullName, setAltFullName] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [altAddress, setAltAddress] = useState("");

  const [paymentGateway, setPaymentGateway] = useState<"PAYOS" | "COD">(
    "PAYOS"
  );

  const [showCouponBox, setShowCouponBox] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [selectedGiftId, setSelectedGiftId] = useState("");
  const [pricing, setPricing] = useState<CartPriceResponse | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const savedPrefs = sessionStorage.getItem("11sport_checkout_prefs");
      if (savedPrefs) {
        const parsed = JSON.parse(savedPrefs) as {
          couponCode?: string;
          selectedGiftProductId?: string;
        };
        if (parsed.couponCode) {
          setCouponInput(parsed.couponCode);
          setAppliedCoupon(parsed.couponCode);
          setShowCouponBox(true);
        }
        if (parsed.selectedGiftProductId) {
          setSelectedGiftId(parsed.selectedGiftProductId);
        }
      }

      const token = localStorage.getItem(CUSTOMER_TOKEN_KEY);
      if (token) {
        setCustomerToken(token);
        apiFetch<{ data: CustomerProfile }>("/public/customers/me", {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => {
            const c = res?.data;
            if (!c) return;
            const defaultAddr =
              c.addresses?.find((a) => a.isDefault) || c.addresses?.[0];
            if (defaultAddr) {
              setFullName((prev) => prev || defaultAddr.fullName || c.name);
              setPhone(
                (prev) =>
                  prev || formatPhoneVN(defaultAddr.phone || c.phone || "")
              );
              setContactExtra((prev) => prev || c.email || "");
              setProvince((prev) => defaultAddr.province || prev);
              setDistrict((prev) => prev || defaultAddr.district || "");
              setAddressLine((prev) => prev || defaultAddr.addressLine || "");
            } else {
              setFullName((prev) => prev || c.name || "");
              setPhone((prev) => prev || formatPhoneVN(c.phone || ""));
              setContactExtra((prev) => prev || c.email || "");
            }
          })
          .catch(() => {
            // Token expired or unavailable
          });
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const syncPrice = useCallback(async () => {
    if (!items.length) return;
    try {
      const res = await apiFetch<{ data: CartPriceResponse }>(
        "/public/cart/price",
        {
          method: "POST",
          body: JSON.stringify({
            items: items.map((i) => ({
              productId: i.productId,
              variantKey: i.variantId,
              quantity: i.quantity,
            })),
            couponCode: appliedCoupon || undefined,
            selectedGiftProductId: selectedGiftId || undefined,
            province: province || undefined,
          }),
        }
      );
      if (res?.data) {
        setPricing(res.data);
        if (
          res.data.eligibleGifts?.length > 0 &&
          !res.data.eligibleGifts.some((g) => g.productId === selectedGiftId)
        ) {
          setSelectedGiftId(res.data.eligibleGifts[0].productId);
        }
      }
    } catch {
      setPricing(null);
    }
  }, [items, appliedCoupon, selectedGiftId, province]);

  useEffect(() => {
    if (mounted) syncPrice();
  }, [mounted, syncPrice]);

  if (!mounted) {
    return <div className="h-80 bg-[#f8f9f5] animate-pulse" />;
  }

  // Empty Cart 1:1 mipik.vn
  if (items.length === 0) {
    return (
      <div className="py-14 sm:py-20 px-4 text-center space-y-5 bg-white">
        <p className="text-[15px] text-[#333333]">
          Chưa có sản phẩm nào trong giỏ hàng.
        </p>
        <Link
          href="/vot-pickleball"
          className="inline-flex items-center justify-center h-[39px] px-7 rounded-none bg-[linear-gradient(90deg,#224e40_0%,#224e40_52%,#b5c7be_100%)] text-white text-[13px] font-bold uppercase tracking-wider transition-opacity hover:opacity-95 [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]"
        >
          QUAY TRỞ LẠI CỬA HÀNG
        </Link>
      </div>
    );
  }

  const localSubtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const localPricing = calculatePerVariantCartPricing(
    items.map((i) => ({
      productId: i.productId,
      variantKey: i.variantId,
      quantity: i.quantity,
      regularPrice: i.price,
      bulkTiers:
        i.price > 500_000
          ? [
              {
                minQty: 3,
                unitPrice: Math.max(0, i.price - 100_000),
                label: "Mua từ 3 sản phẩm cùng biến thể",
              },
              {
                minQty: 5,
                unitPrice: Math.max(0, i.price - 200_000),
                label: "Mua từ 5 sản phẩm cùng biến thể",
              },
            ]
          : [],
    }))
  );

  const rawSubtotal = pricing?.rawSubtotal ?? localSubtotal;
  const tierDiscountTotal =
    pricing?.tierDiscountTotal ?? localPricing.bulkDiscountSaved;
  const couponDiscount = pricing?.couponDiscount ?? 0;
  const shippingFee = pricing?.shippingFee ?? 0;
  const totalAmount =
    pricing?.totalAmount ??
    Math.max(0, rawSubtotal - tierDiscountTotal - couponDiscount + shippingFee);
  const eligibleGifts =
    pricing?.eligibleGifts ??
    (localPricing.unlockedGift
      ? [
          {
            productId: `local-gift-${localPricing.unlockedGift.minQty}`,
            productName: localPricing.unlockedGift.rewardTitle,
            quantity: 1,
          },
        ]
      : []);
  const activeGift =
    eligibleGifts.find((g) => g.productId === selectedGiftId) ||
    eligibleGifts[0] ||
    null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setErrorMsg(null);
    if (!fullName.trim()) {
      setErrorMsg("Vui lòng nhập họ và tên người nhận.");
      return;
    }
    if (!isValidPhoneVN(phone)) {
      setErrorMsg("Số điện thoại không hợp lệ (VD: 0909 123 456).");
      return;
    }
    if (!addressLine.trim() || !province.trim()) {
      setErrorMsg("Vui lòng điền đầy đủ địa chỉ giao hàng.");
      return;
    }
    if (shipToDifferent && (!altAddress.trim() || !altFullName.trim())) {
      setErrorMsg("Vui lòng điền đầy đủ tên và địa chỉ người nhận thay thế.");
      return;
    }

    const trimmedContact = contactExtra.trim();
    const emailValue = trimmedContact.includes("@")
      ? trimmedContact
      : undefined;
    const noteParts = [
      note.trim(),
      trimmedContact && !trimmedContact.includes("@")
        ? `Whatsapp/Zalo: ${trimmedContact}`
        : "",
      shipToDifferent && altPhone.trim()
        ? `SĐT người nhận khác: ${altPhone.trim()}`
        : "",
    ].filter(Boolean);

    setSubmitting(true);
    try {
      const res = await apiFetch<{
        data: {
          orderCode: string;
          totalAmount: number;
          paymentGateway: string;
          paymentStatus: string;
          fulfillmentStatus: string;
          paymentUrl?: string;
          qrCode?: string;
          reservedUntil?: string;
        };
      }>("/public/orders", {
        method: "POST",
        headers: customerToken
          ? { Authorization: `Bearer ${customerToken}` }
          : undefined,
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            variantKey: i.variantId,
            quantity: i.quantity,
          })),
          shippingAddress: {
            fullName:
              shipToDifferent && altFullName.trim()
                ? altFullName.trim()
                : fullName.trim(),
            phone:
              shipToDifferent && isValidPhoneVN(altPhone)
                ? normalizePhoneVN(altPhone)
                : normalizePhoneVN(phone),
            email: emailValue,
            province: province.trim(),
            district: district.trim() || "Trung tâm",
            ward: "Phường trung tâm",
            addressLine:
              shipToDifferent && altAddress.trim()
                ? altAddress.trim()
                : addressLine.trim(),
            note: noteParts.length > 0 ? noteParts.join(" | ") : undefined,
          },
          paymentGateway,
          couponCode: appliedCoupon || undefined,
          selectedGiftProductId:
            selectedGiftId &&
            pricing?.eligibleGifts?.some((g) => g.productId === selectedGiftId)
              ? selectedGiftId
              : undefined,
        }),
      });

      const orderData = res?.data;
      if (orderData?.orderCode) {
        let finalPaymentUrl = orderData.paymentUrl || "";
        let finalQrCode = orderData.qrCode || "";

        // Nếu chọn thanh toán PAYOS:
        // Đảm bảo luôn tạo Link và Mã QR PayOS THẬT từ máy chủ PayOS (kể cả khi FE đang mock dữ liệu sản phẩm)
        // để người dùng có thể demo quét mã QR thực tế 100% cho khách hàng xem
        if (paymentGateway === "PAYOS") {
          try {
            const payosRes = await fetch("/api/payos/create-payment-link", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderCode: orderData.orderCode,
                amount: orderData.totalAmount || pricing?.totalAmount || 50000,
                description: `11S ${orderData.orderCode}`.slice(0, 25),
              }),
            });
            const payosJson = await payosRes.json();
            if (payosJson.success && payosJson.data?.checkoutUrl) {
              finalPaymentUrl = payosJson.data.checkoutUrl;
              finalQrCode = payosJson.data.qrCode;
            }
          } catch (payosErr) {
            console.error("Lỗi khi kết nối cổng thanh toán PayOS:", payosErr);
          }
        }

        const finalOrderData = {
          ...orderData,
          paymentUrl: finalPaymentUrl,
          qrCode: finalQrCode,
        };

        try {
          sessionStorage.setItem(
            "11sport_last_order",
            JSON.stringify(finalOrderData)
          );
          sessionStorage.removeItem("11sport_checkout_prefs");
        } catch {
          // Ignore
        }

        // Nếu có link thanh toán thật từ PayOS, chuyển hướng ngay sang cổng PayOS
        // QUAN TRỌNG: KHÔNG gọi clearCart() tại đây!
        // Giữ nguyên toàn bộ sản phẩm trong giỏ hàng để nếu khách bấm "Hủy" trên PayOS và quay về,
        // sản phẩm vẫn còn nguyên. Chỉ xóa giỏ hàng khi đơn hàng thanh toán thành công (hoặc COD).
        if (
          paymentGateway === "PAYOS" &&
          finalPaymentUrl &&
          finalPaymentUrl.startsWith("http")
        ) {
          window.location.href = finalPaymentUrl;
          return;
        }

        // Nếu là COD hoặc đơn hoàn tất tại shop: dọn sạch giỏ hàng và sang trang kết quả
        clearCart();
        router.push(
          `/thanh-toan/order-received/${encodeURIComponent(orderData.orderCode)}`
        );
      } else {
        setErrorMsg("Không nhận được mã đơn hàng từ hệ thống.");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg("Không thể kết nối máy chủ đặt hàng. Vui lòng thử lại sau.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner thông báo khi khách bấm Hủy thanh toán từ PayOS */}
      {isCancelled && (
        <div className="border border-[#f59e0b] bg-[#fffbeb] p-4 text-[#92400e] flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-[#d97706] mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-[14px]">
              Giao dịch thanh toán PayOS đã được hủy
            </p>
            <p className="text-[13px] text-[#b45309]">
              Các sản phẩm bạn đã chọn vẫn được lưu đầy đủ trong giỏ hàng bên dưới. Bạn có thể chọn lại phương thức thanh toán khác hoặc điều chỉnh đơn hàng để tiếp tục đặt hàng.
            </p>
          </div>
        </div>
      )}

      {/* Top 1-Line Coupon Toggle (1:1 mipik.vn) */}
      <div className="border-b border-[#ececec] pb-4 text-[13.5px]">
        <p className="text-[#333333]">
          Bạn có mã ưu đãi?{" "}
          <button
            type="button"
            onClick={() => setShowCouponBox((prev) => !prev)}
            className="text-[#224e40] hover:underline font-medium"
          >
            Ấn vào đây để nhập mã
          </button>
        </p>

        {showCouponBox && (
          <div className="mt-3 p-4 sm:p-5 border-2 border-dashed border-[#dddddd] bg-white space-y-3 max-w-xl">
            <p className="text-[13px] text-[#555555]">
              Nếu bạn có mã giảm giá, vui lòng điền vào phía bên dưới (VD: SALE11).
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setAppliedCoupon(couponInput.trim().toUpperCase());
                  }
                }}
                placeholder="Mã ưu đãi"
                aria-label="Mã ưu đãi"
                className={`${SHARP_INPUT_CLS} sm:flex-1`}
              />
              <button
                type="button"
                onClick={() => setAppliedCoupon(couponInput.trim().toUpperCase())}
                className="h-[40px] px-6 rounded-none bg-[#224e40] hover:bg-[#193b30] text-white text-[12.5px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap"
              >
                ÁP DỤNG
              </button>
            </div>
            {pricing?.couponError && (
              <p className="text-xs text-[#dd3333] font-medium">
                {pricing.couponError}
              </p>
            )}
            {pricing?.couponApplied && (
              <p className="text-xs text-[#204b3e] font-bold">
                Đã áp dụng mã {pricing.couponApplied.code}:{" "}
                {pricing.couponApplied.name}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Main 7:5 Checkout Form */}
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
      >
        {/* LEFT 7 COLS: Flat Clean White Billing & Shipping Form */}
        <div className="lg:col-span-7 space-y-5">
          {errorMsg && (
            <div
              role="alert"
              className="border border-[#dd3333]/35 bg-[#fef2f2] text-[#b91c1c] p-3.5 flex items-start gap-2.5 text-[13.5px] font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-[16px] sm:text-[17px] font-bold uppercase tracking-wide text-[#0a0a0a]">
              THÔNG TIN THANH TOÁN
            </h2>

            <div>
              <label htmlFor="checkout-name" className={LABEL_CLS}>
                Họ và Tên <span className="text-[#dd3333]">*</span>
              </label>
              <input
                id="checkout-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Họ và tên"
                className={SHARP_INPUT_CLS}
              />
            </div>

            <div>
              <label htmlFor="checkout-phone" className={LABEL_CLS}>
                Số điện thoại <span className="text-[#dd3333]">*</span>
              </label>
              <input
                id="checkout-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(formatPhoneVN(e.target.value))}
                placeholder="Số điện thoại"
                className={`${SHARP_INPUT_CLS} tabular-nums`}
              />
            </div>

            <div>
              <label htmlFor="checkout-contact" className={LABEL_CLS}>
                Email / Whatsapp (tuỳ chọn)
              </label>
              <input
                id="checkout-contact"
                type="text"
                value={contactExtra}
                onChange={(e) => setContactExtra(e.target.value)}
                placeholder="Email nhận hóa đơn hoặc Whatsapp / Viber"
                className={SHARP_INPUT_CLS}
              />
            </div>

            <div>
              <label htmlFor="checkout-address" className={LABEL_CLS}>
                Địa chỉ <span className="text-[#dd3333]">*</span>
              </label>
              <input
                id="checkout-address"
                type="text"
                required
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                placeholder="Địa chỉ"
                className={SHARP_INPUT_CLS}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="checkout-province" className={LABEL_CLS}>
                  Tỉnh / Thành phố <span className="text-[#dd3333]">*</span>
                </label>
                <input
                  id="checkout-province"
                  type="text"
                  required
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className={SHARP_INPUT_CLS}
                />
              </div>

              <div>
                <label htmlFor="checkout-district" className={LABEL_CLS}>
                  Quận / Huyện (tuỳ chọn)
                </label>
                <input
                  id="checkout-district"
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="VD: Quận 10"
                  className={SHARP_INPUT_CLS}
                />
              </div>
            </div>

            {/* Ship to different address checkbox */}
            <div className="pt-1">
              <label className="inline-flex items-center gap-2.5 text-[14px] text-[#333333] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={shipToDifferent}
                  onChange={(e) => setShipToDifferent(e.target.checked)}
                  className="w-4 h-4 accent-[#224e40]"
                />
                <span>Giao hàng đến một địa chỉ khác?</span>
              </label>

              {shipToDifferent && (
                <div className="mt-3 p-4 border border-[#ececec] bg-[#fafafa] space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="alt-name" className={LABEL_CLS}>
                        Họ tên người nhận <span className="text-[#dd3333]">*</span>
                      </label>
                      <input
                        id="alt-name"
                        type="text"
                        value={altFullName}
                        onChange={(e) => setAltFullName(e.target.value)}
                        placeholder="Tên người nhận hàng"
                        className={SHARP_INPUT_CLS}
                      />
                    </div>
                    <div>
                      <label htmlFor="alt-phone" className={LABEL_CLS}>
                        Số điện thoại nhận
                      </label>
                      <input
                        id="alt-phone"
                        type="tel"
                        value={altPhone}
                        onChange={(e) => setAltPhone(formatPhoneVN(e.target.value))}
                        placeholder="Số điện thoại người nhận"
                        className={SHARP_INPUT_CLS}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="alt-address" className={LABEL_CLS}>
                      Địa chỉ nhận hàng <span className="text-[#dd3333]">*</span>
                    </label>
                    <input
                      id="alt-address"
                      type="text"
                      value={altAddress}
                      onChange={(e) => setAltAddress(e.target.value)}
                      placeholder="Số nhà, đường, quận/huyện, tỉnh thành..."
                      className={SHARP_INPUT_CLS}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <h2 className="text-[16px] sm:text-[17px] font-bold uppercase tracking-wide text-[#0a0a0a]">
              THÔNG TIN BỔ SUNG
            </h2>
            <div>
              <label htmlFor="checkout-note" className={LABEL_CLS}>
                Ghi chú đơn hàng (tuỳ chọn)
              </label>
              <textarea
                id="checkout-note"
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú về đơn hàng, ví dụ: thời gian hay chỉ dẫn địa điểm giao hàng chi tiết hơn."
                className="w-full p-3 rounded-none border border-[#dddddd] bg-white text-[14px] text-[#0a0a0a] placeholder:text-[#999999] focus:outline-none focus:border-[#224e40]"
              />
            </div>
          </div>
        </div>

        {/* RIGHT 5 COLS: Flatsome `.is-well` Order Review & Payment Card */}
        <aside className="lg:col-span-5 lg:sticky lg:top-24 bg-[#fafafa] border border-[#e5e5e5] shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-5 sm:p-7 rounded-none space-y-4">
          <h2 className="text-[16px] sm:text-[17px] font-bold uppercase tracking-wide text-[#0a0a0a]">
            ĐƠN HÀNG CỦA BẠN
          </h2>

          {/* Concise Text-Only Review Table */}
          <div className="text-[13.5px]">
            <div className="flex items-center justify-between pb-2.5 border-b-[3px] border-[#ececec] text-[12px] font-bold uppercase tracking-wider text-[#777777]">
              <span>SẢN PHẨM</span>
              <span>TẠM TÍNH</span>
            </div>

            <div className="divide-y divide-[#ececec]">
              {items.map((item) => {
                const lineCalc = localPricing.lines.find(
                  (l) =>
                    l.productId === item.productId &&
                    l.variantKey === item.variantId
                );
                const lineSubtotal =
                  lineCalc?.lineSubtotal ?? item.price * item.quantity;
                const variantLabel = [item.colorName, item.sizeName]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <div
                    key={item.variantId}
                    className="py-3 flex items-baseline justify-between gap-3"
                  >
                    <span className="text-[#555555] leading-snug">
                      {item.name}
                      {variantLabel ? ` (${variantLabel})` : ""}{" "}
                      <strong className="text-[#0a0a0a]">× {item.quantity}</strong>
                    </span>
                    <span className="font-bold text-[#0a0a0a] tabular-nums whitespace-nowrap shrink-0">
                      {formatPriceByCurrency(lineSubtotal, mounted ? currency : "VND")}
                    </span>
                  </div>
                );
              })}

              {activeGift && (
                <div className="py-3 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-[#204b3e] leading-snug">
                      <span>{activeGift.productName}</span>{" "}
                      <strong className="text-[#0a0a0a]">× 1</strong>
                      <p className="text-[11.5px] text-[#4a6b5d]">
                        Quà tặng 11Sport: Miễn phí
                      </p>
                    </div>
                    <span className="font-bold text-[#0a0a0a] tabular-nums shrink-0">
                      {formatPriceByCurrency(0, mounted ? currency : "VND")}
                    </span>
                  </div>

                  {eligibleGifts.length > 1 && (
                    <div className="pt-1 space-y-1">
                      {eligibleGifts.map((g) => (
                        <label
                          key={g.productId}
                          className="flex items-center gap-2 text-xs text-[#204b3e] cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="checkout-gift"
                            checked={selectedGiftId === g.productId}
                            onChange={() => setSelectedGiftId(g.productId)}
                            className="accent-[#224e40]"
                          />
                          <span>{g.productName}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="py-3 flex items-center justify-between gap-3">
                <span className="font-semibold text-[#333333]">Tạm tính</span>
                <span className="font-bold text-[#0a0a0a] tabular-nums">
                  {formatPriceByCurrency(rawSubtotal, mounted ? currency : "VND")}
                </span>
              </div>

              {tierDiscountTotal > 0 && (
                <div className="py-3 flex items-center justify-between gap-3 text-[#204b3e]">
                  <span>Tiết kiệm Giá Mua Nhiều</span>
                  <span className="font-bold tabular-nums">
                    -{formatPriceByCurrency(tierDiscountTotal, mounted ? currency : "VND")}
                  </span>
                </div>
              )}

              {couponDiscount > 0 && (
                <div className="py-3 flex items-center justify-between gap-3 text-[#204b3e]">
                  <span>Mã ưu đãi</span>
                  <span className="font-bold tabular-nums">
                    -{formatPriceByCurrency(couponDiscount, mounted ? currency : "VND")}
                  </span>
                </div>
              )}

              <div className="py-3 flex items-center justify-between gap-3">
                <span className="font-semibold text-[#333333]">Vận chuyển</span>
                <span className="text-[#555555] text-right">
                  {shippingFee === 0
                    ? "Miễn phí vận chuyển"
                    : formatPriceByCurrency(shippingFee, mounted ? currency : "VND")}
                </span>
              </div>

              <div className="py-3.5 border-b-2 border-[#ececec] flex items-center justify-between gap-3">
                <span className="font-bold text-[#0a0a0a]">Tổng</span>
                <span className="text-[16px] font-bold text-[#0a0a0a] tabular-nums">
                  {formatPriceByCurrency(totalAmount, mounted ? currency : "VND")}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Methods List INSIDE Order Summary Box (1:1 mipik.vn) */}
          <ul className="divide-y divide-[#ececec] text-[13.5px]">
            <li className="py-3 space-y-1.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="paymentGateway"
                  value="PAYOS"
                  checked={paymentGateway === "PAYOS"}
                  onChange={() => setPaymentGateway("PAYOS")}
                  className="mt-1 accent-[#224e40]"
                />
                <span className="font-bold text-[#0a0a0a] leading-snug">
                  Chuyển khoản ngân hàng QR (VietQR / PayOS)
                </span>
              </label>
              {paymentGateway === "PAYOS" && (
                <p className="pl-6 text-[12.5px] text-[#555555] leading-relaxed">
                  Thanh toán bằng thẻ ATM nội địa, QR VietQR / PayOS, xác nhận tự động 24/7 và ưu tiên đóng gói.
                </p>
              )}
            </li>

            <li className="py-3 space-y-1.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="radio"
                  name="paymentGateway"
                  value="COD"
                  checked={paymentGateway === "COD"}
                  onChange={() => setPaymentGateway("COD")}
                  className="mt-1 accent-[#224e40]"
                />
                <span className="font-bold text-[#0a0a0a] leading-snug">
                  Thanh toán khi nhận hàng (COD) · 11Sport liên hệ xác nhận
                </span>
              </label>
              {paymentGateway === "COD" && (
                <p className="pl-6 text-[12.5px] text-[#555555] leading-relaxed">
                  Hỗ trợ mở hộp đồng kiểm vợt &amp; quét chip NFC chính hãng trước khi thanh toán.
                </p>
              )}
            </li>
          </ul>

          {/* Full-width Sharp #224e40 Place Order CTA */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-[46px] rounded-none bg-[#224e40] hover:bg-[#193b30] text-white text-[13.5px] font-bold uppercase tracking-wider transition-colors disabled:opacity-60"
          >
            {submitting ? "ĐANG XỬ LÝ ĐƠN HÀNG..." : "ĐẶT HÀNG"}
          </button>

          <p className="text-[12.5px] text-[#555555] leading-relaxed">
            Bộ phận CSKH sẽ liên hệ bạn qua số điện thoại để xác nhận đơn hàng.
          </p>
        </aside>
      </form>
    </div>
  );
}
