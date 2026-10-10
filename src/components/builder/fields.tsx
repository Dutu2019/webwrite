"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
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

export const blankOption = (): ChoiceOption => ({ id: newOptionId(), text: "", correct: false });

/** Model answer / rubric text. Never shown to students. */
export function ReferenceField({
  draft,
  errors,
  readOnly,
  onChange,
  kind,
  rows = 3,
}: EditorProps & { kind: "SHORT_ANSWER" | "KEY_IDEAS" | "ESSAY"; rows?: number }) {
  const { t } = useI18n();
  const text = t.builder.reference[kind];
  const id = `ref-${draft.uid}`;
  return (
    <div className="field q-field">
      <label htmlFor={id}>{text.label}</label>
      <textarea
        id={id}
        rows={rows}
        maxLength={20000}
        placeholder={text.placeholder}
        value={draft.reference}
        readOnly={readOnly}
        aria-invalid={errors.reference ? true : undefined}
        onChange={(e) => onChange({ ...draft, reference: e.target.value })}
      />
      <MathPreview text={draft.reference} />
      <p className="field-help">{text.help}</p>
      <p className="error">{errors.reference}</p>
    </div>
  );
}

/** List of key ideas, each with an optional hint shown to students who miss it. */
export function IdeasEditor({ draft, errors, readOnly, onChange }: EditorProps) {
  const { t } = useI18n();
  const text = t.builder.ideas;
  const setIdea = (i: number, patch: Partial<Idea>) =>
    onChange({ ...draft, ideas: draft.ideas.map((idea, j) => (j === i ? { ...idea, ...patch } : idea)) });

  return (
    <fieldset className="ideas">
      <legend>{text.legend}</legend>
      <p className="field-help">{text.help}</p>

      <ol className="idea-list">
        {draft.ideas.map((idea, i) => (
          <li key={i} className="idea-row">
            <span className="idea-label">{t.common.idea(i + 1)}</span>
            <div className="idea-fields">
              <input
                aria-label={t.common.idea(i + 1)}
                placeholder={text.placeholder}
                maxLength={500}
                value={idea.text}
                readOnly={readOnly}
                aria-invalid={errors.ideaErrors?.[i] ? true : undefined}
                onChange={(e) => setIdea(i, { text: e.target.value })}
              />
              <MathPreview text={idea.text} />
              <input
                aria-label={text.hintLabel(i + 1)}
                className="idea-hint"
                placeholder={text.hintPlaceholder}
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
                aria-label={text.removeLabel(i + 1)}
                title={text.remove}
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
          {text.add}
        </button>
      )}
      <p className="error">{errors.ideas}</p>
    </fieldset>
  );
}

/** Multiple-choice options; tick every correct one. */
export function OptionsEditor({ draft, errors, readOnly, onChange }: EditorProps) {
  const { t } = useI18n();
  const text = t.builder.options;
  const multi = draft.options.filter((o) => o.correct).length > 1;
  const setOption = (id: string, patch: Partial<ChoiceOption>) =>
    onChange({ ...draft, options: draft.options.map((o) => (o.id === id ? { ...o, ...patch } : o)) });

  return (
    <fieldset className="options">
      <legend>{text.legend}</legend>
      <p className="field-help">{text.help}</p>

      <ol className="option-list">
        {draft.options.map((o, i) => (
          <li key={o.id} className="option-row">
            <button
              type="button"
              role="checkbox"
              aria-checked={o.correct}
              aria-label={text.isCorrectLabel(i + 1)}
              title={o.correct ? text.correct : text.markCorrect}
              className={`option-mark${multi ? " is-multi" : ""}${o.correct ? " is-correct" : ""}`}
              disabled={readOnly}
              onClick={() => setOption(o.id, { correct: !o.correct })}
            >
              {o.correct && "✓"}
            </button>
            <div className="option-fields">
              <input
                aria-label={text.option(i + 1)}
                placeholder={text.option(i + 1)}
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
                aria-label={text.removeLabel(i + 1)}
                title={text.remove}
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
          onClick={() => onChange({ ...draft, options: [...draft.options, blankOption()] })}
        >
          {text.add}
        </button>
      )}
      <p className="error">{errors.options}</p>
    </fieldset>
  );
}
