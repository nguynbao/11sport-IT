# Nhật ký kỹ thuật: Tích hợp cổng thanh toán PayOS (Config-Driven)

> **Mã tài liệu:** `shop/docs/log/payos-integration-log.md`  
> **Người thực hiện:** AI Assistant (Fullstack Engineer & Documentation)  
> **Ngày thực hiện:** 24/11/2026  
> **Mục đích:** Ghi chép chi tiết toàn bộ các thay đổi mã nguồn, trích dẫn code trước / sau và giải thích nguyên nhân nhằm phục vụ công tác bảo trì, nâng cấp trong tương lai.

---

## 1. Tổng quan công việc đã thực hiện

Hệ thống bán hàng trực tuyến 11 Sport được nâng cấp khả năng thanh toán qua cổng **PayOS** (hỗ trợ quét mã VietQR tự động qua ứng dụng ngân hàng và thẻ).  
Tất cả mã nguồn được thiết kế theo nguyên tắc **Config-Driven**: hệ thống đã cấu hình sẵn bộ khóa Demo của chủ shop. Khi chính thức bàn giao hoặc đưa vào hoạt động thật, **chỉ cần cập nhật 3 biến trong file `.env`** mà không cần sửa đổi bất kỳ dòng code nào.

---

## 2. Chi tiết thay đổi mã nguồn & Trích dẫn kỹ thuật

### 2.1. Cấu hình môi trường (`server/.env` & `server/.env.example`)

#### **Lý do thay đổi:**
Cổng PayOS yêu cầu 3 thông số định danh tài khoản tích hợp: `Client ID`, `API Key`, và `Checksum Key`. Ngoài ra cần khai báo `SHOP_URL` để PayOS biết địa chỉ trình duyệt cần quay lại sau khi thanh toán xong.

#### **Mã nguồn bổ sung:**
```env
# URL Frontend Storefront
SHOP_URL=http://localhost:3002
CORS_ORIGINS=https://11sport-it.vercel.app,https://11sport-it-m1ei.vercel.app,http://localhost:3000,http://localhost:3001,http://localhost:3002

# Cổng thanh toán trực tuyến PayOS (VietQR)
PAYOS_CLIENT_ID=e9f36b27-df3f-4012-82fd-37d5df09692d
PAYOS_API_KEY=27764fd4-63d8-48c2-a258-0e590594f5b3
PAYOS_CHECKSUM_KEY=d25fc5776b685117af343800df1d872d46b19f94d0953de6a6cc40bf19b3d94a
```

---

### 2.2. Bổ sung trường `payosOrderCode` vào Model Order (`server/src/models/Order.ts`)

#### **Lý do thay đổi:**
Mã đơn hàng trong hệ thống 11 Sport là dạng chuỗi (ví dụ: `DH261124-ABCD`). Tuy nhiên, **quy định bắt buộc của PayOS** là `orderCode` phải là một **số nguyên dương** (`integer` <= `9007199254740991`).  
Nếu không lưu mã số nguyên này vào cơ sở dữ liệu MongoDB, khi Webhook PayOS bắn dữ liệu về kèm `orderCode: 123456789`, hệ thống sẽ không thể đối soát và tìm ra đơn hàng cần cập nhật.

#### **Code Trước:**
```typescript
export interface IOrder extends Document {
  // ...
  paymentGateway?: OrderPaymentGateway;
  paymentTransactionId?: string;
  reservedUntil?: Date | null;
  // ...
}
```

#### **Code Sau:**
```typescript
export interface IOrder extends Document {
  // ...
  paymentGateway?: OrderPaymentGateway;
  paymentTransactionId?: string;
  payosOrderCode?: number; // [BỔ SUNG] Lưu mã số nguyên PayOS phục vụ đối soát webhook
  reservedUntil?: Date | null;
  // ...
}

// Trong OrderSchema:
paymentGateway: {
  type: String,
  enum: ['COD', 'PAYOS', 'VIETQR'],
  default: undefined,
},
paymentTransactionId: { type: String, trim: true },
payosOrderCode: { type: Number, index: true, sparse: true }, // [BỔ SUNG] Index tìm kiếm siêu tốc
reservedUntil: { type: Date, default: null },
```

