<#
finish-local-dir-rename.ps1 - one-shot, safe to re-run, Windows PowerShell 5.1+

Finishes the last step of the Signal Studio repo rename: the GitHub repo
is already ethanmcn2013-droid/app; this renames the LOCAL clone directory
to match ("app"), verifies git health afterwards, then archives the
"finish-app-dir-rename" scheduled task so it does not fire again.

Design constraints:
  - never touches a directory whose git remote is not this repo
  - the rename is atomic; on failure nothing has changed, the script
    prints who is likely holding the lock, and stops
  - the scheduled-task folder is ARCHIVED (moved aside), not deleted:
    its SKILL.md predates this script and may hold extra steps - review
    it once after a successful run, then delete the archive
  - re-runnable: if the directory is already named "app" it skips
    straight to the scheduled-task cleanup

Usage:
  powershell -ExecutionPolicy Bypass -File scripts\finish-local-dir-rename.ps1
    [-Path C:\path\to\clone]   # when not running from inside the clone
    [-DryRun]                  # print actions without doing them
    [-KeepTask]                # leave the scheduled task registered

IMPORTANT: run it from OUTSIDE the clone (cd C:\ first) - any shell,
editor, or dev server whose current directory is inside the folder holds
a Windows lock that makes the rename fail.
#>
[CmdletBinding()]
param(
    [string]$Path,
    [switch]$DryRun,
    [switch]$KeepTask
)

$ErrorActionPreference = 'Stop'
$RepoSlug    = 'ethanmcn2013-droid/app'
$TargetName  = 'app'
$TaskDir     = Join-Path $HOME (Join-Path '.claude' (Join-Path 'scheduled-tasks' 'finish-app-dir-rename'))
$ArchiveRoot = Join-Path $HOME (Join-Path '.claude' 'scheduled-tasks-archive')

function Write-Step([string]$m) { Write-Host "== $m" -ForegroundColor Cyan }
function Write-Ok([string]$m)   { Write-Host "   $m" -ForegroundColor Green }
function Write-Note([string]$m) { Write-Host "   $m" }
function Stop-Safely([string]$m) {
    Write-Host ""
    Write-Host "STOPPED SAFELY: $m" -ForegroundColor Red
    Write-Host "Nothing was renamed or deleted." -ForegroundColor Red
    exit 1
}

# --- locate the clone --------------------------------------------------
Write-Step "Locating the clone"
if (-not $Path) {
    if ($PSScriptRoot) { $Path = Split-Path -Parent $PSScriptRoot }
    else { Stop-Safely "cannot infer the clone location; pass -Path C:\path\to\clone" }
}
try { $src = (Resolve-Path -LiteralPath $Path).Path.TrimEnd('\').TrimEnd('/') }
catch { Stop-Safely "path not found: $Path" }
if (-not (Test-Path -LiteralPath (Join-Path $src '.git'))) {
    Stop-Safely "$src is not a git clone (no .git)"
}

# --- identity check: refuse to rename a stranger's folder --------------
$remote = & git -C $src remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0 -or -not $remote) {
    Stop-Safely "could not read the git remote of $src"
}
if ($remote -notmatch [regex]::Escape($RepoSlug)) {
    Stop-Safely "remote is '$remote', expected $RepoSlug - wrong folder"
}
Write-Ok "clone of $RepoSlug at: $src"

$parent  = Split-Path -Parent $src
$leaf    = Split-Path -Leaf $src
$dest    = Join-Path $parent $TargetName

if ($leaf -eq $TargetName) {
    Write-Ok "directory is already named '$TargetName' - rename already done"
} else {
    # --- pre-flight ----------------------------------------------------
    Write-Step "Pre-flight checks ($leaf -> $TargetName)"
    if (Test-Path -LiteralPath $dest) {
        Stop-Safely "$dest already exists - two clones? resolve that first"
    }
    $dirty = & git -C $src status --porcelain 2>$null
    if ($dirty) {
        Write-Note "note: working tree has uncommitted changes (rename is still safe)"
    }
    if ($src -match 'OneDrive') {
        Write-Note "warning: path is inside OneDrive - pause syncing if the rename fails"
    }
    # this process must not hold the lock itself
    Set-Location -LiteralPath $parent

    # --- rename (atomic), retrying transient locks ---------------------
    Write-Step "Renaming"
    if ($DryRun) {
        Write-Ok "[dry-run] would rename $src -> $dest"
    } else {
        $delays = 0, 2, 4, 8
        $done = $false
        $lastError = $null
        foreach ($d in $delays) {
            if ($d -gt 0) { Write-Note "locked; retrying in ${d}s..."; Start-Sleep -Seconds $d }
            try { Rename-Item -LiteralPath $src -NewName $TargetName; $done = $true; break }
            catch { $lastError = $_ }
        }
        if (-not $done) {
            Write-Host ""
            Write-Host "The folder is still locked. Error: $($lastError.Exception.Message)" -ForegroundColor Yellow
            Write-Host "Likely holders to close, then re-run:" -ForegroundColor Yellow
            Write-Host "  1. any terminal or editor whose current directory is inside $src (cd C:\ in each)"
            Write-Host "  2. dev servers or tools started from inside it:"
            Get-Process -ErrorAction SilentlyContinue |
                Where-Object { $_.Path -and $_.Path -like "$src\*" } |
                ForEach-Object { Write-Host ("     - {0} (pid {1})" -f $_.ProcessName, $_.Id) }
            Write-Host "  3. Explorer windows open on the folder; OneDrive sync if applicable"
            Write-Host "  (deep inspection: Sysinternals 'handle.exe $leaf', or 'openfiles' as admin)"
            Stop-Safely "folder locked after $($delays.Count) attempts"
        }
        Write-Ok "renamed to $dest"

        # --- verify git health ------------------------------------------
        Write-Step "Verifying git health"
        & git -C $dest rev-parse --git-dir *> $null
        if ($LASTEXITCODE -ne 0) {
            Stop-Safely "git does not recognise $dest after the rename - investigate before doing anything else"
        }
        $remote2 = & git -C $dest remote get-url origin
        $branch  = & git -C $dest branch --show-current
        Write-Ok "git OK - remote $remote2, branch $branch"
    }
}

# --- scheduled task cleanup --------------------------------------------
# reached only when the end state holds (renamed now, or already named app)
Write-Step "Scheduled task 'finish-app-dir-rename'"
if ($KeepTask) {
    Write-Note "left in place (-KeepTask); it will fire again on its schedule"
} elseif (-not (Test-Path -LiteralPath $TaskDir)) {
    Write-Ok "not present at $TaskDir - nothing to clean up"
} elseif ($DryRun) {
    Write-Ok "[dry-run] would archive $TaskDir under $ArchiveRoot"
} else {
    $stamp    = Get-Date -Format 'yyyyMMdd-HHmmss'
    $archived = Join-Path $ArchiveRoot "finish-app-dir-rename-$stamp"
    New-Item -ItemType Directory -Force -Path $ArchiveRoot | Out-Null
    Move-Item -LiteralPath $TaskDir -Destination $archived
    Write-Ok "archived - it will NOT fire again: $archived"
    Write-Note "review the archived SKILL.md once: if it lists steps beyond the"
    Write-Note "rename itself, do those by hand; then the archive is safe to delete:"
    Write-Note "  Remove-Item -Recurse -Force '$archived'"
}

Write-Host ""
Write-Host "DONE. This helper was one-shot: once everything above is green it can" -ForegroundColor Green
Write-Host "be removed from the repo." -ForegroundColor Green
exit 0
