# Research Issue Command

Research a GitHub issue by analyzing the issue details and codebase to generate a comprehensive task analysis file.

## Usage

```
/research-issue <issue-number>
```

## Parameters

- `issue-number` (required): The GitHub issue number to research

## Description

This command performs comprehensive research on a GitHub issue by:

1. **Fetching Issue Details**: Uses `gh issue view` to get issue title, description, labels, comments, and related information
2. **Codebase Analysis**: Searches the codebase for relevant files, patterns, and components mentioned in the issue
3. **Root Cause Analysis**: Identifies possible technical causes based on the issue description and codebase findings
4. **Solution Planning**: Proposes two solution approaches ranked by preference
5. **Documentation**: Creates a structured task file in `.agent/tasks/<issue-id>-<sanitized-title>.md`

If there is already a `.agent/tasks/<issue-id>-<sanitized-title>.md` file, use it for context and update it accordingly.
If at any time during these steps you need clarifying information from me, please ask.

## Output Format

Creates a markdown file with:

- Issue summary and key details
- Research findings from codebase analysis
- Identified possible root causes
- Two ranked solution approaches with pros/cons
- Technical considerations and dependencies

## Examples

```
/research-issue 1234
/research-issue 567
```

## Implementation

The command will:

1. Validate the issue number and check if it exists
2. Fetch issue details using GitHub CLI
3. Search codebase for relevant patterns, files, and components
4. Analyze findings to identify root causes
5. Generate structured markdown file with research results
6. Save to `.agent/tasks/` directory with standardized naming

## Error Handling

- Invalid issue numbers
- GitHub CLI authentication issues
- Network connectivity problems
- File system write permissions
