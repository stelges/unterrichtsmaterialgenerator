import { BLOCK_TYPES, PAGE_PURPOSES, TEMPLATE_MODES, createBlock, createEmptyMaterialPackage, normalizePageCount, page } from "./material-schema-v2.js";

export function buildMaterialPackageV2(input = {}) {
  const data = normalizeInput(input);
  const pkg = createEmptyMaterialPackage();
  const pageCount = normalizePageCount(data.variant);

  pkg.meta = {
    ...pkg.meta,
    title: data.thema,
    subject: data.fach,
    className: data.klasse,
    duration: data.dauer,
    templateMode: data.templateMode,
    pageCount,
    level: data.schwierigkeit,
  };

  pkg.didacticPlan = buildDidacticPlan(data);
  pkg.knowledgeCore = buildKnowledgeCore(data);
  pkg.pages = buildPages(data, pkg, pageCount);
  pkg.teacherNotes = buildTeacherNotes(data, pkg);
  pkg.scobees = buildScobees(data, pkg);

  return pkg;
}

function normalizeInput(input) {
  return {
    fach: input.fach?.trim() || "Fach",
    klasse: input.klasse?.trim() || "Klasse",
    thema: input.thema?.trim() || "Neues Thema",
    stundenziel: input.stundenziel?.trim() || "Die Schülerinnen und Schüler bearbeiten das Thema selbstständig, nutzen Fachbegriffe und sichern ihr Ergebnis.",
    leitfrage: input.leitfrage?.trim() || "Was muss ich verstehen, um das Thema sicher erklären und anwenden zu können?",
    dauer: input.dauer?.trim() || "60 Minuten",
    schwierigkeit: input.schwierigkeit || "mittel",
    templateMode: input.templateMode || TEMPLATE_MODES.KNOWLEDGE,
    variant: input.variant || "4p",
    inhalte: input.inhalte?.trim() || "",
    vorwissen: input.vorwissen?.trim() || "",
    hinweise: input.hinweise?.trim() || "",
    scobeesSubmission: input.scobeesSubmission?.trim() || "",
  };
}

function buildDidacticPlan(data) {
  const paths = {
    [TEMPLATE_MODES.KNOWLEDGE]: ["Problem verstehen", "Wissen aufbauen", "Beispiel nachvollziehen", "anwenden", "sichern"],
    [TEMPLATE_MODES.EXPERIMENT]: ["Forscherfrage verstehen", "Vermutung formulieren", "Versuch durchführen", "beobachten", "auswerten", "Merksatz formulieren"],
    [TEMPLATE_MODES.EXPLORATION]: ["Erkundungsfrage verstehen", "Recherche planen", "Quelle/Fundort sichern", "Ergebnisse vergleichen", "bewerten", "sichern"],
    [TEMPLATE_MODES.WORKSHEET]: ["Ziel verstehen", "Beispiel nutzen", "Aufgaben bearbeiten", "prüfen"],
  };

  return {
    learningGoal: data.stundenziel,
    guidingQuestion: data.leitfrage,
    coreConcept: inferCoreConcept(data),
    learningPath: paths[data.templateMode] || paths.knowledge,
    prerequisites: data.vorwissen ? [data.vorwissen] : ["Grundlegendes Textverständnis", "Bereitschaft, kurze Antworten zu formulieren"],
    misconceptions: inferMisconceptions(data),
    successCriteria: inferSuccessCriteria(data),
  };
}

function inferCoreConcept(data) {
  if (/wärme|ausdehn/i.test(data.thema)) return "Stoffe verändern bei Temperaturänderung ihre Ausdehnung; dies lässt sich an Alltagsbeispielen begründen.";
  if (/stoff/i.test(data.thema)) return "Stoffe lassen sich nicht nur am Aussehen, sondern über überprüfbare Stoffeigenschaften unterscheiden.";
  if (data.templateMode === TEMPLATE_MODES.EXPLORATION) return "Gute Ergebnisse entstehen durch gezielte Suche, nachvollziehbare Quellen/Fundorte und begründete Bewertung.";
  if (data.templateMode === TEMPLATE_MODES.EXPERIMENT) return "Fachliches Lernen entsteht durch Vermutung, planvolle Untersuchung, genaue Beobachtung und begründete Auswertung.";
  return `Das zentrale Konzept zu ${data.thema} wird über Fachbegriffe, Beispiele und begründete Anwendung erschlossen.`;
}

