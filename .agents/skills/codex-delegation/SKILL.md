---
name: codex-delegation
description: Autonomous headless delegation of coding, refactoring, test generation, and deep algorithmic tasks to OpenAI Codex CLI (`codex exec` with gpt-6-luna).
---

# Codex Automated / Headless Delegation

This skill provides instructions, patterns, and a robust PowerShell wrapper for delegating demanding engineering tasks from Antigravity agents directly to the OpenAI Codex CLI running `gpt-6-luna`.

---

## 1. Overview & Capabilities

The OpenAI Codex CLI is a local coding agent powered by `gpt-6-luna` that can autonomously execute shell commands, edit files, generate tests, and solve algorithmic challenges.

### Key Highlights
- **Model**: `gpt-6-luna` with configurable reasoning effort (`low`, `medium`, `high`).
- **Authentication**: Seamless local authentication via `~/.codex/auth.json` managed by OpenAI Codex CLI. No manual API keys need to be injected during delegation turns.
- **Subcommand**: `codex exec` is the non-interactive, headless entry point.
- **Sandboxing**: Fine-grained sandbox policies (`read-only` vs `workspace-write`).
- **Clean Output**: Native support for `--output-last-message` to extract pure code/answers without terminal control characters or session banners.

---

## 2. Environment & Critical Execution Rules

### Path Configuration
The Codex CLI binary wrapper is installed globally at:
`C:\home\kash\.npm-global`

Before invoking `codex`, prepend this path to the execution environment:
```powershell
$env:PATH = "C:\home\kash\.npm-global;" + $env:PATH
```

### Critical Rule: Stdin Piping to Prevent Terminal Freezing
> [!CAUTION]
> In headless agent environments, invoking `codex exec` with a prompt argument without piped stdin can cause the process to hang indefinitely waiting for interactive input (`Reading additional input from stdin...`).
>
> **Always pipe the prompt via standard input with a clean EOF**, terminating the input stream immediately. Use the trailing `-` argument to indicate that instructions are provided via stdin.

### Ephemeral Execution
Always include `--ephemeral` in automated delegations. This prevents cluttering the local session database (`~/.codex/sessions`) with temporary agent-to-agent delegation runs.

---

## 3. Helper Script: `invoke-codex.ps1`

To eliminate boilerplate, handle stdin piping safely, and parse outputs cleanly, use the bundled PowerShell helper script:
`e:\store254\.agents\skills\codex-delegation\scripts\invoke-codex.ps1`

### Script Syntax
```powershell
powershell -ExecutionPolicy Bypass -File "e:\store254\.agents\skills\codex-delegation\scripts\invoke-codex.ps1" `
    -Prompt "<instructions>" `
    -Sandbox <read-only | workspace-only> `
    -Effort <low | medium | high> `
    [-WorkDir "<path>"] `
    [-PassThru] `
    [-RawOutput]
```

### Parameters
| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `-Prompt` | `string` | *(Mandatory)* | The prompt or task instructions (supports pipeline input). |
| `-Sandbox` | `string` | `'read-only'` | `'read-only'` (safe analysis) or `'workspace-only'` (file edits). |
| `-Effort` | `string` | `'low'` | Reasoning effort for `gpt-6-luna`: `'low'`, `'medium'`, or `'high'`. |
| `-WorkDir` | `string` | Current dir | Working directory for Codex context and workspace operations. |
| `-PassThru` | `switch` | `False` | Returns structured object `@{ Result, Stdout, Stderr, ExitCode, Success }`. |
| `-RawOutput` | `switch` | `False` | Returns full stdout transcript instead of the isolated final answer. |

---

## 4. Delegation Recipes

### Recipe A: Complex Logic & Algorithm Implementation
**Use Case:** Designing state machines, parsers, scheduling algorithms, or math-heavy business logic (e.g., tax calculation, currency rounding, inventory reconciliation).

```powershell
$prompt = @"
We need an optimized rate limiter in TypeScript implementing the token bucket algorithm with sliding-window smoothing.
Requirements:
1. Implement in 'src/utils/rateLimiter.ts'.
2. Provide strict TypeScript typings, zero external runtime dependencies.
3. Include unit tests in 'tests/rateLimiter.test.ts'.
"@

powershell -ExecutionPolicy Bypass -File "e:\store254\.agents\skills\codex-delegation\scripts\invoke-codex.ps1" `
    -Prompt $prompt `
    -Sandbox workspace-only `
    -Effort high
