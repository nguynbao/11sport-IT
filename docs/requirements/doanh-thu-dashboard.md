# Dashboard doanh thu — chuẩn hóa chỉ số & trả hàng đơn công nợ

Trạng thái: chủ dự án đã duyệt 4 quyết định (D1–D4). Tác giả: BA. Đích: backend-dev → tester.
Phạm vi code: `server/src/routes/reports.ts` (GET `/reports/revenue-dashboard`), `returns.ts` (POST `/returns`, `/returns/calculate`), `ordersCustomers.ts`, `models/Order.ts`, `models/ReturnExchange.ts`.

## 1. Hiện trạng đã xác minh trong code

| # | Sự thật (file) | Hệ quả |
|---|---|---|
| H1 | `totalAmount = afterBillDiscount + cardFee` (`ordersCustomers.ts` ~L584-586). `subtotal = Σ lineTotal` (đã trừ giảm giá SP, CHƯA trừ giảm bill). `lineTotal = unitPrice × qty`, `unitPrice` đã sau giảm SP. | `totalAmount` **có** phí thẻ. |
| H2 | Dashboard: `orderRevenue += totalAmount`, `netRevenue = orderRevenue + netReturnImpact` (`reports.ts` ~L727-735, L850) | Doanh thu thuần hiện **đang gồm phí thẻ** → sai D1. |
| H3 | `returnTotal = returnSubtotal + refundedCardFee`; `netDifference = exchangeTotal − returnTotal` (`returns.ts` ~L499-501) | `netDifference` **có** phí thẻ hoàn. Dashboard cộng `netDifference` vào `netRevenue` và đồng thời trừ `refundedCardFee` khỏi `cardFeeTotal` → trừ phí thẻ 2 lần ở góc nhìn doanh thu. |
| H4 | Dòng trả: `lineTotal = originalLine.unitPrice × take` (`returns.ts` L186) — **bỏ qua phân bổ giảm giá bill**. | Trả hàng của đơn có giảm bill hoàn **dư** tiền; doanh thu thuần bị trừ quá. |
| H5 | `refundedCardFee` = tỷ lệ `returnSubtotal/order.subtotal × order.cardFee`, dòng trả cuối cùng lấy phần còn lại. Vì giảm bill tỷ lệ theo lineTotal nên tỷ lệ này tương đương tỷ lệ theo tiền hàng sau giảm bill → **đúng**, giữ nguyên. | Không cần đổi công thức, chỉ tách khỏi doanh thu. |
| H6 | Giá vốn dùng `prod.costPrice` hiện tại cho cả bán, trả, đổi (`reports.ts` L684, 786, 809). `IOrderItem` và item của ReturnExchange **không có** `unitCost`. | Sai D-giá-vốn: cần lưu giá vốn lúc bán. |
| H7 | `POST /returns` **không đụng tới** `debtAmount/debtStatus/paidAmount`; `refundAmount` tính như đơn đã trả đủ. | Sai D4. |
| H8 | `collectedRevenue = max(0, netRevenue − outstandingDebtInPeriod)`; không dùng `debtPayments.paidAt` (`reports.ts` ~L851). `totalCollectedDebt = initialDebt − debt` (L931). | Sai D3; và nếu trả hàng giảm nợ thì "đã thu nợ" bị tính nhầm. |
| H9 | Báo cáo lọc đơn theo `createdAt`, phiếu trả theo `createdAt` của phiếu. | Khớp D2 (kỳ theo ngày làm phiếu), chỉ thiếu ghi chú phần hoàn từ đơn kỳ trước. |
| H10 | `paidAmount = totalAmount − debtAmount` khi tạo đơn và khi thu nợ (`ordersCustomers.ts` L635, L1068). | Sau trả hàng giảm nợ, công thức này sai → cần định nghĩa lại (mục 5). |

## 2. Công thức chuẩn

Ký hiệu cho một đơn: `L_i` = lineTotal dòng i (sau giảm SP); `S = ΣL_i` (không tính quà tặng, quà có `L=0`); `B` = billDiscountAmount; `F` = cardFee.