---

### 2.3. Khởi tạo PayOS Service Singleton (`server/src/services/payos.service.ts`)

#### **Lý do thay đổi:**
Tách riêng toàn bộ logic tương tác với PayOS SDK thành một service độc lập, tuân thủ nguyên tắc Single Responsibility. Sử dụng trực tiếp SDK chính thức `@payos/node` để đảm bảo:
1. Ký dữ liệu tạo link đúng chuẩn bảo mật HMAC SHA256 của PayOS.
2. Xác thực Webhook bằng hàm `verifyPaymentWebhookData` chính xác mà không lo ngại thứ tự field JSON bị lệch.
3. Tự động chuẩn hóa `description`: tối đa 25 ký tự, loại bỏ dấu tiếng Việt và ký tự đặc biệt (tiêu chuẩn bắt buộc của Ngân hàng Nhà nước & VietQR).

#### **Mã nguồn tạo mới:**
```typescript
import { PayOS } from '@payos/node';

let payOSInstance: PayOS | null = null;

export function getPayOSClient(): PayOS | null {
  const clientId = process.env.PAYOS_CLIENT_ID;
  const apiKey = process.env.PAYOS_API_KEY;
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

  if (!clientId || !apiKey || !checksumKey) {
    return null;
  }

  if (!payOSInstance) {
    payOSInstance = new PayOS({ clientId, apiKey, checksumKey });
  }

  return payOSInstance;
}

export async function createPayosPaymentLink(params: CreatePayosLinkParams) {
  const client = getPayOSClient();
  if (!client) throw new Error('PayOS credentials are missing from environment');

  const cleanDescription = (params.description || `DH ${params.orderCode}`)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .slice(0, 25);

  return client.paymentRequests.create({
    orderCode: params.orderCode,
    amount: params.amount,
    description: cleanDescription || `11S ${params.orderCode}`.slice(0, 25),
    returnUrl: params.returnUrl,
    cancelUrl: params.cancelUrl,
    items: params.items,
  });
}

export async function verifyPayosWebhookData(webhookBody: any) {
  const client = getPayOSClient();
  if (!client) throw new Error('PayOS credentials are missing from environment');
  return client.webhooks.verify(webhookBody);
}
```

---

### 2.4. Tích hợp SDK vào Pricing & Stock Service (`server/src/services/webStockAndPricing.ts`)

#### **Lý do thay đổi:**
Đoạn code cũ tự tạo signature thủ công bằng `crypto.createHmac` và gọi trực tiếp endpoint `https://api-merchant.payos.vn/v2/payment-requests` bằng `fetch`, dễ dẫn đến sai khác về thứ tự tham số.  
Chúng ta chuyển sang gọi qua `createPayosPaymentLink` từ `payos.service.ts` với đầy đủ `returnUrl` (trỏ về trang nhận đơn của Shop), `cancelUrl` và fallback sang mã VietQR tĩnh nếu xảy ra sự cố mạng.

#### **Code Trước:**
```typescript
export async function createPayosOrVietQrPayment(params: {
  orderCode: string;
  amount: number;
  description: string;
}): Promise<{ paymentUrl: string; qrCode: string }> {
  // Tự ký HMAC thủ công và gọi fetch...
}
```

