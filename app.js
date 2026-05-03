const form = document.querySelector("#briefForm");
const materialPreview = document.querySelector("#materialPreview");
const statusPill = document.querySelector("#statusPill");
const previewTitle = document.querySelector("#previewTitle");
const generatorMessage = document.querySelector("#generatorMessage");
const generateButton = document.querySelector("#generateButton");
const printButton = document.querySelector("#printButton");
const downloadHtmlButton = document.querySelector("#downloadHtmlButton");
const downloadNoteButton = document.querySelector("#downloadNoteButton");
const resetButton = document.querySelector("#resetButton");

const draftStorageKey = "unterrichtsmaterialgenerator.input.v2";
const materialStorageKey = "unterrichtsmaterialgenerator.material.v2";

let currentMaterial = null;
let currentSource = "fallback";

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
    vorwissen: data.get("vorwissen")?.trim() || "",
    materialtyp: data.get("materialtyp") || "",
    muster: data.get("muster") || "",
    schwierigkeit: data.get("schwierigkeit") || "",
    output: getCheckedValues("output"),
    textmenge: data.get("textmenge") || "",
    gestaltung: data.get("gestaltung") || "",
    schwerpunkte: getCheckedValues("schwerpunkte"),
    inhalte: data.get("inhalte")?.trim() || "",
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
  const goal = fallback(
    data.stundenziel,
    `Ich kann ${topic} mit eigenen Worten erklären und eine passende Aufgabe dazu lösen.`
  );
  const keywords = asLines(data.inhalte).slice(0, 8);
  const terms = keywords.length ? keywords : [topic, "Begriff", "Beispiel", "Regel"];
  const light = data.textmenge.includes("wenig") || data.schwierigkeit === "eher leicht";

  return {
    title: topic,
    subtitle: `${fallback(data.fach, "Fach")} · ${fallback(data.klasse, "Klasse")}`,
    metadata: {
      subject: fallback(data.fach, "Fach"),
      className: fallback(data.klasse, "Klasse"),
      type: fallback(data.materialtyp, "Arbeitsmaterial"),
      level: fallback(data.schwierigkeit, "eher leicht"),
      pattern: fallback(data.muster, "Input + Lese-Check"),
    },
    goal,
    intro: light
      ? `Heute arbeitest du zu ${topic}. Starte mit dem Beispiel und bearbeite die Aufgaben der Reihe nach.`
      : `Heute arbeitest du zu ${topic}. Achte darauf, wichtige Begriffe zu markieren, Antworten zu begründen und eigene Beispiele zu nutzen.`,
    example: {
      title: "So kann eine gute Antwort aussehen",
      body: `Eine gute Antwort nennt nicht nur ${terms[0]}, sondern erklärt kurz, woran man es erkennt.`,
      sample: `Ich erkenne ${terms[0]}, weil ich ${terms[1] || "ein Merkmal"} finde und meine Entscheidung mit einem Beispiel begründe.`,
    },
    tasks: [
      {
        label: "Start",
        title: "Begriffe sichern",
        instruction: `Markiere oder notiere drei wichtige Wörter zu ${topic}.`,
        support: `Nutze diese Wörter: ${terms.slice(0, 4).join(", ")}.`,
      },
      {
        label: "Verstehen",
        title: "Beispiel prüfen",
        instruction: "Lies das Beispiel und schreibe in einem Satz, was daran gut ist.",
        support: "Achte auf Begriff, Erklärung und Begründung.",
      },
      {
        label: "Anwenden",
        title: "Eigene Lösung",
        instruction: `Löse eine eigene Aufgabe zu ${topic} und erkläre dein Vorgehen.`,
        support: "Schreibe lieber kurz und klar als lang und unsicher.",
      },
      {
        label: "Sichern",
        title: "Mini-Erklärung",
        instruction: `Beende den Satz: Bei ${topic} ist wichtig, dass ...`,
        support: "Nutze eigene Worte.",
      },
    ],
    differentiation: {
      star: "Nutze das Beispiel. Bearbeite zuerst Aufgabe 1 und 2.",
      planet: "Bearbeite alle Aufgaben und begründe mindestens eine Antwort.",
      rocket: "Ergänze ein eigenes Beispiel oder eine schwierige Zusatzfrage.",
    },
    reflection: "Was kannst du jetzt besser als am Anfang der Stunde?",
    qualityCheck: [
      "Ich habe kurze, klare Sätze geschrieben.",
      "Ich habe mindestens eine Antwort begründet.",
      "Ich habe meine Arbeit noch einmal geprüft.",
    ],
    teacherNote: {
      flow: [
        "Ziel kurz klären und Beispiel gemeinsam lesen.",
        "Schüler:innen Aufgaben selbstständig bearbeiten lassen.",
        "Stern/Planet/Rakete als echte Wahlhilfe nutzen.",
        "Am Ende eine kurze Sicherung einsammeln.",
      ],
      pitfalls: [
        fallback(data.vorwissen, "Vorwissen prüfen und zentrale Begriffe kurz sichern."),
        fallback(data.hinweise, "Bei Unsicherheit Startauftrag gemeinsam vormachen."),
      ],
      adaptation: "Bei Überforderung weniger Text nutzen, Aufgabe 3 kürzen und Stern-Hilfe stärker sichtbar machen.",
    },
  };
}