- **Phân bổ giảm bill** cho dòng i: `B_i = round(L_i / S × B)`; dòng cuối nhận phần dư để `ΣB_i = B` (tránh lệch làm tròn). Quà tặng không nhận.
- **Tiền hàng thuần dòng i**: `N_i = L_i − B_i`. Đơn: `ΣN_i = S − B = afterBillDiscount`.
- **Đơn giá thuần/đơn vị** dòng trả: `N_i / quantity_i` (làm tròn, dòng trả cuối cùng của dòng nhận phần dư).

| Chỉ số | Công thức | Ghi chú |
|---|---|---|
| `grossRevenue` | Σ giá gốc × SL (không quà) | giữ như `rawSubtotal` |
| `itemDiscountTotal` | Σ `discountAmount` dòng | |
| `billDiscountTotal` | Σ `B` | |
| `orderRevenue` (tiền hàng bán) | Σ đơn trong kỳ (`createdAt`, status ≠ DRAFT) của `S − B` | **Không gồm phí thẻ** (D1) |
| `returnGoodsTotal` | Σ phiếu trong kỳ (`createdAt` phiếu) của Σ `N_i` dòng trả | Đã phân bổ giảm bill |
| `exchangeGoodsTotal` | Σ phiếu trong kỳ của Σ `lineTotal` hàng đổi | Giá bán hiện hành, không giảm bill |
| `netRevenue` (**doanh thu thuần**) | `orderRevenue − returnGoodsTotal + exchangeGoodsTotal` | D1+D2 |
| `cardFeeCollected` | Σ `F` đơn trong kỳ | hiển thị riêng |
| `cardFeeRefunded` | Σ `refundedCardFee` phiếu trong kỳ | |
| `cardFeeNet` | `cardFeeCollected − cardFeeRefunded` | thu hộ/chi phí, KHÔNG vào `netRevenue` |
| `cogs` (giá vốn) | Σ `qty × unitCost` dòng bán − Σ `qty × unitCost` dòng trả đã nhập kho (`condition=GOOD`) + Σ `qty × unitCost` hàng đổi | `unitCost` lưu trên dòng đơn lúc bán; dòng trả dùng `unitCost` của dòng đơn gốc; hàng đổi dùng `costPrice` tại thời điểm làm phiếu và lưu lại trên dòng đổi |
| `grossProfit` | `netRevenue − cogs` | |
| `grossMarginPercent` | `grossProfit / netRevenue × 100` (0 nếu `netRevenue ≤ 0`), làm tròn 1 số lẻ | |
| `debtCollectedInPeriod` | Σ `debtPayments[].amount` có `paidAt` trong kỳ (mọi đơn, kể cả đơn kỳ trước) | |
| `cashAtPurchase` | Σ đơn trong kỳ của `paidAmount lúc mua` = `totalAmount − initialDebtAmount` (gồm phí thẻ vì là tiền đã nhận) | không đổi sau này |
| `cashRefunded` | Σ phiếu trong kỳ của `cashRefund` thực tế (mục 5), không gồm phần đã giảm nợ | |
| `cashCollected` (**thực thu**) | `cashAtPurchase + debtCollectedInPeriod − cashRefunded` | D3. Có thể < 0 trong ngày chỉ có hoàn tiền; không `max(0,…)` |
| `debtReducedByReturnInPeriod` | Σ phiếu trong kỳ của `debtReduction` | không phải tiền, hiển thị riêng |
| `outstandingDebt` (cuối kỳ, theo đơn tạo trong kỳ) | Σ `debtAmount` hiện tại | |
| `returnFromPriorPeriods` (ghi chú) | phần `returnGoodsTotal` của phiếu thuộc đơn có `createdAt` < đầu kỳ | chỉ để hiển thị, đã nằm trong `netRevenue` (D2) |