function inferMisconceptions(data) {
  if (/wärme|ausdehn/i.test(data.thema)) {
    return ["Wärme macht Dinge immer sichtbar größer.", "Nur Metall dehnt sich aus.", "Ausdehnung ist immer groß und leicht sichtbar."];
  }
  if (/stoff/i.test(data.thema)) {
    return ["Gegenstand und Stoff sind dasselbe.", "Man erkennt Stoffe nur am Aussehen.", "Eine einzelne Eigenschaft reicht immer zur sicheren Bestimmung."];
  }
  return ["Eine Behauptung reicht ohne Begründung.", "Ein Beispiel ersetzt keine Erklärung."];
}

function inferSuccessCriteria(data) {
  if (data.templateMode === TEMPLATE_MODES.EXPLORATION) {
    return ["Ich habe Quelle oder Fundort notiert.", "Ich habe Ergebnisse mit Kriterien verglichen.", "Ich habe mein Ergebnis begründet."];
  }
  if (data.templateMode === TEMPLATE_MODES.EXPERIMENT) {
    return ["Ich habe eine Vermutung formuliert.", "Ich habe Beobachtung und Erklärung getrennt.", "Ich habe einen fachlich passenden Merksatz geschrieben."];
  }
  return ["Ich habe Fachbegriffe richtig benutzt.", "Ich habe ein Beispiel erklärt.", "Ich habe mindestens eine Antwort begründet."];
}

function buildKnowledgeCore(data) {
  const suppliedTerms = data.inhalte
    .split(/\n|;|,/)
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 8);

  if (/wärme|ausdehn/i.test(data.thema)) {
    return {
      shortText: "Viele Stoffe verändern ihre Größe, wenn sich ihre Temperatur ändert. Beim Erwärmen dehnen sich viele Stoffe aus: Sie brauchen etwas mehr Platz. Beim Abkühlen ziehen sie sich wieder zusammen. Die Veränderung ist oft klein, kann im Alltag aber wichtig sein, zum Beispiel bei Schienen, Kabeln, Brücken oder Metalldeckeln.",
      terms: [
        { term: "ausdehnen", explanation: "etwas größer werden oder mehr Platz brauchen", example: "Metall wird beim Erwärmen etwas größer" },
        { term: "zusammenziehen", explanation: "beim Abkühlen wieder kleiner werden", example: "Ein Stoff braucht bei Kälte oft etwas weniger Platz" },
        { term: "Temperatur", explanation: "gibt an, wie warm oder kalt etwas ist", example: "heißes Wasser hat eine höhere Temperatur als kaltes Wasser" },
      ],
      workedExample: {
        situation: "Ein festsitzender Metalldeckel wird unter warmes Wasser gehalten.",
        observation: "Der Deckel lässt sich danach leichter öffnen.",
        explanation: "Das Metall erwärmt sich und dehnt sich etwas aus. Dadurch sitzt der Deckel lockerer.",
      },
      everydayConnections: ["Schienen brauchen Dehnungsfugen", "Kabel hängen bei Wärme stärker durch", "Brücken haben bewegliche Übergänge"],
    };
  }

  if (/stoff/i.test(data.thema)) {
    return {
      shortText: "Ein Gegenstand ist ein Ding, das man benutzen oder anfassen kann. Ein Stoff ist das Material, aus dem ein Gegenstand besteht. Stoffe kann man durch Eigenschaften unterscheiden, zum Beispiel Farbe, Geruch, Löslichkeit, Magnetismus, Härte oder elektrische Leitfähigkeit. Sicherer wird die Bestimmung, wenn man mehrere Eigenschaften prüft.",
      terms: [
        { term: "Stoff", explanation: "Material, aus dem ein Gegenstand besteht", example: "Holz, Eisen, Kunststoff, Zucker" },
        { term: "Gegenstand", explanation: "Ding mit einer bestimmten Form oder Funktion", example: "Löffel, Becher, Nagel" },
        { term: "Stoffeigenschaft", explanation: "Merkmal, mit dem man Stoffe vergleichen kann", example: "magnetisch, löslich, hart" },
      ],
      workedExample: {
        situation: "Eine unbekannte Probe ist weiß und körnig.",
        observation: "Sie löst sich in Wasser und wird nicht vom Magneten angezogen.",
        explanation: "Die Eigenschaften passen eher zu Zucker oder Salz als zu Eisen.",
      },
      everydayConnections: ["Materialauswahl im Alltag", "Recycling", "Sicherer Umgang mit unbekannten Stoffen"],
    };
  }

  return {
    shortText: data.inhalte || `Zu ${data.thema} brauchst du Fachbegriffe, ein Beispiel und eine Begründung. Lies genau, markiere wichtige Wörter und nutze sie später in deinen Antworten.`,
    terms: suppliedTerms.length
      ? suppliedTerms.slice(0, 4).map((term) => ({ term, explanation: "Erkläre den Begriff in eigenen Worten.", example: "Finde ein passendes Beispiel." }))
      : [
          { term: data.thema, explanation: "Zentraler Begriff der Stunde", example: "Beispiel aus dem Unterrichtsmaterial" },
          { term: "Begründung", explanation: "erklärt, warum eine Antwort passt", example: "Das passt, weil …" },
        ],
    workedExample: {
      situation: `Ein Beispiel zu ${data.thema}`,
      observation: "Beobachtung oder Information notieren.",
      explanation: "Mit Fachbegriffen erklären und begründen.",
    },
    everydayConnections: ["Alltagsbeispiel finden", "Fachbegriff anwenden", "Ergebnis begründen"],
  };
}

