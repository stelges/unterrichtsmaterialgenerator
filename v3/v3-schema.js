export const MATERIAL_TYPES = Object.freeze({
  MINI_TEXT: "mini_text",
  KNOWLEDGE_BOX: "knowledge_box",
  WORKED_EXAMPLE: "worked_example",
  TERM_BANK: "term_bank",
  DATA_TABLE: "data_table",
  EXPERIMENT_INSTRUCTION: "experiment_instruction",
  RESEARCH_SOURCE: "research_source",
  VISUAL_PLACEHOLDER: "visual_placeholder",
});

export const TASK_TYPES = Object.freeze({
  PREDICT: "predict",
  EXPLAIN: "explain",
  MATCH: "match",
  TRUE_FALSE_CORRECT: "true_false_correct",
  SHORT_ANSWER: "short_answer",
  TABLE_COMPLETE: "table_complete",
  RESEARCH: "research",
  EXPERIMENT_PROTOCOL: "experiment_protocol",
  DRAW_OR_SKETCH: "draw_or_sketch",
  MERKSATZ: "merksatz",
  REFLECT: "reflect",
});

export const PAGE_PURPOSES = Object.freeze({
  HOOK: "hook",
  KNOWLEDGE: "knowledge",
  PRACTICE: "practice",
  SECURE: "secure",
  EXTEND: "extend",
});

export function newId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

export function createLearningDesign(input = {}) {
  return {
    schemaVersion: "3.0.0",
    meta: {
      title: input.thema || "Neues Thema",
      subject: input.fach || "Fach",
      className: input.klasse || "Klasse",
      duration: input.dauer || "60 Minuten",
      level: input.schwierigkeit || "mittel",
      pageCount: normalizePageCount(input.variant),
      createdAt: new Date().toISOString(),
    },
    learningDesign: {
      internalLearningGoal: input.stundenziel || "",
      studentQuestion: input.leitfrage || "",
      lessonStory: "",
      targetAnswer: "",
      successCriteria: [],
      keyConcepts: [],
      misconceptions: [],
      learningSteps: [],
    },
    materialInventory: [],
    taskSequence: [],
    coherenceReport: null,
    pageComposition: [],
    teacherNotes: {
      rationale: "",
      support: [],
      differentiation: [],
    },
    scobees: {
      title: input.thema || "Material",
      instruction: "",
      submission: "",
    },
  };
}

export function normalizePageCount(value) {
  if (value === "2p" || value === 2) return 2;
  if (value === "6p" || value === 6) return 6;
  return 4;
}

export function materialItem({ id, type, title, content, terms, rows, columns, sourceNote }) {
  return {
    id: id || newId("M"),
    type,
    title,
    content: content || "",
    terms: terms || [],
    rows: rows || [],
    columns: columns || [],
    sourceNote: sourceNote || "",
  };
}

export function taskItem({ id, type, title, prompt, uses, introduces, requiresConcepts, answerFormat, scaffold, expectedStudentProduct, options, items, rows, columns }) {
  return {
    id: id || newId("A"),
    type,
    title,
    prompt,
    uses: uses || [],
    introduces: introduces || [],
    requiresConcepts: requiresConcepts || [],
    answerFormat: answerFormat || "short_lines",
    scaffold: scaffold || "",
    expectedStudentProduct: expectedStudentProduct || "",
    options: options || [],
    items: items || [],
    rows: rows || [],
    columns: columns || [],
  };
}

export function pageSpec({ pageNumber, purpose, title, materialIds, taskIds }) {
  return {
    pageNumber,
    purpose,
    title,
    materialIds: materialIds || [],
    taskIds: taskIds || [],
  };
}

export function validateLearningDesign(design) {
  const errors = [];
  if (!design?.schemaVersion) errors.push("schemaVersion fehlt.");
  if (!design?.learningDesign?.studentQuestion) errors.push("studentQuestion fehlt.");
  if (!Array.isArray(design?.materialInventory)) errors.push("materialInventory fehlt.");
  if (!Array.isArray(design?.taskSequence)) errors.push("taskSequence fehlt.");
  if (!Array.isArray(design?.pageComposition)) errors.push("pageComposition fehlt.");
  return { ok: errors.length === 0, errors };
}
