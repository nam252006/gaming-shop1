# Gaming Shop — Product Variants Edition

Bản này mở rộng shop để mỗi sản phẩm có thể có nhiều **dòng / gói / thời hạn**.

Ví dụ:
- Delta Android Key 1 Tháng — 149.000đ
- Delta iOS Key 1 Tháng — 149.000đ
- Delta Key 3 Tháng — 299.000đ
- Delta Key 1 Năm — 799.000đ

## Cách quản lý

Vào `/admin` → `Sản phẩm` → `Sửa` hoặc `Thêm sản phẩm`.

Trong phần **Các dòng / gói sản phẩm**, bạn có thể thêm bao nhiêu dòng cần thiết. Mỗi dòng có:
- Tên dòng / gói
- Giá
- Giá cũ
- Giao hàng
- Badge
- Tồn kho (để trống = không giới hạn)
- Ảnh riêng cho dòng đó

Khách hàng sẽ thấy các dòng dưới dạng lựa chọn radio trên trang chi tiết sản phẩm. Khi thêm vào giỏ, hệ thống lưu cả `productId` và `variantId`, nên các gói khác nhau có thể có giá và tồn kho khác nhau.

## Deploy

Repository root giữ nguyên cấu trúc phẳng như bản trước:

`package.json`, `server.js`, `index.html`, `app.js`, `styles.css`, `admin.html`, `admin.js`, `admin.css`, `data.json`.

Render:
- Root Directory: để trống
- Build Command: `npm install`
- Start Command: `npm start`



### Deployment note
This build supports repositories that keep frontend files at the repository root. It explicitly serves customer-pages.css, cart.js, and account.js so /cart and /account load their styling and behavior correctly.
