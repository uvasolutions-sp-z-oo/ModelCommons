# OWNER-RUN ONLY: inspect a built APK without extracting files or installing it.
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Apk,
  [Parameter(Mandatory = $true)][ValidateSet('arm64-v8a', 'x86_64')][string]$Abi
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$apkPath = (Resolve-Path -LiteralPath $Apk).Path
$archive = [System.IO.Compression.ZipFile]::OpenRead($apkPath)
try {
  $prefix = "lib/$Abi/"
  $wrappers = @($archive.Entries | Where-Object {
    $_.FullName.StartsWith($prefix) -and $_.Name -match '^librnllama_jni(?:_[a-zA-Z0-9_]+)?\.so$'
  })
  if ($wrappers.Count -eq 0) { throw "No llama.rn JNI wrapper for $Abi in this APK." }
  foreach ($wrapper in $wrappers) {
    $coreName = $wrapper.Name -replace '^librnllama_jni', 'librnllama'
    $core = $archive.GetEntry($prefix + $coreName)
    if ($null -eq $core) { throw "Missing matching core: $coreName" }
    foreach ($entry in @($wrapper, $core)) {
      if ($entry.Length -lt 20 -or $entry.Length -gt 256MB) { throw "Unexpected library size: $($entry.Name)" }
      $stream = $entry.Open()
      $memory = [System.IO.MemoryStream]::new()
      try {
        $stream.CopyTo($memory)
        $bytes = $memory.ToArray()
      } finally {
        $stream.Dispose()
        $memory.Dispose()
      }
      $machine = if ($Abi -eq 'arm64-v8a') { 183 } else { 62 }
      if ($bytes[0] -ne 127 -or $bytes[1] -ne 69 -or $bytes[2] -ne 76 -or $bytes[3] -ne 70 -or
          $bytes[4] -ne 2 -or $bytes[5] -ne 1 -or [BitConverter]::ToUInt16($bytes, 18) -ne $machine) {
        throw "Unexpected ELF format or ABI: $($entry.Name)"
      }
      $symbols = [System.Text.Encoding]::ASCII.GetString($bytes)
      if (-not $symbols.Contains('modelcommons_android_fd_v2_params_size')) {
        throw "Missing linked-core descriptor handshake symbol: $($entry.Name)"
      }
      if ($entry -eq $wrapper -and (-not $symbols.Contains('llamaModelCommonsDescriptorSupport') -or
          -not $symbols.Contains('modelcommons-android-fd-v2'))) {
        throw "Missing JNI descriptor handshake: $($entry.Name)"
      }
    }
    Write-Output "Present ($Abi): $($wrapper.Name) + $coreName; descriptor handshake symbols found."
  }
} finally {
  $archive.Dispose()
}
Write-Output 'APK content inspection only. Run real inference to verify that the installed app loads these libraries.'
