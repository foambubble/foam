# Daily Notes

Daily notes allow you to quickly create and access a note file for each day.

## Creating Daily Notes

- **Command:** `Ctrl+Shift+P` → "Foam: Open Daily Note"
- **Shortcut:** `Alt+D`
- **Snippets:** Type `/today`, `/yesterday`, `/tomorrow` in any note

## Automatic Daily Notes

Open daily note automatically on VS Code startup:

```json
{
  "foam.openDailyNote.onStartup": true
}
```

## Daily Note Templates

Create `.foam/templates/daily-note.md` to customize the structure:

```markdown
---
type: daily-note
---

# Daily Note - $FOAM_DATE_YEAR-$FOAM_DATE_MONTH-$FOAM_DATE_DATE

## Tasks

- [ ]

## Notes
```

## Linking to the Previous Daily Note

`$FOAM_PREVIOUS_DAILY_NOTE` expands to the most recent daily note that exists before the one being created. It skips gaps, so after a weekend or a holiday it points at the last note you actually wrote — unlike `/yesterday`, which is always the calendar day before.

```markdown
---
type: daily-note
---

# $FOAM_DATE_YEAR-$FOAM_DATE_MONTH-$FOAM_DATE_DATE

Previously: [[$FOAM_PREVIOUS_DAILY_NOTE]]
```

In your very first daily note there is no previous one, and the variable expands to nothing. To write something else instead, give it a fallback:

```markdown
Previously: ${FOAM_PREVIOUS_DAILY_NOTE:nothing yet}
```

The variable is only available in the daily note template, and it finds daily notes by matching the path your template creates them at. That path has to spell out the year, month and day in numbers — `/journal/$FOAM_DATE_YEAR-$FOAM_DATE_MONTH-$FOAM_DATE_DATE.md` works, and so does `$FOAM_TITLE`. A path built from a month name or a week number (`$FOAM_DATE_MONTH_NAME`, `$FOAM_DATE_WEEK`) cannot be read back, so the variable stays empty and its fallback shows instead. Daily notes written before you last changed that path are not found either. A JavaScript daily note template picks its path as it runs, so the variable is empty there too — a JavaScript template can find the previous note itself.

## Date Snippets

Create links to recent daily notes using snippets:

| Snippet      | Date          |
| ------------ | ------------- |
| `/today`     | today         |
| `/tomorrow`  | tomorrow      |
| `/yesterday` | yesterday     |
| `/monday`    | next Monday   |
| `/+1d`       | tomorrow      |
| `/-3d`       | 3 days ago    |
| `/+1w`       | in a week     |
| `/-1m`       | one month ago |
| `/+1y`       | in one year   |

## Configuration

By default, daily notes are created as `yyyy-mm-dd.md` in the workspace's `journals` folder.

To customize your daily note location and format you can create a `.foam/templates/daily-note.md` template. See [[templates]] for more information.

There are also some settings to customize the behavior of daily notes, but they are deprecated and will be removed. Please use the `daily-note.md` template.

To work with daily notes from the terminal, see [[daily|CLI daily command]].

[templates]: templates.md 'Note Templates'
[daily]: ../tools/cli/daily.md 'foam daily'
