param([string]$SourceDirectory)

$ErrorActionPreference = 'Stop'
$demoRepository = Split-Path -Parent $PSScriptRoot
$demoOutput = Join-Path $demoRepository 'frontend\public\demo-logos'
if (-not $SourceDirectory) { $SourceDirectory = $demoOutput }
$demoSource = (Resolve-Path -LiteralPath $SourceDirectory).Path
$demoBackend = Join-Path $demoRepository 'backend'
$demoClasspathFile = Join-Path $demoBackend 'target\demo-logos-classpath.txt'

& (Join-Path $demoBackend 'mvnw.cmd') -f (Join-Path $demoBackend 'pom.xml') -q '-DskipTests' compile dependency:build-classpath '-DincludeScope=runtime' "-Dmdep.outputFile=$demoClasspathFile"
if ($LASTEXITCODE -ne 0) { throw 'Could not compile the backend image processor.' }

$demoClasspath = (Join-Path $demoBackend 'target\classes') + [IO.Path]::PathSeparator + (Get-Content -LiteralPath $demoClasspathFile -Raw).Trim()
& java '-Djava.awt.headless=true' --class-path $demoClasspath (Join-Path $PSScriptRoot 'PrepareDemoLogos.java') $demoSource $demoOutput
if ($LASTEXITCODE -ne 0) { throw 'Preview logo preparation failed. Check that the source files meet the PNG upload rules.' }
