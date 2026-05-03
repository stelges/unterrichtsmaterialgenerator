import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMaterialPackageV2 } from "./v2/package-builder-v2.js";
import { checkMaterialQuality } from "./v2/quality-check-v2.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv(path.join(__dirname, ".env"));

const port = Number(process.env.PORT || 5173);
const model = process.env.OPENAI_MODEL || "gpt-5.2";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    const value = rest.join("=").replace(/^[']|[']$/g, "").replace(/^[\"]|[\"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  return JSON.parse(raw);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function extractOutputText(responseJson) {
  if (typeof responseJson.output_text === "string") return responseJson.output_text;
  const parts = [];
  for (const item of responseJson.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n");
}

function extractJson(text) {
  const trimmed = String(text || "").trim();
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return JSON.parse(trimmed.slice(first, last + 1));
  throw new Error("KI-Antwort enthielt kein JSON-Objekt.");
}

async function callJsonModel({ instructions, prompt }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model, instructions, input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }] }),
  });
  const responseJson = await response.json();
  if (!response.ok) throw new Error(responseJson.error?.message || "OpenAI-Anfrage fehlgeschlagen.");
  return extractJson(extractOutputText(responseJson));
}

function buildFallbackBrief(input = {}) {
  const mode = input.templateMode || "knowledge";
  const topic = input.thema || "Neues Thema";
  const isExperiment = mode === "experiment";
  const isExploration = mode === "exploration";
  return {
    source: "fallback",
    recommendedTemplateMode: mode,
    recommendationTitle: isExperiment ? "Experiment-Forscherheft" : isExploration ? "Erkundungs-Forscherheft" : "Wissens-Forscherheft",
    reasoning: isExperiment ? "Das Thema eignet sich für Vermutung, Durchführung, Beobachtung und Auswertung." : isExploration ? "Das Thema eignet sich für Recherche, Fundorte, Kriterienvergleich und Bewertung." : "Das Thema braucht zuerst Wissensaufbau, dann Anwendung an Beispielen und Sicherung.",
    learningPath: isExperiment ? ["Forscherfrage verstehen", "Vermutung formulieren", "Untersuchung durchführen", "Beobachtung notieren", "Auswertung schreiben", "Merksatz sichern"] : isExploration ? ["Erkundungsfrage verstehen", "Suchfrage formulieren", "Quelle/Fundort sichern", "Ergebnisse vergleichen", "Bewertung begründen", "Abgabe prüfen"] : ["Problemfrage verstehen", "Wissenskasten lesen", "Beispiel nachvollziehen", "Aufgaben bearbeiten", "Merksatz formulieren", "Selbstcheck"],
    coreConcept: input.stundenziel || `Die Schülerinnen und Schüler erarbeiten ${topic} selbstständig und begründen ihre Ergebnisse fachlich.`,
    taskPlan: isExploration ? ["Rechercheauftrag mit Quelle/Fundort", "Kriterien-Tabelle", "Vergleichsaufgabe", "begründete Bewertung"] : isExperiment ? ["Vermutung", "Versuchsprotokoll", "Beobachtungstabelle", "Auswertung mit Fachbegriffen"] : ["Vorhersage", "Begriffstabelle", "Richtig/Falsch mit Korrektur", "Zuordnung mit Begründung", "Merksatz"],
    misconceptions: ["Behauptung ohne Begründung", "Fachbegriffe werden nur abgeschrieben", "Beispiel und Erklärung werden verwechselt"],
    missingInfo: [],
    suggestedChanges: ["Ein ausgefülltes Beispiel vor die Aufgaben setzen", "sichtbare Antwortfelder direkt unter Aufgaben einplanen", "Schüler-Check auf das Stundenziel ausrichten"],
    confirmedBrief: { ...input, templateMode: mode, didacticPlanConfirmed: true },
  };
}

function buildBriefInstructions() {
  return `Du bist ein erfahrener deutscher Sek-I-Fachleiter und Didaktik-Coach. Du erstellst noch KEIN Arbeitsblatt. Du prüfst nur den Materialbrief und schlägst einen didaktischen Bauplan vor. Antworte ausschließlich als valides JSON. Keine Markdown-Ausgabe. Keine Kommentare.`;
}

function buildBriefPrompt(input) {
  return `Analysiere diesen Materialbrief und erstelle einen didaktischen Bauplan als JSON:
${JSON.stringify(input, null, 2)}

Pflichtformat:
{
  "recommendedTemplateMode": "knowledge|experiment|exploration|worksheet",
  "recommendationTitle": "string",
  "reasoning": "string",
  "learningPath": ["string"],
  "coreConcept": "string",
  "taskPlan": ["string"],
  "misconceptions": ["string"],
  "missingInfo": ["string"],
  "suggestedChanges": ["string"],
  "confirmedBrief": { ... }
}`;
}

async function handleV2Brief(req, res) {
  const input = await readJsonBody(req);
  if (!process.env.OPENAI_API_KEY) return sendJson(res, 200, { source: "fallback", brief: buildFallbackBrief(input) });
  try {
    const brief = await callJsonModel({ instructions: buildBriefInstructions(), prompt: buildBriefPrompt(input) });
    sendJson(res, 200, { source: "ai", brief });
  } catch (error) {
    sendJson(res, 200, { source: "fallback", message: `Briefing-KI nicht nutzbar: ${error.message}`, brief: buildFallbackBrief(input) });
  }
}

