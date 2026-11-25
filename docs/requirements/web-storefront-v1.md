# Đặc tả Yêu cầu Nghiệp vụ: Website Bán hàng 11 Sport (`shop/`) & CMS Quản lý Website (`cms/`)

- **Mã tài liệu:** `WEB-01`
- **Phiên bản:** `v1.0`
- **Trạng thái:** Chờ PM duyệt để bàn giao Design (`designer`) & Backend (`backend-dev`)
- **Tham chiếu:** `docs/requirements/mipik-ecommerce-plan.md`, `server/src/models/*`

---

## 1. Bối cảnh & Mục tiêu kinh doanh

### 1.1 Bối cảnh hiện trạng
- Hệ thống 11 Sport hiện có:
  - `server/`: Express + MongoDB (Mongoose) + TypeScript, đang phục vụ nghiệp vụ POS & Kho nội bộ (`Product`, `Category`, `Brand`, `Order`, `Promotion`, `Staff`, `Customer`, `StockMovement`).
  - `web/`: Next.js 14 + Tailwind — **đang là ứng dụng POS/Kho nội bộ tại cửa hàng**, không phải website cho khách hàng.
  - `cms/`: Next.js 14 + Tailwind — trang quản trị nội bộ (kho, đơn hàng, nhân viên, danh mục, khuyến mãi).
- **Quyết định kiến trúc đã chốt:**
  - Xây dựng ứng dụng storefront mới tại thư mục `shop/` (Next.js 14 App Router + TypeScript + Tailwind), giữ nguyên `web/` làm POS.
  - Mở rộng `server/` (thêm Public API `/api/v1/public/*`, module nội dung web, checkout/thanh toán QR, bảo mật & đồng bộ kho) và `cms/` (thêm tab **"Quản lý Website"**).
  - Tham chiếu bố cục/UX từ `mipik.vn` nhưng **tạo nhận diện thương hiệu 11 Sport riêng** (không sao chép ảnh, logo, nội dung) và **khắc phục toàn bộ điểm yếu SEO/UX/Accessibility** của `mipik.vn`.

### 1.2 Mục tiêu kinh doanh (MVP)
1. Mở kênh bán hàng trực tuyến chính thức cho thương hiệu **11 Sport** (đồ thể thao: vợt, giày, thời trang, balo, phụ kiện — danh mục cấu hình động trong CMS).
2. Đạt chuẩn SEO kỹ thuật & hiệu năng ngay từ ngày đầu ra mắt (Lighthouse SEO ≥ 90, LCP < 2.5s, CLS < 0.1, 1 `<h1>`/trang, JSON-LD đầy đủ, URL tiếng Việt không dấu).
3. Đồng bộ 100% sản phẩm, giá bán, biến thể màu/size, khuyến mãi và **tồn kho thời gian thực** với hệ thống POS/Kho hiện có (không bán quá tồn kho).
4. Cho phép đội ngũ quản trị (`ADMIN`, `CEO`) chủ động cấu hình giao diện trang chủ, banner, bài viết, SEO, khuyến mãi online và theo dõi báo cáo doanh thu online ngay trên `cms/`.

---

## 2. Phạm vi dự án (Scope)

### 2.1 Trong phạm vi MVP (In-Scope)
- **Storefront (`shop/`):**
  - Giao diện Tiếng Việt (cấu trúc route/dictionary sẵn sàng cho i18n `/en/` ở pha sau).
  - Trang chủ động cấu hình từ CMS: Header sticky + Mega Menu 2–3 cấp + Live Search (sản phẩm & bài viết) + Mini-cart; Hero Slider (desktop & mobile riêng); Khối danh mục (lưới/carousel) xen banner; 4 USP cam kết; Chứng nhận đại lý/Thương hiệu; Tin tức/Bài viết nổi bật; Footer 4 cột + Widget nổi (Hotline/Zalo/Messenger) không che nội dung mobile.
  - Trang Danh mục / Thương hiệu: Hub danh mục/thương hiệu, bộ lọc (khoảng giá, thương hiệu, màu sắc, size, tình trạng còn hàng), sắp xếp (nổi bật, mới nhất, giá tăng/giảm), mô tả SEO mở rộng ("Xem thêm").
  - Trang Chi tiết sản phẩm (PDP): Breadcrumb, Gallery + zoom ảnh, chọn biến thể Màu (swatch) & Size (hiển thị tồn kho từng biến thể), giá gạch/giá bán, khung ưu đãi (mua nhiều giảm giá, quà tặng), nút **"Thêm vào giỏ"** & **"Mua ngay"**, đánh giá sản phẩm (Reviews + `AggregateRating`), sản phẩm tương tự.
  - Giỏ hàng & Thanh toán (Checkout): Hỗ trợ **Guest Checkout** (không bắt buộc đăng nhập) và **Khách hàng đăng nhập** (Email/SĐT + OTP); áp dụng mã giảm giá (Coupon) & chọn quà tặng hợp lệ; tính phí ship; thanh toán **COD** hoặc **Chuyển khoản QR (PayOS/VietQR)** với xác thực webhook.
  - Tài khoản khách hàng: Đăng nhập/Đăng ký bằng SĐT hoặc Email + OTP, quản lý sổ địa chỉ, lịch sử đơn hàng, theo dõi trạng thái đơn online.
  - Blog / Tin tức & Trang tĩnh (Chính sách đổi trả, bảo hành, vận chuyển, giới thiệu, liên hệ).
  - SEO & Accessibility: 1 `<h1>`/trang, canonical URL, `sitemap.xml` & `robots.txt` động, JSON-LD (`Organization`, `WebSite`, `BreadcrumbList`, `Product` + `Offer` + `AggregateRating`, `Article`, `FAQ`), 301 Redirect Manager, chuẩn tương phản màu WCAG AA, 0 lỗi JS console.
