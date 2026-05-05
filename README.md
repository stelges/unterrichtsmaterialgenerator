# Unterrichtsmaterialgenerator

> **Status: Veraltet / nicht mehr aktiv gepflegt**
>
> Dieses Repository wird nicht mehr aktiv weiterentwickelt. Die neue Version des Materialsystems befindet sich im Repository **`stelges/materialsystem`**.
>
> Dieses Repo bleibt nur als alte Referenz bzw. Archiv bestehen.

Lokales KI-gestuetztes Materialstudio fuer Unterrichtsmaterialien.

## Start

```bash
node server.js
```

Danach im Browser oeffnen:

```text
http://localhost:5173/index.html
```

## KI-Modus

Eine `.env` im Projektordner anlegen:

```text
OPENAI_API_KEY=dein_key
OPENAI_MODEL=gpt-5.2
```

Ohne API-Key erzeugt die App automatisch ein regelbasiertes Basismaterial.

## Funktionen

- Formular fuer Fach, Klasse, Thema, Ziel, Vorwissen und Stil
- KI-Generierung ueber lokalen Server-Endpunkt `/api/generate`
- Strukturierte Materialdaten statt freiem HTML
- Einheitliches Materialdesign ohne Namenssignatur
- PDF-Druck ueber Browser
- HTML-Download
- Lehrkraft-Notiz als Markdown

## Sicherheit

Der API-Key gehoert nur in `.env`. Diese Datei ist durch `.gitignore` vom Git-Upload ausgeschlossen.
