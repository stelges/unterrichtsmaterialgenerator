import { MATERIAL_TYPES, PAGE_PURPOSES, TASK_TYPES, createLearningDesign, materialItem, pageSpec, taskItem } from "./v3-schema.js";
import { checkCoherenceV3 } from "./coherence-check-v3.js";

export function buildLearningDesignV3(input = {}) {
  const data = normalizeInput(input);
  const design = createLearningDesign(data);

  if (/wärme|ausdehn/i.test(data.thema)) buildHeatExpansionDesign(design, data);
  else buildGenericDesign(design, data);

  design.coherenceReport = checkCoherenceV3(design);
  return design;
}

function normalizeInput(input) {
  return {
    fach: input.fach?.trim() || "Fach",
    klasse: input.klasse?.trim() || "Klasse",
    thema: input.thema?.trim() || "Neues Thema",
    stundenziel: input.stundenziel?.trim() || "Die Schülerinnen und Schüler erklären das Thema mit Fachbegriffen und begründen ihre Antworten.",
    leitfrage: input.leitfrage?.trim() || `Was ist an ${input.thema || "diesem Thema"} wichtig?`,
    dauer: input.dauer?.trim() || "60 Minuten",
    schwierigkeit: input.schwierigkeit || "mittel",
    variant: input.variant || "4p",
    inhalte: input.inhalte?.trim() || "",
    hinweise: input.hinweise?.trim() || "",
  };
}

