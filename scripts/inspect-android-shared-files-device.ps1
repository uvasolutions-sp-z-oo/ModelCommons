[CmdletBinding()]
param(
  [string]$HubPackage = 'com.uvasolutions.modelcommons',
  [string]$ConsumerPackage = 'com.sirnejo.CPQMobile',
  [string]$Serial = '',
  [string]$OutputPath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-Adb {
  param([string[]]$Arguments)
  $command = @()
  if ($Serial) { $command += @('-s', $Serial) }
  $command += $Arguments
  $output = & adb @command 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "adb failed while collecting Android shared-file evidence."
  }
  return @($output | ForEach-Object { [string]$_ })
}

function Read-Prop {
  param([string]$Name)
  return ((Invoke-Adb @('shell', 'getprop', $Name)) -join "`n").Trim()
}

function Read-PackageUid {
  param([string]$PackageName)
  $text = (Invoke-Adb @('shell', 'cmd', 'package', 'list', 'packages', '-U', $PackageName)) -join "`n"
  $match = [regex]::Match($text, "(?m)^package:$([regex]::Escape($PackageName))\s+uid:(\d+)\s*$")
  if (-not $match.Success) { throw "Package $PackageName is not installed on the selected device." }
  return [int64]$match.Groups[1].Value
}

function Read-PackageVersion {
  param([string]$PackageDump)
  $name = [regex]::Match($PackageDump, '(?m)^\s*versionName=([^\s]+)\s*$')
  $code = [regex]::Match($PackageDump, '(?m)^\s*versionCode=(\d+)')
  return [ordered]@{
    versionName = if ($name.Success) { $name.Groups[1].Value } else { $null }
    versionCode = if ($code.Success) { [int64]$code.Groups[1].Value } else { $null }
  }
}

function Read-PrivateGgufEvidence {
  param([string]$PackageName)
  try {
    # run-as works only for debuggable packages. Keep paths in memory and emit
    # counts/bytes only. App diagnostics cover the same roots in release builds.
    $lines = Invoke-Adb @(
      'shell', 'run-as', $PackageName, 'du', '-ak',
      'files', 'no_backup', 'cache', 'code_cache'
    )
    $sizes = @()
    foreach ($line in $lines) {
      if ($line -notmatch '(?i)\.gguf\s*$') { continue }
      $match = [regex]::Match($line, '^\s*(\d+)\s+')
      if ($match.Success) { $sizes += ([int64]$match.Groups[1].Value * 1024) }
    }
    $totalBytes = ($sizes | Measure-Object -Sum).Sum
    if ($null -eq $totalBytes) { $totalBytes = 0 }
    return [ordered]@{
      available = $true
      artifactCount = $sizes.Count
      artifactBytes = [int64]$totalBytes
    }
  } catch {
    return [ordered]@{
      available = $false
      artifactCount = $null
      artifactBytes = $null
    }
  }
}

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
  throw 'adb is not available on PATH.'
}

if (-not $Serial) {
  $deviceLines = Invoke-Adb @('devices')
  $devices = @($deviceLines | Where-Object { $_ -match '^([^\s]+)\s+device$' } | ForEach-Object {
    [regex]::Match($_, '^([^\s]+)').Groups[1].Value
  })
  if ($devices.Count -ne 1) {
    throw 'Connect exactly one authorized Android device, or pass -Serial.'
  }
  $Serial = $devices[0]
}

$hubUid = Read-PackageUid $HubPackage
$consumerUid = Read-PackageUid $ConsumerPackage
if ($hubUid -eq $consumerUid) {
  throw 'The Hub and consumer share an Android UID; this cannot establish the required two-application boundary.'
}

$hubDump = (Invoke-Adb @('shell', 'dumpsys', 'package', $HubPackage)) -join "`n"
$consumerDump = (Invoke-Adb @('shell', 'dumpsys', 'package', $ConsumerPackage)) -join "`n"
$providerAuthority = "$HubPackage.modelcommons.documents"
$providerContractPresent = $hubDump.Contains($providerAuthority) -and
  $hubDump.Contains('android.permission.MANAGE_DOCUMENTS') -and
  $hubDump.Contains('expo.modules.modelcommonsnative.provider.ModelCommonsDocumentsProvider')
if (-not $providerContractPresent) {
  throw 'The installed Hub does not expose the expected restricted ModelCommons DocumentsProvider contract.'
}

$providerState = (Invoke-Adb @('shell', 'dumpsys', 'activity', 'providers')) -join "`n"
$persistedGrantObserved = $providerState.Contains($providerAuthority) -and
  $providerState.Contains([string]$consumerUid)

$pageSize = $null
try {
  $candidate = ((Invoke-Adb @('shell', 'getconf', 'PAGE_SIZE')) -join '').Trim()
  if ($candidate -match '^\d+$') { $pageSize = [int64]$candidate }
} catch { }

$hubVersion = Read-PackageVersion $hubDump
$consumerVersion = Read-PackageVersion $consumerDump
$evidence = [ordered]@{
  schema = 'modelcommons.android-shared-files-device-fixture'
  schemaVersion = 1
  capturedAt = [DateTimeOffset]::UtcNow.ToString('o')
  device = [ordered]@{
    manufacturer = Read-Prop 'ro.product.manufacturer'
    model = Read-Prop 'ro.product.model'
    androidVersion = Read-Prop 'ro.build.version.release'
    sdk = Read-Prop 'ro.build.version.sdk'
    abi = Read-Prop 'ro.product.cpu.abi'
    pageSizeBytes = $pageSize
  }
  applications = [ordered]@{
    hub = [ordered]@{
      packageName = $HubPackage
      uid = $hubUid
      versionName = $hubVersion.versionName
      versionCode = $hubVersion.versionCode
    }
    consumer = [ordered]@{
      packageName = $ConsumerPackage
      uid = $consumerUid
      versionName = $consumerVersion.versionName
      versionCode = $consumerVersion.versionCode
    }
    distinctUids = $true
  }
  provider = [ordered]@{
    authority = $providerAuthority
    restrictedContractPresent = $providerContractPresent
    persistedConsumerGrantObserved = $persistedGrantObserved
  }
  consumerPrivateGguf = Read-PrivateGgufEvidence $ConsumerPackage
  manualChecksRequired = @(
    'Inspect final merged component enabled/exported values for both packages.',
    'Run the synthetic 360M generation and export the sanitized receipt.',
    'Repeat private/cache evidence after generation and compare counts/bytes.',
    'Record signing-certificate fingerprints and package archive provenance separately.'
  )
}

$json = $evidence | ConvertTo-Json -Depth 8
if ($OutputPath) {
  $parent = Split-Path -Parent $OutputPath
  if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  [IO.File]::WriteAllText([IO.Path]::GetFullPath($OutputPath), $json + [Environment]::NewLine,
    [Text.UTF8Encoding]::new($false))
}
$json
