# Releasing Foam

1. Get to the latest code
   - `git checkout master && git fetch && git rebase`
2. Sanity checks
   - `yarn reset`
   - `yarn test`
3. Update change log 
   - `./packages/foam-vscode/CHANGELOG.md`
   - `git add *`
   - `git commit -m"Preparation for next release"`
4. Update version
   - `$ cd packages/foam-vscode`
   - `foam-vscode$ yarn lerna version <version>` (where `version` is `patch/minor/major`) 
   - `cd ../..`
5. Package extension
   - `$ yarn vscode:package-extension`
6. Publish extension
   - `$ yarn vscode:publish-extension`
7. Update the release notes in GitHub
   - in GitHub, top right, click on "releases"
   - select "tags" in top left
   - select the tag that was just released, click "edit" and copy release information from changelog
   - publish (no need to attach artifacts)
8. Annouce on Discord

Steps 1 to 6 should really be replaced by a GitHub action...