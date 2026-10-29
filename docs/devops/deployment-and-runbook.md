# Tài liệu Triển khai & Vận hành (Deployment & Runbook) - 11Sport v1.0

> **Phụ trách**: DevOps Engineer (`devops`)
> **Phạm vi**: Hạ tầng `server` (API), `web` (POS & Kho), `cms` (Quản trị), và `mongodb` (Cơ sở dữ liệu).

---

## 1. Kiến trúc Triển khai & Danh sách Cổng (Ports)

```
                   ┌─────────────────────────────────────────┐
                   │        Reverse Proxy / Nginx (TLS)      │
                   └──────┬───────────────────┬──────────────┘
                          │                   │
            ┌─────────────▼──────────┐ ┌──────▼─────────────────┐
            │   web (POS & Kho)      │ │   cms (Quản trị Admin) │
            │   Next.js - Port 3000  │ │   Next.js - Port 3001  │
            └─────────────┬──────────┘ └──────┬─────────────────┘
                          │                   │
                          └─────────┬─────────┘
                                    │ REST API (/api/v1)
                          ┌─────────▼─────────┐
                          │   server (API)    │
                          │ Express - Port 4000│
                          └─────────┬─────────┘
                                    │ Mongoose (TCP 27017)
                          ┌─────────▼─────────┐
                          │    MongoDB 7.0    │
                          │   Volume bền vững │
                          └───────────────────┘
```

| Dịch vụ | Thư mục | Công nghệ | Port mặc định | URL Local / Dev | URL Production (Vercel) |
| --- | --- | --- | --- | --- | --- |
| **Backend API (`server`)** | `server/` | Node.js 20 + Express + TypeScript | `4000` | `http://localhost:4000/api/v1` | - |
| **POS & Kho (`web`)** | `web/` | Next.js + React + TailwindCSS | `3000` | `http://localhost:3000` | `https://11sport-it.vercel.app` |
| **Quản trị (`cms`)** | `cms/` | Next.js + React + TailwindCSS | `3001` | `http://localhost:3001` | `https://11sport-it-m1ei.vercel.app` |
| **Database (`mongodb`)** | Docker / Service | MongoDB 7.0+ | `27017` | `mongodb://localhost:27017/11sport` | - |

---

## 2. Cấu hình Biến môi trường (Environment Variables)

> **Quy tắc bảo mật**: Tuyệt đối không commit file `.env` thật lên Git. Sử dụng Secret Manager hoặc biến môi trường trên CI/CD cho Staging/Production.

### 2.1 `server/.env.example`
```env
NODE_ENV=development
PORT=4000
MONGODB_URI=mongodb://localhost:27017/11sport
JWT_SECRET=<sinh-chuoi-ngau-nhien-toi-thieu-32-ky-tu>
JWT_EXPIRES_IN=12h
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

### 2.2 `web/.env.example` (POS & Kho - Port 3000)
```env
NODE_ENV=development
PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_APP_NAME=11Sport POS & Kho
```

### 2.3 `cms/.env.example` (Quản trị - Port 3001)
```env
NODE_ENV=development
PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_APP_NAME=11Sport CMS
```

---

## 3. Hướng dẫn Khởi chạy Hệ thống

### Cách 1: Chạy trực tiếp trên Windows (PowerShell Script)
Sử dụng script `start-dev.ps1` ở thư mục gốc (đã tự động nạp `$env:PATH = "C:\Program Files\nodejs;$env:PATH"`):
```powershell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
.\start-dev.ps1
```

### Cách 2: Chạy bằng Docker Compose
```powershell
# Khởi tạo toàn bộ cụm MongoDB 7 + Server + Web + CMS
docker compose up -d

# Xem trạng thái và healthcheck
docker compose ps

