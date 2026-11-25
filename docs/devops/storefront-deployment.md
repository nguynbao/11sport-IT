# Hướng dẫn Hạ tầng & Triển khai Storefront (`shop/`) - 11 Sport

> **Phụ trách**: DevOps Engineer (`devops`)
> **Mã công việc**: WEB-23 (Hạ tầng & Triển khai), WEB-25 (Checklist Go-Live)
> **Phạm vi**: `shop/` (Storefront khách hàng, port `3002`), `server/` (API, port `4000`), `cms/` (Quản trị, port `3001`).

---

## 1. Kiến trúc & Cổng dịch vụ

| Dịch vụ | Thư mục | Công nghệ | Port | URL Local |
| --- | --- | --- | --- | --- |
| **Backend API** | `server/` | Node.js 20 + Express + TypeScript | `4000` | `http://localhost:4000/api/v1` |
| **Web POS & Kho** | `web/` | Next.js | `3000` | `http://localhost:3000` |
| **CMS Quản trị** | `cms/` | Next.js | `3001` | `http://localhost:3001` |
| **Shop Storefront** | `shop/` | Next.js 14 (`output: 'standalone'`) | `3002` | `http://localhost:3002` |
| **Database** | `mongodb` | MongoDB 7.0+ | `27017` | `mongodb://localhost:27017/11sport` |

---

## 2. Danh sách Biến môi trường bắt buộc

> **Nguyên tắc bảo mật**: Tuyệt đối không commit file `.env` hoặc secret thật lên Git. Chỉ khai báo tên biến trong `.env.example` và thiết lập giá trị thật trên Render / Vercel / Docker Secret.

### 2.1 `server/` (Backend API)

| Biến | Bắt buộc | Mô tả |
| --- | --- | --- |
| `NODE_ENV` | Có | `development` hoặc `production` |
| `PORT` | Có | Cổng chạy API (mặc định `4000`) |
| `MONGODB_URI` | Có | Chuỗi kết nối MongoDB / MongoDB Atlas |
| `JWT_SECRET` | Có | Khóa ký JWT (tối thiểu 32 ký tự ngẫu nhiên trên production) |
| `CORS_ORIGINS` | Có | Danh sách origin được phép gọi API, phân tách bởi dấu `,` (phải bao gồm domain của `web/`, `cms/`, `shop/`) |
| `SHOP_URL` | Có | URL gốc của Storefront (VD: `https://11sport.vn`), dùng cho callback PayOS và gọi ISR revalidate |
| `REVALIDATE_SECRET` | Có | Chuỗi bí mật khớp với `shop/` để `cmsWeb` kích hoạt làm mới cache ISR (`/api/revalidate`) |
| `PAYOS_CLIENT_ID` | Có (khi bật PayOS) | Client ID cổng thanh toán PayOS |
| `PAYOS_API_KEY` | Có (khi bật PayOS) | API Key cổng thanh toán PayOS |
| `PAYOS_CHECKSUM_KEY` | Có (khi bật PayOS) | Checksum Key xác thực webhook PayOS |
| `RESEND_API_KEY` | Có (khi gửi OTP/email) | API Key của Resend để gửi email xác thực / đơn hàng |
| `RESEND_FROM_EMAIL` | Tùy chọn | Địa chỉ gửi email (mặc định `11 Sport <no-reply@11sport.vn>`) |
| `KEEP_ALIVE_URL` | Tùy chọn | URL `/api/v1/health` để tự ping chống sleep trên Render Free |
| `KEEP_ALIVE_INTERVAL_MIN` | Tùy chọn | Chu kỳ tự ping (phút, mặc định `8`) |

### 2.2 `shop/` (Storefront khách hàng)

| Biến | Bắt buộc | Mô tả |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Có | URL gốc API backend (VD: `http://localhost:4000/api/v1` hoặc `https://api.11sport.vn/api/v1`) |
| `NEXT_PUBLIC_SITE_URL` | Có | Canonical URL của Storefront (dùng cho SEO, sitemap, OpenGraph; VD: `https://11sport.vn`) |
| `REVALIDATE_SECRET` | Có | Khóa bí mật xác thực endpoint `POST /api/revalidate`, phải khớp với `server/` |
| `PORT` | Tùy chọn | Cổng chạy Next.js (mặc định `3002`) |