Đồng nhất thức kiểm chứng (khi đóng một kỳ, đơn & phiếu & thu nợ cùng kỳ):
`cashCollected = netRevenue + cardFeeNet − outstandingDebt` (và, nếu không có hàng đổi trả phát sinh phụ thu, chính xác tuyệt đối). Nếu có thu nợ đơn kỳ trước: cộng `debtCollectedInPeriod` đó vào vế phải; nếu có trả hàng đơn kỳ trước: trừ phần hoàn tương ứng. Backend nên unit-test đúng đồng nhất thức trong trường hợp một kỳ khép kín.

Lọc theo danh mục (`categoryId`): `orderRevenue/returnGoodsTotal/exchangeGoodsTotal/cogs` tính theo dòng thuộc danh mục dùng `N_i`; `cardFee*` = 0 (không phân bổ); `cashCollected` không áp dụng theo danh mục (trả `null`).

## 3. Ví dụ số (một đơn đủ các yếu tố)

**Đơn D01** (thanh toán thẻ, phí 1,8%, nợ 300.000đ — *giả định hợp lệ, cần backend xác nhận code cho phép CARD + nợ, xem Câu hỏi mở Q1*):

| Dòng | Giá gốc | Giảm SP | unitPrice | SL | lineTotal | Giá vốn lưu `unitCost` |
|---|---|---|---|---|---|---|
| A | 500.000 | 10% | 450.000 | 2 | 900.000 | 250.000 |
| B | 300.000 | – | 300.000 | 1 | 300.000 | 150.000 |

- `S = 1.200.000`; giảm bill `B = 100.000`; `afterBill = 1.100.000`; `F = round(1.100.000×1,8%) = 19.800`; `totalAmount = 1.119.800`.
- Nợ: `debtAmount = initialDebtAmount = 300.000` → khách trả lúc mua `819.800` (gồm phí thẻ).
- Phân bổ bill: `B_A = 75.000`, `B_B = 25.000` → `N_A = 825.000` (412.500/cái), `N_B = 275.000`.
- Cùng ngày khách trả nợ `100.000` → `debtAmount = 200.000`.
- **Phiếu đổi trả R01 (cùng kỳ):** trả 1 cái A (GOOD), đổi lấy sản phẩm C giá 200.000 (`costPrice` lúc đó 120.000).
  - `returnGoods = 412.500` (code cũ: 450.000 — sai H4).
  - `refundedCardFee = round(412.500/1.100.000 × 19.800) = 7.425` (cũ: 450.000/1.200.000×19.800 = 7.425, trùng).
  - `returnTotal = 419.925`; `exchangeTotal = 200.000`; `netDifference = 200.000 − 419.925 = −219.925` → shop nợ khách 219.925.
  - D4: giảm nợ trước: `debtReduction = min(200.000; 219.925) = 200.000` → `debtAmount = 0`, `debtStatus = SETTLED`; `cashRefund = 19.925`.

**Kết quả dashboard (kỳ = ngày đó, chỉ có D01 và R01):**

| Chỉ số | Giá trị | Cách tính |
|---|---|---|
| grossRevenue | 1.300.000 | 1.000.000 + 300.000 |
| itemDiscountTotal / billDiscountTotal | 100.000 / 100.000 | |
| orderRevenue | 1.100.000 | 1.200.000 − 100.000 (không gồm phí thẻ) |
| returnGoodsTotal | 412.500 | |
| exchangeGoodsTotal | 200.000 | |
| **netRevenue** | **887.500** | 1.100.000 − 412.500 + 200.000 |
| cardFeeCollected / Refunded / Net | 19.800 / 7.425 / 12.375 | hiển thị riêng |
| cogs | 520.000 | (2×250.000 + 150.000) − 250.000 + 120.000 |
| grossProfit | 367.500 | 887.500 − 520.000 |
| grossMarginPercent | 41,4% | 367.500/887.500 |
| cashAtPurchase | 819.800 | |
| debtCollectedInPeriod | 100.000 | |
| cashRefunded | 19.925 | |
| **cashCollected** | **899.875** | 819.800 + 100.000 − 19.925 |
| debtReducedByReturnInPeriod | 200.000 | |
| outstandingDebt | 0 | |
| Kiểm: netRevenue + cardFeeNet − outstandingDebt | 887.500 + 12.375 − 0 = 899.875 ✓ | = cashCollected |

