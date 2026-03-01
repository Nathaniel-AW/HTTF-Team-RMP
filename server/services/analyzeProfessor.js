/* global process */
import {
  findProfessorById,
  getCachedAnalysisByRmpUrl,
  insertExternalChunks,
  insertExternalSources,
  isSupabaseConfigured,
  replaceProfessorReviews,
  saveProfessorOutput,
  upsertProfessorRecord,
} from "../db/supabase.js";
import { chunkExternalSources } from "./chunker.js";
import { embedTexts } from "./embeddings.js";
import { searchExternalSources, isExternalEnrichmentEnabled } from "./externalSearch.js";
import { generateProfessorAnalysis } from "./generator.js";
import { fetchAndSanitizeSources } from "./pageFetcher.js";
import { retrieveTopChunks } from "./retriever.js";
import {
  buildProfessorContext,
  extractCoursesFromReviews,
  filterReviewsBySelectedCourses,
  loadReviewsForProfessorUrl,
  normalizeRateMyProfUrl,
} from "./rmpScraper.js";
import {
  getRuntimeAnalysisByCacheKey,
  getRuntimeAnalysisByProfessorId,
  saveRuntimeAnalysis,
} from "./runtimeStore.js";

const CACHE_TTL_DAYS = Number.parseInt(process.env.CACHE_TTL_DAYS ?? "7", 10);
const RAG_TOP_K = Number.parseInt(process.env.RAG_TOP_K ?? "10", 10);

