import Spinner from "./Spinner";

function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  children,
  ...props
}) {
  const resolvedVariant = ["primary", "secondary", "ghost"].includes(variant)
    ? variant
    : "primary";
  const resolvedSize = ["sm", "md"].includes(size) ? size : "md";
  const isDisabled = disabled || loading;

  const buttonClassName = [
    "ui-button",
    `ui-button--${resolvedVariant}`,
    `ui-button--${resolvedSize}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...props}
      className={buttonClassName}
      disabled={isDisabled}
      aria-busy={loading ? "true" : undefined}
    >
      {loading ? <Spinner size="sm" ariaHidden /> : null}
      {children}
    </button>
  );
}

export default Button;
