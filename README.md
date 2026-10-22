# فروشگاه HOYLOTT با پرداخت کارت‌به‌کارت و ارسال رسید

این نسخه به‌جای زرین‌پال، سفارش کارت‌به‌کارت ثبت می‌کند. بازیکن نام کاربری و محصول را انتخاب می‌کند، شماره کارت نمایش داده می‌شود و فایل رسید را ارسال می‌کند. Worker رسید را به ایمیل `salehamini214@gmail.com` می‌فرستد. **هیچ سفارشی با صرف ارسال رسید پرداخت‌شده محسوب نمی‌شود**؛ مدیر باید ابتدا واریز را در حساب بانکی تأیید کند و سپس سفارش را approve کند. بعد از تأیید، پلاگین موجود سفارش را خودکار تحویل می‌دهد.

## موارد امنیتی مهم
- شماره کارت داخل سایت عمومی دیده می‌شود. اگر نمی‌خواهی شماره کارت به همه نمایش داده شود، از این روش استفاده نکن.
- فایل رسید به‌صورت پیوست ایمیل ارسال می‌شود. ایمیل باید از طریق Resend و دامنه فرستندهٔ تأییدشده تنظیم شود.
- کلید `RESEND_API_KEY`، `ADMIN_TOKEN` و `DELIVERY_TOKEN` فقط در Cloudflare Secrets باشند؛ هرگز در HTML یا مخزن عمومی قرار نگیرند.
- قیمت‌ها در `cloudflare-worker/worker.js` نمونه‌اند؛ پیش از انتشار تغییرشان بده.
- تحویل خودکار فقط بعد از تأیید دستی مدیر فعال می‌شود. هرگز با دیدن اسکرین‌شات به‌تنهایی پرداخت را تأیید نکن؛ تراکنش را در اپ/حساب بانکی بررسی کن.

## 1) دیتابیس D1

### دیتابیس جدید
در Cloudflare یک D1 Database به نام `hoylott-shop` بساز و کل `cloudflare-worker/schema.sql` را اجرا کن.

### دیتابیس ساخته‌شده با نسخه قبلی فروشگاه
به‌جای اجرای دوباره schema، فایل `cloudflare-worker/migration-manual-transfer.sql` را یک‌بار روی دیتابیس فعلی اجرا کن. این فایل ستون‌های لازم برای ثبت رسید را اضافه می‌کند.

## 2) Worker

Worker جداگانه‌ای بساز؛ Worker قبلی آمار سایت را جایگزین نکن. کد `cloudflare-worker/worker.js` را منتشر کن و Binding دیتابیس را اضافه کن:

- Variable: `HOYLOTT_DB`
- Database: `hoylott-shop`

در Worker → Settings → Variables and Secrets این مقادیر را بساز:

- Secret `RESEND_API_KEY`: کلید API حساب Resend
- Variable `RESEND_FROM`: فرستنده تأییدشده، مثلاً `HOYLOTT Shop <orders@hoylott.ir>` (فقط پس از تأیید دامنه در Resend)
- Secret `ADMIN_TOKEN`: یک رشته تصادفی قوی حداقل 32 بایت
- Secret `DELIVERY_TOKEN`: همان رمز تصادفی قوی که پلاگین استفاده می‌کند
- Variable `ALLOWED_ORIGINS`: دامنه‌های واقعی سایت، بدون مسیر؛ مثال `https://hoylott.ir,https://www.hoylott.ir,https://salehamini214.github.io`

`RESEND_FROM` باید با دامنه‌ای باشد که در Resend مالکیتش را تأیید کرده‌ای. برای دریافت ایمیل، آدرس مقصد از قبل روی `salehamini214@gmail.com` تنظیم شده است.