export async function analyzeProfessorProfile({ openai, rmpUrl, selectedCourses = [] }) {
  const normalizedUrl = normalizeRateMyProfUrl(rmpUrl);
  if (!normalizedUrl) {
    throw new Error(
      "Please provide a valid RateMyProfessors professor URL (example: https://www.ratemyprofessors.com/professor/3126905).",
    );
  }

  const normalizedCourses = Array.isArray(selectedCourses)
    ? selectedCourses.map((course) => String(course ?? "").trim()).filter(Boolean)
    : [];
  const cacheKey = `${normalizedUrl}::${normalizedCourses.sort().join("|")}`;

  const runtimeCached = getRuntimeAnalysisByCacheKey(cacheKey);
  if (runtimeCached) {
    return {
      ...runtimeCached.analysis,
      cached: true,
    };
  }

  if (!normalizedCourses.length) {
    const dbCached = await getCachedAnalysisByRmpUrl({
      rmpUrl: normalizedUrl,
      ttlDays: CACHE_TTL_DAYS,
    });

    if (dbCached?.professor && dbCached?.output) {
      let cachedContext = null;
      let cachedReviewsCount = 0;
      try {
        const cachedReviews = await loadReviewsForProfessorUrl(normalizedUrl);
        cachedContext = buildProfessorContext(cachedReviews.reviews);
        cachedReviewsCount = cachedContext.reviewCount;
      } catch {
        cachedContext = null;
        cachedReviewsCount = 0;
      }

      const payload = {
        professor: {
          id: dbCached.professor.id,
          name: dbCached.professor.name,
          school: dbCached.professor.school,
          department: dbCached.professor.department,
          lastRefreshed: dbCached.output.generated_at,
        },
        summary: dbCached.output.summary,
        score: {
          total: Number(dbCached.output.score_total ?? 0),
          reviews: Number(dbCached.output.score_reviews ?? 0),
          profile: Number(dbCached.output.score_profile ?? 0),
          weights: resolveWeightsFromEnv(),
          explanation: {
            reviews_component_reasoning: "Loaded from cached analysis.",
            profile_component_reasoning: "Loaded from cached analysis.",
          },
        },
        achievements: Array.isArray(dbCached.output.achievements_json)
          ? dbCached.output.achievements_json
          : [],
        citations: Array.isArray(dbCached.output.citations_json)
          ? dbCached.output.citations_json
          : [],
        warnings: [],
        enrichment: {
          enabled: true,
          warning: "",
          retrievedSources: 0,
          indexedChunks: 0,
        },
        professorContext: cachedContext,
        reviewsCount: cachedReviewsCount,
        summaryParagraph: dbCached.output.summary,
        numericScore: Number(dbCached.output.score_total ?? 0),
        scoreExplanation: "Loaded from cached analysis.",
        scoreBreakdown: {
          reviews: Number(dbCached.output.score_reviews ?? 0),
          profile: Number(dbCached.output.score_profile ?? 0),
          weights: resolveWeightsFromEnv(),
          explanation: {
            reviews_component_reasoning: "Loaded from cached analysis.",
            profile_component_reasoning: "Loaded from cached analysis.",
          },
        },
        externalEnrichmentWarning: "",
      };

      saveRuntimeAnalysis({
        professor: payload.professor,
        rmpUrl: normalizedUrl,
        cacheKey,
        professorContext: cachedContext,
        analysis: payload,
        externalChunks: [],
      });

      return {
        ...payload,
        cached: true,
      };
    }
  }

  const loaded = await loadReviewsForProfessorUrl(normalizedUrl);
  const filteredReviews = filterReviewsBySelectedCourses(loaded.reviews, normalizedCourses);

  if (!filteredReviews.length) {
    throw new Error("No reviews found for the selected courses");
  }

  const professorContext = buildProfessorContext(filteredReviews);
  if (!professorContext.reviewsSample.length) {
    throw new Error("No usable review content found for that professor");
  }

  const professorRecord =
    (await upsertProfessorRecord({
      name: professorContext.professorName,
      school: professorContext.schoolName,
      department: professorContext.department,
      rmpUrl: normalizedUrl,
    })) || {
      id: loaded.professorId,
      name: professorContext.professorName,
      school: professorContext.schoolName,
      department: professorContext.department,
      rmp_url: normalizedUrl,
    };

  await replaceProfessorReviews({
    professorId: professorRecord.id,
    reviews: professorContext.reviewsSample,
  });

  let enrichmentWarning = "";
  let searchCandidates = [];
  let fetchedSources = [];
  let chunkedSources = [];
  let retrievedChunks = [];

  if (isExternalEnrichmentEnabled()) {
    const searchResult = await searchExternalSources({
      name: professorContext.professorName,
      school: professorContext.schoolName,
      department: professorContext.department,
      maxResults: 10,
    });

    searchCandidates = Array.isArray(searchResult.items) ? searchResult.items : [];
    enrichmentWarning = searchResult.warning || "";

    fetchedSources = await fetchAndSanitizeSources(searchCandidates, {
      maxPages: 6,
      maxBytes: 200000,
    });

    const fetchedOnly = fetchedSources
      .filter((source) => source.status === "fetched")
      .map((source) => ({ ...source, professorId: professorRecord.id }));

    const persistedSources = await insertExternalSources({
      professorId: professorRecord.id,
      sources: fetchedOnly,
    });

    chunkedSources = chunkExternalSources(persistedSources, {
      chunkWords: 360,
      overlapWords: 70,
    });

    if (chunkedSources.length) {
      const embeddings = await embedTexts({
        openai,
        texts: chunkedSources.map((chunk) => chunk.chunkText),
      });

      chunkedSources = chunkedSources.map((chunk, index) => ({
        ...chunk,
        embedding: embeddings[index] ?? null,
      }));

      await insertExternalChunks({
        professorId: professorRecord.id,
        chunks: chunkedSources,
      });

      retrievedChunks = await retrieveTopChunks({
        openai,
        chunks: chunkedSources,
        query:
          "research area expertise appointments titles awards honors notable publications books leadership roles",
        topK: Number.isFinite(RAG_TOP_K) && RAG_TOP_K > 0 ? RAG_TOP_K : 10,
        maxPerDomain: 3,
      });
    }

    if (!retrievedChunks.length && !enrichmentWarning) {
      enrichmentWarning = buildPostSearchEnrichmentWarning({
        searchCandidates,
        fetchedSources,
        chunkedSources,
      });
    }
  } else {
    enrichmentWarning = "External enrichment unavailable: missing SEARCH_API_KEY or SEARCH_ENGINE_ID configuration.";
  }

  const generated = await generateProfessorAnalysis({
    openai,
    professorContext,
    retrievedChunks,
    enrichmentWarning,
  });

  await saveProfessorOutput({
    professorId: professorRecord.id,
    summary: generated.summary,
    score: generated.score,
    achievements: generated.achievements,
    citations: generated.citations,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  });

  const result = {
    professor: {
      id: professorRecord.id,
      name: professorRecord.name,
      school: professorRecord.school,
      department: professorRecord.department,
      lastRefreshed: new Date().toISOString(),
    },
    summary: generated.summary,
    summaryCitations: generated.summaryCitations,
    score: generated.score,
    achievements: generated.achievements,
    citations: generated.citations,
    warnings: generated.warnings,
    enrichment: {
      enabled: isExternalEnrichmentEnabled(),
      warning: enrichmentWarning,
      retrievedSources: fetchedSources.filter((source) => source.status === "fetched").length,
      indexedChunks: chunkedSources.length,
    },
    professorContext,
    reviewsCount: professorContext.reviewCount,

    // Compatibility fields for existing frontend consumers.
    summaryParagraph: generated.summary,
    numericScore: generated.score.total,
    scoreExplanation: `${generated.score.explanation.reviews_component_reasoning} ${generated.score.explanation.profile_component_reasoning}`,
    scoreBreakdown: {
      reviews: generated.score.reviews,
      profile: generated.score.profile,
      weights: generated.score.weights,
      explanation: generated.score.explanation,
    },
    externalEnrichmentWarning: enrichmentWarning,
    selectedCourses: normalizedCourses,
    availableCourses: extractCoursesFromReviews(loaded.reviews),
  };

  saveRuntimeAnalysis({
    professor: result.professor,
    rmpUrl: normalizedUrl,
    cacheKey,
    professorContext,
    analysis: result,
    externalChunks: chunkedSources,
  });

  return {
    ...result,
    cached: false,
  };
}

