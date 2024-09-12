# Capture Notes With Shortcuts and GitHub Actions

With this #recipe you can create notes on your iOS device, which will automatically be imported into Foam.

## Context

* You use [Foam for VSCode](https://marketplace.visualstudio.com/items?itemName=foam.foam-vscode) to manage your notes
* You wish to adopt a practice such as [A writing inbox for transient and incomplete notes](https://notes.andymatuschak.org/A%20writing%20inbox%20for%20transient%20and%20incomplete%20notes)
* You wish to use [Shortcuts](https://support.apple.com/guide/shortcuts/welcome/ios) to capture quick notes into your Foam notes from your iOS device

## Other tools

* We assume you are familiar with how to use GitHub (if you are using Foam this is implicit)
* You have an iOS device.

## Instructions

1. Setup the [`foam-capture-action`]() in your GitHub Repository, to be triggered by "Workflow dispatch" events.

```
name: Manually triggered workflow
on:
  workflow_dispatch:
    inputs:
      data:
        description: 'What information to put in the knowledge base.'
        required: true

jobs:
  store_data:
    runs-on: ubuntu-latest
    # If you encounter a 403 error from a workflow run, try uncommenting the following 2 lines (taken from: https://stackoverflow.com/questions/75880266/cant-make-push-on-a-repo-with-github-actions accepted answer)
    # permissions:
          # contents: write
    steps:
    - uses: actions/checkout@master
    - uses: anglinb/foam-capture-action@main
      with:
        {% raw %}
        capture: ${{ github.event.inputs.data }}
        {% endraw %}
    - run: |
        git config --local user.email "example@gmail.com"
        git config --local user.name "Your name"
        git commit -m "Captured from workflow trigger" -a
        git push -u origin master
```

2. In GitHub [create a Personal Access Token](https://github.com/settings/tokens) and give it `repo` scope - make a note of the token
3. Run this command to find your `workflow-id` to be used in the Shortcut.

```bash
curl \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Authorization: Bearer <GITHUB_TOKEN>" \
    https://api.github.com/repos/<owner>/<repository>/actions/workflows
```

4. Copy this [Shortcut](https://www.icloud.com/shortcuts/57d2ed90c40e43a5badcc174ebfaaf1d) to your iOS devices and edit the contents of the last step, `GetContentsOfURL`
   - Make sure you update the URL of the shortcut step with the `owner`, `repository`, `workflow-id` (from the previous step)
   - Make sure you update the headers of the shortcut step, replaceing `[GITHUB_TOKEN]` with your Personal Access Token (from step 2)

5. Run the shortcut & celebrate! ✨ (You should see a GitHub Action run start and the text you entered show up in `inbox.md` in your repository.)
