import { MATERIAL_TYPES, TASK_TYPES } from "./v3-schema.js";

export function renderLearningDesignV3(design) {
  const materialMap = buildMap(design.materialInventory);
  const taskMap = buildMap(design.taskSequence);
  return `<article class="material-v2">${(design.pageComposition || []).map((p) => renderPage(design, p, materialMap, taskMap)).join("\n")}</article>`;
}

function buildMap(arr) {
  return Object.fromEntries((arr || []).map((item) => [item.id, item]));
}

function renderPage(design, page, materialMap, taskMap) {
  const materials = (page.materialIds || []).map((id) => materialMap[id]).filter(Boolean);
  const tasks = (page.taskIds || []).map((id) => taskMap[id]).filter(Boolean);
  return `
<section class="v2-page" data-page="${esc(page.pageNumber)}" data-purpose="${esc(page.purpose)}">
  <header class="v2-page-header">
    <span>${esc(design.meta.subject)} · ${esc(design.meta.className)}</span>
    <strong>${esc(design.meta.title)}</strong>
  </header>
  <main class="v2-page-content">
    <p class="v2-kicker">Seite ${esc(page.pageNumber)}</p>
    <h2>${esc(page.title)}</h2>
    ${page.purpose === "hook" && design.learningDesign?.studentQuestion ? renderQuestionBanner(design.learningDesign.studentQuestion) : ""}
    ${materials.map(renderMaterial).join("\n")}
    ${tasks.map(renderTask).join("\n")}
    ${page.purpose === "secure" ? renderSelfCheck(design) : ""}
    ${page.purpose === "secure" && design.scobees?.submission ? renderScobees(design.scobees.submission) : ""}
  </main>
  <footer class="v2-page-footer">Seite ${esc(page.pageNumber)} · ${esc(design.meta.title)}</footer>
</section>`;
}

function renderQuestionBanner(question) {
  return `<div class="v3-question-banner"><span class="v3-question-label">Forscherfrage</span><p>${esc(question)}</p></div>`;
}

function renderSelfCheck(design) {
  const criteria = design.learningDesign?.successCriteria || [];
  if (!criteria.length) return "";
  return card("Check", `<ul class="v2-checklist">${criteria.map((c) => `<li><span class="v2-box"></span>${esc(c)}</li>`).join("")}</ul>`, "check");
}

function renderScobees(submission) {
  return card("Scobees-Abgabe", `<p>${esc(submission)}</p>`, "scobees");
}

// ── Material renderers ────────────────────────────────────────────────────────

export function renderMaterial(material) {
  switch (material.type) {
    case MATERIAL_TYPES.MINI_TEXT:
      return card(material.title || "Startimpuls", `<p>${esc(material.content)}</p>`, "knowledge");
    case MATERIAL_TYPES.KNOWLEDGE_BOX:
      return renderKnowledgeBox(material);
    case MATERIAL_TYPES.WORKED_EXAMPLE:
      return renderWorkedExample(material);
    case MATERIAL_TYPES.TERM_BANK:
      return renderTermBank(material);
    case MATERIAL_TYPES.DATA_TABLE:
      return renderDataTable(material);
    case MATERIAL_TYPES.EXPERIMENT_INSTRUCTION:
      return renderExperimentInstruction(material);
    case MATERIAL_TYPES.RESEARCH_SOURCE:
      return card(
        material.title || "Quelle",
        `<p>${esc(material.content)}</p>${material.sourceNote ? `<p class="v2-starter">Fundort: ${esc(material.sourceNote)}</p>` : ""}`,
        "knowledge"
      );
    case MATERIAL_TYPES.VISUAL_PLACEHOLDER:
      return card(
        material.title || "Abbildung",
        `<div class="v3-visual-placeholder">${esc(material.content || "Hier Abbildung einfügen.")}</div>`,
        "example"
      );
    default:
      return card(material.title || "Material", `<p>${esc(material.content || "")}</p>`, "default");
  }
}

function renderKnowledgeBox(material) {
  const terms = material.terms || [];
  return card(
    material.title || "Wissenskasten",
    `<p>${esc(material.content)}</p>
    ${terms.length ? `<table class="v2-table">
      <thead><tr><th>Begriff</th><th>Bedeutung</th><th>Beispiel</th></tr></thead>
      <tbody>${terms.map((t) => `<tr><td><strong>${esc(t.term)}</strong></td><td>${esc(t.explanation)}</td><td>${esc(t.example)}</td></tr>`).join("")}</tbody>
    </table>` : ""}`,
    "knowledge"
  );
}

