# Provision only disposable Actions runners. No user-installed VS Code is used.
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
if (!$env:RUNNER_TEMP -or !$env:GITHUB_ENV -or $env:RUNNER_OS -ne 'Windows') {
    throw 'Use a disposable Windows Actions runner'
}
$tools = Join-Path $env:RUNNER_TEMP 'binary-markdown-tools'
New-Item -ItemType Directory -Force $tools | Out-Null
function Download-Archive($url, $name, $sha256) {
    $archive = Join-Path $tools "$name.zip"
    & curl.exe --fail --location --retry 3 --retry-all-errors $url -o $archive
    $actual = (Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($sha256 -and $actual -ne $sha256) { throw "$name checksum mismatch" }
    Write-Host "$name SHA-256 $actual"
    $destination = Join-Path $tools $name
    Expand-Archive -LiteralPath $archive -DestinationPath $destination
    return $destination
}
function Export-Environment($name, $value) {
    if (!$value) { throw "Missing $name" }
    [IO.File]::AppendAllText($env:GITHUB_ENV, "$name=$value`n")
}
$pandocRoot = Download-Archive 'https://github.com/jgm/pandoc/releases/download/3.8.3/pandoc-3.8.3-windows-x86_64.zip' 'pandoc' 'a77c14078a5c4c6e396d5f5c03f4849eff4a858414bb9e69560bb35528cbf57a'
$pandoc = (Get-ChildItem $pandocRoot -Recurse -Filter pandoc.exe | Select-Object -First 1).FullName
$popplerRoot = Download-Archive 'https://github.com/oschwartz10612/poppler-windows/releases/download/v26.07.0-0/Release-26.07.0-0.zip' 'poppler' 'a711b0563b06edc488583d28198b6734c5a494afbbd1b9d87d3d2866062fb7e2'
$pdfText = (Get-ChildItem $popplerRoot -Recurse -Filter pdftotext.exe | Select-Object -First 1).FullName
$popplerBin = Split-Path $pdfText
[IO.File]::AppendAllText($env:GITHUB_PATH, "$popplerBin`n")
$env:PATH = "$popplerBin;$env:PATH"
Export-Environment 'EXPORT_PANDOC_PATH' $pandoc
Export-Environment 'EXPORT_PDFTOTEXT_PATH' $pdfText
Export-Environment 'EXPORT_PDFTOPPM_PATH' (Join-Path $popplerBin 'pdftoppm.exe')
& $pandoc --version
& $pdfText -v

# Playwright pins a compatible browser revision through package-lock.json.
& npx.cmd playwright install chromium
$browser = (& node -p 'require("playwright-core").chromium.executablePath()').Trim()
if (!(Test-Path -LiteralPath $browser)) { throw 'Chromium was not installed' }
Export-Environment 'EXPORT_BROWSER_PATH' $browser
Export-Environment 'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH' $browser

$codeVersion = $env:VALIDATION_CODE_VERSION
if ($codeVersion -notin @('latest', '1.85.0')) { throw 'Unexpected VS Code validation version' }
$codeRoot = Download-Archive "https://update.code.visualstudio.com/$codeVersion/win32-x64-archive/stable" 'vscode' ''
$code = Join-Path $codeRoot 'Code.exe'
if (!(Test-Path -LiteralPath $code)) { throw 'Isolated VS Code archive is incomplete' }
$cli = (& node test/utils/vscode-cli.cjs $code).Trim()
# Code.exe is a GUI executable: run it through Node's synchronous process API so
# a failed version probe cannot silently continue provisioning in PowerShell.
& node -e 'const r=require("node:child_process").spawnSync(process.argv[1],[process.argv[2],"--version"],{env:{...process.env,ELECTRON_RUN_AS_NODE:"1"},stdio:"inherit"});if(r.error)throw r.error;process.exit(r.status??1)' $code $cli
if ($LASTEXITCODE -ne 0) { throw 'Isolated VS Code version probe failed' }
Export-Environment 'VALIDATION_CODE' $code
& python -m venv (Join-Path $tools 'audit-venv')
$python = Join-Path $tools 'audit-venv/Scripts/python.exe'
& $python -m pip install --disable-pip-version-check 'pypdf==6.18.0' 'Pillow==12.3.0'
Export-Environment 'VALIDATION_PYTHON' $python
# Native negative-test fixtures are compiled using the runner's .NET Framework.
Get-Item (Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe') | Out-Null
& node --version
& $python --version
