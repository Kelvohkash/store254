<#
.SYNOPSIS
    Autonomous headless execution wrapper for OpenAI Codex CLI (codex exec).

.DESCRIPTION
    Wraps the OpenAI Codex CLI (`codex.cmd exec --ephemeral`) for non-interactive
    delegation by Antigravity agents. Handles PATH configuration, temporary stdin
    file piping (preventing terminal deadlocks), effort level passing, and clean
    last-message capture.

.PARAMETER Prompt
    The instruction prompt to send to Codex. Supports multi-line strings, code snippets,
    and pipeline input.

.PARAMETER Sandbox
    Sandbox execution policy for Codex shell commands:
    - 'read-only' (default): safe inspection, analysis, code review, no file modifications.
    - 'workspace-only' / 'workspace-write': allow file edits and command execution within workspace.

.PARAMETER Effort
    Reasoning effort level for gpt-6-luna:
    - 'low' (default): fast answers, simple refactoring, unit tests.
    - 'medium': balanced algorithmic tasks and multi-file debugging.
    - 'high': deep reasoning, architectural overhauls, formal verification.

.PARAMETER WorkDir
    Working directory for Codex execution. Defaults to the current working directory.

.PARAMETER PassThru
    When specified, returns a structured PSCustomObject containing Result, Stdout, Stderr,
    ExitCode, and Success status. Otherwise returns the clean Result string.

.PARAMETER RawOutput
    When specified, returns the full raw stdout rather than the isolated final response.

.EXAMPLE
    .\invoke-codex.ps1 -Prompt "Explain the difference between type and interface in TypeScript."

.EXAMPLE
    "Refactor src/utils.ts to use functional chaining" | .\invoke-codex.ps1 -Sandbox workspace-only -Effort medium
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0, ValueFromPipeline = $true)]
    [string]$Prompt,

    [Parameter(Position = 1)]
    [ValidateSet('read-only', 'workspace-only', 'workspace-write')]
    [string]$Sandbox = 'read-only',

    [Parameter(Position = 2)]
    [ValidateSet('low', 'medium', 'high')]
    [string]$Effort = 'low',

    [Parameter()]
    [string]$WorkDir = (Get-Location).Path,

    [Parameter()]
    [switch]$PassThru,

    [Parameter()]
    [switch]$RawOutput
)

# If Prompt was not passed as a named argument but provided via pipeline or stdin
if ([string]::IsNullOrWhiteSpace($Prompt) -and $input) {
    $Prompt = ($input | Out-String).Trim()
}

if ([string]::IsNullOrWhiteSpace($Prompt)) {
    Write-Error "No prompt provided. Pass -Prompt or pipe input into the script."
    exit 1
}

# 1. Ensure C:\home\kash\.npm-global is prepended to PATH
$npmGlobalPath = 'C:\home\kash\.npm-global'
if (Test-Path $npmGlobalPath) {
    if ($env:PATH -notlike "*$npmGlobalPath*") {
        $env:PATH = "$npmGlobalPath;$env:PATH"
    }
}

# 2. Locate codex executable (prefer codex.cmd in npm-global or in PATH)
$codexCmd = Join-Path $npmGlobalPath 'codex.cmd'
if (-not (Test-Path $codexCmd)) {
    $command = Get-Command 'codex.cmd' -ErrorAction SilentlyContinue
    if ($command) {
        $codexCmd = $command.Source
    } else {
        $codexCmd = 'codex.cmd'
    }
}

# 3. Normalize Sandbox argument
$sandboxArg = switch ($Sandbox) {
    'workspace-only'  { 'workspace-write' }
    'workspace-write' { 'workspace-write' }
    default           { 'read-only' }
}

# 4. Resolve WorkDir
$resolvedWorkDir = Resolve-Path -Path $WorkDir -ErrorAction SilentlyContinue
$targetWorkDir = if ($resolvedWorkDir) { $resolvedWorkDir.Path } else { (Get-Location).Path }

# 5. Create temporary files for reliable stdin piping and last-message extraction
$tempPromptFile = [System.IO.Path]::GetTempFileName()
$tempOutFile = [System.IO.Path]::GetTempFileName()
$tempStdoutFile = [System.IO.Path]::GetTempFileName()
$tempStderrFile = [System.IO.Path]::GetTempFileName()

try {
    # Write the full prompt into the temp file with UTF-8 encoding
    [System.IO.File]::WriteAllText($tempPromptFile, $Prompt, [System.Text.Encoding]::UTF8)

    # Build argument list for codex exec
    # --ephemeral ensures no lingering session database files
    # -s sets sandbox policy
    # -c model_reasoning_effort configures gpt-6-luna effort
    # -C sets the working root directory
    # -o outputs the final clean model message into $tempOutFile
    # - reads the initial prompt from stdin
    $execArgs = "exec --ephemeral -s $sandboxArg -c model_reasoning_effort=""$Effort"" -C `"$targetWorkDir`" -o `"$tempOutFile`" -"

    # Execute via cmd.exe pipeline to guarantee safe EOF on stdin and complete headless isolation
    $cmdLine = "type `"$tempPromptFile`" | `"$codexCmd`" $execArgs > `"$tempStdoutFile`" 2> `"$tempStderrFile`""
    & cmd.exe /c $cmdLine
    $exitCode = $LASTEXITCODE

    # Read captured outputs
    $result = ""
    if (Test-Path $tempOutFile) {
        $result = [System.IO.File]::ReadAllText($tempOutFile, [System.Text.Encoding]::UTF8)
    }

    $stdout = ""
    if (Test-Path $tempStdoutFile) {
        $stdout = [System.IO.File]::ReadAllText($tempStdoutFile, [System.Text.Encoding]::UTF8)
    }

    $stderr = ""
    if (Test-Path $tempStderrFile) {
        $stderr = [System.IO.File]::ReadAllText($tempStderrFile, [System.Text.Encoding]::UTF8)
    }

    # If the isolated output file is empty, fallback to trimmed stdout
    if ([string]::IsNullOrWhiteSpace($result)) {
        $result = $stdout.Trim()
    } else {
        $result = $result.Trim()
    }

    $global:LASTEXITCODE = $exitCode

    if ($PassThru) {
        return [PSCustomObject]@{
            Result   = $result
            Stdout   = $stdout
            Stderr   = $stderr
            ExitCode = $exitCode
            Success  = ($exitCode -eq 0)
        }
    }

    if ($RawOutput) {
        Write-Output $stdout
    } else {
        Write-Output $result
    }

    if ($exitCode -ne 0 -and [string]::IsNullOrWhiteSpace($result)) {
        if (-not [string]::IsNullOrWhiteSpace($stderr)) {
            Write-Error "Codex CLI exited with code ${exitCode}: $stderr"
        } else {
            Write-Error "Codex CLI exited with code ${exitCode}."
        }
    }
}
finally {
    # Clean up temporary files
    foreach ($file in @($tempPromptFile, $tempOutFile, $tempStdoutFile, $tempStderrFile)) {
        if (Test-Path $file) {
            Remove-Item -Path $file -Force -ErrorAction SilentlyContinue
        }
    }
}
