"use client";

import { forwardRef } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
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
function DragHandle({ title, onGrip }: { title: string; onGrip: () => void }) {
  return (
    // Mouse-only affordance; the arrow buttons are the keyboard/screen-reader way to reorder
    <div className="q-grip" title={title} aria-hidden="true" onPointerDown={onGrip}>
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
  const { t } = useI18n();
  const text = t.builder.card;
  const def = QUESTION_TYPE_DEFS[draft.type];
  const typeText = t.builder.types[draft.type];
  const invalid = hasErrors(errors);
  const n = index + 1;
  const grip = !readOnly && <DragHandle title={text.dragToReorder(n)} onGrip={onGrip} />;

  if (!active) {
    const multi = draft.options.filter((o) => o.correct).length > 1;
    return (
      <article ref={ref} className={`q-card is-collapsed${invalid ? " has-error" : ""}`}>
        {grip}
        <button type="button" className="q-summary" onClick={onActivate} aria-label={text.editQuestion(n)}>
          <span className="q-number">{n}</span>
          <span className="q-summary-text">
            {/* One line with an ellipsis; the full prompt stays available on hover */}
            <span className="q-summary-prompt" title={draft.prompt.trim() || undefined}>
              {draft.prompt.trim() ? <MathText text={draft.prompt} inline /> : <em>{text.untitled}</em>}
            </span>
            <span className="q-summary-meta">
              {def.icon} {typeText.label} · {t.builder.points(draft.points)}
              {draft.type === "KEY_IDEAS" && ` · ${t.builder.ideaCount(draft.ideas.length)}`}
            </span>
            {def.answerPreview === "choices" ? (
              <span className="q-choice-preview">
                {draft.options.map((o) => (
                  <span key={o.id} className="q-choice">
                    <span className={`q-choice-dot${multi ? " is-multi" : ""}`} aria-hidden="true" />
                    {o.text.trim() ? <MathText text={o.text} inline /> : <em>{text.emptyOption}</em>}
                  </span>
                ))}
              </span>
            ) : (
              <span className={`q-answer-preview is-${def.answerPreview}`} aria-hidden="true" />
            )}
          </span>
          {invalid && <span className="q-needs-fix">{text.needsAttention}</span>}
        </button>
      </article>
    );
  }

  return (
    <article ref={ref} className={`q-card is-active${invalid ? " has-error" : ""}`} aria-label={text.question(n)}>
      {grip}
      <div className="q-head">
        <span className="q-number">{n}</span>
        <div className="q-prompt">
          <textarea
            aria-label={text.question(n)}
            placeholder={text.promptPlaceholder}
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
          <span className="visually-hidden">{text.questionType}</span>
          <select
            value={draft.type}
            disabled={readOnly}
            onChange={(e) => onChange(switchType(draft, e.target.value as QuestionType))}
          >
            {TYPE_LIST.map(({ id }) => (
              <option key={id} value={id}>{t.builder.types[id].label}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="q-type-desc">{def.icon} {typeText.description}</p>

      <div className="q-body">
        <def.Editor draft={draft} errors={errors} readOnly={readOnly} onChange={onChange} />
      </div>

      <footer className="q-footer">
        <label className="q-points">
          {text.points}
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
          {text.mathTipLead} <code>x/2</code>, <code>x^2</code>, <code>sqrt(2)</code>{text.mathTipLatex} <code>$\alpha$</code>, <code>$$\int f$$</code>
        </span>

        {!readOnly && (
          <div className="q-actions">
            <button type="button" className="icon-btn" title={text.moveUp} aria-label={text.moveUpLabel} disabled={index === 0} onClick={() => onMove(-1)}>
              {icon("M12 19V5M5 12l7-7 7 7")}
            </button>
            <button type="button" className="icon-btn" title={text.moveDown} aria-label={text.moveDownLabel} disabled={index === count - 1} onClick={() => onMove(1)}>
              {icon("M12 5v14M19 12l-7 7-7-7")}
            </button>
            <span className="q-divider" aria-hidden="true" />
            <button type="button" className="icon-btn" title={text.duplicate} aria-label={text.duplicateLabel} onClick={onDuplicate}>
              {icon("M8 8h12v12H8z M16 8V4H4v12h4")}
            </button>
            <button type="button" className="icon-btn icon-btn-danger" title={t.common.actions.delete} aria-label={text.deleteLabel} onClick={onDelete}>
              {icon("M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3")}
            </button>
          </div>
        )}
      </footer>
    </article>
  );
});

export default QuestionCard;
