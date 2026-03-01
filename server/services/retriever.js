import { cosineSimilarity, tokenize } from "./common.js";
import { embedTexts } from "./embeddings.js";

export async function retrieveTopChunks({
  openai,
  chunks,
  query,
  topK = 10,
  maxPerDomain = 3,
}) {
  if (!Array.isArray(chunks) || !chunks.length) {
    return [];
  }

  const [queryEmbedding] = await embedTexts({ openai, texts: [query] });
  const queryTerms = new Set(tokenize(query));

  const scored = chunks
    .map((chunk) => {
      const embeddingScore = Array.isArray(chunk.embedding)
        ? cosineSimilarity(queryEmbedding, chunk.embedding)
        : 0;
      const lexicalScore = lexicalOverlapScore(queryTerms, tokenize(chunk.chunkText));

      return {
        ...chunk,
        score: embeddingScore * 0.75 + lexicalScore * 0.25,
      };
    })
    .sort((a, b) => b.score - a.score);

  const selected = [];
  const perDomainCount = new Map();

  for (const item of scored) {
    const domain = item.sourceDomain || "unknown";
    const used = perDomainCount.get(domain) ?? 0;
    if (used >= maxPerDomain) {
      continue;
    }

    selected.push(item);
    perDomainCount.set(domain, used + 1);

    if (selected.length >= topK) {
      break;
    }
  }

  return selected;
}

function lexicalOverlapScore(queryTerms, documentTerms) {
  if (!queryTerms.size || !documentTerms.length) {
    return 0;
  }

  let hits = 0;
  for (const term of documentTerms) {
    if (queryTerms.has(term)) {
      hits += 1;
    }
  }

  return hits / Math.max(documentTerms.length, 1);
}