function validateMaterial(material, data) {
  const fallbackMaterial = buildFallbackMaterial(data);
  const safe = material && typeof material === "object" ? material : {};
  return {
    title: fallback(safe.title, fallbackMaterial.title),
    subtitle: fallback(safe.subtitle, fallbackMaterial.subtitle),
    metadata: {
      ...fallbackMaterial.metadata,
      ...(safe.metadata && typeof safe.metadata === "object" ? safe.metadata : {}),
    },
    goal: fallback(safe.goal, fallbackMaterial.goal),
    intro: fallback(safe.intro, fallbackMaterial.intro),
    example: {
      ...fallbackMaterial.example,
      ...(safe.example && typeof safe.example === "object" ? safe.example : {}),
    },
    tasks: normalizeArray(safe.tasks, fallbackMaterial.tasks).slice(0, 5),
    differentiation: {
      ...fallbackMaterial.differentiation,
      ...(safe.differentiation && typeof safe.differentiation === "object" ? safe.differentiation : {}),
    },
    reflection: fallback(safe.reflection, fallbackMaterial.reflection),
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

function renderTasks(tasks) {
  return tasks
    .map(
      (task, index) => `
        <article class="task-card">
          <div class="task-number">${String(index + 1).padStart(2, "0")}</div>
          <div>
            <p class="task-label">${escapeHtml(task.label || "Aufgabe")}</p>
            <h3>${escapeHtml(task.title || "Aufgabe bearbeiten")}</h3>
            <p>${escapeHtml(task.instruction || "")}</p>
            ${task.support ? `<div class="support-note">${escapeHtml(task.support)}</div>` : ""}
          </div>
        </article>
      `
    )
    .join("");
}

function renderMaterial(material) {
  return `
    <article class="worksheet">
      <header class="worksheet-header">
        <div class="brand-mark" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div class="worksheet-title">
          <p>${escapeHtml(material.subtitle)}</p>
          <h1>${escapeHtml(material.title)}</h1>
        </div>
        <div class="worksheet-meta">
          <span>${escapeHtml(material.metadata.type)}</span>
          <span>${escapeHtml(material.metadata.level)}</span>
        </div>
      </header>

      <section class="goal-strip">
        <strong>Ziel</strong>
        <span>${escapeHtml(material.goal)}</span>
      </section>

      <section class="material-section intro-section">
        <div class="section-kicker">Start</div>
        <h2>Worum geht es?</h2>
        <p>${escapeHtml(material.intro)}</p>
        <div class="example-box">
          <h3>${escapeHtml(material.example.title)}</h3>
          <p>${escapeHtml(material.example.body)}</p>
          <p class="sample-answer">${escapeHtml(material.example.sample)}</p>
        </div>
      </section>

      <section class="material-section">
        <div class="section-kicker">Arbeitsphase</div>
        <h2>Aufgaben</h2>
        <div class="task-grid">${renderTasks(material.tasks)}</div>
      </section>

      <section class="material-section">
        <div class="section-kicker">Wahlhilfe</div>
        <h2>Stern · Planet · Rakete</h2>
        <div class="levels">
          <article class="level-star">
            <span class="level-icon">★</span>
            <h3>Stern</h3>
            <p>${escapeHtml(material.differentiation.star)}</p>
          </article>
          <article class="level-planet">
            <span class="level-icon">●</span>
            <h3>Planet</h3>
            <p>${escapeHtml(material.differentiation.planet)}</p>
          </article>
          <article class="level-rocket">
            <span class="level-icon">▲</span>
            <h3>Rakete</h3>
            <p>${escapeHtml(material.differentiation.rocket)}</p>
          </article>
        </div>
      </section>

      <section class="material-section reflection-section">
        <div>
          <div class="section-kicker">Sicherung</div>
          <h2>Zum Schluss</h2>
          <p>${escapeHtml(material.reflection)}</p>
        </div>
        <div class="compact">
          <h2>Check</h2>
          ${renderList(material.qualityCheck, "check-list")}
        </div>
      </section>

      <footer class="worksheet-footer">
        <span>${escapeHtml(material.metadata.subject)} · ${escapeHtml(material.metadata.className)}</span>
        <span>Name: ____________________</span>
      </footer>
    </article>
  `;
}

function buildTeacherNote(material, data) {
  return `# Lehrkraft-Notiz

## Material
- Fach: ${fallback(data.fach, material.metadata.subject)}
- Klasse: ${fallback(data.klasse, material.metadata.className)}
- Thema: ${material.title}
- Materialtyp: ${material.metadata.type}
- Muster: ${material.metadata.pattern}

## Ziel
${material.goal}

## Ablauf
${material.teacherNote.flow.map((item, index) => `${index + 1}. ${item}`).join("\n")}

## Stolperstellen
${material.teacherNote.pitfalls.map((item) => `- ${item}`).join("\n")}

## Anpassung
${material.teacherNote.adaptation}

## Qualitätsregeln
- Kurzer Start in Schülersprache.
- Beispiel vor Eigenarbeit.
- Aufgaben ohne lange Frontalphase.
- Differenzierung: Stern / Planet / Rakete.
- Freundlich-visuelles, professionelles Design ohne Namenssignatur.
`;
}

function buildFullHtmlDocument(material) {
  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(material.title)}</title>
    <link rel="stylesheet" href="./styles.css" />
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
  previewTitle.textContent = source === "ai" ? "KI-generiertes Material" : "Regelbasierter Entwurf";
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
  generatorMessage.textContent = "Die Inhalte werden fachlich ausgearbeitet und anschließend ins feste Design gesetzt.";

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Material konnte nicht generiert werden.");
    }

    const source = payload.source === "ai" ? "ai" : "fallback";
    const material = validateMaterial(payload.material, data);
    saveMaterial(material, source);
    renderCurrent(material, source);
    generatorMessage.textContent =
      source === "ai"
        ? "Fertig. Das Material wurde mit KI erzeugt und im einheitlichen Design gerendert."
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

printButton.addEventListener("click", () => {
  window.print();
});

downloadHtmlButton.addEventListener("click", () => {
  const material = currentMaterial || validateMaterial(buildFallbackMaterial(getFormData()), getFormData());
  const name = slugify(`${material.metadata.subject}_${material.metadata.className}_${material.title}`);
  downloadFile(`${name}.html`, buildFullHtmlDocument(material), "text/html;charset=utf-8");
});

downloadNoteButton.addEventListener("click", () => {
  const data = getFormData();
  const material = currentMaterial || validateMaterial(buildFallbackMaterial(data), data);
  const name = slugify(`${material.metadata.subject}_${material.metadata.className}_${material.title}`);
  downloadFile(`${name}_lehrkraft_notiz.md`, buildTeacherNote(material, data), "text/markdown;charset=utf-8");
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
