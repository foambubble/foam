# Azure DevOps Wiki

You can publish your Foam pages as Azure DevOps wiki.

[Azure DevOps](https://azure.microsoft.com/en-us/services/devops/) is Microsoft's collaboration software for software development teams, formerly known as Team Foundation Server (TFS) and Visual Studio Team Services. It is available as on-premise and SaaS versions. Following recipe was tested with SaaS version, but should work in-premise the same way.

Following recipe is written in assumption that you already have Azure DevOps project.

## Setup a Foam workspace

Generate a Foam workspace using the [foam-template project](https://github.com/foambubble/foam-template). Change the remote to git repository in Azure DevOps, or copy all the files into a new Azure DevOps git repository.

Define which document will be the wiki default page. To do that, create file with name `.order` in workspace root folder, with first line being document filename without `.md` extension. For project created from template, file would look like this:

```
readme
```
Push repository to remote in Azure DevOps.

## Publish repository to a wiki

Process is better described in [Azure DevOps documentation](https://docs.microsoft.com/en-us/azure/devops/project/wiki/publish-repo-to-wiki). Navigate to your Azure DevOps project in web browser, choose **Overview** > **Wiki**. If you don't have wikis for your project, choose **Publish code as a wiki** on welcome page. Choose repository with your Foam workspace, branch (usually `master`), folder (for workspace created from foam-template it is `/`), and wiki name, and press **Publish**.

Published workspace would look like this

![Azure DevOps wiki](assets/images/azure-devops-wiki-demo.png)

There is default TOC pane to the left of the wiki content. Here are listed all directories that present in Foam workspace, and all wiki pages. Pages names are derived from files names, and they are listed in alphabetical order. You may reorder pages by adding filenames without `.md` extension to `.order` file. Note that first entry in `.order` file defines wiki's home page.
