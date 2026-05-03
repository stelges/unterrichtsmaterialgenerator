import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMaterialPackageV2 } from "./v2/package-builder-v2.js";
import { checkMaterialQuality } from "./v2/quality-check-v2.js";
import { buildLearningDesignV3 } from "./v3/builder-v3.js";
import { checkCoherenceV3 } from "./v3/coherence-check-v3.js";
import { exportToPdf } from "./export-pdf.js";

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

// ── PDF export handler ────────────────────────────────────────────────────────

async function handleExportPdf(req, res) {
  const { version = "v2", data, title } = await readJsonBody(req);
  if (!data) { sendJson(res, 400, { error: "data fehlt." }); return; }
  try {
    const pdf = await exportToPdf(version, data);
    const slug = String(title || data?.meta?.title || "material")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80);
    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slug}.pdf"`,
      "Content-Length": pdf.length,
    });
    res.end(pdf);
  } catch (error) {
    sendJson(res, 500, { error: `PDF-Export fehlgeschlagen: ${error.message}` });
  }
}

// ── v3 handlers ───────────────────────────────────────────────────────────────

function buildV3BriefInstructions() {
  return `Du bist ein erfahrener deutscher Sek-I-Fachleiter. Du erstellst noch KEIN Material. Du analysierst den Materialbrief und planst das Lerndesign: Stundenfrage, roter Faden, Zielantwort, Lernschritte, Kernbegriffe, Fehlvorstellungen, Materialplan und Aufgabenplan. Antworte ausschließlich als valides JSON. Keine Markdown-Ausgabe.`;
}

function buildV3BriefPrompt(input) {
  return `Analysiere diesen Materialbrief und erstelle einen Lerndesign-Plan als JSON:
${JSON.stringify(input, null, 2)}

Pflichtformat:
{
  "studentQuestion": "string – die Frage, die SuS am Ende beantworten können",
  "lessonStory": "string – roter Faden der Stunde in einem Satz",
  "targetAnswer": "string – wie eine gute Schülerantwort klingt",
  "learningSteps": ["string"],
  "keyConcepts": ["string"],
  "misconceptions": ["string"],
  "successCriteria": ["string"],
  "materialPlan": ["string – z.B. M1: Alltagsproblem (mini_text)"],
  "taskPlan": ["string – z.B. A1: Vermutung (predict)"],
  "confirmedBrief": { ...original input, "didacticPlanConfirmed": true }
}`;
}

function buildV3MaterialInstructions() {
  return `Du bist ein erfahrener deutscher Sek-I-Fachlehrer. Du erstellst das materialInventory für ein Lerndesign. Jedes Material bekommt eine eindeutige ID (M1, M2, M3 ...). Material-Typen: mini_text, knowledge_box, worked_example, term_bank, data_table, experiment_instruction, research_source, visual_placeholder. Antworte ausschließlich als valides JSON. Keine fremdsprachigen Zeichen.`;
}

function buildV3MaterialPrompt(input, design) {
  return `Erstelle das materialInventory für dieses Lerndesign.

Lerndesign:
${JSON.stringify(design.learningDesign, null, 2)}

Materialbrief:
${JSON.stringify(input, null, 2)}

Pflichtformat:
{
  "materialInventory": [
    {
      "id": "M1",
      "type": "mini_text|knowledge_box|worked_example|term_bank|data_table|experiment_instruction|research_source|visual_placeholder",
      "title": "string",
      "content": "string – fachlich präziser Inhalt auf Deutsch",
      "terms": [{ "term": "string", "explanation": "string", "example": "string" }],
      "rows": ["string"],
      "columns": ["string"],
      "sourceNote": "string"
    }
  ]
}

Regeln:
- Mindestens ein knowledge_box mit Fachbegriffen und terms-Array.
- Mindestens ein worked_example. Inhalt als: "Situation: ... Beobachtung: ... Erklärung: ...".
- Kein freier Fließtext in Aufgabenfeldern.
- Nur Deutsch, keine fremdsprachigen Zeichen.`;
}

