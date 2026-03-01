import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const openaiKey = process.env.OPENAI_API_KEY;
const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;
const RATE_MY_PROFESSORS_PATH_REGEX = /^\/professor\/\d+/;

app.post("/api/reviews/summary", async (req, res) => {
  const normalizedUrl = normalizeRateMyProfUrl(req.body?.url ?? "");
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
    const { reviews } = await runScraper(normalizedUrl);
    if (!reviews.length) {
      return res.status(404).json({ error: "No reviews found for that professor" });
    }

    const summary = await summarizeReviews(reviews);
    return res.json({
      summary,
      reviewsCount: reviews.length,
    });
  } catch (error) {
    console.error("Failed to summarize reviews:", error);
    return res.status(500).json({
      error: "Unable to summarize reviews right now",
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
app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});

function runScraper(url) {
  return new Promise((resolve, reject) => {
    const pythonArgs = ["RMPScraper.py", "--url", url, "--json"];
    const scraper = spawn("python3", pythonArgs, {
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
        resolve({ reviews });
      } catch (parseError) {
        reject(new Error(`Failed to parse scraper output: ${parseError.message}`));
      }
    });
  });
}

async function summarizeReviews(reviews) {
  const pieces = reviews.slice(0, 40).map((review) => {
    const date = review.date ?? "Unknown Date";
    const course = review.course ?? "Unknown Course";
    const rating = review.rating ?? "N/A";
    const comment = review.comment ?? "No comment provided";
    return `(${date}) ${course} — ${rating} stars — "${comment}"`;
  });

  const userPrompt = [
    "You are summarizing RateMyProfessors reviews for a single professor.",
    "Deliver one concise paragraph that highlights the overall sentiment, recurring praises, the most common critiques, and any mentions of workload or course difficulty.",
    "Use the review excerpts below as context.",
    pieces.join("\n"),
  ].join("\n\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You summarize professor reviews into short paragraphs.",
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    temperature: 0.3,
    max_tokens: 350,
  });

  return completion.choices?.[0]?.message?.content?.trim() ?? "";
}
