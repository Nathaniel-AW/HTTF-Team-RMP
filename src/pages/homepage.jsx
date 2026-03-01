import { useState } from "react";
import { Link, useLocation } from 'react-router-dom';

function HomePage() {
    const[school, setSchool] = useState("");
    const[professor, setProfessor] = useState("")
    const[userType, setUserType] = useState("student");
    const isActive = (path) => {
        return location.pathname === path ? 'active' : '';
    };

    function handleSubmit(e) {
        e.preventDefault();

        if (!userType || !school || !professor) {
            alert("Please complete all fields");
            return;
        }
    }
    function changeSchool(event) {
        setSchool(event.target.value)
    }
    function changeProfessor(event) {
        setProfessor(event.target.value)
    }
    function changeUser(event) {
        setUserType(event.target.value)
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
                                onChange={changeUser}
                            >
                                <option value="">-</option>
                                <option value="student">Student</option>
                                <option value="teacher">Teacher</option>
                            </select>
                            <p>Find your School from this list:</p>
                            <select
                                value={school}
                                onChange={changeSchool}
                                >
                                <option value="">Choose your School</option>    
                                <option value="University of Washington">University of Washington</option>   
                            </select>

                            <p>Input the name of your Professor:</p>
                            <input
                                type="text"
                                value={professor}
                                onChange={changeProfessor}
                                placeholder="Enter your Professor Name"
                                />  
                        </div>                
                        <Link 
                            to="/searchResults" 
                            aria-label="Go to search Results"
                        >
                            <button type="submit">Submit</button>
                        </Link>

                    </form>
                </div>
            </div>
        </>
    )
}

export default HomePage