- **CMS (`cms/`) — Tab mới "Quản lý Website":**
  - Phân quyền RBAC: `ADMIN` (toàn quyền), `CEO` (xem toàn bộ tab Quản lý Website, Dashboard CEO, Audit log; được duyệt/xuất bản nội dung; **không** sửa cấu hình hệ thống hay quản lý nhân viên), `SALES` và các role khác **không thấy** tab này (ẩn UI + chặn API).
  - Các phân hệ con: Banner/Slider (desktop/mobile, lịch hiển thị); Bố cục trang chủ (bật/tắt, kéo thả thứ tự section); Menu/Mega menu; Quản lý thông tin Web của Sản phẩm/Danh mục/Thương hiệu (ảnh, mô tả, slug, SEO, trạng thái hiển thị online); Bài viết/Blog & Trang tĩnh; SEO & 301 Redirect; Khuyến mãi online (Coupon, Mua nhiều giảm giá, Flash sale, Quà tặng); Duyệt Đánh giá (Reviews); Footer/Showroom/Widget liên hệ; Quản lý Đơn online & Khách hàng web; Dashboard CEO; Nhật ký thao tác (Audit log).
  - Nút / cơ chế kích hoạt **On-demand Revalidate** sang `shop/` khi xuất bản thay đổi.
- **Backend (`server/`):**
  - Public API `/api/v1/public/*` (read-only, cache-friendly, không lộ giá vốn `costPrice` hay dữ liệu nội bộ).
  - API Customer Auth (OTP), Cart/Checkout, Payment Webhook (PayOS/VietQR), Order tracking.
  - API CMS Quản lý Website `/api/v1/cms/web/*` với middleware `requireRoles(['ADMIN', 'CEO'])` (phân biệt quyền ghi hệ thống vs duyệt nội dung).

### 2.2 Ngoài phạm vi MVP (Out-of-Scope — Giai đoạn 2+)
- Đa ngôn ngữ `/en/` và chuyển đổi tiền tệ ngoại tệ (chỉ chuẩn bị cấu trúc sẵn, MVP chạy Tiếng Việt & VND).
- Cổng thanh toán thẻ quốc tế/nội địa (Visa/Mastercard/ATM qua VNPay/Stripe) và ví điện tử (MoMo/ZaloPay).
- Tích hợp tự động đẩy đơn sang đơn vị vận chuyển (GHN/GHTK/Viettel Post) — MVP dùng bảng phí ship cấu hình trong CMS và cập nhật trạng thái giao hàng thủ công trong CMS.
- Chương trình tích điểm thành viên / Loyalty nâng cao, Flash Sale tự động theo khung giờ phức tạp (MVP hỗ trợ cấu hình khung giờ cơ bản).

---

## 3. Tác nhân (Actors)

