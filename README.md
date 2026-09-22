# Gaming Shop — customizable marketplace

A Node.js + Express gaming marketplace starter with a separate customer account area and a dedicated Admin Panel.

## Included

- Product catalog with product images and multiple variants/packages per product.
- Category groups managed from Admin; clicking a category shows only that group.
- "Sản phẩm bán chạy" section based on sold count.
- "Đã xem gần đây" section stored per browser in localStorage.
- Two configurable floating social buttons (Zalo / Messenger / Discord).
- Global shop customization: brand, logo, hero, colors, fonts, footer/contact links, homepage sections and section order.
- Separate `/admin` panel for products, orders, top-ups and shop design.
- Customer `/account` area: profile, security, password, orders, balance history, activity, support and affiliate UI.
- Google Authenticator 2FA with a real TOTP secret, QR setup, OTP confirmation and login challenge.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Admin

Default environment values:

- Email: `admin@example.com`
- Password: `change-this-password`

For a real deployment, set `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `SESSION_SECRET` in the hosting environment.

## Render

- Build Command: `npm install`
- Start Command: `npm start`
- Root Directory: leave blank when the project files are at repository root.

## Notes

The project uses `data.json` for MVP persistence. For a real shop with real money, move users/orders/wallets to a database and use durable object/image storage. The current QR image is generated through QuickChart from the TOTP `otpauth://` URI; for production, self-host QR generation so the secret is not sent to a third-party image service.
