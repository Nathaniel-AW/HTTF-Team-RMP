import { Router } from "express";
import {
  findProfessorById,
  getLatestProfessorOutputByProfessorId,
} from "../db/supabase.js";
import { analyzeProfessorProfile } from "../services/analyzeProfessor.js";
import { answerProfessorChat } from "../services/chat.js";
import { getRuntimeAnalysisByProfessorId } from "../services/runtimeStore.js";
import { buildProfessorContext, loadReviewsForProfessorUrl } from "../services/rmpScraper.js";

export function createProfessorRouter({ openai }) {
  const router = Router();

  router.post("/analyze", async (req, res) => {
    const rmpUrl = req.body?.rmpUrl ?? req.body?.professorUrl ?? req.body?.url ?? "";
    const selectedCourses = Array.isArray(req.body?.selectedCourses)
      ? req.body.selectedCourses
      : [];

    try {
      const analysis = await analyzeProfessorProfile({
        openai,
        rmpUrl,
        selectedCourses,
      });

      return res.json(analysis);
    } catch (error) {
      const statusCode = resolveStatusCode(error);
      return res.status(statusCode).json({
        error: "Unable to analyze professor right now",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.post("/chat", async (req, res) => {
    const professorId = String(req.body?.professorId ?? "").trim();
    const message = String(req.body?.message ?? "").trim();
    const recentMessages = Array.isArray(req.body?.recentMessages)
      ? req.body.recentMessages
      : [];

    if (!professorId) {
      return res.status(400).json({ error: "professorId is required" });
    }

    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    try {
      const runtime = getRuntimeAnalysisByProfessorId(professorId);
      if (runtime?.professorContext) {
        const response = await answerProfessorChat({
          openai,
          professorContext: runtime.professorContext,
          externalChunks: runtime.externalChunks ?? [],
          citations: runtime.analysis?.citations ?? [],
          message,
          recentMessages,
        });

        const citedSources = (runtime.analysis?.citations ?? []).filter((citation) =>
          response.citations.includes(citation.id),
        );

        return res.json({
          answer: response.answer,
          citations: citedSources,
        });
      }

      const latestOutput = await getLatestProfessorOutputByProfessorId(professorId);
      if (!latestOutput) {
        return res.status(404).json({
          error: "No analysis context found for this professor. Analyze first.",
        });
      }

      const professor = await findProfessorById(professorId);
      if (!professor?.rmp_url) {
        return res.json({
          answer:
            "I need a fresh analysis run before I can provide grounded chat answers with citations. Please re-run professor analysis first.",
          citations: Array.isArray(latestOutput.citations_json)
            ? latestOutput.citations_json.slice(0, 3)
            : [],
        });
      }

      const loaded = await loadReviewsForProfessorUrl(professor.rmp_url);
      const professorContext = buildProfessorContext(loaded.reviews);

      const response = await answerProfessorChat({
        openai,
        professorContext,
        externalChunks: [],
        citations: Array.isArray(latestOutput.citations_json)
          ? latestOutput.citations_json
          : [],
        message,
        recentMessages,
      });

      const fallbackCitations = Array.isArray(latestOutput.citations_json)
        ? latestOutput.citations_json
        : [];

      return res.json({
        answer: response.answer,
        citations: fallbackCitations.filter((citation) =>
          response.citations.includes(citation.id),
        ),
      });
    } catch (error) {
      return res.status(500).json({
        error: "Unable to answer chat question right now",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}

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