| Tác nhân | Mô tả | Quyền hạn chính |
|---|---|---|
| **Khách vãng lai (Guest)** | Người dùng chưa đăng nhập truy cập `shop/` | Xem sản phẩm, tìm kiếm, lọc, thêm giỏ hàng, đặt hàng (Guest Checkout), tra cứu đơn theo mã đơn + SĐT. |
| **Khách hàng đã đăng nhập (Customer)** | Khách xác thực qua SĐT/Email + OTP trên `shop/` | Toàn bộ quyền Guest + lưu nhiều địa chỉ giao hàng, xem lịch sử đơn hàng, viết đánh giá cho sản phẩm đã mua. |
| **ADMIN** | Quản trị viên hệ thống trên `cms/` | Toàn quyền trên `cms/` bao gồm tab Quản lý Website, cấu hình thanh toán/ship/SEO hệ thống, quản lý nhân viên, xuất bản nội dung, xử lý đơn online. |
| **CEO** | Giám đốc điều hành trên `cms/` | Xem toàn bộ tab Quản lý Website, Dashboard CEO, Audit log; **được duyệt/xuất bản nội dung** (bài viết, banner, bố cục, đánh giá); **không** sửa cấu hình hệ thống kỹ thuật hay quản lý nhân viên. |
| **SALES / Nhân viên khác** | Nhân viên bán hàng POS, Kho, Kế toán, HR | **Không** thấy tab Quản lý Website trên `cms/` và bị chặn ở tầng API (403 Forbidden). Nhân viên xử lý đơn online tại quầy sẽ thao tác qua quy trình đơn hàng được phân quyền riêng hoặc do ADMIN xử lý trong MVP. |
| **Cổng thanh toán (PayOS / VietQR)** | Hệ thống bên thứ 3 | Gửi Webhook thông báo kết quả giao dịch chuyển khoản QR về `server/`. |

---

## 4. User Stories

### 4.1 Storefront (`shop/`)
- **US-01 (Khám phá trang chủ):** Là Khách hàng, tôi muốn xem trang chủ rõ ràng theo từng nhóm sản phẩm thể thao, banner khuyến mãi và USP cam kết để nhanh chóng tìm thấy sản phẩm phù hợp.
- **US-02 (Tìm kiếm nhanh):** Là Khách hàng, tôi muốn gõ từ khóa vào ô tìm kiếm để thấy gợi ý sản phẩm (kèm ảnh, giá) và bài viết hướng dẫn ngay lập tức (live search).
- **US-03 (Lọc & Duyệt danh mục):** Là Khách hàng, tôi muốn lọc sản phẩm theo hãng, khoảng giá, màu sắc, size và tình trạng còn hàng để thu hẹp lựa chọn nhanh chóng.
- **US-04 (Xem chi tiết & Biến thể):** Là Khách hàng, tôi muốn chọn màu sắc (swatch) và kích cỡ (size) trên trang sản phẩm, thấy ngay ảnh tương ứng, giá bán và số lượng còn hàng để quyết định mua chính xác.
- **US-05 (Ưu đãi & Mua ngay):** Là Khách hàng, tôi muốn xem các mức giảm giá khi mua nhiều hoặc quà tặng kèm, và bấm "Mua ngay" để đi thẳng tới trang thanh toán.
- **US-06 (Guest Checkout):** Là Khách vãng lai, tôi muốn đặt hàng nhanh chỉ cần nhập Họ tên, SĐT, Địa chỉ nhận hàng mà không bị ép tạo tài khoản.
- **US-07 (Thanh toán QR / COD):** Là Khách hàng, tôi muốn chọn thanh toán COD hoặc quét mã VietQR/PayOS và nhận xác nhận đơn hàng tự động ngay sau khi chuyển khoản thành công.
- **US-08 (Tài khoản OTP & Theo dõi đơn):** Là Khách hàng thân thiết, tôi muốn đăng nhập bằng SĐT/Email + OTP để xem lại lịch sử đơn hàng và đánh giá sản phẩm đã mua.

### 4.2 CMS — Tab "Quản lý Website" (`cms/`)
- **US-09 (Quản lý nội dung trang chủ):** Là ADMIN/CEO, tôi muốn bật/tắt, sắp xếp thứ tự các khối trên trang chủ và cài đặt lịch hiển thị Banner (desktop & mobile) mà không cần dev can thiệp code.
- **US-10 (Quản lý sản phẩm hiển thị web):** Là ADMIN, tôi muốn cấu hình ảnh, mô tả chi tiết, slug URL, thẻ SEO và bật/tắt hiển thị online cho các sản phẩm đang có trong kho.
- **US-11 (SEO & Redirect):** Là ADMIN, tôi muốn kiểm tra độ dài meta title/description (cảnh báo khi vượt ngưỡng), quản lý `301 Redirect` khi đổi slug để không mất thứ hạng Google.
- **US-12 (Khuyến mãi Online & Quà tặng):** Là ADMIN, tôi muốn tạo mã giảm giá (Coupon), giá mua nhiều (Tier pricing) hoặc tái sử dụng chương trình khuyến mãi quà tặng từ hệ thống để áp dụng cho đơn online.
- **US-13 (Duyệt đánh giá & Bài viết):** Là CEO/ADMIN, tôi muốn duyệt đánh giá của khách hàng và xuất bản bài viết blog trước khi hiển thị công khai trên `shop/`.
- **US-14 (Dashboard CEO & Audit Log):** Là CEO, tôi muốn xem doanh thu online, tỷ lệ chuyển đổi, top sản phẩm bán chạy và nhật ký thao tác chỉnh sửa website trên cùng một màn hình.

---

