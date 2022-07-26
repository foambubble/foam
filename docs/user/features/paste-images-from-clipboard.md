# Paste Images from Clipboard

By installing the [vscode-paste-image](https://github.com/mushanshitiancai/vscode-paste-image) extension, you can paste an image from the clipboard with `cmd+alt+v`.

Images are automatically copied to the `/attachments` folder and a reference is added in the file where you pasted them.

A prompt will ask you to confirm the name of the image, to disable it set `"pasteImage.showFilePathConfirmInputBox": false,` in the settings.

To change the location where the image is created, change the `pasteImage.path` property, e.g.:

- `${currentFileDir}`: save the image next to the file
- `${currentFileDir}/images`: create an `images` directory next to the file and save the image there
