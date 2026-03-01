import { Link } from "react-router-dom";

function AppShell({ children }) {
  const year = new Date().getFullYear();

  return (
    <div className="app-shell page">
      <header className="app-nav">
        <div className="container app-nav-inner">
          <Link to="/" className="app-brand">
            FutureScore
          </Link>

          <nav className="app-nav-links" aria-label="Primary">
            <Link to="/endScore" className="app-nav-link">
              Analyze URL
            </Link>
            <Link to="/" className="app-nav-link">
              Home
            </Link>
          </nav>
        </div>
      </header>

      <main className="app-main">
        <div className="container page-fade">{children}</div>
      </main>

      <footer className="app-footer">
        <div className="container app-footer-inner">
          <span>FutureScore</span>
          <span>{year}</span>
        </div>
      </footer>
    </div>
  );
}

export default AppShell;
