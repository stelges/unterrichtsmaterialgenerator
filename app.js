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

const draftStorageKey = "unterrichtsmaterialgenerator.input.v3";
const materialStorageKey = "unterrichtsmaterialgenerator.material.v3";

let currentMaterial = null;
let currentSource = "fallback";

const modeLabels = {
  knowledge: "Wissens-Forscherheft",
  experiment: "Experiment-Forscherheft",
  exploration: "Erkundungs-Forscherheft",
  worksheet: "Arbeitsblatt",
};

function getCheckedValues(name) {
  return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map((item) => item.value);
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
    .filter(Boolean);
}

function fallback(value, text) {
  return value && String(value).trim().length ? String(value).trim() : text;
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

function buildFallbackMaterial(data) {
  const topic = fallback(data.thema, "Neues Thema");
  const subject = fallback(data.fach, "Fach");
  const className = fallback(data.klasse, "Klasse");
  const mode = data.templateMode || "knowledge";
  const modeLabel = modeLabels[mode] || "Material";
  const goal = fallback(data.stundenziel, `Ich kann ${topic} mit eigenen Worten erklären und eine passende Aufgabe dazu lösen.`);
  const guidingQuestion = fallback(data.leitfrage, defaultGuidingQuestion(mode, topic));
  const terms = asLines(data.inhalte).slice(0, 8);
  const visibleTerms = terms.length ? terms : [topic, "Begriff", "Beispiel", "Begründung"];
  const pagesWanted = data.variant === "6p" ? 6 : data.variant === "2p" ? 2 : 4;
  const sections = defaultSections(mode, topic, visibleTerms, pagesWanted);

  return {
    templateMode: mode,
    variant: data.variant || "4p",
    title: topic,
    subtitle: `${subject} · ${className}`,
    metadata: {
      subject,
      className,
      type: modeLabel,
      level: fallback(data.schwierigkeit, "eher leicht"),
      pattern: fallback(data.muster, modeLabel),
      duration: fallback(data.dauer, "60 Minuten"),
    },
    goal,
    guidingQuestion,
    intro: defaultIntro(mode, topic),
    example: {
      title: "So kann eine gute Antwort aussehen",
      body: `Eine gute Antwort nennt einen wichtigen Begriff zu ${topic}, erklärt ihn kurz und nutzt ein Beispiel.`,
      sample: `Ich erkenne ${topic}, weil ich ein Merkmal finde und meine Entscheidung begründe.`,
    },
    sections,
    tasks: defaultTasks(mode, topic, visibleTerms),
    differentiation: {
      star: "Nutze das Beispiel. Bearbeite zuerst die Startaufgabe und markiere wichtige Begriffe.",
      planet: "Bearbeite alle Pflichtaufgaben und begründe mindestens eine Antwort.",
      rocket: "Ergänze ein eigenes Beispiel, eine Zusatzfrage oder eine kritischere Bewertung.",
    },
    reflection: "Was kannst du jetzt besser als am Anfang der Stunde?",
    qualityCheck: [
      "Ich habe kurze, klare Sätze geschrieben.",
      "Ich habe mindestens eine Antwort begründet.",
      "Ich habe meine Arbeit noch einmal geprüft.",
    ],
    scobeesSubmission: fallback(
      data.scobeesSubmission,
      "Lade dein bearbeitetes PDF oder ein Foto deiner wichtigsten Ergebnisse in Scobees hoch. Schreibe dazu einen Satz: Das habe ich heute verstanden."
    ),
    teacherNote: {
      flow: defaultFlow(mode),
      pitfalls: [
        fallback(data.vorwissen, "Vorwissen prüfen und zentrale Begriffe kurz sichern."),
        fallback(data.hinweise, "Bei Unsicherheit Startauftrag gemeinsam vormachen."),
      ],
      adaptation: "Bei Überforderung weniger Text nutzen, Schreibfelder stärker vorstrukturieren und Stern-Hilfe sichtbar machen.",
    },
  };
}

function defaultGuidingQuestion(mode, topic) {
  if (mode === "experiment") return `Was können wir zu ${topic} beobachten und erklären?`;
  if (mode === "exploration") return `Wie können wir ${topic} sinnvoll erkunden und bewerten?`;
  return `Was ist an ${topic} wichtig und wie kann ich es anwenden?`;
}

function defaultIntro(mode, topic) {
  if (mode === "experiment") return `Du untersuchst ${topic} wie eine Forscherin oder ein Forscher: vermuten, durchführen, beobachten und erklären.`;
  if (mode === "exploration") return `Du erkundest ${topic}, sammelst Ergebnisse und bewertest sie mit klaren Kriterien.`;
  return `Du arbeitest Schritt für Schritt zu ${topic}: verstehen, anwenden, sichern und reflektieren.`;
}

function defaultFlow(mode) {
  if (mode === "experiment") {
    return ["Forscherfrage klären.", "Vermutungen sammeln.", "Durchführung sichern.", "Beobachtungen eintragen lassen.", "Auswertung und Merksatz sichern."];
  }
  if (mode === "exploration") {
    return ["Auftrag und Kriterien klären.", "Erkundung starten.", "Ergebnisse vergleichen.", "Bewertung formulieren.", "Scobees-Abgabe sichern."];
  }
  return ["Leitfrage und Ziel klären.", "Input/Beispiel gemeinsam lesen.", "Aufgaben selbstständig bearbeiten lassen.", "Stern/Planet/Rakete als Wahlhilfe nutzen.", "Sicherung einsammeln."];
}

function defaultTasks(mode, topic, terms) {
  if (mode === "experiment") {
    return [
      { label: "Vermutung", title: "Was glaubst du?", instruction: `Formuliere eine Vermutung zu ${topic}.`, support: "Beginne mit: Ich vermute, dass ..." },
      { label: "Durchführung", title: "Untersuche genau", instruction: "Führe den Versuch sorgfältig durch und arbeite Schritt für Schritt.", support: "Verändere immer nur eine Sache." },
      { label: "Beobachtung", title: "Was siehst du?", instruction: "Notiere deine Beobachtungen sachlich.", support: "Schreibe nicht sofort die Erklärung, sondern zuerst das Beobachtete." },
      { label: "Auswertung", title: "Was bedeutet das?", instruction: "Erkläre, was deine Beobachtung zeigt.", support: "Nutze passende Fachbegriffe." },
    ];
  }
  if (mode === "exploration") {
    return [
      { label: "Kriterien", title: "Worauf achtest du?", instruction: `Lege Kriterien fest, mit denen du ${topic} prüfen kannst.`, support: `Mögliche Begriffe: ${terms.slice(0, 4).join(", ")}.` },
      { label: "Erkunden", title: "Sammle Ergebnisse", instruction: "Sammle passende Informationen, Beispiele oder Beobachtungen.", support: "Notiere Quelle oder Fundort, wenn möglich." },
      { label: "Vergleichen", title: "Was ist besser geeignet?", instruction: "Vergleiche mindestens zwei Ergebnisse mit deinen Kriterien.", support: "Nutze eine Tabelle oder Stichpunkte." },
      { label: "Bewerten", title: "Dein Ergebnis", instruction: "Formuliere ein begründetes Ergebnis.", support: "Beginne mit: Ich bewerte ..., weil ..." },
    ];
  }
  return [
    { label: "Start", title: "Begriffe sichern", instruction: `Markiere oder notiere drei wichtige Wörter zu ${topic}.`, support: `Nutze diese Wörter: ${terms.slice(0, 4).join(", ")}.` },
    { label: "Verstehen", title: "Beispiel prüfen", instruction: "Lies das Beispiel und schreibe in einem Satz, was daran gut ist.", support: "Achte auf Begriff, Erklärung und Begründung." },
    { label: "Anwenden", title: "Eigene Lösung", instruction: `Löse eine eigene Aufgabe zu ${topic} und erkläre dein Vorgehen.`, support: "Schreibe lieber kurz und klar als lang und unsicher." },
    { label: "Sichern", title: "Mini-Erklärung", instruction: `Beende den Satz: Bei ${topic} ist wichtig, dass ...`, support: "Nutze eigene Worte." },
  ];
}

function defaultSections(mode, topic, terms, count) {
  const base = mode === "experiment"
    ? [
        ["Forscherfrage und Vermutung", `Was vermutest du zu ${topic}?`, "write"],
        ["Material und Durchführung", "Arbeite genau nach den Schritten und achte auf Sicherheit.", "check"],
        ["Beobachtung", "Trage sachlich ein, was du beobachtest.", "table"],
        ["Auswertung und Merksatz", "Erkläre deine Beobachtung und formuliere einen Merksatz.", "write"],
        ["Transfer", "Wo begegnet dir das Prinzip im Alltag?", "write"],
        ["Reflexion", "Was war eindeutig? Was war noch unsicher?", "reflection"],
      ]
    : mode === "exploration"
      ? [
          ["Erkundungsauftrag", `Erkunde ${topic} mit klaren Kriterien.`, "write"],
          ["Kriterien und Vorgehen", "Lege fest, worauf du achten willst.", "check"],
          ["Erkundung 1", "Sammle erste Ergebnisse.", "table"],
          ["Erkundung 2", "Sammle weitere Ergebnisse.", "table"],
          ["Vergleich und Bewertung", "Vergleiche und bewerte deine Ergebnisse.", "write"],
          ["Sicherung und Reflexion", "Formuliere dein Ergebnis und reflektiere deinen Lernweg.", "reflection"],
        ]
      : [
          ["Cover und Lernziel", `Heute geht es um ${topic}.`, "cover"],
          ["Einstieg und Vorwissen", "Aktiviere dein Vorwissen und notiere erste Ideen.", "write"],
          ["Input und Begriffe", `Wichtige Begriffe: ${terms.slice(0, 5).join(", ")}.`, "input"],
          ["Verstehen und Anwenden", "Bearbeite die Aufgaben und nutze das Beispiel.", "tasks"],
          ["Sicherung", "Formuliere einen Merksatz in eigenen Worten.", "write"],
          ["Reflexion", "Prüfe, was du verstanden hast.", "reflection"],
        ];
  return base.slice(0, count).map(([title, body, kind], index) => ({ title, body, kind, page: index + 1 }));
}

function validateMaterial(material, data) {
  const fallbackMaterial = buildFallbackMaterial(data);
  const safe = material && typeof material === "object" ? material : {};
  return {
    ...fallbackMaterial,
    ...safe,
    templateMode: safe.templateMode || data.templateMode || fallbackMaterial.templateMode,
    variant: safe.variant || data.variant || fallbackMaterial.variant,
    metadata: {
      ...fallbackMaterial.metadata,
      ...(safe.metadata && typeof safe.metadata === "object" ? safe.metadata : {}),
    },
    example: {
      ...fallbackMaterial.example,
      ...(safe.example && typeof safe.example === "object" ? safe.example : {}),
    },
    sections: normalizeArray(safe.sections, fallbackMaterial.sections),
    tasks: normalizeArray(safe.tasks, fallbackMaterial.tasks).slice(0, 6),
    differentiation: {
      ...fallbackMaterial.differentiation,
      ...(safe.differentiation && typeof safe.differentiation === "object" ? safe.differentiation : {}),
    },
    qualityCheck: normalizeArray(safe.qualityCheck, fallbackMaterial.qualityCheck).slice(0, 6),
    teacherNote: {
      flow: normalizeArray(safe.teacherNote?.flow, fallbackMaterial.teacherNote.flow).slice(0, 6),
      pitfalls: normalizeArray(safe.teacherNote?.pitfalls, fallbackMaterial.teacherNote.pitfalls).slice(0, 6),
      adaptation: fallback(safe.teacherNote?.adaptation, fallbackMaterial.teacherNote.adaptation),
    },
  };
}

function renderList(items, className = "") {
  return `<ul class="${className}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderLearningGoalBox(material) {
  return `<section class="goal-strip no-break"><strong>Ziel</strong><span>${escapeHtml(material.goal)}</span></section>`;
}

function renderQuestionBox(material) {
  return `<div class="question-box no-break"><span>Leitfrage</span><strong>${escapeHtml(material.guidingQuestion)}</strong></div>`;
}

function renderWriteBox(label = "Deine Notizen", lines = 5) {
  return `<div class="write-box no-break"><p>${escapeHtml(label)}</p>${Array.from({ length: lines }, () => "<span></span>").join("")}</div>`;
}

function renderScobeesSubmissionBox(material) {
  return `<section class="scobees-box no-break"><h3>Scobees-Abgabe</h3><p>${escapeHtml(material.scobeesSubmission)}</p></section>`;
}

function renderTasks(tasks) {
  return tasks
    .map((task, index) => `
      <article class="task-card no-break">
        <div class="task-number">${String(index + 1).padStart(2, "0")}</div>
        <div>
          <p class="task-label">${escapeHtml(task.label || "Aufgabe")}</p>
          <h3>${escapeHtml(task.title || "Aufgabe bearbeiten")}</h3>
          <p>${escapeHtml(task.instruction || "")}</p>
          ${task.support ? `<div class="support-note">${escapeHtml(task.support)}</div>` : ""}
        </div>
      </article>
    `)
    .join("");
}

function renderStarPlanetRocket(material) {
  return `
    <div class="levels no-break">
      <article class="level-star"><span class="level-icon">★</span><h3>Stern</h3><p>${escapeHtml(material.differentiation.star)}</p></article>
      <article class="level-planet"><span class="level-icon">●</span><h3>Planet</h3><p>${escapeHtml(material.differentiation.planet)}</p></article>
      <article class="level-rocket"><span class="level-icon">▲</span><h3>Rakete</h3><p>${escapeHtml(material.differentiation.rocket)}</p></article>
    </div>
  `;
}

function renderObservationTable() {
  return `
    <table class="material-table no-break">
      <thead><tr><th>Schritt / Quelle</th><th>Beobachtung / Ergebnis</th><th>Erklärung / Bewertung</th></tr></thead>
      <tbody>
        <tr><td></td><td></td><td></td></tr>
        <tr><td></td><td></td><td></td></tr>
        <tr><td></td><td></td><td></td></tr>
      </tbody>
    </table>
  `;
}

function renderSectionContent(section, material) {
  if (section.kind === "table") return renderObservationTable();
  if (section.kind === "tasks") return renderTasks(material.tasks);
  if (section.kind === "input") {
    return `<div class="input-box no-break"><p>${escapeHtml(section.body)}</p><p>${escapeHtml(material.example.body)}</p><p class="sample-answer">${escapeHtml(material.example.sample)}</p></div>`;
  }
  if (section.kind === "reflection") {
    return `<p>${escapeHtml(section.body)}</p>${renderWriteBox(material.reflection, 4)}${renderList(material.qualityCheck, "check-list")}`;
  }
  return `<p>${escapeHtml(section.body)}</p>${renderWriteBox("Bearbeite hier:", section.page === 1 ? 4 : 6)}`;
}

function renderCover(material) {
  return `
    <section class="page cover-page">
      <header class="worksheet-header">
        <div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
        <div class="worksheet-title">
          <p>${escapeHtml(material.subtitle)}</p>
          <h1>${escapeHtml(material.title)}</h1>
        </div>
        <div class="worksheet-meta">
          <span>${escapeHtml(material.metadata.type)}</span>
          <span>${escapeHtml(material.metadata.duration)}</span>
        </div>
      </header>
      ${renderLearningGoalBox(material)}
      ${renderQuestionBox(material)}
      <div class="name-box">Name: ____________________________ Klasse: __________ Datum: __________</div>
      <section class="material-section">
        <div class="section-kicker">Start</div>
        <h2>Worum geht es?</h2>
        <p>${escapeHtml(material.intro)}</p>
      </section>
      ${renderScobeesSubmissionBox(material)}
      <footer class="page-footer">Seite 1</footer>
    </section>
  `;
}

function renderPage(section, material, index, total) {
  return `
    <section class="page">
      <header class="page-header">
        <span>${escapeHtml(material.metadata.subject)} · ${escapeHtml(material.metadata.className)}</span>
        <strong>${escapeHtml(material.title)}</strong>
      </header>
      <main class="page-content">
        <div class="section-kicker">Schritt ${index + 1}</div>
        <h2>${escapeHtml(section.title)}</h2>
        ${renderSectionContent(section, material)}
        ${index === total - 2 ? renderStarPlanetRocket(material) : ""}
        ${index === total - 1 ? renderScobeesSubmissionBox(material) : ""}
      </main>
      <footer class="page-footer">Seite ${index + 1}</footer>
    </section>
  `;
}

function renderBooklet(material) {
  const sections = normalizeArray(material.sections, buildFallbackMaterial(getFormData()).sections);
  const pages = [renderCover(material)];
  sections.slice(1).forEach((section, index) => pages.push(renderPage(section, material, index + 1, sections.length)));
  return `<article class="booklet ${escapeHtml(material.templateMode)}">${pages.join("")}</article>`;
}

function renderMaterial(material) {
  if (material.templateMode === "worksheet") {
    return `
      <article class="worksheet">
        <header class="worksheet-header">
          <div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
          <div class="worksheet-title"><p>${escapeHtml(material.subtitle)}</p><h1>${escapeHtml(material.title)}</h1></div>
          <div class="worksheet-meta"><span>${escapeHtml(material.metadata.type)}</span><span>${escapeHtml(material.metadata.level)}</span></div>
        </header>
        ${renderLearningGoalBox(material)}
        ${renderQuestionBox(material)}
        <section class="material-section"><div class="section-kicker">Start</div><h2>Worum geht es?</h2><p>${escapeHtml(material.intro)}</p></section>
        <section class="material-section"><div class="section-kicker">Arbeitsphase</div><h2>Aufgaben</h2><div class="task-grid">${renderTasks(material.tasks)}</div></section>
        <section class="material-section"><div class="section-kicker">Wahlhilfe</div><h2>Stern · Planet · Rakete</h2>${renderStarPlanetRocket(material)}</section>
        <section class="material-section reflection-section"><div><div class="section-kicker">Sicherung</div><h2>Zum Schluss</h2><p>${escapeHtml(material.reflection)}</p></div><div class="compact"><h2>Check</h2>${renderList(material.qualityCheck, "check-list")}</div></section>
        ${renderScobeesSubmissionBox(material)}
        <footer class="worksheet-footer"><span>${escapeHtml(material.metadata.subject)} · ${escapeHtml(material.metadata.className)}</span><span>Name: ____________________</span></footer>
      </article>
    `;
  }
  return renderBooklet(material);
}

function buildTeacherNote(material, data) {
  return `# Lehrkraft-Notiz

## Material
- Fach: ${fallback(data.fach, material.metadata.subject)}
- Klasse: ${fallback(data.klasse, material.metadata.className)}
- Thema: ${material.title}
- Materialtyp: ${material.metadata.type}
- Template: ${modeLabels[material.templateMode] || material.templateMode}
- Umfang: ${material.variant}
- Dauer: ${material.metadata.duration}

## Ziel
${material.goal}

## Leitfrage
${material.guidingQuestion}

## Ablauf
${material.teacherNote.flow.map((item, index) => `${index + 1}. ${item}`).join("\n")}

## Stolperstellen
${material.teacherNote.pitfalls.map((item) => `- ${item}`).join("\n")}

## Anpassung
${material.teacherNote.adaptation}

## Scobees
${material.scobeesSubmission}
`;
}

function buildScobeesText(material) {
  const steps = normalizeArray(material.sections, []).map((section, index) => `${index + 1}. ${section.title}: ${section.body}`).join("\n");
  return `Titel: ${material.title}

Ziel:
${material.goal}

Leitfrage:
${material.guidingQuestion}

Arbeitsweg:
${steps}

Abgabe:
${material.scobeesSubmission}

Reflexion:
${material.reflection}
`;
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
    generatedAt: new Date().toISOString(),
    source: currentSource,
    requestedOutputs: data.output || [],
  }, null, 2);
}

function buildFullHtmlDocument(material) {
  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(material.title)}</title>
    <link rel="stylesheet" href="./styles.css" />
    <link rel="stylesheet" href="./print.css" />
  </head>
  <body class="export-body">
    <main class="export-page">
      ${renderMaterial(material)}
    </main>
  </body>
</html>`;
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
  generatorMessage.textContent = "Die Inhalte werden fachlich ausgearbeitet und anschließend ins feste Template gesetzt.";

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
    generatorMessage.textContent =
      source === "ai"
        ? "Fertig. Das Material wurde mit KI erzeugt und im festen Template gerendert."
        : payload.message || "Kein API-Key gefunden. Ein regelbasierter Entwurf wurde erzeugt.";
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
  generatorMessage.textContent = "Zurückgesetzt. Fülle links die Eckdaten aus und generiere neues Material.";
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
