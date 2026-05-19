# Foam Notes Agent Skill

This #recipe describes how to use [foam-notes](https://github.com/Hegghammer/foam-notes), an [AgentSkills](https://agentskills.io/specification)-compatible skill that lets AI coding assistants work with your Foam notes.

## Supported Assistants

- [Claude Code](https://claude.com/product/claude-code)
- [Codex](https://openai.com/codex/)
- [OpenCode](https://opencode.ai)
- Any other assistant that supports the AgentSkills format

## Features

- Create, edit, delete, and rename notes
- Intelligent wikilink and tag suggestions
- Backlinks discovery
- Daily notes and templates
- Graph visualization
- Full Foam documentation included for easy querying

## Installation

Clone the skill repository into your assistant's skill folder:

```bash
git clone https://github.com/Hegghammer/foam-notes.git
```

The location of the skill folder depends on your assistant:

- **Claude Code**: `.claude/skills/`
- **OpenCode**: `.opencode/skills/`
- **Codex**: `.codex/skills/`

Refer to your assistant's documentation for details.

## Usage

Once installed, the skill is automatically available to your assistant. You can ask it to create new notes, edit existing ones, suggest wikilinks and tags, find backlinks, and more. If you find that the skill doesn't do quite what you want, just have the agent modify the skill for you. 
