export const BLOCK_TYPES = Object.freeze({
  GOAL_BOX: "goal_box",
  STUDENT_WORKFLOW: "student_workflow",
  PROBLEM_IMPULSE: "problem_impulse",
  KNOWLEDGE_BOX: "knowledge_box",
  WORKED_EXAMPLE: "worked_example",
  TERM_TABLE: "term_table",
  PREDICTION_TASK: "prediction_task",
  TRUE_FALSE_CORRECTION: "true_false_correction",
  MATCHING_TABLE_TASK: "matching_table_task",
  SHORT_ANSWER_TASK: "short_answer_task",
  RESEARCH_TASK: "research_task",
  EXPERIMENT_PROTOCOL: "experiment_protocol",
  OBSERVATION_TABLE: "observation_table",
  MERKSATZ_TASK: "merksatz_task",
  REFLECTION_TASK: "reflection_task",
  SELF_CHECK: "self_check",
  SCOBEES_SUBMISSION: "scobees_submission",
});

export const PAGE_PURPOSES = Object.freeze({
  ORIENTATION: "orientation",
  KNOWLEDGE_BUILDING: "knowledge_building",
  PRACTICE: "practice",
  SECURING: "securing",
  DIFFERENTIATION: "differentiation",
  EXPORT_CHECK: "export_check",
});

export const TEMPLATE_MODES = Object.freeze({
  KNOWLEDGE: "knowledge",
  EXPERIMENT: "experiment",
  EXPLORATION: "exploration",
  WORKSHEET: "worksheet",
});

export function createEmptyMaterialPackage() {
  return {
    schemaVersion: "2.0.0",
    meta: {
      title: "",
      subject: "",
      className: "",
      duration: "",
      templateMode: TEMPLATE_MODES.KNOWLEDGE,
      pageCount: 4,
      level: "mittel",
      createdAt: new Date().toISOString(),
    },
    didacticPlan: {
      learningGoal: "",
      guidingQuestion: "",
      coreConcept: "",
      learningPath: [],
      prerequisites: [],
      misconceptions: [],
      successCriteria: [],
    },
    knowledgeCore: {
      shortText: "",
      terms: [],
      workedExample: null,
      everydayConnections: [],
    },
    pages: [],
    teacherNotes: {
      flow: [],
      pitfalls: [],
      differentiation: "",
    },
    scobees: {
      title: "",
      instructions: "",
      submission: "",
    },
    qualityReport: null,
  };
}

export function createBlock(type, payload = {}) {
  return {
    id: cryptoRandomId(),
    type,
    ...payload,
  };
}

export function cryptoRandomId() {
  return `block_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function page(pageNumber, purpose, title, blocks = []) {
  return { pageNumber, purpose, title, blocks };
}

export function normalizePageCount(value) {
  if (value === "2p" || value === 2) return 2;
  if (value === "6p" || value === 6) return 6;
  return 4;
}

export function validateMaterialPackage(pkg) {
  const errors = [];

  if (!pkg || typeof pkg !== "object") errors.push("MaterialPackage fehlt.");
  if (!pkg?.meta?.title) errors.push("meta.title fehlt.");
  if (!pkg?.didacticPlan?.learningGoal) errors.push("didacticPlan.learningGoal fehlt.");
  if (!pkg?.didacticPlan?.guidingQuestion) errors.push("didacticPlan.guidingQuestion fehlt.");
  if (!Array.isArray(pkg?.pages) || pkg.pages.length === 0) errors.push("pages fehlen.");

  for (const currentPage of pkg?.pages || []) {
    if (!currentPage.pageNumber) errors.push(`Seite ohne pageNumber: ${currentPage.title || "unbenannt"}`);
    if (!currentPage.purpose) errors.push(`Seite ${currentPage.pageNumber}: purpose fehlt.`);
    if (!Array.isArray(currentPage.blocks) || currentPage.blocks.length === 0) {
      errors.push(`Seite ${currentPage.pageNumber}: keine Blocks.`);
    }
    for (const block of currentPage.blocks || []) {
      if (!block.type) errors.push(`Seite ${currentPage.pageNumber}: Block ohne type.`);
      if (!Object.values(BLOCK_TYPES).includes(block.type)) {
        errors.push(`Seite ${currentPage.pageNumber}: unbekannter Blocktyp ${block.type}.`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
