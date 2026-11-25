# Centralized Mock Data Vault & Mock API Router (`shop/src/data/mock/`)

Toàn bộ dữ liệu giả lập (mock data) của **Storefront Next.js (`shop/`)** được cô lập **100% trong thư mục `shop/src/data/mock/`**, ảnh SVG giả lập đặt tại `shop/public/images/mock/`, và được ánh xạ theo **đúng 100% cấu trúc JSON response (`{ data, meta }`) của Hợp đồng API `docs/api-contract.md` (v5.0)** tại `shop/src/repositories/mock/storefrontMockRepository.ts`.

## 1. Quy tắc Kiến trúc (Kiểm tra tự động bởi `shop/tests/mock-isolation.test.ts`)
1. **Không một component hay route nào** (`shop/src/app/**`, `shop/src/components/**`, `shop/src/lib/**`) được phép import trực tiếp từ `src/data/mock/*`.
2. Chỉ duy nhất tầng `shop/src/repositories/mock/storefrontMockRepository.ts` được đọc dữ liệu từ `src/data/mock/*`.
3. Mọi lời gọi `apiFetch()` trong `shop/src/lib/api.ts` (cả **Server Component SSR/ISR** lẫn **Client Component** như Giỏ hàng, Checkout, Đăng nhập OTP, Tra cứu đơn, Đánh giá, Form tư vấn) đều đi qua cùng một cổng:
   - Khi `NEXT_PUBLIC_DATA_SOURCE=mock` (mặc định khi chạy FE độc lập): `apiFetch()` gọi trực tiếp `storefrontMockRepository.handlePublicApiRequest(path, options)` và trả về payload chuẩn `{ data, meta }` y hệt Backend.
   - Khi `NEXT_PUBLIC_DATA_SOURCE=api` (khi đội Backend gắn API thật vào): `apiFetch()` gọi thẳng HTTP tới `${NEXT_PUBLIC_API_URL}` (`http://localhost:4000/api/v1`).

## 2. Danh sách 20 Public API Endpoints đã được Mock chuẩn Contract (`handlePublicApiRequest`)

