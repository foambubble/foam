# LSP Architecture

## Information requirements

### Document Completion

- List of all files in the workspace
  - Name
  - Title
  - Short preview of content
  
### Anchor completion

- List of all headings in the workspace
- List of all paragraphs in the workspace
  - With full content
  - With context of where they are in the document
  - With hash ids
  - With document positions

## Link highlight

- All links
  - With positions

## Go to / peek link definition

- Get link at position
- Get link target document
- Get link target range

## Go to / peek references

- Get all links that point to file
- Get all links that point to section/id
- Get all instances of a hashtag

## Symbols

- Get all links in a document
- Get all hashtags in a document
- Get all block ids in a document