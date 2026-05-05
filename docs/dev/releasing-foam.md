# Releasing Foam

Foam uses [Changesets](https://github.com/changesets/changesets) to manage versions and changelogs across the monorepo (`foam-vscode`, `@foam/cli`, `@foam/core`). Each user-facing change should land on `main` together with a fragment in `.changeset/` declaring which packages it bumps and why.

## During development

When merging a PR, add a changeset fragment describing the change:

```
yarn changeset
```

Pick the affected package(s) and bump type (`patch` / `minor` / `major`), then write the user-facing entry. Commit the generated `.changeset/<name>.md` alongside the change.

The `/update-changelog` slash command can draft fragments retroactively for commits already on `main` that lack one.

## Cutting a release

1. Get to the latest code
   - `git checkout main && git fetch && git rebase`
2. Sanity checks
   - `yarn reset`
   - `yarn test`
3. Make sure every shipped change since the last release has a fragment in `.changeset/`
   - If not, run `yarn changeset` (or `/update-changelog`) and commit the missing fragments before continuing
4. Apply the fragments — bumps versions in each affected `package.json`, regenerates `CHANGELOG.md`, and deletes the consumed fragments
   - `yarn version-packages`
5. Review and commit the result
   - Inspect the generated `CHANGELOG.md` and version bumps
   - Update `./packages/foam-vscode/WHATSNEW.md` if the extension changed meaningfully
   - `git add -A && git commit -m "Release"`
   - Create per-package tags (`vscode@<version>`, `cli@<version>`, `core@<version>`):
     - `yarn tag-release`
     - The script reads each package's current version from `package.json` and skips any tag that already exists.
6. Package the extension
   - `yarn package-extension`
7. Publish
   - `yarn publish-extension` (publishes to VS Marketplace and OpenVSX)
   - `yarn publish-cli` (publishes `@foam/cli` to npm as `foam-cli`)
8. Push
   - `git push && git push --tags`
9. Update the release notes in GitHub
   - In GitHub, top right, click on "releases"
   - Select "tags" in top left
   - Select the tag that was just released, click "edit" and copy release information from `CHANGELOG.md`
   - Publish (no need to attach artifacts)
10. Announce on Discord

Steps 1 to 8 should really be replaced by a GitHub action...
