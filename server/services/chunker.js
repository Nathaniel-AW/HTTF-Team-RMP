import { cleanString } from "./common.js";

export function chunkExternalSources(sources, options = {}) {
  const chunkWords = Number(options.chunkWords) > 0 ? Number(options.chunkWords) : 360;
  const overlapWords = Number(options.overlapWords) >= 0 ? Number(options.overlapWords) : 70;

  const chunks = [];

  for (const source of sources) {
    if (source.status !== "fetched" || !source.contentText) {
      continue;
    }

    const words = source.contentText.split(/\s+/).filter(Boolean);
    if (!words.length) {
      continue;
    }

    let start = 0;
    let index = 0;
    while (start < words.length) {
      const end = Math.min(words.length, start + chunkWords);
      const chunkText = cleanString(words.slice(start, end).join(" "));
      if (chunkText) {
        chunks.push({
          professorId: source.professorId ?? null,
          sourceId: source.sourceId ?? null,
          sourceUrl: source.url,
          sourceTitle: source.title,
          sourceDomain: source.domain,
          chunkIndex: index,
          chunkText,
        });
      }

      if (end === words.length) {
        break;
      }

      start = Math.max(0, end - overlapWords);
      index += 1;
    }
  }

  return chunks;
}
