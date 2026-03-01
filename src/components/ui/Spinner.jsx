function Spinner({ size = "md", label = "Loading", className = "", ariaHidden = false }) {
  const resolvedSize = ["sm", "md", "lg"].includes(size) ? size : "md";
  const spinnerClassName = `ui-spinner ui-spinner--${resolvedSize}${className ? ` ${className}` : ""}`;

  if (ariaHidden) {
    return <span className={spinnerClassName} aria-hidden="true" />;
  }

  return (
    <span className={spinnerClassName} role="status" aria-label={label}>
      <span className="visually-hidden">{label}</span>
    </span>
  );
}

export default Spinner;
