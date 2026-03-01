function ScoreBreakdown({ score }) {
  const total = Number.isFinite(Number(score?.total)) ? Math.round(Number(score.total)) : null;
  const reviews = Number.isFinite(Number(score?.reviews)) ? Math.round(Number(score.reviews)) : null;
  const profile = Number.isFinite(Number(score?.profile)) ? Math.round(Number(score.profile)) : null;
  const weightReviews = Number.isFinite(Number(score?.weights?.reviews))
    ? Number(score.weights.reviews)
    : 0.85;
  const weightProfile = Number.isFinite(Number(score?.weights?.profile))
    ? Number(score.weights.profile)
    : 0.15;

  return (
    <div className="score-card-body">
      <p className="score-number">{total ?? "--"}</p>
      <p className="subtle">out of 100</p>

      <div className="score-breakdown-grid">
        <div className="score-breakdown-item">
          <p className="score-breakdown-label">Student Reviews ({Math.round(weightReviews * 100)}%)</p>
          <p className="score-breakdown-value">{reviews ?? "--"}</p>
          <p className="subtle score-breakdown-reason">
            {score?.explanation?.reviews_component_reasoning ||
              "Based on review sentiment and consistency."}
          </p>
        </div>

        <div className="score-breakdown-item">
          <p className="score-breakdown-label">Profile Signals ({Math.round(weightProfile * 100)}%)</p>
          <p className="score-breakdown-value">{profile ?? "--"}</p>
          <p className="subtle score-breakdown-reason">
            {score?.explanation?.profile_component_reasoning ||
              "Conservative external profile signal contribution."}
          </p>
        </div>
      </div>

      <p className="score-tooltip subtle">
        Profile signals reflect verified professional prominence and are weighted conservatively.
      </p>
    </div>
  );
}

export default ScoreBreakdown;
