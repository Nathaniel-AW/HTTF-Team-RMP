import { useState } from "react";
import { Link } from "react-router-dom";

const RATE_MY_PROFESSORS_PATH_REGEX = /^\/professor\/\d+/;

function normalizeRateMyProfUrl(value) {
    if (!value) {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    let parsed;
    try {
        parsed = new URL(candidate);
    } catch {
        return null;
    }

    const hostname = parsed.hostname.toLowerCase();
    if (!hostname.endsWith("ratemyprofessors.com")) {
        return null;
    }

    if (!RATE_MY_PROFESSORS_PATH_REGEX.test(parsed.pathname)) {
        return null;
    }

    return parsed.toString();
}


function EndScore() {
    const [rmpUrl, setRmpUrl] = useState("");
    const [summary, setSummary] = useState("");
    const [reviewsCount, setReviewsCount] = useState(0);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [summaryError, setSummaryError] = useState("");

    async function handleGenerateSummary() {
        const normalizedUrl = normalizeRateMyProfUrl(rmpUrl);
        if (!normalizedUrl) {
            setSummaryError(
                "Please provide a valid RateMyProfessors professor URL (e.g., https://www.ratemyprofessors.com/professor/3126905)."
            );
            return;
        }

        setRmpUrl(normalizedUrl);

        setLoadingSummary(true);
        setSummaryError("");
        setSummary("");

        try {
            const response = await fetch("/api/reviews/summary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: normalizedUrl }),
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

            setSummary(data.summary ?? "");
            setReviewsCount(data.reviewsCount ?? 0);
        } catch (error) {
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
            setLoadingSummary(false);
        }
    }

    return (
        <>
            <div>
                <p>RateMyProfessors professor URL:</p>
                <input
                    type="text"
                    value={rmpUrl}
                    onChange={(event) => setRmpUrl(event.target.value)}
                    placeholder="https://www.ratemyprofessors.com/professor/123456"
                    />
            </div>
            <div>
                <Link to="/summary" aria-label="Go to summary">
                    <button type="submit">Generating Summary</button>
                </Link>
            </div>
        </>
    )
}

export default EndScore