/* global process */
import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { promises as fs } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const openaiKey = process.env.OPENAI_API_KEY;
const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

const RATE_MY_PROFESSORS_PATH_REGEX = /^\/professor\/\d+/;
const MAX_CONTEXT_REVIEWS = 60;
const MAX_REVIEW_TEXT_CHARS = 800;
const MAX_PROMPT_REVIEW_TEXT_CHARS = 420;

app.post(["/api/reviews/summary", "/api/summarize"], async (req, res) => {
  const normalizedUrl = normalizeRateMyProfUrl(
    req.body?.professorUrl ?? req.body?.url ?? "",
  );

  if (!normalizedUrl) {
    return res.status(400).json({
      error:
        "Please provide a valid RateMyProfessors professor URL (example: https://www.ratemyprofessors.com/professor/3126905).",
    });
  }

  if (!openai) {
    return res
      .status(500)
      .json({ error: "OPENAI_API_KEY must be set before requesting a summary" });
  }

  try {
    const professorId = normalizedUrl.split("/").pop();

    let reviews = await getReviewsFromLocalFile(professorId);
    if (!reviews) {
      const { reviews: scrapedReviews } = await runScraper(normalizedUrl);
      reviews = scrapedReviews;
    }

    if (!Array.isArray(reviews) || reviews.length === 0) {
      return res.status(404).json({ error: "No reviews found for that professor" });
    }

    const professorContext = buildProfessorContext(reviews);
    if (!professorContext.reviewsSample.length) {
      return res.status(404).json({
        error: "No usable review content found for that professor",
      });
    }

    const summaryScoreResult = await summarizeAndScoreReviews(professorContext);

    return res.json({
      ...summaryScoreResult,
      professorContext,
      summary: summaryScoreResult.summaryParagraph,
      reviewsCount: professorContext.reviewCount,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Unable to summarize reviews right now",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/chat", async (req, res) => {
  if (!openai) {
    return res
      .status(500)
      .json({ error: "OPENAI_API_KEY must be set before requesting chat" });
  }

  const messages = sanitizeChatMessages(req.body?.messages);
  if (!messages.length) {
    return res.status(400).json({ error: "messages must include at least one message" });
  }

  const professorContext = sanitizeProfessorContext(req.body?.professorContext);
  if (!professorContext) {
    return res.status(400).json({ error: "professorContext is missing or invalid" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: [
            "You are a professor-review assistant.",
            "Answer questions using only the provided professor context.",
            "If context is missing for a question, clearly say you do not have enough data.",
            "Do not invent facts, numbers, courses, or policies.",
            "Keep answers concise and grounded, for example: 'Several reviews mention...'.",
          ].join(" "),
        },
        {
          role: "system",
          content: `Professor context:\n${JSON.stringify(
            buildPromptContext(professorContext),
            null,
            2,
          )}`,
        },
        ...messages,
      ],
      temperature: 0.2,
      max_tokens: 500,
    });

    const answer = completion.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      throw new Error("Chat model returned an empty answer");
    }

    return res.json({ answer });
  } catch (error) {
    return res.status(500).json({
      error: "Unable to answer chat question right now",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

function normalizeRateMyProfUrl(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }

  const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  const isAllowedHost =
    hostname === "ratemyprofessors.com" ||
    hostname === "www.ratemyprofessors.com";
  if (!isAllowedHost) {
    return null;
  }

  if (!RATE_MY_PROFESSORS_PATH_REGEX.test(parsed.pathname)) {
    return null;
  }

  return parsed.toString();
}

const port = process.env.PORT ?? 4000;
app.listen(port);

async function getReviewsFromLocalFile(professorId) {
  const filePath = path.join(__dirname, "..", "professor data", `${professorId}.csv`);

  try {
    const csvContent = await fs.readFile(filePath, "utf-8");
    const rows = parseCsv(csvContent);
    if (rows.length < 2) {
      return null;
    }

    const headers = rows[0].map((header) => String(header ?? "").trim());
    const reviews = [];

    for (let i = 1; i < rows.length; i += 1) {
      const values = rows[i];
      const review = {};
      headers.forEach((header, idx) => {
        review[header] = cleanString(values[idx]) ?? values[idx] ?? null;
      });

      if (Object.values(review).some((value) => value !== null && String(value).trim())) {
        reviews.push(review);
      }
    }

    return reviews.length ? reviews : null;
  } catch {
    return null;
  }
}

function runScraper(url) {
  return new Promise((resolve, reject) => {
    const pythonArgs = ["RMPScraper.py", "--url", url, "--json"];
    const pythonCmd = process.platform === "win32" ? "python" : "python3";

    const scraper = spawn(pythonCmd, pythonArgs, {
      cwd: path.resolve(__dirname, ".."),
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    scraper.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    scraper.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    scraper.on("error", (err) => {
      reject(new Error(`Unable to start scraper process: ${err.message}`));
    });

    scraper.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`Scraper exited with code ${code}: ${stderr}`));
      }

      try {
        const reviews = JSON.parse(stdout);
        if (!Array.isArray(reviews)) {
          throw new Error("Scraper returned invalid data");
        }

        return resolve({ reviews });
      } catch (parseError) {
        return reject(new Error(`Failed to parse scraper output: ${parseError.message}`));
      }
    });
  });
}

function buildProfessorContext(rawReviews) {
  const normalizedReviews = (rawReviews ?? [])
    .map((review) => normalizeReview(review))
    .filter(Boolean);

  const overallRatings = normalizedReviews
    .map((review) => review.rating)
    .filter((rating) => rating !== null);
  const difficultyRatings = normalizedReviews
    .map((review) => review.difficulty)
    .filter((difficulty) => difficulty !== null);
  const wouldTakeAgainValues = (rawReviews ?? [])
    .map((review) => normalizePercent(review?.wouldTakeAgain ?? review?.would_take_again))
    .filter((value) => value !== null);

  return {
    professorName:
      pickFirstString(rawReviews, ["professor_name", "professorName", "name"]) ??
      "Unknown Professor",
    schoolName:
      pickFirstString(rawReviews, ["school", "school_name", "schoolName"]) ??
      "Unknown School",
    department:
      pickFirstString(rawReviews, ["department", "subject", "major"]) ?? "Unknown",
    ratingStats: {
      overall: average(overallRatings),
      difficulty: average(difficultyRatings),
      wouldTakeAgain: average(wouldTakeAgainValues),
    },
    reviewCount: normalizedReviews.length,
    reviewsSample: normalizedReviews.slice(0, MAX_CONTEXT_REVIEWS).map((review) => ({
      date: review.date,
      rating: review.rating,
      difficulty: review.difficulty,
      tags: review.tags,
      text: review.text,
    })),
  };
}

function normalizeReview(review) {
  if (!review || typeof review !== "object") {
    return null;
  }

  const course = cleanString(review.course ?? review.courseName);
  const rating = toNullableNumber(review.rating ?? review.overallRating);
  const difficulty = toNullableNumber(review.difficulty ?? review.levelOfDifficulty);
  const rawText = cleanString(
    review.comment ?? review.text ?? review.review ?? review.reviewText,
  );

  const text =
    rawText ??
    [
      course ? `Course: ${course}.` : null,
      rating !== null ? `Rating: ${rating}/5.` : null,
      "No written comment provided.",
    ]
      .filter(Boolean)
      .join(" ");

  return {
    date: cleanString(review.date ?? review.reviewDate),
    rating: rating === null ? null : clampNumber(rating, 0, 5),
    difficulty: difficulty === null ? null : clampNumber(difficulty, 0, 5),
    tags: normalizeTags(review.tags),
    text: truncateText(text, MAX_REVIEW_TEXT_CHARS),
  };
}

async function summarizeAndScoreReviews(professorContext) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: [
          "You analyze RateMyProfessors data and return strict JSON only.",
          "Return this exact schema:",
          '{ "summaryParagraph": "string", "numericScore": 0, "scoreExplanation": "string" }',
          "Rules:",
          "summaryParagraph must be one paragraph and at most 120 words.",
          "numericScore must be an integer from 0 to 100 representing student usefulness based on sentiment and consistency.",
          "scoreExplanation must be 1-2 sentences.",
          "Use only the provided data and do not invent details.",
          "If review sample size is small (<10), mention limited confidence in scoreExplanation.",
        ].join(" "),
      },
      {
        role: "user",
        content: `Professor context:\n${JSON.stringify(
          buildPromptContext(professorContext),
          null,
          2,
        )}`,
      },
    ],
    temperature: 0.2,
    max_tokens: 450,
    response_format: { type: "json_object" },
  });

  const rawContent = completion.choices?.[0]?.message?.content ?? "";
  const parsed = parseJsonObject(rawContent);
  return normalizeSummaryScore(parsed, professorContext);
}

