import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
};

const materialSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "subtitle",
    "metadata",
    "goal",
    "intro",
    "example",
    "tasks",
    "differentiation",
    "reflection",
    "qualityCheck",
    "teacherNote",
  ],
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    metadata: {
      type: "object",
      additionalProperties: false,
      required: ["subject", "className", "type", "level", "pattern"],
      properties: {
        subject: { type: "string" },
        className: { type: "string" },
        type: { type: "string" },
        level: { type: "string" },
        pattern: { type: "string" },
      },
    },
    goal: { type: "string" },
    intro: { type: "string" },
    example: {
      type: "object",
      additionalProperties: false,
      required: ["title", "body", "sample"],
      properties: {
        title: { type: "string" },
        body: { type: "string" },
        sample: { type: "string" },
      },
    },
    tasks: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "title", "instruction", "support"],
        properties: {
          label: { type: "string" },
          title: { type: "string" },
          instruction: { type: "string" },
          support: { type: "string" },
        },
      },
    },
    differentiation: {
      type: "object",
      additionalProperties: false,
      required: ["star", "planet", "rocket"],
      properties: {
        star: { type: "string" },
        planet: { type: "string" },
        rocket: { type: "string" },
      },
    },
    reflection: { type: "string" },
    qualityCheck: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: { type: "string" },
    },
    teacherNote: {
      type: "object",
      additionalProperties: false,
      required: ["flow", "pitfalls", "adaptation"],
      properties: {
        flow: {
          type: "array",
          minItems: 3,
          maxItems: 6,
          items: { type: "string" },
        },
        pitfalls: {
          type: "array",
          minItems: 2,
          maxItems: 6,
          items: { type: "string" },
        },
        adaptation: { type: "string" },
      },
    },
  },
};

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    const value = rest.join("=").replace(/^[']|[']$/g, "").replace(/^["]|["]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function compactInput(input = {}) {
  return {
    fach: input.fach || "",
    klasse: input.klasse || "",
    thema: input.thema || "",
    stundenziel: input.stundenziel || "",
    vorwissen: input.vorwissen || "",
    materialtyp: input.materialtyp || "",
    muster: input.muster || "",
    schwierigkeit: input.schwierigkeit || "",
    textmenge: input.textmenge || "",
    gestaltung: input.gestaltung || "",
    schwerpunkte: Array.isArray(input.schwerpunkte) ? input.schwerpunkte : [],
    inhalte: input.inhalte || "",
    hinweise: input.hinweise || "",
  };
}

function makeFallbackMaterial(input) {
  const data = compactInput(input);
  const topic = data.thema || "Neues Thema";
  const subject = data.fach || "Fach";
  const className = data.klasse || "Klasse";
  const goal = data.stundenziel || `Ich kann ${topic} mit eigenen Worten erklären und eine passende Aufgabe lösen.`;
  const terms = (data.inhalte || "")
    .split(/\n|;|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
  const visibleTerms = terms.length ? terms.join(", ") : `${topic}, Beispiel, Regel`;

  return {
    title: topic,
    subtitle: `${subject} · ${className}`,
    metadata: {
      subject,
      className,
      type: data.materialtyp || "Arbeitsmaterial",
      level: data.schwierigkeit || "eher leicht",
      pattern: data.muster || "Input + Lese-Check",
    },
    goal,
    intro: `Heute arbeitest du zu ${topic}. Starte mit dem Beispiel und bearbeite die Aufgaben der Reihe nach.`,
    example: {
      title: "So kann eine gute Antwort aussehen",
      body: `Eine gute Antwort nennt einen wichtigen Begriff zu ${topic}, erklärt ihn kurz und nutzt ein Beispiel.`,
      sample: `Ich erkenne ${topic}, weil ich ein Merkmal finde und meine Entscheidung begründe.`,
    },
    tasks: [
      {
        label: "Start",
        title: "Begriffe sichern",
        instruction: `Markiere oder notiere wichtige Wörter: ${visibleTerms}.`,
        support: "Nutze kurze Stichworte.",
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
        instruction: `Bearbeite eine eigene Aufgabe zu ${topic} und erkläre dein Vorgehen.`,
        support: "Schreibe kurz, klar und in eigenen Worten.",
      },
      {
        label: "Sichern",
        title: "Mini-Erklärung",
        instruction: `Beende den Satz: Bei ${topic} ist wichtig, dass ...`,
        support: "Nutze deine markierten Begriffe.",
      },
    ],
    differentiation: {
      star: "Nutze das Beispiel. Bearbeite zuerst Aufgabe 1 und 2.",
      planet: "Bearbeite alle Aufgaben und begründe mindestens eine Antwort.",
      rocket: "Ergänze ein eigenes Beispiel oder eine schwierigere Zusatzfrage.",
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
        "Stern/Planet/Rakete als Wahlhilfe nutzen.",
        "Am Ende eine kurze Sicherung einsammeln.",
      ],
      pitfalls: [
        data.vorwissen || "Vorwissen prüfen und zentrale Begriffe kurz sichern.",
        data.hinweise || "Bei Unsicherheit Startauftrag gemeinsam vormachen.",
      ],
      adaptation: "Bei Überforderung weniger Text nutzen, Aufgabe 3 kürzen und Stern-Hilfe stärker sichtbar machen.",
    },
  };
}

function extractOutputText(responseJson) {
  if (typeof responseJson.output_text === "string") return responseJson.output_text;
  const parts = [];
  for (const item of responseJson.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("\n");
}

function buildInstructions() {
  return `Du bist ein erfahrener deutscher Lehrer und Materialdesigner.
Erzeuge ein direkt nutzbares Unterrichtsmaterial als JSON.
Regeln:
- Schreibe auf Deutsch.
- Keine langen Frontaltexte.
- Schülersprache, konkrete Aufgaben, klare Operatoren.
- Klasse 5: kurze Sätze, sichtbare Handlungsschritte, wenig offene Recherche, mehr Zuordnung/Begründung.
- Immer ein Beispiel vor Eigenarbeit.
- Immer 3 bis 5 Hauptaufgaben.
- Immer Differenzierung mit Stern, Planet und Rakete.
- Freundlich-visuell und professionell denken, aber kein HTML und keine Markdown-Ausgabe.
- Keine Namenssignatur, keine Marke nennen.
- Inhalt fachlich korrekt halten und Unsicherheiten vermeiden.`;
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

async function handleGenerate(req, res) {
  const input = compactInput(await readJsonBody(req));

  if (!process.env.OPENAI_API_KEY) {
    return sendJson(res, 200, {
      source: "fallback",
      message: "Kein OPENAI_API_KEY gesetzt. Regelbasierter Entwurf wurde erzeugt.",
      material: makeFallbackMaterial(input),
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
        instructions: buildInstructions(),
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Erzeuge Material für diese Eingaben:\n${JSON.stringify(input, null, 2)}`,
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "unterrichtsmaterial",
            strict: true,
            schema: materialSchema,
          },
        },
      }),
    });

    const responseJson = await response.json();
    if (!response.ok) {
      throw new Error(responseJson.error?.message || "OpenAI-Anfrage fehlgeschlagen.");
    }

    const outputText = extractOutputText(responseJson);
    const material = JSON.parse(outputText);
    sendJson(res, 200, { source: "ai", material });
  } catch (error) {
    sendJson(res, 502, {
      source: "fallback",
      error: error.message,
      material: makeFallbackMaterial(input),
    });
  }
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${port}`);
  const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
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
  if (req.method === "POST" && req.url === "/api/generate") {
    handleGenerate(req, res).catch((error) => {
      sendJson(res, 500, { error: error.message });
    });
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
  console.log(`Materialstudio läuft auf http://localhost:${port}`);
});