export async function resolveProfessorForChat(professorId) {
  const runtime = getRuntimeAnalysisByProfessorId(professorId);
  if (runtime) {
    return runtime;
  }

  const professor = await findProfessorById(professorId);
  if (!professor) {
    return null;
  }

  return {
    professor,
  };
}

function buildPostSearchEnrichmentWarning({ searchCandidates, fetchedSources, chunkedSources }) {
  if (!Array.isArray(searchCandidates) || !searchCandidates.length) {
    return "External enrichment unavailable: no eligible external sources were found.";
  }

  const fetchedOnly = Array.isArray(fetchedSources)
    ? fetchedSources.filter((source) => source.status === "fetched")
    : [];

  if (!fetchedOnly.length) {
    const detailedFetchFailure = summarizeFetchFailure(fetchedSources);
    if (detailedFetchFailure) {
      return `External enrichment unavailable: ${detailedFetchFailure}.`;
    }

    return "External enrichment unavailable: no external pages could be fetched.";
  }

  if (!Array.isArray(chunkedSources) || !chunkedSources.length) {
    return "External enrichment unavailable: fetched pages did not contain enough readable text to index.";
  }

  return "External enrichment unavailable right now.";
}

function summarizeFetchFailure(fetchedSources) {
  if (!Array.isArray(fetchedSources) || !fetchedSources.length) {
    return "";
  }

  const failed = fetchedSources.filter((source) => source.status === "failed");
  const blockedCount = fetchedSources.filter((source) => source.status === "blocked").length;

  if (!failed.length && blockedCount > 0) {
    return "all candidate pages were blocked due to unsupported content type";
  }

  if (!failed.length) {
    return "";
  }

  const normalizedErrors = failed
    .map((source) => String(source.error ?? "").trim())
    .filter(Boolean)
    .map((message) => message.toLowerCase());

  const topError = normalizedErrors[0] ?? "";

  if (topError.includes("enotfound")) {
    return "failed to fetch external pages due to DNS/network errors";
  }

  if (topError.includes("timed out") || topError.includes("timeout") || topError.includes("aborted")) {
    return "external page requests timed out";
  }

  if (topError.startsWith("http ")) {
    return `external pages returned ${topError.toUpperCase()}`;
  }

  return "failed to fetch external pages";
}

function resolveWeightsFromEnv() {
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

export function getAnalyzeCacheSettings() {
  return {
    cacheTtlDays: CACHE_TTL_DAYS,
    ragTopK: RAG_TOP_K,
    supabaseEnabled: isSupabaseConfigured(),
    externalSearchEnabled: isExternalEnrichmentEnabled(),
  };
}