Ví dụ phụ (hoàn vượt nợ/không nợ): đơn không nợ, trả như trên không đổi hàng → `netDifference = −419.925`, `debtReduction = 0`, `cashRefund = 419.925`.
Ví dụ phụ (nợ lớn hơn phần hoàn): nếu nợ còn 500.000, `netDifference = −219.925` → `debtReduction = 219.925`, `debtAmount = 280.075`, `debtStatus = PARTIAL`, `cashRefund = 0`.

## 4. User story

- US-01: Là chủ cửa hàng, tôi muốn xem **doanh thu thuần không gồm phí quẹt thẻ** để lợi nhuận phản ánh đúng tiền hàng.
- US-02: Là chủ cửa hàng, tôi muốn phí thẻ (thu/hoàn/ròng) hiển thị riêng để biết chi phí thu hộ.
- US-03: Là kế toán, tôi muốn "Thực thu" = tiền mua + thu nợ − hoàn thực tế để đối chiếu quỹ/ngân hàng.
- US-04: Là chủ cửa hàng, tôi muốn hoàn trả ghi vào ngày làm phiếu và có ghi chú phần hoàn từ đơn kỳ trước để số kỳ đã chốt không đổi.
- US-05: Là nhân viên bán hàng, khi khách còn nợ mà trả hàng, tôi muốn hệ thống tự giảm nợ trước, chỉ hoàn tiền phần vượt, để không hoàn tiền cho khoản khách chưa trả.
- US-06: Là chủ cửa hàng, tôi muốn giá vốn là giá lúc bán để lãi gộp không đổi khi nhập hàng đổi giá.
- US-07: Là chủ cửa hàng, tôi muốn trả hàng đơn có giảm giá bill chỉ hoàn đúng số khách thực trả cho món đó.

## 5. Đặc tả sửa POST `/returns` & `/returns/calculate` với đơn công nợ

**Quy tắc nghiệp vụ**
- BR-01: `returnSubtotal` = Σ `N_i` dòng trả (phân bổ giảm bill, mục 2). Hàng đổi giữ nguyên `lineTotal`.
- BR-02: `refundedCardFee`, `returnTotal`, `netDifference`, `refundAmount`, `additionalCharge` giữ định nghĩa hiện tại (giữ tương thích FE) nhưng `returnTotal` dùng `returnSubtotal` mới.
- BR-03: Chỉ khi `netDifference < 0` (shop phải trả khách) và đơn có `debtAmount > 0`: `debtReduction = min(debtAmount, refundAmount)`; `cashRefund = refundAmount − debtReduction`.
- BR-04: Đơn không nợ (`debtAmount = 0`): `debtReduction = 0`, `cashRefund = refundAmount`.
- BR-05: Khi `debtReduction > 0`: `debtAmount −= debtReduction`; `debtStatus = 'SETTLED'` nếu về 0, ngược lại `'PARTIAL'` (hoặc `'UNPAID'` nếu chưa từng thu và vẫn còn nợ — giữ `UNPAID` khi `debtPayments` rỗng và chưa giảm hết; đơn giản hóa: còn nợ & đã có thu hoặc giảm → `PARTIAL`). Không đụng `initialDebtAmount`.
- BR-06: Ghi lịch sử: thêm `debtAdjustments[]` vào Order: `{ _id, type:'RETURN', returnCode, amount: debtReduction, debtBefore, debtAfter, at, by, byName }`. Không ghi vào `debtPayments` (không phải tiền thu).
- BR-07: Lưu trên ReturnExchange: `debtReduction`, `cashRefund`, `debtBefore`, `debtAfter`. `refundAmount` giữ nguyên là tổng nghĩa vụ trả khách (= `debtReduction + cashRefund`).
- BR-08: `netDifference > 0` (khách phải trả thêm) ở đơn nợ: khách thanh toán phụ thu ngay (mặc định, không cộng vào nợ). Cần xác nhận (Q2).
- BR-09: Cập nhật nợ và tạo phiếu phải nguyên tử (cùng transaction hoặc rollback nếu lỗi), tránh phiếu có mà nợ chưa giảm.
- BR-10: `paidAmount` của đơn nợ sau trả hàng: định nghĩa lại = tiền khách đã thực trả giữ lại = `totalAmount − debtAmount − Σ(cashRefund) − Σ(debtReduction)`… tức không được dùng `totalAmount − debtAmount` nữa. Khuyến nghị backend: ngừng dùng `paidAmount` để suy ra tiền; báo cáo tính từ `initialDebtAmount`, `debtPayments`, `cashRefund` (mục 2). Route thu nợ (`ordersCustomers.ts` L1068) không được ghi đè `paidAmount` sai.
- BR-11: Báo cáo công nợ: `totalCollectedDebt` = Σ `debtPayments.amount` (không phải `initial − debt`); thêm `totalReducedByReturn` = Σ `debtAdjustments.amount`. Kiểm: `initialDebt = collected + reducedByReturn + outstanding`.
- BR-12: `/returns/calculate` trả thêm `debtReduction`, `cashRefund`, `debtAfter`, `debtStatusAfter` để FE hiển thị trước khi xác nhận.
- BR-13: `refundMethod` chỉ áp dụng cho phần `cashRefund`; nếu `cashRefund = 0` thì `refundMethod` bỏ qua (lưu `CASH`).

