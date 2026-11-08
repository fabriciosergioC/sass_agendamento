param(
    [Parameter(Mandatory=$true)]
    [string]$BackendUrl
)

$ErrorActionPreference = 'Stop'
$envFile = Join-Path $PSScriptRoot '.env.local'

# Preserva as demais variáveis do arquivo e troca apenas BACKEND_URL, que é a
# variável lida por src/lib/backend.ts e pelo rewrite do next.config.ts.
$lines = @()
if (Test-Path $envFile) {
    $lines = @(Get-Content -Path $envFile)
}

$updated = $false
$lines = @($lines | ForEach-Object {
    if ($_ -match '^\s*BACKEND_URL\s*=') {
        $updated = $true
        "BACKEND_URL=$BackendUrl"
    } else {
        $_
    }
})

if (-not $updated) {
    $lines += "BACKEND_URL=$BackendUrl"
}

Set-Content -Path $envFile -Value $lines -Encoding UTF8
Write-Host "BACKEND_URL atualizado em .env.local."
Write-Host "Reinicie o servidor frontend para aplicar a mudanca."