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
    const [userType, setUserType] = useState("student");

    function handleSubmit(e) {
        e.preventDefault();

        if (!userType || !school || !professor) {
            alert("Please complete all fields");
            return;
        }
    }

    return (
        <>
            <div className="container">
                <div>
                    <h2>Professor Review</h2>
                    <form onSubmit={handleSubmit}>

                        <div>
                            <p>What are you using us for?</p>
                            <select 
                                value={userType}
                                onChange={(event) => setUserType(event.target.value)}
                            >
                                <option value="">-</option>
                                <option value="student">Student</option>
                                <option value="teacher">Teacher</option>
                            </select>
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
                            <Link
                                to="/endScore"
                                aria-label="Go to search Results"
                            >
                                <button type="submit">Submit</button>
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </>
    )
}

export default HomePage