function buildPages(data, pkg, count) {
  const pages = [
    buildOrientationPage(pkg),
    buildKnowledgePage(pkg),
    buildPracticePage(pkg),
    buildSecuringPage(pkg),
  ];

  if (count === 2) return [pages[0], pages[3].withPageNumber?.(2) || renumberPage(pages[3], 2)];
  if (count === 6) {
    return [
      pages[0],
      pages[1],
      buildGuidedPracticePage(pkg),
      buildPracticePage(pkg, 4),
      buildDifferentiationPage(pkg, 5),
      buildSecuringPage(pkg, 6),
    ];
  }
  return pages;
}

function renumberPage(pageObject, pageNumber) {
  return { ...pageObject, pageNumber };
}

function buildOrientationPage(pkg) {
  return page(1, PAGE_PURPOSES.ORIENTATION, "Start und Orientierung", [
    createBlock(BLOCK_TYPES.GOAL_BOX, { text: pkg.didacticPlan.learningGoal }),
    createBlock(BLOCK_TYPES.PROBLEM_IMPULSE, { question: pkg.didacticPlan.guidingQuestion, prompt: "Was vermutest du? Schreibe einen Satz." }),
    createBlock(BLOCK_TYPES.STUDENT_WORKFLOW, { steps: learningStepsFor(pkg.meta.templateMode) }),
  ]);
}

function buildKnowledgePage(pkg) {
  return page(2, PAGE_PURPOSES.KNOWLEDGE_BUILDING, "Wissen aufbauen", [
    createBlock(BLOCK_TYPES.KNOWLEDGE_BOX, { title: "Wissenskasten", text: pkg.knowledgeCore.shortText }),
    createBlock(BLOCK_TYPES.WORKED_EXAMPLE, { ...pkg.knowledgeCore.workedExample }),
    createBlock(BLOCK_TYPES.TERM_TABLE, { terms: pkg.knowledgeCore.terms }),
  ]);
}