## 5. Luồng nghiệp vụ chính, thay thế & xử lý lỗi

### 5.1 Luồng chính: Đặt hàng Online & Thanh toán QR (PayOS/VietQR)
1. Khách chọn biến thể (Màu/Size) → thêm vào giỏ hoặc bấm **"Mua ngay"**.
2. Tại `/checkout`, khách nhập thông tin giao hàng (Tên, SĐT, Tỉnh/Thành, Quận/Huyện, Phường/Xã, Địa chỉ chi tiết), chọn mã Coupon / Quà tặng (nếu đủ điều kiện), chọn phương thức **Chuyển khoản QR**.
3. Khách bấm **"Đặt hàng"**:
   - `server/` kiểm tra và **giữ chỗ / trừ tồn kho tạm thời (atomic)** trên `Product.variants[].stockFloor1` (hoặc kho online cấu hình) cho từng biến thể.
   - Tạo `Order` với `channel = 'ONLINE'`, `status = 'DRAFT'` (hoặc `PENDING_PAYMENT`), `paymentStatus = 'UNPAID'`, `reservedUntil = now + 15 phút`.
   - Gọi API PayOS/VietQR tạo mã QR động (số tiền, nội dung chuyển khoản chứa `orderCode`), trả về cho `shop/` hiển thị màn hình chờ thanh toán + đồng hồ đếm ngược 15 phút.
4. Khách quét mã chuyển khoản thành công → PayOS/VietQR gửi **Webhook** về `POST /api/v1/public/payments/webhook`.
5. `server/` xác thực chữ ký HMAC/Signature của Webhook, kiểm tra `orderCode` & số tiền khớp:
   - Cập nhật `Order`: `paymentStatus = 'PAID'`, `fulfillmentStatus = 'CONFIRMED'`, `status = 'PAID'`, ghi nhận `StockMovement` (`type: 'SALE'`, `warehouseLocation: 'FLOOR_1'`).
   - Cập nhật `Customer` (`totalOrders`, `totalSpent`, `lastOrderAt`).
6. Giao diện `shop/` (qua polling/SSE) chuyển sang trang **Đặt hàng thành công** (`/order-success?code=...`).

### 5.2 Luồng thay thế
- **A1 — Thanh toán COD:** Ở bước 2, khách chọn COD → bước 3 `server/` thực hiện trừ kho atomic tại `stockFloor1`, tạo `Order` với `channel = 'ONLINE'`, `paymentMethod = 'CASH'` (hoặc `'COD'`), `paymentStatus = 'UNPAID'`, `fulfillmentStatus = 'PENDING'`, ghi nhận `StockMovement` và chuyển thẳng sang trang Đặt hàng thành công.
- **A2 — Khách đã đăng nhập:** Tự động điền thông tin từ sổ địa chỉ mặc định của `Customer`; đơn hàng gắn với `customerId`.
- **A3 — Tự động tách Bộ -> Lẻ (nếu sản phẩm lẻ hết `stockFloor1` nhưng có sản phẩm Bộ liên kết `parentSetProductId`):** Áp dụng tương tự logic `executeUnpackSetToRetail` tại POS (nếu được bật cấu hình cho Online).

### 5.3 Luồng lỗi & Xử lý ngoại lệ
- **E1 — Hết hàng / Race condition (POS và Online mua cùng lúc sản phẩm cuối cùng):**
  - Nếu câu lệnh atomic update (`stockFloor1 >= qty`) thất bại → `server/` rollback các item đã giữ trong cùng đơn, trả HTTP `409 Conflict` kèm danh sách sản phẩm/biến thể không đủ tồn kho để `shop/` thông báo khách cập nhật giỏ hàng.
- **E2 — Hết hạn thanh toán QR (quá 15 phút không nhận được Webhook):**
  - Background job (hoặc kiểm tra lazy + cron mỗi 1 phút) chuyển `Order` sang `fulfillmentStatus = 'CANCELLED'`, `paymentStatus = 'EXPIRED'`, **hoàn trả số lượng đã giữ** vào `stockFloor1` (atomic `$inc`).
  - Nếu khách chuyển khoản muộn sau khi đơn đã hủy: Webhook ghi nhận giao dịch bất thường vào log/cảnh báo CMS để ADMIN xử lý hoàn tiền hoặc tạo lại đơn thủ công.
- **E3 — Webhook giả mạo / Sai chữ ký / Trùng lặp (Idempotency):**
  - Sai chữ ký → trả `401/400` và ghi log cảnh báo bảo mật.
  - Webhook gửi lặp nhiều lần cho cùng 1 `transactionId` → kiểm tra idempotency key, nếu đơn đã `PAID` thì trả `200 OK` không trừ kho/cộng tiền lần 2.