function buildV3TaskInstructions() {
  return `Du bist ein Aufgaben-Designer für deutsches Sek-I-Unterrichtsmaterial. Du erstellst taskSequence und pageComposition. Jede Aufgabe verweist explizit auf vorhandene Material-IDs. Aufgaben-Typen: predict, explain, match, true_false_correct, short_answer, table_complete, research, experiment_protocol, draw_or_sketch, merksatz, reflect. Antworte ausschließlich als valides JSON. Keine fremdsprachigen Zeichen.`;
}

function buildV3TaskPrompt(input, design) {
  return `Erstelle taskSequence und pageComposition für dieses Lerndesign.

Vorhandene Materialien:
${design.materialInventory.map((m) => `${m.id}: [${m.type}] ${m.title}`).join("\n")}

Lerndesign:
${JSON.stringify(design.learningDesign, null, 2)}

Materialbrief:
${JSON.stringify(input, null, 2)}

Pflichtformat:
{
  "taskSequence": [
    {
      "id": "A1",
      "type": "predict|explain|match|true_false_correct|short_answer|table_complete|research|experiment_protocol|draw_or_sketch|merksatz|reflect",
      "title": "string",
      "prompt": "string – klarer Schülerauftrag",
      "uses": ["M1"],
      "requiresConcepts": ["string"],
      "answerFormat": "one_sentence|short_lines|merksatz|check_and_correct|table",
      "scaffold": "string – Satzstarter oder Hilfe",
      "expectedStudentProduct": "string",
      "options": [],
      "items": [{ "statement": "string", "expected": true, "correctionStarter": "Richtig ist: …" }],
      "rows": ["string"],
      "columns": ["string"]
    }
  ],
  "pageComposition": [
    { "pageNumber": 1, "purpose": "hook|knowledge|practice|secure|extend", "title": "string", "materialIds": ["M1"], "taskIds": ["A1"] }
  ]
}

Regeln:
- Jede Aufgabe in uses nur auf vorhandene Material-IDs (${design.materialInventory.map((m) => m.id).join(", ")}) verweisen.
- Mindestens 4 Aufgaben, 4 Seiten.
- Letzte Seite: purpose "secure" mit merksatz und/oder reflect.
- Jede Aufgabe braucht expectedStudentProduct.`;
}

function buildV3RepairInstructions() {
  return `Du bist der Repair-Agent für ein deutsches Sek-I-Lerndesign v3. Du erhältst ein LearningDesign-v3 und einen Kohärenzbericht. Repariere das JSON. Antworte ausschließlich mit dem vollständigen reparierten LearningDesign als valides JSON.

Reparaturregeln:
- Alle high severity issues beheben.
- Aufgaben dürfen nur auf Material-IDs verweisen, die in materialInventory existieren.
- Jede Aufgabe braucht expectedStudentProduct.
- Keine fremdsprachigen Zeichen.
- pageComposition muss alle Tasks und Materialien referenzieren.`;
}

function buildV3RepairPrompt(design, coherence) {
  return `Repariere dieses LearningDesign v3.

Kohärenzbericht:
${JSON.stringify(coherence, null, 2)}

LearningDesign:
${JSON.stringify(design, null, 2)}

Gib ausschließlich das vollständige reparierte LearningDesign als JSON zurück.`;
}

