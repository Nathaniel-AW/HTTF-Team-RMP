function Citations({ citationIds = [], citations = [], className = "" }) {
  if (!Array.isArray(citationIds) || citationIds.length === 0) {
    return null;
  }

  const citationMap = new Map(
    (Array.isArray(citations) ? citations : []).map((citation) => [citation.id, citation]),
  );

  const resolved = citationIds
    .map((id) => citationMap.get(id))
    .filter(Boolean);

  if (!resolved.length) {
    return null;
  }

  const rootClassName = ["citation-list", className].filter(Boolean).join(" ");

  return (
    <div className={rootClassName}>
      {resolved.map((citation, index) => (
        <a
          key={citation.id}
          href={citation.url}
          target="_blank"
          rel="noreferrer"
          className="citation-chip"
          title={citation.title || citation.domain}
        >
          [{index + 1}] {citation.domain}
        </a>
      ))}
    </div>
  );
}

export default Citations;