- **E4 — Revalidate `shop/` thất bại khi CMS xuất bản:**
  - CMS vẫn lưu DB thành công, hiển thị cảnh báo "Đã lưu nhưng làm mới cache web thất bại, vui lòng bấm Làm mới lại", không làm mất dữ liệu đang nhập.

---

## 6. Quy tắc nghiệp vụ (Business Rules)

- **BR-01 (Nguồn tồn kho bán Online):** Mặc định đơn hàng Online kiểm tra và trừ tồn kho từ **Kho Tầng 1 (`stockFloor1`)** — dùng chung nguồn tồn kho bán lẻ với POS để tránh sai lệch; cho phép cấu hình trong CMS chuyển sang tổng tồn (`stockFloor1 + stockFloor2`) ở cấp hệ thống nếu cửa hàng xuất đơn online từ kho tầng 2.
- **BR-02 (Trừ kho Atomic):** Mọi thao tác giữ chỗ/trừ tồn kho khi đặt hàng Online bắt buộc dùng cập nhật nguyên tử (MongoDB `findOneAndUpdate` với điều kiện `variants.stockFloor1 >= qty` hoặc MongoDB Transaction) để đảm bảo `stockFloor1` không bao giờ âm.
- **BR-03 (Giá bán & Khuyến mãi):** Giá hiển thị và tính tiền luôn lấy từ `ProductVariant.sellingPrice` (nếu > 0) hoặc `Product.sellingPrice`. Không tin tưởng giá gửi từ client; `server/` phải tính lại toàn bộ `subtotal`, `discount`, `shippingFee`, `totalAmount` khi tạo đơn.
- **BR-04 (Phân quyền RBAC CMS):**
  - `ADMIN`: Toàn quyền CRUD cấu hình hệ thống, thanh toán, vận chuyển, sản phẩm, đơn hàng, nhân viên và tab Quản lý Website.
  - `CEO`: Truy cập tab Quản lý Website (xem Dashboard CEO, Audit log, xem tất cả cấu hình; được **duyệt/xuất bản** bài viết, banner, bố cục trang chủ, đánh giá sản phẩm); bị chặn (`403`) ở các API thay đổi cấu hình kỹ thuật (payment keys, webhook secret, redirect hệ thống) và quản lý nhân viên.
  - `SALES` / `ACCOUNTANT` / `HR` / `MARKETING` (trừ khi có phân quyền bổ sung sau): Ẩn hoàn toàn tab Quản lý Website trên UI và trả `403 Forbidden` ở API `/api/v1/cms/web/*`.
- **BR-05 (Bảo mật dữ liệu & Thanh toán):**
  - Public API `/api/v1/public/*` tuyệt đối không trả về `costPrice`, `supplier`, thông tin nhân viên, hay PII của khách hàng khác.
  - Không lưu thông tin thẻ ngân hàng. Webhook thanh toán bắt buộc xác thực chữ ký HMAC-SHA256 và kiểm tra số tiền thực nhận `>= totalAmount`.
  - Áp dụng Rate-limit cho API đăng nhập OTP, tạo đơn hàng, gửi đánh giá và live search.
- **BR-06 (Quy chuẩn SEO bắt buộc):**
  - Mỗi trang trên `shop/` có **duy nhất 1 thẻ `<h1>`**.
  - Slug URL tiếng Việt không dấu, viết thường, nối bằng `-` (VD: `/vot-pickleball/joola-perseus-16mm`), duy nhất theo từng loại thực thể. Khi đổi slug trong CMS, hệ thống tự động gợi ý tạo bản ghi `301 Redirect` từ slug cũ sang slug mới.
  - CMS kiểm tra độ dài khuyến nghị: SEO Title (50–60 ký tự), Meta Description (150–160 ký tự) và hiển thị thanh báo trạng thái trực quan.
- **BR-07 (Điều kiện đánh giá sản phẩm):** Chỉ khách hàng đã đăng nhập và có ít nhất 1 đơn hàng `PAID` / `DELIVERED` chứa sản phẩm đó (hoặc được ADMIN duyệt thủ công) mới được gắn nhãn "Đã mua hàng"; mọi đánh giá mới mặc định ở trạng thái `PENDING` chờ `ADMIN`/`CEO` duyệt trước khi hiển thị công khai.

---

## 7. Tiêu chí nghiệm thu (Acceptance Criteria — Given / When / Then)

- **AC-01 (SEO & HTML Structure):**
  - **Given** người dùng hoặc bot Google truy cập bất kỳ trang nào trên `shop/` (Trang chủ, Danh mục, Sản phẩm, Blog, Liên hệ)
  - **When** kiểm tra DOM và source HTML server-side
  - **Then** trang trả về HTTP 200 (SSR/ISR), có đúng **1 thẻ `<h1>`**, có thẻ `<link rel="canonical">`, meta description không bị cắt cụt, và có script `application/ld+json` hợp lệ với schema tương ứng (`Product`, `BreadcrumbList`, `Article`, v.v.).
