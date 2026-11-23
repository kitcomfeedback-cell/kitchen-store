// scripts/scrape.mjs
// Markaz Kitchenware scraper. Keeps the catalogue schema consumed by the Next.js app.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "https://www.markaz.app";
const CATEGORY_URL = BASE + "/shop/home-page/Kitchenware";
const OUT_PATH = path.resolve("src/app/data/catalog.json");
const CHECKPOINT_PATH = OUT_PATH + ".tmp";
const PROGRESS_PATH = path.resolve("scripts/scrape_progress.json");

const PARSE_CONCURRENCY = Math.max(1, Number(process.env.PARSE_CONCURRENCY || 5));
const REFRESH_DAYS = Math.max(0, Number(process.env.REFRESH_DAYS || 7));
const MAX_PRODUCTS_PER_SUBCAT = Math.max(0, Number(process.env.MAX_PRODUCTS_PER_SUBCAT || 0));
const NAV_TIMEOUT = 60000;
const PRODUCT_PATH = "/shop/product/";

const nowIso = () => new Date().toISOString();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file, value) {
  ensureDir(file);
  const temp = file + "." + process.pid + ".writing";
  fs.writeFileSync(temp, JSON.stringify(value, null, 2));
  fs.renameSync(temp, file);
}

function ageInDays(value) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? (Date.now() - timestamp) / 86400000 : Infinity;
}

