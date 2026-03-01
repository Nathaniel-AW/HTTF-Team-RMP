<<<<<<< HEAD
import { useNavigate } from 'react-router-dom';
=======
import { useState } from "react";
import { Link } from 'react-router-dom';
>>>>>>> 96067a5b5d95d7a7bfcfd05370a8bfe74f4f07e5

function HomePage() {
    const navigate = useNavigate();

    function selectRole(role) {
        // store status in localStorage for later use
        localStorage.setItem('userStatus', role);
        navigate('/endScore');
    }

    return (
        <div className="hero">
            <div className="blobs">
                <div className="blob" />
                <div className="blob" />
                <div className="blob" />
                <div className="blob" />
                <div className="blob" />
                <div className="blob" />
                <div className="blob" />
                <div className="blob" />
                <div className="blob" />
                <div className="blob" />
                <div className="blob" />
                <div className="blob" />
                <div className="blob" />
                <div className="blob" />
                <div className="blob" />
            </div>
            <div className="role-container">
                <h1 className="role-text">I am a...</h1>
                <div className="role-buttons">
                    <button className="primary" onClick={() => selectRole('student')}>Student</button>
                    <button className="secondary" onClick={() => selectRole('teacher')}>Professor</button>
                </div>
            </div>
        </div>
    );
}

export default HomePage
