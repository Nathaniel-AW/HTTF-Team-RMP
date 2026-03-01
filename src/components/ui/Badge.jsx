function Badge({ tone = "neutral", className = "", children }) {
  const resolvedTone = ["neutral", "success", "warning", "danger"].includes(tone)
    ? tone
    : "neutral";
  const badgeClassName = ["ui-badge", "badge", `ui-badge--${resolvedTone}`, className]
    .filter(Boolean)
    .join(" ");

  return <span className={badgeClassName}>{children}</span>;
}

export default Badge;