function sanitizeProfessorContext(inputContext) {
  if (!inputContext || typeof inputContext !== "object") {
    return null;
  }

  const normalizedReviewSample = Array.isArray(inputContext.reviewsSample)
    ? inputContext.reviewsSample
        .map((review) => normalizeContextReview(review))
        .filter(Boolean)
        .slice(0, MAX_CONTEXT_REVIEWS)
    : [];

  if (!normalizedReviewSample.length) {
    return null;
  }

  return {
    professorName: cleanString(inputContext.professorName) ?? "Unknown Professor",
    schoolName: cleanString(inputContext.schoolName) ?? "Unknown School",
    department: cleanString(inputContext.department) ?? "Unknown",
    ratingStats: {
      overall: toNullableNumber(inputContext.ratingStats?.overall),
      difficulty: toNullableNumber(inputContext.ratingStats?.difficulty),
      wouldTakeAgain: normalizePercent(inputContext.ratingStats?.wouldTakeAgain),
    },
    reviewCount:
      toNullableInteger(inputContext.reviewCount) ?? normalizedReviewSample.length,
    reviewsSample: normalizedReviewSample,
  };
}

function normalizeContextReview(review) {
  if (!review || typeof review !== "object") {
    return null;
  }

  const text = cleanString(review.text);
  if (!text) {
    return null;
  }

  return {
    date: cleanString(review.date),
    rating: toNullableNumber(review.rating),
    difficulty: toNullableNumber(review.difficulty),
    tags: normalizeTags(review.tags),
    text: truncateText(text, MAX_REVIEW_TEXT_CHARS),
  };
}

function sanitizeChatMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter(
      (message) =>
        message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string",
    )
    .map((message) => ({
      role: message.role,
      content: truncateText(message.content.trim(), 2000),
    }))
    .filter((message) => message.content.length > 0)
    .slice(-20);
}

function buildPromptContext(professorContext) {
  return {
    professorName: professorContext.professorName,
    schoolName: professorContext.schoolName,
    department: professorContext.department,
    ratingStats: professorContext.ratingStats,
    reviewCount: professorContext.reviewCount,
    reviewsSample: professorContext.reviewsSample
      .slice(0, MAX_CONTEXT_REVIEWS)
      .map((review) => ({
        date: review.date,
        rating: review.rating,
        difficulty: review.difficulty,
        tags: review.tags,
        text: truncateText(review.text, MAX_PROMPT_REVIEW_TEXT_CHARS),
      })),
  };
}

function parseJsonObject(content) {
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

function normalizeSummaryScore(rawResult, professorContext) {
  const fallbackScore = estimateScore(professorContext);

  const parsedScore = toNullableInteger(rawResult?.numericScore);
  const numericScore = clampNumber(
    parsedScore === null ? fallbackScore : parsedScore,
    0,
    100,
  );

  const fallbackSummary = buildFallbackSummary(professorContext);
  const rawSummary = cleanString(rawResult?.summaryParagraph);
  const summaryParagraph = truncateWords(rawSummary ?? fallbackSummary, 120);

  const fallbackExplanation = buildFallbackScoreExplanation(
    professorContext,
    numericScore,
  );
  const rawExplanation = cleanString(rawResult?.scoreExplanation);
  let scoreExplanation = rawExplanation ?? fallbackExplanation;

  if (
    professorContext.reviewCount < 10 &&
    !/limited|small|few|confidence|sample/i.test(scoreExplanation)
  ) {
    scoreExplanation = `${scoreExplanation} Confidence is limited because the review sample is small.`;
  }

  return {
    summaryParagraph,
    numericScore,
    scoreExplanation: truncateText(scoreExplanation, 350),
  };
}

function estimateScore(professorContext) {
  const overall = toNullableNumber(professorContext.ratingStats?.overall);
  if (overall === null) {
    return 50;
  }

  const difficulty = toNullableNumber(professorContext.ratingStats?.difficulty);
  let estimated = (overall / 5) * 100;

  if (difficulty !== null && difficulty > 3.8) {
    estimated -= 6;
  } else if (difficulty !== null && difficulty < 2.2) {
    estimated += 3;
  }

  return Math.round(clampNumber(estimated, 0, 100));
}

function buildFallbackSummary(professorContext) {
  const name = professorContext.professorName || "This professor";
  const overall = toNullableNumber(professorContext.ratingStats?.overall);
  const difficulty = toNullableNumber(professorContext.ratingStats?.difficulty);
  const reviewCount = professorContext.reviewCount;

  const sentiment =
    overall === null
      ? "mixed"
      : overall >= 4.2
        ? "mostly positive"
        : overall >= 3.2
          ? "mixed to positive"
          : "mixed to negative";

  const difficultyText =
    difficulty === null
      ? "Workload and difficulty comments vary by course."
      : difficulty >= 3.7
        ? "Many reviews suggest the workload can feel heavy."
        : difficulty <= 2.3
          ? "Many reviews describe the workload as manageable."
          : "Reviews describe moderate workload and difficulty.";

  return `${name} receives ${sentiment} feedback across ${reviewCount} reviews. Students frequently discuss teaching clarity, grading expectations, and course structure, with experiences varying by class and preparation level. ${difficultyText}`;
}

function buildFallbackScoreExplanation(professorContext, numericScore) {
  const overall = toNullableNumber(professorContext.ratingStats?.overall);
  if (overall === null) {
    return `The score is based on available review comments and overall sentiment patterns, resulting in ${numericScore}/100.`;
  }

  return `This ${numericScore}/100 score reflects review sentiment consistency and the average rating trend (about ${overall}/5). Higher consistency and stronger sentiment increase the score.`;
}

function pickFirstString(rows, fields) {
  if (!Array.isArray(rows)) {
    return null;
  }

  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }

    for (const field of fields) {
      const value = cleanString(row[field]);
      if (value) {
        return value;
      }
    }
  }

  return null;
}

function normalizeTags(tags) {
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

function parseCsv(content) {
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

function cleanString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNullableNumber(value) {
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

function toNullableInteger(value) {
  const parsed = toNullableNumber(value);
  if (parsed === null) {
    return null;
  }

  return Math.round(parsed);
}

function normalizePercent(value) {
  const parsed = toNullableNumber(value);
  if (parsed === null) {
    return null;
  }

  const asPercent = parsed <= 1 ? parsed * 100 : parsed;
  return clampNumber(asPercent, 0, 100);
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  const sum = values.reduce((accumulator, value) => accumulator + value, 0);
  return Number((sum / values.length).toFixed(1));
}

function truncateText(value, maxLength) {
  const text = String(value ?? "").trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

function truncateWords(value, maxWords) {
  const words = String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length <= maxWords) {
    return words.join(" ");
  }

  return `${words.slice(0, maxWords).join(" ")}...`;
}

function clampNumber(value, min, max) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.min(max, Math.max(min, numericValue));
}