function buildHeatExpansionDesign(design, data) {
  design.learningDesign = {
    internalLearningGoal: data.stundenziel,
    studentQuestion: data.leitfrage,
    lessonStory: "Die SuS starten mit einem Alltagsproblem und erklären am Ende fachlich, warum Wärme manche Dinge größer werden lässt.",
    targetAnswer: "Viele Stoffe dehnen sich beim Erwärmen etwas aus und ziehen sich beim Abkühlen wieder zusammen. Deshalb können Deckel, Schienen oder Kabel bei Temperaturänderungen anders passen oder sich anders verhalten.",
    successCriteria: ["Ich nutze Temperatur, ausdehnen und zusammenziehen richtig.", "Ich erkläre ein Alltagsbeispiel mit Wärmeausdehnung.", "Ich beantworte die Stundenfrage mit Begründung."],
    keyConcepts: ["Temperatur", "ausdehnen", "zusammenziehen", "Wärmeausdehnung"],
    misconceptions: ["Nur Metall dehnt sich aus.", "Ausdehnung muss immer sichtbar groß sein.", "Wärme und Temperatur werden gleichgesetzt."],
    learningSteps: ["Alltagsfrage vermuten", "Wissenskasten lesen", "Beispiel nachvollziehen", "Alltagsfälle zuordnen", "Stundenfrage beantworten"],
  };

  design.materialInventory = [
    materialItem({ id: "M1", type: MATERIAL_TYPES.MINI_TEXT, title: "Alltagsproblem", content: "Ein Marmeladenglas lässt sich manchmal schwer öffnen. Hält man den Metalldeckel kurz unter warmes Wasser, klappt es oft leichter." }),
    materialItem({ id: "M2", type: MATERIAL_TYPES.KNOWLEDGE_BOX, title: "Wissenskasten: Wärmeausdehnung", content: "Viele Stoffe verändern ihre Größe, wenn sich ihre Temperatur ändert. Beim Erwärmen dehnen sich viele Stoffe aus: Sie brauchen etwas mehr Platz. Beim Abkühlen ziehen sie sich wieder zusammen. Die Veränderung ist oft klein, kann im Alltag aber wichtig sein.", terms: [
      { term: "Temperatur", explanation: "gibt an, wie warm oder kalt etwas ist", example: "warmes Wasser hat eine höhere Temperatur als kaltes Wasser" },
      { term: "ausdehnen", explanation: "größer werden oder mehr Platz brauchen", example: "Metall dehnt sich beim Erwärmen etwas aus" },
      { term: "zusammenziehen", explanation: "wieder kleiner werden oder weniger Platz brauchen", example: "ein Stoff zieht sich beim Abkühlen oft wieder zusammen" },
    ] }),
    materialItem({ id: "M3", type: MATERIAL_TYPES.WORKED_EXAMPLE, title: "Ausgefülltes Beispiel: Metalldeckel", content: "Situation: Ein Metalldeckel sitzt fest. Beobachtung: Unter warmem Wasser lässt er sich leichter drehen. Erklärung: Der Metalldeckel erwärmt sich und dehnt sich etwas aus. Dadurch sitzt er lockerer auf dem Glas." }),
  ];

  design.taskSequence = [
    taskItem({ id: "A1", type: TASK_TYPES.PREDICT, title: "Vermute zum Alltagsproblem", prompt: "Lies M1. Warum könnte warmes Wasser beim Öffnen helfen?", uses: ["M1"], answerFormat: "one_sentence", scaffold: "Ich vermute, dass …, weil …", expectedStudentProduct: "eine begründete Vermutung" }),
    taskItem({ id: "A2", type: TASK_TYPES.EXPLAIN, title: "Erkläre das Beispiel", prompt: "Nutze M2 und M3. Erkläre, warum der Deckel leichter aufgeht.", uses: ["M2", "M3"], requiresConcepts: ["Temperatur", "ausdehnen"], answerFormat: "short_lines", scaffold: "Der Deckel wird … Dadurch …", expectedStudentProduct: "kurze Erklärung mit Fachbegriffen" }),
    taskItem({ id: "A3", type: TASK_TYPES.TRUE_FALSE_CORRECT, title: "Richtig oder falsch?", prompt: "Kreuze an und verbessere falsche Aussagen.", uses: ["M2"], requiresConcepts: ["ausdehnen", "zusammenziehen"], answerFormat: "check_and_correct", expectedStudentProduct: "angekreuzte Aussagen und Korrekturen", items: [
      { statement: "Beim Erwärmen dehnen sich viele Stoffe aus.", expected: true },
      { statement: "Beim Abkühlen brauchen viele Stoffe mehr Platz.", expected: false },
      { statement: "Wärmeausdehnung kann im Alltag wichtig sein.", expected: true },
    ] }),
    taskItem({ id: "A4", type: TASK_TYPES.TABLE_COMPLETE, title: "Alltag zuordnen", prompt: "Nutze M2. Ordne die Situationen zu und begründe.", uses: ["M2"], requiresConcepts: ["ausdehnen", "zusammenziehen"], answerFormat: "table", expectedStudentProduct: "ausgefüllte Tabelle mit Begründungen", columns: ["Situation", "Was passiert?", "Begründung"], rows: ["Schienen im Sommer", "Kabel im Winter", "Metalldeckel unter warmem Wasser"] }),
    taskItem({ id: "A5", type: TASK_TYPES.MERKSATZ, title: "Beantworte die Stundenfrage", prompt: `Beantworte die Stundenfrage: ${data.leitfrage}`, uses: ["M1", "M2", "M3"], requiresConcepts: ["Temperatur", "ausdehnen", "zusammenziehen"], answerFormat: "merksatz", scaffold: "Bei Wärme … Deshalb …", expectedStudentProduct: "Antwort auf die Stundenfrage mit Begründung" }),
  ];

  design.pageComposition = [
    pageSpec({ pageNumber: 1, purpose: PAGE_PURPOSES.HOOK, title: "Forscherfrage", materialIds: ["M1"], taskIds: ["A1"] }),
    pageSpec({ pageNumber: 2, purpose: PAGE_PURPOSES.KNOWLEDGE, title: "Wissen aufbauen", materialIds: ["M2", "M3"], taskIds: ["A2"] }),
    pageSpec({ pageNumber: 3, purpose: PAGE_PURPOSES.PRACTICE, title: "Anwenden", materialIds: [], taskIds: ["A3", "A4"] }),
    pageSpec({ pageNumber: 4, purpose: PAGE_PURPOSES.SECURE, title: "Sichern", materialIds: [], taskIds: ["A5"] }),
  ];

  design.teacherNotes = {
    rationale: "Alle Aufgaben verweisen nur auf vorhandene Materialien M1-M3. Der Lernweg führt von Alltagsfrage über Wissensaufbau zur begründeten Antwort.",
    support: ["Bei Bedarf M2 gemeinsam lesen lassen.", "Satzstarter bei A2 und A5 nutzen."],
    differentiation: ["Stern: A1, A2, A5", "Planet: alle Aufgaben", "Rakete: eigenes Alltagsbeispiel ergänzen"],
  };
  design.scobees = { title: data.thema, instruction: "Bearbeite das Forscherheft der Reihe nach.", submission: "Lade Seite 4 oder das vollständige Heft gut lesbar hoch." };
}

