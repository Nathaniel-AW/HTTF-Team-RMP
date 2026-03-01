import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

function Summary() {
  const location = useLocation();
  const rmpUrl = location.state?.rmpUrl ?? "";
  const selectedCourses = location.state?.selectedCourses ?? [];

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

  return (
    <section className="container summary-container">
      <h2>Summary</h2>

      {selectedCourses && selectedCourses.length > 0 ? (
        <div style={{ marginBottom: "20px", padding: "10px", backgroundColor: "#f0f8ff", borderRadius: "4px" }}>
          <p style={{ margin: "0 0 8px 0", fontWeight: "bold" }}>
            Analyzing reviews for {selectedCourses.length} course{selectedCourses.length !== 1 ? "s" : ""}:
          </p>
          <p style={{ margin: 0 }}>
            {selectedCourses.join(", ")}
          </p>
        </div>
      ) : null}

      {loadingSummary ? <p>Generating summary, score, and context...</p> : null}

      {!loadingSummary && summaryError ? <p role="alert">{summaryError}</p> : null}

      {!loadingSummary && !summaryError ? (
        <div className="results-stack">
          <article className="result-card">
            <h3>One-Paragraph Summary</h3>
            <p>{summaryParagraph || "No summary returned."}</p>
            <p className="meta-text">Reviews analyzed: {reviewsCount}</p>
          </article>

          <article className="result-card score-card">
            <h3>Student Usefulness Score</h3>
            <p className="score-number">{numericScore ?? "--"}</p>
            <p className="score-scale">out of 100</p>
            <p>{scoreExplanation || "No score explanation returned."}</p>
          </article>

          <article className="result-card chat-card">
            <h3>Ask About This Professor</h3>
            <p className="meta-text">
              Answers are grounded only in the scraped review data and stats.
            </p>

            <div className="chat-messages" aria-live="polite">
              {chatMessages.length ? (
                chatMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`chat-message ${
                      message.role === "user" ? "chat-user" : "chat-assistant"
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
              <p role="alert" className="chat-error">
                {chatError}
              </p>
            ) : null}

            <form className="chat-input-row" onSubmit={handleChatSubmit}>
              <input
                type="text"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Example: Is this professor a hard grader?"
                disabled={chatLoading || !professorContext}
              />
              <button
                type="submit"
                disabled={chatLoading || !professorContext || !chatInput.trim()}
              >
                {chatLoading ? "Sending..." : "Send"}
              </button>
            </form>
          </article>
        </div>
      ) : null}

      <Link to="/endScore" aria-label="Go back to input another URL">
        <button type="button" className="result-button">Try Another Professor</button>
      </Link>
    </section>
  );
}

export default Summary;
