"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Product,
  Order,
  apiRequest,
  formatVND,
  formatDateTime,
} from "@/lib/api";
import {
  Search,
  ShoppingCart,
  UserCheck,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Landmark,
  Printer,
  CheckCircle2,
  AlertCircle,
  History,
} from "lucide-react";

interface PosTabProps {
  onOpenInvoice: (order: Order) => void;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export default function PosTab({ onOpenInvoice }: PosTabProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Giỏ hàng
  const [cart, setCart] = useState<CartItem[]>([]);

  // Thông tin khách hàng
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [lookingUp, setLookingUp] = useState(false);

  // Thanh toán
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANKING" | "CARD">("CASH");
  const [hasCardFee, setHasCardFee] = useState<boolean>(true);
  const [note, setNote] = useState("Giá đã bao gồm thuế");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchSellableProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const q = new URLSearchParams();
      if (search.trim()) q.set("search", search.trim());
      const res = await apiRequest<Product[]>(`/products?${q.toString()}`);
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể tải danh sách sản phẩm");
    } finally {
      setLoadingProducts(false);
    }
  }, [search]);

  useEffect(() => {
    fetchSellableProducts();
  }, [fetchSellableProducts]);

  // Tự động tra cứu khách hàng theo SĐT
  const handleLookupPhone = async (phoneValue: string) => {
    const clean = phoneValue.trim();
    if (clean.length < 9) {
      setIsExistingCustomer(false);
      setCustomerOrders([]);
      return;
    }
    setLookingUp(true);
    try {
      const res = await apiRequest<any>(`/customers/lookup?phone=${encodeURIComponent(clean)}`);
      const customer = res.data?.customer || res.data;
      const orders = res.data?.orders || [];
      if (customer && (customer.fullName || customer.name || customer.customerName)) {
        setCustomerName(customer.fullName || customer.name || customer.customerName);
        setIsExistingCustomer(true);
        setCustomerOrders(Array.isArray(orders) ? orders : []);
      } else {
        setIsExistingCustomer(false);
        setCustomerOrders([]);
      }
    } catch {
      setIsExistingCustomer(false);
      setCustomerOrders([]);
    } finally {
      setLookingUp(false);
    }
  };

  const handleAddToCart = (product: Product) => {
    setErrorMsg("");
    if (product.sellingPrice <= 0) {
      setErrorMsg(
        `Sản phẩm "${product.name}" chưa có giá bán lẻ (> 0). Vui lòng cập nhật giá trên CMS trước khi bán.`
      );
      return;
    }
    if (product.stock <= 0) {
      setErrorMsg(`Sản phẩm "${product.name}" đã hết tồn kho.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((c) => c.product._id === product._id);
      if (existing) {
        if (existing.quantity + 1 > product.stock) {
          setErrorMsg(
            `Không thể vượt quá tồn kho hiện tại (${product.stock} ${product.unit}) của "${product.name}".`
          );
          return prev;
        }
        return prev.map((c) =>
          c.product._id === product._id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleChangeQty = (productId: string, newQty: number) => {
    setErrorMsg("");
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.product._id !== productId) return c;
          if (newQty <= 0) return null;
          if (newQty > c.product.stock) {
            setErrorMsg(
              `Số lượng tối đa trong kho của "${c.product.name}" là ${c.product.stock}.`
            );
            return { ...c, quantity: c.product.stock };
          }
          return { ...c, quantity: newQty };
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.sellingPrice * item.quantity,
    0
  );
  const cardFee =
    paymentMethod === "CARD" && hasCardFee ? Math.round(subtotal * 0.03) : 0;
  const totalAmount = subtotal + cardFee;

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!customerPhone.trim()) {
      setErrorMsg("Vui lòng nhập Số điện thoại khách hàng (bắt buộc).");
      return;
    }
    if (!customerName.trim()) {
      setErrorMsg("Vui lòng nhập Tên khách hàng (bắt buộc).");
      return;
    }
    if (cart.length === 0) {
      setErrorMsg("Giỏ hàng đang trống. Vui lòng chọn ít nhất 1 sản phẩm.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customerPhone: customerPhone.trim(),
        customerName: customerName.trim(),
        paymentMethod,
        hasCardFee: paymentMethod === "CARD" ? hasCardFee : false,
        note: note.trim() || "Giá đã bao gồm thuế",
        items: cart.map((c) => ({
          productId: c.product._id,
          quantity: c.quantity,
        })),
      };

      const res = await apiRequest<Order>("/orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const createdOrder = res.data;
      setSuccessMsg(
        `Tạo đơn hàng ${createdOrder.orderCode || createdOrder.code || ""} thành công!`
      );
      setCart([]);
      fetchSellableProducts();
      onOpenInvoice(createdOrder);
    } catch (err: any) {
      setErrorMsg(err?.message || "Lỗi khi tạo đơn bán hàng");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Cột trái (7 phần): Tìm kiếm & Chọn sản phẩm */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Danh mục Hàng hóa tại Quầy POS
              </h2>
              <p className="text-xs text-slate-500">
                Chỉ cho phép thêm vào giỏ các mặt hàng có <strong>Giá bán &gt; 0</strong> và{" "}
                <strong>Tồn kho &gt; 0</strong>.
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Quét mã / tìm tên sản phẩm..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {loadingProducts ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Đang tải danh sách sản phẩm...
            </div>
          ) : products.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Không tìm thấy sản phẩm phù hợp.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
              {products.map((p) => {
                const canSell = p.sellingPrice > 0 && p.stock > 0;
                return (
                  <div
                    key={p._id}
                    onClick={() => canSell && handleAddToCart(p)}
                    className={`p-3.5 rounded-xl border transition flex flex-col justify-between ${
                      canSell
                        ? "border-slate-200 hover:border-emerald-500 hover:shadow-md cursor-pointer bg-white"
                        : "border-slate-200 bg-slate-50 opacity-70 cursor-not-allowed"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 break-all min-w-0">
                          {p.code}
                        </span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 whitespace-nowrap ${
                            p.stock > 0
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          Tồn: {p.stock} {p.unit}
                        </span>
                      </div>
                      <h3 className="font-semibold text-slate-900 text-sm mt-2 break-words line-clamp-2">
                        {p.name}
                      </h3>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      {p.sellingPrice > 0 ? (
                        <span className="font-mono font-extrabold text-emerald-700 text-base">
                          {formatVND(p.sellingPrice)}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                          Chưa có giá bán (0 ₫)
                        </span>
                      )}

                      <button
                        type="button"
                        disabled={!canSell}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(p);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${
                          canSell
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" /> Chọn
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cột phải (5 phần): Thông tin Khách hàng, Giỏ hàng & Thanh toán */}
      <div className="lg:col-span-5 space-y-4">
        <form
          onSubmit={handleCreateOrder}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">Phiếu Bán Hàng POS</h2>
            </div>
            <span className="text-xs font-mono bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-semibold">
              {cart.reduce((s, i) => s + i.quantity, 0)} sản phẩm
            </span>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. Tra cứu SĐT Khách hàng */}
          <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase text-slate-700">
                1. Thông tin Khách hàng (Tra cứu SĐT)
              </label>
              {isExistingCustomer && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  <UserCheck className="w-3.5 h-3.5" /> Khách quen ({customerOrders.length} đơn)
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Số điện thoại *
                </label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value);
                    handleLookupPhone(e.target.value);
                  }}
                  placeholder="VD: 0901234567"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm focus:border-emerald-600 focus:outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Họ tên khách hàng * {lookingUp && "(Đang tìm...)"}
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Tự điền nếu khách cũ..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-emerald-600 focus:outline-none bg-white"
                />
              </div>
            </div>

            {/* Lịch sử mua nhanh của khách quen */}
            {customerOrders.length > 0 && (
              <div className="pt-2 border-t border-slate-200">
                <div className="text-[11px] font-semibold text-slate-600 flex items-center gap-1 mb-1.5">
                  <History className="w-3.5 h-3.5 text-emerald-600" />
                  Đơn mua gần đây của khách:
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {customerOrders.slice(0, 3).map((ord) => (
                    <div
                      key={ord._id}
                      className="flex items-center justify-between text-xs bg-white px-2.5 py-1.5 rounded border border-slate-200"
                    >
                      <span className="font-mono font-semibold text-slate-800">
                        {ord.orderCode || ord.code}
                      </span>
                      <span className="text-slate-500">{formatDateTime(ord.createdAt)}</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {formatVND(ord.totalAmount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenInvoice(ord)}
                        className="text-blue-600 hover:underline font-semibold flex items-center gap-0.5"
                      >
                        <Printer className="w-3 h-3" /> PDF
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Danh sách Giỏ hàng */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-slate-700">
              2. Giỏ hàng hiện tại
            </label>
            {cart.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                Chưa có sản phẩm nào trong giỏ hàng
              </div>
            ) : (
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl max-h-64 overflow-y-auto">
                {cart.map((item) => (
                  <div
                    key={item.product._id}
                    className="p-3 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 truncate">
                        {item.product.name}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {formatVND(item.product.sellingPrice)} × {item.quantity}{" "}
                        {item.product.unit}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleChangeQty(item.product._id, item.quantity - 1)
                        }
                        className="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={item.product.stock}
                        value={item.quantity}
                        onChange={(e) =>
                          handleChangeQty(
                            item.product._id,
                            Math.max(1, Number(e.target.value))
                          )
                        }
                        className="w-12 text-center font-mono font-bold border border-slate-300 rounded py-1"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleChangeQty(item.product._id, item.quantity + 1)
                        }
                        className="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-right font-mono font-bold text-slate-900 w-24">
                      {formatVND(item.product.sellingPrice * item.quantity)}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleChangeQty(item.product._id, 0)}
                      className="text-red-500 hover:bg-red-50 p-1 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Phương thức thanh toán & Phí quẹt thẻ 3% */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase text-slate-700">
              3. Phương thức thanh toán
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("CASH")}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition ${
                  paymentMethod === "CASH"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Banknote className="w-4 h-4" />
                Tiền mặt
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("BANKING")}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition ${
                  paymentMethod === "BANKING"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Landmark className="w-4 h-4" />
                Chuyển khoản
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("CARD")}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition ${
                  paymentMethod === "CARD"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Quẹt Thẻ
              </button>
            </div>

            {paymentMethod === "CARD" && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                <div className="text-xs font-bold text-amber-900">
                  Tùy chọn phí quẹt thẻ (BR-12):
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs font-semibold ${
                      hasCardFee
                        ? "border-amber-600 bg-white text-amber-900"
                        : "border-amber-200 text-slate-600"
                    }`}
                  >
                    <input
                      type="radio"
                      checked={hasCardFee}
                      onChange={() => setHasCardFee(true)}
                    />
                    Có phí 3% (+{formatVND(Math.round(subtotal * 0.03))})
                  </label>
                  <label
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs font-semibold ${
                      !hasCardFee
                        ? "border-amber-600 bg-white text-amber-900"
                        : "border-amber-200 text-slate-600"
                    }`}
                  >
                    <input
                      type="radio"
                      checked={!hasCardFee}
                      onChange={() => setHasCardFee(false)}
                    />
                    Không phí (0 ₫)
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* 4. Ghi chú & Tổng kết thanh toán */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
              Ghi chú hóa đơn
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
          </div>

          <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Tổng tiền hàng (Subtotal):</span>
              <span className="font-mono font-semibold">{formatVND(subtotal)}</span>
            </div>
            {paymentMethod === "CARD" && (
              <div className="flex justify-between text-xs text-amber-300">
                <span>Phí quẹt thẻ ({hasCardFee ? "3%" : "0%"}):</span>
                <span className="font-mono font-semibold">+{formatVND(cardFee)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-extrabold pt-2 border-t border-slate-700">
              <span>KHÁCH CẦN THANH TOÁN:</span>
              <span className="font-mono text-emerald-400 text-lg">
                {formatVND(totalAmount)}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || cart.length === 0}
            className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition"
          >
            <Printer className="w-5 h-5" />
            {submitting
              ? "Đang xử lý đơn hàng..."
              : "XÁC NHẬN THANH TOÁN & XUẤT HÓA ĐƠN PDF"}
          </button>
        </form>
      </div>
    </div>
  );
}
