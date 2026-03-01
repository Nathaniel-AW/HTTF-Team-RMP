import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";

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
        navigate("/courseSelection", { state: { rmpUrl: normalizedUrl } });
    }

    return (
        <section className="intake-page">
            <Card className="intake-card" title="Analyze a professor">
                <div className="stack">
                    <p className="subtle">
                        Paste a RateMyProfessor professor URL to generate a summary, score, and chat-ready context.
                    </p>

                    <form
                        className="intake-form-row"
                        onSubmit={(event) => {
                            event.preventDefault();
                            handleGenerateSummary();
                        }}
                    >
                        <Input
                            id="rmp-url-input"
                            label="RateMyProfessor URL"
                            type="text"
                            value={rmpUrl}
                            onChange={(event) => setRmpUrl(event.target.value)}
                            placeholder="https://www.ratemyprofessors.com/professor/123456"
                            helperText="Paste a valid professor URL."
                            error={validationError}
                        />
                        <Button type="submit">Generate Summary</Button>
                    </form>
                </div>
            </Card>
        </section>
    )
}

export default EndScore
