# Releasing Foam

1. Get to the latest code
   - `git checkout main && git fetch && git rebase`
2. Sanity checks
   - `yarn reset`
   - `yarn test`
3. Update change log
   - `./packages/foam-vscode/CHANGELOG.md`
   - `git add *`
   - `git commit -m"Preparation for next release"`
4. Update version
   - `$ yarn version-extension <version>` (where `version` is `patch/minor/major`)
5. Package extension
   - `$ yarn package-extension`
6. Publish extension
   - `$ yarn publish-extension`
7. Update the release notes in GitHub
   - in GitHub, top right, click on "releases"
   - select "tags" in top left
   - select the tag that was just released, click "edit" and copy release information from changelog
   - publish (no need to attach artifacts)
8. Announce on Discord

Steps 1 to 6 should really be replaced by a GitHub action...
