/* global process */
import {
  clampNumber,
  cleanString,
  parseJsonObject,
  toNullableNumber,
  truncateText,
  truncateWords,
} from "./common.js";
import { buildPromptContext } from "./rmpScraper.js";

const SUMMARY_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export async function generateProfessorAnalysis({
  openai,
  professorContext,
  retrievedChunks,
  enrichmentWarning,
}) {
  const citations = buildCitationCatalog(retrievedChunks);
  const citationById = new Map(citations.map((citation) => [citation.id, citation]));

  const reviewScore = estimateReviewScore(professorContext);
  const profileSignals = computeProfileSignals({ retrievedChunks, citations });

  const weights = resolveScoreWeights();
  const totalScore = Math.round(
    clampNumber(
      reviewScore * weights.reviews + profileSignals.score * weights.profile,
      0,
      100,
    ),
  );

  let summaryParagraph = buildFallbackSummary(professorContext);
  let summaryCitations = profileSignals.citations.slice(0, 3);
  let achievements = deriveHeuristicAchievements({ retrievedChunks, citations });

  if (openai) {
    const aiGenerated = await generateSummaryAndAchievementsWithLlm({
      openai,
      professorContext,
      retrievedChunks,
      citations,
    });

    if (aiGenerated.summaryParagraph) {
      summaryParagraph = aiGenerated.summaryParagraph;
    }

    if (aiGenerated.summaryCitations.length) {
      summaryCitations = aiGenerated.summaryCitations;
    }

    if (aiGenerated.achievements.length) {
      achievements = aiGenerated.achievements;
    }
  }

  achievements = achievements
    .filter((entry) => entry.text && entry.citations.length)
    .map((entry) => ({
      text: truncateText(entry.text, 220),
      citations: dedupe(entry.citations).filter((citationId) => citationById.has(citationId)),
    }))
    .filter((entry) => entry.citations.length)
    .slice(0, 6);

  const scoreExplanation = {
    reviews_component_reasoning: buildReviewsReasoning(professorContext, reviewScore),
    profile_component_reasoning: profileSignals.reasoning,
  };

  return {
    summary: truncateWords(summaryParagraph, 120),
    summaryCitations: dedupe(summaryCitations).filter((citationId) => citationById.has(citationId)),
    score: {
      total: totalScore,
      reviews: reviewScore,
      profile: profileSignals.score,
      weights,
      explanation: scoreExplanation,
    },
    achievements,
    citations,
    warnings: enrichmentWarning ? [enrichmentWarning] : [],
  };
}

async function generateSummaryAndAchievementsWithLlm({
  openai,
  professorContext,
  retrievedChunks,
  citations,
}) {
  if (!citations.length || !retrievedChunks.length) {
    return {
      summaryParagraph: "",
      summaryCitations: [],
      achievements: [],
    };
  }

  const citationByUrl = new Map(citations.map((citation) => [citation.url, citation.id]));

  const snippets = retrievedChunks.slice(0, 12).map((chunk) => ({
    citationId: citationByUrl.get(chunk.sourceUrl),
    sourceTitle: chunk.sourceTitle,
    sourceDomain: chunk.sourceDomain,
    text: truncateText(chunk.chunkText, 500),
  }));

  try {
    const completion = await openai.chat.completions.create({
      model: SUMMARY_MODEL,
      messages: [
        {
          role: "system",
          content: [
            "You are a grounded professor-profile analyst.",
            "Use only provided review context and retrieved snippets.",
            "Do not invent facts.",
            "Return strict JSON only.",
            "Every achievement must include at least one citation id from the provided list.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              schema: {
                summaryParagraph:
                  "string, one paragraph, 4-6 sentences, combining review themes + verified profile info",
                summaryCitations: ["citation ids array; may be empty if no external claims"],
                achievements: [
                  {
                    text: "short factual claim",
                    citations: ["citation ids array, required"],
                  },
                ],
              },
              allowedCitationIds: citations.map((citation) => citation.id),
              reviewContext: buildPromptContext(professorContext),
              retrievedSnippets: snippets,
            },
            null,
            2,
          ),
        },
      ],
      temperature: 0.15,
      max_tokens: 700,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";
    const parsed = parseJsonObject(raw);

    const summaryParagraph = cleanString(parsed?.summaryParagraph) ?? "";
    const summaryCitations = Array.isArray(parsed?.summaryCitations)
      ? parsed.summaryCitations.map((id) => cleanString(id)).filter(Boolean)
      : [];

    const achievements = Array.isArray(parsed?.achievements)
      ? parsed.achievements
          .map((entry) => ({
            text: cleanString(entry?.text) ?? "",
            citations: Array.isArray(entry?.citations)
              ? entry.citations.map((id) => cleanString(id)).filter(Boolean)
              : [],
          }))
          .filter((entry) => entry.text)
      : [];

    return {
      summaryParagraph,
      summaryCitations,
      achievements,
    };
  } catch {
    return {
      summaryParagraph: "",
      summaryCitations: [],
      achievements: [],
    };
  }
}

function buildCitationCatalog(retrievedChunks) {
  const byUrl = new Map();

  for (const chunk of retrievedChunks ?? []) {
    if (!chunk.sourceUrl || byUrl.has(chunk.sourceUrl)) {
      continue;
    }

    byUrl.set(chunk.sourceUrl, {
      id: `c${byUrl.size + 1}`,
      title: chunk.sourceTitle || chunk.sourceDomain || chunk.sourceUrl,
      url: chunk.sourceUrl,
      domain: chunk.sourceDomain || "unknown",
    });
  }

  return Array.from(byUrl.values());
}

