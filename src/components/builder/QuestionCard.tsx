"use client";

import { forwardRef } from "react";
import MathText, { MathPreview } from "../MathText";
import { hasErrors, QUESTION_TYPE_DEFS, switchType, TYPE_LIST } from "./questionTypes";
import type { DraftErrors, QuestionDraft, QuestionType } from "./types";

interface Props {
  draft: QuestionDraft;
  index: number;
  count: number;
  active: boolean;
  readOnly: boolean;
  errors: DraftErrors;
  /** Pressing the grip makes the card draggable (see AssignmentBuilder). */
  onGrip: () => void;
  onActivate: () => void;
  onChange: (draft: QuestionDraft) => void;
  onMove: (delta: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

/** Six-dot grip at the top of each card; drag it to reorder. */
function DragHandle({ index, onGrip }: { index: number; onGrip: () => void }) {
  return (
    // Mouse-only affordance; the arrow buttons are the keyboard/screen-reader way to reorder
    <div className="q-grip" title={`Drag question ${index + 1} to reorder`} aria-hidden="true" onPointerDown={onGrip}>
      <svg viewBox="0 0 24 10" width="24" height="10" aria-hidden="true" fill="currentColor">
        {[4, 12, 20].flatMap((x) => [<circle key={`${x}a`} cx={x} cy="2.5" r="1.4" />, <circle key={`${x}b`} cx={x} cy="7.5" r="1.4" />])}
      </svg>
    </div>
  );
}

/** One question: expanded editor when active, a one-line summary otherwise. */
const QuestionCard = forwardRef<HTMLElement, Props>(function QuestionCard(
  { draft, index, count, active, readOnly, errors, onGrip, onActivate, onChange, onMove, onDuplicate, onDelete },
  ref,
) {
  const def = QUESTION_TYPE_DEFS[draft.type];
  const invalid = hasErrors(errors);
  const points = `${draft.points} ${draft.points === 1 ? "pt" : "pts"}`;

  if (!active) {
    return (
      <article ref={ref} className={`q-card is-collapsed${invalid ? " has-error" : ""}`}>
        {!readOnly && <DragHandle index={index} onGrip={onGrip} />}
        <button type="button" className="q-summary" onClick={onActivate} aria-label={`Edit question ${index + 1}`}>
          <span className="q-number">{index + 1}</span>
          <span className="q-summary-text">
            <span className="q-summary-prompt">
              {draft.prompt.trim() ? <MathText text={draft.prompt} inline /> : <em>Untitled question</em>}
            </span>
            <span className="q-summary-meta">
              {def.icon} {def.label} · {points}
              {draft.type === "KEY_IDEAS" && ` · ${draft.ideas.length} ${draft.ideas.length === 1 ? "idea" : "ideas"}`}
            </span>
            {def.answerPreview === "choices" ? (
              <span className="q-choice-preview">
                {draft.options.map((o) => (
                  <span key={o.id} className="q-choice">
                    <span className={`q-choice-dot${draft.options.filter((x) => x.correct).length > 1 ? " is-multi" : ""}`} aria-hidden="true" />
                    {o.text.trim() ? <MathText text={o.text} inline /> : <em>Empty option</em>}
                  </span>
                ))}
              </span>
            ) : (
              <span className={`q-answer-preview is-${def.answerPreview}`} aria-hidden="true" />
            )}
          </span>
          {invalid && <span className="q-needs-fix">Needs attention</span>}
        </button>
      </article>
    );
  }

  return (
    <article ref={ref} className={`q-card is-active${invalid ? " has-error" : ""}`} aria-label={`Question ${index + 1}`}>
      {!readOnly && <DragHandle index={index} onGrip={onGrip} />}
      <div className="q-head">
        <span className="q-number">{index + 1}</span>
        <div className="q-prompt">
          <textarea
            aria-label={`Question ${index + 1}`}
            placeholder="Question"
            rows={2}
            maxLength={20000}
            autoFocus={!draft.prompt}
            value={draft.prompt}
            readOnly={readOnly}
            aria-invalid={errors.prompt ? true : undefined}
            onChange={(e) => onChange({ ...draft, prompt: e.target.value })}
          />
          <MathPreview text={draft.prompt} />
          <p className="error">{errors.prompt}</p>
        </div>
        <label className="q-type">
          <span className="visually-hidden">Question type</span>
          <select
            value={draft.type}
            disabled={readOnly}
            onChange={(e) => onChange(switchType(draft, e.target.value as QuestionType))}
          >
            {TYPE_LIST.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="q-type-desc">{def.icon} {def.description}</p>

      <div className="q-body">
        <def.Editor draft={draft} errors={errors} readOnly={readOnly} onChange={onChange} />
      </div>

      <footer className="q-footer">
        <label className="q-points">
          Points
          <input
            type="number"
            min={1}
            max={1000}
            value={Number.isNaN(draft.points) ? "" : draft.points}
            readOnly={readOnly}
            aria-invalid={errors.points ? true : undefined}
            onChange={(e) => onChange({ ...draft, points: e.target.valueAsNumber })}
          />
        </label>
        {errors.points && <span className="error">{errors.points}</span>}
        <span className="latex-tip">
          Math: type <code>x/2</code>, <code>x^2</code>, <code>sqrt(2)</code>, or LaTeX <code>$\alpha$</code>, <code>$$\int f$$</code>
        </span>

        {!readOnly && (
          <div className="q-actions">
            <button type="button" className="icon-btn" title="Move up" aria-label="Move question up" disabled={index === 0} onClick={() => onMove(-1)}>
              {icon("M12 19V5M5 12l7-7 7 7")}
            </button>
            <button type="button" className="icon-btn" title="Move down" aria-label="Move question down" disabled={index === count - 1} onClick={() => onMove(1)}>
              {icon("M12 5v14M19 12l-7 7-7-7")}
            </button>
            <span className="q-divider" aria-hidden="true" />
            <button type="button" className="icon-btn" title="Duplicate" aria-label="Duplicate question" onClick={onDuplicate}>
              {icon("M8 8h12v12H8z M16 8V4H4v12h4")}
            </button>
            <button type="button" className="icon-btn icon-btn-danger" title="Delete" aria-label="Delete question" onClick={onDelete}>
              {icon("M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3")}
            </button>
          </div>
        )}
      </footer>
    </article>
  );
});

export default QuestionCard;
