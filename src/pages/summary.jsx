import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Badge from "../components/ui/Badge";
import Card from "../components/ui/Card";
import Spinner from "../components/ui/Spinner";
import Achievements from "../components/Achievements";
import Citations from "../components/Citations";
import ProfessorChat from "../components/ProfessorChat";
import ScoreBreakdown from "../components/ScoreBreakdown";

const EMPTY_COURSES = [];
const NOTABLE_REVIEWS_LIMIT = 4;
const EMPTY_REVIEW_FALLBACK = "No notable written reviews available.";
const PLACEHOLDER_REVIEW_PHRASE = "no written comment provided";
const SENTIMENT_BADGE_TONE = {
  Positive: "success",
  Mixed: "warning",
  Critical: "danger",
};
const ENRICHMENT_STAGES = [
  "Gathering sources",
  "Indexing",
  "Generating summary/score",
];

function getScoreDescriptor(score) {
  if (!Number.isFinite(score)) {
    return { label: "Pending", tone: "neutral" };
  }

  if (score >= 75) {
    return { label: "High", tone: "success" };
  }

  if (score >= 50) {
    return { label: "Medium", tone: "warning" };
  }

  return { label: "Low", tone: "danger" };
}

function normalizeReviewText(text) {
  return typeof text === "string" ? text.trim() : "";
}

function toFiniteNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function resolveReviewSentiment(rating) {
  if (rating === null) {
    return "Mixed";
  }

  if (rating >= 4) {
    return "Positive";
  }

  if (rating <= 2) {
    return "Critical";
  }

  return "Mixed";
}

function toReviewSnippet(text, maxLength = 320) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

function selectNotableReviews(reviewsSample) {
  const sourceReviews = Array.isArray(reviewsSample) ? reviewsSample : [];
  const seenNormalizedText = new Set();
  const uniqueUsableReviews = [];

  sourceReviews.forEach((review) => {
    const text = normalizeReviewText(review?.text);
    if (!text) {
      return;
    }

    const normalizedText = text.toLowerCase();
    if (normalizedText.includes(PLACEHOLDER_REVIEW_PHRASE)) {
      return;
    }

    if (seenNormalizedText.has(normalizedText)) {
      return;
    }
    seenNormalizedText.add(normalizedText);

    const rating = toFiniteNumber(review?.rating);
    uniqueUsableReviews.push({
      id: `notable-review-${uniqueUsableReviews.length}`,
      order: uniqueUsableReviews.length,
      sentiment: resolveReviewSentiment(rating),
      rating,
      date: normalizeReviewText(review?.date),
      text,
      snippet: toReviewSnippet(text),
    });
  });

  if (!uniqueUsableReviews.length) {
    return [];
  }

  const buckets = {
    Positive: [],
    Critical: [],
    Mixed: [],
  };

  uniqueUsableReviews.forEach((review) => {
    buckets[review.sentiment].push(review);
  });

  const selected = [];
  const selectedIds = new Set();

  ["Positive", "Critical", "Mixed"].forEach((sentiment) => {
    const firstInBucket = buckets[sentiment][0];
    if (!firstInBucket) {
      return;
    }
    selected.push(firstInBucket);
    selectedIds.add(firstInBucket.id);
  });

  if (selected.length < NOTABLE_REVIEWS_LIMIT) {
    const remaining = uniqueUsableReviews
      .filter((review) => !selectedIds.has(review.id))
      .sort((a, b) => {
        const byLength = b.text.length - a.text.length;
        if (byLength !== 0) {
          return byLength;
        }
        return a.order - b.order;
      });

    selected.push(...remaining);
  }

  return selected.slice(0, NOTABLE_REVIEWS_LIMIT);
}

function formatRating(rating) {
  if (rating === null) {
    return null;
  }

  return Number.isInteger(rating) ? `${rating}/5` : `${rating.toFixed(1)}/5`;
}

