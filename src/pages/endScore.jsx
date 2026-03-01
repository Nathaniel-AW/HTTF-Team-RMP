import { useState } from "react";
import { useNavigate } from "react-router-dom";

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
    const navigate = useNavigate();
    const [rmpUrl, setRmpUrl] = useState("");
    const [validationError, setValidationError] = useState("");

    function handleGenerateSummary() {
        const normalizedUrl = normalizeRateMyProfUrl(rmpUrl);
        if (!normalizedUrl) {
            setValidationError(
                "Please provide a valid RateMyProfessors professor URL (e.g., https://www.ratemyprofessors.com/professor/3126905)."
            );
            return;
        }

        setValidationError("");
        navigate("/summary", { state: { rmpUrl: normalizedUrl } });
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
                {validationError ? <p role="alert">{validationError}</p> : null}
            </div>
            <div>
                <button type="button" onClick={handleGenerateSummary}>Generate Summary</button>
            </div>
        </>
    )
}

export default EndScore