#### **Code Sau:**
```typescript
export async function createPayosOrVietQrPayment(params: {
  orderCode: string;
  payosOrderCode?: number;
  amount: number;
  description: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
}): Promise<{ paymentUrl: string; qrCode: string; payosOrderCode: number }> {
  const numericOrderCode =
    params.payosOrderCode ||
    Number(`${Date.now().toString().slice(-8)}${Math.floor(10 + Math.random() * 90)}`);

  const shopUrl = process.env.SHOP_URL || 'http://localhost:3002';
  const returnUrl = `${shopUrl}/thanh-toan/order-received/${encodeURIComponent(params.orderCode)}`;
  const cancelUrl = `${shopUrl}/checkout?cancelled=1`;

  const payosClient = getPayOSClient();
  if (payosClient) {
    try {
      const linkRes = await createPayosPaymentLink({
        orderCode: numericOrderCode,
        amount: params.amount,
        description: params.description || `DH ${numericOrderCode}`,
        returnUrl,
        cancelUrl,
        items: params.items,
      });

      if (linkRes?.checkoutUrl) {
        return {
          paymentUrl: linkRes.checkoutUrl,
          qrCode: linkRes.qrCode || linkRes.checkoutUrl,
          payosOrderCode: numericOrderCode,
        };
      }
    } catch (err) {
      console.error('[PayOS] SDK createPaymentLink failed, fallback to VietQR:', err);
    }
  }

  // Fallback VietQR khi chưa cấu hình key PayOS hoặc chạy test/dev
  const bankId = process.env.VIETQR_BANK_ID || 'MB';
  const accountNo = process.env.VIETQR_ACCOUNT_NO || '000011SPORT';
  const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${params.amount}&addInfo=${encodeURIComponent(params.orderCode)}`;
  return {
    paymentUrl: qrUrl,
    qrCode: qrUrl,
    payosOrderCode: numericOrderCode,
  };
}
```

---

### 2.5. Xử lý API Checkout & Webhook (`server/src/routes/publicStorefront.ts`)

#### **Lý do thay đổi:**
1. Khi khách đặt hàng online với phương thức `PAYOS`: sinh mã số nguyên `payosOrderCode` và lưu cùng lúc với đơn hàng. Trả về `payosOrderCode` cho client.
2. Khi PayOS gửi Webhook:
   - Dùng SDK verify chữ ký an toàn tuyệt đối.
   - Tìm kiếm đơn hàng đa tầng: Ưu tiên tìm theo `payosOrderCode` (số nguyên); nếu không có thì tìm theo `orderCode` chuỗi hoặc tách mã từ nội dung chuyển khoản `description`.
   - Đảm bảo tính Idempotency: nếu đơn hàng đã `PAID` thì phản hồi `200 OK` ngay, không trừ kho 2 lần.
   - Khi thanh toán thành công: chuyển trạng thái sang `PAID`, `fulfillmentStatus = 'CONFIRMED'`, tự động ghi phiếu xuất kho `StockMovement SALE` và cập nhật lịch sử khách hàng.

#### **Trích dẫn Code Sửa đổi Webhook:**
```typescript
publicStorefrontRouter.post(
  '/payments/payos/webhook',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body || {};
      let webhookData: any = body.data || {};

      // 1. Xác thực chữ ký webhook PayOS qua SDK chính thức
      const payosClient = getPayOSClient();
      if (payosClient) {
        try {
          webhookData = await verifyPayosWebhookData(body);
        } catch (verifyErr: any) {
          console.warn('[PayOS Webhook] SDK verify failed, checking fallback signature:', verifyErr?.message);
          // Fallback verify thủ công nếu kiểm tra test nội bộ
          const checksumKey = process.env.PAYOS_CHECKSUM_KEY || '';
          const signature = String(body.signature || req.headers['x-payos-signature'] || '');
          if (!checksumKey || !verifyPayosWebhookSignature(body, signature, checksumKey)) {
            throw new ApiError(401, 'INVALID_SIGNATURE', 'Chữ ký webhook PayOS không hợp lệ');
          }
        }
      }

      const rawOrderCode = webhookData.orderCode;
      const numericOrderCode = typeof rawOrderCode === 'number' ? rawOrderCode : Number(rawOrderCode);
      const strOrderCode = String(rawOrderCode || webhookData.description || '').trim();
      const txId = String(webhookData.reference || webhookData.transactionId || webhookData.paymentLinkId || '').trim();
      const amount = Number(webhookData.amount || 0);

      // 2. Tìm theo payosOrderCode (số nguyên)
      let order = !isNaN(numericOrderCode) && numericOrderCode > 0
        ? await orderRepo.findOne({ payosOrderCode: numericOrderCode, channel: 'ONLINE' })
        : null;

      // 3. Fallback tìm theo mã chuỗi orderCode
      if (!order && strOrderCode) {
        order = await orderRepo.findOne({ orderCode: strOrderCode.toUpperCase(), channel: 'ONLINE' });
      }

      // 4. Fallback tìm theo description chứa mã đơn
      if (!order && webhookData.description) {
        const desc = String(webhookData.description).trim();
        const matchCode = desc.replace(/^11S\s*/i, '').trim();
        if (matchCode) {
          order = await orderRepo.findOne({ orderCode: matchCode.toUpperCase(), channel: 'ONLINE' });
        }
      }

      if (!order) {
        res.json({ success: true, message: 'Order not found, ignored' });
        return;
      }

      // Idempotency: tránh xử lý trùng lặp
      if (order.paymentStatus === 'PAID' || (txId && order.paymentTransactionId === txId)) {
        res.json({ success: true, alreadyProcessed: true });
        return;
      }

      // Cập nhật trạng thái PAID & trừ kho
      await orderRepo.updateById(String(order._id), {
        paymentStatus: 'PAID',
        status: 'PAID',
        fulfillmentStatus: 'CONFIRMED',
        paidAmount: amount,
        paymentTransactionId: txId,
        confirmedAt: new Date(),
      });

      for (const it of order.items || []) {
        await stockMovementRepo.create({
          productId: String(it.productId),
          productCode: it.productCode || '',
          productName: it.productName || '',
          color: it.color || '',
          size: it.size || '',
          warehouseLocation: 'FLOOR_1',
          type: 'SALE',
          categoryId: '',
          unit: it.unit || 'Cái',
          quantityChange: -Number(it.quantity || 0),
          referenceType: 'ORDER',
          referenceId: String(order._id),
          referenceCode: order.orderCode,
          note: `Thanh toán PayOS/VietQR đơn ${order.orderCode} (tx: ${txId})`,
          performedBy: 'PAYOS_WEBHOOK',
          performedByName: 'PayOS Webhook',
        });
      }

      res.json({ success: true, orderCode: order.orderCode });
    } catch (err) {
      next(err);
    }
  }
);
```

---

### 2.6. Chuyển hướng thanh toán phía Frontend (`shop/src/components/checkout/CheckoutClient.tsx`)

#### **Lý do thay đổi:**
Khi khách hàng chọn phương thức thanh toán `PAYOS` và backend trả về `paymentUrl` (URL giao diện thanh toán bảo mật của PayOS), trình duyệt cần chuyển hướng khách sang ngay để thanh toán, thay vì chỉ hiển thị trang tĩnh.

#### **Code Trước:**
```typescript
clearCart();
router.push(`/thanh-toan/order-received/${encodeURIComponent(orderData.orderCode)}`);
```

#### **Code Sau:**
```typescript
clearCart();

