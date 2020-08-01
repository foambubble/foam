# Migrating from OneNote

This guide mostly duplicates the instructions at the repo for the PowerShell [script](https://github.com/nixsee/ConvertOneNote2MarkDown).

## Usage

1. Start the OneNote application. All notebooks currently loaded in OneNote will be converted
2. It is advised that you install Onetastic and the attached macro, which will automatically expand any collapsed paragraphs in the notebook. They won't be exported otherwise.
    * To install the macro, click the New Macro Button within the Onetastic Toolbar and then select File -> Import and select the .xml macro included in the release.
    * Run the macro for each Notebook that is open
3. It is highly recommended that you use VS Code, and its embedded Powershell terminal, as this allows you to edit and run the script, as well as check the results of the .md output all in one window.
4. Whatever you choose, open a PowerShell terminal and navigate to the folder containing the script and run it.
    * if you receive an error, try running this line to bypass security:
     ```Set-ExecutionPolicy Bypass -Scope Process```
    * if you still have trouble, try running both Onenote and Powershell as an administrator.
5. It will ask you for the path to store the markdown folder structure. Please use an empty folder. If using VS Code, you might not be able to paste the filepath - right click on the blinking cursor and it will paste from clipboard. **Attention:** use a full absolute path for the destination.
6. Read the prompts carefully to select your desired options. If you aren't actively editing your pages in Onenote, it is HIGHLY recommended that you don't delete the intermediate word docs, as they take 80+% of the time to generate. They are stored in their own folder, out of the way. You can then quickly re-run the script with different parameters until you find what you like.
7. Sit back and wait until the process completes
8. To stop the process at any time, press Ctrl+C.
9. If you like, you can inspect some of the .md files prior to completion. If you're not happy with the results, stop the process, delete the .md and re-run with different parameters.
