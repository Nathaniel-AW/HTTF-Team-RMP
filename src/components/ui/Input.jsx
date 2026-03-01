import { useId } from "react";

function Input({
  id,
  label,
  helperText,
  error,
  className = "",
  inputClassName = "",
  ...props
}) {
  const autoId = useId();
  const inputId = id || autoId;

  const rootClassName = ["ui-input-group", className].filter(Boolean).join(" ");
  const fieldClassName = ["ui-input", error ? "ui-input--error" : "", inputClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName}>
      {label ? (
        <label className="ui-label" htmlFor={inputId}>
          {label}
        </label>
      ) : null}

      <input
        {...props}
        id={inputId}
        className={fieldClassName}
        aria-invalid={error ? "true" : undefined}
      />

      {error ? <p className="ui-input-help ui-input-help--error">{error}</p> : null}
      {!error && helperText ? <p className="ui-input-help">{helperText}</p> : null}
    </div>
  );
}

export default Input;
