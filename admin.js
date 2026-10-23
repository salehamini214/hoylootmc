
const SUPABASE_URL = "https://ikcdnkxhufsbwadgejgd.supabase.co";
const SUPABASE_KEY = "sb_publishable_NTWskUR_yAovQX6aCUh6NA_12u6LXz3";

const connected =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("YOUR_") &&
  !SUPABASE_KEY.includes("YOUR_");

const db = connected
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

const $ = (id) => document.getElementById(id);
let products = [
  { name: "VIP سی‌روزه", price: "110000", icon: "👑" },
  { name: "۱۰٬۰۰۰ سکه", price: "20000", icon: "🪙" },
  { name: "۳۰٬۰۰۰ سکه", price: "60000", icon: "💰" }
];

function status(message) {
  $("admin-status").textContent = message;
}

function requireConnection() {
  if (!db) throw new Error("ابتدا URL و کلید عمومی Supabase را در admin.js تنظیم کن.");
}

async function checkAdmin() {
  if (!db) {
    status("ابتدا اتصال Supabase را تنظیم کن.");
    return;
  }

  const { data: { session } } = await db.auth.getSession();
  $("login-panel").hidden = Boolean(session);
  $("admin-content").hidden = !session;

  if (session) {
    await loadSettings();
    await loadNews();
  }
}

$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    requireConnection();
    status("در حال ورود...");

    const { error } = await db.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value
    });

    if (error) throw error;

    status("وارد شدی.");
    await checkAdmin();
  } catch (error) {
    status("خطا در ورود: " + error.message);
  }
});

async function loadSettings() {
  const { data, error } = await db
    .from("site_settings")
    .select("content")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    status("خطای خواندن تنظیمات: " + error.message);
    return;
  }

  const content = data?.content || {};

  $("site-title").value = content.title || "به دنیای HOYLOTT خوش اومدی!";
  $("site-description").value = content.description || "ماجراجویی کن، پیشرفت کن و با دوستات بازی کن.";
  $("server-address-input").value = content.serverAddress || "185.112.151.46:27167";

  products = Array.isArray(content.products) && content.products.length
    ? content.products
    : products;

  renderProductFields();
}

function renderProductFields() {
  const container = $("product-fields");
  container.replaceChildren();

  products.forEach((product, index) => {
    const heading = document.createElement("h3");
    heading.textContent = `محصول ${index + 1}`;

    const nameLabel = document.createElement("label");
    nameLabel.textContent = "نام محصول";

    const nameInput = document.createElement("input");
    nameInput.value = product.name || "";
    nameInput.required = true;
    nameInput.addEventListener("input", () => {
      products[index].name = nameInput.value;
    });

    const priceLabel = document.createElement("label");
    priceLabel.textContent = "قیمت به تومان";

    const priceInput = document.createElement("input");
    priceInput.type = "number";
    priceInput.min = "0";
    priceInput.step = "1";
    priceInput.required = true;
    priceInput.value = product.price || "";
    priceInput.addEventListener("input", () => {
      products[index].price = priceInput.value;
    });

    container.append(heading, nameLabel, nameInput, priceLabel, priceInput);
  });
}

$("settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const content = {
      title: $("site-title").value.trim(),
      description: $("site-description").value.trim(),
      serverAddress: $("server-address-input").value.trim(),
      products
    };

    const { error } = await db.from("site_settings").upsert({
      id: 1,
      content,
      updated_at: new Date().toISOString()
    });

    if (error) throw error;
    status("تنظیمات ذخیره شد.");
  } catch (error) {
    status("ذخیره انجام نشد: " + error.message);
  }
});

$("products-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const { data, error: readError } = await db
      .from("site_settings")
      .select("content")
      .eq("id", 1)
      .maybeSingle();

    if (readError) throw readError;

    const content = {
      ...(data?.content || {}),
      title: $("site-title").value.trim(),
      description: $("site-description").value.trim(),
      serverAddress: $("server-address-input").value.trim(),
      products
    };

    const { error } = await db.from("site_settings").upsert({
      id: 1,
      content,
      updated_at: new Date().toISOString()
    });

    if (error) throw error;
    status("قیمت‌های فروشگاه ذخیره شدند.");
  } catch (error) {
    status("خطا در ذخیره قیمت‌ها: " + error.message);
  }
});

async function uploadNewsImage(file) {
  if (!file) return null;

  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.type)) {
    throw new Error("فقط تصویر PNG، JPG یا WEBP مجاز است.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("حجم تصویر باید کمتر از ۵ مگابایت باشد.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${crypto.randomUUID()}-${safeName}`;

  const { error } = await db.storage
    .from("site-images")
    .upload(path, file, { upsert: false });

  if (error) throw error;

  const { data } = db.storage.from("site-images").getPublicUrl(path);
  return data.publicUrl;
}

$("news-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    status("در حال ثبت خبر...");

    const file = $("news-image").files[0];
    const imageUrl = await uploadNewsImage(file);

    const { error } = await db.from("news").insert({
      title: $("news-title").value.trim(),
      body: $("news-body").value.trim(),
      image_url: imageUrl,
      published: $("news-published").checked
    });

    if (error) throw error;

    $("news-form").reset();
    $("news-published").checked = true;
    status("خبر ثبت شد.");
    await loadNews();
  } catch (error) {
    status("ثبت خبر ناموفق بود: " + error.message);
  }
});

async function loadNews() {
  const { data, error } = await db
    .from("news")
    .select("id,title,published,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    status("خطا در دریافت اخبار: " + error.message);
    return;
  }

  const list = $("admin-news-list");
  list.replaceChildren();

  if (!data?.length) {
    list.textContent = "هنوز خبری ثبت نشده است.";
    return;
  }

  data.forEach((item) => {
    const row = document.createElement("div");
    row.className = "admin-news-row";

    const title = document.createElement("strong");
    title.textContent = item.title;

    const state = document.createElement("p");
    state.textContent = item.published ? "منتشرشده" : "پیش‌نویس";

    const toggle = document.createElement("button");
    toggle.className = "btn secondary";
    toggle.type = "button";
    toggle.textContent = item.published ? "تبدیل به پیش‌نویس" : "انتشار خبر";
    toggle.addEventListener("click", async () => {
      const { error } = await db.from("news")
        .update({ published: !item.published })
        .eq("id", item.id);

      if (error) status("خطا: " + error.message);
      else {
        status("وضعیت خبر تغییر کرد.");
        await loadNews();
      }
    });

    const remove = document.createElement("button");
    remove.className = "btn secondary";
    remove.type = "button";
    remove.textContent = "حذف خبر";
    remove.style.marginRight = "8px";
    remove.addEventListener("click", async () => {
      if (!confirm(`خبر «${item.title}» حذف شود؟`)) return;

      const { error } = await db.from("news").delete().eq("id", item.id);
      if (error) status("خطا در حذف: " + error.message);
      else {
        status("خبر حذف شد.");
        await loadNews();
      }
    });

    row.append(title, state, toggle, remove);
    list.append(row);
  });
}

$("logout-button").addEventListener("click", async () => {
  const { error } = await db.auth.signOut();
  if (error) status("خطا در خروج: " + error.message);
  else {
    status("از حساب خارج شدی.");
    await checkAdmin();
  }
});

if (db) {
  db.auth.onAuthStateChange(() => {
    checkAdmin();
  });
}

checkAdmin();
