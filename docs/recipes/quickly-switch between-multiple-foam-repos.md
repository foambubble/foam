# Quickly switch between multiple Foam repos

This #recipe is allow to Quickly switch between multiple Foam repos. And sorry for Setting/Content's Hangul the Korean Character.

## Installation

**This extension is not included in the template**

This Method need [Project Manager](https://marketplace.visualstudio.com/items?itemName=alefragnani.project-manager) extension, so please install this extension.

## Quickly switch between multiple Foam repos - Git Folder
First, Needs the arrange Quickly switching Multiful Foam repos in one folder

<img width="1322" alt="스크린샷 2021-06-02 오전 10 05 29" src="https://user-images.githubusercontent.com/1904967/120408485-1af37c80-c38a-11eb-8454-713a63ba5c7b.png">
Second, In VSCode's Extensnion setting, select arrange folder, and extension setting, assign to target (Your Arranged Foam Repo) folder.

```Project Manager › Git: Base Folders```<br>
```Indicates the base folders to search for Git projects```

<img width="1322" alt="스크린샷 2021-06-02 오전 10 06 27" src="https://user-images.githubusercontent.com/1904967/120408569-41b1b300-c38a-11eb-8bc5-9c983600c0d8.png">
or you can editing project manager's favorites. Click to 'Edit Project' and editing Projects.json, like this.

```
	{
		"name": "Foam",
		"rootPath": "/Users/hitchhiker/Foam",
		"paths": [],
		"group": "",
		"enabled": true
	},
```

<img width="1120" alt="스크린샷 2021-06-02 오전 9 20 27" src="https://user-images.githubusercontent.com/1904967/120408615-5d1cbe00-c38a-11eb-9989-0f05f23bd1bb.png">
That's it. If you need quickly switch between multiple Foam repos, click to left folder's icon or Git part.