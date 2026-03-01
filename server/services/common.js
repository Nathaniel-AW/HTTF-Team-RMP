import crypto from "crypto";

export function cleanString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function toNullableNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const stripped = value.replace(/%/g, "").trim();
    if (!stripped) {
      return null;
    }

    const parsed = Number.parseFloat(stripped);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function toNullableInteger(value) {
  const parsed = toNullableNumber(value);
  if (parsed === null) {
    return null;
  }

  return Math.round(parsed);
}

export function normalizePercent(value) {
  const parsed = toNullableNumber(value);
  if (parsed === null) {
    return null;
  }

  const asPercent = parsed <= 1 ? parsed * 100 : parsed;
  return clampNumber(asPercent, 0, 100);
}

export function average(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  const sum = values.reduce((accumulator, value) => accumulator + value, 0);
  return Number((sum / values.length).toFixed(1));
}

export function clampNumber(value, min, max) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.min(max, Math.max(min, numericValue));
}

export function truncateText(value, maxLength) {
  const text = String(value ?? "").trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

export function truncateWords(value, maxWords) {
  const words = String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length <= maxWords) {
    return words.join(" ");
  }

  return `${words.slice(0, maxWords).join(" ")}...`;
}

export function parseJsonObject(content) {
  if (typeof content !== "string") {
    return null;
  }

  const trimmed = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/, "")
    .trim();

  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const firstCurly = trimmed.indexOf("{");
    const lastCurly = trimmed.lastIndexOf("}");
    if (firstCurly < 0 || lastCurly <= firstCurly) {
      return null;
    }

    try {
      return JSON.parse(trimmed.slice(firstCurly, lastCurly + 1));
    } catch {
      return null;
    }
  }
}

export function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags
      .map((tag) => cleanString(tag))
      .filter(Boolean)
      .slice(0, 12);
  }

  if (typeof tags === "string") {
    return tags
      .split(/[|,;]+/)
      .map((tag) => cleanString(tag))
      .filter(Boolean)
      .slice(0, 12);
  }

  return [];
}

export function parseCsv(content) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          value += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(value);
      value = "";
      continue;
    }

    if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    if (char !== "\r") {
      value += char;
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  return rows.filter((parsedRow) =>
    parsedRow.some((cell) => cleanString(cell) !== null),
  );
}

export function sha256(value) {
  return crypto.createHash("sha256").update(String(value ?? "")).digest("hex");
}

export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i += 1) {
    const av = Number(a[i]) || 0;
    const bv = Number(b[i]) || 0;
    dot += av * bv;
    magA += av * av;
    magB += bv * bv;
  }

  const denominator = Math.sqrt(magA) * Math.sqrt(magB);
  if (denominator === 0) {
    return 0;
  }

  return dot / denominator;
}

export function tokenize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}
