import { buildLearningDesignV3 } from "./builder-v3.js";
import { checkCoherenceV3 } from "./coherence-check-v3.js";
import { renderLearningDesignV3 } from "./renderer-v3.js";

const form = document.querySelector("#v3Form");
const preview = document.querySelector("#v3Preview");
const coherenceOutput = document.querySelector("#coherenceOutput");
const statusPill = document.querySelector("#statusPill");
const briefButton = document.querySelector("#briefButton");
const briefPanel = document.querySelector("#briefPanel");
const briefOutput = document.querySelector("#briefOutput");
const briefFeedback = document.querySelector("#briefFeedback");
const reviseBriefButton = document.querySelector("#reviseBriefButton");
const acceptBriefButton = document.querySelector("#acceptBriefButton");
const printButton = document.querySelector("#printButton");
const downloadHtmlButton = document.querySelector("#downloadHtmlButton");
const downloadJsonButton = document.querySelector("#downloadJsonButton");
const downloadTeacherButton = document.querySelector("#downloadTeacherButton");
const resetButton = document.querySelector("#resetButton");
const stepBrief = document.querySelector("#stepBrief");
const stepPlan = document.querySelector("#stepPlan");
const stepCompile = document.querySelector("#stepCompile");

const draftKey = "materialCompiler.v3.input";
const designKey = "materialCompiler.v3.design";
const briefKey = "materialCompiler.v3.brief";
let currentDesign = null;
let currentCoherence = null;
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
    variant: data.get("variant") || "4p",
    inhalte: data.get("inhalte")?.trim() || "",
    hinweise: data.get("hinweise")?.trim() || "",
  };
}

function setFormData(data) {
  for (const [key, value] of Object.entries(data || {})) {
    const field = form.elements[key];
    if (!field) continue;
    if (field instanceof RadioNodeList) {
      const radio = Array.from(field).find((r) => r.value === value);
      if (radio) radio.checked = true;
    } else {
      field.value = value;
    }
  }
}

function setActiveStep(step) {
  [stepBrief, stepPlan, stepCompile].forEach((el) => el?.classList.remove("active"));
  if (step === "brief") stepBrief?.classList.add("active");
  if (step === "plan") stepPlan?.classList.add("active");
  if (step === "compile") stepCompile?.classList.add("active");
}

