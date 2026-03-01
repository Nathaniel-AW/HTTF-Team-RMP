import { useState } from "react";
import { Link, useNavigate } from 'react-router-dom';
import { useUserStatus } from '../context/UserStatusContext.jsx';

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

function UserStatusPage() {
    const [school, setSchool] = useState("");
    const [professor, setProfessor] = useState("");
    const { userStatus, setUserStatus } = useUserStatus();
    const navigate = useNavigate();
    const [rmpUrl, setRmpUrl] = useState("");
    const [summary, setSummary] = useState("");
    const [reviewsCount, setReviewsCount] = useState(0);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [summaryError, setSummaryError] = useState("");

    function handleSubmit(e) {
        e.preventDefault();

        if (!userStatus || !school || !professor) {
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
    // if the user hasn't selected a role yet, show a simple landing choice
    if (!userStatus) {
        return (
            <div className="container homepage-landing">
                <h2>I am a <span className="role-placeholder">...</span></h2>
                <div className="role-buttons">
                    <button onClick={() => {
                        setUserStatus('student');
                        navigate('/');
                    }}>Student</button>
                    <button onClick={() => {
                        setUserStatus('teacher');
                        navigate('/');
                    }}>Teacher</button>
                </div>
            </div>
        );
    }

    // let the user change their mind at any point


    return (
        <>
            <div className="container">
                <div>
                    <h2>Professor Review ({userStatus === 'student' ? 'Student' : 'Teacher'} view)</h2>
                    <button className="result-button" onClick={() => setUserStatus(null)}>
                        ⟵ Choose different role
                    </button>
                    <form onSubmit={handleSubmit}>

                        <div>
                            {/* store the chosen userType but hide control now that it's selected */}
                            <input type="hidden" value={userType} />

                            <p>Find your School from this list:</p>
                            <select
                                value={school}
                                onChange={(event) => setSchool(event.target.value)}
                            >
                                <option value="">Choose your School</option>
                                <option value="University of Washington">University of Washington</option>
                            </select>

                            <p>Input the name of your Professor:</p>
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
    );
}

export default UserStatusPage;
