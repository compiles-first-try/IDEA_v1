import { useState } from "react";

interface ClarificationChatProps {
  questions: string[];
  onAnswer: (answers: Record<string, string>) => void;
  onSkip: () => void;
}

export function ClarificationChat({ questions, onAnswer, onSkip }: ClarificationChatProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const q of questions) {
      initial[q] = "";
    }
    return initial;
  });

  const allAnswered = questions.every((q) => answers[q]?.trim());

  return (
    <div className="rounded-lg border border-[var(--color-accent-amber)]/40 bg-[var(--color-accent-amber)]/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--color-accent-amber)]" />
        <h4 className="text-sm font-semibold">Clarification needed</h4>
      </div>
      <p className="mb-4 text-xs text-[var(--color-text-secondary)]">
        The system has questions about your specification before building. Answer below or skip to proceed with the original spec.
      </p>

      <div className="space-y-4">
        {questions.map((q, i) => (
          <div key={i}>
            {/* Agent question */}
            <div className="mb-2 flex gap-2">
              <span className="mt-0.5 shrink-0 text-xs font-semibold text-[var(--color-accent-amber)]">Q{i + 1}:</span>
              <p className="text-sm text-[var(--color-text-primary)]">{q}</p>
            </div>
            {/* User answer input */}
            <textarea
              value={answers[q] ?? ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q]: e.target.value }))}
              placeholder="Your answer..."
              rows={2}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-2 text-sm placeholder:text-[var(--color-text-secondary)]"
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onSkip}
          className="rounded border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]"
        >
          Skip — use original spec
        </button>
        <button
          onClick={() => onAnswer(answers)}
          disabled={!allAnswered}
          className="rounded bg-[var(--color-accent-blue)] px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
        >
          Continue with answers
        </button>
      </div>
    </div>
  );
}