- **AC-02 (Sitemap & 301 Redirect):**
  - **Given** ADMIN đổi slug của một sản phẩm từ `/sp-cu` sang `/sp-moi` và bật tự động redirect trong CMS
  - **When** người dùng truy cập `/sp-cu`
  - **Then** server trả về HTTP `301` chuyển hướng về `/sp-moi`, đồng thời `/sitemap.xml` cập nhật URL mới và loại bỏ URL cũ.
- **AC-03 (Đồng bộ & Trừ kho Atomic giữa POS và Online):**
  - **Given** biến thể Đỏ / Size L của sản phẩm X chỉ còn `stockFloor1 = 1`
  - **When** Khách A trên `shop/` và nhân viên POS trên `web/` bấm thanh toán gần như đồng thời cho biến thể này
  - **Then** chỉ 1 giao dịch thành công (`stockFloor1` về `0`), giao dịch còn lại nhận lỗi `409` thông báo hết hàng và `stockFloor1` không bị âm.
- **AC-04 (Checkout QR & Webhook Idempotency):**
  - **Given** Khách tạo đơn hàng thanh toán QR với `totalAmount = 500.000đ`
  - **When** PayOS/VietQR gửi Webhook hợp lệ 2 lần liên tiếp với cùng `transactionId`
  - **Then** lần 1 cập nhật đơn sang `PAID` và ghi nhận `StockMovement`; lần 2 trả `200 OK` nhưng không trừ kho thêm và không cộng dồn doanh thu/lịch sử khách hàng lần 2.
- **AC-05 (Hết hạn giữ chỗ QR):**
  - **Given** Khách tạo đơn QR và giữ chỗ `qty = 2` nhưng không thanh toán
  - **When** quá thời gian giữ chỗ 15 phút
  - **Then** đơn chuyển trạng thái `CANCELLED` (hết hạn thanh toán) và `2` sản phẩm được hoàn lại vào `stockFloor1`.
- **AC-06 (RBAC CMS cho CEO / ADMIN / SALES):**
  - **Given** nhân viên đăng nhập `cms/` với vai trò `SALES`, `CEO`, `ADMIN`
  - **When** truy cập giao diện `cms/` và gọi API `/api/v1/cms/web/*`
  - **Then** `SALES` không thấy tab "Quản lý Website" và nhận `403` nếu gọi API; `CEO` thấy tab, xem được Dashboard/Audit log và duyệt/xuất bản được bài viết/banner nhưng nhận `403` khi cố sửa cấu hình Payment/Staff; `ADMIN` thao tác được toàn bộ.
- **AC-07 (Public API Security):**
  - **Given** bất kỳ client nào gọi `GET /api/v1/public/products` hoặc `/products/:slug`
  - **When** kiểm tra JSON response
  - **Then** tuyệt đối không chứa các trường nội bộ như `costPrice`, `createdBy`, `internalNote` hay thông tin khách hàng.
- **AC-08 (Accessibility & Hiệu năng Frontend):**
  - **Given** chạy kiểm thử tự động (Playwright + Lighthouse) trên `shop/` desktop & mobile
  - **When** tương tác các nút chính, slider, bộ lọc, widget nổi
  - **Then** độ tương phản chữ/nền đạt chuẩn WCAG AA (≥ 4.5:1), widget nổi không che nút "Mua ngay"/"Thanh toán" trên mobile, 0 lỗi JS console, và điểm Lighthouse SEO ≥ 90.

---

## 8. Tác động theo phần (Impact Analysis)

