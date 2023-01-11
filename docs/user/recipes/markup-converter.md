# Markup Converter

This #recipe allows you to convert any document into Markdown for storing them in your notes.

We will be using [Pandoc](https://pandoc.org/), a popular universal document converter. It can convert documents in Microsoft Word, HTML, LaTeX, and many other formats to various formats including markdown and many others.

## Instructions

We will go through the example of converting Microsoft Word documents to Markdown. For detailed instructions on how to use Pandoc, please refer to the [Pandoc documentation](https://pandoc.org/MANUAL.html).

1. [Install Pandoc](https://pandoc.org/installing.html)
1. Open the terminal of your choice and verify that Pandoc is installed by running `pandoc --version`
1. Copy the Microsoft Word documents that you want to convert into a new folder
1. Change the current directory to the folder containing the Microsoft Word documents
1. Copy one of the following commands (based on your operating system) into your terminal and press `Enter` to run

### Linux and macOS (Bash)

```bash
find -name "*.docx" -type f -exec sh -c '
      for f; do
         pandoc --extract-media=./ -f docx -t markdown -o "${f%.*}.md" "$f"
      done
   ' find-sh {} +
```

### Windows (PowerShell)

```powershell
Get-ChildItem . -Filter *.docx | 
Foreach-Object {
    pandoc --extract-media=./ --from docx --to markdown $_ -o $_.Name.Replace('.docx', '.md')
}
```

### Relevant Configurations

[Pandoc](https://pandoc.org/) accepts a range of command line arguments to control the conversion process. Here, we'll mention a few that are relevant to the example above.

- `--extract-media=./` is used to extract the images from the Microsoft Word documents and store them in a subfolder named `media`
- `-t markdown` converts the Microsoft Word documents to [Pandoc’s Markdown](https://pandoc.org/MANUAL.html#pandocs-markdown). You can also use `-t gfm` to convert to [GitHub Flavored Markdown](https://docs.github.com/en/get-started/writing-on-github)

Note that you may want to review the converted Markdown files to ensure that the conversion was successful. Then, You may want to delete the original Microsoft Word documents.
