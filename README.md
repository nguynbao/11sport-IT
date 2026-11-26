# 11Sport — Hệ thống Bán hàng (POS), Kho vận & Quản trị

11Sport là hệ thống quản lý vận hành cho cửa hàng thể thao 11Sport: bán hàng tại quầy, quản lý kho, kiểm hàng bằng OCR, chấm công nhân sự và quản trị/báo cáo tập trung.

Hệ thống gồm 3 ứng dụng dùng chung một cơ sở dữ liệu MongoDB:

| Thành phần | Thư mục | Vai trò | Port |
| --- | --- | --- | --- |
| Backend API | [`server/`](server/README.md) | REST API `/api/v1`, nghiệp vụ & dữ liệu | 4000 |
| POS & Kho vận | [`web/`](web/README.md) | Ứng dụng cho nhân viên tại quầy | 3000 |
| Quản trị CMS | [`cms/`](cms/README.md) | Trang quản trị cho quản lý/chủ cửa hàng | 3001 |

## Tính năng chính

- **Bán hàng tại quầy (POS):** tạo đơn, quản lý khách hàng, khuyến mãi, dịch vụ đi kèm, trả/đổi hàng, giao ca, xuất hóa đơn PDF (K80/A4), in tem mã vạch.
- **Kho vận:** nhập hàng, tồn kho, sổ biến động kho, quét mã vạch; kiểm hàng/đọc tem tag bằng camera, ảnh, PDF (Gemini Vision, fallback `tesseract.js`).
- **Nhân sự & chấm công:** chấm công theo IP Wi-Fi/DDNS từng cơ sở, đăng ký ca, bảng công, nghỉ phép, ngày lễ.
- **Quản trị:** dashboard doanh thu, báo cáo & xuất Excel, quản lý danh mục/sản phẩm/tồn kho/đơn hàng/công nợ/khuyến mãi/dịch vụ/nhân viên.
- **Tiện ích:** máy tính quy đổi tỷ giá & chuyển tiền nhanh (Wise).

## Công nghệ

Node.js, Express, TypeScript, Mongoose (MongoDB 7), Next.js 14, React 18, Tailwind CSS.

## Chạy nhanh

Yêu cầu: Node.js v20+, npm, MongoDB 7+ hoặc Docker (dev có thể fallback `mongodb-memory-server`).

```bash
./start-dev.sh            # macOS/Linux  (Windows: .\start-dev.ps1)
# hoặc
docker compose up -d
```

- API: http://localhost:4000/api/v1 (health: `/api/v1/health`)
- Web POS: http://localhost:3000
- CMS: http://localhost:3001

Chi tiết cài đặt, biến môi trường và lệnh xem trong README của từng thành phần.

> Không commit `.env` hoặc thông tin bí mật lên Git.