# Theo dõi log tập trung
docker compose logs -f server web cms
```

---

## 4. Kiểm tra Sức khỏe Hệ thống (Healthcheck & Giám sát)

### 4.1 Điểm kiểm tra (Endpoints)
- **Server API Health & Categories**:
  ```powershell
  Invoke-RestMethod -Uri "http://localhost:4000/api/v1/categories" -Method GET
  ```
- **Web (POS & Kho)**: `http://localhost:3000` (HTTP Status `200 OK`)
- **CMS (Quản trị)**: `http://localhost:3001` (HTTP Status `200 OK`)
- **MongoDB**:
  ```powershell
  docker exec 11sport-mongodb mongosh --quiet --eval "db.adminCommand('ping')"
  ```

### 4.2 Cảnh báo & Giám sát khuyến nghị (Production/Staging)
1. **Lỗi 5xx trên `server`**: Cảnh báo ngay khi tỷ lệ HTTP 5xx > 1% trong 5 phút (đặc biệt trên `/api/v1/orders`, `/api/v1/returns`, `/api/v1/imports/:id/complete`).
2. **Độ trễ API**: Cảnh báo khi p95 latency > 1000ms.
3. **Dung lượng ổ đĩa MongoDB**: Cảnh báo khi phân vùng chứa volume `mongodb_data` vượt 80%.
4. **Tính toàn vẹn Sổ kho (`StockMovement`)**: Định kỳ đối soát tồn kho sản phẩm (`Product.stock`) với tổng biến động trong `StockMovement`.

---

## 5. Sao lưu & Khôi phục Cơ sở dữ liệu (MongoDB Backup & Restore)

Dữ liệu đơn hàng (`Order`), phiếu nhập (`ImportReceipt`), trả/đổi (`ReturnReceipt`) và sổ kho (`StockMovement`) là dữ liệu kế toán quan trọng, bắt buộc sao lưu hằng ngày.

### 5.1 Sao lưu (Backup)
```powershell
# Tạo thư mục lưu bản sao lưu theo ngày
$DateStr = Get-Date -Format "yyyyMMdd_HHmmss"
New-Item -ItemType Directory -Force -Path ".\backups" | Out-Null

# Chạy mongodump từ container MongoDB ra file nén .archive.gz
docker exec 11sport-mongodb sh -c "mongodump --db=11sport --archive --gzip" > ".\backups\11sport_$DateStr.archive.gz"
```

### 5.2 Khôi phục (Restore)
> **Cảnh báo an toàn**: Chỉ thực hiện restore trên Production khi có xác nhận của PM.
```powershell
# Khôi phục từ bản backup cụ thể
Get-Content ".\backups\11sport_<timestamp>.archive.gz" -AsByteStream | docker exec -i 11sport-mongodb sh -c "mongorestore --gzip --archive --drop"
```

---

## 6. Quy trình Triển khai & Rollback Khẩn cấp

### 6.1 Quy trình Triển khai (CI/CD & Release)
1. **Kiểm tra trước triển khai (Pre-flight)**:
   - Chạy kiểm tra kiểu và build thử trên cả 3 dịch vụ:
     ```powershell
     $env:PATH = "C:\Program Files\nodejs;$env:PATH"
     cd server; npm run build
     cd ../web; npm run build
     cd ../cms; npm run build
     ```
2. **Sao lưu DB trước khi lên bản mới**: Chạy lệnh `mongodump` tại mục 5.1.
3. **Rolling Update**: Cập nhật `server` trước, kiểm tra healthcheck `/api/v1/categories`, sau đó cập nhật `web` và `cms`.

### 6.2 Quy trình Rollback khi gặp sự cố
1. **Rollback ứng dụng (`server`, `web`, `cms`)**:
   - Đưa Git về tag/commit ổn định liền trước:
     ```powershell
     git checkout <previous-stable-tag>
     docker compose up -d --build
     ```
2. **Rollback dữ liệu (nếu có lỗi migration)**:
   - Khôi phục bản sao lưu `.archive.gz` gần nhất ngay trước thời điểm deploy theo hướng dẫn mục 5.2.
3. **Kiểm tra sau Rollback**:
   - Xác nhận API trả lời `200 OK`, kiểm tra thử tra cứu khách hàng và xem báo cáo tồn kho trên CMS.
