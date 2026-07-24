# Releasing Foam

Foam uses [Changesets](https://github.com/changesets/changesets) to manage versions and changelogs across the monorepo (`foam-vscode`, `@foam/cli`, `@foam/core`). Each user-facing change should land on `main` together with a fragment in `.changeset/` declaring which packages it bumps and why.

## During development

Each PR that affects users of a published package should include a changeset fragment. Create it as part of the PR (not after merging):

```
yarn changeset
```

Pick the affected package(s) and bump type (`patch` / `minor` / `major`), then write the user-facing entry. Commit the generated `.changeset/<name>.md` alongside the code change in the same PR.

One changeset per PR is the norm. If a PR touches multiple packages, declare them together in a single fragment — changesets will bump each independently.

If a fragment was missed, the `/update-changelog` slash command can draft one retroactively for commits already on `main`.

### ⚠️ Changes to `@foam/core` must also bump its dependents

`foam-vscode` and `@foam/cli` both **bundle** `@foam/core` at build time (esbuild inlines it), and both declare it as a `devDependency` — not a runtime `dependency`. Because of that, Changesets' automatic internal-dependency bumping (`updateInternalDependencies`) does **not** cascade a `@foam/core` bump to them. It won't add the fragments for you.

So whenever a change touches `packages/foam-core`, the changeset must **also** include `foam-vscode` and `@foam/cli` (each usually `patch`), so their republished bundles ship with a correct version and a changelog entry. If you only bump `@foam/core`, the extension and CLI will silently publish updated code under a stale version number.

Rule of thumb: **if `@foam/core` is in the fragment, `foam-vscode` and `@foam/cli` almost always belong there too** — unless the core change is genuinely internal-only and reaches neither the extension nor the CLI.

## Cutting a release

1. Get to the latest code
   - `git checkout main && git fetch && git rebase`
2. Sanity checks
   - `yarn reset`
   - `yarn test`
3. Make sure every shipped change since the last release has a fragment in `.changeset/`
   - If not, run `yarn changeset` (or `/update-changelog`) and commit the missing fragments before continuing
   - **If any change touched `@foam/core`, confirm `foam-vscode` and `@foam/cli` are also covered by a fragment** (see the warning above). Their bundles pick up core changes at build time, but Changesets will not bump their versions automatically.
4. Apply the fragments — bumps versions in each affected `package.json`, regenerates `CHANGELOG.md`, and deletes the consumed fragments
   - `yarn version-packages`
5. Review and commit the result
   - Inspect the generated `CHANGELOG.md` and version bumps
   - Update `./packages/foam-vscode/WHATSNEW.md` if the extension changed meaningfully
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
