# multiful form repo Fast Switching & maintain

this #recipe is allow to multiful form repos in one VSCode Windows and Fast Switching. in my case, need seperated form repo, using 6 form repo. but it's very easy & convenience

## Installation

**This extension is not included in the template**

To install [Project Manager](https://marketplace.visualstudio.com/items?itemName=alefragnani.project-manager)

## Fast-switching repo in one folder
First, i recommand need arrange fast-switching repo in one folder

Second, VSCode's Extensnion setting, select arrange folder, and extension setting, assign to this folder.
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

That's it. if you need fast switching or maintained multiful form repo, click to left's folder icon and select fast switching your repo, and maintaing.