## 6. Tiêu chí nghiệm thu (Given/When/Then)

- AC-01: Given kỳ có đơn thẻ, When xem dashboard, Then `netRevenue = Σ(S−B) − returnGoods + exchangeGoods` và **không** chứa `cardFee`; `cardFeeCollected/Refunded/Net` hiển thị riêng.
- AC-02: Với dữ liệu mẫu mục 3, các giá trị khớp bảng (887.500; 520.000; 367.500; 899.875; 12.375) — chênh tối đa 0 đ.
- AC-03: Tổng `byCategory[].netRevenue` (không lọc) = `netRevenue` (chênh ≤ số dòng × 1đ do làm tròn; mục tiêu 0 nhờ dòng cuối nhận phần dư).
- AC-04: Σ `dailyTrend[].netRevenue` = `netRevenue`; tương tự `cogs`, `grossProfit`, `cashCollected`; Σ `hourlyTrend` = tổng kỳ.
- AC-05: Đồng nhất thức `cashCollected = netRevenue + cardFeeNet − outstandingDebt (+ điều chỉnh kỳ trước)` đúng cho kỳ khép kín (mục 2).
- AC-06: Given đơn A (nợ 200.000), When trả hàng có `refundAmount=219.925`, Then `debtAmount=0`, `debtStatus=SETTLED`, `cashRefund=19.925`, có 1 bản ghi `debtAdjustments`, `cashCollected` chỉ giảm 19.925.
- AC-07: Given nợ 500.000, refund 219.925, Then `debtAmount=280.075`, `PARTIAL`, `cashRefund=0`, `cashCollected` không đổi.
- AC-08: Given đơn không nợ, Then hành vi như cũ (`cashRefund=refundAmount`, không `debtAdjustments`).
- AC-09: Given đơn giảm bill 100.000/1.200.000, trả 1 cái A 450.000, Then `returnSubtotal=412.500` (không phải 450.000).
- AC-10: Given trả toàn bộ các dòng của đơn, Then Σ `returnSubtotal` các phiếu = `S − B` của đơn (chênh 0) và Σ `refundedCardFee` = `F`.
- AC-11: Given đổi giá vốn sản phẩm từ 250.000 lên 300.000 sau khi bán, When xem báo cáo kỳ cũ, Then `cogs` không đổi.
- AC-12: Given phiếu làm ngày N+1 cho đơn ngày N, Then kỳ N không đổi; kỳ N+1 có `returnGoodsTotal` tăng và `returnFromPriorPeriods` hiển thị đúng phần đó.
- AC-13: Thu nợ ngày N+3 cho đơn ngày N: kỳ N+3 `debtCollectedInPeriod` và `cashCollected` tăng; kỳ N không đổi `cashCollected`.
- AC-14: Báo cáo công nợ: `initialDebt = collected + reducedByReturn + outstanding` cho từng đơn.
- AC-15: Hai lần POST `/returns` song song cho cùng dòng không được trả vượt SL/giảm nợ âm (`debtAmount ≥ 0`).
- AC-16: Phiếu lỗi giữa chừng → nợ và tồn kho không thay đổi (rollback) hoặc có cơ chế bù khai báo rõ.