function buildGuidedPracticePage(pkg) {
  return page(3, PAGE_PURPOSES.PRACTICE, "Gemeinsam nach Muster arbeiten", [
    createBlock(BLOCK_TYPES.SHORT_ANSWER_TASK, {
      title: "Beispiel übertragen",
      prompt: "Nutze das ausgefüllte Beispiel. Übertrage das Muster auf ein neues Beispiel.",
      answerLines: 4,
      sentenceStarter: "Das passt, weil …",
    }),
    createBlock(BLOCK_TYPES.TERM_TABLE, { terms: pkg.knowledgeCore.terms.slice(0, 3) }),
  ]);
}

function buildPracticePage(pkg, pageNumber = 3) {
  const mode = pkg.meta.templateMode;
  if (mode === TEMPLATE_MODES.EXPLORATION) {
    return page(pageNumber, PAGE_PURPOSES.PRACTICE, "Recherchieren und bewerten", [
      createBlock(BLOCK_TYPES.RESEARCH_TASK, {
        title: "Rechercheauftrag",
        prompt: `Recherchiere zur Leitfrage: ${pkg.didacticPlan.guidingQuestion}`,
        criteria: ["passt zur Leitfrage", "Quelle/Fundort ist notiert", "Aussage ist verständlich"],
        rows: 4,
      }),
      createBlock(BLOCK_TYPES.MATCHING_TABLE_TASK, {
        title: "Ergebnisse vergleichen",
        columns: ["Kriterium", "Ergebnis A", "Ergebnis B", "Bewertung"],
        rows: ["passt zur Frage", "verständlich", "wichtig"],
      }),
    ]);
  }

  if (mode === TEMPLATE_MODES.EXPERIMENT) {
    return page(pageNumber, PAGE_PURPOSES.PRACTICE, "Untersuchen und auswerten", [
      createBlock(BLOCK_TYPES.EXPERIMENT_PROTOCOL, {
        title: "Versuchsprotokoll",
        question: pkg.didacticPlan.guidingQuestion,
        fields: ["Vermutung", "Material", "Durchführung", "Beobachtung", "Auswertung"],
      }),
      createBlock(BLOCK_TYPES.OBSERVATION_TABLE, {
        title: "Beobachtungstabelle",
        columns: ["Schritt", "Beobachtung", "Erklärung"],
        rows: 4,
      }),
    ]);
  }

  return page(pageNumber, PAGE_PURPOSES.PRACTICE, "Verstehen und anwenden", [
    createBlock(BLOCK_TYPES.PREDICTION_TASK, {
      title: "Vorhersage",
      prompt: `Was erwartest du bei ${pkg.meta.title}? Begründe deine Vermutung.`,
      options: ["Ich stimme zu", "Ich bin unsicher", "Ich stimme nicht zu"],
      sentenceStarter: "Ich vermute, dass …, weil …",
    }),
    createBlock(BLOCK_TYPES.TRUE_FALSE_CORRECTION, {
      title: "Richtig oder falsch?",
      items: buildTrueFalseItems(pkg),
    }),
    createBlock(BLOCK_TYPES.MATCHING_TABLE_TASK, {
      title: "Anwenden und begründen",
      columns: ["Situation", "Fachwort", "Begründung"],
      rows: buildMatchingRows(pkg),
    }),
  ]);
}

function buildDifferentiationPage(pkg, pageNumber) {
  return page(pageNumber, PAGE_PURPOSES.DIFFERENTIATION, "Wähle dein Niveau", [
    createBlock(BLOCK_TYPES.SHORT_ANSWER_TASK, {
      title: "★ Stern",
      prompt: "Bearbeite die Pflichtaufgabe mit Satzstarter.",
      answerLines: 4,
      sentenceStarter: "Ich erkenne …, weil …",
    }),
    createBlock(BLOCK_TYPES.SHORT_ANSWER_TASK, {
      title: "● Planet",
      prompt: "Bearbeite eine weitere Situation und begründe selbstständig.",
      answerLines: 5,
      sentenceStarter: "Meine Begründung lautet …",
    }),
    createBlock(BLOCK_TYPES.SHORT_ANSWER_TASK, {
      title: "▲ Rakete",
      prompt: "Erfinde ein eigenes Beispiel oder eine kritische Frage.",
      answerLines: 5,
      sentenceStarter: "Meine Zusatzidee ist …",
    }),
  ]);
}

