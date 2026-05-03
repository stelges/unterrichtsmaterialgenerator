import { BLOCK_TYPES, validateMaterialPackage } from "./material-schema-v2.js";

const GENERATOR_CRITERIA_PATTERNS = [/altersgerecht/i, /Problemfrage ist/i, /Input ist/i, /Hauptaufgaben/i, /Generator/i, /Template/i];
const FOREIGN_SCRIPT_PATTERN = /[\u0600-\u06FF\u0400-\u04FF]/;

export function checkMaterialQuality(pkg) {
  const issues = [];
  const schemaCheck = validateMaterialPackage(pkg);
  if (!schemaCheck.ok) {
    for (const error of schemaCheck.errors) addIssue(issues, "schema", "high", error);
  }

  checkPages(pkg, issues);
  checkBlocks(pkg, issues);
  checkStudentChecks(pkg, issues);
  checkSelfDirection(pkg, issues);
  checkForeignCharacters(pkg, issues);

  return {
    ok: issues.filter((issue) => issue.severity === "high").length === 0,
    score: calculateScore(issues),
    issues,
    repairInstructions: issues.map((issue) => issue.repair).filter(Boolean),
  };
}

function checkPages(pkg, issues) {
  if (pkg.pages.length !== pkg.meta.pageCount) {
    addIssue(issues, "page_count", "high", `Gewählt: ${pkg.meta.pageCount}, erzeugt: ${pkg.pages.length}.`, "Seitenzahl exakt auf meta.pageCount setzen.");
  }

  const pageNumbers = pkg.pages.map((page) => page.pageNumber);
  const expected = Array.from({ length: pkg.pages.length }, (_, index) => index + 1);
  if (pageNumbers.join(",") !== expected.join(",")) {
    addIssue(issues, "page_numbers", "medium", "Seitennummern sind nicht fortlaufend.", "Pages fortlaufend von 1 bis pageCount nummerieren.");
  }
}

function checkBlocks(pkg, issues) {
  const allBlocks = pkg.pages.flatMap((page) => page.blocks.map((block) => ({ ...block, pageNumber: page.pageNumber })));
  const types = new Set(allBlocks.map((block) => block.type));

  if (!types.has(BLOCK_TYPES.KNOWLEDGE_BOX) && pkg.meta.templateMode !== "worksheet") {
    addIssue(issues, "knowledge", "high", "Es gibt keinen echten Wissenskasten.", "Einen knowledge_box-Block mit fachlichem Kurzinput ergänzen.");
  }
  if (!types.has(BLOCK_TYPES.WORKED_EXAMPLE) && pkg.meta.templateMode === "knowledge") {
    addIssue(issues, "worked_example", "high", "Es gibt kein ausgefülltes Beispiel.", "Einen worked_example-Block ergänzen.");
  }

  const taskBlocks = allBlocks.filter((block) => isTaskBlock(block.type));
  if (taskBlocks.length < 2) {
    addIssue(issues, "tasks", "high", "Es gibt zu wenige echte Aufgabenbausteine.", "Mindestens zwei strukturierte Aufgabenbausteine ergänzen.");
  }

  for (const task of taskBlocks) {
    if (!task.title) addIssue(issues, "task_title", "medium", `Aufgabe auf Seite ${task.pageNumber} hat keinen Titel.`, "Jede Aufgabe braucht einen klaren Titel.");
    if (!hasStudentInstruction(task)) addIssue(issues, "task_prompt", "high", `Aufgabe ${task.title || "ohne Titel"} hat keinen Schülerauftrag.`, "Einen klaren prompt, Titel oder Tabellenauftrag ergänzen.");
    if (!hasVisibleStudentProduct(task)) addIssue(issues, "student_product", "high", `Aufgabe ${task.title || "ohne Titel"} hat kein sichtbares Schülerprodukt.`, "Antwortformat, Tabelle, Zeilen oder Satzstarter ergänzen.");
  }
}

