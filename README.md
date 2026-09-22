# Gaming Shop — Clean Marketplace UI

Phiên bản này thay toàn bộ giao diện frontend theo hướng marketplace hiện đại, sạch và tập trung vào ảnh sản phẩm.

Điểm chính:
- Giao diện mới, không bám bố cục cũ.
- Card sản phẩm có ảnh riêng cho từng món.
- Admin có thể thêm / sửa / xóa sản phẩm.
- Admin upload ảnh PNG/JPG/WebP trực tiếp từ máy tính.
- Ảnh được lưu vào `data.json` dưới dạng data URL, phù hợp demo/MVP.
- Giữ lại login, ví, top-up, giỏ hàng, checkout, đơn hàng và admin.

## Chạy

```bash
npm install
npm start
```

Mở `http://localhost:3000`.

## Tài khoản admin

Mặc định:
- Email: `admin@example.com`
- Password: `change-this-password`

Có thể đổi bằng biến môi trường `ADMIN_EMAIL` và `ADMIN_PASSWORD`.


## Deploy nhanh lên Render

Project này dùng Node.js + Express nên chọn **Web Service**, không phải Static Site. Render hỗ trợ deploy Express và cấp subdomain `onrender.com`. Free Web Service phù hợp để test/demo; service sẽ sleep sau 15 phút không có traffic và filesystem local không được giữ khi restart/redeploy, vì vậy `data.json` và ảnh upload trong MVP này không phù hợp để lưu dữ liệu bán hàng thật lâu dài.

File `render.yaml` và `.node-version` đã được chuẩn bị sẵn.