### تنظیم Resend
1. در Resend حساب بساز و دامنه‌ای را که کنترل DNS آن را داری اضافه کن.
2. رکوردهای DNS تأیید فرستنده را در ارائه‌دهنده DNS دامنه وارد و تأیید کن.
3. API key بساز و فقط به‌صورت Secret به Worker بده.
4. یک فایل رسید آزمایشی ارسال کن و رسیدن ایمیل و پیوست را بررسی کن.

آدرس `/health` باید این خروجی را بدهد: `{"ok":true,"service":"HOYLOTT Manual Transfer Shop API"}`.

## 3) اتصال سایت

در `index.html` مقدار `SHOP_API` را به آدرس Worker فروشگاه تغییر بده:

```js
const SHOP_API = "https://YOUR-SHOP-WORKER.workers.dev";
```

سپس `index.html` را در مخزن GitHub Pages جایگزین کن. قیمت‌های واقعی را در `PRODUCTS` داخل Worker تنظیم و دوباره Deploy کن.

## 4) پلاگین Paper

پلاگین قبلی این بسته برای تحویل سفارش‌های تأییدشده قابل استفاده است. از پوشه `paper-plugin` با Java 21 و Maven اجرا کن:

```bat
mvn clean package
```

خروجی `target/hoylott-shop-1.0.0.jar` را در پوشه `plugins` سرور بگذار. فایل `plugins/HOYLOTTShop/config.yml` را تنظیم کن:

```yaml
api-url: "https://YOUR-SHOP-WORKER.workers.dev"
delivery-token: "همان DELIVERY_TOKEN در Cloudflare"
poll-seconds: 10
commands:
  vip: "lp user {player} parent addtemp vip 30d"
  money: "eco give {player} {amount}"
```

سرور را کامل Restart کن. گروه `vip` باید در LuckPerms وجود داشته باشد و دستور `eco give` با پلاگین اقتصاد تو کار کند.

## 5) تأیید سفارش پس از بررسی واقعی واریز

پس از ارسال رسید، ایمیلی شامل شناسه سفارش، نام کاربری، محصول، مبلغ و فایل رسید دریافت می‌کنی. ابتدا در حساب بانکی خودت تأیید کن که مبلغ درست واقعاً واریز شده است. سپس از PowerShell یا ترمینال خودت این درخواست را بفرست؛ توکن را داخل سایت یا چت عمومی قرار نده:

```powershell
$API = "https://YOUR-SHOP-WORKER.workers.dev"
$TOKEN = "ADMIN_TOKEN_SECRET_VALUE"
$ORDER = "ORDER_UUID_FROM_EMAIL"
Invoke-RestMethod -Method Post -Uri "$API/api/admin/approve" -Headers @{ Authorization = "Bearer $TOKEN"; "Content-Type" = "application/json" } -Body (@{ orderId = $ORDER } | ConvertTo-Json)
```

اگر خروجی `ok: true` بود، سفارش وارد صف تحویل خودکار می‌شود. `ADMIN_TOKEN` را در PowerShell خودت وارد کن؛ در HTML عمومی قرار نده.

## وضعیت سفارش‌ها
- `awaiting_receipt`: سفارش ایجاد شده و منتظر رسید است.
- `receipt_submitted`: رسید ایمیل شده؛ منتظر بررسی دستی مدیر.
- `paid`: مدیر پس از بررسی بانکی سفارش را تأیید کرده است؛ در صف تحویل.
- `processing`: پلاگین سفارش را گرفته است.
- `done`: پلاگین دستور تحویل را اجرا کرده است.
- `manual`: نیازمند بررسی دستی است.

## آزمایش قبل از انتشار
1. ابتدا یک محصول آزمایشی با قیمت پایین تنظیم کن.
2. یک سفارش آزمایشی بساز و رسید تستی ارسال کن؛ مطمئن شو ایمیل و پیوست می‌رسند.
3. سفارش را در حالی که پول واقعاً واریز نشده approve نکن.
4. فقط پس از تأیید واقعی تراکنش، endpoint تأیید مدیر را آزمایش کن و بررسی کن رنک/پول یک‌بار تحویل شود.
