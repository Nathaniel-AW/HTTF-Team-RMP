import Citations from "./Citations";

function Achievements({ achievements = [], citations = [] }) {
  if (!Array.isArray(achievements) || achievements.length === 0) {
    return (
      <p className="subtle">
        No verified achievements found from available sources.
      </p>
    );
  }

  return (
    <ul className="achievements-list">
      {achievements.map((achievement, index) => (
        <li key={`achievement-${index}`} className="achievement-item">
          <p className="achievement-text">{achievement.text}</p>
          <Citations citationIds={achievement.citations} citations={citations} />
        </li>
      ))}
    </ul>
  );
}

export default Achievements;
