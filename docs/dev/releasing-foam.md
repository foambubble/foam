# Releasing Foam

Foam uses [Changesets](https://github.com/changesets/changesets) to manage versions and changelogs across the monorepo (`foam-vscode`, `@foam/cli`, `@foam/core`). Changesets owns the arithmetic — which package gets which bump, and assembling `CHANGELOG.md`. Deciding _what_ to write is covered by the [changelog rules](#changelog-rules) below.

## Writing changesets

Fragments are written at release time, reconstructed from the history on `main` since the last release: see [Generating fragments from git history](#generating-fragments-from-git-history). Changes don't carry them, so a pull request leaves `.changeset/` alone.

### ⚠️ Changes to `@foam/core` must also bump its dependents

`foam-vscode` and `@foam/cli` both **bundle** `@foam/core` at build time (esbuild inlines it), and both declare it as a `devDependency` — not a runtime `dependency`. Because of that, Changesets' automatic internal-dependency bumping (`updateInternalDependencies`) does **not** cascade a `@foam/core` bump to them. It won't add the fragments for you.

So whenever a change touches `packages/foam-core`, the changeset must **also** include `foam-vscode` and `@foam/cli` (each usually `patch`), so their republished bundles ship with a correct version and a changelog entry. If you only bump `@foam/core`, the extension and CLI will silently publish updated code under a stale version number.

Rule of thumb: **if `@foam/core` is in the fragment, `foam-vscode` and `@foam/cli` almost always belong there too** — unless the core change is genuinely internal-only and reaches neither the extension nor the CLI.

## Changelog rules

### Does the change need a fragment?

Yes, if it changes behavior that users of a published package can observe: `foam-vscode`, `@foam/cli`, `@foam/core`. (`@foam/graph-view`, `@foam/mcp` and `@foam/agent-loop` are listed under `ignore` in `.changeset/config.json` and never get fragments.)

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

The entry is read by users, not by developers. Make it as short as it can be while still telling them what changed: usually one line, rarely more than two sentences.

- Say what changed, not why it was broken or how it was fixed. Causes, mechanisms and internal names belong in the commit message.
- If behavior narrowed, say so, and say what to do instead.
- Name a changed API only in a `@foam/core` entry, and only name it.
- Several related fixes can share one entry as a list, one line per item.
- Reference the issue number when there is one, as `(#1215)`.
- Don't reuse the commit subject verbatim — commit subjects are written for developers.

For example:

```markdown
Notes in folders listed in `files.watcherExclude` are no longer left out of the workspace. To exclude a folder, use `foam.files.exclude`.
```

not a paragraph on what `files.watcherExclude` is for, why honouring it saved no CPU, and how the CLI differed.

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
     - The script reads each package's current version from `package.json`, skips any tag that already exists, and prints the command to push the new ones.
6. Push and publish

   - `git push`
   - Push the tags with the command `yarn tag-release` printed, e.g. `git push origin vscode@0.47.2 cli@0.48.0`. Each tag starts the [Release workflow](../../.github/workflows/release.yml), which publishes that package:

     - `cli@` to npm as `foam-cli`
     - `core@` to npm as `foam-core`
     - `vscode@` to the VS Code Marketplace and Open VSX, once the Marketplace trusted publisher exists. Until then a `vscode@` tag starts nothing, so publish the extension from your machine with the login `vsce login` stored, which stops working on 1 December 2026:

       ```
       yarn workspace foam-vscode clean
       yarn workspace foam-vscode build:node --production
       yarn workspace foam-vscode build:web --production
       yarn workspace foam-vscode package
       cd packages/foam-vscode
       npx @vscode/vsce@3.6.0 publish --packagePath foam-vscode-<version>.vsix
       npx ovsx@1.3.0 publish foam-vscode-<version>.vsix -p $OPENVSX_TOKEN
       ```

   - Don't use `git push --tags`: GitHub starts no workflow for a push of more than three tags, so one stray local tag means nothing publishes.
   - Check the runs in the Actions tab. A failed run can be re-run; a registry that already has the version is skipped.

7. Update the release notes in GitHub
   - In GitHub, top right, click on "releases"
   - Select "tags" in top left
   - Select the tag that was just released, click "edit" and copy release information from `CHANGELOG.md`
   - Publish (no need to attach artifacts)
8. Announce on Discord

## Publishing setup

The Release workflow stores no tokens. Each registry trusts `.github/workflows/release.yml` in `foambubble/foam`, running in the `release` environment, through OIDC (trusted publishing). Renaming the workflow file or the environment breaks publishing until every entry below is updated. Each entry takes owner `foambubble`, repository `foam`, workflow `release.yml` and environment `release`:

- **VS Code Marketplace:** on the [publisher management page](https://marketplace.visualstudio.com/manage), publisher `foam` → Trusted Publishing.
- **Open VSX:** [Trusted Publishers](https://open-vsx.org/user-settings/trusted-publishers), namespace `foam`.
- **npm:** on `foam-cli` and on `foam-core`, Settings → Trusted publisher → GitHub Actions. A new entry expires unless it publishes within two days, so add it just before that package's next release.

Two GitHub settings decide who can publish:

- **The `release` environment** (Settings → Environments) lets only tags matching `vscode@*`, `cli@*` and `core@*` deploy to it, with no required reviewers. The registries trust a run by its workflow file name, not by what triggered it. Without the environment, anyone with write access could publish from a branch that runs an edited `release.yml`.
- **A tag ruleset** (Settings → Rules → Rulesets) restricts creating, updating and deleting those tags to the maintainers. A tag push runs the workflow as it is in the tagged commit, so whoever can push a release tag can publish.