function buildV2Instructions() {
  return `Du bist ein erfahrener deutscher Sek-I-Lehrer, Fachleiter und Materialdesigner. Du erzeugst KEIN fertiges Arbeitsblatt als Fließtext, sondern ein MaterialPackage-v2 als JSON. Schreibe ausschließlich Deutsch. Keine fremdsprachigen Zeichen. Keine Generator- oder Designkriterien im Schüler-Check. Jede Aufgabe braucht sichtbares Schülerprodukt und klare Operatoren. Immer Wissensvermittlung, ausgefülltes Beispiel, Anwendung und Sicherung. Gib ausschließlich valides JSON zurück.`;
}

function buildV2Prompt(input, fallbackPackage) {
  return `Erzeuge ein MaterialPackage-v2 für folgenden bestätigten Materialbrief:
${JSON.stringify(input, null, 2)}

Orientiere dich an dieser Zielstruktur und fülle sie fachlich besser aus:
${JSON.stringify(fallbackPackage, null, 2)}

Pflichtstruktur: schemaVersion, meta, didacticPlan, knowledgeCore, pages, teacherNotes, scobees. Pages exakt pageCount. Blocks nur bekannte v2-Blocktypen. Inhalt muss didaktisch wirksam sein.`;
}

function buildRepairInstructions() {
  return `Du bist der Repair-Agent für ein deutsches Sek-I-Unterrichtsmaterial. Du erhältst ein MaterialPackage-v2 und einen Qualitätsbericht. Repariere das JSON, ohne das Schema zu verlassen. Antworte ausschließlich mit dem vollständigen reparierten MaterialPackage als valides JSON.

Reparaturregeln:
- Alle high severity issues müssen behoben werden.
- Keine fremdsprachigen Zeichen.
- Keine Generator-/Template-Kriterien im Schüler-Check.
- Jede Aufgabe braucht sichtbares Schülerprodukt.
- Jede Aufgabe braucht einen klaren Schülerauftrag.
- Behalte pageCount exakt bei.
- Behalte die Blocktypen aus dem v2-Schema.
- Verbessere fachliche Substanz, aber mache keine langen Textwüsten.`;
}

function buildRepairPrompt(pkg, quality, input) {
  return `Repariere dieses MaterialPackage-v2.

Materialbrief:
${JSON.stringify(input, null, 2)}

Qualitätsbericht:
${JSON.stringify(quality, null, 2)}

MaterialPackage:
${JSON.stringify(pkg, null, 2)}

Gib ausschließlich das vollständige reparierte MaterialPackage als JSON zurück.`;
}

async function repairPackageIfNeeded(pkg, quality, input) {
  const needsRepair = quality.issues.some((issue) => issue.severity === "high") || quality.score < 85;
  if (!needsRepair || !process.env.OPENAI_API_KEY) return { package: pkg, quality, repaired: false };

  try {
    const repairedPackage = await callJsonModel({ instructions: buildRepairInstructions(), prompt: buildRepairPrompt(pkg, quality, input) });
    const repairedQuality = checkMaterialQuality(repairedPackage);
    if (repairedQuality.score >= quality.score) {
      return { package: repairedPackage, quality: repairedQuality, repaired: true };
    }
  } catch (error) {
    return { package: pkg, quality, repaired: false, repairError: error.message };
  }
  return { package: pkg, quality, repaired: false };
}

function safePackage(input) {
  const pkg = buildMaterialPackageV2(input);
  const quality = checkMaterialQuality(pkg);
  return { package: pkg, quality };
}

async function handleV2Generate(req, res) {
  const input = await readJsonBody(req);
  const generationInput = input.confirmedBrief || input;
  const fallback = buildMaterialPackageV2(generationInput);

  if (!process.env.OPENAI_API_KEY) {
    const quality = checkMaterialQuality(fallback);
    return sendJson(res, 200, { source: "fallback", message: "Kein OPENAI_API_KEY gesetzt. Regelbasierter v2-Entwurf wurde erzeugt.", package: fallback, quality, repaired: false });
  }

  try {
    const generatedPackage = await callJsonModel({ instructions: buildV2Instructions(), prompt: buildV2Prompt(generationInput, fallback) });
    const quality = checkMaterialQuality(generatedPackage);
    const repaired = await repairPackageIfNeeded(generatedPackage, quality, generationInput);
    sendJson(res, 200, { source: "ai", package: repaired.package, quality: repaired.quality, repaired: repaired.repaired, repairError: repaired.repairError || null, repairInstructions: repaired.quality.repairInstructions });
  } catch (error) {
    const fallbackResult = safePackage(generationInput);
    sendJson(res, 200, { source: "fallback", message: `KI nicht nutzbar: ${error.message}`, package: fallbackResult.package, quality: fallbackResult.quality, repaired: false });
  }
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${port}`);
  const requestedPath = decodeURIComponent(url.pathname === "/" ? "/v2.html" : url.pathname);
  const filePath = path.normalize(path.join(__dirname, requestedPath));
  if (!filePath.startsWith(__dirname)) { res.writeHead(403); res.end("Forbidden"); return; }
  fs.readFile(filePath, (error, content) => {
    if (error) { res.writeHead(404); res.end("Not found"); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/v2/brief") { handleV2Brief(req, res).catch((error) => sendJson(res, 500, { error: error.message })); return; }
  if (req.method === "POST" && req.url === "/api/v2/generate") { handleV2Generate(req, res).catch((error) => sendJson(res, 500, { error: error.message })); return; }
  if (req.method === "GET" || req.method === "HEAD") { serveStatic(req, res); return; }
  res.writeHead(405); res.end("Method not allowed");
});

server.listen(port, () => {
  console.log(`Material-Compiler v2 läuft auf http://localhost:${port}`);
});