| Nhóm | Method & Endpoint | Cấu trúc Response trả về (`{ data, meta }`) |
|---|---|---|
| **Trang chủ & Cấu hình** | `GET /public/home` | `{ data: HomeDataResponse, meta: {} }` (`banners`, `homeSections`, `flashSale`, `featuredProducts`, `categoryBlocks`, `brands`, `articles`, `usp`, `settings`) |
| | `GET /public/settings` | `{ data: SiteSettingsData, meta: {} }` (`siteName`, `hotline`, `zaloUrl`, `messengerUrl`, `showrooms[3]`, `shipping`) |
| | `GET /public/menu` | `{ data: MenuNode[], meta: {} }` (MegaMenu 2–3 cấp kèm `badge`, `children[]`) |
| **Danh mục & Thương hiệu** | `GET /public/categories/:slug` | `{ data: CategoryDetailResponse, meta: {} }` (`category`, `subCategories[]`, `brands[]`) hoặc `404 CATEGORY_NOT_FOUND` |
| | `GET /public/brands` | `{ data: BrandSummary[], meta: { total } }` (20 thương hiệu `A–K` / `L–Z`) |
| | `GET /public/brands/:slug` | `{ data: BrandSummary, meta: {} }` hoặc `404 BRAND_NOT_FOUND` |
| **Sản phẩm & Tìm kiếm** | `GET /public/products` | `{ data: ProductListItem[], meta: { total, page, limit, totalPages }, facets: { brands, colors, sizes, priceRange } }` (hỗ trợ lọc `category`, `brand`, `priceMin`, `priceMax`, `color`, `size`, `inStock`, `q` không dấu, `sort`, `page`, `limit`) |
| | `GET /public/products/:slug` | `{ data: ProductDetail, meta: {} }` (`images[]`, `variants[]`, `specs[]`, `promotions.tierPricing[]`, `promotions.giftPromotions[]`) hoặc `404 PRODUCT_NOT_FOUND` |
| | `GET /public/products/:slug/related` | `{ data: ProductListItem[], meta: {} }` |
| | `GET /public/search/suggest?q=` | `{ data: { products: [...], articles: [...] }, meta: {} }` |
| **Tin tức, Trang tĩnh, Review & Liên hệ** | `GET /public/articles` | `{ data: ArticleSummary[], meta: { total, page, limit, totalPages }, categories: [...] }` |
| | `GET /public/articles/:slug` | `{ data: ArticleDetail, meta: {} }` hoặc `404 ARTICLE_NOT_FOUND` |
| | `GET /public/pages/:slug` | `{ data: StaticPageDetail, meta: {} }` (4 trang chính sách + chương trình) hoặc `404 PAGE_NOT_FOUND` |
| | `GET /public/reviews` | `{ data: ReviewItem[], summary: { ratingAvg, ratingCount, breakdown }, meta: { total, page, limit } }` |
| | `POST /public/reviews` | `201`: `{ data: { _id, status: "PENDING" }, message: "..." }` |
| | `POST /public/contact` | `201`: `{ message: "Cảm ơn bạn đã liên hệ..." }` |
| **Giỏ hàng & Checkout** | `POST /public/cart/price` | `{ data: CartPriceResponse, meta: {} }` (tính giá sỉ `3+` / `5+` **theo từng biến thể `variantKey`**, mã giảm giá `SALE11` / `PIKPRO100` / `MIPIK200`, quà tặng `5+` / `10+` **không cộng dồn**, phí ship) |
| | `POST /public/orders` | `201`: `{ data: { orderCode: "ONL-...", totalAmount, paymentGateway, paymentStatus, fulfillmentStatus, paymentUrl?, qrCode?, reservedUntil? }, meta: {} }` |
| | `GET /public/orders/lookup?code=&phone=` | `{ data: CustomerOrderSummary, meta: {} }` (mã mẫu: `ONL-20261120-0188`, `ONL-20261115-0092`) hoặc `404 ORDER_NOT_FOUND` |
| | `GET /public/orders/:code/payment-status` | `{ data: { orderCode, paymentStatus, fulfillmentStatus, reservedUntil }, meta: {} }` |
| **Tài khoản Khách hàng (Customer JWT)** | `POST /public/customers/request-otp` | `{ message: "Mã OTP 6 số đã được gửi...", expiresInSeconds: 300 }` |
| | `POST /public/customers/verify-otp` | `{ data: { token: "mock-customer-jwt-...", customer: CustomerProfile }, meta: {} }` (nhập bất kỳ OTP 6 số như `123456`) |
| | `GET /public/customers/me` | `{ data: CustomerProfile, meta: {} }` |
| | `PUT /public/customers/me` | `{ data: CustomerProfile, meta: {} }` |
| | `GET /public/customers/me/orders` | `{ data: CustomerOrderSummary[], meta: { total } }` |
| **SEO Sitemap & Redirects** | `GET /public/sitemap-data` | `{ data: { categories, brands, products, articles, pages }, meta: {} }` |
| | `GET /public/redirects` | `{ data: [], meta: {} }` |

## 3. Hướng dẫn cho đội Backend khi gắn API thật vào
Khi đội phụ trách Backend sẵn sàng nối API vào FE `shop/`:
1. Trong file `shop/.env.local`, đổi:
   ```env
   NEXT_PUBLIC_DATA_SOURCE=api
   NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
   ```
2. Không cần sửa bất kỳ dòng code nào trong `shop/src/app/` hay `shop/src/components/`.
3. Khi muốn dọn sạch dữ liệu giả lập khỏi bản build production, chỉ cần xóa `shop/src/data/mock/`, `shop/src/repositories/mock/`, và `shop/public/images/mock/`.