async function handleV3Brief(req, res) {
  const input = await readJsonBody(req);

  if (!process.env.OPENAI_API_KEY) {
    const fallback = buildLearningDesignV3(input);
    const brief = {
      studentQuestion: fallback.learningDesign.studentQuestion,
      lessonStory: fallback.learningDesign.lessonStory,
      targetAnswer: fallback.learningDesign.targetAnswer,
      learningSteps: fallback.learningDesign.learningSteps,
      keyConcepts: fallback.learningDesign.keyConcepts,
      misconceptions: fallback.learningDesign.misconceptions,
      successCriteria: fallback.learningDesign.successCriteria,
      materialPlan: fallback.materialInventory.map((m) => `${m.id}: ${m.title} (${m.type})`),
      taskPlan: fallback.taskSequence.map((t) => `${t.id}: ${t.title} (${t.type})`),
      confirmedBrief: { ...input, didacticPlanConfirmed: true },
    };
    return sendJson(res, 200, { source: "fallback", brief });
  }

  try {
    const brief = await callJsonModel({ instructions: buildV3BriefInstructions(), prompt: buildV3BriefPrompt(input) });
    sendJson(res, 200, { source: "ai", brief });
  } catch (error) {
    const fallback = buildLearningDesignV3(input);
    const brief = {
      studentQuestion: fallback.learningDesign.studentQuestion,
      lessonStory: fallback.learningDesign.lessonStory,
      targetAnswer: fallback.learningDesign.targetAnswer,
      learningSteps: fallback.learningDesign.learningSteps,
      keyConcepts: fallback.learningDesign.keyConcepts,
      misconceptions: fallback.learningDesign.misconceptions,
      successCriteria: fallback.learningDesign.successCriteria,
      materialPlan: fallback.materialInventory.map((m) => `${m.id}: ${m.title} (${m.type})`),
      taskPlan: fallback.taskSequence.map((t) => `${t.id}: ${t.title} (${t.type})`),
      confirmedBrief: { ...input, didacticPlanConfirmed: true },
    };
    sendJson(res, 200, { source: "fallback", message: `Briefing-KI nicht nutzbar: ${error.message}`, brief });
  }
}

async function handleV3Generate(req, res) {
  const input = await readJsonBody(req);
  const generationInput = input.confirmedBrief || input;

  // Always start with the rule-based fallback as scaffold
  let design = buildLearningDesignV3(generationInput);

  if (!process.env.OPENAI_API_KEY) {
    const coherence = checkCoherenceV3(design);
    return sendJson(res, 200, { source: "fallback", message: "Kein OPENAI_API_KEY. Regelbasierter v3-Entwurf.", design, coherence, repaired: false });
  }

  let source = "ai";
  try {
    // Step 1: Material-Agent generates materialInventory
    const materialResult = await callJsonModel({
      instructions: buildV3MaterialInstructions(),
      prompt: buildV3MaterialPrompt(generationInput, design),
    });
    if (Array.isArray(materialResult.materialInventory)) {
      design.materialInventory = materialResult.materialInventory;
    }

    // Step 2: Aufgaben-Agent generates taskSequence + pageComposition
    const taskResult = await callJsonModel({
      instructions: buildV3TaskInstructions(),
      prompt: buildV3TaskPrompt(generationInput, design),
    });
    if (Array.isArray(taskResult.taskSequence)) design.taskSequence = taskResult.taskSequence;
    if (Array.isArray(taskResult.pageComposition)) design.pageComposition = taskResult.pageComposition;
  } catch (error) {
    source = "fallback";
    design = buildLearningDesignV3(generationInput);
  }

  // Step 3: Coherence check
  let coherence = checkCoherenceV3(design);
  design.coherenceReport = coherence;

  // Step 4: Repair if needed
  let repaired = false;
  if (source === "ai" && (!coherence.ok || coherence.score < 85)) {
    try {
      const repairedDesign = await callJsonModel({
        instructions: buildV3RepairInstructions(),
        prompt: buildV3RepairPrompt(design, coherence),
      });
      const repairedCoherence = checkCoherenceV3(repairedDesign);
      if (repairedCoherence.score >= coherence.score) {
        design = repairedDesign;
        coherence = repairedCoherence;
        design.coherenceReport = coherence;
        repaired = true;
      }
    } catch (_) {
      // keep original
    }
  }

  sendJson(res, 200, { source, design, coherence, repaired });
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
  if (req.method === "POST" && req.url === "/api/v3/brief") { handleV3Brief(req, res).catch((error) => sendJson(res, 500, { error: error.message })); return; }
  if (req.method === "POST" && req.url === "/api/v3/generate") { handleV3Generate(req, res).catch((error) => sendJson(res, 500, { error: error.message })); return; }
  if (req.method === "POST" && req.url === "/api/export/pdf") { handleExportPdf(req, res).catch((error) => sendJson(res, 500, { error: error.message })); return; }
  if (req.method === "GET" || req.method === "HEAD") { serveStatic(req, res); return; }
  res.writeHead(405); res.end("Method not allowed");
});

server.listen(port, () => {
  console.log(`Material-Compiler v2 läuft auf http://localhost:${port}`);
});
