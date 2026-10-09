"use client";

import type { ReactElement, ReactNode } from "react";
import { QUESTION_TYPES } from "@/lib/constants";
import { IdeasEditor, newOptionId, OptionsEditor, ReferenceField, type EditorProps } from "./fields";
import type { DraftErrors, QuestionDraft, QuestionType, TeacherQuestion, TypePayload } from "./types";

/**
 * Everything the builder needs to know about one kind of question.
 * To add a type: add its id to QUESTION_TYPES (src/lib/constants.ts) and an entry here.
 */
export interface QuestionTypeDef {
  id: QuestionType;
  label: string;
  description: string;
  icon: ReactNode;
  /** Type-specific part of the card, under the prompt. */
  Editor: (props: EditorProps) => ReactElement;
  /** Errors for the type-specific fields (the prompt is checked for every type). */
  validate: (draft: QuestionDraft) => DraftErrors;
  /** Fields this type contributes to the API's question input. */
  toPayload: (draft: QuestionDraft) => TypePayload;
  /** How students will answer, shown in the collapsed card. */
  answerPreview: "line" | "box" | "choices";
}

const svg = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);

const requireReference = (draft: QuestionDraft, message: string): DraftErrors =>
  draft.reference.trim() ? {} : { reference: message };

/** Non-idea types keep any criteria the question already had (e.g. seeded rubrics). */
const passthroughCriteria = (draft: QuestionDraft): TypePayload => ({
  reference: draft.reference.trim(),
  ...(draft.keptCriteria?.length ? { criteria: draft.keptCriteria } : {}),
});

export const QUESTION_TYPE_DEFS: Record<QuestionType, QuestionTypeDef> = {
  SHORT_ANSWER: {
    id: "SHORT_ANSWER",
    label: "Short answer",
    description: "A sentence or two, checked against a model answer.",
    icon: svg(<path d="M4 9h16M4 15h9" />),
    answerPreview: "line",
    Editor: (props) => (
      <ReferenceField
        {...props}
        label="Model answer"
        help="What a complete answer says. Students never see it."
        placeholder="e.g. Because the treaty transferred sovereignty to…"
        rows={2}
      />
    ),
    validate: (d) => requireReference(d, "* please add a model answer"),
    toPayload: passthroughCriteria,
  },

  KEY_IDEAS: {
    id: "KEY_IDEAS",
    label: "Key ideas",
    description: "An explanation that must include specific ideas; Gemma tracks each one.",
    icon: svg(
      <>
        <path d="M9 18h6M10 21h4" />
        <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" />
      </>,
    ),
    answerPreview: "box",
    Editor: (props) => (
      <>
        <ReferenceField
          {...props}
          label="Model answer"
          help="A full answer covering every idea. Students never see it."
          placeholder="e.g. Civil disobedience is public, non-violent law-breaking that…"
          rows={3}
        />
        <IdeasEditor {...props} />
      </>
    ),
    validate: (d) => {
      const errors: DraftErrors = requireReference(d, "* please add a model answer");
      if (!d.ideas.length) errors.ideas = "* add at least one key idea";
      const ideaErrors = d.ideas.map((idea) => (idea.text.trim() ? undefined : "* describe this idea or remove it"));
      if (ideaErrors.some(Boolean)) errors.ideaErrors = ideaErrors;
      return errors;
    },
    toPayload: (d) => ({
      reference: d.reference.trim(),
      criteria: d.ideas.map((idea, i) => ({
        key: `idea${i + 1}`,
        weight: 1 / d.ideas.length,
        description: idea.text.trim(),
        ...(idea.hint.trim() ? { hint: idea.hint.trim() } : {}),
      })),
    }),
  },

  ESSAY: {
    id: "ESSAY",
    label: "Essay",
    description: "A longer argument, judged against your rubric.",
    icon: svg(<path d="M4 6h16M4 10h16M4 14h16M4 18h10" />),
    answerPreview: "box",
    Editor: (props) => (
      <ReferenceField
        {...props}
        label="Rubric"
        help="What a strong essay does, one point per line. Students never see it."
        placeholder={"1. Takes a clear position.\n2. Gives a principled argument.\n3. Addresses a counterargument."}
        rows={5}
      />
    ),
    validate: (d) => requireReference(d, "* please add a rubric"),
    toPayload: passthroughCriteria,
  },

  MULTIPLE_CHOICE: {
    id: "MULTIPLE_CHOICE",
    label: "Multiple choice",
    description: "Students pick from options; marked exactly, no AI needed.",
    icon: svg(
      <>
        <circle cx="6" cy="7" r="2" />
        <circle cx="6" cy="17" r="2" />
        <path d="M11 7h9M11 17h9" />
      </>,
    ),
    answerPreview: "choices",
    Editor: (props) => <OptionsEditor {...props} />,
    validate: (d) => {
      const errors: DraftErrors = {};
      if (d.options.length < 2) errors.options = "* add at least two options";
      else if (!d.options.some((o) => o.correct)) errors.options = "* tick the correct option";
      const optionErrors = d.options.map((o) => (o.text.trim() ? undefined : "* write this option or remove it"));
      if (optionErrors.some(Boolean)) errors.optionErrors = optionErrors;
      return errors;
    },
    toPayload: (d) => {
      const options = d.options.map((o) => ({ id: o.id, text: o.text.trim(), correct: o.correct }));
      return {
        // The API needs a reference; for choices it records the key for teachers
        reference: `Correct: ${options.filter((o) => o.correct).map((o) => o.text).join("; ") || "(none)"}`,
        options,
      };
    },
  },
};