## 7. Trường hợp biên

1. Trả 1 phần nhiều lần: dòng cuối cùng của mỗi dòng đơn nhận phần dư làm tròn của `N_i` và `refundedCardFee`.
2. Giảm bill AMOUNT lớn khiến `N_i` rất nhỏ/0: cho phép hoàn 0đ, vẫn nhập kho.
3. Quà tặng (`isGift`, `L=0`): trả quà → hoàn 0đ; giá vốn vẫn đảo nếu GOOD.
4. Hàng trả `condition ≠ GOOD`: không nhập kho, giá vốn **không** đảo (giữ hành vi hiện tại, hàng hỏng là chi phí).
5. Đơn thẻ không nợ vs đơn thẻ có nợ: phí thẻ tính trên toàn `afterBill` kể cả phần nợ (hành vi hiện tại) — cần chủ xác nhận (Q1).
6. `netDifference = 0` (đổi ngang giá): không đụng nợ/tiền.
7. Ngày làm phiếu khác ngày bán (D2): phiếu thuộc kỳ làm phiếu; đơn đã `FULLY_RETURNED` vẫn tính doanh thu gốc kỳ cũ.
8. Múi giờ: ranh giới kỳ theo giờ địa phương (đã có `parseLocalDateBound`); thu nợ 23:59 và 00:01 rơi hai ngày khác nhau.
9. Đơn cũ không có `unitCost` / `initialDebtAmount` / `debtAdjustments`: fallback `costPrice` hiện tại và đánh dấu `cogsEstimated=true` (Q3); `debtAdjustments` mặc định `[]`.
10. `cashCollected` âm trong ngày (chỉ hoàn): hiển thị số âm, không cắt về 0.
11. Phiếu của đơn đã bị xóa/không tìm thấy: vẫn tính theo dữ liệu phiếu.
12. Thu nợ vượt `debtAmount` đã bị chặn (cần giữ); sau khi trả hàng giảm nợ về 0 thì thu nợ phải báo lỗi "không còn nợ".
13. Lọc theo danh mục + phí thẻ: phí thẻ không phân bổ theo danh mục (hiển thị "—").
14. Xóa đơn (DELETE) đã có debtAdjustments/phiếu trả: chặn xóa.

## 8. Tác động theo phần

- server: `Order` (`items[].unitCost`, `debtAdjustments[]`), `ReturnExchange` (`returnItems[].unitCost`, `exchangeItems[].unitCost`, `debtReduction`, `cashRefund`, `debtBefore`, `debtAfter`), `returns.ts`, `reports.ts`, `ordersCustomers.ts` (lưu `unitCost` khi tạo/sửa đơn; không ghi đè `paidAmount` sai), migration/backfill, `docs/api-contract.md`.
- cms: `RevenueDashboardModule.tsx`, `exports.ts` (hiển thị phí thẻ riêng, thực thu, ghi chú hoàn kỳ trước, cảnh báo giá vốn ước tính), màn trả hàng (hiển thị giảm nợ vs hoàn tiền), `DebtManagementModule.tsx` (lịch sử giảm nợ do trả hàng), `buildClientFallbackDashboard()` phải dùng cùng công thức.
- web (POS `PosTab.tsx`): hiển thị kết quả `/returns/calculate` mới.

## 9. Điểm mâu thuẫn / cần PM hỏi chủ

