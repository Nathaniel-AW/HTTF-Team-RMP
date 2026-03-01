import Button from "./ui/Button";
import Input from "./ui/Input";
import Citations from "./Citations";

function ProfessorChat({
  messages = [],
  input,
  onInputChange,
  onSubmit,
  loading,
  error,
  disabled,
  citations = [],
}) {
  return (
    <div className="chat-panel">
      <p className="subtle">
        Answers are grounded in scraped reviews and retrieved external sources.
      </p>

      <div
        className="chat-messages"
        aria-live="polite"
        role="log"
        aria-label="Conversation history"
      >
        {messages.length ? (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`chat-bubble ${message.role === "user" ? "user" : "assistant"}`}
            >
              <p className="chat-role">{message.role === "user" ? "You" : "Assistant"}</p>
              <p>{message.content}</p>
              {message.role === "assistant" ? (
                <Citations
                  citationIds={Array.isArray(message.citations) ? message.citations : []}
                  citations={citations}
                  className="chat-citations"
                />
              ) : null}
            </div>
          ))
        ) : (
          <p className="chat-empty">No messages yet.</p>
        )}
      </div>

      {error ? (
        <div role="alert" className="status-panel status-panel--error">
          <p>{error}</p>
        </div>
      ) : null}

      <form className="chat-form" onSubmit={onSubmit}>
        <Input
          id="chat-message-input"
          label="Ask a question"
          type="text"
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Example: What are this professor's notable achievements?"
          disabled={loading || disabled}
          helperText={
            disabled ? "Chat becomes available after summary context is ready." : ""
          }
        />

        <Button
          type="submit"
          loading={loading}
          disabled={loading || disabled || !String(input ?? "").trim()}
        >
          {loading ? "Sending..." : "Send"}
        </Button>
      </form>
    </div>
  );
}

export default ProfessorChat;
