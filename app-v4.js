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

const draftStorageKey = "unterrichtsmaterialgenerator.input.v5";
const materialStorageKey = "unterrichtsmaterialgenerator.material.v5";

let currentMaterial = null;
let currentSource = "fallback";

const modeLabels = {
  knowledge: "Wissens-Forscherheft",
  experiment: "Experiment-Forscherheft",
  exploration: "Erkundungs-Forscherheft",
  worksheet: "Arbeitsblatt",
};

const workSteps = {
  knowledge: ["1. Lies den Auftrag.", "2. Markiere wichtige Begriffe.", "3. Bearbeite die Aufgaben der Reihe nach.", "4. Prüfe dein Ergebnis mit dem Check."],
  experiment: ["1. Lies die Forscherfrage.", "2. Formuliere eine Vermutung.", "3. Führe den Versuch Schritt für Schritt durch.", "4. Notiere zuerst Beobachtungen, dann Erklärungen."],
  exploration: ["1. Lies die Erkundungsfrage.", "2. Recherchiere oder beobachte gezielt.", "3. Notiere Fundort, Quelle oder Beleg.", "4. Vergleiche mit Kriterien und bewerte dein Ergebnis."],
  worksheet: ["1. Lies Ziel und Beispiel.", "2. Bearbeite die Aufgaben.", "3. Nutze die Hilfe, wenn du nicht weiterkommst.", "4. Prüfe dein Ergebnis."],
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

function clampText(value, max = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
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

function getPageCount(variant) {
  if (variant === "2p") return 2;
  if (variant === "6p") return 6;
  return 4;
}

function defaultGuidingQuestion(mode, topic) {
  if (mode === "experiment") return `Was können wir bei ${topic} beobachten und erklären?`;
  if (mode === "exploration") return `Was finde ich über ${topic} heraus und wie bewerte ich meine Ergebnisse?`;
  return `Was ist an ${topic} wichtig und wie kann ich es anwenden?`;
}

function defaultIntro(mode, topic) {
  if (mode === "experiment") return `Arbeite selbstständig: Lies die Schritte, führe die Untersuchung sorgfältig durch und trenne Beobachtung und Erklärung.`;
  if (mode === "exploration") return `Arbeite selbstständig: Recherchiere oder beobachte gezielt zu ${topic}, notiere Quellen/Fundorte und bewerte deine Ergebnisse mit Kriterien.`;
  return `Arbeite selbstständig: Lies den Input, bearbeite die Aufgaben und sichere am Ende dein Ergebnis.`;
}

function defaultTasks(mode, topic, terms) {
  if (mode === "experiment") {
    return [
      { label: "Vermutung", title: "Was glaubst du?", instruction: `Formuliere eine Vermutung zu ${topic}.`, support: "Ich vermute, dass …" },
      { label: "Durchführung", title: "Untersuche genau", instruction: "Führe den Versuch Schritt für Schritt durch.", support: "Verändere immer nur eine Sache." },
      { label: "Beobachtung", title: "Was siehst du?", instruction: "Notiere nur, was du beobachtest.", support: "Keine Erklärung, erst Beobachtung." },
      { label: "Auswertung", title: "Was bedeutet das?", instruction: "Erkläre deine Beobachtung mit Fachbegriffen.", support: `Nutze: ${terms.slice(0, 3).join(", ")}.` },
    ];
  }
  if (mode === "exploration") {
    return [
      { label: "Rechercheplan", title: "Wo suchst du?", instruction: `Lege fest, wo du Informationen zu ${topic} findest: Material, Buch, Webseite, Video, Station oder Beobachtung.`, support: "Notiere Quelle oder Fundort." },
      { label: "Kriterien", title: "Woran prüfst du?", instruction: "Lege 2–3 Kriterien fest, mit denen du deine Ergebnisse vergleichst.", support: "Zum Beispiel: verständlich, passend, glaubwürdig, wichtig." },
      { label: "Ergebnisse", title: "Was hast du herausgefunden?", instruction: "Sammle Ergebnisse in Stichpunkten und schreibe dazu, woher sie stammen.", support: "Eine Aussage ohne Fundort zählt noch nicht als Ergebnis." },
      { label: "Bewertung", title: "Was ist dein Ergebnis?", instruction: "Vergleiche deine Ergebnisse und formuliere eine begründete Bewertung.", support: "Ich bewerte …, weil meine Quelle/mein Beleg zeigt, dass …" },
    ];
  }
  return [
    { label: "Start", title: "Begriffe sichern", instruction: `Markiere drei wichtige Wörter zu ${topic}.`, support: `Nutze: ${terms.slice(0, 4).join(", ")}.` },
    { label: "Verstehen", title: "Beispiel prüfen", instruction: "Erkläre, was am Beispiel gut ist.", support: "Achte auf Begriff, Erklärung und Begründung." },
    { label: "Anwenden", title: "Eigene Lösung", instruction: `Löse eine Aufgabe zu ${topic}.`, support: "Kurz, klar, begründet." },
    { label: "Sichern", title: "Merksatz", instruction: `Schreibe einen Merksatz zu ${topic}.`, support: "Nutze eigene Worte." },
  ];
}

function defaultFlow(mode) {
  if (mode === "experiment") return ["Auftrag selbstständig lesen", "Vermutung notieren", "Versuch durchführen", "Beobachtung sichern", "Auswertung formulieren"];
  if (mode === "exploration") return ["Auftrag selbstständig lesen", "Rechercheweg wählen", "Kriterien festlegen", "Ergebnisse mit Quelle/Fundort sammeln", "Vergleichen und bewerten"];
  return ["Auftrag selbstständig lesen", "Input sichern", "Aufgaben bearbeiten", "Differenzierung nutzen", "Merksatz/Reflexion sichern"];
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
    guidingQuestion: fallback(data.leitfrage, defaultGuidingQuestion(mode, topic)),
    intro: defaultIntro(mode, topic),
    example: {
      title: "Beispiel",
      body: mode === "exploration"
        ? `Eine gute Erkundung nennt ein Ergebnis, den Fundort oder die Quelle und eine kurze Bewertung.`
        : `Eine gute Antwort zu ${topic} nennt eine Beobachtung und erklärt sie mit einem passenden Begriff.`,
      sample: mode === "exploration"
        ? `Ergebnis: … | Quelle/Fundort: … | Bewertung: Das ist wichtig, weil …`
        : `Ich erkenne ${topic}, weil ich ein Merkmal finde und es begründe.`,
    },
    tasks: defaultTasks(mode, topic, visibleTerms),
    differentiation: {
      star: "Bearbeite die Pflichtfelder. Schreibe kurze Stichpunkte und nutze die Satzstarter.",
      planet: "Bearbeite alle Pflichtfelder. Begründe mindestens eine Antwort mit weil.",
      rocket: "Ergänze eine eigene Frage, einen weiteren Beleg oder eine kritischere Bewertung.",
    },
    reflection: "Was hast du herausgefunden? Was war noch unsicher?",
    qualityCheck: mode === "exploration"
      ? ["Ich habe mindestens eine Quelle oder einen Fundort notiert.", "Ich habe Kriterien genutzt.", "Ich habe Ergebnisse verglichen.", "Ich habe mein Ergebnis begründet."]
      : ["Ich habe die wichtigsten Begriffe genutzt.", "Ich habe mindestens eine Antwort begründet.", "Ich habe mein Ergebnis geprüft."],
    scobeesSubmission: fallback(data.scobeesSubmission, "Lade die Sicherungsseite oder dein ausgefülltes Ergebnis hoch. Achte darauf, dass Name, Datum und Ergebnis gut lesbar sind."),
    teacherNote: {
      flow: defaultFlow(mode),
      pitfalls: [fallback(data.vorwissen, "Vorwissen kurz aktivieren."), fallback(data.hinweise, "Bei Überforderung Startauftrag vormachen.")],
      adaptation: "Bei Überforderung Stern-Niveau nutzen und nur Pflichtfelder bearbeiten lassen.",
    },
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
    title: fallback(safe.title, base.title),
    subtitle: fallback(safe.subtitle, base.subtitle),
    goal: clampText(fallback(safe.goal, base.goal), 250),
    guidingQuestion: clampText(fallback(safe.guidingQuestion, base.guidingQuestion), 140),
    intro: clampText(fallback(safe.intro, base.intro), 230),
    metadata: { ...base.metadata, ...(safe.metadata && typeof safe.metadata === "object" ? safe.metadata : {}) },
    example: { ...base.example, ...(safe.example && typeof safe.example === "object" ? safe.example : {}) },
    tasks: normalizeArray(safe.tasks, base.tasks).slice(0, 5).map((task, index) => ({
      label: clampText(task.label || base.tasks[index]?.label || "Aufgabe", 28),
      title: clampText(task.title || base.tasks[index]?.title || "Aufgabe", 68),
      instruction: clampText(task.instruction || base.tasks[index]?.instruction || "Bearbeite die Aufgabe.", 180),
      support: clampText(task.support || base.tasks[index]?.support || "Kurze Stichpunkte reichen.", 125),
    })),
    differentiation: { ...base.differentiation, ...(safe.differentiation && typeof safe.differentiation === "object" ? safe.differentiation : {}) },
    qualityCheck: normalizeArray(safe.qualityCheck, base.qualityCheck).slice(0, 5).map((item) => clampText(item, 110)),
    teacherNote: {
      flow: normalizeArray(safe.teacherNote?.flow, base.teacherNote.flow).slice(0, 6),
      pitfalls: normalizeArray(safe.teacherNote?.pitfalls, base.teacherNote.pitfalls).slice(0, 5),
      adaptation: fallback(safe.teacherNote?.adaptation, base.teacherNote.adaptation),
    },
  };
}

function renderList(items, className = "") {
  return `<ul class="${className}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderGoal(material) {
  return `<section class="goal-strip compact-goal no-break"><strong>Ziel</strong><span>${escapeHtml(material.goal)}</span></section>`;
}

function renderQuestion(material) {
  return `<section class="question-box no-break"><span>Leitfrage</span><strong>${escapeHtml(material.guidingQuestion)}</strong></section>`;
}

function renderHowToWork(material) {
  return `<section class="howto-box no-break"><h3>So arbeitest du selbstständig</h3>${renderList(workSteps[material.templateMode] || workSteps.worksheet, "howto-list")}</section>`;
}

function renderWriteBox(label, lines = 5) {
  return `<div class="write-box no-break"><p>${escapeHtml(label)}</p>${Array.from({ length: lines }, () => "<span></span>").join("")}</div>`;
}

function renderMiniCards(items) {
  return `<div class="mini-card-grid">${items.map((item) => `<div class="mini-card no-break">${escapeHtml(item)}</div>`).join("")}</div>`;
}

function renderTask(task, index) {
  return `<article class="task-card task-card-compact no-break"><div class="task-number">${String(index + 1).padStart(2, "0")}</div><div><p class="task-label">${escapeHtml(task.label)}</p><h3>${escapeHtml(task.title)}</h3><p>${escapeHtml(task.instruction)}</p><div class="support-note">${escapeHtml(task.support)}</div></div></article>`;
}

function renderTaskGrid(tasks, start = 0, end = tasks.length) {
  return `<div class="task-grid compact-task-grid">${tasks.slice(start, end).map((task, index) => renderTask(task, start + index)).join("")}</div>`;
}

function renderDifferentiation(material) {
  return `<section class="material-section no-break"><div class="section-kicker">Wahlhilfe</div><h2>Stern · Planet · Rakete</h2><div class="levels"><article class="level-star"><span class="level-icon">★</span><h3>Stern</h3><p>${escapeHtml(clampText(material.differentiation.star, 120))}</p></article><article class="level-planet"><span class="level-icon">●</span><h3>Planet</h3><p>${escapeHtml(clampText(material.differentiation.planet, 120))}</p></article><article class="level-rocket"><span class="level-icon">▲</span><h3>Rakete</h3><p>${escapeHtml(clampText(material.differentiation.rocket, 120))}</p></article></div></section>`;
}

function renderScobees(material) {
  return `<section class="scobees-box no-break"><h3>Scobees-Abgabe</h3><p>${escapeHtml(clampText(material.scobeesSubmission, 180))}</p></section>`;
}

function renderTable(headers, rows = 4) {
  return `<table class="material-table spacious-table no-break"><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${Array.from({ length: rows }, () => `<tr>${headers.map(() => "<td></td>").join("")}</tr>`).join("")}</tbody></table>`;
}

function renderPage(material, pageNumber, title, content) {
  return `<section class="page booklet-page"><header class="page-header"><span>${escapeHtml(material.metadata.subject)} · ${escapeHtml(material.metadata.className)}</span><strong>${escapeHtml(material.title)}</strong></header><main class="page-content"><div class="section-kicker">Seite ${pageNumber}</div><h2>${escapeHtml(title)}</h2>${content}</main><footer class="page-footer">Seite ${pageNumber}</footer></section>`;
}

function renderCover(material) {
  return renderPage(
    material,
    1,
    material.metadata.type,
    `<div class="cover-hero"><p>${escapeHtml(material.subtitle)} · ${escapeHtml(material.metadata.duration)}</p><h1>${escapeHtml(material.title)}</h1></div>${renderGoal(material)}${renderQuestion(material)}<div class="name-box">Name: ________________________ Klasse: ______ Datum: ______</div>${renderHowToWork(material)}<section class="material-section no-break"><div class="section-kicker">Start</div><h2>Dein Auftrag</h2><p>${escapeHtml(material.intro)}</p></section>`
  );
}

function renderInputPage(material, pageNumber = 2) {
  const terms = asLines(material.example.body).length ? asLines(material.example.body) : [material.example.body];
  const title = material.templateMode === "exploration" ? "Recherche vorbereiten" : "Kurz-Input und Beispiel";
  const body = material.templateMode === "exploration"
    ? `<section class="material-section no-break"><div class="section-kicker">Recherche</div><h2>Bevor du suchst</h2><p>Notiere zuerst, wonach du suchst und woran du gute Ergebnisse erkennst. Nutze Material, Buch, Station, Webseite oder Beobachtung nur, wenn du Fundort oder Quelle festhältst.</p></section>${renderTable(["Suchfrage", "Quelle/Fundort", "Warum passend?"], 3)}`
    : `<section class="material-section no-break"><div class="section-kicker">Merken</div><h2>Das brauchst du</h2><p>${escapeHtml(clampText(material.example.body, 240))}</p><p class="sample-answer">${escapeHtml(clampText(material.example.sample, 160))}</p></section>${renderMiniCards(terms.slice(0, 4))}${renderWriteBox("Notiere 3 wichtige Wörter:", 3)}`;
  return renderPage(material, pageNumber, title, body);
}

function renderExplorePage(material, pageNumber = 3) {
  const mode = material.templateMode;
  if (mode === "experiment") {
    return renderPage(material, pageNumber, "Vermuten und untersuchen", `${renderTaskGrid(material.tasks, 0, 2)}${renderTable(["Material / Schritt", "Beobachtung", "Hinweis"], 4)}`);
  }
  if (mode === "exploration") {
    return renderPage(material, pageNumber, "Recherchieren und sammeln", `${renderTaskGrid(material.tasks, 0, 3)}${renderTable(["Quelle/Fundort", "Ergebnis in Stichworten", "Beleg / Beispiel"], 4)}`);
  }
  return renderPage(material, pageNumber, "Verstehen", `${renderTaskGrid(material.tasks, 0, 2)}${renderWriteBox("Erkläre das Beispiel in eigenen Worten:", 5)}`);
}

function renderApplyPage(material, pageNumber = 4) {
  const mode = material.templateMode;
  const table = mode === "experiment"
    ? renderTable(["Beobachtung", "Erklärung", "Fachbegriff"], 3)
    : mode === "exploration"
      ? renderTable(["Kriterium", "Ergebnis A", "Ergebnis B", "Bewertung"], 3)
      : renderTable(["Aufgabe", "Lösung", "Begründung"], 3);
  const title = mode === "exploration" ? "Vergleichen und bewerten" : "Anwenden und vergleichen";
  return renderPage(material, pageNumber, title, `${renderTaskGrid(material.tasks, mode === "exploration" ? 3 : 2, 5)}${table}`);
}

function renderChoicePage(material, pageNumber = 5) {
  return renderPage(material, pageNumber, "Wähle dein Niveau", `${renderDifferentiation(material)}${renderWriteBox("Meine Zusatzidee oder Begründung:", 6)}`);
}

function renderReflectionPage(material, pageNumber = 6) {
  return renderPage(
    material,
    pageNumber,
    "Sichern und reflektieren",
    `<section class="material-section no-break"><div class="section-kicker">Check</div><h2>Prüfe dein Ergebnis</h2>${renderList(material.qualityCheck, "check-list")}</section>${renderWriteBox(material.reflection, 5)}${renderScobees(material)}`
  );
}

function renderBooklet(material) {
  const count = getPageCount(material.variant);
  const pages = [renderCover(material)];
  if (count >= 2) pages.push(renderInputPage(material, 2));
  if (count >= 4) pages.push(renderExplorePage(material, 3), renderApplyPage(material, 4));
  if (count >= 6) pages.push(renderChoicePage(material, 5), renderReflectionPage(material, 6));
  if (count === 4) pages.push(renderReflectionPage(material, 5));
  return `<article class="booklet booklet-v4 ${escapeHtml(material.templateMode)}">${pages.join("")}</article>`;
}

function renderWorksheet(material) {
  return `<article class="worksheet worksheet-v4"><header class="worksheet-header"><div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div><div class="worksheet-title"><p>${escapeHtml(material.subtitle)}</p><h1>${escapeHtml(material.title)}</h1></div><div class="worksheet-meta"><span>${escapeHtml(material.metadata.type)}</span><span>${escapeHtml(material.metadata.duration)}</span></div></header>${renderGoal(material)}${renderQuestion(material)}${renderHowToWork(material)}<section class="material-section"><div class="section-kicker">Aufgaben</div><h2>Arbeite Schritt für Schritt</h2>${renderTaskGrid(material.tasks, 0, 4)}</section>${renderDifferentiation(material)}${renderWriteBox(material.reflection, 4)}${renderScobees(material)}</article>`;
}

function renderMaterial(material) {
  return material.templateMode === "worksheet" ? renderWorksheet(material) : renderBooklet(material);
}

function buildTeacherNote(material, data) {
  return `# Lehrkraft-Notiz\n\n## Material\n- Fach: ${fallback(data.fach, material.metadata.subject)}\n- Klasse: ${fallback(data.klasse, material.metadata.className)}\n- Thema: ${material.title}\n- Template: ${modeLabels[material.templateMode] || material.templateMode}\n- Umfang: ${material.variant}\n- Dauer: ${material.metadata.duration}\n\n## Selbstständigkeit\nDas Material muss ohne längere Lehrkraft-Einleitung nutzbar sein. Die erste Seite enthält Arbeitsweg und Auftrag.\n\n## Ziel\n${material.goal}\n\n## Leitfrage\n${material.guidingQuestion}\n\n## Ablauf\n${material.teacherNote.flow.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\n## Stolperstellen\n${material.teacherNote.pitfalls.map((item) => `- ${item}`).join("\n")}\n\n## Anpassung\n${material.teacherNote.adaptation}\n\n## Scobees\n${material.scobeesSubmission}\n`;
}

function buildScobeesText(material) {
  const modeStep = material.templateMode === "exploration" ? "Recherchiere, notiere Quelle/Fundort und bewerte mit Kriterien." : "Bearbeite die Seiten der Reihe nach.";
  return `Titel: ${material.title}\n\nZiel:\n${material.goal}\n\nLeitfrage:\n${material.guidingQuestion}\n\nArbeitsweg:\n${(workSteps[material.templateMode] || workSteps.worksheet).join("\n")}\n\nWichtig:\n${modeStep}\n\nAbgabe:\n${material.scobeesSubmission}\n\nReflexion:\n${material.reflection}\n`;
}

function buildMetaJson(material, data) {
  return JSON.stringify({
    title: material.title,
    subject: material.metadata.subject,
    className: material.metadata.className,
    templateMode: material.templateMode,
    templateLabel: modeLabels[material.templateMode] || material.templateMode,
    variant: material.variant,
    duration: material.metadata.duration,
    level: material.metadata.level,
    goal: material.goal,
    guidingQuestion: material.guidingQuestion,
    selfDirected: true,
    generatedAt: new Date().toISOString(),
    source: currentSource,
    requestedOutputs: data.output || [],
  }, null, 2);
}

function buildFullHtmlDocument(material) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(material.title)}</title><link rel="stylesheet" href="./styles.css" /><link rel="stylesheet" href="./print.css" /><link rel="stylesheet" href="./v4.css" /></head><body class="export-body"><main class="export-page">${renderMaterial(material)}</main></body></html>`;
}

function saveDraft(data) {
  localStorage.setItem(draftStorageKey, JSON.stringify(data));
}

function saveMaterial(material, source) {
  currentMaterial = material;
  currentSource = source;
  localStorage.setItem(materialStorageKey, JSON.stringify({ material, source }));
}

function restoreDraft() {
  const raw = localStorage.getItem(draftStorageKey);
  if (!raw) return;
  const data = JSON.parse(raw);
  Object.entries(data).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      form.querySelectorAll(`input[name="${key}"]`).forEach((input) => {
        input.checked = value.includes(input.value);
      });
      return;
    }
    const field = form.elements[key];
    if (!field) return;
    if (field instanceof RadioNodeList) {
      const radio = Array.from(field).find((input) => input.value === value);
      if (radio) radio.checked = true;
      return;
    }
    field.value = value;
  });
}

function restoreMaterial() {
  const raw = localStorage.getItem(materialStorageKey);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  return parsed && parsed.material ? parsed : null;
}

function renderCurrent(material, source) {
  materialPreview.innerHTML = renderMaterial(material);
  statusPill.textContent = source === "ai" ? "KI-Material" : "Basis-Material";
  previewTitle.textContent = `${source === "ai" ? "KI-generiert" : "Regelbasiert"} · ${modeLabels[material.templateMode] || "Material"}`;
}

function updateFallbackPreview() {
  const data = getFormData();
  saveDraft(data);
  if (currentSource === "ai") return;
  const material = validateMaterial(buildFallbackMaterial(data), data);
  saveMaterial(material, "fallback");
  renderCurrent(material, "fallback");
}

async function generateMaterial() {
  const data = getFormData();
  saveDraft(data);
  generateButton.disabled = true;
  generateButton.textContent = "Material entsteht ...";
  generatorMessage.textContent = "Das Material wird als selbstständiger Arbeitsweg aufgebaut.";

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Material konnte nicht generiert werden.");
    const source = payload.source === "ai" ? "ai" : "fallback";
    const material = validateMaterial(payload.material, data);
    saveMaterial(material, source);
    renderCurrent(material, source);
    generatorMessage.textContent = source === "ai" ? "Fertig. Das Material ist als selbstständiger Lernweg aufgebaut." : payload.message || "Regelbasierter Entwurf erzeugt.";
  } catch (error) {
    const material = validateMaterial(buildFallbackMaterial(data), data);
    saveMaterial(material, "fallback");
    renderCurrent(material, "fallback");
    generatorMessage.textContent = `Fallback aktiv: ${error.message}`;
  } finally {
    generateButton.disabled = false;
    generateButton.textContent = "Material generieren";
  }
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

generateButton.addEventListener("click", generateMaterial);
printButton.addEventListener("click", () => window.print());

downloadHtmlButton.addEventListener("click", () => {
  const material = currentMaterial || validateMaterial(buildFallbackMaterial(getFormData()), getFormData());
  const name = slugify(`${material.metadata.subject}_${material.metadata.className}_${material.title}`);
  downloadFile(`${name}_index.html`, buildFullHtmlDocument(material), "text/html;charset=utf-8");
});

downloadNoteButton.addEventListener("click", () => {
  const data = getFormData();
  const material = currentMaterial || validateMaterial(buildFallbackMaterial(data), data);
  const name = slugify(`${material.metadata.subject}_${material.metadata.className}_${material.title}`);
  downloadFile(`${name}_lehrkraft_notiz.md`, buildTeacherNote(material, data), "text/markdown;charset=utf-8");
});

downloadScobeesButton?.addEventListener("click", () => {
  const material = currentMaterial || validateMaterial(buildFallbackMaterial(getFormData()), getFormData());
  const name = slugify(`${material.metadata.subject}_${material.metadata.className}_${material.title}`);
  downloadFile(`${name}_scobees.txt`, buildScobeesText(material), "text/plain;charset=utf-8");
});

downloadMetaButton?.addEventListener("click", () => {
  const data = getFormData();
  const material = currentMaterial || validateMaterial(buildFallbackMaterial(data), data);
  const name = slugify(`${material.metadata.subject}_${material.metadata.className}_${material.title}`);
  downloadFile(`${name}_meta.json`, buildMetaJson(material, data), "application/json;charset=utf-8");
});

resetButton.addEventListener("click", () => {
  localStorage.removeItem(draftStorageKey);
  localStorage.removeItem(materialStorageKey);
  currentSource = "fallback";
  currentMaterial = null;
  form.reset();
  updateFallbackPreview();
  generatorMessage.textContent = "Zurückgesetzt. Fülle den Materialbrief aus und generiere neues Material.";
});

form.addEventListener("input", updateFallbackPreview);
form.addEventListener("change", updateFallbackPreview);

restoreDraft();
const restored = restoreMaterial();
if (restored) {
  currentMaterial = validateMaterial(restored.material, getFormData());
  currentSource = restored.source || "fallback";
  renderCurrent(currentMaterial, currentSource);
} else {
  updateFallbackPreview();
}
