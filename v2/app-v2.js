import { buildMaterialPackageV2 } from "./package-builder-v2.js";
import { checkMaterialQuality } from "./quality-check-v2.js";
import { renderMaterialPackageV2 } from "./renderer-v2.js";

const form = document.querySelector("#v2Form");
const preview = document.querySelector("#v2Preview");
const qualityOutput = document.querySelector("#qualityOutput");
const statusPill = document.querySelector("#statusPill");
const generateButton = document.querySelector("#generateButton");
const printButton = document.querySelector("#printButton");
const downloadHtmlButton = document.querySelector("#downloadHtmlButton");
const downloadJsonButton = document.querySelector("#downloadJsonButton");
const downloadScobeesButton = document.querySelector("#downloadScobeesButton");
const downloadTeacherButton = document.querySelector("#downloadTeacherButton");
const resetButton = document.querySelector("#resetButton");

const draftKey = "materialCompiler.v2.input";
const packageKey = "materialCompiler.v2.package";
let currentPackage = null;
let currentQuality = null;

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

function generate() {
  const data = getFormData();
  localStorage.setItem(draftKey, JSON.stringify(data));

  currentPackage = buildMaterialPackageV2(data);
  currentQuality = checkMaterialQuality(currentPackage);

  localStorage.setItem(packageKey, JSON.stringify(currentPackage));
  preview.innerHTML = renderMaterialPackageV2(currentPackage);
  renderQuality(currentQuality);
  statusPill.textContent = currentQuality.ok ? "prüfbar" : "prüfen";
}

function renderQuality(quality) {
  const topIssues = quality.issues.slice(0, 6);
  qualityOutput.innerHTML = `
    <div class="quality-score ${quality.score >= 80 ? "good" : quality.score >= 60 ? "medium" : "bad"}">
      <strong>${quality.score}/100</strong>
      <span>${quality.ok ? "Keine kritischen Fehler" : "Noch verbessern"}</span>
    </div>
    ${topIssues.length ? `<ul>${topIssues.map((issue) => `<li><strong>${escapeHtml(issue.severity)}</strong>: ${escapeHtml(issue.message)}</li>`).join("")}</ul>` : "<p>Der Qualitätscheck findet keine größeren Probleme.</p>"}
  `;
}

function buildScobeesText(pkg) {
  return `Titel: ${pkg.meta.title}\n\nFach/Klasse: ${pkg.meta.subject} · ${pkg.meta.className}\n\nZiel:\n${pkg.didacticPlan.learningGoal}\n\nLeitfrage:\n${pkg.didacticPlan.guidingQuestion}\n\nArbeitsweg:\n${pkg.didacticPlan.learningPath.map((step, index) => `${index + 1}. ${step}`).join("\n")}\n\nAbgabe:\n${pkg.scobees.submission}\n`;
}

function buildTeacherNote(pkg, quality) {
  return `# Lehrkraft-Notiz: ${pkg.meta.title}\n\n## Eckdaten\n- Fach: ${pkg.meta.subject}\n- Klasse: ${pkg.meta.className}\n- Dauer: ${pkg.meta.duration}\n- Modus: ${pkg.meta.templateMode}\n- Seiten: ${pkg.meta.pageCount}\n\n## Ziel\n${pkg.didacticPlan.learningGoal}\n\n## Leitfrage\n${pkg.didacticPlan.guidingQuestion}\n\n## Kernkonzept\n${pkg.didacticPlan.coreConcept}\n\n## Lernweg\n${pkg.didacticPlan.learningPath.map((step, index) => `${index + 1}. ${step}`).join("\n")}\n\n## Typische Fehlvorstellungen\n${pkg.didacticPlan.misconceptions.map((item) => `- ${item}`).join("\n")}\n\n## Erfolgskriterien\n${pkg.didacticPlan.successCriteria.map((item) => `- ${item}`).join("\n")}\n\n## Qualitätscheck\nScore: ${quality.score}/100\n\n${quality.issues.length ? quality.issues.map((issue) => `- [${issue.severity}] ${issue.message}`).join("\n") : "Keine größeren Probleme gefunden."}\n`;
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
  return (value || "material")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function ensurePackage() {
  if (!currentPackage) generate();
  return currentPackage;
}

function reset() {
  localStorage.removeItem(draftKey);
  localStorage.removeItem(packageKey);
  form.reset();
  generate();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

generateButton.addEventListener("click", generate);
printButton.addEventListener("click", () => window.print());
resetButton.addEventListener("click", reset);

downloadHtmlButton.addEventListener("click", () => {
  const pkg = ensurePackage();
  downloadFile(`${slugify(pkg.meta.subject + "_" + pkg.meta.className + "_" + pkg.meta.title)}.html`, buildFullHtml(pkg), "text/html;charset=utf-8");
});

downloadJsonButton.addEventListener("click", () => {
  const pkg = ensurePackage();
  downloadFile(`${slugify(pkg.meta.title)}.material-package.json`, JSON.stringify(pkg, null, 2), "application/json;charset=utf-8");
});

downloadScobeesButton.addEventListener("click", () => {
  const pkg = ensurePackage();
  downloadFile(`${slugify(pkg.meta.title)}.scobees.txt`, buildScobeesText(pkg), "text/plain;charset=utf-8");
});

downloadTeacherButton.addEventListener("click", () => {
  const pkg = ensurePackage();
  const quality = currentQuality || checkMaterialQuality(pkg);
  downloadFile(`${slugify(pkg.meta.title)}.lehrkraft.md`, buildTeacherNote(pkg, quality), "text/markdown;charset=utf-8");
});

form.addEventListener("input", () => {
  localStorage.setItem(draftKey, JSON.stringify(getFormData()));
});

const restoredDraft = localStorage.getItem(draftKey);
if (restoredDraft) setFormData(JSON.parse(restoredDraft));

generate();