| Thành phần | Phạm vi thay đổi |
|---|---|
| **`server/`** | - Mở rộng schema hiện có (`Product`, `Category`, `Brand`, `Order`, `Customer`, `Promotion`).<br>- Tạo mới các model nội dung web (`WebBanner`, `WebHomeSection`, `WebMenu`, `WebArticle`, `WebStaticPage`, `WebReview`, `WebRedirect`, `WebSiteSetting`, `WebAuditLog`, `CustomerOtp`).<br>- Tạo route group `/api/v1/public/*` (catalog, search, checkout, customer OTP, payment webhook, sitemap data).<br>- Tạo route group `/api/v1/cms/web/*` có RBAC (`ADMIN`, `CEO`) + ghi `WebAuditLog` + gọi webhook revalidate sang `shop/`.<br>- Cập nhật logic trừ kho atomic và job giải phóng giữ chỗ đơn QR quá hạn. |
| **`shop/` (Mới)** | - Khởi tạo app Next.js 14 (App Router, TypeScript, Tailwind CSS, Embla Carousel, Framer Motion, `next/image`, `next/font`).<br>- Xây dựng các trang: `/`, `/danh-muc/[slug]`, `/thuong-hieu/[slug]`, `/san-pham/[slug]`, `/tim-kiem`, `/gio-hang`, `/checkout`, `/order-success`, `/tai-khoan`, `/tin-tuc`, `/tin-tuc/[slug]`, `/[staticSlug]`.<br>- Tích hợp `generateMetadata`, JSON-LD, `sitemap.ts`, `robots.ts`, `middleware.ts` (xử lý 301 Redirect), API `/api/revalidate` (bảo vệ bằng secret token). |
| **`cms/`** | - Thêm tab **"Quản lý Website"** trên thanh điều hướng (chỉ hiện với `ADMIN` và `CEO`).<br>- Dựng các màn hình con: Bố cục trang chủ, Banner/Slider, Mega Menu, Quản lý Web Sản phẩm/Danh mục/Thương hiệu, Blog & Trang tĩnh, SEO & 301 Redirect, Khuyến mãi Online, Duyệt Đánh giá, Cài đặt Site/Footer/Showroom, Đơn hàng Online, Dashboard CEO, Audit Log. |
| **`web/` (POS)** | - **Không thay đổi giao diện/luồng POS**. Chỉ lưu ý POS và `shop/` dùng chung nguồn tồn kho `stockFloor1` trên `server/`. |

---

## 9. Thiết kế Dữ liệu (Data Model)

### 9.1 Trường mở rộng trên Model hiện có
1. **`Product` (`server/src/models/Product.ts`)**:
   - `slug` (string, unique sparse), `isPublishedOnline` (boolean, default `false`), `isFeatured` (boolean), `images` (`[{ url, alt, isPrimary, sortOrder }]`), `shortDescription` (string), `descriptionHtml` (string), `specs` (`[{ label, value }]`), `seo` (`{ title, description, canonical, ogImage, noIndex }`), `ratingAvg` (number), `ratingCount` (number).
   - Trên `ProductVariant`: thêm `imageUrl` (string, dùng cho swatch màu đổi ảnh).
2. **`Category` (`server/src/models/Category.ts`) & `Brand` (`server/src/models/Brand.ts`)**:
   - `slug` (string, unique sparse), `imageUrl` (string), `logoUrl` (Brand), `descriptionHtml` (string — mô tả SEO), `isPublishedOnline` (boolean), `sortOrder` (number), `seo` (`{ title, description, canonical }`).
3. **`Order` (`server/src/models/Order.ts`)**:
   - `channel`: `'POS' | 'ONLINE'` (default `'POS'` cho đơn cũ).
   - `fulfillmentStatus`: `'PENDING' | 'CONFIRMED' | 'PACKING' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED'`.
   - `paymentStatus`: `'UNPAID' | 'PAID' | 'EXPIRED' | 'REFUNDED'`.
   - `paymentGateway`: `'COD' | 'PAYOS' | 'VIETQR'`, `paymentTransactionId`, `reservedUntil` (Date).
   - `shippingAddress`: `{ fullName, phone, province, district, ward, addressLine, note }`, `shippingFee` (number).
   - `trackingCode` (string), `couponCode` (string).
4. **`Customer` (`server/src/models/Customer.ts`)**:
   - `email` (string, unique sparse), `isVerified` (boolean), `addresses` (`[{ id, label, fullName, phone, province, district, ward, addressLine, isDefault }]`).
5. **`Promotion` (`server/src/models/Promotion.ts`)**:
   - `applyChannels`: `('POS' | 'ONLINE')[]` (default `['POS']`).
   - `isCouponRequired` (boolean), `couponCode` (string, uppercase, unique sparse), `usageLimit` (number), `usedCount` (number).
   - `tierPricing` (`[{ minQty, discountType, discountValue }]` — phục vụ khung ưu đãi mua nhiều trên PDP).
   - `isFlashSale` (boolean).

