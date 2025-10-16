# Creating Your First Workspace

A Foam workspace is where all your notes, ideas, and knowledge live. Think of it as your digital garden where thoughts can grow and connect. This guide will help you set up a workspace that's organized, scalable, and tailored to your thinking style.

## Understanding Workspaces

A Foam workspace is simply a folder containing **Markdown files** (`.md`) - your actual notes.

Optionally it can contain:

- **Configuration files** - VS Code settings and Foam preferences
- **Assets** - images, attachments, and other media
- **Templates** - reusable note structures

### Single vs. Multiple Workspaces

**Recommended: Single Workspace**

- Keep all your knowledge in one place
- Better link discovery and graph visualization
- Easier to maintain and backup
- Follows the "unified knowledge base" principle

**Deprecated: Multiple Workspaces** (deprecated - advanced users only)

- Separate professional and personal knowledge
- Isolate sensitive information
- Different workflows for different projects

Multiple workspaces are to be considered deprecated at this point, and might become unsupported in the future.
You can simulate a complex workspace by using file/folder links.

## Method 1: Using the Foam Template (Recommended)

The easiest way to start is with our pre-configured template:

### Step 1: Create from Template

1. **Visit** [github.com/foambubble/foam-template](https://github.com/foambubble/foam-template)
2. **Click "Use this template"** (you'll need a GitHub account)
3. **Name your repository** (e.g., "john-knowledge-base", "my-second-brain")
4. **Choose visibility:**
   - **Private** - for personal notes (recommended)
   - **Public** - if you want to share your knowledge openly

### Step 2: Clone Locally

```bash
git clone https://github.com/yourusername/your-repo-name.git
cd your-repo-name
```

### Step 3: Open in VS Code

1. **Launch VS Code**
2. **File > Open Folder**
3. **Select your cloned repository folder**

## Method 2: Start from Scratch

For a minimal setup:

1. **Create a new folder** on your computer
2. **Open the folder** in VS Code (`File > Open Folder`)

That's all, you can start working with your markdown files and Foam will take care of the rest.

## Ideas for your knowledge base

### 1. Customize Your Settings

Review and adjust `.vscode/settings.json` based on your preferences:

- **Daily notes location** - where your daily notes are stored
- **Image handling** - how pasted images are organized
- **Link format** - with or without file extensions

### 2. Set Up Your Inbox

Create `inbox.md` as your default capture location:

```markdown
# Inbox

Quick notes and ideas go here before being organized.

## Today's Captures

-

## To Process

-

## Ideas

-
```

### 3. Create Core Structure Notes

## Workspace Organization Strategies

Establish your main organizational notes.
You can use any methodology, Foam is not opinionated.

The only recommendation is to get started, you can improve later.

The two main methods adopted by users are [PARA](https://fortelabs.com/blog/para/) and [Zettelkasten](https://zettelkasten.de/overview/).

### The PARA Method

Organize around four categories:

- **Projects** - Things with deadlines
- **Areas** - Ongoing responsibilities
- **Resources** - Future reference materials
- **Archive** - Inactive items

### Zettelkasten Approach

Number-based system for atomic ideas:

- **Permanent notes** - `202501251030-idea-title.md`
- **Literature notes** - `book-author-year.md`
- **Index notes** - `index-topic.md`

### 4. Configure Daily Notes

Daily notes are perfect for:

- Daily planning and reflection
- Meeting notes
- Journal entries
- Quick captures

Test your daily notes setup:

1. **Press `Ctrl+Shift+P` / `Cmd+Shift+P`**
2. **Type "Foam: Open Daily Note"**
3. **Verify the note is created in the right location**

Alternatively you can press `Alt+D` to open today's daily note, or `Alt+H` to open another day's daily note.
Use the `.foam/templates/daily-note.md` to customize your daily note.

## Best Practices for New Workspaces

### 1. Start Small

- Begin with just a few notes
- Don't over-organize initially
- Let structure emerge naturally

### 2. Use Templates

- Create templates for common note types
- Maintain consistency across similar notes
- Save time on repetitive formatting

### 3. Link Early and Often

- Use `[[wikilinks]]` liberally
- Don't worry about creating "perfect" links
- Foam handles broken links gracefully

### 4. Regular Reviews

- Weekly workspace cleanup
- Archive completed projects
- Identify missing connections

## Syncing and Backup

Foam works on simple files, you can add whatever backup method you prefer on top of it.

### Git

Your workspace is a Git repository:

```bash
git add .
git commit -m "Add new notes and ideas"
git push origin main
```

You can also use other VS Code extensions to manage the git synching if that's helpful.

### Alternative Sync Methods

- **Cloud storage** - Dropbox, OneDrive, Google Drive
- **Local backup** - Time Machine, File History
- **Manual export** - Regular ZIP backups

## What's Next?

With your workspace set up, you're ready to:

1. **[Learn note-taking fundamentals](note-taking-in-foam.md)** - Master Markdown and writing effective notes
2. **[Explore navigation](navigation.md)** - Connect your thoughts with wikilinks
3. **[Discover the graph view](../features/graph-view.md)** - Visualize your knowledge network
4. **[Set up templates](../features/templates.md)** - Standardize your note creation process

## Getting Help

If you encounter setup issues:

- Check the [Installation Guide](installation.md) for prerequisites
- Visit the [FAQ](../faq.md) for common workspace problems
- Join the [Foam Community Discord](https://foambubble.github.io/join-discord/w)
