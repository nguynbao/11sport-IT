# Design System — 11 Sport Storefront (`shop/`)

- **Mã tài liệu:** `WEB-02`
- **Phiên bản:** `v1.0`
- **Người lập:** UI/UX Designer (`11sport-designer`)
- **Tham chiếu:** `docs/requirements/web-storefront-v1.md`, `docs/requirements/mipik-ecommerce-plan.md`, `docs/design/design-system.md`

---

## 1. Triết lý & Định hướng Thương hiệu (`shop/`)

- **Phong cách:** Thể thao năng động, sắc nét, tốc độ và đáng tin cậy (**Athletic Performance & Clean Commerce**).
- **Nhận diện màu sắc trong hệ sinh thái 11 Sport:**
  - `web/` (POS & Kho): Royal Blue (`#2563EB`)
  - `cms/` (Quản trị): Executive Teal (`#0D9488`)
  - `shop/` (Storefront khách hàng): **Deep Forest Emerald (`#065F46`)** kết hợp nền trắng tinh khiết (`#FFFFFF`), chữ tối sắc nét (`#0F172A`) và điểm nhấn **Sport Crimson (`#DC2626`)** / **Volt Lime (`#BEF264` trên nền tối)**.
- **Nguyên tắc khắc phục lỗi UX/UI từ `mipik.vn`:**
  1. **Tương phản WCAG AA bắt buộc:** Mọi văn bản thường đạt tỷ lệ tương phản `>= 4.5:1`, văn bản lớn/icon đạt `>= 3:1`. **Tuyệt đối không** dùng nút nền gradient làm mờ chữ hoặc chữ đen trên nền xanh đậm.
  2. **Không che khuất nội dung trên Mobile:** Widget nổi (Hotline/Zalo/Messenger) tự thu gọn thành 1 nút tròn gọn gàng, đặt cao hơn Sticky CTA Bar (`bottom >= 84px`), đảm bảo không đè lên nút "Mua ngay" / "Thanh toán".
  3. **Badge sạch, không đè chữ:** Badge giảm giá (`-20%`), `Quà tặng`, `Hết hàng` đặt cố định ở góc ảnh hoặc hàng tag riêng phía trên tiêu đề, không chồng lấn lên tên sản phẩm hay giá bán.
  4. **Vùng chạm cảm ứng:** Mọi nút bấm, swatch màu, size chip, icon header trên mobile/tablet có kích thước tối thiểu **`44x44px`**.

---

## 2. Color Tokens (TailwindCSS & CSS Variables)

### 2.1 Bảng màu chính & Kiểm định WCAG AA

| Token | Giá trị Hex | Tailwind gợi ý | Mục đích sử dụng | Tỷ lệ tương phản (Contrast) |
|---|---|---|---|---|
| `--color-brand-primary` | `#065F46` | `emerald-800` | Header, CTA chính ("Mua ngay", "Thanh toán"), link active | `7.68:1` với chữ `#FFFFFF` (AAA) |
| `--color-brand-primary-hover` | `#064E3B` | `emerald-900` | Hover CTA chính, nền Header top bar | `9.74:1` với chữ `#FFFFFF` (AAA) |
| `--color-brand-primary-light` | `#047857` | `emerald-700` | Nút phụ viền/nền nhạt active, icon nhấn | `5.48:1` với chữ `#FFFFFF` (AA) |
| `--color-brand-tint` | `#ECFDF5` | `emerald-50` | Nền khung ưu đãi, highlight chip đã chọn | `16.9:1` với chữ `#065F46` (AAA) |
| `--color-brand-border` | `#A7F3D0` | `emerald-200` | Viền khung ưu đãi, card selected | — |
| `--color-accent-volt` | `#BEF264` | `lime-300` | Badge "MỚI", highlight trên nền `#064E3B` hoặc chữ `#0F172A` | `13.9:1` với chữ `#0F172A` (AAA) |
| `--color-accent-hot` | `#DC2626` | `red-600` | Giá khuyến mãi, badge `-XX%`, Flash Sale countdown | `4.83:1` với chữ `#FFFFFF` (AA) |
| `--color-accent-hot-tint` | `#FEF2F2` | `red-50` | Nền badge lỗi / cảnh báo hết hàng | `7.4:1` với chữ `#B91C1C` (AAA) |

