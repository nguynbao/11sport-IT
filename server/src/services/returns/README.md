# Return & Exchange Service Modules

Folder chứa logic tính toán và xử lý nghiệp vụ đổi / trả hàng:

- `return.rules.ts` : Quy tắc phân quyền tập trung (`RETURN_ALLOWED_ROLES` cho phép trả hàng hoàn tiền với `CEO`/`ADMIN`/`ACCOUNTANT`, `EXCHANGE_DOWNGRADE_OVERRIDE_ROLES` cho phép đổi sang sản phẩm giá niêm yết thấp hơn với `CEO`/`ADMIN`).
- `returnCalc.service.ts` : Validation, phân tích item hoàn, tính toán đổi hàng (mặc định chỉ cho phép đổi sản phẩm có giá niêm yết ≥ sản phẩm cũ, trừ `CEO`/`ADMIN`; trả hàng hoàn đủ theo số tiền thực tế đã trả trên bill), và bù trừ công nợ.
- `return.service.ts` : Orchestrate transaction tạo phiếu đổi / trả hàng, hoàn kho (hàng tốt trả về kho Tầng 1), cập nhật công nợ, quỹ tiền, và cập nhật trạng thái đơn gốc.
- `returnQuery.service.ts` : Query danh sách, chi tiết phiếu đổi / trả hàng.
- `index.ts` : Re-export các API công khai.
