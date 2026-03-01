/* global process */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { cleanString } from "./common.js";

const serviceDirectory = fileURLToPath(new URL(".", import.meta.url));
dotenv.config({ path: path.resolve(serviceDirectory, "../../.env") });

const DEFAULT_MAX_RESULTS = 10;
const SEARCH_TIMEOUT_MS = 9000;
const GENERIC_WARNING = "External enrichment unavailable right now.";

const BLOCKED_DOMAINS = new Set([
  "ratemyprofessors.com",
  "www.ratemyprofessors.com",
  "facebook.com",
  "www.facebook.com",
  "instagram.com",
  "www.instagram.com",
  "linkedin.com",
  "www.linkedin.com",
  "youtube.com",
  "www.youtube.com",
]);

export function isExternalEnrichmentEnabled() {
  return Boolean(process.env.SEARCH_API_KEY && process.env.SEARCH_ENGINE_ID);
}

export async function searchExternalSources({ name, school, department, maxResults = DEFAULT_MAX_RESULTS }) {
  if (!isExternalEnrichmentEnabled()) {
    return {
      items: [],
      warning: buildWarning("missing SEARCH_API_KEY or SEARCH_ENGINE_ID configuration"),
    };
  }

  const searchApiKey = process.env.SEARCH_API_KEY;
  const searchEngineId = process.env.SEARCH_ENGINE_ID;

  const queries = buildQueries({ name, school, department });
  const urlSeen = new Set();
  const results = [];
  let firstFailureDetail = "";

  for (const query of queries) {
    if (results.length >= maxResults) {
      break;
    }

    const endpoint = new URL("https://www.googleapis.com/customsearch/v1");
    endpoint.searchParams.set("key", searchApiKey);
    endpoint.searchParams.set("cx", searchEngineId);
    endpoint.searchParams.set("q", query);
    endpoint.searchParams.set("num", "10");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
      const response = await fetch(endpoint, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (!firstFailureDetail) {
          firstFailureDetail = await describeSearchHttpFailure(response);
        }
        continue;
      }

      const payload = await response.json();
      const items = Array.isArray(payload.items) ? payload.items : [];

      for (const item of items) {
        const link = cleanString(item?.link);
        if (!link || urlSeen.has(link)) {
          continue;
        }

        const candidate = toSearchItem(item);
        if (!candidate) {
          continue;
        }

        urlSeen.add(candidate.url);
        results.push(candidate);

        if (results.length >= maxResults) {
          break;
        }
      }
    } catch (error) {
      if (!firstFailureDetail) {
        firstFailureDetail = describeSearchRuntimeFailure(error);
      }
      // Continue with remaining queries.
    }
  }

  const ranked = results
    .sort((a, b) => scoreDomain(b.domain) - scoreDomain(a.domain))
    .slice(0, maxResults);

  return {
    items: ranked,
    warning: ranked.length ? "" : buildWarning(firstFailureDetail),
  };
}

function buildQueries({ name, school, department }) {
  const safeName = cleanString(name) ?? "";
  const safeSchool = cleanString(school) ?? "";
  const safeDepartment = cleanString(department) ?? "";

  const parts = [];
  if (safeSchool && safeSchool !== "Unknown School") {
    parts.push(`"${safeSchool}"`);
  }
  if (safeDepartment && safeDepartment !== "Unknown") {
    parts.push(`"${safeDepartment}"`);
  }

  return [
    `"${safeName}" ${parts.join(" ")} faculty profile`,
    `"${safeName}" ${parts.join(" ")} site:.edu`,
    `"${safeName}" awards honors`,
    `"${safeName}" publications books`,
  ].map((query) => query.trim());
}

function toSearchItem(item) {
  const url = cleanString(item?.link);
  if (!url) {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const domain = parsed.hostname.toLowerCase();
  if (BLOCKED_DOMAINS.has(domain)) {
    return null;
  }

  return {
    url,
    title: cleanString(item?.title) ?? domain,
    snippet: cleanString(item?.snippet) ?? "",
    domain,
  };
}

function scoreDomain(domain) {
  if (!domain) {
    return 0;
  }

  if (domain.endsWith(".edu")) {
    return 100;
  }

  if (domain.includes("wikipedia.org")) {
    return 40;
  }

  if (domain.includes("springer") || domain.includes("ieee") || domain.includes("acm")) {
    return 45;
  }

  if (domain.includes("news")) {
    return 25;
  }

  return 20;
}

function buildWarning(detail) {
  if (!detail) {
    return GENERIC_WARNING;
  }

  const normalized = cleanString(detail) ?? "";
  if (!normalized) {
    return GENERIC_WARNING;
  }

  const punctuated = /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
  return `External enrichment unavailable: ${punctuated}`;
}

async function describeSearchHttpFailure(response) {
  const status = response.status;
  const apiMessage = await extractApiErrorMessage(response);
  const safeApiMessage = apiMessage ? ` ${apiMessage}` : "";

  if (status === 400) {
    return `Google Custom Search rejected the request (HTTP 400). Check SEARCH_ENGINE_ID and query config.${safeApiMessage}`;
  }

  if (status === 403) {
    return `Google Custom Search denied the request (HTTP 403). Check API key permissions, billing, and CSE settings.${safeApiMessage}`;
  }

  if (status === 429) {
    return `Google Custom Search quota was exceeded (HTTP 429).${safeApiMessage}`;
  }

  if (status >= 500) {
    return `Google Custom Search returned a server error (HTTP ${status}).`;
  }

  return `Google Custom Search returned HTTP ${status}.${safeApiMessage}`;
}

async function extractApiErrorMessage(response) {
  try {
    const rawBody = await response.text();
    if (!rawBody) {
      return "";
    }

    const parsed = JSON.parse(rawBody);
    const message = cleanString(parsed?.error?.message) ?? "";
    if (!message) {
      return "";
    }

    return truncateDiagnosticMessage(message, 140);
  } catch {
    return "";
  }
}

function describeSearchRuntimeFailure(error) {
  if (!error) {
    return "unknown search failure";
  }

  const causeCode =
    (error && typeof error === "object" && "cause" in error && error.cause && typeof error.cause === "object"
      ? error.cause.code
      : "") || "";
  const directCode = (error && typeof error === "object" && "code" in error ? error.code : "") || "";
  const code = String(causeCode || directCode || "").toUpperCase();
  const message = String(error instanceof Error ? error.message : error).toLowerCase();

  if (code === "ENOTFOUND" || message.includes("enotfound")) {
    return "unable to resolve www.googleapis.com (DNS/network error)";
  }

  if (
    code === "ETIMEDOUT" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    message.includes("timed out") ||
    message.includes("timeout")
  ) {
    return "Google Custom Search request timed out";
  }

  if (message.includes("aborted")) {
    return "Google Custom Search request timed out";
  }

  if (message.includes("fetch failed")) {
    return "could not reach Google Custom Search from this server";
  }

  return `search request failed (${truncateDiagnosticMessage(message, 120) || "unknown error"})`;
}

function truncateDiagnosticMessage(message, maxLength) {
  const normalized = cleanString(message) ?? "";
  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}
