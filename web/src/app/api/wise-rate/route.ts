import { NextRequest, NextResponse } from "next/server";

const WISE_BASE_URL = (
  process.env.WISE_API_BASE_URL || "https://api.wise.com"
).replace(/\/+$/, "");

async function callWiseQuotes(payload: {
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount?: number | null;
  targetAmount?: number | null;
}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const token = (process.env.WISE_API_TOKEN || "").trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${WISE_BASE_URL}/v3/quotes`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Wise API HTTP ${res.status}: ${text.slice(0, 150)}`);
  }

  return res.json();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sourceCurrency = (searchParams.get("source") || "USD")
    .trim()
    .toUpperCase();
  const targetCurrency = (searchParams.get("target") || "VND")
    .trim()
    .toUpperCase();

  if (sourceCurrency === targetCurrency) {
    return NextResponse.json({
      data: {
        sourceCurrency,
        targetCurrency,
        rate: 1,
        inverseRate: 1,
        rateDisplay: `1 ${sourceCurrency} = 1 ${targetCurrency}`,
        rateTimestamp: new Date().toISOString(),
      },
    });
  }

  try {
    // Nếu sourceCurrency !== 'VND', gọi trực tiếp chiều thuận lên Wise API v3
    if (sourceCurrency !== "VND") {
      try {
        const quote = await callWiseQuotes({
          sourceCurrency,
          targetCurrency,
          sourceAmount: 100,
          targetAmount: null,
        });
        const rate = Number(quote.rate);
        if (rate > 0) {
          const inverseRate = 1 / rate;
          return NextResponse.json({
            data: {
              sourceCurrency,
              targetCurrency,
              rate,
              inverseRate,
              rateDisplay:
                rate >= 1
                  ? `1 ${sourceCurrency} = ${rate.toLocaleString("en-US", {
                      maximumFractionDigits: 4,
                    })} ${targetCurrency}`
                  : `1 ${targetCurrency} = ${inverseRate.toLocaleString(
                      "en-US",
                      { maximumFractionDigits: 4 }
                    )} ${sourceCurrency}`,
              rateTimestamp:
                quote.rateTimestamp ||
                quote.createdTime ||
                new Date().toISOString(),
            },
          });
        }
      } catch {
        // Nếu chiều thuận không được hỗ trợ trực tiếp trên Wise (422), thử chiều ngược bên dưới
      }
    }

    // Trường hợp sourceCurrency === 'VND' (hoặc cặp tiền chỉ mở chiều ngược trên Wise):
    // Gọi Wise API theo chiều targetCurrency -> sourceCurrency để lấy đúng tỷ giá thực tế
    const reverseQuote = await callWiseQuotes({
      sourceCurrency: targetCurrency,
      targetCurrency: sourceCurrency,
      sourceAmount: 100,
      targetAmount: null,
    });
    const reverseRate = Number(reverseQuote.rate);
    if (!reverseRate || reverseRate <= 0) {
      throw new Error("Không nhận được tỷ giá hợp lệ từ Wise API");
    }

    const rate = 1 / reverseRate;
    return NextResponse.json({
      data: {
        sourceCurrency,
        targetCurrency,
        rate,
        inverseRate: reverseRate,
        rateDisplay:
          reverseRate >= 1
            ? `1 ${targetCurrency} = ${reverseRate.toLocaleString("en-US", {
                maximumFractionDigits: 4,
              })} ${sourceCurrency}`
            : `1 ${sourceCurrency} = ${rate.toLocaleString("en-US", {
                maximumFractionDigits: 4,
              })} ${targetCurrency}`,
        rateTimestamp:
          reverseQuote.rateTimestamp ||
          reverseQuote.createdTime ||
          new Date().toISOString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        code: "WISE_API_ERROR",
        message: err?.message || "Không thể lấy tỷ giá từ Wise API",
      },
      { status: 502 }
    );
  }
}
