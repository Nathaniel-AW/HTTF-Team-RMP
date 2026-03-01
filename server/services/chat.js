/* global process */
import { cleanString, parseJsonObject, truncateText } from "./common.js";
import { buildPromptContext } from "./rmpScraper.js";
import { retrieveTopChunks } from "./retriever.js";

const CHAT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const RAG_TOP_K = Number.parseInt(process.env.RAG_TOP_K ?? "10", 10);

export async function answerProfessorChat({
  openai,
  professorContext,
  externalChunks,
  citations,
  message,
  recentMessages = [],
}) {
  const trimmedMessage = cleanString(message);
  if (!trimmedMessage) {
    throw new Error("message is required");
  }

  if (!professorContext) {
    throw new Error("Professor context is missing");
  }

  const citationByUrl = new Map((citations ?? []).map((citation) => [citation.url, citation.id]));

  const retrieved = await retrieveTopChunks({
    openai,
    chunks: externalChunks ?? [],
    query: trimmedMessage,
    topK: Number.isFinite(RAG_TOP_K) && RAG_TOP_K > 0 ? RAG_TOP_K : 10,
  });

  const snippetPayload = retrieved.map((chunk) => ({
    citationId: citationByUrl.get(chunk.sourceUrl) ?? null,
    sourceTitle: chunk.sourceTitle,
    sourceDomain: chunk.sourceDomain,
    text: truncateText(chunk.chunkText, 460),
  }));

  if (!openai) {
    return {
      answer:
        "I cannot answer chat questions right now because the language model is unavailable.",
      citations: [],
    };
  }

  const normalizedMessages = Array.isArray(recentMessages)
    ? recentMessages
        .filter(
          (entry) =>
            entry &&
            (entry.role === "user" || entry.role === "assistant") &&
            typeof entry.content === "string",
        )
        .slice(-6)
        .map((entry) => ({
          role: entry.role,
          content: truncateText(entry.content, 1000),
        }))
    : [];

  try {
    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        {
          role: "system",
          content: [
            "You are a professor-review assistant.",
            "Answer questions using only provided review context and retrieved source snippets.",
            "Do not invent factual claims.",
            "When facts come from snippets, include citation IDs.",
            "Return strict JSON: {\"answer\":\"...\",\"citations\":[\"c1\",...]}.",
          ].join(" "),
        },
        {
          role: "system",
          content: JSON.stringify(
            {
              reviewContext: buildPromptContext(professorContext),
              retrievedSnippets: snippetPayload,
              allowedCitationIds: (citations ?? []).map((citation) => citation.id),
            },
            null,
            2,
          ),
        },
        ...normalizedMessages,
        {
          role: "user",
          content: trimmedMessage,
        },
      ],
      temperature: 0.2,
      max_tokens: 450,
      response_format: { type: "json_object" },
    });

    const rawContent = completion.choices?.[0]?.message?.content ?? "";
    const parsed = parseJsonObject(rawContent);

    const answer = cleanString(parsed?.answer) ||
      "I do not have enough data in the provided sources to answer that confidently.";

    const validCitationIds = new Set((citations ?? []).map((citation) => citation.id));
    const citationIds = Array.isArray(parsed?.citations)
      ? Array.from(
          new Set(
            parsed.citations
              .map((id) => cleanString(id))
              .filter((id) => id && validCitationIds.has(id)),
          ),
        )
      : [];

    return {
      answer,
      citations: citationIds,
    };
  } catch {
    return {
      answer:
        "I could not generate a grounded answer right now. Please try a more specific question about workload, grading, or verified achievements.",
      citations: [],
    };
  }
}
