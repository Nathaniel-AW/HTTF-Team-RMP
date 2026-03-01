import { cleanString, sha256, truncateText } from "./common.js";

const FETCH_TIMEOUT_MS = 10000;
const MAX_BYTES_PER_PAGE = 200_000;

export async function fetchAndSanitizeSources(candidates, options = {}) {
  const maxPages = Number(options.maxPages) > 0 ? Number(options.maxPages) : 6;
  const maxBytes = Number(options.maxBytes) > 0 ? Number(options.maxBytes) : MAX_BYTES_PER_PAGE;

  const results = [];

  for (const candidate of candidates.slice(0, maxPages)) {
    const base = {
      url: candidate.url,
      domain: candidate.domain,
      title: candidate.title,
      retrievedAt: new Date().toISOString(),
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const response = await fetch(candidate.url, {
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5",
          "User-Agent": "Mozilla/5.0 (compatible; FutureScoreBot/1.0)",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        results.push({ ...base, status: "failed", error: `HTTP ${response.status}` });
        continue;
      }

      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
        results.push({ ...base, status: "blocked", error: "Unsupported content type" });
        continue;
      }

      const html = await response.text();
      const boundedHtml = html.slice(0, maxBytes);
      const parsed = sanitizePageText(boundedHtml);
      const text = truncateText(parsed.text, 24_000);

      if (!text || text.length < 160) {
        results.push({ ...base, status: "failed", error: "Insufficient readable content" });
        continue;
      }

      results.push({
        ...base,
        status: "fetched",
        title: parsed.title || base.title,
        contentText: text,
        contentHash: sha256(text),
      });
    } catch (error) {
      results.push({
        ...base,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

function sanitizePageText(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = cleanString(decodeHtmlEntities(titleMatch?.[1] ?? "")) ?? "";

  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ");

  text = text
    .replace(/<h[1-6][^>]*>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<p[^>]*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  text = decodeHtmlEntities(text)
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return {
    title,
    text,
  };
}

function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x2F;/gi, "/");
}
