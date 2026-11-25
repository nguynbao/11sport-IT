# Kế hoạch: Website bán hàng tham chiếu mipik.vn (Next.js, SEO) + CMS Quản trị Web

> Trạng thái: DRAFT chờ PM/chủ dự án duyệt. Nguồn: phân tích mipik.vn (WordPress + WooCommerce + Flatsome + Rank Math).

## 1. Hiện trạng repo (đã đọc code)
- `server/`: Express + MongoDB (mongoose), TypeScript. Đã có Product, Category, Stock, Order, Customer, Staff, Import.
- `web/`: Next 14 + Tailwind, **đang là POS/Kho nội bộ** (không phải web khách).
- `cms/`: Next 14 + Tailwind, quản trị kho/đơn/nhân viên.
- => Web bán hàng cho khách là **app mới**; tái dùng `server` (mở rộng API public) và `cms`.

## 2. Phân tích mipik.vn – những điểm cần bám theo
**Bố cục trang chủ:** header sticky xanh đậm (logo, 7 menu có mega/dropdown, tìm kiếm, giỏ + mini-cart, VN/EN, tiền tệ) → hero slider (11 slide, mobile slider riêng) → các khối danh mục (Vợt: lưới 5 cột; Thời trang/Giày/Balo: carousel; Phụ kiện: lưới) xen banner → 4 USP cam kết → chứng nhận đại lý → carousel thương hiệu → footer 4 cột (showroom, sản phẩm, thông tin, blog).
**Hiệu ứng:** Flickity slider/carousel, sticky header, lightbox tìm kiếm + zoom ảnh, swatch màu đổi ảnh ngay trên card, lazy-load ảnh, pulse-ring nút gọi, widget nổi Hotline/Messenger/Zalo, live search (sản phẩm + bài viết), back-to-top.
**Trang danh mục:** hub theo thương hiệu (cha) + lưới 4/3/2 cột (con), sort dropdown, mô tả SEO dài + "Xem thêm".
**Trang sản phẩm:** breadcrumb, gallery + thumbnail + zoom, badge %/quà tặng, giá gạch + khung ưu đãi mua nhiều/quà tặng, swatch biến thể, số lượng, thêm giỏ, chính sách nhanh, mô tả "Xem thêm", sản phẩm tương tự.
**Giỏ/Checkout:** 2 cột, mã ưu đãi, chọn quà tặng, tính phí ship.

**Điểm yếu cần làm TỐT HƠN (lợi thế cạnh tranh):**
| Vấn đề mipik | Cách xử lý |
|---|---|
| Thiếu `<h1>` ở danh mục/blog/liên hệ, trùng 2 `<h1>` ở sản phẩm | 1 `<h1>` duy nhất mỗi trang (lint/test) |
| Meta description trang chủ bị cắt | Giới hạn 150–160 ký tự có kiểm tra ở CMS |
| Không có bộ lọc (giá/hãng/màu/…) | Thêm filter + URL SEO-safe (canonical) |
| Không có đánh giá sản phẩm, không "Mua ngay" | Thêm Reviews (+ schema AggregateRating), nút Mua ngay |
| Không flash sale/countdown, không bài nổi bật ở trang chủ | Thêm section tùy chọn quản lý từ CMS |
| Lỗi contrast nút (gradient/chữ đen trên xanh), block quà lặp, widget nổi che nội dung mobile | Design system có token màu đạt WCAG AA, QA mobile |
| Lỗi JS console toàn site | CI chặn console error (Playwright) |

