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
const CANDIDATE_POOL_PER_SUBCAT = Math.max(
  10,
  Number(process.env.CANDIDATE_POOL_PER_SUBCAT || (MAX_PRODUCTS_PER_SUBCAT > 0 ? MAX_PRODUCTS_PER_SUBCAT * 10 : 0))
);
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

  return [...links];
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
        // Pagination routes such as /Kitchenware/page-2 are not subcategories.
        if (
          !name ||
          name.toLowerCase() === "kitchenware" ||
          /^page-\d+$/i.test(name)
        ) continue;
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

    const extracted = await page.evaluate((productId) => {
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
            ...String(img.getAttribute("srcset") || "").split(",").map((part) => part.trim().split(/\s+/)[0]),
          ];
          return sources.filter(Boolean).filter((source) => {
            try {
              return new URL(source, location.href).pathname.includes(String(productId));
            } catch {
              return false;
            }
          });
        }),
      ].filter((value) => {
        try {
          const candidate = new URL(value);
          const isProductAsset = /\/products\//i.test(candidate.pathname);
          return candidate.protocol === "https:" &&
            ["static.markaz.app", "content.public.markaz.app", "www.shop.markaz.app"].includes(candidate.hostname) &&
            (isProductAsset || /logo|avatar|icon|banner|placeholder/i.test(candidate.pathname) === false) &&
            !/\.svg(?:$|\?)/i.test(candidate.pathname);
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
      const ratingRaw = schema?.aggregateRating?.ratingValue ??
        meta('meta[itemprop="ratingValue"]') ??
        firstText(['[itemprop="ratingValue"]', '[class*="rating"] [class*="value"]']);
      const reviewRaw = schema?.aggregateRating?.reviewCount ??
        schema?.aggregateRating?.ratingCount ??
        meta('meta[itemprop="reviewCount"]') ??
        firstText(['[itemprop="reviewCount"]', '[class*="review-count"]', '[class*="reviews-count"]']);
      const salesText = document.body?.innerText || "";
      const salesMatch = salesText.match(/(?:sold|sales|orders?)\s*[:(]?\s*([\d,]+)/i) ||
        salesText.match(/([\d,]+)\s*\+?\s*(?:sold|sales|orders?)/i);
      const numeric = (value) => {
        const match = String(value || "").replace(/,/g, "").match(/\d+(?:\.\d+)?/);
        return match ? Number(match[0]) : null;
      };

      return {
        title,
        price: Number.isFinite(price) && price > 0 ? price : null,
        rating: numeric(ratingRaw),
        reviewCount: numeric(reviewRaw),
        salesCount: salesMatch ? numeric(salesMatch[1]) : null,
        currency: clean(offers?.priceCurrency) ||
          meta('meta[property="product:price:currency"]') || "PKR",
        image: image || null,
        images,
        description: rawDescription,
        brand: brand || null,
      };
    }, productIdFromUrl(url));

    // Verify actual browser image loading instead of trusting URL shape alone.
    const validImages = await page.evaluate(async (candidates) => {
      const check = (src) => new Promise((resolve) => {
        const image = new Image();
        const timeout = window.setTimeout(() => {
          image.onload = null;
          image.onerror = null;
          resolve(false);
        }, 12000);
        image.onload = () => {
          window.clearTimeout(timeout);
          resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
        };
        image.onerror = () => {
          window.clearTimeout(timeout);
          resolve(false);
        };
        image.src = src;
      });
      const results = await Promise.all(
        candidates.map(async (src) => ({ src, ok: await check(src) }))
      );
      return results.filter((item) => item.ok).map((item) => item.src);
    }, extracted.images || []);

    if (!extracted.title || !validImages.length) {
      throw new Error("Missing title or no product images could be loaded");
    }

    return {
      id: productIdFromUrl(url),
      title: extracted.title,
      price: extracted.price,
      rating: extracted.rating,
      reviewCount: extracted.reviewCount,
      salesCount: extracted.salesCount,
      currency: extracted.currency || "PKR",
      image: validImages[0],
      images: validImages,
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

    // Rebuild this category from scratch so duplicate products from old runs
    // cannot survive in multiple subcategories.
    category.subcategories = [];
    const globallyAssignedProductIds = new Set();

    for (const subcategory of subcategories) {
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

      // Filter product IDs globally before parsing. A product listed in another
      // subcategory is assigned only once across the entire Kitchenware catalogue.
      const uniqueLinks = [];
      const localIds = new Set();
      for (const link of productLinks) {
        const id = productIdFromUrl(link);
        if (globallyAssignedProductIds.has(id) || localIds.has(id)) continue;
        localIds.add(id);
        uniqueLinks.push(link);
      }

      const candidateLinks = CANDIDATE_POOL_PER_SUBCAT > 0
        ? uniqueLinks.slice(0, CANDIDATE_POOL_PER_SUBCAT)
        : uniqueLinks;
      console.log("      Unique candidates: " + candidateLinks.length + " (removed " + (productLinks.length - uniqueLinks.length) + " duplicates)");

      const products = await mapLimit(candidateLinks, PARSE_CONCURRENCY, async (link) => {
        // Revisit every candidate so image availability and ranking metrics are fresh.
        const productPage = await context.newPage();
        try {
          const parsed = await extractProduct(productPage, link);
          // Never fall back to an old cached image URL after a fresh validation fails.
          return parsed;
        } finally {
          await productPage.close().catch(() => {});
        }
      });

      const candidates = products
        .map((product, index) => product ? { product, listingIndex: index } : null)
        .filter(Boolean);

      // Rank by real sales first, then review volume, rating, and lower price.
      // When Markaz exposes none of those metrics, retain Markaz's own curated
      // listing order rather than pretending that low price means best-selling.
      candidates.sort((a, b) => {
        const A = a.product, B = b.product;
        const compareAvailable = (field, direction = -1) => {
          const av = A[field] !== null && A[field] !== undefined && A[field] !== "" && Number.isFinite(Number(A[field])) ? Number(A[field]) : null;
          const bv = B[field] !== null && B[field] !== undefined && B[field] !== "" && Number.isFinite(Number(B[field])) ? Number(B[field]) : null;
          if (av === null && bv === null) return 0;
          if (av === null) return 1;
          if (bv === null) return -1;
          return (av - bv) * direction;
        };
        return compareAvailable("salesCount") ||
          compareAvailable("reviewCount") ||
          compareAvailable("rating") ||
          compareAvailable("price", 1) ||
          a.listingIndex - b.listingIndex;
      });

      const limit = MAX_PRODUCTS_PER_SUBCAT > 0 ? MAX_PRODUCTS_PER_SUBCAT : candidates.length;
      const orderedProducts = candidates
        .slice(0, limit)
        .map(({ product }) => product)
        .filter((product) => {
          const id = String(product.id || productIdFromUrl(product.link));
          if (globallyAssignedProductIds.has(id)) return false;
          globallyAssignedProductIds.add(id);
          return true;
        });
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

      console.log("Saved " + orderedProducts.length + " unique ranked products for " + subcategory.name + ".");
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