### 2.2 Neutral & Surfaces

| Token | Giá trị Hex | Mục đích sử dụng | Contrast trên `#FFFFFF` |
|---|---|---|---|
| `--color-bg-page` | `#FFFFFF` | Nền trang chính | — |
| `--color-bg-subtle` | `#F8FAFC` (`slate-50`) | Nền section xen kẽ, Footer, sidebar filter | — |
| `--color-bg-muted` | `#F1F5F9` (`slate-100`) | Nền ảnh sản phẩm, skeleton, input disabled | — |
| `--color-border` | `#E2E8F0` (`slate-200`) | Viền card, divider, input border | — |
| `--color-text-primary` | `#0F172A` (`slate-900`) | Tiêu đề `<h1>`–`<h4>`, tên sản phẩm, giá bán | `17.85:1` (AAA) |
| `--color-text-secondary` | `#334155` (`slate-700`) | Đoạn mô tả, label form, breadcrumb | `10.7:1` (AAA) |
| `--color-text-muted` | `#64748B` (`slate-500`) | Giá gạch ngang, meta bài viết, placeholder | `4.76:1` (AA) |

> **Cấm sử dụng** `slate-400` (`#94A3B8`) cho chữ nội dung trên nền trắng vì không đạt chuẩn 4.5:1.

### 2.3 Semantic & Trạng thái

- **Success:** Nền `#ECFDF5`, chữ `#065F46`, icon `#10B981` (Còn hàng, Đặt hàng thành công, Đã thanh toán QR).
- **Warning:** Nền `#FFFBEB`, chữ `#92400E`, icon `#F59E0B` (Sắp hết hàng `Còn 2 sp`, Chờ xác nhận QR).
- **Danger:** Nền `#FEF2F2`, chữ `#B91C1C`, icon `#DC2626` (Hết hàng, Hết hạn QR 15 phút, Lỗi form).
- **Info:** Nền `#EFF6FF`, chữ `#1E40AF`, icon `#3B82F6` (Thông tin giao hàng, Đang vận chuyển).

---

## 3. Typography & Định dạng hiển thị

- **Font chính (`--font-sans`):** `Be Vietnam Pro` (Google Fonts qua `next/font/google`, weights `400, 500, 600, 700, 800`, subset `vietnamese`).
- **Font kỹ thuật (`--font-mono`):** `JetBrains Mono` (weights `500, 600, 700`) kèm `font-variant-numeric: tabular-nums` cho:
  - Giá bán & Giá gạch (`1.250.000 ₫`)
  - Mã SKU (`11S-VOT-JOOLA-01`), Mã đơn hàng (`ONL-20261120-001`), Mã Coupon (`SALE11`)
  - Đồng hồ đếm ngược Flash Sale & QR 15 phút (`14:59`)

### Thang kích thước (Type Scale)

| Cấp độ | Mobile (`< 768px`) | Desktop (`>= 1024px`) | Line-height | Weight | Dùng cho |
|---|---|---|---|---|---|
| `h1` | `24px` (`1.5rem`) | `34px` (`2.125rem`) | `1.25` | `800` | Duy nhất 1 thẻ `<h1>` mỗi trang |
| `h2` | `20px` (`1.25rem`) | `26px` (`1.625rem`) | `1.3` | `700` | Tiêu đề section trang chủ, nhóm mô tả PDP |
| `h3` | `17px` (`1.0625rem`) | `20px` (`1.25rem`) | `1.35` | `700` | Tiêu đề sub-section, tên modal/drawer |
| `body` | `15px` (`0.9375rem`) | `16px` (`1rem`) | `1.6` | `400/500` | Nội dung mô tả, bài viết blog |
| `card-title` | `14px` (`0.875rem`) | `15px` (`0.9375rem`) | `1.4` | `600` | Tên sản phẩm trên `ProductCard` (tối đa 2 dòng `line-clamp-2`) |
| `caption` | `12px` (`0.75rem`) | `13px` (`0.8125rem`) | `1.4` | `500` | Breadcrumb, badge, metadata, chú thích |

