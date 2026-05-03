import { validateLearningDesign } from "./v3-schema.js";

const FORBIDDEN_REFERENCE_WORDS = [
  "bild",
  "abbildung",
  "foto",
  "diagramm",
  "video",
  "materialkarte",
  "station",
  "text m",
  "arbeitsblatt 2",
  "qr-code",
];

export function checkCoherenceV3(design) {
  const issues = [];
  const schema = validateLearningDesign(design);
  if (!schema.ok) {
    for (const error of schema.errors) issue(issues, "schema", "high", error, "Schema reparieren.");
  }

  const materialIds = new Set((design.materialInventory || []).map((item) => item.id));
  const taskIds = new Set((design.taskSequence || []).map((task) => task.id));
  const introducedConcepts = new Set();

  for (const material of design.materialInventory || []) {
    for (const term of material.terms || []) {
      if (term.term) introducedConcepts.add(normalize(term.term));
    }
  }

  for (const task of design.taskSequence || []) {
    for (const usedId of task.uses || []) {
      if (!materialIds.has(usedId)) {
        issue(issues, "missing_material_reference", "high", `Aufgabe '${task.title}' verweist auf '${usedId}', aber dieses Material existiert nicht.`, "Material ergänzen oder Verweis entfernen.");
      }
    }

    for (const concept of task.requiresConcepts || []) {
      const normalized = normalize(concept);
      if (!introducedConcepts.has(normalized)) {
        issue(issues, "concept_not_introduced", "medium", `Aufgabe '${task.title}' verlangt den Begriff '${concept}', der nicht im Material-Inventar eingeführt wurde.`, "Begriff vorher einführen oder Aufgabe anpassen.");
      }
    }

    const text = `${task.title || ""} ${task.prompt || ""} ${task.scaffold || ""}`.toLowerCase();
    for (const forbidden of FORBIDDEN_REFERENCE_WORDS) {
      if (text.includes(forbidden) && !materialInventoryContains(design, forbidden)) {
        issue(issues, "phantom_reference", "high", `Aufgabe '${task.title}' erwähnt '${forbidden}', aber dazu gibt es kein passendes Material im Inventar.`, "Verweis entfernen oder passendes Material mit eindeutiger ID hinzufügen.");
      }
    }

    if (!task.expectedStudentProduct) {
      issue(issues, "missing_student_product", "high", `Aufgabe '${task.title}' hat kein erwartetes Schülerprodukt.`, "expectedStudentProduct ergänzen.");
    }
  }

  for (const page of design.pageComposition || []) {
    for (const materialId of page.materialIds || []) {
      if (!materialIds.has(materialId)) issue(issues, "page_missing_material", "high", `Seite ${page.pageNumber} nutzt Material '${materialId}', das nicht existiert.`, "Seitenkomposition reparieren.");
    }
    for (const taskId of page.taskIds || []) {
      if (!taskIds.has(taskId)) issue(issues, "page_missing_task", "high", `Seite ${page.pageNumber} nutzt Aufgabe '${taskId}', die nicht existiert.`, "Seitenkomposition reparieren.");
    }
  }

  checkLearningProgression(design, issues);
  checkQuestionClosure(design, issues);

  const score = Math.max(0, 100 - issues.reduce((sum, item) => sum + (item.severity === "high" ? 18 : item.severity === "medium" ? 8 : 3), 0));
  return { ok: issues.every((item) => item.severity !== "high"), score, issues };
}

function checkLearningProgression(design, issues) {
  const purposes = (design.pageComposition || []).map((page) => page.purpose);
  const hasKnowledge = purposes.includes("knowledge") || (design.materialInventory || []).some((item) => item.type === "knowledge_box");
  const hasPractice = (design.taskSequence || []).length >= 2;
  const hasSecure = purposes.includes("secure") || (design.taskSequence || []).some((task) => task.type === "merksatz" || task.type === "reflect");

  if (!hasKnowledge) issue(issues, "no_knowledge_building", "high", "Der Lernweg enthält keinen klaren Wissensaufbau.", "Wissenskasten oder fachlichen Mini-Text ergänzen.");
  if (!hasPractice) issue(issues, "too_little_practice", "high", "Der Lernweg enthält zu wenig Verarbeitung oder Anwendung.", "Mindestens zwei Aufgaben ergänzen.");
  if (!hasSecure) issue(issues, "no_closure", "medium", "Die Sicherung ist zu schwach oder fehlt.", "Merksatz/Reflexion zur Stundenfrage ergänzen.");
}

function checkQuestionClosure(design, issues) {
  const question = design.learningDesign?.studentQuestion || "";
  const target = design.learningDesign?.targetAnswer || "";
  if (!question.trim()) issue(issues, "missing_student_question", "high", "Es gibt keine klare Stundenfrage für die Schülerseite.", "studentQuestion ergänzen.");
  if (!target.trim()) issue(issues, "missing_target_answer", "medium", "Es gibt keine Zielantwort zur Stundenfrage.", "targetAnswer ergänzen, damit die Sicherung logisch prüfbar ist.");
}

function materialInventoryContains(design, word) {
  const text = JSON.stringify(design.materialInventory || []).toLowerCase();
  return text.includes(word);
}

function normalize(value) {
  return String(value || "").toLowerCase().trim();
}

function issue(issues, type, severity, message, fix) {
  issues.push({ type, severity, message, fix });
}
