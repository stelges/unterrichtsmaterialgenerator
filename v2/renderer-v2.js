import { BLOCK_TYPES } from "./material-schema-v2.js";

export function renderMaterialPackageV2(pkg) {
  return `
    <article class="material-v2">
      ${pkg.pages.map((page) => renderPage(pkg, page)).join("\n")}
    </article>
  `;
}

function renderPage(pkg, page) {
  return `
    <section class="v2-page" data-page="${escapeHtml(page.pageNumber)}" data-purpose="${escapeHtml(page.purpose)}">
      <header class="v2-page-header">
        <span>${escapeHtml(pkg.meta.subject)} · ${escapeHtml(pkg.meta.className)}</span>
        <strong>${escapeHtml(pkg.meta.title)}</strong>
      </header>
      <main class="v2-page-content">
        <p class="v2-kicker">Seite ${escapeHtml(page.pageNumber)}</p>
        <h2>${escapeHtml(page.title)}</h2>
        ${page.blocks.map((block) => renderBlock(block)).join("\n")}
      </main>
      <footer class="v2-page-footer">Seite ${escapeHtml(page.pageNumber)}</footer>
    </section>
  `;
}

export function renderBlock(block) {
  switch (block.type) {
    case BLOCK_TYPES.GOAL_BOX:
      return card("Ziel", `<p>${escapeHtml(block.text)}</p>`, "goal");
    case BLOCK_TYPES.STUDENT_WORKFLOW:
      return card("So arbeitest du", renderList(block.steps || []), "workflow");
    case BLOCK_TYPES.PROBLEM_IMPULSE:
      return card("Problemfrage", `<h3>${escapeHtml(block.question)}</h3>${block.prompt ? `<p>${escapeHtml(block.prompt)}</p>${lines(2)}` : ""}`, "problem");
    case BLOCK_TYPES.KNOWLEDGE_BOX:
      return card(block.title || "Wissenskasten", paragraphs(block.text), "knowledge");
    case BLOCK_TYPES.WORKED_EXAMPLE:
      return renderWorkedExample(block);
    case BLOCK_TYPES.TERM_TABLE:
      return renderTermTable(block);
    case BLOCK_TYPES.PREDICTION_TASK:
      return renderPredictionTask(block);
    case BLOCK_TYPES.TRUE_FALSE_CORRECTION:
      return renderTrueFalseTask(block);
    case BLOCK_TYPES.MATCHING_TABLE_TASK:
      return renderMatchingTask(block);
    case BLOCK_TYPES.SHORT_ANSWER_TASK:
      return renderShortAnswerTask(block);
    case BLOCK_TYPES.RESEARCH_TASK:
      return renderResearchTask(block);
    case BLOCK_TYPES.EXPERIMENT_PROTOCOL:
      return renderExperimentProtocol(block);
    case BLOCK_TYPES.OBSERVATION_TABLE:
      return renderObservationTable(block);
    case BLOCK_TYPES.MERKSATZ_TASK:
      return card(block.title || "Merksatz", `<p>${escapeHtml(block.prompt)}</p><p class="v2-starter">${escapeHtml(block.sentenceStarter || "Ich merke mir: …")}</p>${lines(4)}`, "task");
    case BLOCK_TYPES.REFLECTION_TASK:
      return card(block.title || "Reflexion", (block.prompts || []).map((prompt) => `<p class="v2-line-prompt">${escapeHtml(prompt)}</p>${lines(2)}`).join(""), "reflection");
    case BLOCK_TYPES.SELF_CHECK:
      return card("Check", renderChecklist(block.items || []), "check");
    case BLOCK_TYPES.SCOBEES_SUBMISSION:
      return card("Scobees-Abgabe", `<p>${escapeHtml(block.text)}</p>`, "scobees");
    default:
      return card("Unbekannter Block", `<pre>${escapeHtml(JSON.stringify(block, null, 2))}</pre>`, "warning");
  }
}

function renderWorkedExample(block) {
  return card("Ausgefülltes Beispiel", `
    <dl class="v2-example">
      <dt>Situation</dt><dd>${escapeHtml(block.situation)}</dd>
      <dt>Beobachtung / Information</dt><dd>${escapeHtml(block.observation)}</dd>
      <dt>Erklärung</dt><dd>${escapeHtml(block.explanation)}</dd>
    </dl>
  `, "example");
}