---

## 4. Layout, Spacing, Radius & Shadows

### 4.1 Breakpoints & Container
- **Mobile:** `< 768px` (Padding ngang `16px`, lưới sản phẩm `2 cột`, gap `12px`).
- **Tablet:** `768px – 1023px` (Padding ngang `24px`, lưới sản phẩm `3 cột`, gap `16px`).
- **Desktop:** `>= 1024px` (Container tối đa `1280px` `max-w-7xl mx-auto px-6`, lưới danh mục `4 cột`, trang chủ có thể `4–5 cột` tùy khối).

### 4.2 Spacing & Radius
- **Khoảng cách giữa các Section trang chủ:** Mobile `32px` (`py-8`), Desktop `48px–56px` (`py-12`).
- **Border Radius:**
  - Card sản phẩm / Khung ưu đãi: `12px` (`rounded-xl`).
  - Nút bấm chính / Input / Select: `8px` (`rounded-lg`).
  - Badge / Pill / Swatch chip: `6px` (`rounded-md`) hoặc `9999px` (`rounded-full` cho swatch màu tròn).
  - Modal / Banner Hero: `16px` (`rounded-2xl`).

### 4.3 Shadows (Elevation)
- `shadow-card`: `0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)`
- `shadow-card-hover`: `0 10px 25px -5px rgba(15, 23, 42, 0.10), 0 4px 10px -2px rgba(15, 23, 42, 0.05)`
- `shadow-sticky`: `0 -4px 16px rgba(15, 23, 42, 0.08)` (dùng cho Sticky Mobile CTA Bar)
- `shadow-drawer`: `0 20px 50px rgba(15, 23, 42, 0.18)` (Mega menu, Mini-cart Drawer, Search Lightbox)

---

## 5. Đặc tả Component cốt lõi (`shop/`)

### 5.1 Sticky Header & Mega Menu
- **Desktop (`>= 1024px`):**
  - Chiều cao `72px` (`sticky top-0 z-40 bg-white border-b border-slate-200`), kèm **Top Announcement Bar** mảnh `32px` (`bg-[#064E3B] text-white text-xs`) hiển thị hotline & freeship.
  - Bố cục 1 tầng gọn: `[Logo 11 Sport]` | `[Menu ngang 6–7 mục chính]` | `[Icon Search]` `[Tài khoản]` `[Giỏ hàng + Badge số lượng]`.
  - **Mega Menu:** Hover hoặc click mục cha (có mũi tên chỉ thị) mở panel rộng `max-w-7xl`, chia 3–4 cột (Danh mục con + Thương hiệu nổi bật + 1 Banner khuyến mãi nhỏ). Đóng khi nhấn `Esc` hoặc di chuột ra ngoài (`150ms` delay tránh giật).
- **Mobile & Tablet (`< 1024px`):**
  - Chiều cao `60px`: `[Hamburger 44x44]` | `[Logo giữa]` | `[Search 44x44]` `[Giỏ hàng 44x44]`.
  - Bấm Hamburger mở **Mobile Navigation Drawer** từ trái sang (`w-[85vw] max-w-[360px]`), hỗ trợ accordion mở cấp 2–3.

