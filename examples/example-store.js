import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = __dirname;
const MIN_SCORE = 85;

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
}

function filenameFor(version, data, score) {
  const fach = slugify(data?.meta?.subject || "fach");
  const klasse = slugify(data?.meta?.className || "klasse");
  const mode = slugify(data?.meta?.templateMode || data?.learningDesign ? "v3" : "knowledge");
  return `${version}_${fach}_${klasse}_${mode}_${score}.json`;
}

export function saveExample(version, data, score) {
  if (score < MIN_SCORE) return;
  try {
    const filename = filenameFor(version, data, score);
    const filepath = path.join(EXAMPLES_DIR, filename);
    // Don't overwrite if a higher-scored version already exists
    if (fs.existsSync(filepath)) return;
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf8");
    console.log(`[examples] Gespeichert: ${filename}`);
  } catch (error) {
    console.error(`[examples] Speichern fehlgeschlagen: ${error.message}`);
  }
}

export function findRelevantExamples(input, version, max = 2) {
  try {
    const fach = slugify(input?.fach || input?.meta?.subject || "");
    const mode = slugify(input?.templateMode || input?.meta?.templateMode || "");

    const files = fs.readdirSync(EXAMPLES_DIR).filter(
      (f) => f.endsWith(".json") && f.startsWith(`${version}_`)
    );

    const scored = files.map((filename) => {
      const parts = filename.replace(".json", "").split("_");
      // filename: v2_physik_klasse6_knowledge_92 → parts: [v2, physik, klasse6, knowledge, 92]
      const scoreStr = parts[parts.length - 1];
      const fileFach = parts[1] || "";
      const fileMode = parts[parts.length - 2] || "";
      const score = Number(scoreStr) || 0;

      let relevance = score;
      if (fach && fileFach && fach.startsWith(fileFach.slice(0, 4))) relevance += 30;
      if (mode && fileMode === mode) relevance += 20;

      return { filename, relevance, score };
    });

    scored.sort((a, b) => b.relevance - a.relevance);

    const results = [];
    for (const { filename, score } of scored.slice(0, max)) {
      try {
        const content = fs.readFileSync(path.join(EXAMPLES_DIR, filename), "utf8");
        results.push({ filename, score, data: JSON.parse(content) });
      } catch {
        // skip unreadable files
      }
    }

    if (results.length) {
      console.log(`[examples] ${results.length} Beispiele geladen für ${version} ${fach} ${mode}`);
    }
    return results;
  } catch {
    return [];
  }
}

export function buildExamplePromptSection(examples) {
  if (!examples.length) return "";
  const blocks = examples.map(({ filename, score, data }) => {
    const label = filename.replace(".json", "").replace(/_/g, " ");
    return `[VORBILD: ${label}, Score ${score}]\n${JSON.stringify(data, null, 2)}`;
  });
  return `Hier sind bewährte Materialien als Vorbilder (alle geprüft, Score ≥ ${MIN_SCORE}):\n\n${blocks.join("\n\n")}\n\nOrientiere dich am Aufbau und Niveau der Vorbilder, aber erzeuge eigenen fachlichen Inhalt für den neuen Auftrag.\n\n`;
}