### 9.2 Thực thể mới (New Models trong `server/src/models/`)
- `WebBanner`: quản lý hero slider & banner xen kẽ (ảnh desktop, ảnh mobile, link, vị trí, `startDate`, `endDate`, `status`, `sortOrder`).
- `WebHomeSection`: cấu hình các khối trang chủ (`type`: `'HERO' | 'CATEGORY_GRID' | 'CATEGORY_CAROUSEL' | 'FLASH_SALE' | 'USP' | 'BRANDS' | 'BLOG' | 'CUSTOM_BANNER'`, `title`, `configJson`, `isActive`, `sortOrder`).
- `WebMenu`: cây menu header/mega menu (`label`, `url`, `parentId`, `icon`, `badge`, `sortOrder`, `isActive`).
- `WebArticle` & `WebArticleCategory`: bài viết blog/tin tức (`title`, `slug`, `excerpt`, `contentHtml`, `thumbnail`, `categoryId`, `tags`, `status`: `'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED'`, `publishedAt`, `authorId`, `seo`).
- `WebStaticPage`: trang tĩnh chính sách/giới thiệu/liên hệ (`title`, `slug`, `contentHtml`, `status`, `seo`).
- `WebReview`: đánh giá sản phẩm (`productId`, `customerId`, `customerName`, `orderId`, `rating` 1–5, `comment`, `images[]`, `isVerifiedPurchase`, `status`: `'PENDING' | 'APPROVED' | 'REJECTED'`).
- `WebRedirect`: quản lý chuyển hướng 301 (`fromPath`, `toPath`, `statusCode`: `301 | 302`, `isActive`).
- `WebSiteSetting`: cấu hình toàn site (logo, màu brand, hotline, Zalo, Messenger, showroom/footer, bảng phí ship mặc định, GA4/GTM ID, chế độ kho online `FLOOR_1` hoặc `ALL`).
- `WebAuditLog`: nhật ký thao tác trên tab Quản lý Website (`actorId`, `actorName`, `actorRole`, `action`, `entityType`, `entityId`, `diffSummary`, `createdAt`).
- `CustomerOtp`: lưu mã OTP (hashed) + `expiresAt` + `attempts` cho đăng nhập khách hàng.

---

## 10. Rủi ro & Câu hỏi còn mở

### 10.1 Rủi ro kỹ thuật & nghiệp vụ
1. **Xung đột tồn kho POS vs Online:** Nếu không dùng atomic update ngay khi tạo đơn, 2 kênh có thể bán trùng sản phẩm cuối cùng. *(Đã xử lý bằng BR-02 và luồng giữ chỗ 15 phút)*.
2. **Dữ liệu sản phẩm hiện tại chưa có ảnh & mô tả chuẩn SEO:** Kho hiện tại chủ yếu phục vụ POS (tên, mã, giá, tồn). Cần có công cụ import/chỉnh sửa hàng loạt trong CMS và quy trình nhập liệu song song với quá trình dev.
3. **Bản quyền nội dung:** Tuyệt đối không dùng ảnh, logo, text của `mipik.vn` — cần chuẩn bị bộ ảnh/nội dung gốc của 11 Sport trước khi UAT.

### 10.2 Điểm cần xác nhận thêm khi vào giai đoạn Design / Backend
1. **Nguồn kho xuất đơn Online mặc định:** Chốt dùng `stockFloor1` (đồng bộ 100% với POS tại cửa hàng) hay cho phép lấy từ `stockFloor2` (kho dự trữ) nếu `stockFloor1` hết? *(Đặc tả hiện tại mặc định `stockFloor1` và có cờ cấu hình trong `WebSiteSetting` để linh hoạt)*.
2. **Xử lý đơn Online trên POS (`web/`):** Nhân viên bán hàng (`SALES`) tại cửa hàng có cần nhận thông báo đơn Online mới trên `web/` để đóng gói, hay toàn bộ việc xác nhận/đóng gói đơn Online sẽ thao tác trên `cms/` trong MVP?
3. **Định dạng nhà cung cấp OTP:** Dùng Email OTP (qua SMTP/Resend, chi phí thấp/miễn phí) làm mặc định cho MVP, còn SMS/ZNS OTP (tốn phí theo tin nhắn) sẽ bật khi có tài khoản ZNS/Brandname chính thức?

---

## Phiếu bàn giao

- **Từ:** Business Analyst (BA)
- **Gửi:** Project Manager (PM)
- **Công việc đã hoàn thành:** `WEB-01` — Viết đặc tả yêu cầu chi tiết cho Website bán hàng 11 Sport (`shop/`) và CMS tab "Quản lý Website" (`cms/`).
- **Tài liệu đính kèm:** `docs/requirements/web-storefront-v1.md`
- **Các điểm đã bám sát thực tế codebase:** Tái sử dụng trực tiếp các model `Product` (`variants`, `stockFloor1`, `stockFloor2`), `Category`, `Brand`, `Promotion`, `Order`, `Customer`, `Staff` (`StaffRole` đã có sẵn `CEO` và `ADMIN`).
- **Đề xuất bước tiếp theo:**
  1. PM duyệt tài liệu đặc tả & xác nhận 3 điểm mở ở Mục 10.2.
  2. Chuyển sang **Designer (`designer`)** thực hiện wireframe & design system cho `shop/` (desktop & mobile) và tab "Quản lý Website" trên `cms/`.
  3. Song song hoặc ngay sau Design, chuyển **Backend Dev (`backend-dev`)** cập nhật `docs/api-contract.md` cho `/api/v1/public/*` và `/api/v1/cms/web/*`.
