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

const draftStorageKey = "unterrichtsmaterialgenerator.input.v7";
const materialStorageKey = "unterrichtsmaterialgenerator.material.v7";
let currentMaterial = null;
let currentSource = "fallback";

const modeLabels = {
  knowledge: "Wissens-Forscherheft",
  experiment: "Experiment-Forscherheft",
  exploration: "Erkundungs-Forscherheft",
  worksheet: "Arbeitsblatt",
};

const workSteps = {
  knowledge: ["Lies den Wissenskasten.", "Bearbeite zuerst das Beispiel.", "Löse die Aufgaben mit den Fachwörtern.", "Prüfe am Ende deine Lösung."],
  experiment: ["Lies die Forscherfrage.", "Schreibe eine Vermutung.", "Führe die Untersuchung durch.", "Erkläre deine Beobachtung."],
  exploration: ["Lies die Erkundungsfrage.", "Recherchiere gezielt.", "Notiere Quelle/Fundort.", "Vergleiche und bewerte."],
  worksheet: ["Lies Ziel und Beispiel.", "Bearbeite die Aufgaben.", "Nutze Hilfen.", "Prüfe dein Ergebnis."],
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

function fallback(value, text) {
  return value && String(value).trim().length ? String(value).trim() : text;
}

function fitText(value, max = 520) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max).split(" ").slice(0, -1).join(" ");
  return cut || text.slice(0, max);
}

