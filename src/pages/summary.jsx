import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Spinner from "../components/ui/Spinner";

const EMPTY_COURSES = [];

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

  return (
    <section className="summary-page">
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
        <div className="results-grid">
          <Card title="Summary">
            <div className="stack">
              <p className="summary-text">{summaryParagraph || "No summary returned."}</p>
              <p className="subtle">Reviews analyzed: {reviewsCount}</p>
            </div>
          </Card>

          <div className="results-side">
            <Card title="Score">
              <div className="score-card-body">
                <Badge tone={scoreDescriptor.tone}>{scoreDescriptor.label}</Badge>
                <p className="score-number">{numericScore ?? "--"}</p>
                <p className="subtle">out of 100</p>
                <p>{scoreExplanation || "No score explanation returned."}</p>
              </div>
            </Card>

            <Card title="Ask about this professor">
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
                        className={`chat-bubble ${message.role === "user" ? "user" : "assistant"}`}
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