### 2.3 `cms/` (Trang quản trị)

| Biến | Bắt buộc | Mô tả |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Có | URL gốc API backend (`.../api/v1`) |
| `NEXT_PUBLIC_WEB_URL` | Tùy chọn | URL trang POS/Kho |
| `NEXT_PUBLIC_CMS_URL` | Tùy chọn | URL trang CMS |
| `NEXT_PUBLIC_APP_NAME` | Tùy chọn | Tên hiển thị ứng dụng (`11Sport CMS`) |

---

## 3. Hướng dẫn chạy Local

### 3.1 Chạy với Docker Compose

File `docker-compose.yml` đã tích hợp đầy đủ `mongodb`, `server` (`4000`), `web` (`3000`), `cms` (`3001`), và `shop` (`3002`).

```bash
# Khởi động toàn bộ dịch vụ ở chế độ nền
docker compose up -d

# Kiểm tra trạng thái & healthcheck
docker compose ps

# Xem log của shop và server
docker compose logs -f shop server

# Build image production cho shop từ shop/Dockerfile
docker build -t 11sport-shop:local \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1 \
  --build-arg NEXT_PUBLIC_SITE_URL=http://localhost:3002 \
  ./shop
```

### 3.2 Chạy không dùng Docker (Local Node.js)

Trên macOS / Linux, dùng script `start-dev.sh` ở thư mục gốc:

```bash
chmod +x start-dev.sh
./start-dev.sh
```

Script tự động tạo `.env` / `.env.local` (bao gồm `shop/.env.local`), cài đặt `node_modules` nếu thiếu, bật MongoDB (nếu có) và khởi động đồng thời `server` (`4000`), `web` (`3000`), `cms` (`3001`), `shop` (`3002`).

Hoặc chạy riêng lẻ `shop/`:

```bash
cd shop
cp .env.example .env.local
npm install
npm run dev
# Truy cập http://localhost:3002
```

---

## 4. Quy trình Deploy Staging / Production trên Render

Cấu hình Blueprint nằm tại `render.yaml` gồm 2 dịch vụ: `11sport-server` và `11sport-shop`.

### 4.1 Zero-Downtime & Health Check
- `11sport-server`: sử dụng `startCommand: npm run start:migrate` và `healthCheckPath: /api/v1/health`. Nếu migration hoặc health check thất bại, Render giữ nguyên bản chạy cũ và không chuyển traffic sang bản mới.
- `11sport-shop`: sử dụng `buildCommand: npm install --include=dev && npm run build`, `startCommand: npm run start` (port `3002`) và `healthCheckPath: /`.
- **Thứ tự deploy khuyến nghị**:
  1. Deploy `11sport-server` trước (kiểm tra `/api/v1/health` trả về `200 OK`).
  2. Kiểm tra các biến `CORS_ORIGINS`, `SHOP_URL`, `REVALIDATE_SECRET`, `PAYOS_*`, `RESEND_API_KEY` trên Render Dashboard.
  3. Deploy `11sport-shop` và kiểm tra trang chủ `/`, trang danh mục, và `POST /api/revalidate`.

### 4.2 Chống Sleep trên Render cho SEO
- Gói Render `free` sẽ tự ngủ sau 15 phút không có truy cập, gây chậm TTFB (15–30s) cho người dùng và làm giảm điểm SEO / lỗi crawl từ Googlebot.
- **Production**: Bắt buộc nâng cấp `11sport-shop` và `11sport-server` tối thiểu lên gói **Starter** (always-on).
- **Staging / Tạm thời dùng Free**: Cấu hình cron monitor bên ngoài (UptimeRobot / BetterStack) ping `GET https://<shop-domain>/` và `GET https://<server-domain>/api/v1/health` mỗi **5 phút**. Trên `server/` có thể bật thêm `KEEP_ALIVE_URL`.

