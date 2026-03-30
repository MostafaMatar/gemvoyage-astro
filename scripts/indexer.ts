import { readFileSync } from "fs";
import { resolve } from "path";

const CONCURRENCY = 10;
const TIMEOUT_MS = 15000;
const ROOT = resolve(import.meta.dirname ?? ".", "..");

interface Result {
  sitemapUrl: string;
  indexerUrl: string;
  status: number | null;
  ok: boolean;
  error?: string;
}

function extractUrlsFromSitemap(xml: string): string[] {
  const urls: string[] = [];
  const regex = /<loc>\s*(.*?)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

function loadIndexerTemplates(filePath: string): string[] {
  const content = readFileSync(filePath, "utf-8");
  return content
    .split("\n")
    .map((l) => l.trim().replace(/\r/g, ""))  // strip carriage returns
    .filter((l) => l && !l.startsWith("#") && !l.startsWith("//"));
}

function buildUrl(template: string, targetUrl: string): string {
  const filled = template.replace(/\{URL\}/g, encodeURIComponent(targetUrl));
  if (filled.startsWith("http://") || filled.startsWith("https://")) {
    return filled;
  }
  return `https://${filled}`;
}

async function submitUrl(
  fullUrl: string
): Promise<{ status: number | null; ok: boolean; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(fullUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SiteIndexer/1.0; +https://gemvoyage.net)",
      },
    });
    clearTimeout(timer);
    return { status: res.status, ok: res.status >= 200 && res.status < 400 };
  } catch (err: any) {
    clearTimeout(timer);
    const msg =
      err.name === "AbortError" ? "Timeout" : err.message?.slice(0, 80) ?? "Unknown error";
    return { status: null, ok: false, error: msg };
  }
}

async function processQueue(
  tasks: Array<{ sitemapUrl: string; template: string }>,
  concurrency: number
): Promise<Result[]> {
  const results: Result[] = [];
  let idx = 0;
  let successes = 0;
  let failures = 0;
  const total = tasks.length;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      const { sitemapUrl, template } = tasks[i];
      const fullUrl = buildUrl(template, sitemapUrl);
      const res = await submitUrl(fullUrl);
      const done = successes + failures + 1;

      if (res.ok) {
        successes++;
        console.log(
          `[${done}/${total}] ✅ ${res.status} | ${template.substring(0, 50)}... → ${sitemapUrl.substring(0, 60)}`
        );
      } else {
        failures++;
        console.log(
          `[${done}/${total}] ❌ ${res.status ?? "ERR"} | ${template.substring(0, 50)}... → ${res.error ?? ""}`
        );
      }

      results.push({
        sitemapUrl,
        indexerUrl: fullUrl,
        status: res.status,
        ok: res.ok,
        error: res.error,
      });
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  return results;
}

async function main() {
  console.log("🔍 Loading sitemap.xml...");
  const sitemapPath = resolve(ROOT, "gemvoyage-astro/public", "sitemap.xml");
  let sitemapXml: string;
  try {
    sitemapXml = readFileSync(sitemapPath, "utf-8");
  } catch {
    console.error(`❌ Could not find sitemap at ${sitemapPath}`);
    process.exit(1);
  }
  const sitemapUrls = extractUrlsFromSitemap(sitemapXml);
  console.log(`📄 Found ${sitemapUrls.length} URLs in sitemap.\n`);

  if (sitemapUrls.length === 0) {
    console.error("❌ No URLs found in sitemap.");
    process.exit(1);
  }

  console.log("📂 Loading indexer URLs...");
  const templates = loadIndexerTemplates(resolve(ROOT, "gemvoyage-astro", "indexer-urls.txt"));
  console.log(`🌐 Loaded ${templates.length} indexer endpoints.\n`);

  const tasks: Array<{ sitemapUrl: string; template: string }> = [];
  for (const sitemapUrl of sitemapUrls) {
    for (const template of templates) {
      tasks.push({ sitemapUrl, template });
    }
  }

  console.log(
    `🚀 Submitting ${tasks.length} requests (${sitemapUrls.length} pages × ${templates.length} indexers) with concurrency ${CONCURRENCY}...\n`
  );

  const startTime = Date.now();
  const results = await processQueue(tasks, CONCURRENCY);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const totalSuccesses = results.filter((r) => r.ok).length;
  const totalFailures = results.filter((r) => !r.ok).length;

  console.log("\n" + "=".repeat(60));
  console.log("📊 INDEXING SUMMARY");
  console.log("=".repeat(60));
  console.log(`  Pages in sitemap:  ${sitemapUrls.length}`);
  console.log(`  Indexer endpoints: ${templates.length}`);
  console.log(`  Total requests:    ${results.length}`);
  console.log(`  ✅ Successes:      ${totalSuccesses}`);
  console.log(`  ❌ Failures:       ${totalFailures}`);
  console.log(
    `  Success rate:      ${((totalSuccesses / results.length) * 100).toFixed(1)}%`
  );
  console.log(`  Time elapsed:      ${elapsed}s`);
  console.log("=".repeat(60));

  // Per-page breakdown
  console.log("\n📄 Per-page breakdown:");
  for (const sitemapUrl of sitemapUrls) {
    const pageResults = results.filter((r) => r.sitemapUrl === sitemapUrl);
    const ok = pageResults.filter((r) => r.ok).length;
    const fail = pageResults.filter((r) => !r.ok).length;
    console.log(`  ${sitemapUrl}`);
    console.log(`    ✅ ${ok}  ❌ ${fail}`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
