# Training Notes

Training Notes add a smart learning feature directly into Foam.
They help you review your notes regularly and retain knowledge to the long-term memory, following the [Phase-6 principle](https://www.phase-6.de/help/knowledge-base/phaseneinstellungen/).

Each note automatically tracks which phase you’re in and when it’s due for the next review.
If you remember the information correctly, you progress to the next phase—step by step—until you reach the final phase.

Foam shows you the notes that need attention today, including any overdue notes, guiding you to gradually reinforce your knowledge—without having to manage dates or tables manually.
Since it’s difficult for Foam to judge whether you truly remember the information from a note, you decide whether to move it to the next phase or review it again.

## Quickstart

To create a new Training Note, use the template variable: "FOAM_TRAINING_NOTE". Like all other `Template Variables`, it works seamlessly within your template. So if you include this in a template, Foam automatically replaces it with the frontmatter for a Training Note (see `note-templates.md ##Variables`).
Then, use the `Foam: Create new Note from Template` command and select your template containing the Training Note variable. The command will ask for confirmation before creating the Training Note, so you can safely include it in your default new-note.md template.

## Frontmatter Structure

When you create a Training Note from a template, Foam automatically generates the following frontmatter:

```yaml
---
type: training-note
currentPhase:
  name: Phase 1
  days: 0
nextReminder: Wed Oct 01 2025
---
```

**type** (string) – Identifies the note as a Training Note. <br>
**currentPhase** (object) – Tracks your current learning phase: <br>
  *name* (string) – The name of the current phase (e.g., Phase 1). <br>
  *days* (number) – The interval in days until the next review. <br>
**nextReminder** (date/string) – The date when this note should next be reviewed. <br>

This frontmatter allows Foam to manage your learning schedule automatically.