function renderWorkedExample(material) {
  const situation = extractField(material.content, "Situation");
  const observation = extractField(material.content, "Beobachtung");
  const explanation = extractField(material.content, "Erklärung");
  if (situation && explanation) {
    return card(
      material.title || "Ausgefülltes Beispiel",
      `<dl class="v2-example">
        <dt>Situation</dt><dd>${esc(situation)}</dd>
        ${observation ? `<dt>Beobachtung</dt><dd>${esc(observation)}</dd>` : ""}
        <dt>Erklärung</dt><dd>${esc(explanation)}</dd>
      </dl>`,
      "example"
    );
  }
  return card(material.title || "Ausgefülltes Beispiel", `<p>${esc(material.content)}</p>`, "example");
}

function renderTermBank(material) {
  const terms = material.terms || [];
  const cols = material.columns || ["Begriff", "Bedeutung", "Beispiel"];
  return card(
    material.title || "Begriffe",
    `<table class="v2-table">
      <thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>
        ${terms.map((t) => `<tr><td><strong>${esc(t.term)}</strong></td><td>${esc(t.explanation)}</td><td>${esc(t.example || "")}</td></tr>`).join("")}
        ${emptyRows(Math.max(0, 4 - terms.length), cols.length)}
      </tbody>
    </table>`,
    "table"
  );
}

function renderDataTable(material) {
  const cols = material.columns || [];
  const rows = material.rows || [];
  if (!cols.length) return card(material.title || "Tabelle", `<p>${esc(material.content || "")}</p>`, "table");
  return card(
    material.title || "Tabelle",
    `<table class="v2-table spacious">
      <thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map((r) => `<tr>${Array.isArray(r) ? r.map((cell) => `<td>${esc(cell)}</td>`).join("") : `<td>${esc(r)}</td>${emptyRowCells(cols.length - 1)}`}</tr>`).join("")}
        ${rows.length < 4 ? emptyRows(4 - rows.length, cols.length) : ""}
      </tbody>
    </table>`,
    "table"
  );
}

function renderExperimentInstruction(material) {
  const steps = material.rows || String(material.content || "").split(/\n/).filter(Boolean);
  return card(
    material.title || "Versuchsanleitung",
    `${material.content && !material.rows?.length ? `<p>${esc(material.content)}</p>` : ""}
    ${steps.length ? `<ol class="v2-list">${steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}`,
    "knowledge"
  );
}

// ── Task renderers ────────────────────────────────────────────────────────────

export function renderTask(task) {
  switch (task.type) {
    case TASK_TYPES.PREDICT:
      return renderPredictTask(task);
    case TASK_TYPES.EXPLAIN:
      return renderExplainTask(task);
    case TASK_TYPES.MATCH:
      return renderMatchTask(task);
    case TASK_TYPES.TRUE_FALSE_CORRECT:
      return renderTrueFalseTask(task);
    case TASK_TYPES.SHORT_ANSWER:
      return renderShortAnswerTask(task);
    case TASK_TYPES.TABLE_COMPLETE:
      return renderTableCompleteTask(task);
    case TASK_TYPES.RESEARCH:
      return renderResearchTask(task);
    case TASK_TYPES.EXPERIMENT_PROTOCOL:
      return renderExperimentProtocolTask(task);
    case TASK_TYPES.DRAW_OR_SKETCH:
      return renderDrawTask(task);
    case TASK_TYPES.MERKSATZ:
      return renderMerksatzTask(task);
    case TASK_TYPES.REFLECT:
      return renderReflectTask(task);
    default:
      return card(task.title || "Aufgabe", `<p>${esc(task.prompt || "")}</p>${lines(3)}`, "task");
  }
}

function renderPredictTask(task) {
  const opts = task.options || [];
  return card(
    task.title || "Vermutung",
    `<p>${esc(task.prompt)}</p>
    ${opts.length ? `<div class="v2-options">${opts.map((o) => `<label><span class="v2-box"></span>${esc(o)}</label>`).join("")}</div>` : ""}
    ${task.scaffold ? `<p class="v2-starter">${esc(task.scaffold)}</p>` : ""}
    ${lines(answerLineCount(task.answerFormat, 3))}`,
    "task"
  );
}

function renderExplainTask(task) {
  return card(
    task.title || "Erklären",
    `<p>${esc(task.prompt)}</p>
    ${task.scaffold ? `<p class="v2-starter">${esc(task.scaffold)}</p>` : ""}
    ${lines(answerLineCount(task.answerFormat, 4))}`,
    "task"
  );
}

function renderMatchTask(task) {
  const cols = task.columns || ["Situation", "Begriff", "Begründung"];
  const rows = task.rows || [];
  return card(
    task.title || "Zuordnen",
    `<p>${esc(task.prompt || "Ordne zu.")}</p>
    <table class="v2-table spacious">
      <thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${esc(r)}</td>${emptyRowCells(cols.length - 1)}</tr>`).join("")}${rows.length < 3 ? emptyRows(3 - rows.length, cols.length) : ""}</tbody>
    </table>`,
    "task"
  );
}