function buildGenericDesign(design, data) {
  design.learningDesign = {
    internalLearningGoal: data.stundenziel,
    studentQuestion: data.leitfrage,
    lessonStory: "Die SuS starten mit einer Frage, bauen Wissen auf und beantworten die Frage am Ende begründet.",
    targetAnswer: `Eine fachlich passende Antwort auf die Frage: ${data.leitfrage}`,
    successCriteria: ["Ich nutze passende Fachbegriffe.", "Ich erkläre ein Beispiel.", "Ich begründe meine Antwort."],
    keyConcepts: [data.thema, "Begründung", "Beispiel"],
    misconceptions: ["Beispiel und Erklärung werden verwechselt.", "Antworten bleiben ohne Begründung."],
    learningSteps: ["Frage lesen", "Wissen aufbauen", "Beispiel verstehen", "anwenden", "sichern"],
  };
  design.materialInventory = [
    materialItem({ id: "M1", type: MATERIAL_TYPES.MINI_TEXT, title: "Startimpuls", content: `Heute geht es um die Frage: ${data.leitfrage}` }),
    materialItem({ id: "M2", type: MATERIAL_TYPES.KNOWLEDGE_BOX, title: `Wissenskasten: ${data.thema}`, content: data.inhalte || `Zu ${data.thema} brauchst du wichtige Fachbegriffe, ein Beispiel und eine Begründung.`, terms: [
      { term: data.thema, explanation: "zentraler Begriff der Stunde", example: "Beispiel aus dem Material" },
      { term: "Begründung", explanation: "erklärt, warum eine Antwort passt", example: "Das passt, weil …" },
    ] }),
    materialItem({ id: "M3", type: MATERIAL_TYPES.WORKED_EXAMPLE, title: "Ausgefülltes Beispiel", content: `Situation: Ein Beispiel zu ${data.thema}. Erklärung: Das Beispiel passt, weil ein Fachbegriff genutzt und begründet wird.` }),
  ];
  design.taskSequence = [
    taskItem({ id: "A1", type: TASK_TYPES.PREDICT, title: "Vermute", prompt: "Lies M1. Was vermutest du zur Stundenfrage?", uses: ["M1"], answerFormat: "one_sentence", scaffold: "Ich vermute, dass …", expectedStudentProduct: "eine Vermutung" }),
    taskItem({ id: "A2", type: TASK_TYPES.EXPLAIN, title: "Beispiel erklären", prompt: "Nutze M2 und M3. Erkläre das Beispiel mit einem Fachbegriff.", uses: ["M2", "M3"], requiresConcepts: [data.thema], answerFormat: "short_lines", scaffold: "Das Beispiel zeigt …, weil …", expectedStudentProduct: "Erklärung mit Fachbegriff" }),
    taskItem({ id: "A3", type: TASK_TYPES.MERKSATZ, title: "Stundenfrage beantworten", prompt: `Beantworte die Stundenfrage: ${data.leitfrage}`, uses: ["M1", "M2", "M3"], requiresConcepts: [data.thema], answerFormat: "merksatz", scaffold: "Ich kann die Frage beantworten: …", expectedStudentProduct: "begründete Antwort auf die Stundenfrage" }),
  ];
  design.pageComposition = [
    pageSpec({ pageNumber: 1, purpose: PAGE_PURPOSES.HOOK, title: "Forscherfrage", materialIds: ["M1"], taskIds: ["A1"] }),
    pageSpec({ pageNumber: 2, purpose: PAGE_PURPOSES.KNOWLEDGE, title: "Wissen aufbauen", materialIds: ["M2", "M3"], taskIds: ["A2"] }),
    pageSpec({ pageNumber: 3, purpose: PAGE_PURPOSES.PRACTICE, title: "Anwenden", materialIds: [], taskIds: [] }),
    pageSpec({ pageNumber: 4, purpose: PAGE_PURPOSES.SECURE, title: "Sichern", materialIds: [], taskIds: ["A3"] }),
  ];
}
