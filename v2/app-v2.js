import { buildMaterialPackageV2 } from "./package-builder-v2.js";
import { checkMaterialQuality } from "./quality-check-v2.js";
import { renderMaterialPackageV2 } from "./renderer-v2.js";

const form = document.querySelector("#v2Form");
const preview = document.querySelector("#v2Preview");
const qualityOutput = document.querySelector("#qualityOutput");
const statusPill = document.querySelector("#statusPill");
const briefButton = document.querySelector("#briefButton");
const briefPanel = document.querySelector("#briefPanel");
const briefOutput = document.querySelector("#briefOutput");
const briefFeedback = document.querySelector("#briefFeedback");
const reviseBriefButton = document.querySelector("#reviseBriefButton");
const acceptBriefButton = document.querySelector("#acceptBriefButton");
const makeEasierButton = document.querySelector("#makeEasierButton");
const makeExperimentalButton = document.querySelector("#makeExperimentalButton");
const makeResearchButton = document.querySelector("#makeResearchButton");
const printButton = document.querySelector("#printButton");
const downloadHtmlButton = document.querySelector("#downloadHtmlButton");
const downloadJsonButton = document.querySelector("#downloadJsonButton");
const downloadScobeesButton = document.querySelector("#downloadScobeesButton");
const downloadTeacherButton = document.querySelector("#downloadTeacherButton");
const resetButton = document.querySelector("#resetButton");
const stepBrief = document.querySelector("#stepBrief");
const stepPlan = document.querySelector("#stepPlan");
const stepCompile = document.querySelector("#stepCompile");

const draftKey = "materialCompiler.v2.input";
const packageKey = "materialCompiler.v2.package";
const briefKey = "materialCompiler.v2.brief";
let currentPackage = null;
let currentQuality = null;
let currentSource = "fallback";
let currentBrief = null;

function getFormData() {
  const data = new FormData(form);
  return {
    fach: data.get("fach")?.trim() || "",
    klasse: data.get("klasse")?.trim() || "",
    thema: data.get("thema")?.trim() || "",
    stundenziel: data.get("stundenziel")?.trim() || "",
    leitfrage: data.get("leitfrage")?.trim() || "",
    dauer: data.get("dauer")?.trim() || "",
    schwierigkeit: data.get("schwierigkeit") || "mittel",
    templateMode: data.get("templateMode") || "knowledge",
    variant: data.get("variant") || "4p",
    inhalte: data.get("inhalte")?.trim() || "",
    vorwissen: data.get("vorwissen")?.trim() || "",
    hinweise: data.get("hinweise")?.trim() || "",
    scobeesSubmission: data.get("scobeesSubmission")?.trim() || "",
  };
}

function setFormData(data) {
  for (const [key, value] of Object.entries(data || {})) {
    const field = form.elements[key];
    if (!field) continue;
    if (field instanceof RadioNodeList) {
      const radio = Array.from(field).find((item) => item.value === value);
      if (radio) radio.checked = true;
    } else {
      field.value = value;
    }
  }
}

function setActiveStep(step) {
  [stepBrief, stepPlan, stepCompile].forEach((item) => item?.classList.remove("active"));
  if (step === "brief") stepBrief?.classList.add("active");
  if (step === "plan") stepPlan?.classList.add("active");
  if (step === "compile") stepCompile?.classList.add("active");
}

