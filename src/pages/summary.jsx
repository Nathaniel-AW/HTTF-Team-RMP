import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

function Summary() {
    const location = useLocation();
    const rmpUrl = location.state?.rmpUrl ?? "";

    const [summary, setSummary] = useState("");
    const [reviewsCount, setReviewsCount] = useState(0);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [summaryError, setSummaryError] = useState("");

    useEffect(() => {
        if (!rmpUrl) {
            setSummaryError(
                "No professor URL found. Go back and provide a RateMyProfessors professor URL first."
            );
            return;
        }

        let isCancelled = false;

        async function fetchSummary() {
            setLoadingSummary(true);
            setSummaryError("");
            setSummary("");
            setReviewsCount(0);

            try {
                const response = await fetch("/api/reviews/summary", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url: rmpUrl }),
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

                if (!isCancelled) {
                    setSummary(data.summary ?? "");
                    setReviewsCount(data.reviewsCount ?? 0);
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
                        : (message || "Something went wrong.")
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
    }, [rmpUrl]);

    return (
        <section className="container">
            <h2>Summary</h2>

            {loadingSummary ? <p>Generating summary...</p> : null}

            {!loadingSummary && summaryError ? <p role="alert">{summaryError}</p> : null}

            {!loadingSummary && !summaryError && summary ? (
                <>
                    <p>{summary}</p>
                    <p>Reviews analyzed: {reviewsCount}</p>
                </>
            ) : null}

            <Link to="/endScore" aria-label="Go back to input another URL">
                <button type="button" className="result-button">Try Another Professor</button>
            </Link>
        </section>
    );
}

export default Summary;
