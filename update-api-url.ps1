param(
    [Parameter(Mandatory=$true)]
    [string]$BackendUrl
)

$envFile = "C:\Users\fabri\OneDrive\Documentos\agendamento-cliente\.env.local"
$content = "NEXT_PUBLIC_API_URL=$BackendUrl"

Set-Content -Path $envFile -Value $content
Write-Host "Arquivo .env.local atualizado com sucesso: $BackendUrl"
Write-Host "Por favor, reinicie o servidor frontend para aplicar a mudança."
