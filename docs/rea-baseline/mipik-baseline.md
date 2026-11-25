# REA Baseline — `https://mipik.vn/` Reverse-Engineering Summary

- **Captured:** 2026-11-22 via REA (`capture_browser_scenario` with headless Chrome, `vi-VN`, `Asia/Ho_Chi_Minh`)
- **Templates Inspected:**
  1. Homepage Desktop (`1440×900`, `https://mipik.vn/`) — 1,090,154 chars DOM, 736 events, full screenshot & a11y tree
  2. Homepage Mobile (`390×844`, `https://mipik.vn/`) — full screenshot
  3. Category / Brand Hub (`1440×900`, `https://mipik.vn/vot-pickleball/`) — 1,253,505 chars DOM, screenshot
  4. Product Detail (`1440×900`, `https://mipik.vn/joola-perseus-power-fx/`) — 494,882 chars DOM, screenshot
  5. News Listing (`1440×900`, `https://mipik.vn/tin-tuc/`) — 459,712 chars DOM, screenshot
  6. Contact / Store Locator (`1440×900`, `https://mipik.vn/lien-he/`) — 436,694 chars DOM, screenshot

## Measured Tech Stack & Live Defects
- **Origin Stack:** WordPress 7.1.5 + Flatsome 3.20.5 + WooCommerce 11.3.1 + WOOF Product Filter + Contact Form 7 + Multi-language (`vi` root + `/en/` alternate) + Multi-currency (`VND`/`USD`).
- **Observed Defects (Fixed in Next.js Clone):**
  - 34 CSS stylesheets, 60 JS scripts, 227 images loaded on homepage alone.
  - 3 × HTTP `404` requests for `Livvic` `.woff2` fonts exposing server path `/home/mipik/domains/mipik.vn/public_html/wp-content/fonts/livvic/...`.
  - 1 uncaught runtime JS error (`TypeError: Cannot read properties of null (reading 'classList')`).
  - Duplicate `<h1>` elements on Product Detail Page (product title + article intro heading).
  - Missing `SportingGoodsStore` (`LocalBusiness`) multi-branch JSON-LD, `FAQPage` schema, `ItemList` schema, and tiered `UnitPriceSpecification` in `Offer`.

## Measured Design Tokens
- **Font Family (CRITICAL REAL-RENDER FINDING):** CSS declares `Livvic, sans-serif`, **but all 3 `Livvic` `.woff2` requests fail with HTTP `404` (`document.fonts` status `"error"`)**, so Chrome actually renders system neutral grotesque **`sans-serif` (`Arial`)**. Design System & Next.js therefore standardize on **`Inter`** (Google Font neutral grotesque matching the actual rendered silhouette on `mipik.vn` with full Vietnamese glyphs and zero 404/FOUT).
- **Primary Brand Forest Green:** `#224e40` (variants: `#204b3e`, `#214f41`, hover `#186746`, dark `#173e32`)
- **Secondary Warm Cream:** `#f8eee9`, Category Guarantee Pill `#f1e4d6`
- **Highlighted Nav Pill (`THỜI TRANG`):** bg `#E3F8E7`, border `1px solid #9CDEB5`, ink `#164A38`, hover bg `#DCF5E2` / border `#7FD4A1`, height `32px`, `border-radius: 999px`, diagonal shimmer sweep (`1s ease-out`)
- **Sage Panel Surface & Border:** bg `#f4f7f5` / `#f7f9f5`, border `#dee3dd`
- **Product Card:** bg `#FFFFFF`, border `1px solid #E7E3DC`, `border-radius: 18px` desktop (`12px` mobile), hover `translateY(-3px)` + `0 12px 26px rgba(32,75,62,.07)`
- **Badges:** bg `#204B3E`, color `#FFFFFF`, `12px` bold, `border-radius: 999px` (pill) or `8px`; Gift tag mint `#E3F8E7` / `#164A38`
- **Sale / Alert Red:** `#9a0303` / `#e53935` | **Success Olive:** `#627D47` | **Accent Gold:** `#fbb03b` | **Ink:** `#0a0a0a`, `#1e2c26`, `#313131`
- **Layout Dimensions:** Header `70px` desktop (`60px` mobile), Max container `1290px`, Footer bg `#224e40` white text (`30px` vertical padding).

