import { NextResponse } from "next/server";
import crypto from "crypto";

const PAYOS_CLIENT_ID =
  process.env.PAYOS_CLIENT_ID || "e9f36b27-df3f-4012-82fd-37d5df09692d";
const PAYOS_API_KEY =
  process.env.PAYOS_API_KEY || "27764fd4-63d8-48c2-a258-0e590594f5b3";
const PAYOS_CHECKSUM_KEY =
  process.env.PAYOS_CHECKSUM_KEY ||
  "d25fc5776b685117af343800df1d872d46b19f94d0953de6a6cc40bf19b3d94a";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const amount = Number(body.amount || 10000);
    // PayOS bắt buộc orderCode là số nguyên dương < 9007199254740991
    const rawOrderCode = body.orderCode;
    const numericOrderCode =
      typeof rawOrderCode === "number" && rawOrderCode > 0
        ? rawOrderCode
        : Number(Date.now().toString().slice(-8));

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3002";
    const displayOrderCode = String(rawOrderCode || numericOrderCode);

    const cancelUrl = `${siteUrl}/thanh-toan?cancelled=1`;
    const returnUrl = `${siteUrl}/thanh-toan/order-received/${encodeURIComponent(
      displayOrderCode
    )}?status=PAID`;

    // PayOS yêu cầu description tối đa 25 ký tự, không dấu, không ký tự đặc biệt
    const cleanDesc = (body.description || `11S ${numericOrderCode}`)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .trim()
      .slice(0, 25);

    // Ký chữ ký HMAC SHA256 theo đúng thứ tự alphabet: amount, cancelUrl, description, orderCode, returnUrl
    const dataStr = `amount=${amount}&cancelUrl=${cancelUrl}&description=${cleanDesc}&orderCode=${numericOrderCode}&returnUrl=${returnUrl}`;
    const signature = crypto
      .createHmac("sha256", PAYOS_CHECKSUM_KEY)
      .update(dataStr)
      .digest("hex");

    const payosRes = await fetch(
      "https://api-merchant.payos.vn/v2/payment-requests",
      {
        method: "POST",
        headers: {
          "x-client-id": PAYOS_CLIENT_ID,
          "x-api-key": PAYOS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderCode: numericOrderCode,
          amount,
          description: cleanDesc,
          cancelUrl,
          returnUrl,
          signature,
        }),
      }
    );

    const payosData = await payosRes.json();

    if (payosData.code === "00" && payosData.data?.checkoutUrl) {
      return NextResponse.json({
        success: true,
        data: payosData.data,
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: payosData.desc || "Không thể tạo link thanh toán PayOS",
        payosResponse: payosData,
      },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: err.message || "Lỗi máy chủ khi tạo link PayOS",
      },
      { status: 500 }
    );
  }
}
