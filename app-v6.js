const form = document.querySelector("#briefForm");
const materialPreview = document.querySelector("#materialPreview");
const statusPill = document.querySelector("#statusPill");
const previewTitle = document.querySelector("#previewTitle");
const generatorMessage = document.querySelector("#generatorMessage");
const generateButton = document.querySelector("#generateButton");
const printButton = document.querySelector("#printButton");
const downloadHtmlButton = document.querySelector("#downloadHtmlButton");
const downloadNoteButton = document.querySelector("#downloadNoteButton");
const downloadScobeesButton = document.querySelector("#downloadScobeesButton");
const downloadMetaButton = document.querySelector("#downloadMetaButton");
const resetButton = document.querySelector("#resetButton");

const draftStorageKey = "unterrichtsmaterialgenerator.input.v6";
const materialStorageKey = "unterrichtsmaterialgenerator.material.v6";
let currentMaterial = null;
let currentSource = "fallback";

const modeLabels = {
  knowledge: "Wissens-Forscherheft",
  experiment: "Experiment-Forscherheft",
  exploration: "Erkundungs-Forscherheft",
  worksheet: "Arbeitsblatt",
};

const workSteps = {
  knowledge: ["Lies den Auftrag.", "Markiere wichtige Begriffe.", "Bearbeite die Seiten der Reihe nach.", "Prüfe dein Ergebnis mit dem Check."],
  experiment: ["Lies die Forscherfrage.", "Schreibe eine Vermutung auf.", "Führe den Versuch Schritt für Schritt durch.", "Trenne Beobachtung und Erklärung."],
  exploration: ["Lies die Erkundungsfrage.", "Recherchiere oder beobachte gezielt.", "Notiere Quelle, Fundort oder Beleg.", "Vergleiche mit Kriterien und bewerte."],
  worksheet: ["Lies Ziel und Beispiel.", "Bearbeite die Aufgaben.", "Nutze Hilfen bei Unsicherheit.", "Prüfe dein Ergebnis."],
};

function getCheckedValues(name) {
  return Array.from(form.querySelectorAll(`input[name="${name}"]:checked, input[name="${name}"][type="hidden"]`)).map((item) => item.value);
}