function normalizeUrl(href, base) {
  try {
    const url = new URL(href, base);
    if (url.origin !== BASE || !url.pathname.startsWith(PRODUCT_PATH)) return null;
    url.hash = "";
    url.search = "";
    return url.href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

function productIdFromUrl(url) {
  try {
    return new URL(url).pathname.split("/").filter(Boolean).at(-1) || url;
  } catch {
    return url;
  }
}

function loadExistingProducts(catalog) {
  const map = new Map();
  for (const category of catalog?.categories || []) {
    for (const subcategory of category.subcategories || []) {
      for (const product of subcategory.products || []) {
        if (product?.link) map.set(product.link, product);
      }
    }
  }
  return map;
}

async function waitForListing(page) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(1200);
  await page.waitForSelector('a[href*="' + PRODUCT_PATH + '"]', { timeout: 15000 }).catch(() => {});
}

async function getListingLinks(page) {
  return page.$$eval('a[href*="' + PRODUCT_PATH + '"]', (anchors) => {
    const found = new Set();
    for (const anchor of anchors) {
      const raw = anchor.getAttribute("href") || anchor.href;
      if (!raw) continue;
      try {
        const url = new URL(raw, location.href);
        if (url.origin !== location.origin || !url.pathname.startsWith("/shop/product/")) continue;
        url.search = "";
        url.hash = "";
        found.add(url.href.replace(/\/$/, ""));
      } catch {}
    }
    return [...found];
  });
}

async function scrollListing(page) {
  let stableRounds = 0;
  let previousCount = 0;
  const all = new Set();

  for (let round = 0; round < 12 && stableRounds < 3; round++) {
    for (const link of await getListingLinks(page)) all.add(link);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(650);
    for (const link of await getListingLinks(page)) all.add(link);

    if (all.size === previousCount) stableRounds++;
    else stableRounds = 0;
    previousCount = all.size;
  }
  return [...all];
}

function pageUrlForNumber(subcategoryUrl, pageNumber) {
  const url = new URL(subcategoryUrl);
  if (pageNumber > 1) url.searchParams.set("page", String(pageNumber));
  else url.searchParams.delete("page");
  return url.href;
}

async function collectSubcategoryProducts(page, subcategoryUrl) {
  const links = new Set();
  let previousPageCount = -1;

  // Walk numbered pages sequentially. Markaz may show only a sliding window
  // of page numbers, so do not infer the final page from visible pagination links.
  for (let pageNumber = 1; pageNumber <= 300; pageNumber++) {
    const target = pageUrlForNumber(subcategoryUrl, pageNumber);
    if (page.url() !== target) {
      await page.goto(target, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
      await waitForListing(page);
    } else if (pageNumber === 1) {
      await waitForListing(page);
    }

    const pageLinks = await scrollListing(page);
    let added = 0;
    for (const link of pageLinks) {
      if (!links.has(link)) {
        links.add(link);
        added++;
      }
    }

    console.log("      Listing page " + pageNumber + ": +" + added + " new, " + links.size + " total");

    if (pageLinks.length === 0 || (pageNumber > 1 && added === 0)) break;
    if (links.size === previousPageCount) break;
    previousPageCount = links.size;
  }

  const result = [...links];
  return MAX_PRODUCTS_PER_SUBCAT > 0 ? result.slice(0, MAX_PRODUCTS_PER_SUBCAT) : result;
}
async function discoverSubcategories(page) {
  await page.goto(CATEGORY_URL, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  await page.waitForTimeout(1500);

  return page.$$eval("a[href]", (anchors, categoryUrl) => {
    const root = new URL(categoryUrl);
    const rootPath = root.pathname.replace(/\/$/, "");
    const found = new Map();

    for (const anchor of anchors) {
      try {
        const url = new URL(anchor.getAttribute("href") || anchor.href, location.href);
        if (url.origin !== root.origin) continue;
        const path = url.pathname.replace(/\/$/, "");
        if (!path.startsWith(rootPath + "/")) continue;

        const remainder = path.slice(rootPath.length + 1);
        if (!remainder || remainder.includes("/")) continue;

        const name = decodeURIComponent(remainder);
        if (!name || name.toLowerCase() === "kitchenware") continue;
        url.search = "";
        url.hash = "";
        found.set(url.href, { name, url: url.href });
      } catch {}
    }
    return [...found.values()];
  }, CATEGORY_URL);
}

async function extractProduct(page, url, attempt = 1) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await page.waitForTimeout(800);

    const extracted = await page.evaluate(() => {
      const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
      const meta = (selector) => clean(document.querySelector(selector)?.getAttribute("content"));
      const firstText = (selectors) => {
        for (const selector of selectors) {
          const value = clean(document.querySelector(selector)?.textContent);
          if (value) return value;
        }
        return "";
      };

      const queue = [];
      for (const block of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          const parsed = JSON.parse(block.textContent || "null");
          if (Array.isArray(parsed)) queue.push(...parsed);
          else if (parsed && Array.isArray(parsed["@graph"])) queue.push(...parsed["@graph"]);
          else if (parsed) queue.push(parsed);
        } catch {}
      }

      let schema = null;
      for (const item of queue) {
        const types = Array.isArray(item?.["@type"]) ? item["@type"] : [item?.["@type"]];
        if (types.some((type) => String(type).toLowerCase() === "product")) {
          schema = item;
          break;
        }
      }

      const offers = Array.isArray(schema?.offers) ? schema.offers[0] : schema?.offers;
      const schemaImages = Array.isArray(schema?.image) ? schema.image : schema?.image ? [schema.image] : [];
      const imageCandidates = [
        meta('meta[property="og:image"]'),
        meta('meta[name="twitter:image"]'),
        ...schemaImages.map((image) => typeof image === "string" ? image : image?.url || image?.contentUrl),
        ...[...document.querySelectorAll("img")].flatMap((img) => {
          const sources = [
            img.currentSrc,
            img.src,
            img.getAttribute("data-src"),
            img.getAttribute("data-original"),
            ...String(img.getAttribute("srcset") || "").split(",").map((part) => part.trim().split(/\\s+/)[0]),
          ];
          return sources.filter(Boolean);
        }),
      ].filter((value) => {
        try {
          const candidate = new URL(value);
          const isProductAsset = /\\/products\\//i.test(candidate.pathname);
          return candidate.protocol === "https:" &&
            ["static.markaz.app", "content.public.markaz.app", "www.shop.markaz.app"].includes(candidate.hostname) &&
            (isProductAsset || /logo|avatar|icon|banner|placeholder/i.test(candidate.pathname) === false) &&
            !/\\.svg(?:$|\\?)/i.test(candidate.pathname);
        } catch {
          return false;
        }
      });

      const images = [...new Set(imageCandidates)].slice(0, 12);
      const image = images[0] || "";

      const title = clean(schema?.name) ||
        meta('meta[property="og:title"]') ||
        firstText(["h1", '[data-testid*="product-title"]']) ||
        clean(document.title);

      const rawPrice = offers?.price ??
        meta('meta[property="product:price:amount"]') ??
        firstText(['[itemprop="price"]', '[data-testid*="price"]', '[class*="price"]']);
      const priceMatch = String(rawPrice || "").replace(/,/g, "").match(/\d+(?:\.\d+)?/);
      const price = priceMatch ? Number(priceMatch[0]) : null;

      const rawDescription = clean(schema?.description) ||
        meta('meta[name="description"]') ||
        meta('meta[property="og:description"]') ||
        firstText(['[itemprop="description"]', '[data-testid*="description"]']);

      const brandValue = schema?.brand;
      const brand = typeof brandValue === "string" ? brandValue : clean(brandValue?.name);

      return {
        title,
        price: Number.isFinite(price) && price > 0 ? price : null,
        currency: clean(offers?.priceCurrency) ||
          meta('meta[property="product:price:currency"]') || "PKR",
        image: image || null,
        images,
        description: rawDescription,
        brand: brand || null,
      };
    });

    if (!extracted.title || !extracted.image || !extracted.images?.length) {
      throw new Error("Missing required product fields (title/image)");
    }

    return {
      id: productIdFromUrl(url),
      title: extracted.title,
      price: extracted.price,
      currency: extracted.currency || "PKR",
      image: extracted.image,
      images: extracted.images,
      link: url,
      description: extracted.description || "",
      brand: extracted.brand || null,
      updatedAt: nowIso(),
    };
  } catch (error) {
    if (attempt < 2) {
      console.warn("      Retry " + (attempt + 1) + "/2: " + url + " (" + error.message + ")");
      await sleep(1000 * attempt);
      return extractProduct(page, url, attempt + 1);
    }
    console.warn("      Could not parse product: " + url + " (" + error.message + ")");
    return null;
  }
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function scrape() {
  const previous = readJson(OUT_PATH, { scrapedAt: null, categories: [] });
  const checkpoint = readJson(CHECKPOINT_PATH, null);
  const progress = readJson(PROGRESS_PATH, { completedSubcategoryUrls: [] });
  const completed = new Set(progress.completedSubcategoryUrls || []);
  const output = checkpoint?.categories ? checkpoint : previous;
  output.categories ||= [];

  const existingByLink = loadExistingProducts(previous);
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  });

  try {
    const page = await context.newPage();
    console.log("Opening " + CATEGORY_URL);
    const subcategories = await discoverSubcategories(page);
    if (!subcategories.length) {
      throw new Error("No Kitchenware subcategories were discovered. Existing catalogue was not replaced.");
    }

    console.log("Found " + subcategories.length + " Kitchenware subcategories.");
    let category = output.categories.find((item) =>
      String(item.name || "").toLowerCase() === "kitchenware"
    );
    if (!category) {
      category = { name: "Kitchenware", url: CATEGORY_URL, subcategories: [] };
      output.categories.push(category);
    }
    category.url = CATEGORY_URL;
    category.subcategories ||= [];

    for (const subcategory of subcategories) {
      if (completed.has(subcategory.url)) {
        console.log("Skipping completed subcategory: " + subcategory.name);
        continue;
      }

      console.log("\nSubcategory: " + subcategory.name);
      const listingPage = await context.newPage();
      let productLinks;
      try {
        productLinks = await collectSubcategoryProducts(listingPage, subcategory.url);
      } finally {
        await listingPage.close().catch(() => {});
      }

      if (!productLinks.length) {
        console.warn("No product links found for " + subcategory.name + "; keeping previous data.");
        continue;
      }

      const products = await mapLimit(productLinks, PARSE_CONCURRENCY, async (link) => {
        const cached = existingByLink.get(link);
        if (cached && Array.isArray(cached.images) && cached.images.length > 0 && ageInDays(cached.updatedAt) <= REFRESH_DAYS) return cached;

        const productPage = await context.newPage();
        try {
          const parsed = await extractProduct(productPage, link);
          return parsed || cached || null;
        } finally {
          await productPage.close().catch(() => {});
        }
      });

      const orderedProducts = products.filter(Boolean);
      const subcategoryIndex = category.subcategories.findIndex((item) => item.url === subcategory.url);
      const updatedSubcategory = {
        name: subcategory.name,
        url: subcategory.url,
        products: orderedProducts,
      };

      if (subcategoryIndex >= 0) category.subcategories[subcategoryIndex] = updatedSubcategory;
      else category.subcategories.push(updatedSubcategory);

      category.subcategories.sort((a, b) => a.name.localeCompare(b.name));
      output.scrapedAt = nowIso();
      writeJsonAtomic(CHECKPOINT_PATH, output);

      completed.add(subcategory.url);
      writeJsonAtomic(PROGRESS_PATH, { completedSubcategoryUrls: [...completed] });
      console.log("Saved " + orderedProducts.length + " products for " + subcategory.name + ".");
    }

    const unfinished = subcategories.filter((item) => !completed.has(item.url));
    if (unfinished.length) {
      throw new Error("Scrape paused safely. " + unfinished.length + " subcategory/subcategories remain; rerun to continue.");
    }

    output.scrapedAt = nowIso();
    writeJsonAtomic(OUT_PATH, output);
    fs.rmSync(CHECKPOINT_PATH, { force: true });
    fs.rmSync(PROGRESS_PATH, { force: true });
    console.log("\nFinished. Catalogue saved to " + OUT_PATH);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

scrape().catch((error) => {
  console.error("Scrape failed:", error);
  process.exitCode = 1;
});