async function createBrief(extraInstruction = "") {
  const feedbackText = briefFeedback?.value?.trim() || "";
  const data = {
    ...getFormData(),
    extraInstruction: [extraInstruction, feedbackText ? `Feedback des Nutzers zum vorherigen Vorschlag: ${feedbackText}` : ""].filter(Boolean).join("\n"),
    previousBrief: currentBrief || null,
  };
  localStorage.setItem(draftKey, JSON.stringify(data));
  briefButton.disabled = true;
  if (reviseBriefButton) reviseBriefButton.disabled = true;
  briefButton.textContent = "Agent prüft ...";
  statusPill.textContent = "plant";
  setActiveStep("plan");

  try {
    const response = await fetch("/api/v2/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Briefing fehlgeschlagen.");
    currentBrief = payload.brief;
    if (currentBrief?.recommendedTemplateMode && form.elements.templateMode) {
      form.elements.templateMode.value = currentBrief.recommendedTemplateMode;
    }
    localStorage.setItem(briefKey, JSON.stringify(currentBrief));
    renderBrief(currentBrief, payload.source, payload.message);
    briefPanel.classList.remove("hidden");
    statusPill.textContent = payload.source === "ai" ? "Plan KI" : "Plan Basis";
  } catch (error) {
    currentBrief = buildLocalBrief(data);
    renderBrief(currentBrief, "fallback", `Fallback aktiv: ${error.message}`);
    briefPanel.classList.remove("hidden");
    statusPill.textContent = "Plan Basis";
  } finally {
    briefButton.disabled = false;
    if (reviseBriefButton) reviseBriefButton.disabled = false;
    briefButton.textContent = "Didaktik-Plan vorschlagen";
  }
}

function buildLocalBrief(input) {
  const mode = input.templateMode || "knowledge";
  const feedback = input.extraInstruction ? ` Berücksichtigt: ${input.extraInstruction}` : "";
  return {
    recommendedTemplateMode: mode,
    recommendationTitle: mode === "experiment" ? "Experiment-Forscherheft" : mode === "exploration" ? "Erkundungs-Forscherheft" : "Wissens-Forscherheft",
    reasoning: `Regelbasierter Vorschlag: Erst Lernweg klären, dann Material in geprüfte Bausteine kompilieren.${feedback}`,
    learningPath: ["Stundenfrage neugierig lesen", "Wissen aufbauen", "Beispiel nachvollziehen", "Aufgaben bearbeiten", "Sichern", "Abgabe prüfen"],
    coreConcept: input.stundenziel || "Zentrales Konzept wird über Fachbegriffe, Beispiele und Begründungen erschlossen.",
    taskPlan: ["Stundenfrage", "Wissenskasten", "ausgefülltes Beispiel", "Zuordnungsaufgabe", "Begründungsaufgabe", "Merksatz"],
    misconceptions: ["Antworten ohne Begründung", "Fachbegriffe werden nur abgeschrieben"],
    missingInfo: [],
    suggestedChanges: ["Erste Seite mit Stundenfrage statt Lernziel", "Satzstarter verwenden", "direkte Antwortfelder unter Aufgaben setzen"],
    confirmedBrief: { ...input, didacticPlanConfirmed: true },
  };
}

function renderBrief(brief, source = "fallback", message = "") {
  briefOutput.innerHTML = `
    <div class="brief-grid">
      ${message ? `<p><strong>Hinweis:</strong> ${escapeHtml(message)}</p>` : ""}
      <p><strong>Quelle:</strong> ${escapeHtml(source === "ai" ? "Didaktik-Agent" : source === "cache" ? "zwischengespeicherter Plan" : "regelbasierter Plan")}</p>
      <h3>${escapeHtml(brief.recommendationTitle || "Didaktik-Vorschlag")}</h3>
      <p>${escapeHtml(brief.reasoning || "")}</p>
      <div><strong>Kernidee:</strong><p>${escapeHtml(brief.coreConcept || "")}</p></div>
      <div><strong>Lernweg:</strong>${renderList(brief.learningPath || [])}</div>
      <div><strong>Aufgabenformate:</strong><div class="brief-pill-list">${(brief.taskPlan || []).map((item) => `<span class="brief-pill">${escapeHtml(item)}</span>`).join("")}</div></div>
      <div><strong>Stolperstellen:</strong>${renderList(brief.misconceptions || [])}</div>
      ${(brief.missingInfo || []).length ? `<div><strong>Fehlende Infos:</strong>${renderList(brief.missingInfo)}</div>` : ""}
      <div><strong>Vorschläge:</strong>${renderList(brief.suggestedChanges || [])}</div>
    </div>
  `;
}

function renderList(items) {
  if (!items.length) return "<p>—</p>";
  return `<ol>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`;
}

