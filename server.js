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
  ".txt": "text/plain; charset=utf-8",
};

const materialSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "templateMode",
    "variant",
    "title",
    "subtitle",
    "metadata",
    "goal",
    "guidingQuestion",
    "intro",
    "example",
    "sections",
    "tasks",
    "differentiation",
    "reflection",
    "qualityCheck",
    "scobeesSubmission",
    "teacherNote",
  ],
  properties: {
    templateMode: { type: "string", enum: ["knowledge", "experiment", "exploration", "worksheet"] },
    variant: { type: "string" },
    title: { type: "string" },
    subtitle: { type: "string" },
    metadata: {
      type: "object",
      additionalProperties: false,
      required: ["subject", "className", "type", "level", "pattern", "duration"],
      properties: {
        subject: { type: "string" },
        className: { type: "string" },
        type: { type: "string" },
        level: { type: "string" },
        pattern: { type: "string" },
        duration: { type: "string" },
      },
    },
    goal: { type: "string" },
    guidingQuestion: { type: "string" },
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
    sections: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "body", "kind", "page"],
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          kind: { type: "string", enum: ["cover", "write", "input", "tasks", "table", "reflection", "check"] },
          page: { type: "number" },
        },
      },
    },
    tasks: {
      type: "array",
      minItems: 3,
      maxItems: 6,
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
    scobeesSubmission: { type: "string" },
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
    const value = rest.join("=").replace(/^[']|[']$/g, "").replace(/^[\"]|[\"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function compactInput(input = {}) {
  return {
    fach: input.fach || "",
    klasse: input.klasse || "",
    thema: input.thema || "",
    stundenziel: input.stundenziel || "",
    leitfrage: input.leitfrage || "",
    dauer: input.dauer || "",
    vorwissen: input.vorwissen || "",
    materialtyp: input.materialtyp || "",
    templateMode: input.templateMode || "knowledge",
    variant: input.variant || "4p",
    muster: input.muster || "",
    schwierigkeit: input.schwierigkeit || "",
    textmenge: input.textmenge || "",
    gestaltung: input.gestaltung || "",
    schwerpunkte: Array.isArray(input.schwerpunkte) ? input.schwerpunkte : [],
    inhalte: input.inhalte || "",
    scobeesSubmission: input.scobeesSubmission || "",
    hinweise: input.hinweise || "",
  };
}

function defaultGuidingQuestion(mode, topic) {
  if (mode === "experiment") return `Was können wir zu ${topic} beobachten und erklären?`;
  if (mode === "exploration") return `Wie können wir ${topic} sinnvoll erkunden und bewerten?`;
  return `Was ist an ${topic} wichtig und wie kann ich es anwenden?`;
}

function makeFallbackMaterial(input) {
  const data = compactInput(input);
  const topic = data.thema || "Neues Thema";
  const subject = data.fach || "Fach";
  const className = data.klasse || "Klasse";
  const mode = data.templateMode || "knowledge";
  const modeLabel = {
    knowledge: "Wissens-Forscherheft",
    experiment: "Experiment-Forscherheft",
    exploration: "Erkundungs-Forscherheft",
    worksheet: "Arbeitsblatt",
  }[mode] || "Arbeitsmaterial";
  const goal = data.stundenziel || `Ich kann ${topic} mit eigenen Worten erklären und eine passende Aufgabe lösen.`;
  const terms = (data.inhalte || "")
    .split(/\n|;|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
  const visibleTerms = terms.length ? terms.join(", ") : `${topic}, Beispiel, Regel`;
  const pageCount = data.variant === "6p" ? 6 : data.variant === "2p" ? 2 : 4;

  const sectionBase = [
    { title: "Cover und Lernziel", body: `Heute geht es um ${topic}.`, kind: "cover", page: 1 },
    { title: "Einstieg und Vorwissen", body: "Aktiviere dein Vorwissen und notiere erste Ideen.", kind: "write", page: 2 },
    { title: "Input und Begriffe", body: `Wichtige Begriffe: ${visibleTerms}.`, kind: "input", page: 3 },
    { title: "Verstehen und Anwenden", body: "Bearbeite die Aufgaben und nutze das Beispiel.", kind: "tasks", page: 4 },
    { title: "Sicherung", body: "Formuliere einen Merksatz in eigenen Worten.", kind: "write", page: 5 },
    { title: "Reflexion", body: "Prüfe, was du verstanden hast.", kind: "reflection", page: 6 },
  ];

  return {
    templateMode: mode,
    variant: data.variant,
    title: topic,
    subtitle: `${subject} · ${className}`,
    metadata: {
      subject,
      className,
      type: modeLabel,
      level: data.schwierigkeit || "eher leicht",
      pattern: data.muster || modeLabel,
      duration: data.dauer || "60 Minuten",
    },
    goal,
    guidingQuestion: data.leitfrage || defaultGuidingQuestion(mode, topic),
    intro: `Heute arbeitest du zu ${topic}. Starte mit dem Beispiel und bearbeite die Aufgaben der Reihe nach.`,
    example: {
      title: "So kann eine gute Antwort aussehen",
      body: `Eine gute Antwort nennt einen wichtigen Begriff zu ${topic}, erklärt ihn kurz und nutzt ein Beispiel.`,
      sample: `Ich erkenne ${topic}, weil ich ein Merkmal finde und meine Entscheidung begründe.`,
    },
    sections: sectionBase.slice(0, pageCount),
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
    scobeesSubmission:
      data.scobeesSubmission ||
      "Lade dein bearbeitetes PDF oder ein Foto deiner wichtigsten Ergebnisse in Scobees hoch. Schreibe dazu einen Satz: Das habe ich heute verstanden.",
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
- Nutze templateMode exakt aus der Eingabe: knowledge, experiment, exploration oder worksheet.
- Wissens-Forscherheft: Problemfrage → Input → Verstehen → Anwenden → Sichern → Reflektieren.
- Experiment-Forscherheft: Forscherfrage → Vermutung → Durchführung → Beobachtung → Auswertung → Merksatz.
- Erkundungs-Forscherheft: Auftrag → Kriterien → Erkunden → Sammeln → Vergleichen → Bewerten.
- Keine langen Frontaltexte.
- Schülersprache, konkrete Aufgaben, klare Operatoren.
- Klasse 5: kurze Sätze, sichtbare Handlungsschritte, wenig offene Recherche, mehr Zuordnung/Begründung.
- Immer ein Beispiel vor Eigenarbeit.
- Immer 3 bis 6 Hauptaufgaben.
- Immer Differenzierung mit Stern, Planet und Rakete.
- Immer sections für 2, 4 oder 6 Seiten passend zur Eingabe.
- Immer einen Scobees-Abgabehinweis formulieren.
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
