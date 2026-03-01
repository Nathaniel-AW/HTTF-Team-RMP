import { useState } from "react";
import { Link } from 'react-router-dom';

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

function HomePage() {
    const [school, setSchool] = useState("");
    const [professor, setProfessor] = useState("");
    const [rmpUrl, setRmpUrl] = useState("");
    const [summary, setSummary] = useState("");
    const [reviewsCount, setReviewsCount] = useState(0);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [summaryError, setSummaryError] = useState("");

    function handleSubmit(e) {
        e.preventDefault();

        if (!school || !professor.trim()) {
            alert("Please complete all fields");
            return;
        }
    }

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

            const data = await response.json();

            if (!response.ok) {
                const errorMessage = data?.details
                    ? `${data.error ?? "Unable to summarize reviews."} (${data.details})`
                    : (data.error ?? "Unable to summarize reviews.");
                throw new Error(errorMessage);
            }

            setSummary(data.summary ?? "");
            setReviewsCount(data.reviewsCount ?? 0);
        } catch (error) {
            setSummaryError(error instanceof Error ? error.message : "Something went wrong.");
        } finally {
            setLoadingSummary(false);
        }
    }

    return (
        <>
            <div className="container">
                <div>
                    <h2>Professor Review</h2>
                    <p>Find your School from this list:</p>
                    <form onSubmit={handleSubmit}>

                        <div>
                            <select
                                value={school}
                                onChange={(event) => setSchool(event.target.value)}
                            >
                                <option value="">Choose your School</option>
                                <option value="University of Washington">University of Washington</option>
                            </select>

                            <p>
                                Input the name of your Professor:
                            </p>
                            <input
                                type="text"
                                value={professor}
                                onChange={(event) => setProfessor(event.target.value)}
                                placeholder="Enter your Professor Name"
                            />
                        </div>
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
                            <Link
                                to="/searchResults"
                                aria-label="Go to search Results"
                            >
                                <button type="submit">Submit</button>
                            </Link>
                            <button
                                type="button"
                                onClick={handleGenerateSummary}
                                disabled={loadingSummary}
                            >
                                {loadingSummary ? "Generating summary…" : "Generate summary"}
                            </button>
                        </div>
                    </form>

                    {summaryError && (
                        <p style={{ color: "crimson" }}>{summaryError}</p>
                    )}

                    {loadingSummary && (
                        <p>Scraping reviews and asking OpenAI for a summary (may take 20–30 seconds)...</p>
                    )}

                    {summary && (
                        <section className="summary-block">
                            <h3>Professor summary ({reviewsCount} reviews)</h3>
                            <p>{summary}</p>
                        </section>
                    )}
                </div>
            </div>
        </>
    )
}

export default HomePage
