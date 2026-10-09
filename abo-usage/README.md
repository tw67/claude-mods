# abo-usage

Claude-Code-Mod, der über dem Eingabefeld live anzeigt:

- die Nutzung des Claude-Abos (5h-Limit und Wochenlimit) als Balken:
  0–30 % grün, 31–80 % weiß, 81–100 % rot
- wann die Limits zurückgesetzt werden
- die verfügbaren Higgsfield-Credits und den Higgsfield-Tarif (wenn der Higgsfield-MCP verbunden ist)

Läuft im Terminal und in der Desktop-App (Code-Tab).

## Installation

1. Ordner an einen festen Ort legen, z. B. `~/.claude/mods/abo-usage`.
2. In `~/.claude/settings.json` eintragen:

   ```json
   {
     "env": {
       "CLAUDE_CODE_PLUGIN_DIRS": "/Users/<name>/.claude/mods/abo-usage"
     }
   }
   ```

3. Für die Higgsfield-Anzeige die Guthaben-Abfrage erlauben (sonst bleibt die Zeile leer):

   ```json
   {
     "permissions": {
       "allow": ["mcp__<higgsfield-connector-id>__balance"]
     }
   }
   ```

4. Claude Code neu starten. Die Leiste erscheint nach der ersten Antwort in einer Session.

Für ein einmaliges Ausprobieren im Terminal reicht `claude --plugin-dir <pfad>/abo-usage`.

## Anpassen

In `hooks/register.tsx`: `BAR_WIDTH` (Balkenbreite), `LABELS` (Beschriftungen), `colorFor` (Farbgrenzen).

## Tests

```bash
claude plugin validate .
claude plugin test .
```