function paragraphize(text) {
  const clean = String(text || "").trim();
  if (!clean) return "";
  return clean
    .split(/\n{2,}|(?<=\.)\s+(?=[A-ZÄÖÜ])/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((p) => `<p>${escapeHtml(fitText(p, 260))}</p>`)
    .join("");
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

function asLines(value) {
  return String(value || "")
    .split(/\n|;|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function defaultQuestion(mode, topic) {
  if (mode === "experiment") return `Was können wir bei ${topic} beobachten und erklären?`;
  if (mode === "exploration") return `Was finde ich über ${topic} heraus und wie bewerte ich meine Ergebnisse?`;
  return `Was muss ich über ${topic} wissen, um Aufgaben dazu zu lösen?`;
}

function defaultSections(mode, topic) {
  if (mode === "exploration") {
    return [
      { page: 1, kind: "cover", title: "Start", body: `Du erkundest ${topic} selbstständig. Wichtig ist: Jede Aussage braucht eine Quelle, einen Fundort oder eine Beobachtung.` },
      { page: 2, kind: "input", title: "Recherche vorbereiten", body: `Formuliere zuerst, wonach du suchst. Gute Ergebnisse passen zur Leitfrage, sind verständlich und haben einen Fundort. Schreibe nie nur eine Behauptung auf, sondern immer: Was habe ich gefunden? Wo habe ich es gefunden? Warum ist es wichtig?` },
      { page: 3, kind: "tasks", title: "Recherchieren und auswerten", body: `Sammle mindestens drei Ergebnisse. Vergleiche sie mit deinen Kriterien. Entscheide anschließend, welches Ergebnis für die Leitfrage am wichtigsten ist.` },
      { page: 4, kind: "reflection", title: "Sicherung", body: `Formuliere dein Ergebnis in zwei bis drei Sätzen. Nutze mindestens eine Quelle oder einen Fundort als Beleg.` },
    ];
  }
  if (mode === "experiment") {
    return [
      { page: 1, kind: "cover", title: "Start", body: `Du untersuchst ${topic} selbstständig. Arbeite sorgfältig und notiere Beobachtungen, bevor du erklärst.` },
      { page: 2, kind: "input", title: "Versuch vorbereiten", body: `Lies zuerst die Forscherfrage. Notiere Material, Vermutung und Durchführung. Eine gute Durchführung ist so genau, dass jemand anderes sie nachmachen könnte.` },
      { page: 3, kind: "tasks", title: "Beobachten und erklären", body: `Trage Beobachtungen sachlich ein. Erkläre erst danach, was sie bedeuten. Nutze passende Fachbegriffe.` },
      { page: 4, kind: "reflection", title: "Sicherung", body: `Vergleiche Vermutung und Ergebnis. Formuliere einen Merksatz.` },
    ];
  }
  return [
    { page: 1, kind: "cover", title: "Start", body: `Du arbeitest selbstständig zu ${topic}. Lies genau, nutze Fachwörter und schreibe vollständige kurze Antworten.` },
    { page: 2, kind: "input", title: "Wissen aufbauen", body: `Zu ${topic} brauchst du zuerst eine klare Erklärung, wichtige Begriffe und ein Beispiel. Lies den Wissenskasten und übertrage die Begriffe in die Tabelle.` },
    { page: 3, kind: "tasks", title: "Verstehen und anwenden", body: `Bearbeite die Aufgaben der Reihe nach. Nutze das Beispiel von Seite 2 als Muster. Begründe mindestens eine Antwort mit weil.` },
    { page: 4, kind: "reflection", title: "Sichern", body: `Schreibe einen Merksatz und prüfe, ob du die wichtigsten Begriffe richtig benutzt hast.` },
  ];
}

function defaultTasks(mode, topic, terms) {
  if (mode === "exploration") return [
    { label: "A1", title: "Suchfrage festlegen", instruction: `Schreibe eine konkrete Suchfrage zu ${topic}.`, support: "Ich suche heraus, …" },
    { label: "A2", title: "Quelle/Fundort notieren", instruction: "Sammle mindestens zwei Ergebnisse und schreibe jeweils den Fundort dazu.", support: "Buchseite, Materialkarte, Webseite, Station oder Beobachtung." },
    { label: "A3", title: "Vergleichen", instruction: "Vergleiche zwei Ergebnisse mit zwei Kriterien.", support: "Kriterium: passend, glaubwürdig, wichtig, verständlich." },
    { label: "A4", title: "Bewerten", instruction: "Formuliere dein Ergebnis mit Begründung.", support: "Ich bewerte … als wichtig, weil …" },
  ];
  if (mode === "experiment") return [
    { label: "A1", title: "Vermutung", instruction: `Schreibe eine Vermutung zu ${topic}.`, support: "Ich vermute, dass …" },
    { label: "A2", title: "Durchführung", instruction: "Beschreibe die Durchführung in nummerierten Schritten.", support: "Schritt 1, Schritt 2, Schritt 3 …" },
    { label: "A3", title: "Beobachtung", instruction: "Notiere, was du siehst, hörst oder misst.", support: "Keine Erklärung in dieses Feld." },
    { label: "A4", title: "Auswertung", instruction: "Erkläre deine Beobachtung mit Fachbegriffen.", support: "Das zeigt, dass …" },
  ];
  return [
    { label: "A1", title: "Begriffe klären", instruction: `Erkläre zwei wichtige Begriffe zu ${topic} in eigenen Worten.`, support: `Nutze: ${terms.slice(0, 4).join(", ") || topic}.` },
    { label: "A2", title: "Beispiel verstehen", instruction: "Erkläre, warum das Beispiel auf Seite 2 passt.", support: "Das Beispiel passt, weil …" },
    { label: "A3", title: "Anwenden", instruction: `Bearbeite eine neue Situation zu ${topic} nach dem Muster.`, support: "Nenne Fachwort, Beispiel und Begründung." },
    { label: "A4", title: "Sichern", instruction: `Schreibe einen Merksatz zu ${topic}.`, support: "Ein Merksatz ist kurz und fachlich richtig." },
  ];
}

function buildFallbackMaterial(data) {
  const topic = fallback(data.thema, "Neues Thema");
  const subject = fallback(data.fach, "Fach");
  const className = fallback(data.klasse, "Klasse");
  const mode = data.templateMode || "knowledge";
  const terms = asLines(data.inhalte);
  const visibleTerms = terms.length ? terms : [topic, "Begriff", "Beispiel", "Begründung"];
  return {
    templateMode: mode,
    variant: data.variant || "4p",
    title: topic,
    subtitle: `${subject} · ${className}`,
    metadata: { subject, className, type: modeLabels[mode] || "Material", level: fallback(data.schwierigkeit, "mittel"), pattern: "selbstständiger Lernweg", duration: fallback(data.dauer, "60 Minuten") },
    goal: fallback(data.stundenziel, `Ich kann ${topic} erklären, anwenden und mein Ergebnis begründen.`),
    guidingQuestion: fallback(data.leitfrage, defaultQuestion(mode, topic)),
    intro: defaultSections(mode, topic)[0].body,
    example: {
      title: "Ausgefülltes Beispiel",
      body: mode === "knowledge" ? `Beispiel: Ein Begriff wird erklärt, an einem konkreten Fall gezeigt und mit einem Fachwort verbunden. So erkennst du, wie du eigene Antworten aufbauen sollst.` : `Beispiel: Ein gutes Ergebnis besteht aus Beobachtung/Quelle, kurzer Aussage und Begründung.` ,
      sample: mode === "knowledge" ? `Fachwort: … | Beispiel: … | Begründung: Das passt, weil …` : `Ich habe herausgefunden: … Quelle/Fundort: … Das ist wichtig, weil …`,
    },
    sections: defaultSections(mode, topic),
    tasks: defaultTasks(mode, topic, visibleTerms),
    differentiation: { star: "Bearbeite die Pflichtaufgaben mit Satzstartern.", planet: "Bearbeite alle Aufgaben und begründe mit weil.", rocket: "Ergänze ein eigenes Beispiel oder eine kritische Frage." },
    reflection: "Was habe ich verstanden? Was muss ich noch üben?",
    qualityCheck: ["Ich habe die Aufgaben vollständig bearbeitet.", "Ich habe Fachwörter genutzt.", "Ich habe mindestens eine Antwort begründet.", "Meine Abgabe ist lesbar."],
    scobeesSubmission: fallback(data.scobeesSubmission, "Lade die Sicherungsseite oder dein fertiges Ergebnis gut lesbar hoch."),
    teacherNote: { flow: ["Selbstständiger Start", "Wissensaufbau", "Anwendung", "Sicherung"], pitfalls: [fallback(data.vorwissen, "Begriffe ggf. vorentlasten."), fallback(data.hinweise, "Satzstarter helfen schwächeren Lernenden.")], adaptation: "Bei Bedarf nur Stern-Aufgaben bearbeiten lassen." },
  };
}

function validateMaterial(material, data) {
  const base = buildFallbackMaterial(data);
  const safe = material && typeof material === "object" ? material : {};
  return {
    ...base,
    ...safe,
    templateMode: safe.templateMode || data.templateMode || base.templateMode,
    variant: safe.variant || data.variant || base.variant,
    title: fitText(fallback(safe.title, base.title), 80),
    subtitle: fallback(safe.subtitle, base.subtitle),
    goal: fitText(fallback(safe.goal, base.goal), 260),
    guidingQuestion: fitText(fallback(safe.guidingQuestion, base.guidingQuestion), 150),
    intro: fitText(fallback(safe.intro, base.intro), 260),
    metadata: { ...base.metadata, ...(safe.metadata && typeof safe.metadata === "object" ? safe.metadata : {}) },
    example: { ...base.example, ...(safe.example && typeof safe.example === "object" ? safe.example : {}) },
    sections: normalizeArray(safe.sections, base.sections).slice(0, pageCount(safe.variant || data.variant || base.variant)).map((section, i) => ({ ...section, page: i + 1, body: fitText(section.body, 700) })),
    tasks: normalizeArray(safe.tasks, base.tasks).slice(0, 4).map((task, i) => ({
      label: fitText(task.label || base.tasks[i]?.label || `A${i + 1}`, 20),
      title: fitText(task.title || base.tasks[i]?.title || "Aufgabe", 80),
      instruction: fitText(task.instruction || base.tasks[i]?.instruction || "Bearbeite die Aufgabe.", 260),
      support: fitText(task.support || base.tasks[i]?.support || "Nutze das Beispiel.", 180),
    })),
    differentiation: { ...base.differentiation, ...(safe.differentiation && typeof safe.differentiation === "object" ? safe.differentiation : {}) },
    qualityCheck: normalizeArray(safe.qualityCheck, base.qualityCheck).filter((item) => !/Problemfrage|Input ist|Hauptaufgaben|altersgerecht|Generator/i.test(item)).slice(0, 4),
    scobeesSubmission: fitText(fallback(safe.scobeesSubmission, base.scobeesSubmission), 190),
    teacherNote: { ...base.teacherNote, ...(safe.teacherNote && typeof safe.teacherNote === "object" ? safe.teacherNote : {}) },
  };
}

function renderList(items, className = "") { return `<ul class="${className}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`; }
function sectionByPage(material, page, fallbackTitle, fallbackBody) { return material.sections.find((s) => Number(s.page) === page) || { title: fallbackTitle, body: fallbackBody, page }; }
function renderGoal(material) { return `<section class="goal-strip compact-goal no-break"><strong>Ziel</strong><span>${escapeHtml(material.goal)}</span></section>`; }
function renderQuestion(material) { return `<section class="question-box no-break"><span>Leitfrage</span><strong>${escapeHtml(material.guidingQuestion)}</strong></section>`; }
function renderHowToWork(material) { return `<section class="howto-box no-break"><h3>So arbeitest du selbstständig</h3>${renderList(workSteps[material.templateMode] || workSteps.worksheet, "howto-list")}</section>`; }
function renderWriteBox(label, lines = 5) { return `<div class="write-box no-break"><p>${escapeHtml(label)}</p>${Array.from({ length: lines }, () => "<span></span>").join("")}</div>`; }
function renderTable(headers, rows = 4) { return `<table class="material-table spacious-table no-break"><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${Array.from({ length: rows }, () => `<tr>${headers.map(() => "<td></td>").join("")}</tr>`).join("")}</tbody></table>`; }
function renderTask(task, index) { return `<article class="task-card task-card-compact no-break"><div class="task-number">${String(index + 1).padStart(2, "0")}</div><div><p class="task-label">${escapeHtml(task.label)}</p><h3>${escapeHtml(task.title)}</h3><p>${escapeHtml(task.instruction)}</p><div class="support-note">${escapeHtml(task.support)}</div>${renderWriteBox("Deine Antwort:", 3)}</div></article>`; }
function renderTaskGrid(tasks) { return `<div class="task-grid compact-task-grid rich-task-grid">${tasks.map((task, i) => renderTask(task, i)).join("")}</div>`; }
function renderScobees(material) { return `<section class="scobees-box no-break"><h3>Scobees-Abgabe</h3><p>${escapeHtml(material.scobeesSubmission)}</p></section>`; }
function renderPage(material, pageNumber, title, content) { return `<section class="page booklet-page"><header class="page-header"><span>${escapeHtml(material.metadata.subject)} · ${escapeHtml(material.metadata.className)}</span><strong>${escapeHtml(material.title)}</strong></header><main class="page-content"><div class="section-kicker">Seite ${pageNumber}</div><h2>${escapeHtml(title)}</h2>${content}</main><footer class="page-footer">Seite ${pageNumber}</footer></section>`; }

function renderCover(material) {
  return renderPage(material, 1, material.metadata.type, `<div class="cover-hero"><p>${escapeHtml(material.subtitle)} · ${escapeHtml(material.metadata.duration)}</p><h1>${escapeHtml(material.title)}</h1></div>${renderGoal(material)}${renderQuestion(material)}<div class="name-box">Name: ________________________ Klasse: ______ Datum: ______</div>${renderHowToWork(material)}<section class="material-section no-break"><div class="section-kicker">Auftrag</div>${paragraphize(material.intro)}</section>`);
}
function renderKnowledgePage(material, pageNumber) {
  const section = sectionByPage(material, pageNumber, "Wissen aufbauen", material.example.body);
  const tableHeaders = material.templateMode === "exploration" ? ["Suchfrage", "Quelle/Fundort", "Warum passend?"] : material.templateMode === "experiment" ? ["Begriff/Material", "Bedeutung/Schritt", "Beispiel/Hinweis"] : ["Begriff", "Bedeutung", "Beispiel"];
  return renderPage(material, pageNumber, section.title, `<section class="material-section no-break"><div class="section-kicker">Wissenskasten</div>${paragraphize(section.body)}<p class="sample-answer">${escapeHtml(fitText(material.example.sample, 190))}</p></section>${renderTable(tableHeaders, 4)}`);
}
function renderWorkPage(material, pageNumber) {
  const section = sectionByPage(material, pageNumber, "Aufgaben", "Bearbeite die Aufgaben. Nutze den Wissenskasten als Hilfe.");
  const table = material.templateMode === "exploration" ? renderTable(["Quelle/Fundort", "Ergebnis", "Bewertung"], 3) : material.templateMode === "experiment" ? renderTable(["Beobachtung", "Erklärung", "Fachbegriff"], 3) : renderTable(["Aufgabe", "Lösung", "Begründung"], 3);
  return renderPage(material, pageNumber, section.title, `<section class="material-section no-break"><div class="section-kicker">Arbeitsauftrag</div>${paragraphize(section.body)}</section>${renderTaskGrid(material.tasks)}${table}`);
}
function renderSecurePage(material, pageNumber) {
  const section = sectionByPage(material, pageNumber, "Sichern und reflektieren", material.reflection);
  const checks = material.qualityCheck.length ? material.qualityCheck : ["Ich habe Fachwörter genutzt.", "Ich habe eine Antwort begründet.", "Meine Abgabe ist lesbar."];
  return renderPage(material, pageNumber, section.title, `<section class="material-section no-break"><div class="section-kicker">Sicherung</div>${paragraphize(section.body)}</section>${renderWriteBox(material.reflection, 5)}<section class="material-section no-break"><div class="section-kicker">Check</div>${renderList(checks, "check-list")}</section>${renderScobees(material)}`);
}
function renderChoicePage(material, pageNumber) { return renderPage(material, pageNumber, "Wähle dein Niveau", `<section class="material-section no-break"><div class="section-kicker">Differenzierung</div><h3>★ Stern</h3><p>${escapeHtml(material.differentiation.star)}</p><h3>● Planet</h3><p>${escapeHtml(material.differentiation.planet)}</p><h3>▲ Rakete</h3><p>${escapeHtml(material.differentiation.rocket)}</p></section>${renderWriteBox("Zusatzidee oder Begründung:", 6)}`); }
function renderBooklet(material) {
  const count = pageCount(material.variant);
  if (count === 2) return `<article class="booklet booklet-v4 ${escapeHtml(material.templateMode)}">${renderCover(material)}${renderSecurePage(material, 2)}</article>`;
  if (count === 4) return `<article class="booklet booklet-v4 ${escapeHtml(material.templateMode)}">${renderCover(material)}${renderKnowledgePage(material, 2)}${renderWorkPage(material, 3)}${renderSecurePage(material, 4)}</article>`;
  return `<article class="booklet booklet-v4 ${escapeHtml(material.templateMode)}">${renderCover(material)}${renderKnowledgePage(material, 2)}${renderWorkPage(material, 3)}${renderChoicePage(material, 4)}${renderSecurePage(material, 5)}${renderPage(material, 6, "Abgabe prüfen", `${renderScobees(material)}${renderWriteBox("Letzte Kontrolle: Was muss noch verbessert werden?", 5)}`)}</article>`;
}
function renderWorksheet(material) { return `<article class="worksheet worksheet-v4">${renderGoal(material)}${renderQuestion(material)}${renderHowToWork(material)}${renderTaskGrid(material.tasks)}${renderSecurePage(material, 1)}</article>`; }
function renderMaterial(material) { return material.templateMode === "worksheet" ? renderWorksheet(material) : renderBooklet(material); }

function buildTeacherNote(material, data) { return `# Lehrkraft-Notiz\n\n## Material\n- Fach: ${fallback(data.fach, material.metadata.subject)}\n- Klasse: ${fallback(data.klasse, material.metadata.className)}\n- Thema: ${material.title}\n- Template: ${modeLabels[material.templateMode] || material.templateMode}\n- Umfang: ${material.variant}\n\n## Ziel\n${material.goal}\n\n## Leitfrage\n${material.guidingQuestion}\n`; }
function buildScobeesText(material) { return `Titel: ${material.title}\n\nZiel:\n${material.goal}\n\nLeitfrage:\n${material.guidingQuestion}\n\nArbeitsweg:\n${(workSteps[material.templateMode] || workSteps.worksheet).join("\n")}\n\nAbgabe:\n${material.scobeesSubmission}\n`; }
function buildMetaJson(material, data) { return JSON.stringify({ title: material.title, subject: material.metadata.subject, className: material.metadata.className, templateMode: material.templateMode, variant: material.variant, duration: material.metadata.duration, selfDirected: true, source: currentSource, generatedAt: new Date().toISOString(), requestedOutputs: data.output || [] }, null, 2); }
function buildFullHtmlDocument(material) { return `<!doctype html><html lang="de"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(material.title)}</title><link rel="stylesheet" href="./styles.css" /><link rel="stylesheet" href="./print.css" /><link rel="stylesheet" href="./v4.css" /></head><body class="export-body"><main class="export-page">${renderMaterial(material)}</main></body></html>`; }

function saveDraft(data) { localStorage.setItem(draftStorageKey, JSON.stringify(data)); }
function saveMaterial(material, source) { currentMaterial = material; currentSource = source; localStorage.setItem(materialStorageKey, JSON.stringify({ material, source })); }
function restoreDraft() { const raw = localStorage.getItem(draftStorageKey); if (!raw) return; const data = JSON.parse(raw); Object.entries(data).forEach(([key, value]) => { if (Array.isArray(value)) { form.querySelectorAll(`input[name="${key}"]`).forEach((input) => { input.checked = value.includes(input.value); }); return; } const field = form.elements[key]; if (!field) return; if (field instanceof RadioNodeList) { const radio = Array.from(field).find((input) => input.value === value); if (radio) radio.checked = true; return; } field.value = value; }); }
function restoreMaterial() { const raw = localStorage.getItem(materialStorageKey); if (!raw) return null; const parsed = JSON.parse(raw); return parsed && parsed.material ? parsed : null; }
function renderCurrent(material, source) { materialPreview.innerHTML = renderMaterial(material); statusPill.textContent = source === "ai" ? "KI-Material" : "Basis-Material"; previewTitle.textContent = `${source === "ai" ? "KI-generiert" : "Regelbasiert"} · ${modeLabels[material.templateMode] || "Material"}`; }
function updateFallbackPreview() { const data = getFormData(); saveDraft(data); if (currentSource === "ai") return; const material = validateMaterial(buildFallbackMaterial(data), data); saveMaterial(material, "fallback"); renderCurrent(material, "fallback"); }
async function generateMaterial() { const data = getFormData(); saveDraft(data); generateButton.disabled = true; generateButton.textContent = "Material entsteht ..."; generatorMessage.textContent = "Das Material wird inhaltlich aufgebaut und dann gesetzt."; try { const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Material konnte nicht generiert werden."); const source = payload.source === "ai" ? "ai" : "fallback"; const material = validateMaterial(payload.material, data); saveMaterial(material, source); renderCurrent(material, source); generatorMessage.textContent = source === "ai" ? "Fertig. Das Material enthält Wissensaufbau, Aufgaben und Sicherung." : payload.message || "Regelbasierter Entwurf erzeugt."; } catch (error) { const material = validateMaterial(buildFallbackMaterial(data), data); saveMaterial(material, "fallback"); renderCurrent(material, "fallback"); generatorMessage.textContent = `Fallback aktiv: ${error.message}`; } finally { generateButton.disabled = false; generateButton.textContent = "Material generieren"; } }
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
