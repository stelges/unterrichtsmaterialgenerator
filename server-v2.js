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

function buildV2Instructions() {
  return `Du bist ein erfahrener deutscher Sek-I-Lehrer, Fachleiter und Materialdesigner.
Du erzeugst KEIN fertiges Arbeitsblatt als Fließtext, sondern ein MaterialPackage-v2 als JSON.

Ziel: Unterrichtsmaterial, das Schülerinnen und Schüler fast vollständig ohne mündliche Lehrkraft-Einleitung bearbeiten können.

WICHTIGE REGELN:
- Schreibe ausschließlich auf Deutsch.
- Keine fremdsprachigen Zeichen, keine arabischen, kyrillischen oder englischen Satzreste.
- Keine Generator-, Design- oder Qualitätskriterien im Schüler-Check.
- Jede Aufgabe braucht ein sichtbares Schülerprodukt: Antwortzeilen, Tabelle, Ankreuzfeld, Korrekturfeld, Beobachtungstabelle oder Satzstarter.
- Jede Aufgabe braucht einen klaren Operator: markiere, erkläre, ordne zu, begründe, vergleiche, bewerte, notiere, skizziere.
- Inhalt vor Optik: Der Wissenskasten muss fachlich tragfähig sein.
- Immer ein ausgefülltes Beispiel vor eigenständiger Anwendung.
- Bei Erkundungsheften: Recherche/Beobachtung muss explizit vorkommen, immer mit Quelle/Fundort/Beleg und Kriterien.
- Bei Experimentheften: Vermutung, Material, Durchführung, Beobachtung und Auswertung klar trennen.
- Bei Wissensheften: Wissenskasten, Fachbegriffe, Beispiel, Anwendung und Merksatz.
- Klasse 5/6: kurze Sätze, klare Schritte, konkrete Alltagssituationen, Satzstarter.

Gib ausschließlich valides JSON zurück. Kein Markdown. Kein Kommentar.`;
}

function buildV2Prompt(input, fallbackPackage) {
  return `Erzeuge ein MaterialPackage-v2 für folgenden Materialbrief:
${JSON.stringify(input, null, 2)}

Orientiere dich an dieser Zielstruktur und fülle sie fachlich besser aus:
${JSON.stringify(fallbackPackage, null, 2)}

Pflichtstruktur:
- schemaVersion: "2.0.0"
- meta mit title, subject, className, duration, templateMode, pageCount, level, createdAt
- didacticPlan mit learningGoal, guidingQuestion, coreConcept, learningPath, prerequisites, misconceptions, successCriteria
- knowledgeCore mit shortText, terms, workedExample, everydayConnections
- pages: exakt pageCount Seiten
- Jede Seite hat pageNumber, purpose, title, blocks
- Blocks dürfen nur diese Typen nutzen:
  goal_box, student_workflow, problem_impulse, knowledge_box, worked_example, term_table,
  prediction_task, true_false_correction, matching_table_task, short_answer_task,
  research_task, experiment_protocol, observation_table, merksatz_task, reflection_task,
  self_check, scobees_submission

Block-Formate:
- goal_box: {id,type,text}
- student_workflow: {id,type,steps:[string]}
- problem_impulse: {id,type,question,prompt}
- knowledge_box: {id,type,title,text}
- worked_example: {id,type,situation,observation,explanation}
- term_table: {id,type,terms:[{term,explanation,example}]}
- prediction_task: {id,type,title,prompt,options:[string],sentenceStarter}
- true_false_correction: {id,type,title,items:[{statement,expected,correctionStarter}]}
- matching_table_task: {id,type,title,columns:[string],rows:[string]}
- short_answer_task: {id,type,title,prompt,answerLines,sentenceStarter}
- research_task: {id,type,title,prompt,criteria:[string],rows:number}
- experiment_protocol: {id,type,title,question,fields:[string]}
- observation_table: {id,type,title,columns:[string],rows:number}
- merksatz_task: {id,type,title,prompt,sentenceStarter}
- reflection_task: {id,type,title,prompts:[string]}
- self_check: {id,type,items:[string]}
- scobees_submission: {id,type,text}

Achte darauf, dass der Inhalt didaktisch wirksam ist und nicht oberflächlich bleibt.`;
}

function safePackage(input) {
  const pkg = buildMaterialPackageV2(input);
  const quality = checkMaterialQuality(pkg);
  return { package: pkg, quality };
}

async function handleV2Generate(req, res) {
  const input = await readJsonBody(req);
  const fallback = buildMaterialPackageV2(input);

  if (!process.env.OPENAI_API_KEY) {
    const quality = checkMaterialQuality(fallback);
    return sendJson(res, 200, {
      source: "fallback",
      message: "Kein OPENAI_API_KEY gesetzt. Regelbasierter v2-Entwurf wurde erzeugt.",
      package: fallback,
      quality,
    });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        instructions: buildV2Instructions(),
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: buildV2Prompt(input, fallback) }],
          },
        ],
      }),
    });

    const responseJson = await response.json();
    if (!response.ok) throw new Error(responseJson.error?.message || "OpenAI-Anfrage fehlgeschlagen.");

    const outputText = extractOutputText(responseJson);
    const generatedPackage = extractJson(outputText);
    const quality = checkMaterialQuality(generatedPackage);

    sendJson(res, 200, {
      source: "ai",
      package: generatedPackage,
      quality,
      repairInstructions: quality.repairInstructions,
    });
  } catch (error) {
    const fallbackResult = safePackage(input);
    sendJson(res, 200, {
      source: "fallback",
      message: `KI nicht nutzbar: ${error.message}`,
      package: fallbackResult.package,
      quality: fallbackResult.quality,
    });
  }
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${port}`);
  const requestedPath = decodeURIComponent(url.pathname === "/" ? "/v2.html" : url.pathname);
  const filePath = path.normalize(path.join(__dirname, requestedPath));

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/v2/generate") {
    handleV2Generate(req, res).catch((error) => sendJson(res, 500, { error: error.message }));
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(port, () => {
  console.log(`Material-Compiler v2 läuft auf http://localhost:${port}`);
});
