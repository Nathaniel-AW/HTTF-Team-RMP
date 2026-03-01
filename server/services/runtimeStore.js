const ANALYSIS_TTL_MS = 12 * 60 * 60 * 1000;

const byProfessorId = new Map();
const byRmpUrl = new Map();
const byCacheKey = new Map();

export function saveRuntimeAnalysis({
  professor,
  rmpUrl,
  cacheKey,
  professorContext,
  analysis,
  externalChunks,
}) {
  const now = Date.now();
  const entry = {
    professor,
    rmpUrl,
    professorContext,
    analysis,
    externalChunks,
    createdAt: now,
  };

  if (professor?.id) {
    byProfessorId.set(professor.id, entry);
  }

  if (rmpUrl) {
    byRmpUrl.set(rmpUrl, entry);
  }

  if (cacheKey) {
    byCacheKey.set(cacheKey, entry);
  }

  prune();
}

export function getRuntimeAnalysisByProfessorId(professorId) {
  prune();
  if (!professorId) {
    return null;
  }
  return byProfessorId.get(professorId) ?? null;
}

export function getRuntimeAnalysisByRmpUrl(rmpUrl) {
  prune();
  if (!rmpUrl) {
    return null;
  }
  return byRmpUrl.get(rmpUrl) ?? null;
}

export function getRuntimeAnalysisByCacheKey(cacheKey) {
  prune();
  if (!cacheKey) {
    return null;
  }
  return byCacheKey.get(cacheKey) ?? null;
}

function prune() {
  const now = Date.now();
  for (const [key, value] of byProfessorId.entries()) {
    if (now - value.createdAt > ANALYSIS_TTL_MS) {
      byProfessorId.delete(key);
    }
  }

  for (const [key, value] of byRmpUrl.entries()) {
    if (now - value.createdAt > ANALYSIS_TTL_MS) {
      byRmpUrl.delete(key);
    }
  }

  for (const [key, value] of byCacheKey.entries()) {
    if (now - value.createdAt > ANALYSIS_TTL_MS) {
      byCacheKey.delete(key);
    }
  }
}