function Summary() {
  const location = useLocation();
  const rmpUrl = location.state?.rmpUrl ?? "";
  const selectedCourses = location.state?.selectedCourses ?? EMPTY_COURSES;

  const [professor, setProfessor] = useState(null);
  const [summaryParagraph, setSummaryParagraph] = useState("");
  const [summaryCitations, setSummaryCitations] = useState([]);
  const [score, setScore] = useState(null);
  const [reviewsCount, setReviewsCount] = useState(0);
  const [achievements, setAchievements] = useState([]);
  const [citations, setCitations] = useState([]);
  const [lastRefreshed, setLastRefreshed] = useState("");
  const [professorContext, setProfessorContext] = useState(null);

  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [loadingStageIndex, setLoadingStageIndex] = useState(0);
  const [enrichmentWarning, setEnrichmentWarning] = useState("");

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  useEffect(() => {
    if (!loadingSummary) {
      setLoadingStageIndex(0);
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setLoadingStageIndex((previous) => (previous + 1) % ENRICHMENT_STAGES.length);
    }, 1200);

    return () => window.clearInterval(intervalId);
  }, [loadingSummary]);

  useEffect(() => {
    if (!rmpUrl) {
      setSummaryError(
        "No professor URL found. Go back and provide a RateMyProfessors professor URL first.",
      );
      return;
    }

    let isCancelled = false;

    async function fetchSummary() {
      setLoadingSummary(true);
      setSummaryError("");
      setEnrichmentWarning("");
      setSummaryParagraph("");
      setSummaryCitations([]);
      setScore(null);
      setReviewsCount(0);
      setAchievements([]);
      setCitations([]);
      setLastRefreshed("");
      setProfessorContext(null);
      setProfessor(null);
      setChatMessages([]);
      setChatInput("");
      setChatError("");

      try {
        const requestBody = { rmpUrl };
        if (Array.isArray(selectedCourses) && selectedCourses.length > 0) {
          requestBody.selectedCourses = selectedCourses;
        }

        const response = await fetch("/api/professor/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        let data = {};
        try {
          data = await response.json();
        } catch {
          data = {};
        }

        if (!response.ok) {
          const errorMessage = data?.details
            ? `${data.error ?? "Unable to analyze professor."} (${data.details})`
            : (data.error ?? "Unable to analyze professor.");
          throw new Error(errorMessage);
        }

        if (isCancelled) {
          return;
        }

        const resolvedScore =
          data.score && typeof data.score === "object"
            ? data.score
            : {
                total: Number.isFinite(Number(data.numericScore))
                  ? Math.round(Number(data.numericScore))
                  : null,
                reviews: null,
                profile: null,
                weights: { reviews: 0.85, profile: 0.15 },
                explanation: {
                  reviews_component_reasoning: data.scoreExplanation ?? "",
                  profile_component_reasoning: "",
                },
              };

        const resolvedProfessorContext =
          data.professorContext && typeof data.professorContext === "object"
            ? data.professorContext
            : null;

        const resolvedProfessor = data.professor && typeof data.professor === "object"
          ? data.professor
          : {
              id: "",
              name: resolvedProfessorContext?.professorName ?? "Unknown Professor",
              school: resolvedProfessorContext?.schoolName ?? "Unknown School",
              department: resolvedProfessorContext?.department ?? "Unknown",
            };

        setProfessor(resolvedProfessor);
        setSummaryParagraph(data.summary ?? data.summaryParagraph ?? "");
        setSummaryCitations(Array.isArray(data.summaryCitations) ? data.summaryCitations : []);
        setScore(resolvedScore);
        setAchievements(Array.isArray(data.achievements) ? data.achievements : []);
        setCitations(Array.isArray(data.citations) ? data.citations : []);
        setProfessorContext(resolvedProfessorContext);
        setLastRefreshed(data.professor?.lastRefreshed ?? "");
        setEnrichmentWarning(
          data.enrichment?.warning ||
            data.externalEnrichmentWarning ||
            (Array.isArray(data.warnings) ? data.warnings[0] : "") ||
            "",
        );

        const resolvedReviewsCount = Number.isFinite(Number(data.reviewsCount))
          ? Number(data.reviewsCount)
          : Number(resolvedProfessorContext?.reviewCount ?? 0);
        setReviewsCount(resolvedReviewsCount);

        setChatMessages([
          {
            role: "assistant",
            content:
              "Ask about workload, grading, class difficulty, or verified profile achievements. I will cite sources for factual claims.",
            citations: [],
          },
        ]);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "";
        const isNetworkFailure =
          message === "Failed to fetch" ||
          message === "Load failed" ||
          message.includes("NetworkError");

        setSummaryError(
          isNetworkFailure
            ? "Cannot reach the API server. Start `npm run server` and keep it running, then try again."
            : (message || "Something went wrong."),
        );
      } finally {
        if (!isCancelled) {
          setLoadingSummary(false);
        }
      }
    }

    fetchSummary();

    return () => {
      isCancelled = true;
    };
  }, [rmpUrl, selectedCourses]);

  async function handleChatSubmit(event) {
    event.preventDefault();
    if (chatLoading) {
      return;
    }

    const trimmedInput = chatInput.trim();
    if (!trimmedInput || !professor?.id) {
      return;
    }

    const nextMessages = [...chatMessages, { role: "user", content: trimmedInput, citations: [] }];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatError("");
    setChatLoading(true);

    try {
      const response = await fetch("/api/professor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professorId: professor.id,
          message: trimmedInput,
          recentMessages: nextMessages,
        }),
      });

      let data = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        const errorMessage = data?.details
          ? `${data.error ?? "Unable to get chat response."} (${data.details})`
          : (data.error ?? "Unable to get chat response.");
        throw new Error(errorMessage);
      }

      const answer =
        typeof data.answer === "string" && data.answer.trim()
          ? data.answer.trim()
          : "I do not have enough data in the provided sources to answer that.";

      const responseCitations = Array.isArray(data.citations) ? data.citations : [];
      const responseCitationIds = responseCitations
        .map((entry) => (typeof entry === "string" ? entry : entry?.id))
        .filter(Boolean);

      if (responseCitations.some((entry) => entry && typeof entry === "object")) {
        setCitations((previous) => {
          const byId = new Map(previous.map((citation) => [citation.id, citation]));
          responseCitations.forEach((citation) => {
            if (citation && typeof citation === "object" && citation.id) {
              byId.set(citation.id, citation);
            }
          });
          return Array.from(byId.values());
        });
      }

      setChatMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: answer,
          citations: responseCitationIds,
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const isNetworkFailure =
        message === "Failed to fetch" ||
        message === "Load failed" ||
        message.includes("NetworkError");

      setChatError(
        isNetworkFailure
          ? "Cannot reach the API server for chat right now."
          : (message || "Something went wrong while sending your message."),
      );
    } finally {
      setChatLoading(false);
    }
  }

  const numericScore = Number.isFinite(Number(score?.total)) ? Number(score.total) : null;
  const scoreDescriptor = getScoreDescriptor(numericScore);
  const notableReviews = useMemo(
    () => selectNotableReviews(professorContext?.reviewsSample),
    [professorContext?.reviewsSample],
  );

  return (
    <section className="summary-page">
      {loadingSummary ? (
        <div className="status-panel" role="status" aria-live="polite">
          <Spinner />
          <p>
            Enriching profile... <strong>{ENRICHMENT_STAGES[loadingStageIndex]}</strong>
          </p>
        </div>
      ) : null}

      {!loadingSummary && summaryError ? (
        <div role="alert" className="status-panel status-panel--error">
          <p>{summaryError}</p>
        </div>
      ) : null}

      {!loadingSummary && !summaryError ? (
        <>
          <Card title="Professor Snapshot" className="snapshot-card">
            <div className="snapshot-grid">
              <div>
                <p className="snapshot-label">Name</p>
                <p className="snapshot-value">{professor?.name || "Unknown Professor"}</p>
              </div>
              <div>
                <p className="snapshot-label">School</p>
                <p className="snapshot-value">{professor?.school || "Unknown School"}</p>
              </div>
              <div>
                <p className="snapshot-label">Department</p>
                <p className="snapshot-value">{professor?.department || "Unknown"}</p>
              </div>
              <div>
                <p className="snapshot-label">Last Refreshed</p>
                <p className="snapshot-value">
                  {lastRefreshed
                    ? new Date(lastRefreshed).toLocaleString()
                    : new Date().toLocaleString()}
                </p>
              </div>
            </div>
          </Card>

          {enrichmentWarning ? (
            <div role="alert" className="status-panel status-panel--warning">
              <p>{enrichmentWarning}</p>
            </div>
          ) : null}

          {selectedCourses && selectedCourses.length > 0 ? (
            <div className="selected-courses-banner">
              <p>
                <strong>
                  Analyzing reviews for {selectedCourses.length} course
                  {selectedCourses.length !== 1 ? "s" : ""}:
                </strong>
              </p>
              <p className="subtle">{selectedCourses.join(", ")}</p>
            </div>
          ) : null}

          <div className="results-grid">
            <div className="results-main">
              <Card title="Summary">
                <div className="stack">
                  <p className="summary-text">{summaryParagraph || "No summary returned."}</p>
                  <Citations citationIds={summaryCitations} citations={citations} />
                  <p className="subtle">Reviews analyzed: {reviewsCount}</p>
                </div>
              </Card>

              <Card title="Score">
                <Badge tone={scoreDescriptor.tone} className="score-badge">
                  {scoreDescriptor.label}
                </Badge>
                <ScoreBreakdown score={score} />
              </Card>

              <Card title="Notable Achievements">
                <Achievements achievements={achievements} citations={citations} />
              </Card>
            </div>

            <div className="results-side">
              <Card title="Ask about this professor" className="chat-card">
                <ProfessorChat
                  messages={chatMessages}
                  input={chatInput}
                  onInputChange={setChatInput}
                  onSubmit={handleChatSubmit}
                  loading={chatLoading}
                  error={chatError}
                  disabled={!professor?.id}
                  citations={citations}
                />
              </Card>
            </div>
          </div>

          <Card title="Notable Reviews">
            {notableReviews.length ? (
              <ul className="notable-reviews-list">
                {notableReviews.map((review) => {
                  const metadata = [
                    review.rating === null ? null : `Rating: ${formatRating(review.rating)}`,
                    review.date || null,
                  ].filter(Boolean);

                  return (
                    <li key={review.id} className="notable-review-item">
                      <Badge tone={SENTIMENT_BADGE_TONE[review.sentiment]}>
                        {review.sentiment}
                      </Badge>
                      {metadata.length ? (
                        <p className="notable-review-meta">{metadata.join(" • ")}</p>
                      ) : null}
                      <p className="notable-review-text">{review.snippet}</p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="subtle">{EMPTY_REVIEW_FALLBACK}</p>
            )}
          </Card>
        </>
      ) : null}

      <div className="row">
        <Link
          to="/endScore"
          aria-label="Go back to input another URL"
          className="ui-button ui-button--secondary ui-button--md"
        >
          Try Another Professor
        </Link>
      </div>
    </section>
  );
}

export default Summary;
