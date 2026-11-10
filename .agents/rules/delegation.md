---
trigger: always_on
---

# Delegation & Context Optimization Policy

## 1. Subagent Delegation First (Default)
- **Always delegate** file reads, file edits, code refactoring, and terminal commands to subagents (`hands`, `research`, `code-auditor`, `github-publisher`) to conserve tokens in the main conversation context.
- Keep the main conversation loop clean and high-level: coordinate planning, synthesize outputs, and manage overarching architecture.
- For multi-file implementations, large-scale refactors, or template generation tasks, spawn parallel `hands` subagents to execute changes concurrently.

## 2. Subagent Roles & Usage
- **`hands`** (`flash`): Execute all file reads, edits, writes, and local verification/build commands. Launch multiple `hands` instances in parallel for multi-file edits or multi-template creation tasks.
- **`research`** (`flash`): Conduct broad workspace codebase searches, external doc lookups, and deep code investigations.
- **`code-auditor`** (`flash`): Perform static analysis, lint verification, design system audits, and QA checks before commits or releases.
- **`github-publisher`** (`flash`): Handle git commits, branch management, PR creation, and publishing changes to GitHub.