## Exact Navigation & Taxonomy Observed
- **Top Nav (7 items):**
  1. `Vợt Pickleball` (`/vot-pickleball`) — Mega-dropdown grouped `A-K` (`CRBN`, `Facolos`, `Franklin`, `Honolulu`, `Joola`, `Kaitashi`, `Kaiwin`, `Kamito`, `KBS`) and `L-Z` (`Loco`, `Luzz`, `Proton`, `RPM`, `Selkirk`, `Six Zero`, `Sypik`, `Thunder`, `Vole`, `Wika`, `Zocker`) — **20 brands**
  2. `Thời trang PikPro` (highlighted mint pill, `/danh-muc-san-pham/thoi-trang`) — `Combo`, `Áo`, `Nón`, `Túi`
  3. `Giày` (`/giay-pickleball`) — `Giày Asics`, `Giày Skechers`, `Giày ON`, `Giày Kaitashi`
  4. `Balo` (`/balo-tui-pickleball`)
  5. `Phụ kiện` (`/phu-kien-pickleball`) — Bóng, Tất, Miếng dán viền, Bao vợt, Băng cổ tay, Bình xịt vệ sinh
  6. `Tin tức` (`/tin-tuc`) — `Review & Đánh giá`, `Kiến thức Pickleball`, `Tư vấn dụng cụ Pickleball`, `Tin tức & Cộng đồng`
  7. `Liên hệ` (`/lien-he`)
- **Homepage Section Order:**
  1. Sticky Header (`70px` desktop / `60px` mobile)
  2. Hero Banner Carousel (`2560×880` desktop / `1200×1200` mobile, arrows + pagination dots)
  3. `VỢT PICKLEBALL` — Boxed centered title + 5-col desktop / 4-col tablet / 2-col mobile grid/slider (mini color thumbnail swatches + `+N` overflow)
  4. `THỜI TRANG` — Boxed title + 5-col slider
  5. `GIÀY` — Boxed title + 5-col slider (with color swatches)
  6. `TÚI - BALO` — Boxed title + 5-col slider
  7. `PHỤ KIỆN` — Boxed title + 5-col slider
  8. 4-Column Dashed Elevated Trust Strip (`Tặng quấn cán, dán viền, bao vợt` | `Bảo hành chính hãng` | `100% hàng chính hãng` | `Miễn phí vận chuyển`)
  9. Brand Category Carousel (7 cols desktop / 4 cols mobile)
  10. 4-Column Forest Green Footer (Branches & Hotline | Sản phẩm | Thông tin | Blog + COD/MasterCard/Visa + Copyright)
  11. Floating Right Contact Dock (Pulsing Hotline Phone, Messenger, Zalo, Back-to-top) + Zalo Store Consultant Modal (`Chọn cửa hàng tư vấn`).

## Exact PDP Tiered Promo & Bulk Pricing Rules Observed
Verbatim from live `mipik.vn` PDP (`Joola Perseus Power FX`):
- **Bulk Pricing (`GIÁ MUA NHIỀU`):** `"Mua từ 3 sản phẩm cùng biến thể"` and `"Mua từ 5 sản phẩm cùng biến thể"` — aggregated **per SKU / same variant (`variantId`)**, replacing the regular/sale unit price when the variant quantity meets the highest applicable threshold.
- **Free Gifts (`QUÀ TẶNG KÈM THEO`):** `"Mua 5 sản phẩm → 1 áo"` | `"Mua 10 sản phẩm → 2 áo + 1 túi"` — non-stacking (highest eligible threshold reached), validated at cart (`"Ưu đãi được kiểm tra lại tại giỏ hàng."`).
