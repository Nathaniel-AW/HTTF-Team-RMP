/* global process */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import {
  average,
  cleanString,
  clampNumber,
  normalizePercent,
  normalizeTags,
  parseCsv,
  toNullableInteger,
  toNullableNumber,
  truncateText,
} from "./common.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RATE_MY_PROFESSORS_PATH_REGEX = /^\/professor\/\d+/;
export const MAX_CONTEXT_REVIEWS = 60;
export const MAX_REVIEW_TEXT_CHARS = 800;
export const MAX_PROMPT_REVIEW_TEXT_CHARS = 420;

export function normalizeRateMyProfUrl(value) {
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

export function getProfessorIdFromRmpUrl(url) {
  const normalized = normalizeRateMyProfUrl(url);
  if (!normalized) {
    return null;
  }
  return normalized.split("/").pop() ?? null;
}

export async function loadReviewsForProfessorUrl(professorUrl) {
  const normalizedUrl = normalizeRateMyProfUrl(professorUrl);
  if (!normalizedUrl) {
    throw new Error(
      "Please provide a valid RateMyProfessors professor URL (example: https://www.ratemyprofessors.com/professor/3126905).",
    );
  }

  const professorId = getProfessorIdFromRmpUrl(normalizedUrl);
  let reviews = await getReviewsFromLocalFile(professorId);
  if (!reviews) {
    const scraped = await runScraper(normalizedUrl);
    reviews = scraped.reviews;
  }

  if (!Array.isArray(reviews) || !reviews.length) {
    throw new Error("No reviews found for that professor");
  }

  return {
    normalizedUrl,
    professorId,
    reviews,
  };
}

export function filterReviewsBySelectedCourses(reviews, selectedCourses) {
  if (!Array.isArray(selectedCourses) || selectedCourses.length === 0) {
    return reviews;
  }

  const courseSet = new Set(
    selectedCourses
      .map((course) => cleanString(course))
      .filter(Boolean),
  );

  if (!courseSet.size) {
    return reviews;
  }

  return reviews.filter((review) => {
    const course = cleanString(review.course ?? review.courseName);
    return course && courseSet.has(course);
  });
}

export function extractCoursesFromReviews(reviews) {
  const coursesSet = new Set();
  (reviews ?? []).forEach((review) => {
    const course = cleanString(review.course ?? review.courseName);
    if (course) {
      coursesSet.add(course);
    }
  });

  return Array.from(coursesSet).sort();
}

async function getReviewsFromLocalFile(professorId) {
  const filePath = path.join(__dirname, "..", "..", "professor data", `${professorId}.csv`);

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
      cwd: path.resolve(__dirname, "..", ".."),
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

export function buildProfessorContext(rawReviews) {
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

export function sanitizeProfessorContext(inputContext) {
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

export function sanitizeChatMessages(messages) {
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

export function buildPromptContext(professorContext) {
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