export const TYPE_LIST = QUESTION_TYPES.map((t) => QUESTION_TYPE_DEFS[t]);

// ---------------------------------------------------------------- Drafts

const newUid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `q-${Date.now()}-${Math.random()}`;

const blankOption = () => ({ id: newOptionId(), text: "", correct: false });

/** Change a draft's type, keeping what was written and seeding the new type's fields. */
export function switchType(d: QuestionDraft, type: QuestionType): QuestionDraft {
  return {
    ...d,
    type,
    keptCriteria: null,
    ideas: type === "KEY_IDEAS" && !d.ideas.length ? [{ text: "", hint: "" }] : d.ideas,
    options: type === "MULTIPLE_CHOICE" && !d.options.length ? [blankOption(), blankOption()] : d.options,
  };
}

export function emptyDraft(type: QuestionType): QuestionDraft {
  return switchType(
    { uid: newUid(), type, prompt: "", points: 1, reference: "", ideas: [], options: [], keptCriteria: null },
    type,
  );
}

export function draftFromQuestion(q: TeacherQuestion): QuestionDraft {
  const type = QUESTION_TYPE_DEFS[q.type] ? q.type : "SHORT_ANSWER";
  const criteria = Array.isArray(q.criteria) ? q.criteria : null;
  return {
    uid: newUid(),
    type,
    prompt: q.prompt,
    points: q.points,
    reference: q.reference,
    ideas:
      type === "KEY_IDEAS" && criteria
        ? criteria.map((c) => ({ text: c.description ?? "", hint: c.hint ?? "" }))
        : [],
    options: type === "MULTIPLE_CHOICE" && Array.isArray(q.options) ? q.options.map((o) => ({ ...o })) : [],
    keptCriteria: type === "KEY_IDEAS" || type === "MULTIPLE_CHOICE" ? null : criteria,
  };
}

export const duplicateDraft = (d: QuestionDraft): QuestionDraft => ({
  ...d,
  uid: newUid(),
  ideas: d.ideas.map((i) => ({ ...i })),
  options: d.options.map((o) => ({ ...o, id: newOptionId() })),
});

/** Nothing typed yet (e.g. the starter question); not counted as an unsaved change. */
export const isBlankDraft = (d: QuestionDraft) =>
  !d.prompt.trim() &&
  !d.reference.trim() &&
  d.ideas.every((i) => !i.text.trim() && !i.hint.trim()) &&
  d.options.every((o) => !o.text.trim() && !o.correct);

/** All errors for one draft; empty object when it can be saved. */
export function validateDraft(d: QuestionDraft): DraftErrors {
  const errors = QUESTION_TYPE_DEFS[d.type].validate(d);
  if (!d.prompt.trim()) errors.prompt = "* please write the question";
  if (!Number.isInteger(d.points) || d.points < 1 || d.points > 1000) errors.points = "* 1–1000 points";
  return errors;
}

export const hasErrors = (e: DraftErrors) =>
  Boolean(
    e.prompt || e.reference || e.points || e.ideas || e.options ||
      e.ideaErrors?.some(Boolean) || e.optionErrors?.some(Boolean),
  );

/** The `questions` array for PATCH /api/assignments/:id. */
export function toQuestionsPayload(drafts: QuestionDraft[]) {
  return drafts.map((d, order) => ({
    type: d.type,
    prompt: d.prompt.trim(),
    points: d.points,
    order,
    ...QUESTION_TYPE_DEFS[d.type].toPayload(d),
  }));
}
