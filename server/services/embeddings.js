/* global process */
import { tokenize } from "./common.js";

const DEFAULT_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

export async function embedTexts({ openai, texts }) {
  if (!Array.isArray(texts) || !texts.length) {
    return [];
  }

  if (!openai) {
    return texts.map((text) => pseudoEmbedding(text));
  }

  try {
    const response = await openai.embeddings.create({
      model: DEFAULT_EMBEDDING_MODEL,
      input: texts,
    });

    const vectors = Array.isArray(response.data)
      ? response.data.map((entry) => entry.embedding)
      : [];

    if (!vectors.length || vectors.length !== texts.length) {
      throw new Error("Embedding provider returned invalid shape");
    }

    return vectors;
  } catch {
    return texts.map((text) => pseudoEmbedding(text));
  }
}

function pseudoEmbedding(text) {
  const dimensions = 64;
  const vector = Array.from({ length: dimensions }, () => 0);
  const tokens = tokenize(text);

  if (!tokens.length) {
    return vector;
  }

  for (const token of tokens) {
    const hash = simpleHash(token);
    const index = Math.abs(hash) % dimensions;
    vector[index] += 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

function simpleHash(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