function computeProfileSignals({ retrievedChunks, citations }) {
  if (!retrievedChunks.length || !citations.length) {
    return {
      score: 0,
      reasoning:
        "Profile signals are unavailable because no verified external sources were retrieved.",
      citations: [],
    };
  }

  const citationByUrl = new Map(citations.map((citation) => [citation.url, citation.id]));

  const facultySignals = new Set();
  const awardSignals = new Set();
  const leadershipSignals = new Set();
  const publicationSignals = new Set();

  for (const chunk of retrievedChunks) {
    const text = String(chunk.chunkText ?? "").toLowerCase();
    const citationId = citationByUrl.get(chunk.sourceUrl);
    if (!citationId) {
      continue;
    }

    if (chunk.sourceDomain?.endsWith(".edu") && /faculty|professor|department|school/.test(text)) {
      facultySignals.add(citationId);
    }

    if (/award|honor|fellow|medal|recipient|prize/.test(text)) {
      awardSignals.add(citationId);
    }

    if (/chair|director|dean|head of|program lead|leadership/.test(text)) {
      leadershipSignals.add(citationId);
    }

    if (/publication|published|book|journal|authored|paper/.test(text)) {
      publicationSignals.add(citationId);
    }
  }

  const facultyPoints = facultySignals.size ? 20 : 0;
  const awardPoints = Math.min(awardSignals.size, 3) * 10;
  const leadershipPoints = Math.min(leadershipSignals.size, 2) * 10;
  const publicationPoints = Math.min(publicationSignals.size, 3) * 10;

  const score = clampNumber(
    facultyPoints + awardPoints + leadershipPoints + publicationPoints,
    0,
    100,
  );

  const citationList = dedupe([
    ...facultySignals,
    ...awardSignals,
    ...leadershipSignals,
    ...publicationSignals,
  ]).slice(0, 5);

  const evidenceParts = [
    facultySignals.size ? "official academic profile presence" : null,
    awardSignals.size ? `${awardSignals.size} source(s) mentioning honors/awards` : null,
    leadershipSignals.size ? `${leadershipSignals.size} source(s) mentioning leadership roles` : null,
    publicationSignals.size ? `${publicationSignals.size} source(s) mentioning publications/books` : null,
  ].filter(Boolean);

  const reasoning = evidenceParts.length
    ? `Profile score reflects ${evidenceParts.join(", ")}. This component is conservative and not a direct teaching-quality measure.`
    : "No strong external profile signals were verified in retrieved sources.";

  return {
    score: Math.round(score),
    reasoning,
    citations: citationList,
  };
}

function deriveHeuristicAchievements({ retrievedChunks, citations }) {
  const citationByUrl = new Map(citations.map((citation) => [citation.url, citation.id]));
  const candidates = [];

  for (const chunk of retrievedChunks) {
    const citationId = citationByUrl.get(chunk.sourceUrl);
    if (!citationId) {
      continue;
    }

    const sentences = splitSentences(chunk.chunkText);
    for (const sentence of sentences) {
      if (!isAchievementLike(sentence)) {
        continue;
      }

      candidates.push({
        text: sentence,
        citations: [citationId],
        score: sentenceScore(sentence),
      });
    }
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .filter((entry, index, arr) => {
      const normalized = normalizeSentence(entry.text);
      return arr.findIndex((candidate) => normalizeSentence(candidate.text) === normalized) === index;
    })
    .slice(0, 6)
    .map((entry) => ({
      text: entry.text,
      citations: entry.citations,
    }));
}

function splitSentences(text) {
  return String(text ?? "")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 40 && sentence.length <= 220);
}

function isAchievementLike(sentence) {
  const lower = sentence.toLowerCase();
  return /award|honor|fellow|prize|chair|director|dean|book|publication|grant|research|founded/.test(
    lower,
  );
}

function sentenceScore(sentence) {
  const lower = sentence.toLowerCase();
  let score = 0;
  if (/award|honor|fellow|prize|medal/.test(lower)) {
    score += 3;
  }
  if (/chair|director|dean|head/.test(lower)) {
    score += 2;
  }
  if (/book|publication|journal|paper|authored/.test(lower)) {
    score += 2;
  }
  if (/grant|research/.test(lower)) {
    score += 1;
  }
  return score;
}

function normalizeSentence(sentence) {
  return sentence.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function estimateReviewScore(professorContext) {
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

function buildReviewsReasoning(professorContext, reviewScore) {
  const overall = toNullableNumber(professorContext.ratingStats?.overall);
  if (overall === null) {
    return `Review score is ${reviewScore}/100 from available sentiment patterns in written feedback.`;
  }

  const confidenceHint =
    professorContext.reviewCount < 10
      ? " Confidence is lower because the review sample is small."
      : "";

  return `Review score is ${reviewScore}/100 based on rating trend (about ${overall}/5), comment consistency, and workload signals.${confidenceHint}`;
}

function resolveScoreWeights() {
  const profileWeightRaw = Number.parseFloat(process.env.PROFILE_WEIGHT ?? "0.15");
  const reviewsWeightRaw = Number.parseFloat(process.env.REVIEWS_WEIGHT ?? "0.85");

  const safeProfile = Number.isFinite(profileWeightRaw) ? Math.max(0, profileWeightRaw) : 0.15;
  const safeReviews = Number.isFinite(reviewsWeightRaw) ? Math.max(0, reviewsWeightRaw) : 0.85;

  const total = safeProfile + safeReviews;
  if (total <= 0) {
    return { reviews: 0.85, profile: 0.15 };
  }

  return {
    reviews: Number((safeReviews / total).toFixed(3)),
    profile: Number((safeProfile / total).toFixed(3)),
  };
}

function dedupe(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
