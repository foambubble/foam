# Prepare PR Command

Analyze the current branch changes and generate:

- a PR title
- a PR description
- considerations for the developer before pushing the PR

Output the title and description ready to paste into GitHub.

## PR TITLE

Use format: `type(scope): description`

- type: feat/fix/refactor/perf/docs/chore
- Keep under 72 characters
- Be specific but brief

## PR DESCRIPTION

It should have these sections (use a paragraph per section, no need to title them).
CONSTRAINTS:

- 100-200 words total
- No file names or "updated X file" statements
- Active voice
- No filler or pleasantries
- Focus on WHAT and WHY, not HOW

### What Changed

List 2-4 changes grouped by DOMAIN, not files. Focus on:

- User-facing changes
- Architectural shifts
- API changes
  Skip trivial updates (formatting, minor refactors).

### Why

One sentence explaining motivation (skip if obvious from title).

### Critical Notes

ONLY include if relevant:

- Breaking changes
- Performance impact
- Security implications
- New dependencies
- Required config/env changes
- Database migrations

If no critical notes exist, omit this section.

## Considerations

Run the `yarn lint` command and report any failures.
Also analize the changeset, and act as a PR reviewer to provide comments about the changes.
