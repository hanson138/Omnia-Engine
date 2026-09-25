param(
    [Parameter(Mandatory = $true)]
    [string]$SillyTavernPath,
    [string]$UserHandle = 'default-user'
)

$ErrorActionPreference = 'Stop'
$st = (Resolve-Path -LiteralPath $SillyTavernPath).Path
if (-not (Test-Path -LiteralPath (Join-Path $st 'server.js'))) {
    throw '指定路径不是 SillyTavern 根目录：未找到 server.js。'
}
$userDir = Join-Path $st (Join-Path 'data' $UserHandle)
if (-not (Test-Path -LiteralPath $userDir -PathType Container)) {
    throw "未找到 ST 用户目录：$userDir"
}
$source = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$target = Join-Path $userDir 'extensions\omnia-cognition-st'
New-Item -ItemType Directory -Path $target -Force | Out-Null
foreach ($name in @('manifest.json', 'index.js', 'style.css')) {
    Copy-Item -LiteralPath (Join-Path $source $name) -Destination (Join-Path $target $name) -Force
}
Write-Output "Omnia 扩展已安装到：$target"
Write-Output '刷新 SillyTavern 页面后，在“扩展程序 → Omnia · 角色认知”中打开设置。'
