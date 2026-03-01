/* global process */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const hasSupabase = Boolean(supabaseUrl && supabaseServiceRoleKey);

const supabase = hasSupabase
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

function logDbWarning(operation, error) {
  const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
  console.warn(`[Supabase:${operation}] ${message}`);
}

export function isSupabaseConfigured() {
  return Boolean(supabase);
}

export async function upsertProfessorRecord({ name, school, department, rmpUrl }) {
  if (!supabase) {
    return null;
  }

  try {
    const payload = {
      name,
      school: school || null,
      department: department || null,
      rmp_url: rmpUrl,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("professors")
      .upsert(payload, { onConflict: "rmp_url" })
      .select("id, name, school, department, rmp_url")
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    logDbWarning("upsertProfessorRecord", error);
    return null;
  }
}

export async function replaceProfessorReviews({ professorId, reviews }) {
  if (!supabase || !professorId || !Array.isArray(reviews)) {
    return;
  }

  try {
    await supabase.from("reviews").delete().eq("professor_id", professorId);

    if (!reviews.length) {
      return;
    }

    const rows = reviews.map((review) => ({
      professor_id: professorId,
      review_text: review.text,
      rating_overall: review.rating,
      rating_difficulty: review.difficulty,
    }));

    const { error } = await supabase.from("reviews").insert(rows);
    if (error) {
      throw error;
    }
  } catch (error) {
    logDbWarning("replaceProfessorReviews", error);
  }
}

export async function insertExternalSources({ professorId, sources }) {
  if (!supabase || !professorId || !Array.isArray(sources) || !sources.length) {
    return [];
  }

  try {
    const rows = sources.map((source) => ({
      professor_id: professorId,
      url: source.url,
      domain: source.domain,
      title: source.title || null,
      retrieved_at: source.retrievedAt,
      status: source.status || "fetched",
      content_hash: source.contentHash || null,
    }));

    const { data, error } = await supabase
      .from("external_sources")
      .insert(rows)
      .select("id, url");

    if (error) {
      throw error;
    }

    const idMap = new Map((data ?? []).map((row) => [row.url, row.id]));
    return sources.map((source) => ({
      ...source,
      sourceId: idMap.get(source.url) ?? null,
    }));
  } catch (error) {
    logDbWarning("insertExternalSources", error);
    return sources.map((source) => ({ ...source, sourceId: null }));
  }
}

export async function insertExternalChunks({ professorId, chunks }) {
  if (!supabase || !professorId || !Array.isArray(chunks) || !chunks.length) {
    return;
  }

  try {
    const rows = chunks.map((chunk) => ({
      source_id: chunk.sourceId || null,
      professor_id: professorId,
      chunk_index: chunk.chunkIndex,
      chunk_text: chunk.chunkText,
      embedding: Array.isArray(chunk.embedding) ? chunk.embedding : null,
    }));

    const { error } = await supabase.from("external_chunks").insert(rows);
    if (error) {
      throw error;
    }
  } catch (error) {
    logDbWarning("insertExternalChunks", error);
  }
}

export async function saveProfessorOutput({
  professorId,
  summary,
  score,
  achievements,
  citations,
  model,
}) {
  if (!supabase || !professorId) {
    return null;
  }

  try {
    const payload = {
      professor_id: professorId,
      summary,
      score_total: score.total,
      score_reviews: score.reviews,
      score_profile: score.profile,
      achievements_json: achievements,
      citations_json: citations,
      model,
      generated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("professor_outputs")
      .insert(payload)
      .select("id, generated_at")
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    logDbWarning("saveProfessorOutput", error);
    return null;
  }
}

export async function getCachedAnalysisByRmpUrl({ rmpUrl, ttlDays }) {
  if (!supabase || !rmpUrl) {
    return null;
  }

  try {
    const { data: professor, error: professorError } = await supabase
      .from("professors")
      .select("id, name, school, department, rmp_url")
      .eq("rmp_url", rmpUrl)
      .maybeSingle();

    if (professorError) {
      throw professorError;
    }

    if (!professor?.id) {
      return null;
    }

    const threshold = new Date();
    threshold.setDate(threshold.getDate() - Math.max(1, Number(ttlDays) || 7));

    const { data: output, error: outputError } = await supabase
      .from("professor_outputs")
      .select("id, summary, score_total, score_reviews, score_profile, achievements_json, citations_json, generated_at")
      .eq("professor_id", professor.id)
      .gte("generated_at", threshold.toISOString())
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (outputError) {
      throw outputError;
    }

    if (!output) {
      return null;
    }

    return {
      professor,
      output,
    };
  } catch (error) {
    logDbWarning("getCachedAnalysisByRmpUrl", error);
    return null;
  }
}

export async function findProfessorById(professorId) {
  if (!supabase || !professorId) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("professors")
      .select("id, name, school, department, rmp_url")
      .eq("id", professorId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ?? null;
  } catch (error) {
    logDbWarning("findProfessorById", error);
    return null;
  }
}

export async function getLatestProfessorOutputByProfessorId(professorId) {
  if (!supabase || !professorId) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("professor_outputs")
      .select("summary, score_total, score_reviews, score_profile, achievements_json, citations_json, generated_at")
      .eq("professor_id", professorId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ?? null;
  } catch (error) {
    logDbWarning("getLatestProfessorOutputByProfessorId", error);
    return null;
  }
}
