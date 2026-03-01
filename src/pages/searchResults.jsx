import { Link } from "react-router-dom";

function SearchResults() {
    const professors = [
        { id: 1, name: "Dr. Smith", rating: 4.5 },
        { id: 2, name: "Dr. Johnson", rating: 3.8 },
        { id: 3, name: "Dr. Lee", rating: 4.9 }
    ];

    return (
        <>  
            <section>
                <div>
                    <Link
                        to="/"
                        aria-label="Go back to homepage"
                    >
                        <button type="button">Back to homepage</button>
                    </Link>
                </div>

                <div className="Query-Card">
                    {professors.map((prof) => (
                        <Link 
                            to="/endScore" 
                            aria-label="Go to final score"
                        >
                            <button className="result-button" type="submit">
                                <h2>{prof.name}</h2>
                                <p>Overall Rating: {prof.rating}</p>
                            </button>
                        </Link>
                    ))}
                </div>
            </section>
        </>
    )
}

export default SearchResults