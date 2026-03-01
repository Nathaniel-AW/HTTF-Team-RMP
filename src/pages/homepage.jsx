import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';

function HomePage() {
    const navigate = useNavigate();

    function selectRole(role) {
        // store status in localStorage for later use
        localStorage.setItem('userStatus', role);
        navigate('/endScore');
    }

    return (
        <section className="home-page">
            <div className="ui-card home-hero">
                <div className="home-hero-content">
                    <p className="home-eyebrow">AI-Powered Academic Insights</p>
                    <h1 className="home-title">Choose your role to begin</h1>
                    <p className="home-subtitle subtle">
                        FutureScore keeps your existing workflow intact while presenting professor feedback in a cleaner dashboard.
                    </p>
                    <div className="home-role-buttons">
                        <Button type="button" variant="primary" onClick={() => selectRole('student')}>
                            Student
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => selectRole('teacher')}>
                            Professor
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default HomePage
