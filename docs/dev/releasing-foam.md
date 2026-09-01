# Releasing Foam

Foam uses [Changesets](https://github.com/changesets/changesets) to manage versions and changelogs across the monorepo (`foam-vscode`, `@foam/cli`, `@foam/core`). Changesets owns the arithmetic — which package gets which bump, and assembling `CHANGELOG.md`. Deciding _what_ to write is covered by the [changelog rules](#changelog-rules) below.

## Writing changesets

A fragment can be written two ways, both fine:

- **With the change**, as part of the PR:

  ```
  yarn changeset
  ```

  Pick the affected package(s) and bump type (`patch` / `minor` / `major`), then write the user-facing entry.

- **At release time**, reconstructed from `git log` since the last release — Changesets bumps each independently.

### ⚠️ Changes to `@foam/core` must also bump its dependents

`foam-vscode` and `@foam/cli` both **bundle** `@foam/core` at build time (esbuild inlines it), and both declare it as a `devDependency` — not a runtime `dependency`. Because of that, Changesets' automatic internal-dependency bumping (`updateInternalDependencies`) does **not** cascade a `@foam/core` bump to them. It won't add the fragments for you.

So whenever a change touches `packages/foam-core`, the changeset must **also** include `foam-vscode` and `@foam/cli` (each usually `patch`), so their republished bundles ship with a correct version and a changelog entry. If you only bump `@foam/core`, the extension and CLI will silently publish updated code under a stale version number.

Rule of thumb: **if `@foam/core` is in the fragment, `foam-vscode` and `@foam/cli` almost always belong there too** — unless the core change is genuinely internal-only and reaches neither the extension nor the CLI.

## Changelog rules

### Does the change need a fragment?

Yes, if it changes behavior that users of a published package can observe: `foam-vscode`, `@foam/cli`, `@foam/core`. (`@foam/graph-view` and `@foam/mcp` are listed under `ignore` in `.changeset/config.json` and never get fragments.)

No, for:

- documentation, `CLAUDE.md`, `.agent/` specs
- test-only commits — the change they cover carries the fragment
- refactors with no user-visible effect and no public API change
- build and tooling changes that don't alter what ships

### Which bump?

Foam is pre-1.0, so these are conventions rather than strict semver:

| Bump    | `@foam/core`                                                                   | `foam-vscode` / `@foam/cli`                             |
| ------- | ------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `major` | reserved — decide deliberately                                                 | reserved — decide deliberately                          |
| `minor` | new or changed public API surface (new export, new subpath, changed signature) | new user-facing feature                                 |
| `patch` | bug fix, security fix, internal change that still ships                        | bug fix, security fix, manifest or user-facing copy fix |

When several commits fold into one fragment, use the highest bump any of them warrants.

### Writing the entry

The entry is read by users, not by developers.

- Lead with the observable outcome, not the implementation.
- Say what someone should now expect. If behavior narrowed, say so explicitly.
- Reference the issue number when there is one, as `(#1215)`.
- Keep it to one or a couple sentences. The reasoning belongs in the commit message.
- Don't reuse the commit subject verbatim — commit subjects are written for developers.

## Generating fragments from git history

At release time, for anything that shipped without a fragment:

1. List what landed since the last release (tags are `vscode@<version>`, `cli@<version>`, `core@<version>`):

   ```
   git log vscode@<last-version>..HEAD --oneline
   ```

2. Group the commits into coherent user-facing changes. Several commits (a fix, its tests, a docs touch-up) usually become one fragment; occasionally one commit becomes two.
3. For each group apply the rules above: does it need a fragment, which packages, which bump, and what does the user need to know.
4. Apply the core cascade rule to every fragment that names `@foam/core`.
5. Write each one as `.changeset/<kebab-case-name>.md`:

   ```markdown
   ---
   'foam-vscode': patch
   ---

   The entry text.
   ```

The `/update-changelog` slash command can draft these for commits already on `main`.

Fragments don't need to be committed before `yarn version-packages` runs — it reads them off disk. Committing them first is still worthwhile if you want the intent recorded independently of the generated changelog.

Nothing in CI enforces any of this; it's a review-time and release-time responsibility.

## Cutting a release

1. Get to the latest code
   - `git checkout main && git fetch && git rebase`
2. Sanity checks
   - `yarn reset`
   - `yarn test`
3. Make sure every shipped change since the last release has a fragment in `.changeset/`
   - If not, write the missing ones — see [Generating fragments from git history](#generating-fragments-from-git-history)
   - **If any change touched `@foam/core`, confirm `foam-vscode` and `@foam/cli` are also covered by a fragment** (see the warning above). Their bundles pick up core changes at build time, but Changesets will not bump their versions automatically.
4. Apply the fragments — bumps versions in each affected `package.json`, regenerates `CHANGELOG.md`, and deletes the consumed fragments
   - `yarn version-packages`
5. Review and commit the result
   - Inspect the generated `CHANGELOG.md` and version bumps
   - Update `./packages/foam-vscode/WHATS_NEW.md` if the release has something users should act on or learn to use. It is shown on update when its _content hash_ changes, so leaving it untouched shows nothing — appropriate for a release with no new features.
   - `git add -A && git commit -m "Release"`
   - `yarn tag-release` - Create per-package tags (`vscode@<version>`, `cli@<version>`, `core@<version>`):
     - The script reads each package's current version from `package.json` and skips any tag that already exists.
6. Publish
   - `yarn release` to release them all, otherwise
     - `yarn release-extension` (packages and publishes to VS Marketplace and OpenVSX)
     - `yarn release-cli` (packages and publishes `@foam/cli` to npm as `foam-cli`)
     - `yarn release-core` (publishes `@foam/core` to npm)
7. Push
   - `git push && git push --tags`
8. Update the release notes in GitHub
   - In GitHub, top right, click on "releases"
   - Select "tags" in top left
   - Select the tag that was just released, click "edit" and copy release information from `CHANGELOG.md`
   - Publish (no need to attach artifacts)
9. Announce on Discord

Steps 1 to 8 should really be replaced by a GitHub action...