### 5.2 ProductCard (Chuẩn không đè chữ)
- **Cấu trúc dọc cố định (từ trên xuống):**
  1. **Khung ảnh (`aspect-square bg-slate-100 rounded-t-xl overflow-hidden relative`):**
     - Chỉ đặt tối đa **2 badge góc**: góc trên-trái `badge -20%` (`bg-[#DC2626] text-white`), góc trên-phải `Quà tặng` hoặc `Mới` (`bg-[#065F46] text-white`).
     - Nếu hết hàng toàn bộ biến thể: overlay nhẹ `bg-white/65` + pill giữa ảnh `Tạm hết hàng` (`bg-slate-900 text-white`).
     - Khi hover trên desktop: zoom ảnh nhẹ `scale-105`.
  2. **Hàng Swatch màu (`h-7 px-3 pt-2.5 flex items-center gap-1.5`):**
     - Hiển thị tối đa 4 chấm tròn màu (`w-5 h-5 rounded-full`, vùng chạm mở rộng `p-1` hoặc `>= 28px` trên card, trên PDP là `44x44px`).
     - Bấm/hover vào swatch màu nào -> **đổi ngay ảnh chính của ProductCard** sang ảnh biến thể tương ứng (`variant.imageUrl`). Nếu > 4 màu, hiển thị `+N`.
  3. **Thương hiệu & Tên sản phẩm (`px-3 pt-1.5`):**
     - Tên brand nhỏ `text-xs font-semibold uppercase tracking-wide text-slate-500`.
     - Tên sản phẩm `text-sm font-semibold text-slate-900 line-clamp-2 min-h-[40px]`.
  4. **Đánh giá & Giá bán (`px-3 pb-3 pt-1 mt-auto`):**
     - Sao đánh giá (`★ 4.8 (12)` — chỉ hiện nếu `ratingCount > 0`).
     - Giá bán `font-mono font-bold text-base text-[#DC2626]` (nếu có giảm giá) hoặc `text-slate-900`, bên cạnh giá gốc `text-xs line-through text-slate-500`.

### 5.3 Carousel / Slider (Embla Carousel)
- Dùng `embla-carousel-react` cho Hero Slider, Flash Sale, Khối danh mục dạng Carousel, Thương hiệu đối tác.
- **Hero Slider:** Ảnh riêng cho Desktop (`1440x520`, tỷ lệ ~`16:6`) và Mobile (`750x750` hoặc `4:3`), ưu tiên `priority` + `fetchPriority="high"` cho slide đầu tiên để đạt `LCP < 2.5s`.
- Nút điều hướng `<` `>` kích thước `44x44px`, nền `bg-white/90 text-slate-900 shadow-md` (tương phản cao, không trong suốt mờ).

### 5.4 Filter Sidebar (Desktop) & Filter Drawer (Mobile)
- **Desktop:** Cột trái cố định `w-[260px] shrink-0`, các nhóm lọc dạng Accordion: Khoảng giá (preset + 2 ô nhập min/max), Thương hiệu (checkbox có đếm số lượng), Màu sắc (swatch + tên), Size (chip lưới), Tình trạng (`Chỉ hiện còn hàng`).
- **Mobile:** Nút `Bộ lọc (N)` + `Sắp xếp` nằm trên thanh sticky dưới header. Bấm `Bộ lọc` mở Drawer trượt từ dưới/trái, có nút cố định dưới đáy: `[Xóa lọc]` và `[Xem 48 sản phẩm]` (`min-h-[44px]`).
- **Active Filter Chips:** Hiển thị hàng tag các bộ lọc đang chọn ngay trên lưới sản phẩm kèm nút `×` gỡ nhanh và `Xóa tất cả`.

### 5.5 Live Search Lightbox
- Kích hoạt khi bấm icon kính lúp (hoặc ô search trên header).
- Overlay `bg-slate-900/50 backdrop-blur-xs`, khung modal `max-w-3xl mx-auto mt-16 bg-white rounded-2xl shadow-drawer`.
- Gõ từ khóa (debounce `250ms`) hiển thị chia 2 vùng rõ ràng:
  - **Sản phẩm gợi ý (tối đa 5):** Thumbnail `48x48`, Tên, Giá bán (`font-mono`), trạng thái còn hàng.
  - **Bài viết hướng dẫn (tối đa 3):** Thumbnail nhỏ, Tiêu đề bài viết.
  - Nút đáy: `Xem tất cả kết quả cho "<từ khóa>" →` dẫn tới `/tim-kiem?q=...`.

### 5.6 Mini-Cart Drawer
- Trượt từ cạnh phải (`w-full max-w-[420px]`), `z-50`.
- Gồm 3 phần:
  1. **Header:** `Giỏ hàng (N sản phẩm)` + nút đóng `44x44px`.
  2. **Body (cuộn độc lập):** Danh sách item (ảnh, tên, biến thể Màu/Size, bộ đếm `- 1 +` nút `36x36px` trên desktop / `44x44px` trên mobile, nút xóa). Thanh tiến độ Freeship (VD: `Mua thêm 150.000₫ để được Freeship`).
  3. **Footer cố định:** Tạm tính (`font-mono font-bold text-lg`), 2 nút ngang hàng: `[Xem giỏ hàng]` (outline) và `[Thanh toán ngay]` (solid `#065F46`, `min-h-[48px]`).