```

---

### Recipe B: Automated Test Generation
**Use Case:** Generating exhaustive test suites covering edge cases, network timeouts, boundary values, and mock assertions.

```powershell
$prompt = @"
Analyze 'src/services/orderService.ts'.
Generate exhaustive Vitest test cases in 'src/services/__tests__/orderService.spec.ts':
- Valid orders with mixed tax rates
- Out of stock exceptions
- Concurrent inventory depletion race conditions
- Mocking db client failures
"@

powershell -ExecutionPolicy Bypass -File "e:\store254\.agents\skills\codex-delegation\scripts\invoke-codex.ps1" `
    -Prompt $prompt `
    -Sandbox workspace-only `
    -Effort medium
```

---

### Recipe C: Deep Debugging & Stack Trace Diagnosis
**Use Case:** Analyzing intricate error logs, unhandled promise rejections, memory leaks, or race conditions without modifying workspace files.

```powershell
$errorLog = Get-Content "logs/error.log" -Raw
$prompt = @"
Diagnose this crash log and stack trace:
$errorLog

Explain the root cause, identify the offending file and line numbers, and suggest the exact minimal patch.
"@

$diagnosis = powershell -ExecutionPolicy Bypass -File "e:\store254\.agents\skills\codex-delegation\scripts\invoke-codex.ps1" `
    -Prompt $prompt `
    -Sandbox read-only `
    -Effort high

Write-Output $diagnosis
```

---

### Recipe D: Strict TypeScript & Schema Refactoring
**Use Case:** Eliminating `any` types, enforcing discriminated unions, updating Prisma or Zod schemas, and propagating breaking interface changes across the workspace.

```powershell
$prompt = @"
Refactor 'src/types/models.ts' and related API handlers:
1. Replace all 'any' types with strict discriminated unions.
2. Add Zod validation schemas for all incoming API payloads.
3. Update consumers in 'src/api/' to ensure strict TypeScript compilation passes without errors.
"@

powershell -ExecutionPolicy Bypass -File "e:\store254\.agents\skills\codex-delegation\scripts\invoke-codex.ps1" `
    -Prompt $prompt `
    -Sandbox workspace-only `
    -Effort medium
```

---

### Recipe E: Impartial Code Review & Security Audit
**Use Case:** Running a thorough security and performance audit against git diffs or specific critical modules before merging.

```powershell
$diff = git diff HEAD~1
$prompt = @"
Perform an impartial senior security and performance review of this diff:
$diff

Check for:
1. Injection vulnerabilities (SQL, NoSQL, Command)
2. Broken access controls or IDOR
3. Inefficient queries (N+1) or unindexed operations
4. Unhandled error paths
Provide concrete fixes for any identified flaw.
"@

$review = powershell -ExecutionPolicy Bypass -File "e:\store254\.agents\skills\codex-delegation\scripts\invoke-codex.ps1" `
    -Prompt $prompt `
    -Sandbox read-only `
    -Effort medium

Write-Output $review
```

---

## 5. Direct Raw Command Reference

If invoking the CLI directly without the helper script, use the following pattern:

```powershell
# 1. Add PATH
$env:PATH = "C:\home\kash\.npm-global;" + $env:PATH

# 2. Prepare temp prompt & output files
$tmpIn = [System.IO.Path]::GetTempFileName()
$tmpOut = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($tmpIn, "Your prompt here...", [System.Text.Encoding]::UTF8)

# 3. Execute via cmd /c with stdin piping and output extraction
& cmd.exe /c "type `"$tmpIn`" | codex.cmd exec --ephemeral -s read-only -c model_reasoning_effort=""medium"" -o `"$tmpOut`" -"

# 4. Read result
$result = [System.IO.File]::ReadAllText($tmpOut, [System.Text.Encoding]::UTF8)

# 5. Clean up
Remove-Item $tmpIn, $tmpOut -Force
```

---

## 6. Best Practices for Antigravity Agents
1. **Choose the Right Effort**:
   - `low`: Quick one-line answers, simple regex, small formatting fixes.
   - `medium`: Typical unit tests, bug fixes, refactoring a single module.
   - `high`: Cross-file architectural refactoring, algorithmic puzzles, complex debugging.
2. **Respect Sandboxing**:
   - Use `read-only` when you only need explanations, audits, or generated snippets returned to stdout.
   - Use `workspace-only` when Codex is expected to directly write code files or modify the repository.
3. **Structured Delegation (`-PassThru`)**:
   - When automating multi-step agent pipelines, use `-PassThru` to check `$response.Success` and `$response.ExitCode` before proceeding.