async function generateFromBrief() {
  const rawData = getFormData();
  const confirmedBrief = currentBrief?.confirmedBrief || { ...rawData, didacticPlanConfirmed: true };
  const data = {
    ...rawData,
    ...confirmedBrief,
    templateMode: currentBrief?.recommendedTemplateMode || confirmedBrief.templateMode || rawData.templateMode,
  };

  setActiveStep("compile");
  acceptBriefButton.disabled = true;
  acceptBriefButton.textContent = "Kompiliere ...";
  statusPill.textContent = "arbeitet";

  try {
    const response = await fetch("/api/v2/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, confirmedBrief: data, didacticBrief: currentBrief }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "v2-Generierung fehlgeschlagen.");
    currentPackage = payload.package || buildMaterialPackageV2(data);
    currentQuality = payload.quality || checkMaterialQuality(currentPackage);
    currentSource = payload.source || "fallback";
    saveAndRender(payload.message, payload.repaired);
  } catch (error) {
    currentPackage = buildMaterialPackageV2(data);
    currentQuality = checkMaterialQuality(currentPackage);
    currentSource = "fallback";
    saveAndRender(`Fallback aktiv: ${error.message}`);
  } finally {
    acceptBriefButton.disabled = false;
    acceptBriefButton.textContent = "Plan übernehmen & Material kompilieren";
  }
}

function generateFallback() {
  const data = getFormData();
  localStorage.setItem(draftKey, JSON.stringify(data));
  currentPackage = buildMaterialPackageV2(data);
  currentQuality = checkMaterialQuality(currentPackage);
  currentSource = "fallback";
  saveAndRender();
}

function saveAndRender(message = "", repaired = false) {
  localStorage.setItem(packageKey, JSON.stringify(currentPackage));
  preview.innerHTML = renderMaterialPackageV2(currentPackage);
  renderQuality(currentQuality, message, repaired);
  statusPill.textContent = currentSource === "ai" ? "KI-v2" : "Basis-v2";
}

function renderQuality(quality, message = "", repaired = false) {
  const topIssues = quality.issues.slice(0, 6);
  qualityOutput.innerHTML = `
    <div class="quality-score ${quality.score >= 80 ? "good" : quality.score >= 60 ? "medium" : "bad"}">
      <strong>${quality.score}/100</strong>
      <span>${quality.ok ? "Keine kritischen Fehler" : "Noch verbessern"}</span>
    </div>
    ${message ? `<p>${escapeHtml(message)}</p>` : ""}
    ${repaired ? `<p><strong>Repair-Agent:</strong> Material wurde automatisch nachgebessert.</p>` : ""}
    ${currentSource ? `<p><strong>Quelle:</strong> ${escapeHtml(currentSource === "ai" ? "KI + Qualitätscheck" : "regelbasierter Builder")}</p>` : ""}
    ${topIssues.length ? `<ul>${topIssues.map((issue) => `<li><strong>${escapeHtml(issue.severity)}</strong>: ${escapeHtml(issue.message)}</li>`).join("")}</ul>` : "<p>Der Qualitätscheck findet keine größeren Probleme.</p>"}
  `;
}

function buildScobeesText(pkg) {
  return `Titel: ${pkg.meta.title}\n\nFach/Klasse: ${pkg.meta.subject} · ${pkg.meta.className}\n\nStundenfrage:\n${pkg.didacticPlan.guidingQuestion}\n\nArbeitsweg:\n${pkg.didacticPlan.learningPath.map((step, index) => `${index + 1}. ${step}`).join("\n")}\n\nAbgabe:\n${pkg.scobees.submission}\n`;
}

function buildTeacherNote(pkg, quality) {
  return `# Lehrkraft-Notiz: ${pkg.meta.title}\n\n## Eckdaten\n- Fach: ${pkg.meta.subject}\n- Klasse: ${pkg.meta.className}\n- Dauer: ${pkg.meta.duration}\n- Modus: ${pkg.meta.templateMode}\n- Seiten: ${pkg.meta.pageCount}\n- Quelle: ${currentSource}\n\n## Internes Lernziel\n${pkg.didacticPlan.learningGoal}\n\n## Stundenfrage für SuS\n${pkg.didacticPlan.guidingQuestion}\n\n## Kernkonzept\n${pkg.didacticPlan.coreConcept}\n\n## Lernweg\n${pkg.didacticPlan.learningPath.map((step, index) => `${index + 1}. ${step}`).join("\n")}\n\n## Typische Fehlvorstellungen\n${pkg.didacticPlan.misconceptions.map((item) => `- ${item}`).join("\n")}\n\n## Erfolgskriterien\n${pkg.didacticPlan.successCriteria.map((item) => `- ${item}`).join("\n")}\n\n## Qualitätscheck\nScore: ${quality.score}/100\n\n${quality.issues.length ? quality.issues.map((issue) => `- [${issue.severity}] ${issue.message}`).join("\n") : "Keine größeren Probleme gefunden."}\n`;
}

function buildFullHtml(pkg) {
  return `<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1" />\n<title>${escapeHtml(pkg.meta.title)}</title>\n<link rel="stylesheet" href="./v2/v2.css" />\n</head>\n<body>\n${renderMaterialPackageV2(pkg)}\n</body>\n</html>`;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function slugify(value) {
  return (value || "material").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
}

function ensurePackage() {
  if (!currentPackage) generateFallback();
  return currentPackage;
}

function reset() {
  localStorage.removeItem(draftKey);
  localStorage.removeItem(packageKey);
  localStorage.removeItem(briefKey);
  form.reset();
  if (briefFeedback) briefFeedback.value = "";
  preview.innerHTML = "";
  currentBrief = null;
  currentPackage = null;
  currentQuality = null;
  briefPanel.classList.add("hidden");
  briefOutput.innerHTML = "Noch kein Plan erstellt.";
  qualityOutput.innerHTML = `<div class="muted-box">Noch kein Material kompiliert. Starte links mit dem Didaktik-Plan.</div>`;
  setActiveStep("brief");
  statusPill.textContent = "Brief";
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

briefButton.addEventListener("click", () => createBrief());
reviseBriefButton?.addEventListener("click", () => createBrief("Überarbeite den vorherigen Didaktik-Plan anhand des Nutzerfeedbacks."));
acceptBriefButton.addEventListener("click", generateFromBrief);
makeEasierButton.addEventListener("click", () => createBrief("Mache den Plan einfacher, kleinschrittiger und mit mehr Satzstartern."));
makeExperimentalButton.addEventListener("click", () => { form.elements.templateMode.value = "experiment"; createBrief("Plane das Material experimenteller mit Vermutung, Beobachtung und Auswertung."); });
makeResearchButton.addEventListener("click", () => { form.elements.templateMode.value = "exploration"; createBrief("Plane das Material stärker als Recherche/Erkundung mit Quellen, Fundorten und Kriterien."); });
printButton.addEventListener("click", () => window.print());
resetButton.addEventListener("click", reset);

downloadHtmlButton.addEventListener("click", () => { const pkg = ensurePackage(); downloadFile(`${slugify(pkg.meta.subject + "_" + pkg.meta.className + "_" + pkg.meta.title)}.html`, buildFullHtml(pkg), "text/html;charset=utf-8"); });
downloadJsonButton.addEventListener("click", () => { const pkg = ensurePackage(); downloadFile(`${slugify(pkg.meta.title)}.material-package.json`, JSON.stringify(pkg, null, 2), "application/json;charset=utf-8"); });
downloadScobeesButton.addEventListener("click", () => { const pkg = ensurePackage(); downloadFile(`${slugify(pkg.meta.title)}.scobees.txt`, buildScobeesText(pkg), "text/plain;charset=utf-8"); });
downloadTeacherButton.addEventListener("click", () => { const pkg = ensurePackage(); const quality = currentQuality || checkMaterialQuality(pkg); downloadFile(`${slugify(pkg.meta.title)}.lehrkraft.md`, buildTeacherNote(pkg, quality), "text/markdown;charset=utf-8"); });

form.addEventListener("input", () => localStorage.setItem(draftKey, JSON.stringify(getFormData())));

const restoredDraft = localStorage.getItem(draftKey);
if (restoredDraft) setFormData(JSON.parse(restoredDraft));
const restoredBrief = localStorage.getItem(briefKey);
if (restoredBrief) {
  currentBrief = JSON.parse(restoredBrief);
  renderBrief(currentBrief, "cache");
  briefPanel.classList.remove("hidden");
  setActiveStep("plan");
} else {
  setActiveStep("brief");
}