- **M1 (D1 vs code):** hiện `netRevenue` gồm phí thẻ ở cả `orderRevenue` lẫn `netDifference` — phải sửa; không mâu thuẫn quyết định, chỉ cần báo thay đổi số lịch sử (doanh thu thuần các kỳ cũ sẽ **giảm** bằng phí thẻ net).
- **M2 (D3 vs D1):** "Thực thu" theo D3 **gồm phí thẻ** (vì là tiền khách đã trả), trong khi doanh thu thuần không gồm. Hai số sẽ lệch nhau đúng `cardFeeNet`. Xác nhận chủ chấp nhận (đã thể hiện qua đồng nhất thức).
- **M3 (D4 vs doanh thu thuần/D3):** giảm nợ không phải tiền thực chi nên không vào `cashRefunded`; doanh thu thuần vẫn giảm đủ phần hàng trả. Nhất quán, nhưng chủ cần hiểu "doanh thu giảm nhưng thực thu không giảm".
- **M4 (D2):** doanh thu thuần một kỳ có thể âm hoặc nhỏ nếu trả nhiều hàng kỳ trước — đã chấp nhận, cần ghi chú hiển thị.
- **Q1:** Đơn CARD kèm nợ: phí thẻ tính trên cả phần nợ — giữ hay chỉ tính trên phần trả ngay? (Đề xuất: giữ hiện trạng cho tới khi chủ quyết; ghi biên 5.) Backend xác nhận code có cho CARD + nợ không.
- **Q2:** Đổi hàng đơn nợ mà khách phải trả thêm: thu ngay (đề xuất) hay cộng vào nợ?
- **Q3:** Đơn cũ chưa có giá vốn lưu: dùng `costPrice` hiện tại (đánh dấu ước tính, đề xuất) hay bỏ khỏi giá vốn?
- **Giả định (cần xác nhận):** DRAFT không tính; hàng đổi dùng giá bán hiện hành, không chịu giảm bill; `cashCollected` không lọc theo danh mục.

## 10. Phiếu bàn giao → backend-dev

Việc cần làm (theo thứ tự; cập nhật `docs/api-contract.md` TRƯỚC khi code):
1. Hợp đồng API: thêm vào `/reports/revenue-dashboard` summary: `returnGoodsTotal, exchangeGoodsTotal, cardFeeCollected, cardFeeRefunded, cardFeeNet, cashAtPurchase, cashRefunded, cashCollected, debtReducedByReturnInPeriod, returnFromPriorPeriods, cogsEstimated`; `orderRevenue/netRevenue` đổi nghĩa (không gồm phí thẻ). Thêm `debtReduction, cashRefund, debtAfter, debtStatusAfter` vào `/returns` & `/returns/calculate`.
2. Model: `IOrderItem.unitCost`, `Order.debtAdjustments[]`, ReturnExchange item `unitCost` + `debtReduction/cashRefund/debtBefore/debtAfter`. Lưu `unitCost` khi tạo/sửa đơn (`ordersCustomers.ts`) và hàng đổi (`returns.ts`). Backfill đơn cũ bằng `costPrice` hiện tại + cờ ước tính (cần PM duyệt chạy migration).
3. `returns.ts`: phân bổ giảm bill vào `lineTotal` dòng trả (BR-01, dòng cuối nhận phần dư), logic D4 (BR-03…BR-13), nguyên tử.
4. `reports.ts`: công thức mục 2; bỏ `totalAmount` khỏi doanh thu; COGS dùng `unitCost`; `cashCollected` mới; `totalCollectedDebt` = Σ debtPayments; đồng bộ nhánh lọc danh mục, dailyTrend, hourlyTrend, byCategory, byPaymentMethod (paymentStats.revenue cũng bỏ phí thẻ).
5. Unit test: dữ liệu mục 3 (AC-02), AC-03…AC-16.

Câu hỏi còn mở: Q1–Q3; M1–M4 cần PM thông báo chủ. Giả định: ghi ở mục 9.