function checkStudentChecks(pkg, issues) {
  const checkBlocks = pkg.pages.flatMap((page) => page.blocks).filter((block) => block.type === BLOCK_TYPES.SELF_CHECK);
  if (checkBlocks.length === 0) {
    addIssue(issues, "self_check", "medium", "Es gibt keinen Schüler-Check.", "self_check-Block auf Sicherungsseite ergänzen.");
  }
  for (const block of checkBlocks) {
    for (const item of block.items || []) {
      if (GENERATOR_CRITERIA_PATTERNS.some((pattern) => pattern.test(item))) {
        addIssue(issues, "bad_check", "high", `Ungeeigneter Schüler-Check: ${item}`, "Nur Schülerleistungen prüfen, keine Generator- oder Designkriterien.");
      }
    }
  }
}

function checkSelfDirection(pkg, issues) {
  const hasWorkflow = pkg.pages.some((page) => page.blocks.some((block) => block.type === BLOCK_TYPES.STUDENT_WORKFLOW));
  if (!hasWorkflow) {
    addIssue(issues, "self_direction", "medium", "Es gibt keinen selbstständigen Arbeitsweg.", "student_workflow-Block auf Seite 1 ergänzen.");
  }
}

function checkForeignCharacters(pkg, issues) {
  const text = JSON.stringify(pkg);
  if (FOREIGN_SCRIPT_PATTERN.test(text)) {
    addIssue(issues, "foreign_script", "high", "Fremdsprachige Schriftzeichen gefunden.", "Betroffene Texte neu generieren oder entfernen.");
  }
}

function isTaskBlock(type) {
  return [
    BLOCK_TYPES.PREDICTION_TASK,
    BLOCK_TYPES.TRUE_FALSE_CORRECTION,
    BLOCK_TYPES.MATCHING_TABLE_TASK,
    BLOCK_TYPES.SHORT_ANSWER_TASK,
    BLOCK_TYPES.RESEARCH_TASK,
    BLOCK_TYPES.EXPERIMENT_PROTOCOL,
    BLOCK_TYPES.OBSERVATION_TABLE,
    BLOCK_TYPES.MERKSATZ_TASK,
    BLOCK_TYPES.REFLECTION_TASK,
  ].includes(type);
}

function hasStudentInstruction(block) {
  if (block.prompt || block.instruction || block.question) return true;
  if (block.title && [BLOCK_TYPES.TRUE_FALSE_CORRECTION, BLOCK_TYPES.MATCHING_TABLE_TASK, BLOCK_TYPES.OBSERVATION_TABLE, BLOCK_TYPES.REFLECTION_TASK].includes(block.type)) return true;
  if (Array.isArray(block.items) && block.items.length > 0) return true;
  if (Array.isArray(block.columns) && block.columns.length > 0) return true;
  if (Array.isArray(block.prompts) && block.prompts.length > 0) return true;
  if (Array.isArray(block.fields) && block.fields.length > 0) return true;
  return false;
}

function hasVisibleStudentProduct(block) {
  if (Number(block.answerLines) > 0) return true;
  if (block.sentenceStarter) return true;
  if (Array.isArray(block.columns) && (Array.isArray(block.rows) || Number(block.rows) > 0)) return true;
  if (Array.isArray(block.items) && block.items.length > 0) return true;
  if (Array.isArray(block.fields) && block.fields.length > 0) return true;
  if (Array.isArray(block.prompts) && block.prompts.length > 0) return true;
  if (Array.isArray(block.criteria) && block.criteria.length > 0) return true;
  return false;
}

function addIssue(issues, code, severity, message, repair = "") {
  issues.push({ code, severity, message, repair });
}

function calculateScore(issues) {
  const penalty = issues.reduce((sum, issue) => {
    if (issue.severity === "high") return sum + 18;
    if (issue.severity === "medium") return sum + 8;
    return sum + 3;
  }, 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}
