# Quickly switch between multiple Foam repos

this #recipe is allow to Quickly switch between multiple Foam repos.

## Installation

**This extension is not included in the template**

To install [Project Manager](https://marketplace.visualstudio.com/items?itemName=alefragnani.project-manager)

## Quickly switch between multiple Foam repos - Git Folder
First, Need arrange Quickly switching Multiful Foam repos in one folder

Second, In VSCode's Extensnion setting, select arrange folder, and extension setting, assign to this folder.
```Project Manager › Git: Base Folders```
```Indicates the base folders to search for Git projects```

or you can editing project manager's favorites. click to 'Edit Project' and editing ```Project.json``` like this
	{
		"name": "Foam",
		"rootPath": "/Users/hitchhiker/Foam",
		"paths": [],
		"group": "",
		"enabled": true
	},
    
This Part, **,** is need add to multiful Project. if end of project, deleted **,** and save the ```project.json```.  
That's it. if you need quickly switch between multiple Foam repos, click to left's folder icon and and maintaing or left's Git Part.