### 5.7 Sticky Mobile CTA & Floating Chat Widget An Toàn
- **Sticky Mobile CTA (trên PDP & Cart/Checkout `< 768px`):**
  - Thanh cố định đáy màn hình `fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-sticky`.
  - PDP gồm: `[Thêm vào giỏ]` (viền `#065F46`, chữ `#065F46`) + `[Mua ngay]` (nền `#065F46`, chữ `#FFFFFF`), chiều cao tối thiểu `48px`.
- **Floating Chat Widget (Hotline / Zalo / Messenger):**
  - Desktop: đặt góc dưới-phải `bottom-6 right-6 z-30`, gồm 1 nút tổng hoặc 3 icon dọc gọn (`48x48px`), kèm nút Back-to-top phía trên khi cuộn > `400px`.
  - Mobile (`< 768px`): thu gọn thành **1 nút tròn duy nhất** (`48x48px`, icon chat/hotline) đặt ở `bottom-[88px] right-4` (khi trang có Sticky CTA Bar) hoặc `bottom-5 right-4` (các trang khác). Bấm vào mới bung menu chọn Hotline / Zalo / Messenger. **Đảm bảo không bao giờ che nút CTA chính.**

### 5.8 Toast & Skeleton States
- **Toast:** Góc trên-phải (desktop) / trên-giữa (mobile), tự ẩn sau `3.5s`, nút đóng `44x44px`, có `role="status"` / `aria-live="polite"`.
- **Skeleton:** Nền `bg-slate-200 animate-pulse`, giữ nguyên tỷ lệ kích thước thật của `ProductCard`, Hero Banner, PDP Gallery để đạt **`CLS < 0.1`**.

---

## 6. Spec Animation & Hiệu ứng

| Hiệu ứng | Thư viện / CSS | Thông số chuẩn | `prefers-reduced-motion` |
|---|---|---|---|
| **Slider / Carousel** | Embla Carousel | `duration: 25ms` physics mượt, hỗ trợ kéo tay (drag/swipe), autoplay `5000ms` (tạm dừng khi hover/focus) | Tắt autoplay, chuyển slide tức thì |
| **Section Reveal** | Framer Motion | `initial={{ opacity: 0, y: 16 }}` -> `whileInView={{ opacity: 1, y: 0 }}`, `viewport={{ once: true, amount: 0.15 }}`, `duration: 0.35s` | Bỏ dịch chuyển `y`, chỉ giữ hoặc tắt fade |
| **ProductCard Hover** | Tailwind CSS | `transition-transform duration-200 ease-out` (ảnh `scale-105`, card `shadow-card-hover`) | Tắt `scale-105` |
| **Drawer / Modal** | Framer Motion / Radix | Trượt/fade `200ms ease-out`, backdrop fade `150ms` | Hiển thị tức thì `duration: 0` |
| **Pulse Hotline** | CSS Keyframe | Vòng pulse nhẹ trên nút Hotline desktop (không nhấp nháy gắt) | Tắt animation |

---

## 7. Checklist Accessibility (A11y) cho Frontend Dev
1. Mọi ảnh sản phẩm/banner có `alt` mô tả rõ ràng; icon trang trí dùng `aria-hidden="true"`.
2. Đúng **1 thẻ `<h1>`** mỗi trang; thứ tự heading `h1 -> h2 -> h3` không nhảy cóc.
3. Toàn bộ nút chỉ có icon (Cart, Search, Close, Hamburger) bắt buộc có `aria-label` tiếng Việt.
4. Hỗ trợ điều hướng bàn phím (`Tab`, `Enter`, `Esc` để đóng Mega Menu, Live Search, Mini-Cart, Filter Drawer) với vòng focus rõ ràng (`focus-visible:ring-2 focus-visible:ring-[#065F46] focus-visible:ring-offset-2`).