function buildSecuringPage(pkg, pageNumber = 4) {
  return page(pageNumber, PAGE_PURPOSES.SECURING, "Sichern und abgeben", [
    createBlock(BLOCK_TYPES.MERKSATZ_TASK, {
      title: "Merksatz",
      prompt: "Schreibe einen fachlich richtigen Merksatz in ein bis zwei Sätzen.",
      sentenceStarter: "Ich merke mir: …",
    }),
    createBlock(BLOCK_TYPES.REFLECTION_TASK, {
      title: "Reflexion",
      prompts: ["Das habe ich verstanden:", "Das ist noch unsicher:", "Ein Beispiel aus dem Alltag:"],
    }),
    createBlock(BLOCK_TYPES.SELF_CHECK, { items: pkg.didacticPlan.successCriteria }),
    createBlock(BLOCK_TYPES.SCOBEES_SUBMISSION, { text: pkg.scobees.submission || "Lade deine Sicherungsseite gut lesbar hoch." }),
  ]);
}

function learningStepsFor(mode) {
  if (mode === TEMPLATE_MODES.EXPLORATION) return ["Leitfrage lesen", "Suchfrage formulieren", "Quelle/Fundort notieren", "Ergebnisse vergleichen", "Bewertung schreiben"];
  if (mode === TEMPLATE_MODES.EXPERIMENT) return ["Forscherfrage lesen", "Vermutung schreiben", "Versuch durchführen", "Beobachtung notieren", "Auswertung formulieren"];
  return ["Wissenskasten lesen", "Beispiel nachvollziehen", "Aufgaben bearbeiten", "Fachwörter nutzen", "Merksatz schreiben"];
}

function buildTrueFalseItems(pkg) {
  if (/wärme|ausdehn/i.test(pkg.meta.title)) {
    return [
      { statement: "Beim Erwärmen dehnen sich viele Stoffe aus.", expected: true, correctionStarter: "Richtig ist: …" },
      { statement: "Beim Abkühlen brauchen viele Stoffe mehr Platz.", expected: false, correctionStarter: "Richtig ist: …" },
      { statement: "Ausdehnung kann im Alltag wichtig sein.", expected: true, correctionStarter: "Richtig ist: …" },
    ];
  }
  return [
    { statement: "Eine Behauptung braucht eine Begründung.", expected: true, correctionStarter: "Richtig ist: …" },
    { statement: "Ein Beispiel ersetzt immer eine Erklärung.", expected: false, correctionStarter: "Richtig ist: …" },
    { statement: "Fachbegriffe helfen beim genauen Erklären.", expected: true, correctionStarter: "Richtig ist: …" },
  ];
}

function buildMatchingRows(pkg) {
  if (/wärme|ausdehn/i.test(pkg.meta.title)) return ["Schiene im Sommer", "Metalldeckel unter warmem Wasser", "Kabel im Winter"];
  if (/stoff/i.test(pkg.meta.title)) return ["Nagel aus Eisen", "Zucker im Wasser", "Kunststofflöffel"];
  return ["Beispiel 1", "Beispiel 2", "Beispiel 3"];
}

function buildTeacherNotes(data, pkg) {
  return {
    flow: pkg.didacticPlan.learningPath,
    pitfalls: pkg.didacticPlan.misconceptions,
    differentiation: data.hinweise || "Stern-Aufgabe für schwächere Lernende, Rakete für schnelle Lernende nutzen.",
  };
}

function buildScobees(data, pkg) {
  return {
    title: pkg.meta.title,
    instructions: `Bearbeite das Material zu ${pkg.meta.title} der Reihe nach.`,
    submission: data.scobeesSubmission || "Lade die Sicherungsseite oder das vollständige Material gut lesbar in Scobees hoch.",
  };
}