async function createBrief(extraInstruction = "") {
  const feedbackText = briefFeedback?.value?.trim() || "";
  const data = {
    ...getFormData(),
    extraInstruction: [extraInstruction, feedbackText ? `Feedback: ${feedbackText}` : ""].filter(Boolean).join("\n"),
    previousBrief: currentBrief || null,
  };
  localStorage.setItem(draftKey, JSON.stringify(data));
  briefButton.disabled = true;
  if (reviseBriefButton) reviseBriefButton.disabled = true;
  briefButton.textContent = "Didaktik-Agent plant …";
  statusPill.textContent = "plant";
  setActiveStep("plan");

  try {
    const res = await fetch("/api/v3/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || "Briefing fehlgeschlagen.");
    currentBrief = payload.brief;
    localStorage.setItem(briefKey, JSON.stringify(currentBrief));
    renderBrief(currentBrief, payload.source, payload.message);
    briefPanel.classList.remove("hidden");
    statusPill.textContent = payload.source === "ai" ? "Plan KI" : "Plan Basis";
  } catch (error) {
    currentBrief = buildLocalBrief(data);
    renderBrief(currentBrief, "fallback", `Fallback: ${error.message}`);
    briefPanel.classList.remove("hidden");
    statusPill.textContent = "Plan Basis";
  } finally {
    briefButton.disabled = false;
    if (reviseBriefButton) reviseBriefButton.disabled = false;
    briefButton.textContent = "Didaktik-Plan vorschlagen";
  }
}

function buildLocalBrief(input) {
  const design = buildLearningDesignV3(input);
  return {
    studentQuestion: design.learningDesign.studentQuestion,
    targetAnswer: design.learningDesign.targetAnswer,
    lessonStory: design.learningDesign.lessonStory,
    learningSteps: design.learningDesign.learningSteps,
    keyConcepts: design.learningDesign.keyConcepts,
    misconceptions: design.learningDesign.misconceptions,
    successCriteria: design.learningDesign.successCriteria,
    materialPlan: design.materialInventory.map((m) => `${m.id}: ${m.title}`),
    taskPlan: design.taskSequence.map((t) => `${t.id}: ${t.title}`),
    confirmedBrief: { ...input, didacticPlanConfirmed: true },
  };
}

function renderBrief(brief, source = "fallback", message = "") {
  briefOutput.innerHTML = `
    <div class="brief-grid">
      ${message ? `<p><strong>Hinweis:</strong> ${esc(message)}</p>` : ""}
      <p><strong>Quelle:</strong> ${esc(source === "ai" ? "Didaktik-Agent (KI)" : source === "cache" ? "zwischengespeichert" : "regelbasiert")}</p>
      ${brief.studentQuestion ? `<div><strong>Stundenfrage:</strong><p class="v3-highlight-question">${esc(brief.studentQuestion)}</p></div>` : ""}
      ${brief.lessonStory ? `<div><strong>Roten Faden:</strong><p>${esc(brief.lessonStory)}</p></div>` : ""}
      ${brief.learningSteps?.length ? `<div><strong>Lernschritte:</strong>${renderList(brief.learningSteps)}</div>` : ""}
      ${brief.keyConcepts?.length ? `<div><strong>Kernbegriffe:</strong><div class="brief-pill-list">${brief.keyConcepts.map((c) => `<span class="brief-pill">${esc(c)}</span>`).join("")}</div></div>` : ""}
      ${brief.materialPlan?.length ? `<div><strong>Materialplan:</strong>${renderList(brief.materialPlan)}</div>` : ""}
      ${brief.taskPlan?.length ? `<div><strong>Aufgabenplan:</strong>${renderList(brief.taskPlan)}</div>` : ""}
      ${brief.misconceptions?.length ? `<div><strong>Stolperstellen:</strong>${renderList(brief.misconceptions)}</div>` : ""}
    </div>
  `;
}

function renderList(items) {
  if (!items?.length) return "<p>—</p>";
  return `<ol>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ol>`;
}

async function generateFromBrief() {
  const data = { ...getFormData(), ...currentBrief?.confirmedBrief, didacticBrief: currentBrief };
  setActiveStep("compile");
  acceptBriefButton.disabled = true;
  acceptBriefButton.textContent = "Kompiliere …";
  statusPill.textContent = "arbeitet";

  try {
    const res = await fetch("/api/v3/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const payload = await res.json();
    if (!res.ok) throw new Error(payload.error || "v3-Generierung fehlgeschlagen.");
    currentDesign = payload.design || buildLearningDesignV3(data);
    currentCoherence = payload.coherence || checkCoherenceV3(currentDesign);
    currentSource = payload.source || "fallback";
    saveAndRender(payload.message, payload.repaired);
  } catch (error) {
    currentDesign = buildLearningDesignV3(data);
    currentCoherence = checkCoherenceV3(currentDesign);
    currentSource = "fallback";
    saveAndRender(`Fallback: ${error.message}`);
  } finally {
    acceptBriefButton.disabled = false;
    acceptBriefButton.textContent = "Plan übernehmen & kompilieren";
  }
}

function generateFallback() {
  const data = getFormData();
  localStorage.setItem(draftKey, JSON.stringify(data));
  currentDesign = buildLearningDesignV3(data);
  currentCoherence = checkCoherenceV3(currentDesign);
  currentSource = "fallback";
  saveAndRender();
}

function saveAndRender(message = "", repaired = false) {
  localStorage.setItem(designKey, JSON.stringify(currentDesign));
  preview.innerHTML = renderLearningDesignV3(currentDesign);
  renderCoherence(currentCoherence, message, repaired);
  statusPill.textContent = currentSource === "ai" ? "KI-v3" : "Basis-v3";
}

function renderCoherence(coherence, message = "", repaired = false) {
  const topIssues = coherence.issues.slice(0, 6);
  coherenceOutput.innerHTML = `
    <div class="quality-score ${coherence.score >= 80 ? "good" : coherence.score >= 60 ? "medium" : "bad"}">
      <strong>${coherence.score}/100</strong>
      <span>${coherence.ok ? "Kohärenz OK" : "Prüfen"}</span>
    </div>
    ${message ? `<p>${esc(message)}</p>` : ""}
    ${repaired ? `<p><strong>Repair-Agent:</strong> Lerndesign wurde nachgebessert.</p>` : ""}
    <p><strong>Quelle:</strong> ${esc(currentSource === "ai" ? "3-Agenten-Pipeline" : "regelbasierter Builder")}</p>
    ${topIssues.length ? `<ul>${topIssues.map((i) => `<li><strong>${esc(i.severity)}</strong>: ${esc(i.message)}</li>`).join("")}</ul>` : "<p>Keine Kohärenzprobleme gefunden.</p>"}
  `;
}

function buildFullHtml(design) {
  return `<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8"/>\n<title>${esc(design.meta.title)}</title>\n<link rel="stylesheet" href="./v2/v2.css"/>\n<link rel="stylesheet" href="./v3/v3.css"/>\n</head>\n<body>\n${renderLearningDesignV3(design)}\n</body>\n</html>`;
}

function buildTeacherNote(design, coherence) {
  return `# Lehrkraft-Notiz: ${design.meta.title}

## Eckdaten
- Fach: ${design.meta.subject}
- Klasse: ${design.meta.className}
- Dauer: ${design.meta.duration}
- Seiten: ${design.meta.pageCount}
- Quelle: ${currentSource}

## Internes Lernziel
${design.learningDesign.internalLearningGoal}

## Stundenfrage für SuS
${design.learningDesign.studentQuestion}

## Roter Faden
${design.learningDesign.lessonStory}

## Zielantwort
${design.learningDesign.targetAnswer}

## Lernschritte
${design.learningDesign.learningSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## Kernbegriffe
${design.learningDesign.keyConcepts.join(", ")}

## Typische Fehlvorstellungen
${design.learningDesign.misconceptions.map((m) => `- ${m}`).join("\n")}

## Erfolgskriterien
${design.learningDesign.successCriteria.map((c) => `- ${c}`).join("\n")}

## Materialien
${design.materialInventory.map((m) => `- ${m.id}: [${m.type}] ${m.title}`).join("\n")}

## Aufgaben
${design.taskSequence.map((t) => `- ${t.id}: [${t.type}] ${t.title} → ${t.expectedStudentProduct}`).join("\n")}

## Kohärenzcheck
Score: ${coherence.score}/100
${coherence.issues.length ? coherence.issues.map((i) => `- [${i.severity}] ${i.message}`).join("\n") : "Keine Probleme."}
`;
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
  return (value || "material")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function ensureDesign() {
  if (!currentDesign) generateFallback();
  return currentDesign;
}

function reset() {
  localStorage.removeItem(draftKey);
  localStorage.removeItem(designKey);
  localStorage.removeItem(briefKey);
  form.reset();
  if (briefFeedback) briefFeedback.value = "";
  preview.innerHTML = "";
  currentBrief = null;
  currentDesign = null;
  currentCoherence = null;
  briefPanel.classList.add("hidden");
  briefOutput.innerHTML = "Noch kein Plan erstellt.";
  coherenceOutput.innerHTML = `<div class="muted-box">Noch kein Material kompiliert.</div>`;
  setActiveStep("brief");
  statusPill.textContent = "Brief";
}

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

// ── Event listeners ───────────────────────────────────────────────────────────

briefButton.addEventListener("click", () => createBrief());
reviseBriefButton?.addEventListener("click", () => createBrief("Überarbeite den Plan anhand des Feedbacks."));
acceptBriefButton.addEventListener("click", generateFromBrief);
printButton.addEventListener("click", () => window.print());
resetButton.addEventListener("click", reset);

downloadHtmlButton.addEventListener("click", () => {
  const design = ensureDesign();
  downloadFile(`${slugify(design.meta.subject + "_" + design.meta.className + "_" + design.meta.title)}.html`, buildFullHtml(design), "text/html;charset=utf-8");
});
downloadJsonButton.addEventListener("click", () => {
  const design = ensureDesign();
  downloadFile(`${slugify(design.meta.title)}.learning-design-v3.json`, JSON.stringify(design, null, 2), "application/json;charset=utf-8");
});
downloadTeacherButton.addEventListener("click", () => {
  const design = ensureDesign();
  const coherence = currentCoherence || checkCoherenceV3(design);
  downloadFile(`${slugify(design.meta.title)}.lehrkraft.md`, buildTeacherNote(design, coherence), "text/markdown;charset=utf-8");
});

form.addEventListener("input", () => localStorage.setItem(draftKey, JSON.stringify(getFormData())));

// ── Restore state ─────────────────────────────────────────────────────────────

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