function renderTrueFalseTask(task) {
  const items = task.items || [];
  return card(
    task.title || "Richtig oder falsch?",
    `<p>${esc(task.prompt || "Kreuze an und verbessere falsche Aussagen.")}</p>
    <table class="v2-table compact">
      <thead><tr><th>Aussage</th><th>R</th><th>F</th><th>Korrektur, falls falsch</th></tr></thead>
      <tbody>${items.map((item) => `<tr><td>${esc(item.statement)}</td><td class="center">□</td><td class="center">□</td><td>${esc(item.correctionStarter || "Richtig ist: …")}</td></tr>`).join("")}</tbody>
    </table>`,
    "task"
  );
}

function renderShortAnswerTask(task) {
  return card(
    task.title || "Kurzantwort",
    `<p>${esc(task.prompt)}</p>
    ${task.scaffold ? `<p class="v2-starter">${esc(task.scaffold)}</p>` : ""}
    ${lines(answerLineCount(task.answerFormat, 4))}`,
    "task"
  );
}

function renderTableCompleteTask(task) {
  const cols = task.columns || ["Merkmal", "Ergebnis", "Begründung"];
  const rows = task.rows || [];
  return card(
    task.title || "Tabelle ausfüllen",
    `<p>${esc(task.prompt || "Fülle die Tabelle aus.")}</p>
    <table class="v2-table spacious">
      <thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${esc(r)}</td>${emptyRowCells(cols.length - 1)}</tr>`).join("")}${rows.length < 4 ? emptyRows(4 - rows.length, cols.length) : ""}</tbody>
    </table>`,
    "task"
  );
}

function renderResearchTask(task) {
  const criteria = task.scaffold ? [task.scaffold] : [];
  return card(
    task.title || "Rechercheauftrag",
    `<p>${esc(task.prompt)}</p>
    ${criteria.length ? `<p class="v2-starter">Kriterien: ${criteria.map(esc).join(" · ")}</p>` : ""}
    <table class="v2-table spacious">
      <thead><tr><th>Quelle / Fundort</th><th>Ergebnis</th><th>Bewertung</th></tr></thead>
      <tbody>${emptyRows(4, 3)}</tbody>
    </table>`,
    "task"
  );
}

function renderExperimentProtocolTask(task) {
  const fields = task.columns || ["Vermutung", "Material", "Durchführung", "Beobachtung", "Auswertung"];
  return card(
    task.title || "Versuchsprotokoll",
    `${task.prompt ? `<p><strong>Forscherfrage:</strong> ${esc(task.prompt)}</p>` : ""}
    ${fields.map((f) => `<p class="v2-line-prompt">${esc(f)}</p>${lines(f === "Durchführung" || f === "Auswertung" ? 3 : 2)}`).join("")}`,
    "task"
  );
}

function renderDrawTask(task) {
  return card(
    task.title || "Skizzieren",
    `<p>${esc(task.prompt)}</p>
    ${task.scaffold ? `<p class="v2-starter">${esc(task.scaffold)}</p>` : ""}
    <div class="v3-draw-box"></div>`,
    "task"
  );
}

function renderMerksatzTask(task) {
  return card(
    task.title || "Stundenfrage beantworten",
    `<p>${esc(task.prompt)}</p>
    ${task.scaffold ? `<p class="v2-starter">${esc(task.scaffold)}</p>` : ""}
    ${lines(answerLineCount(task.answerFormat, 4))}`,
    "task"
  );
}

function renderReflectTask(task) {
  const prompts = task.items || (task.prompt ? [task.prompt] : ["Das habe ich verstanden:", "Das ist noch unsicher:", "Ein Beispiel aus dem Alltag:"]);
  return card(
    task.title || "Reflexion",
    prompts.map((p) => `<p class="v2-line-prompt">${esc(p)}</p>${lines(2)}`).join(""),
    "reflection"
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function card(title, content, variant = "default") {
  return `<section class="v2-card ${esc(variant)}"><h3>${esc(title)}</h3>${content}</section>`;
}

function lines(count) {
  return `<div class="v2-lines">${Array.from({ length: count }, () => "<span></span>").join("")}</div>`;
}

function emptyRows(rowCount, colCount) {
  return Array.from({ length: rowCount }, () => `<tr>${Array.from({ length: colCount }, () => "<td></td>").join("")}</tr>`).join("");
}

function emptyRowCells(count) {
  return Array.from({ length: count }, () => "<td></td>").join("");
}

function answerLineCount(answerFormat, fallback) {
  if (answerFormat === "one_sentence") return 2;
  if (answerFormat === "merksatz") return 4;
  if (answerFormat === "short_lines") return 4;
  if (answerFormat === "check_and_correct") return 0;
  return fallback;
}

function extractField(text, label) {
  const regex = new RegExp(`${label}[^:]*:\\s*([^\\n]+)`, "i");
  const match = String(text || "").match(regex);
  return match ? match[1].trim() : "";
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
