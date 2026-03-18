$ErrorActionPreference = "Stop"

Set-Location "$PSScriptRoot\.."

Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$env:ELECTRON_RUN_AS_NODE = $null
[Environment]::SetEnvironmentVariable("ELECTRON_RUN_AS_NODE", $null, "Process")
$env:NODE_OPTIONS = "--max-old-space-size=8192"

npm run dev:electron
