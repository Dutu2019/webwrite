"use client";

import { MathPreview } from "../MathText";
import type { ChoiceOption, DraftErrors, Idea, QuestionDraft } from "./types";

export interface EditorProps {
  draft: QuestionDraft;
  errors: DraftErrors;
  readOnly: boolean;
  onChange: (draft: QuestionDraft) => void;
}

export const MAX_IDEAS = 20;
export const MAX_OPTIONS = 20;

export const newOptionId = () => `o${Math.random().toString(36).slice(2, 8)}`;

/** Model answer / rubric text. Never shown to students. */
export function ReferenceField({
  draft,
  errors,
  readOnly,
  onChange,
  label,
  help,
  placeholder,
  rows = 3,
}: EditorProps & { label: string; help: string; placeholder: string; rows?: number }) {
  const id = `ref-${draft.uid}`;
  return (
    <div className="field q-field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        rows={rows}
        maxLength={20000}
        placeholder={placeholder}
        value={draft.reference}
        readOnly={readOnly}
        aria-invalid={errors.reference ? true : undefined}
        onChange={(e) => onChange({ ...draft, reference: e.target.value })}
      />
      <MathPreview text={draft.reference} />
      <p className="field-help">{help}</p>
      <p className="error">{errors.reference}</p>
    </div>
  );
}

/** List of key ideas, each with an optional hint shown to students who miss it. */
export function IdeasEditor({ draft, errors, readOnly, onChange }: EditorProps) {
  const setIdea = (i: number, patch: Partial<Idea>) =>
    onChange({ ...draft, ideas: draft.ideas.map((idea, j) => (j === i ? { ...idea, ...patch } : idea)) });

  return (
    <fieldset className="ideas">
      <legend>Key ideas</legend>
      <p className="field-help">
        Students see only &ldquo;Idea 1&rdquo;, &ldquo;Idea 2&rdquo;… and whether they have covered each one. The hint
        appears while an idea is still missing.
      </p>

      <ol className="idea-list">
        {draft.ideas.map((idea, i) => (
          <li key={i} className="idea-row">
            <span className="idea-label">Idea {i + 1}</span>
            <div className="idea-fields">
              <input
                aria-label={`Idea ${i + 1}`}
                placeholder="What the answer must say"
                maxLength={500}
                value={idea.text}
                readOnly={readOnly}
                aria-invalid={errors.ideaErrors?.[i] ? true : undefined}
                onChange={(e) => setIdea(i, { text: e.target.value })}
              />
              <MathPreview text={idea.text} />
              <input
                aria-label={`Hint for idea ${i + 1}`}
                className="idea-hint"
                placeholder="Hint for students (optional)"
                maxLength={500}
                value={idea.hint}
                readOnly={readOnly}
                onChange={(e) => setIdea(i, { hint: e.target.value })}
              />
              {errors.ideaErrors?.[i] && <p className="error">{errors.ideaErrors[i]}</p>}
            </div>
            {!readOnly && (
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove idea ${i + 1}`}
                title="Remove idea"
                onClick={() => onChange({ ...draft, ideas: draft.ideas.filter((_, j) => j !== i) })}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ol>

      {!readOnly && draft.ideas.length < MAX_IDEAS && (
        <button
          type="button"
          className="link-btn"
          onClick={() => onChange({ ...draft, ideas: [...draft.ideas, { text: "", hint: "" }] })}
        >
          + Add idea
        </button>
      )}
      <p className="error">{errors.ideas}</p>
    </fieldset>
  );
}

/** Multiple-choice options; tick every correct one. */
export function OptionsEditor({ draft, errors, readOnly, onChange }: EditorProps) {
  const correctCount = draft.options.filter((o) => o.correct).length;
  const setOption = (id: string, patch: Partial<ChoiceOption>) =>
    onChange({ ...draft, options: draft.options.map((o) => (o.id === id ? { ...o, ...patch } : o)) });

  return (
    <fieldset className="options">
      <legend>Options</legend>
      <p className="field-help">
        Tick the correct option. Tick several and students must choose all that apply. Students never see which are correct.
      </p>

      <ol className="option-list">
        {draft.options.map((o, i) => (
          <li key={o.id} className="option-row">
            <button
              type="button"
              role="checkbox"
              aria-checked={o.correct}
              aria-label={`Option ${i + 1} is correct`}
              title={o.correct ? "Correct answer" : "Mark as correct"}
              className={`option-mark${correctCount > 1 ? " is-multi" : ""}${o.correct ? " is-correct" : ""}`}
              disabled={readOnly}
              onClick={() => setOption(o.id, { correct: !o.correct })}
            >
              {o.correct && "✓"}
            </button>
            <div className="option-fields">
              <input
                aria-label={`Option ${i + 1}`}
                placeholder={`Option ${i + 1}`}
                maxLength={2000}
                value={o.text}
                readOnly={readOnly}
                aria-invalid={errors.optionErrors?.[i] ? true : undefined}
                onChange={(e) => setOption(o.id, { text: e.target.value })}
              />
              <MathPreview text={o.text} />
              {errors.optionErrors?.[i] && <p className="error">{errors.optionErrors[i]}</p>}
            </div>
            {!readOnly && (
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove option ${i + 1}`}
                title="Remove option"
                disabled={draft.options.length <= 2}
                onClick={() => onChange({ ...draft, options: draft.options.filter((x) => x.id !== o.id) })}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ol>

      {!readOnly && draft.options.length < MAX_OPTIONS && (
        <button
          type="button"
          className="link-btn"
          onClick={() => onChange({ ...draft, options: [...draft.options, { id: newOptionId(), text: "", correct: false }] })}
        >
          + Add option
        </button>
      )}
      <p className="error">{errors.options}</p>
    </fieldset>
  );
}