### 4.3 Cấu hình CDN Ảnh & Upload
- Các ảnh sản phẩm/banner cấu hình trong CMS phải dùng HTTPS URL từ dịch vụ lưu trữ/CDN ổn định (Cloudinary, Cloudflare R2, AWS S3 + CloudFront) thay vì lưu file cục bộ trên container Render (do filesystem của Render là ephemeral, bị xóa sau mỗi lần redeploy).
- `shop/next.config.mjs` đã cấu hình `images.remotePatterns` cho phép `https://**` để Next.js `<Image />` tối ưu hóa (WebP/AVIF, responsive sizes) từ domain CDN.
- Khi dùng Cloudflare làm DNS/CDN phía trước domain chính, bật **Auto Minify / Brotli** và giữ cache rule phù hợp cho `/_next/static/*` (immutable) nhưng **không** cache HTML động hoặc `/api/*` quá lâu để không ảnh hưởng giỏ hàng/giá/tồn kho.

### 4.4 Quy trình Rollback
1. **Rollback nhanh trên Render**: Vào Render Dashboard -> chọn dịch vụ (`11sport-shop` hoặc `11sport-server`) -> tab **Events** -> chọn bản deploy ổn định liền trước -> nhấn **Rollback to this deploy**.
2. **Rollback qua Git**:
   ```bash
   git revert <commit-loi>
   git push origin main
   ```
3. **Rollback DB (nếu có thay đổi dữ liệu/migration)**: Thực hiện `mongorestore` từ bản snapshot trước thời điểm deploy theo `docs/devops/deployment-and-runbook.md`.

---

## 5. Checklist Go-Live Storefront (`WEB-25`)

Trước khi mở chính thức domain production cho khách hàng:

### 5.1 DNS & SSL
- [ ] Trỏ bản ghi DNS (`A` / `CNAME`) của domain chính (VD: `11sport.vn`, `www.11sport.vn`) về Render / Vercel / Cloudflare.
- [ ] Bật SSL/TLS Full (Strict) và tự động chuyển hướng `HTTP -> HTTPS`.
- [ ] Cấu hình chuyển hướng chuẩn hóa `www` <-> `non-www` (chọn 1 canonical domain khớp với `NEXT_PUBLIC_SITE_URL`).
- [ ] Cập nhật `SHOP_URL`, `CORS_ORIGINS` trên `server/` và `NEXT_PUBLIC_SITE_URL` trên `shop/` theo domain thật.

### 5.2 SEO & Google Search Console
- [ ] Kiểm tra `https://<domain>/robots.txt` và `https://<domain>/sitemap.xml` trả về `200 OK` và đúng domain canonical.
- [ ] Xác minh quyền sở hữu domain trên **Google Search Console** (DNS TXT record hoặc meta tag).
- [ ] Submit `sitemap.xml` lên Google Search Console và kiểm tra không có lỗi index (`noindex` chỉ áp dụng cho trang giỏ hàng/checkout/tài khoản nếu cần).
- [ ] Kiểm tra OpenGraph & metadata (title, description, ảnh chia sẻ) trên trang chủ và trang chi tiết sản phẩm.

### 5.3 Đo lường & Tracking (GA4 / GTM)
- [ ] Gắn mã **Google Analytics 4 (GA4)** hoặc **Google Tag Manager (GTM)** (khuyến nghị qua biến môi trường hoặc cấu hình CMS).
- [ ] Kiểm tra các sự kiện e-commerce cơ bản: `view_item`, `add_to_cart`, `begin_checkout`, `purchase`.

### 5.4 301 Redirects & Kiểm thử cuối cùng
- [ ] Thiết lập bảng **301 Redirects** (trong `next.config.mjs` hoặc Cloudflare Redirect Rules) cho các URL cũ (nếu chuyển đổi từ hệ thống cũ) để bảo toàn thứ hạng SEO.
- [ ] Kiểm thử luồng thanh toán PayOS (tạo đơn -> thanh toán -> webhook cập nhật trạng thái đơn).
- [ ] Kiểm thử gửi email OTP / xác nhận đơn hàng qua Resend.
- [ ] Kiểm thử nút làm mới cache từ CMS sang `shop/` (`/api/revalidate`).
