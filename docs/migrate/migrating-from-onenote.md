# Migrating from OneNote

This guide mostly duplicates the instructions at the repo for the PowerShell [script](https://github.com/nixsee/ConvertOneNote2MarkDown).

## Summary

The powershell script 'ConvertOneNote2MarkDown-v2.ps1' will utilize the OneNote Object Model on your workstation to convert all OneNote pages to Word documents and then utilizes PanDoc to convert the Word documents to Markdown (.md) format. It will also:

* Create a folder structure for your Notebooks and Sections.
* Process pages that are in sections at the Notebook, Section Group and 1st Nested Section Group levels.
* Allow you you choose between putting all Images in a central '/media' folder for each notebook, or in a separate '/media' folder in each folder of the hierarchy.
* Fix image references in the resulting .md files, generating relative references to the image files within the markdown document.
* A title, description, and date header will be added to each file as well.
* And more (see details at repo)!

## Usage

1. Start the OneNote application. All notebooks currently loaded in [OneNote](https://getonetastic.com/download) will be converted.
2. It is advised that you install [Onetastic](https://getonetastic.com/download) and the attached macro, which will automatically expand any collapsed paragraphs in the notebook. They won't be exported otherwise.
    * To install the macro, click the New Macro Button within the Onetastic Toolbar and then select File -> Import and select the .xml macro included in the release.
    * Run the macro for each Notebook that is open
3. For the next sections, it is highly recommended that you use VS Code, and its embedded PowerShell terminal, as this allows you to edit and run the script, as well as check the results of the .md output all in one window.
4. Whatever you choose, you will need to do the following:
   1. Clone the script to your computer (see [here](https://git-scm.com/book/en/v2/Git-Basics-Getting-a-Git-Repository), if you're unfamiliar with git).
   2. Once cloned, navigate to the repo folder. In VS Code, use File -> Add Folder to Workspace, right click on the folder in the left side bar and click [Open In Integrated Terminal](assets/images/migrating-one-note.png).
   3. Run the script by executing
```.\ConvertOnenote2Markdown-v2```
    * if you receive an error, try running this line to bypass security:
     ```Set-ExecutionPolicy Bypass -Scope Process```
    * if you still have trouble, try running both Onenote and Powershell as an administrator.
5. It will ask you for the path to store the markdown folder structure. Please use an empty folder. If using VS Code, you might not be able to paste the filepath - right click on the blinking cursor and it will paste from clipboard. **Attention:** use a full absolute path for the destination.
6. Read the prompts carefully to select your desired options. If you aren't actively editing your pages in Onenote, it is HIGHLY recommended that you don't delete the intermediate word docs, as they take 80+% of the time to generate. They are stored in their own folder, out of the way. You can then quickly re-run the script with different parameters until you find what you like.
7. Sit back and wait until the process completes.
8. To stop the process at any time, press Ctrl+C.
9. If you like, you can inspect some of the .md files prior to completion. If you're not happy with the results, stop the process, delete the .md and re-run with different parameters.
10. At this point, you should be ready to load the new directory into Foam!