function getFormData() {
  const data = new FormData(form);
  return {
    fach: data.get("fach")?.trim() || "",
    klasse: data.get("klasse")?.trim() || "",
    thema: data.get("thema")?.trim() || "",
    stundenziel: data.get("stundenziel")?.trim() || "",
    leitfrage: data.get("leitfrage")?.trim() || "",
    dauer: data.get("dauer")?.trim() || "",
    vorwissen: data.get("vorwissen")?.trim() || "",
    materialtyp: data.get("materialtyp") || "",
    templateMode: data.get("templateMode") || "knowledge",
    variant: data.get("variant") || "4p",
    muster: data.get("muster") || "",
    schwierigkeit: data.get("schwierigkeit") || "",
    output: getCheckedValues("output"),
    textmenge: data.get("textmenge") || "",
    gestaltung: data.get("gestaltung") || "",
    schwerpunkte: getCheckedValues("schwerpunkte"),
    inhalte: data.get("inhalte")?.trim() || "",
    scobeesSubmission: data.get("scobeesSubmission")?.trim() || "",
    hinweise: data.get("hinweise")?.trim() || "",
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function asLines(value) {
  return String(value || "")
    .split(/\n|;|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function fallback(value, text) {
  return value && String(value).trim().length ? String(value).trim() : text;
}

function fitText(value, max = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max).split(" ").slice(0, -1).join(" ");
  return cut || text.slice(0, max);
}

function slugify(value) {
  return (value || "material")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function normalizeArray(value, fallbackItems = []) {
  return Array.isArray(value) && value.length ? value : fallbackItems;
}

function pageCount(variant) {
  if (variant === "2p") return 2;
  if (variant === "6p") return 6;
  return 4;
}

function defaultQuestion(mode, topic) {
  if (mode === "experiment") return `Was können wir bei ${topic} beobachten und erklären?`;
  if (mode === "exploration") return `Was finde ich über ${topic} heraus und wie bewerte ich meine Ergebnisse?`;
  return `Was ist an ${topic} wichtig und wie kann ich es anwenden?`;
}

function defaultIntro(mode, topic) {
  if (mode === "experiment") return "Arbeite selbstständig. Lies jeden Schritt genau, führe den Versuch sorgfältig durch und notiere zuerst nur Beobachtungen.";
  if (mode === "exploration") return `Arbeite selbstständig. Recherchiere oder beobachte zu ${topic}, notiere Quellen oder Fundorte und bewerte mit Kriterien.`;
  return "Arbeite selbstständig. Lies den Input, bearbeite die Aufgaben der Reihe nach und prüfe am Ende dein Ergebnis.";
}

function defaultTasks(mode, topic, terms) {
  if (mode === "experiment") return [
    { label: "A1", title: "Vermutung", instruction: `Schreibe eine Vermutung zu ${topic}.`, support: "Satzstarter: Ich vermute, dass …" },
    { label: "A2", title: "Durchführung", instruction: "Führe die Untersuchung Schritt für Schritt durch.", support: "Verändere immer nur eine Sache." },
    { label: "A3", title: "Beobachtung", instruction: "Notiere sachlich, was du beobachtest.", support: "Noch nicht erklären." },
    { label: "A4", title: "Auswertung", instruction: "Erkläre deine Beobachtung mit Fachbegriffen.", support: `Nutze: ${terms.slice(0, 3).join(", ")}.` },
  ];
  if (mode === "exploration") return [
    { label: "A1", title: "Rechercheplan", instruction: `Lege fest, wo du Informationen zu ${topic} suchst.`, support: "Material, Buch, Webseite, Station oder Beobachtung." },
    { label: "A2", title: "Kriterien", instruction: "Lege zwei bis drei Kriterien fest.", support: "Zum Beispiel: passend, verständlich, glaubwürdig, wichtig." },
    { label: "A3", title: "Ergebnisse", instruction: "Sammle Ergebnisse in Stichpunkten und notiere den Fundort.", support: "Ohne Fundort ist es noch kein gutes Ergebnis." },
    { label: "A4", title: "Bewertung", instruction: "Vergleiche Ergebnisse und begründe dein Urteil.", support: "Ich bewerte …, weil …" },
  ];
  return [
    { label: "A1", title: "Begriffe sichern", instruction: `Markiere wichtige Wörter zu ${topic}.`, support: `Nutze: ${terms.slice(0, 4).join(", ")}.` },
    { label: "A2", title: "Verstehen", instruction: "Erkläre das Beispiel in eigenen Worten.", support: "Kurz und klar." },
    { label: "A3", title: "Anwenden", instruction: `Löse eine Aufgabe zu ${topic}.`, support: "Nutze die Fachwörter." },
    { label: "A4", title: "Sichern", instruction: `Schreibe einen Merksatz zu ${topic}.`, support: "Ein guter Merksatz ist kurz." },
  ];
}

function buildFallbackMaterial(data) {
  const topic = fallback(data.thema, "Neues Thema");
  const subject = fallback(data.fach, "Fach");
  const className = fallback(data.klasse, "Klasse");
  const mode = data.templateMode || "knowledge";
  const terms = asLines(data.inhalte);
  const visibleTerms = terms.length ? terms : [topic, "Quelle", "Beleg", "Begründung"];
  return {
    templateMode: mode,
    variant: data.variant || "4p",
    title: topic,
    subtitle: `${subject} · ${className}`,
    metadata: {
      subject,
      className,
      type: modeLabels[mode] || "Material",
      level: fallback(data.schwierigkeit, "eher leicht"),
      pattern: fallback(data.muster, modeLabels[mode] || "Material"),
      duration: fallback(data.dauer, "60 Minuten"),
    },
    goal: fallback(data.stundenziel, `Ich kann ${topic} selbstständig bearbeiten, Ergebnisse festhalten und begründen.`),
    guidingQuestion: fallback(data.leitfrage, defaultQuestion(mode, topic)),
    intro: defaultIntro(mode, topic),
    example: {
      title: "Beispiel",
      body: mode === "exploration" ? "Eine gute Erkundung nennt Ergebnis, Quelle/Fundort und eine kurze Bewertung." : `Eine gute Antwort zu ${topic} nennt einen Begriff, ein Beispiel und eine Begründung.`,
      sample: mode === "exploration" ? "Ergebnis: … | Quelle/Fundort: … | Bewertung: …, weil …" : `Ich erkenne ${topic}, weil ich ein Merkmal finde und es begründe.`,
    },
    tasks: defaultTasks(mode, topic, visibleTerms),
    differentiation: {
      star: "Bearbeite die Pflichtfelder. Schreibe kurze Stichpunkte und nutze die Satzstarter.",
      planet: "Bearbeite alle Pflichtfelder. Begründe mindestens eine Antwort mit weil.",
      rocket: "Ergänze eine eigene Frage, einen weiteren Beleg oder eine kritischere Bewertung.",
    },
    reflection: "Was hast du herausgefunden? Was war noch unsicher?",
    qualityCheck: mode === "exploration"
      ? ["Quelle oder Fundort notiert", "Kriterien genutzt", "Ergebnisse verglichen", "Bewertung begründet"]
      : ["Fachwörter genutzt", "mindestens eine Antwort begründet", "Ergebnis geprüft"],
    scobeesSubmission: fallback(data.scobeesSubmission, "Lade die Sicherungsseite oder dein Ergebnis gut lesbar hoch. Name und Datum müssen sichtbar sein."),
    teacherNote: {
      flow: ["Auftrag selbstständig lesen", "Arbeitsweg nutzen", "Ergebnisse festhalten", "Check bearbeiten", "Abgabe sichern"],
      pitfalls: [fallback(data.vorwissen, "Vorwissen kurz aktivieren."), fallback(data.hinweise, "Bei Überforderung Stern-Niveau nutzen.")],
      adaptation: "Bei Überforderung nur Pflichtfelder bearbeiten lassen.",
    },
  };
}

function validateMaterial(material, data) {
  const base = buildFallbackMaterial(data);
  const safe = material && typeof material === "object" ? material : {};
  const tasks = normalizeArray(safe.tasks, base.tasks).slice(0, 4).map((task, index) => ({
    label: fitText(task.label || base.tasks[index]?.label || "A", 16),
    title: fitText(task.title || base.tasks[index]?.title || "Aufgabe", 48),
    instruction: fitText(task.instruction || base.tasks[index]?.instruction || "Bearbeite die Aufgabe.", 135),
    support: fitText(task.support || base.tasks[index]?.support || "Kurze Stichpunkte reichen.", 105),
  }));
  return {
    ...base,
    ...safe,
    templateMode: safe.templateMode || data.templateMode || base.templateMode,
    variant: safe.variant || data.variant || base.variant,
    title: fitText(fallback(safe.title, base.title), 65),
    subtitle: fallback(safe.subtitle, base.subtitle),
    goal: fitText(fallback(safe.goal, base.goal), 210),
    guidingQuestion: fitText(fallback(safe.guidingQuestion, base.guidingQuestion), 120),
    intro: fitText(fallback(safe.intro, base.intro), 190),
    metadata: { ...base.metadata, ...(safe.metadata && typeof safe.metadata === "object" ? safe.metadata : {}) },
    example: {
      title: fitText(safe.example?.title || base.example.title, 40),
      body: fitText(safe.example?.body || base.example.body, 170),
      sample: fitText(safe.example?.sample || base.example.sample, 130),
    },
    tasks,
    differentiation: {
      star: fitText(safe.differentiation?.star || base.differentiation.star, 100),
      planet: fitText(safe.differentiation?.planet || base.differentiation.planet, 100),
      rocket: fitText(safe.differentiation?.rocket || base.differentiation.rocket, 100),
    },
    qualityCheck: normalizeArray(safe.qualityCheck, base.qualityCheck).slice(0, 4).map((item) => fitText(item, 85)),
    scobeesSubmission: fitText(safe.scobeesSubmission || base.scobeesSubmission, 155),
    teacherNote: {
      flow: normalizeArray(safe.teacherNote?.flow, base.teacherNote.flow).slice(0, 6),
      pitfalls: normalizeArray(safe.teacherNote?.pitfalls, base.teacherNote.pitfalls).slice(0, 5),
      adaptation: fallback(safe.teacherNote?.adaptation, base.teacherNote.adaptation),
    },
  };
}

function renderList(items, className = "") { return `<ul class="${className}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`; }
function renderGoal(material) { return `<section class="goal-strip compact-goal no-break"><strong>Ziel</strong><span>${escapeHtml(material.goal)}</span></section>`; }
function renderQuestion(material) { return `<section class="question-box no-break"><span>Leitfrage</span><strong>${escapeHtml(material.guidingQuestion)}</strong></section>`; }
function renderHowToWork(material) { return `<section class="howto-box no-break"><h3>So arbeitest du selbstständig</h3>${renderList(workSteps[material.templateMode] || workSteps.worksheet, "howto-list")}</section>`; }
function renderWriteBox(label, lines = 5) { return `<div class="write-box no-break"><p>${escapeHtml(label)}</p>${Array.from({ length: lines }, () => "<span></span>").join("")}</div>`; }
function renderTask(task, index) { return `<article class="task-card task-card-compact no-break"><div class="task-number">${String(index + 1).padStart(2, "0")}</div><div><p class="task-label">${escapeHtml(task.label)}</p><h3>${escapeHtml(task.title)}</h3><p>${escapeHtml(task.instruction)}</p><div class="support-note">${escapeHtml(task.support)}</div></div></article>`; }
function renderTaskGrid(tasks, start = 0, end = tasks.length) { return `<div class="task-grid compact-task-grid">${tasks.slice(start, end).map((task, index) => renderTask(task, start + index)).join("")}</div>`; }
function renderDifferentiation(material) { return `<section class="material-section no-break"><div class="section-kicker">Wahlhilfe</div><h2>Stern · Planet · Rakete</h2><div class="levels"><article class="level-star"><span class="level-icon">★</span><h3>Stern</h3><p>${escapeHtml(material.differentiation.star)}</p></article><article class="level-planet"><span class="level-icon">●</span><h3>Planet</h3><p>${escapeHtml(material.differentiation.planet)}</p></article><article class="level-rocket"><span class="level-icon">▲</span><h3>Rakete</h3><p>${escapeHtml(material.differentiation.rocket)}</p></article></div></section>`; }
function renderScobees(material) { return `<section class="scobees-box no-break"><h3>Scobees-Abgabe</h3><p>${escapeHtml(material.scobeesSubmission)}</p></section>`; }
function renderTable(headers, rows = 4) { return `<table class="material-table spacious-table no-break"><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${Array.from({ length: rows }, () => `<tr>${headers.map(() => "<td></td>").join("")}</tr>`).join("")}</tbody></table>`; }
function renderPage(material, pageNumber, title, content) { return `<section class="page booklet-page"><header class="page-header"><span>${escapeHtml(material.metadata.subject)} · ${escapeHtml(material.metadata.className)}</span><strong>${escapeHtml(material.title)}</strong></header><main class="page-content"><div class="section-kicker">Seite ${pageNumber}</div><h2>${escapeHtml(title)}</h2>${content}</main><footer class="page-footer">Seite ${pageNumber}</footer></section>`; }

function renderCover(material) { return renderPage(material, 1, material.metadata.type, `<div class="cover-hero"><p>${escapeHtml(material.subtitle)} · ${escapeHtml(material.metadata.duration)}</p><h1>${escapeHtml(material.title)}</h1></div>${renderGoal(material)}${renderQuestion(material)}<div class="name-box">Name: ________________________ Klasse: ______ Datum: ______</div>${renderHowToWork(material)}<section class="material-section no-break"><div class="section-kicker">Start</div><h2>Dein Auftrag</h2><p>${escapeHtml(material.intro)}</p></section>`); }
function renderOrientationPage(material, pageNumber = 2) {
  if (material.templateMode === "exploration") return renderPage(material, pageNumber, "Recherche vorbereiten", `<section class="material-section no-break"><div class="section-kicker">Vor dem Start</div><h2>Plane deine Erkundung</h2><p>Schreibe zuerst auf, wonach du suchst. Notiere immer Quelle, Fundort oder Beleg.</p></section>${renderTable(["Suchfrage", "Quelle/Fundort", "Warum passend?"], 4)}`);
  if (material.templateMode === "experiment") return renderPage(material, pageNumber, "Versuch vorbereiten", `${renderTaskGrid(material.tasks, 0, 2)}${renderTable(["Material", "Schritt", "Sicherheits-Hinweis"], 4)}`);
  return renderPage(material, pageNumber, "Orientierung und Beispiel", `<section class="material-section no-break"><div class="section-kicker">Merken</div><h2>Das brauchst du</h2><p>${escapeHtml(material.example.body)}</p><p class="sample-answer">${escapeHtml(material.example.sample)}</p></section>${renderTable(["Begriff", "Bedeutung", "Beispiel"], 4)}`);
}
function renderWorkPage(material, pageNumber = 3) {
  if (material.templateMode === "exploration") return renderPage(material, pageNumber, "Recherchieren, sammeln, bewerten", `${renderTaskGrid(material.tasks, 0, 4)}${renderTable(["Quelle/Fundort", "Ergebnis", "Bewertung"], 4)}`);
  if (material.templateMode === "experiment") return renderPage(material, pageNumber, "Untersuchen und auswerten", `${renderTaskGrid(material.tasks, 2, 4)}${renderTable(["Beobachtung", "Erklärung", "Fachbegriff"], 4)}`);
  return renderPage(material, pageNumber, "Verstehen und anwenden", `${renderTaskGrid(material.tasks, 0, 4)}${renderTable(["Aufgabe", "Lösung", "Begründung"], 4)}`);
}
function renderChoicePage(material, pageNumber = 4) { return renderPage(material, pageNumber, "Wähle dein Niveau", `${renderDifferentiation(material)}${renderWriteBox("Meine Zusatzidee oder Begründung:", 6)}`); }
function renderReflectionPage(material, pageNumber = 4) { return renderPage(material, pageNumber, "Sichern und reflektieren", `<section class="material-section no-break"><div class="section-kicker">Check</div><h2>Prüfe dein Ergebnis</h2>${renderList(material.qualityCheck, "check-list")}</section>${renderWriteBox(material.reflection, 5)}${renderScobees(material)}`); }
function renderBooklet(material) {
  const count = pageCount(material.variant);
  if (count === 2) return `<article class="booklet booklet-v4 ${escapeHtml(material.templateMode)}">${renderCover(material)}${renderReflectionPage(material, 2)}</article>`;
  if (count === 4) return `<article class="booklet booklet-v4 ${escapeHtml(material.templateMode)}">${renderCover(material)}${renderOrientationPage(material, 2)}${renderWorkPage(material, 3)}${renderReflectionPage(material, 4)}</article>`;
  return `<article class="booklet booklet-v4 ${escapeHtml(material.templateMode)}">${renderCover(material)}${renderOrientationPage(material, 2)}${renderWorkPage(material, 3)}${renderChoicePage(material, 4)}${renderReflectionPage(material, 5)}${renderPage(material, 6, "Abgabe prüfen", `${renderScobees(material)}${renderWriteBox("Letzte Kontrolle: Was muss noch verbessert werden?", 5)}`)}</article>`;
}
function renderWorksheet(material) { return `<article class="worksheet worksheet-v4">${renderGoal(material)}${renderQuestion(material)}${renderHowToWork(material)}<section class="material-section"><div class="section-kicker">Aufgaben</div><h2>Arbeite Schritt für Schritt</h2>${renderTaskGrid(material.tasks, 0, 4)}</section>${renderWriteBox(material.reflection, 4)}${renderScobees(material)}</article>`; }
function renderMaterial(material) { return material.templateMode === "worksheet" ? renderWorksheet(material) : renderBooklet(material); }

function buildTeacherNote(material, data) { return `# Lehrkraft-Notiz\n\n## Material\n- Fach: ${fallback(data.fach, material.metadata.subject)}\n- Klasse: ${fallback(data.klasse, material.metadata.className)}\n- Thema: ${material.title}\n- Template: ${modeLabels[material.templateMode] || material.templateMode}\n- Umfang: ${material.variant}\n- Dauer: ${material.metadata.duration}\n\n## Selbstständigkeit\nDas Material ist als selbstständiger Arbeitsweg angelegt.\n\n## Ziel\n${material.goal}\n\n## Leitfrage\n${material.guidingQuestion}\n\n## Scobees\n${material.scobeesSubmission}\n`; }
function buildScobeesText(material) { return `Titel: ${material.title}\n\nZiel:\n${material.goal}\n\nLeitfrage:\n${material.guidingQuestion}\n\nArbeitsweg:\n${(workSteps[material.templateMode] || workSteps.worksheet).join("\n")}\n\nAbgabe:\n${material.scobeesSubmission}\n`; }
function buildMetaJson(material, data) { return JSON.stringify({ title: material.title, subject: material.metadata.subject, className: material.metadata.className, templateMode: material.templateMode, variant: material.variant, duration: material.metadata.duration, level: material.metadata.level, selfDirected: true, source: currentSource, generatedAt: new Date().toISOString(), requestedOutputs: data.output || [] }, null, 2); }
function buildFullHtmlDocument(material) { return `<!doctype html><html lang="de"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(material.title)}</title><link rel="stylesheet" href="./styles.css" /><link rel="stylesheet" href="./print.css" /><link rel="stylesheet" href="./v4.css" /></head><body class="export-body"><main class="export-page">${renderMaterial(material)}</main></body></html>`; }

function saveDraft(data) { localStorage.setItem(draftStorageKey, JSON.stringify(data)); }
function saveMaterial(material, source) { currentMaterial = material; currentSource = source; localStorage.setItem(materialStorageKey, JSON.stringify({ material, source })); }
function restoreDraft() { const raw = localStorage.getItem(draftStorageKey); if (!raw) return; const data = JSON.parse(raw); Object.entries(data).forEach(([key, value]) => { if (Array.isArray(value)) { form.querySelectorAll(`input[name="${key}"]`).forEach((input) => { input.checked = value.includes(input.value); }); return; } const field = form.elements[key]; if (!field) return; if (field instanceof RadioNodeList) { const radio = Array.from(field).find((input) => input.value === value); if (radio) radio.checked = true; return; } field.value = value; }); }
function restoreMaterial() { const raw = localStorage.getItem(materialStorageKey); if (!raw) return null; const parsed = JSON.parse(raw); return parsed && parsed.material ? parsed : null; }
function renderCurrent(material, source) { materialPreview.innerHTML = renderMaterial(material); statusPill.textContent = source === "ai" ? "KI-Material" : "Basis-Material"; previewTitle.textContent = `${source === "ai" ? "KI-generiert" : "Regelbasiert"} · ${modeLabels[material.templateMode] || "Material"}`; }
function updateFallbackPreview() { const data = getFormData(); saveDraft(data); if (currentSource === "ai") return; const material = validateMaterial(buildFallbackMaterial(data), data); saveMaterial(material, "fallback"); renderCurrent(material, "fallback"); }
async function generateMaterial() { const data = getFormData(); saveDraft(data); generateButton.disabled = true; generateButton.textContent = "Material entsteht ..."; generatorMessage.textContent = "Das Material wird in feste Seiten gesetzt."; try { const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Material konnte nicht generiert werden."); const source = payload.source === "ai" ? "ai" : "fallback"; const material = validateMaterial(payload.material, data); saveMaterial(material, source); renderCurrent(material, source); generatorMessage.textContent = source === "ai" ? "Fertig. Das Material ist als selbstständiger Lernweg aufgebaut." : payload.message || "Regelbasierter Entwurf erzeugt."; } catch (error) { const material = validateMaterial(buildFallbackMaterial(data), data); saveMaterial(material, "fallback"); renderCurrent(material, "fallback"); generatorMessage.textContent = `Fallback aktiv: ${error.message}`; } finally { generateButton.disabled = false; generateButton.textContent = "Material generieren"; } }
function downloadFile(filename, content, type) { const blob = new Blob([content], { type }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); URL.revokeObjectURL(link.href); }

generateButton.addEventListener("click", generateMaterial);
printButton.addEventListener("click", () => window.print());
downloadHtmlButton.addEventListener("click", () => { const material = currentMaterial || validateMaterial(buildFallbackMaterial(getFormData()), getFormData()); const name = slugify(`${material.metadata.subject}_${material.metadata.className}_${material.title}`); downloadFile(`${name}_index.html`, buildFullHtmlDocument(material), "text/html;charset=utf-8"); });
downloadNoteButton.addEventListener("click", () => { const data = getFormData(); const material = currentMaterial || validateMaterial(buildFallbackMaterial(data), data); const name = slugify(`${material.metadata.subject}_${material.metadata.className}_${material.title}`); downloadFile(`${name}_lehrkraft_notiz.md`, buildTeacherNote(material, data), "text/markdown;charset=utf-8"); });
downloadScobeesButton?.addEventListener("click", () => { const material = currentMaterial || validateMaterial(buildFallbackMaterial(getFormData()), getFormData()); const name = slugify(`${material.metadata.subject}_${material.metadata.className}_${material.title}`); downloadFile(`${name}_scobees.txt`, buildScobeesText(material), "text/plain;charset=utf-8"); });
downloadMetaButton?.addEventListener("click", () => { const data = getFormData(); const material = currentMaterial || validateMaterial(buildFallbackMaterial(data), data); const name = slugify(`${material.metadata.subject}_${material.metadata.className}_${material.title}`); downloadFile(`${name}_meta.json`, buildMetaJson(material, data), "application/json;charset=utf-8"); });
resetButton.addEventListener("click", () => { localStorage.removeItem(draftStorageKey); localStorage.removeItem(materialStorageKey); currentSource = "fallback"; currentMaterial = null; form.reset(); updateFallbackPreview(); generatorMessage.textContent = "Zurückgesetzt. Fülle den Materialbrief aus und generiere neues Material."; });
form.addEventListener("input", updateFallbackPreview);
form.addEventListener("change", updateFallbackPreview);
restoreDraft();
const restored = restoreMaterial();
if (restored) { currentMaterial = validateMaterial(restored.material, getFormData()); currentSource = restored.source || "fallback"; renderCurrent(currentMaterial, currentSource); } else { updateFallbackPreview(); }