## 3. Kiến trúc đề xuất
- **Storefront mới `shop/`**: Next.js 14 (App Router, cùng version với repo) + TypeScript + Tailwind; ISR/SSG cho trang chủ, danh mục, sản phẩm, bài viết (`revalidate` + on-demand revalidate khi CMS sửa); SSR cho tìm kiếm/giỏ.
- Carousel: Embla Carousel; animation: Framer Motion (nhẹ, tôn trọng `prefers-reduced-motion`); ảnh: `next/image` (AVIF/WebP), font `next/font` (Livvic).
- **i18n** VN/EN: `/en/` với `hreflang` (giai đoạn 2).
- **SEO**: `generateMetadata`, canonical, `sitemap.xml` + `robots.txt` động, JSON-LD (Organization, WebSite, BreadcrumbList, Product+Offer+AggregateRating, Article, FAQ), URL tiếng Việt không dấu (`/vot-pickleball/…`), 301 redirect manager, Open Graph, Core Web Vitals (LCP < 2.5s, CLS < 0.1), Search Console/GA4/GTM.
- **Server**: thêm module storefront: Brand, Banner, Collection/Homepage section, Variant/Swatch, Gift rule & tier price (mua nhiều), Coupon, Review, Article/Category bài viết, SEO meta (per entity), Redirect, Setting site. Public API `/api/v1/public/*` (read-only, cache) tách khỏi API nội bộ.
- **Đồng bộ kho**: dùng chung tồn kho/đơn hàng đã có (đơn online vào cùng luồng Order).
- **Thanh toán**: COD + chuyển khoản QR (VietQR/SePay/PayOS) trước; cổng thẻ giai đoạn sau. Không lưu dữ liệu thẻ.

## 4. CMS: tab mới "Quản lý Website" (quyền ADMIN, CEO)
- Thêm vai trò `CEO` (xem toàn bộ + báo cáo; ADMIN: toàn quyền cấu hình). SALES không thấy tab.
- Mục con: Banner/Slider (desktop+mobile, lịch hiển thị) · Bố cục trang chủ (bật/tắt, sắp xếp section) · Menu/Mega menu · Thương hiệu · Bài viết/Blog · Trang tĩnh & chính sách · SEO (title/meta/canonical/schema, redirect, sitemap) · Khuyến mãi (giá mua nhiều, quà tặng, coupon, flash sale) · Đánh giá (duyệt) · Footer/Liên hệ/Showroom/Widget chat · Đơn online & khách hàng web · Dashboard CEO (doanh thu online, conversion, top sản phẩm, traffic từ GA4) · Nhật ký thao tác (audit log).
- Thay đổi → gọi revalidate cho `shop/`.

## 5. Lộ trình (theo luồng pm → ba → designer → backend → frontend → tester)
| Giai đoạn | Nội dung | Agent | Ước tính |
|---|---|---|---|
| P0 | Chốt phạm vi, thương hiệu/tên miền/logo/màu riêng (không sao chép ảnh, nội dung, logo của mipik) | pm, ba | 3–5 ngày |
| P1 | Design system + wireframe (home, danh mục, sản phẩm, giỏ, checkout, blog, CMS web) – desktop & mobile | designer | 1–1.5 tuần |
| P2 | Backend: model + public API + RBAC CEO, cập nhật `docs/api-contract.md` | backend-dev | 2 tuần |
| P3 | `shop/`: layout, home, danh mục + filter, sản phẩm, live search, mini-cart | frontend-dev | 3 tuần |
| P4 | Giỏ, checkout, thanh toán, tài khoản, đơn hàng | backend + frontend | 2 tuần |
| P5 | CMS tab Quản lý Website | frontend + backend | 2–3 tuần (song song P3–P4) |
| P6 | SEO kỹ thuật, hiệu năng, i18n, blog | frontend | 1 tuần |
| P7 | Docker/CI/CD, staging, CDN ảnh, monitoring (song song) | devops | liên tục |
| P8 | Test chức năng, SEO audit (Lighthouse ≥ 90), bảo mật, mobile, UAT | tester | 1–1.5 tuần |
Tổng MVP ≈ 10–12 tuần (1 team nhỏ).

## 6. Rủi ro
- Bản quyền: chỉ bám bố cục/UX, **không** dùng lại ảnh, logo, nội dung của mipik.
- Thanh toán/dữ liệu khách: HTTPS, rate-limit, validate, không log PII (xét bảo mật trước).
- Lệ thuộc đơn hàng POS hiện có: cần migrate/đồng bộ model Product (thêm biến thể).
- Dữ liệu SEO cần nhập tay: dựng công cụ nhập CSV/Excel.

## 7. Câu hỏi cần chốt
1. Ngành hàng/tên thương hiệu của shop (vẫn là đồ thể thao 11 Sport? pickleball?).
2. Đặt web khách ở thư mục mới `shop/` (khuyến nghị) hay thay `web/` POS?
3. Cổng thanh toán nào; có cần VN/EN ngay MVP không?
4. CEO chỉ xem báo cáo hay được sửa nội dung?
5. Hosting (hiện có `render.yaml`) – giữ Render hay chuyển VPS/Vercel?