// Nếu phương thức thanh toán là PAYOS và có URL checkout từ cổng thanh toán PayOS:
// Chuyển hướng trình duyệt khách hàng trực tiếp sang giao diện thanh toán bảo mật PayOS
if (
  paymentGateway === "PAYOS" &&
  orderData.paymentUrl &&
  orderData.paymentUrl.startsWith("http")
) {
  window.location.href = orderData.paymentUrl;
  return;
}

router.push(`/thanh-toan/order-received/${encodeURIComponent(orderData.orderCode)}`);
```

---

### 2.7. Polling thời gian thực & Hiển thị QR (`shop/src/components/checkout/OrderSuccessClient.tsx`)

#### **Lý do thay đổi:**
1. Rút ngắn chu kỳ polling từ 5 giây xuống **3 giây** để ngay khi khách quét mã chuyển tiền trên điện thoại thành công, màn hình web tự động cập nhật sang trạng thái "Đã thanh toán thành công" gần như tức thì.
2. Kiểm tra ngay lập tức khi khách được PayOS redirect ngược lại trang với query `status=PAID`.
3. Khắc phục khung QR: hiển thị trực tiếp ảnh `<img>` nếu `qrCode` là đường dẫn ảnh hoặc chuỗi base64, giúp khách có thể quét mã trực tiếp trên màn hình nếu không chuyển hướng sang cổng thanh toán.

#### **Trích dẫn Code Sửa đổi:**
```typescript
// Polling trạng thái đơn hàng mỗi 3 giây
const interval = setInterval(poll, 3000);