function renderTermTable(block) {
  const rows = block.terms || [];
  return card("Begriffstabelle", `
    <table class="v2-table">
      <thead><tr><th>Begriff</th><th>Bedeutung</th><th>Beispiel</th></tr></thead>
      <tbody>
        ${rows.map((row) => `<tr><td>${escapeHtml(row.term)}</td><td>${escapeHtml(row.explanation)}</td><td>${escapeHtml(row.example)}</td></tr>`).join("")}
        ${emptyRows(Math.max(0, 4 - rows.length), 3)}
      </tbody>
    </table>
  `, "table");
}

function renderPredictionTask(block) {
  return card(block.title || "Vorhersage", `
    <p>${escapeHtml(block.prompt)}</p>
    <div class="v2-options">${(block.options || []).map((option) => `<label><span class="v2-box"></span>${escapeHtml(option)}</label>`).join("")}</div>
    <p class="v2-starter">${escapeHtml(block.sentenceStarter || "Ich vermute, dass …, weil …")}</p>
    ${lines(3)}
  `, "task");
}

function renderTrueFalseTask(block) {
  return card(block.title || "Richtig oder falsch?", `
    <table class="v2-table compact">
      <thead><tr><th>Aussage</th><th>R</th><th>F</th><th>Korrektur, falls falsch</th></tr></thead>
      <tbody>
        ${(block.items || []).map((item) => `<tr><td>${escapeHtml(item.statement)}</td><td class="center">□</td><td class="center">□</td><td>${escapeHtml(item.correctionStarter || "Richtig ist: …")}</td></tr>`).join("")}
      </tbody>
    </table>
  `, "task");
}

function renderMatchingTask(block) {
  const columns = block.columns || ["Situation", "Antwort", "Begründung"];
  const rows = block.rows || ["", "", ""];
  return card(block.title || "Zuordnen", `
    <table class="v2-table spacious">
      <thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${columns.map((_, index) => `<td>${index === 0 ? escapeHtml(row) : ""}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  `, "task");
}

function renderShortAnswerTask(block) {
  return card(block.title || "Kurzantwort", `<p>${escapeHtml(block.prompt)}</p><p class="v2-starter">${escapeHtml(block.sentenceStarter || "Antwort:")}</p>${lines(block.answerLines || 4)}`, "task");
}

function renderResearchTask(block) {
  return card(block.title || "Rechercheauftrag", `
    <p>${escapeHtml(block.prompt)}</p>
    ${block.criteria?.length ? `<p class="v2-starter">Kriterien: ${block.criteria.map(escapeHtml).join(" · ")}</p>` : ""}
    <table class="v2-table spacious"><thead><tr><th>Quelle/Fundort</th><th>Ergebnis</th><th>Bewertung</th></tr></thead><tbody>${emptyRows(block.rows || 4, 3)}</tbody></table>
  `, "task");
}

function renderExperimentProtocol(block) {
  const fields = block.fields || ["Vermutung", "Material", "Durchführung", "Beobachtung", "Auswertung"];
  return card(block.title || "Versuchsprotokoll", `
    <p><strong>Forscherfrage:</strong> ${escapeHtml(block.question || "")}</p>
    ${fields.map((field) => `<p class="v2-line-prompt">${escapeHtml(field)}</p>${lines(field === "Durchführung" ? 3 : 2)}`).join("")}
  `, "task");
}

function renderObservationTable(block) {
  const columns = block.columns || ["Schritt", "Beobachtung", "Erklärung"];
  return card(block.title || "Beobachtungstabelle", `
    <table class="v2-table spacious"><thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>${emptyRows(block.rows || 4, columns.length)}</tbody></table>
  `, "task");
}

function card(title, content, variant = "default") {
  return `<section class="v2-card ${escapeHtml(variant)}"><h3>${escapeHtml(title)}</h3>${content}</section>`;
}

function paragraphs(text) {
  return String(text || "")
    .split(/\n{2,}|(?<=\.)\s+(?=[A-ZÄÖÜ])/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part)}</p>`)
    .join("");
}

function renderList(items) {
  return `<ol class="v2-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`;
}

function renderChecklist(items) {
  return `<ul class="v2-checklist">${items.map((item) => `<li><span class="v2-box"></span>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function lines(count) {
  return `<div class="v2-lines">${Array.from({ length: count }, () => "<span></span>").join("")}</div>`;
}

function emptyRows(rowCount, columnCount) {
  return Array.from({ length: rowCount }, () => `<tr>${Array.from({ length: columnCount }, () => "<td></td>").join("")}</tr>`).join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
