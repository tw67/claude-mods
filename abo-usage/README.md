# abo-usage

Claude-Code-Mod, der über dem Eingabefeld live anzeigt:

- die Nutzung des Claude-Abos (5h-Limit und Wochenlimit) als Balken:
  0–30 % grün, 31–80 % weiß, 81–100 % rot
- wann die Limits zurückgesetzt werden
- die verfügbaren Higgsfield-Credits und den Higgsfield-Tarif (wenn der Higgsfield-MCP verbunden ist)

Läuft im Terminal und in der Desktop-App (Code-Tab).

## Installation

In einer Claude-Code-Session:

```
/plugin marketplace add tw67/claude-mods
/plugin install abo-usage@claude-mods
```

oder im Terminal:

```bash
claude plugin marketplace add tw67/claude-mods
claude plugin install abo-usage@claude-mods
```

Danach Claude Code neu starten. Die Leiste erscheint nach der ersten Antwort in einer Session.

Für die Higgsfield-Anzeige die Guthaben-Abfrage in `~/.claude/settings.json` erlauben (sonst bleibt die Zeile leer):

```json
{
  "permissions": {
    "allow": ["mcp__<higgsfield-connector-id>__balance"]
  }
}
```

Updates holen: `claude plugin marketplace update claude-mods`

Zum einmaligen Ausprobieren ohne Installation: `claude --plugin-dir <pfad>/abo-usage`

## Anpassen

In `hooks/register.tsx`: `BAR_WIDTH` (Balkenbreite), `LABELS` (Beschriftungen), `colorFor` (Farbgrenzen).

## Tests

```bash
claude plugin validate .
claude plugin test .
```
