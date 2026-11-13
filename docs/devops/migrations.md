# Migration DB — 11 Sport

Bộ migration tự viết (không thêm thư viện), nằm ở `server/src/migrations/`. Mỗi file là một bước thay đổi dữ liệu/cấu trúc DB, được ghi lại trong collection `_migrations` để **không bao giờ chạy lặp**.

## Lệnh

| Lệnh | Ý nghĩa |
|---|---|
| `npm run migrate -- status` | Xem migration nào đã chạy / đang chờ |
| `npm run migrate -- up --dry-run` | **Xem trước**, không ghi gì vào DB |
| `npm run migrate -- up` | Chạy tất cả migration đang chờ |
| `npm run migrate -- up --to <tên>` | Chạy tới migration chỉ định |
| `npm run migrate -- down [--steps N]` | Hoàn tác N migration gần nhất (mặc định 1) |
| `npm run migrate -- create "mo ta"` | Tạo file migration mới từ mẫu |
| `npm run migrate -- unlock` | Gỡ khóa khi tiến trình trước bị chết giữa chừng |

Trên server đã build (prod): thay `npm run migrate` bằng `npm run migrate:prod` (chạy `dist/migrations/cli.js`).

## Cơ chế an toàn
- DB **không phải local** (Atlas, staging, prod) ⇒ `up/down/unlock` bắt buộc thêm `--yes`.
- Khóa `_migration_lock` chống 2 tiến trình chạy cùng lúc (tự hết hạn sau 30 phút).
- Không fallback in-memory: không kết nối được DB thật thì dừng với lỗi.
- Migration dùng driver MongoDB gốc, **không dùng Mongoose model**, nên không phụ thuộc schema hiện tại.
- Document bị sửa được đánh dấu `__migratedBy.<tên migration>` để `down` hoàn tác chính xác.

## Quy trình deploy (bắt buộc)
1. Snapshot/backup DB trên Atlas.
2. `npm run build`
3. `npm run migrate:prod -- up --dry-run` → đọc log, kiểm tra các cảnh báo ⚠.
4. `npm run migrate:prod -- up --yes`
5. `npm start` (hoặc gộp 4+5: `npm run start:migrate`).
6. Deploy ngoài giờ bán hàng.

> **Production (Render):** `render.yaml` dùng `startCommand: npm run start:migrate` ⇒ mỗi lần deploy tự chạy `migrate up --yes` rồi mới `npm start`. Vẫn phải snapshot Atlas trước khi merge PR có migration.

## Quy tắc viết migration
- **Mỗi PR có thay đổi schema/logic dữ liệu phải kèm migration.** Thêm trường mới ⇒ backfill dữ liệu cũ.
- Đặt tên theo `npm run migrate -- create`, không sửa tên/nội dung migration **đã chạy trên prod**; cần sửa thì tạo migration mới.
- Mọi thao tác ghi bọc trong `ctx.write(mô tả, fn)` để `--dry-run` hoạt động.
- Idempotent: chỉ lọc document chưa được xử lý (vd `{ field: { $exists: false } }`).
- Luôn viết `down`; nếu không thể hoàn tác an toàn thì `throw` lỗi rõ ràng.
- Không xóa dữ liệu/collection/index trong `up` khi chưa được PM duyệt.

## Migration hiện có
| Tên | Nội dung |
|---|---|
| `20261113000001-ensure-indexes` | Tạo index còn thiếu của tất cả model (không xóa index) |
| `20261113000002-backfill-order-debt-fields` | Bổ sung `debtAmount/initialDebtAmount/debtStatus/debtPayments/debtAdjustments` cho đơn cũ (suy từ `splitPayments` DEBT hoặc `paymentMethodDetail`) |
| `20261113000003-backfill-return-debt-reduction` | Cấn trừ công nợ cho phiếu trả tạo bằng code cũ (lỗi HD-0181/TH-0010). Không sửa `refundAmount`; phiếu còn `cashRefund > 0` được cảnh báo để đối soát |
