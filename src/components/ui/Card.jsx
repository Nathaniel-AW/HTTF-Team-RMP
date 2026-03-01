function Card({ title, actions, className = "", children }) {
  const cardClassName = ["ui-card", "card", className].filter(Boolean).join(" ");

  return (
    <section className={cardClassName}>
      {title || actions ? (
        <header className="ui-card-header">
          {title ? <h2 className="ui-card-title">{title}</h2> : <span />}
          {actions}
        </header>
      ) : null}
      <div className="ui-card-content">{children}</div>
    </section>
  );
}

export default Card;
