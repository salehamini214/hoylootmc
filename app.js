
const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
const SUPABASE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";

const supabaseReady =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("YOUR_") &&
  !SUPABASE_KEY.includes("YOUR_");

const db = supabaseReady
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

document.getElementById("year").textContent = new Date().getFullYear();

document.getElementById("copy-address").addEventListener("click", async () => {
  const address = document.getElementById("server-address").textContent.trim();
  const status = document.getElementById("copy-status");

  try {
    await navigator.clipboard.writeText(address);
    status.textContent = "آدرس سرور کپی شد!";
  } catch {
    status.textContent = "کپی خودکار نشد؛ آدرس را دستی کپی کن.";
  }
});

async function loadHoylottContent() {
  if (!db) return;

  const { data: settings, error: settingsError } = await db
    .from("site_settings")
    .select("content")
    .eq("id", 1)
    .maybeSingle();

  if (!settingsError && settings?.content) {
    const content = settings.content;

    if (content.title) {
      document.getElementById("hero-title").textContent = content.title;
    }
    if (content.description) {
      document.getElementById("hero-description").textContent = content.description;
    }
    if (content.serverAddress) {
      document.getElementById("server-address").textContent = content.serverAddress;
    }

    if (Array.isArray(content.products) && content.products.length) {
      const shop = document.getElementById("shop-items");
      shop.replaceChildren();

      content.products.forEach((product) => {
        const card = document.createElement("article");
        card.className = "item-card";

        const icon = document.createElement("div");
        icon.className = "item-icon";
        icon.textContent = product.icon || "💎";

        const name = document.createElement("h3");
        name.textContent = product.name || "محصول";

        const price = document.createElement("p");
        price.className = "price";
        price.textContent = `${product.price || ""} تومان`;

        card.append(icon, name, price);
        shop.append(card);
      });
    }
  }

  const { data: news, error: newsError } = await db
    .from("news")
    .select("id,title,body,image_url,created_at")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (newsError || !news) return;

  const newsContainer = document.getElementById("news-items");
  newsContainer.replaceChildren();

  if (news.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "هنوز خبری منتشر نشده است.";
    newsContainer.append(empty);
    return;
  }

  news.forEach((item) => {
    const card = document.createElement("article");
    card.className = "news-card";

    if (item.image_url) {
      const img = document.createElement("img");
      img.src = item.image_url;
      img.alt = item.title || "تصویر خبر";
      img.loading = "lazy";
      card.append(img);
    }

    const title = document.createElement("h3");
    title.textContent = item.title;

    const body = document.createElement("p");
    body.textContent = item.body || "";

    const date = document.createElement("p");
    date.className = "news-date";
    date.textContent = new Date(item.created_at).toLocaleDateString("fa-IR");

    card.append(title, body, date);
    newsContainer.append(card);
  });
}

loadHoylottContent();
