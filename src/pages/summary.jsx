import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Spinner from "../components/ui/Spinner";

const EMPTY_COURSES = [];
const NOTABLE_REVIEWS_LIMIT = 4;
const EMPTY_REVIEW_FALLBACK = "No notable written reviews available.";
const PLACEHOLDER_REVIEW_PHRASE = "no written comment provided";
const SENTIMENT_BADGE_TONE = {
  Positive: "success",
  Mixed: "warning",
  Critical: "danger",
};

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

  const [summaryParagraph, setSummaryParagraph] = useState("");
  const [numericScore, setNumericScore] = useState(null);
  const [scoreExplanation, setScoreExplanation] = useState("");
  const [reviewsCount, setReviewsCount] = useState(0);
  const [professorContext, setProfessorContext] = useState(null);

  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");

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
      setSummaryParagraph("");
      setNumericScore(null);
      setScoreExplanation("");
      setReviewsCount(0);
      setProfessorContext(null);
      setChatMessages([]);
      setChatInput("");
      setChatError("");

      try {
        const requestBody = { professorUrl: rmpUrl };
        if (Array.isArray(selectedCourses) && selectedCourses.length > 0) {
          requestBody.selectedCourses = selectedCourses;
        }

        const response = await fetch("/api/reviews/summary", {
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
            ? `${data.error ?? "Unable to summarize reviews."} (${data.details})`
            : (data.error ?? "Unable to summarize reviews.");
          throw new Error(errorMessage);
        }

        if (isCancelled) {
          return;
        }

        const score = Number.isFinite(Number(data.numericScore))
          ? Math.round(Number(data.numericScore))
          : null;

        setSummaryParagraph(data.summaryParagraph ?? data.summary ?? "");
        setNumericScore(score);
        setScoreExplanation(data.scoreExplanation ?? "");

        const context =
          data.professorContext && typeof data.professorContext === "object"
            ? data.professorContext
            : null;

        setProfessorContext(context);

        const resolvedReviewsCount = Number.isFinite(Number(context?.reviewCount))
          ? Number(context.reviewCount)
          : Number(data.reviewsCount ?? 0);
        setReviewsCount(resolvedReviewsCount);

        if (context) {
          setChatMessages([
            {
              role: "assistant",
              content:
                "Ask me about workload, grading style, class difficulty, or teaching quality. I will answer using the scraped reviews only.",
            },
          ]);
        }
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
    if (!trimmedInput || !professorContext) {
      return;
    }

    const nextMessages = [...chatMessages, { role: "user", content: trimmedInput }];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatError("");
    setChatLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          professorContext,
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
          : "I do not have enough data in the provided reviews to answer that.";

      setChatMessages((prev) => [...prev, { role: "assistant", content: answer }]);
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

  const scoreDescriptor = getScoreDescriptor(numericScore);
  const notableReviews = useMemo(
    () => selectNotableReviews(professorContext?.reviewsSample),
    [professorContext?.reviewsSample],
  );
  const professorName = professorContext?.professorName?.trim() || "Unknown Professor";

  return (
    <section className="summary-page">
      {!loadingSummary && !summaryError ? (
        <div className="professor-display" aria-live="polite">
          <p className="professor-display-label">Professor</p>
          <p className="professor-display-name">{professorName}</p>
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

      {loadingSummary ? (
        <div className="status-panel" role="status" aria-live="polite">
          <Spinner />
          <p>Generating summary, score, and context...</p>
        </div>
      ) : null}

      {!loadingSummary && summaryError ? (
        <div role="alert" className="status-panel status-panel--error">
          <p>{summaryError}</p>
        </div>
      ) : null}

      {!loadingSummary && !summaryError ? (
        <>
          <div className="results-grid">
            <div className="results-main">
              <Card title="Summary">
                <div className="stack">
                  <p className="summary-text">{summaryParagraph || "No summary returned."}</p>
                  <p className="subtle">Reviews analyzed: {reviewsCount}</p>
                </div>
              </Card>

              <Card title="Score">
                <div className="score-card-body">
                  <Badge tone={scoreDescriptor.tone} className="score-badge">
                    {scoreDescriptor.label}
                  </Badge>
                  <p className="score-number">{numericScore ?? "--"}</p>
                  <p className="subtle">out of 100</p>
                  <p>{scoreExplanation || "No score explanation returned."}</p>
                </div>
              </Card>
            </div>

            <div className="results-side">
              <Card title="Ask about this professor" className="chat-card">
                <div className="chat-panel">
                  <p className="subtle">
                    Answers are grounded only in the scraped review data and stats.
                  </p>

                  <div
                    className="chat-messages"
                    aria-live="polite"
                    role="log"
                    aria-label="Conversation history"
                  >
                    {chatMessages.length ? (
                      chatMessages.map((message, index) => (
                        <div
                          key={`${message.role}-${index}`}
                          className={`chat-bubble ${
                            message.role === "user" ? "user" : "assistant"
                          }`}
                        >
                          <p className="chat-role">
                            {message.role === "user" ? "You" : "Assistant"}
                          </p>
                          <p>{message.content}</p>
                        </div>
                      ))
                    ) : (
                      <p className="chat-empty">No messages yet.</p>
                    )}
                  </div>

                  {chatError ? (
                    <div role="alert" className="status-panel status-panel--error">
                      <p>{chatError}</p>
                    </div>
                  ) : null}

                  <form className="chat-form" onSubmit={handleChatSubmit}>
                    <Input
                      id="chat-message-input"
                      label="Ask a question"
                      type="text"
                      value={chatInput}
                      onChange={(event) => setChatInput(event.target.value)}
                      placeholder="Example: Is this professor a hard grader?"
                      disabled={chatLoading || !professorContext}
                      helperText={
                        professorContext
                          ? ""
                          : "Chat becomes available after summary context is ready."
                      }
                    />

                    <Button
                      type="submit"
                      loading={chatLoading}
                      disabled={chatLoading || !professorContext || !chatInput.trim()}
                    >
                      {chatLoading ? "Sending..." : "Send"}
                    </Button>
                  </form>
                </div>
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
