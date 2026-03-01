/* global process */
import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { createProfessorRouter } from "./routes/professor.js";
import {
  extractCoursesFromReviews,
  loadReviewsForProfessorUrl,
  sanitizeChatMessages,
  sanitizeProfessorContext,
} from "./services/rmpScraper.js";
import { analyzeProfessorProfile } from "./services/analyzeProfessor.js";
import { answerProfessorChat } from "./services/chat.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const openaiKey = process.env.OPENAI_API_KEY;
const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

app.use("/api/professor", createProfessorRouter({ openai }));

app.post("/api/reviews/courses", async (req, res) => {
  const professorUrl = req.body?.professorUrl ?? req.body?.url ?? "";

  try {
    const loaded = await loadReviewsForProfessorUrl(professorUrl);
    const courses = extractCoursesFromReviews(loaded.reviews);

    return res.json({
      courses,
      totalReviews: loaded.reviews.length,
    });
  } catch (error) {
    return res.status(resolveStatusCode(error)).json({
      error: "Unable to fetch courses right now",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post(["/api/reviews/summary", "/api/summarize"], async (req, res) => {
  const professorUrl = req.body?.professorUrl ?? req.body?.url ?? req.body?.rmpUrl ?? "";
  const selectedCourses = Array.isArray(req.body?.selectedCourses)
    ? req.body.selectedCourses
    : [];

  try {
    const analysis = await analyzeProfessorProfile({
      openai,
      rmpUrl: professorUrl,
      selectedCourses,
    });

    return res.json({
      ...analysis,
      summary: analysis.summary,
      summaryParagraph: analysis.summaryParagraph,
      numericScore: analysis.numericScore,
      scoreExplanation: analysis.scoreExplanation,
      professorContext: analysis.professorContext,
      reviewsCount: analysis.reviewsCount,
    });
  } catch (error) {
    return res.status(resolveStatusCode(error)).json({
      error: "Unable to summarize reviews right now",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/chat", async (req, res) => {
  if (!openai) {
    return res.status(500).json({
      error: "OPENAI_API_KEY must be set before requesting chat",
    });
  }

  const messages = sanitizeChatMessages(req.body?.messages);
  const professorContext = sanitizeProfessorContext(req.body?.professorContext);

  if (!messages.length) {
    return res.status(400).json({
      error: "messages must include at least one message",
    });
  }

  if (!professorContext) {
    return res.status(400).json({
      error: "professorContext is missing or invalid",
    });
  }

  const latestUserMessage = [...messages].reverse().find((entry) => entry.role === "user");
  if (!latestUserMessage?.content) {
    return res.status(400).json({ error: "A user message is required" });
  }

  try {
    const response = await answerProfessorChat({
      openai,
      professorContext,
      externalChunks: [],
      citations: [],
      message: latestUserMessage.content,
      recentMessages: messages,
    });

    return res.json({ answer: response.answer, citations: [] });
  } catch (error) {
    return res.status(500).json({
      error: "Unable to answer chat question right now",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

const port = process.env.PORT ?? 4000;
app.listen(port, () => {
  console.log(`[server] listening on port ${port}`);
});

function resolveStatusCode(error) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("valid ratemyprofessors professor url")) {
    return 400;
  }
  if (message.includes("no reviews found")) {
    return 404;
  }
  return 500;
}