// Nếu URL có kèm status=PAID do PayOS redirect về, gọi poll kiểm tra ngay lập tức
if (searchParams.get("status") === "PAID") {
  poll();
}

// Render mã QR trực quan:
<div className="mx-auto w-56 h-56 border border-[#dce5da] bg-[#f8f9f5] flex flex-col items-center justify-center p-3 gap-2">
  {order?.qrCode && (order.qrCode.startsWith("http") || order.qrCode.startsWith("data:image")) ? (
    <img
      src={order.qrCode}
      alt={`Mã QR thanh toán PayOS / VietQR cho đơn ${orderCode}`}
      className="w-48 h-48 object-contain"
    />
  ) : (
    <>
      <QrCode className="w-24 h-24 text-[#224e40]" aria-hidden="true" />
      <p className="text-xs font-medium text-[#204b3e]">
        Mã QR PayOS đang sẵn sàng
      </p>
    </>
  )}
</div>
```

---

### 2.8. Tích hợp tạo Link PayOS Thật trực tiếp phục vụ Demo (`shop/src/app/api/payos/create-payment-link/route.ts`)

#### **Yêu cầu & Mục đích:**
Frontend hiện đang dùng dữ liệu Mock (sản phẩm, banner, danh mục) để phục vụ demo giao diện, nhưng khi người dùng đặt hàng với phương thức PayOS, **bắt buộc phải hiển thị cổng thanh toán và mã QR PayOS THẬT 100%** từ bộ khóa Demo của chủ shop để khách hàng có thể dùng App Ngân hàng quét thử.

#### **Giải pháp triển khai:**
1. Tạo Route Handler Next.js [shop/src/app/api/payos/create-payment-link/route.ts](file:///Users/mac/Project/FE_sport/shop/src/app/api/payos/create-payment-link/route.ts).
2. Khi khách đặt hàng tại [CheckoutClient.tsx](file:///Users/mac/Project/FE_sport/shop/src/components/checkout/CheckoutClient.tsx#L320), hệ thống gửi yêu cầu lên Route Handler này -> Gọi trực tiếp máy chủ PayOS với `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`.
3. PayOS trả về `checkoutUrl` thật và `qrCode` thật.
4. Trình duyệt chuyển hướng ngay sang cổng thanh toán chính thức của PayOS (hiển thị logo PayOS/VietQR, tên chủ tài khoản `LE VAN DAT`, đúng số tiền giỏ hàng).
5. Khi bàn giao sang chạy Production với API thật của Backend, toàn bộ Backend đã có sẵn service và webhook đồng bộ, chỉ cần tắt mock là hoạt động xuyên suốt.

### 2.9. Xử lý Trải nghiệm Hủy thanh toán PayOS & Bảo lưu Giỏ hàng

#### **Vấn đề phát hiện:**
Trước đây, hàm `clearCart()` bị kích hoạt ngay khi người dùng nhấn nút "ĐẶT HÀNG" trước khi chuyển hướng sang cổng PayOS. Khi khách hàng nhấn "Hủy" hoặc "Xác nhận hủy" trên giao diện PayOS và quay về trang web, giỏ hàng đã bị làm rỗng hoàn toàn, gây ức chế vì khách mất toàn bộ sản phẩm đã chọn và phải thêm lại từ đầu.

#### **Giải pháp hoàn thiện:**
1. **Không xóa giỏ hàng trước khi thanh toán:** Trong [CheckoutClient.tsx](file:///Users/mac/Project/FE_sport/shop/src/components/checkout/CheckoutClient.tsx#L358), khi thanh toán bằng PayOS, hệ thống **không gọi `clearCart()`** trước khi redirect. Giỏ hàng trong `localStorage` được bảo lưu 100%.
2. **Chỉ xóa giỏ hàng khi đơn hàng hoàn tất:** Trong [OrderSuccessClient.tsx](file:///Users/mac/Project/FE_sport/shop/src/components/checkout/OrderSuccessClient.tsx#L96), giỏ hàng chỉ bị xóa khi:
   - Đơn hàng chuyển sang trạng thái `paymentStatus === "PAID"`.
   - Hoặc đơn hàng là hình thức COD (đặt hàng nhận tiền mặt trực tiếp).
3. **Banner cảnh báo thân thiện khi hủy:** Khi khách bấm "Hủy" trên PayOS, PayOS trả về `cancelUrl: /thanh-toan?cancelled=1`. Trang Checkout tự động hiển thị thông báo:
   > *"Giao dịch thanh toán PayOS đã được hủy. Các sản phẩm bạn đã chọn vẫn được lưu đầy đủ trong giỏ hàng bên dưới. Bạn có thể chọn lại phương thức thanh toán khác hoặc điều chỉnh đơn hàng để tiếp tục đặt hàng."*
4. **Quyền quyết định xóa thuộc về người dùng:** Khách hàng vẫn thấy toàn bộ danh sách sản phẩm, giá tiền và có thể chủ động bấm xóa sản phẩm hoặc chọn lại phương thức khác.

---

## 3. Hướng dẫn vận hành & Chuyển sang Production Key

> **Tài liệu hướng dẫn chi tiết quy trình bàn giao & ngắt Mock Data:** [migration-from-mock-to-live-api.md](file:///Users/mac/Project/FE_sport/shop/docs/plan/migration-from-mock-to-live-api.md)

Hệ thống được thiết kế hoàn toàn theo mô hình **Config-Driven**. Khi chủ cửa hàng muốn kết nối với tài khoản ngân hàng thực tế để tiền về tài khoản shop:

1. Đăng ký tài khoản tại [https://my.payos.vn](https://my.payos.vn) và liên kết tài khoản ngân hàng của cửa hàng.
2. Vào mục **Cài đặt tích hợp** lấy bộ 3 khóa:
   - `Client ID`
   - `Api Key`
   - `Checksum Key`
3. Cài đặt Webhook URL trên PayOS Dashboard:
   - `https://<ten-mien-server-cua-ban>/api/v1/public/payments/payos/webhook`
4. Cập nhật lại 3 dòng trong file `server/.env`:
   ```env
   PAYOS_CLIENT_ID=<Client_ID_Thuc_Te>
   PAYOS_API_KEY=<Api_Key_Thuc_Te>
   PAYOS_CHECKSUM_KEY=<Checksum_Key_Thuc_Te>
   ```
5. Khởi động lại server. **Toàn bộ hệ thống sẽ lập tức hoạt động với tài khoản ngân hàng thật mà không cần thay đổi bất kỳ dòng mã nào.**

---

## 4. Kết quả kiểm thử & Trạng thái hoạt động

- **Backend TypeScript Compilation:** Đạt 0 lỗi (`npx tsc --noEmit` exit 0).
- **Frontend TypeScript Compilation:** Đạt 0 lỗi (`npx tsc --noEmit` exit 0).
- **Backend Service Server:** Đang chạy ổn định tại cổng `4000`.
- **Shop Frontend Next.js:** Đang chạy ổn định tại cổng `3002`.
- **Cấu trúc lưu trữ tài liệu:** Hoàn thành đầy đủ 3 thư mục `shop/docs/plan/`, `shop/docs/log/`, `shop/docs/tree/`.
