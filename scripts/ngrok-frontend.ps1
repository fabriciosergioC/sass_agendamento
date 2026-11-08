<#
.SYNOPSIS
  Publica o FRONTEND de agendamento (porta 3000) no ngrok e entrega o link pronto
  para mandar para o cliente.

.DESCRIPTION
  Arquitetura:

    celular -> ngrok -> frontend :3000 -> (rewrite /api/public/*) -> backend :3001

  So este tunel precisa ser publico. O backend fica em localhost e o navegador do
  cliente nunca fala com ele (por isso nao precisa de CORS nem de tunel do backend).

  Contas separadas: o ngrok do FRONTEND usa um arquivo de configuracao proprio
  (~\.ngrok-frontend\ngrok.yml), com o authtoken da outra conta e o inspector em
  127.0.0.1:4042. Assim o ngrok do backend (:4040, conta padrao) continua rodando
  em paralelo sem brigar pelo mesmo dominio (ERR_NGROK_334).

  O script:
    1. Confira ngrok, config propria, RAM livre, frontend e backend.
    2. Se ja existe tunel no frontend, reuse e so entregue o link.
    3. Senao, abra um tunel novo numa janela a parte e descubra a URL no inspector.
    4. TESTE o caminho completo (tunel -> frontend -> backend) antes de te dar o link.
    5. Copie o link, salve em link-agendamento.txt e imprima o QR code.

.PARAMETER Stop
  Encerra somente o tunel do frontend aberto por este script (PID em .ngrok-frontend.pid).
  Nao mexe no ngrok do backend.

.PARAMETER ConfigPath
  Arquivo de configuracao ngrok a usar (authtoken + web_addr). Padrao:
  $env:USERPROFILE\.ngrok-frontend\ngrok.yml, se existir. Passe '' para usar a config
  padrao do ngrok.

.EXAMPLE
  .\iniciar-ngrok.bat
  .\scripts\ngrok-frontend.ps1 -Stop
  .\scripts\ngrok-frontend.ps1 -Url https://minha-barbearia.ngrok-free.app
#>
[CmdletBinding()]
param(
  [int]$FrontendPort = 3000,
  [int]$BackendPort = 3001,
  [string]$Slug = 'bela-face',
  [string]$Url = '',
  [string]$BackendPath = 'C:\Users\fabri\OneDrive\Documentos\sass estetica',
  [string]$ConfigPath = '__auto__',
  [switch]$Stop,
  [switch]$NoQr,
  [switch]$SkipChecks
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$ProjectDir = Split-Path -Parent $PSScriptRoot
$PidFile = Join-Path $ProjectDir '.ngrok-frontend.pid'
$LogPath = Join-Path $ProjectDir '.ngrok-frontend.log'
$LinkFile = Join-Path $ProjectDir 'link-agendamento.txt'
$OwnConfig = Join-Path $env:USERPROFILE '.ngrok-frontend\ngrok.yml'

if ($ConfigPath -eq '__auto__') {
  if (Test-Path $OwnConfig) { $ConfigPath = $OwnConfig } else { $ConfigPath = '' }
}

function Write-Erro([string]$m) { Write-Host $m -ForegroundColor Red }
function Write-Ok([string]$m) { Write-Host "[OK] $m" -ForegroundColor Green }
function Write-Aviso([string]$m) { Write-Host "[Atencao] $m" -ForegroundColor Yellow }

function Test-PortaLocal([int]$Port) {
  [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Invoke-JsonOuNulo([string]$u) {
  for ($i = 1; $i -le 3; $i++) {
    try {
      $r = Invoke-RestMethod -Uri $u -TimeoutSec 6 -ErrorAction Stop
      if ($null -ne $r) { return $r }
    } catch { Start-Sleep -Milliseconds 500 }
  }
  try {
    $raw = & curl.exe -s --max-time 6 $u
    if ($raw) { return ($raw | ConvertFrom-Json) }
  } catch {}
  return $null
}

# IMPORTANTE: sempre devolver e receber com @() - o PowerShell "desembrulha"
# um array de um unico elemento e um $tunnels.Count vazio faria o script achar
# que nao ha tunel nenhum (foi exatamente o bug de 2026-11-03).
function Get-Tunnels([int]$Port) {
  $r = Invoke-JsonOuNulo "http://127.0.0.1:$Port/api/tunnels"
  if ($r -and $r.tunnels) { return @($r.tunnels) }
  return @()
}

function Get-UrlDoTunel($tunnels, [int]$Port) {
  $achado = @($tunnels) | Where-Object { $_.proto -eq 'https' -and "$($_.config.addr)" -match ":$Port`$" } |
    Select-Object -First 1
  if ($achado) { return $achado.public_url }
  return $null
}

function Resolve-Ngrok {
  $cmd = Get-Command ngrok.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $exe = Join-Path $env:APPDATA 'npm\node_modules\ngrok\bin\ngrok.exe'
  if (Test-Path $exe) { return $exe }
  $cmd = Get-Command ngrok -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source -like '*.exe') { return $cmd.Source }
  throw 'ngrok nao encontrado. Instale com: npm i -g ngrok'
}

function Get-PidDaPorta([int]$Port) {
  $c = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) { return $c.OwningProcess }
  return $null
}

function Save-Pid ([int]$ProcId) {
  $ProcId | Out-File -FilePath $PidFile -Encoding ascii
}

# porta do inspector do AGENTE DO FRONTEND
$InspectPort = 4040
if ($ConfigPath) {
  $cfg = Get-Content $ConfigPath -Raw -ErrorAction SilentlyContinue
  if ($cfg -and $cfg -match 'web_addr:\s*(?:[\d\.]+|[a-z0-9\-]+):(\d+)') { $InspectPort = [int]$Matches[1] }
  else { $InspectPort = 4042 }
}

# ------------------------------------------------------------------ parar
if ($Stop) {
  if (Test-Path $PidFile) {
    $salvo = Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($salvo) {
      $p = Get-Process -Id ("$salvo".Trim()) -ErrorAction SilentlyContinue
      if ($p) { Stop-Process -Id ("$salvo".Trim()) -Force; Write-Ok "Tunel do frontend (PID $salvo) encerrado." }
      else { Write-Aviso "PID $salvo ja nao roda." }
    }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
  } else {
    Write-Aviso "Nao encontrei $PidFile. Feche a janela do ngrok do frontend manualmente (nao vou mexer no ngrok do backend)."
  }
  exit 0
}

Write-Host ''
Write-Host "=== Ngrok do FRONTEND de agendamento (porta $FrontendPort) ===" -ForegroundColor Cyan
Write-Host ''

$ngrokExe = Resolve-Ngrok
Write-Ok "ngrok: $ngrokExe"
if ($ConfigPath) {
  Write-Ok "config propria: $ConfigPath (inspector :$InspectPort)"
} else {
  Write-Aviso "sem config propria - usando a conta padrao do ngrok ($OwnConfig nao existe)."
}

# ----------------------------------------------------- tunel ja aberto?
$meus = Get-Tunnels $InspectPort
$publicUrl = Get-UrlDoTunel $meus $FrontendPort
if (@($meus).Count -gt 0) {
  foreach ($t in $meus) { Write-Host ("  tunel neste agente: " + $t.config.addr + ' -> ' + $t.public_url) -ForegroundColor DarkGray }
}
if ($publicUrl) {
  Write-Ok 'Tunel do frontend ja esta no ar - reaproveitando.'
  $dueno = Get-PidDaPorta $InspectPort
  if ($dueno) { Save-Pid $dueno; Write-Host ("  PID deste agente anotado: $dueno") -ForegroundColor DarkGray }
} else {
  # avisos sobre o OUTRO agente (a conta padrao, normalmente apontando para o backend)
  if ($InspectPort -ne 4040) {
    $outros = Get-Tunnels 4040
    foreach ($t in $outros) {
      Write-Host ("  outro agente ngrok (conta padrao): " + $t.config.addr + ' -> ' + $t.public_url) -ForegroundColor DarkGray
    }
    if (@($outros).Count -eq 0 -and -not (Test-PortaLocal 4040)) {
      Write-Ok 'Ngrok do backend nao esta rodando - sem conflito de dominio.'
    }
  }
}

# -------------------------------------------------------------- preflight
if (-not $SkipChecks) {
  try {
    $os = Get-CimInstance Win32_OperatingSystem
    $freeGb = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
    if ($freeGb -lt 0.7) { Write-Aviso "RAM livre em $freeGb GB - feche abas do navegador se a pagina ficar lenta." }
    else { Write-Ok "RAM livre: $freeGb GB" }
  } catch {}

  if (-not (Test-PortaLocal $FrontendPort)) {
    Write-Erro "O frontend nao esta rodando na porta $FrontendPort."
    Write-Erro "Rode primeiro:  cd `"$ProjectDir`" ; npm run dev"
    Write-Erro 'Nunca suba um segundo npm run dev sem derrubar o primeiro: os dois escrevem na mesma .next e a pagina abre sem CSS.'
    exit 1
  }
  Write-Ok "Frontend de pe em :$FrontendPort"

  if (-not (Test-PortaLocal $BackendPort)) {
    Write-Aviso "Backend nao esta na porta $BackendPort. O link vai abrir, mas da erro ao carregar os servicos."
    Write-Aviso "Rode em outra janela:  cd `"$BackendPath`" ; npm run dev"
  } else {
    $api = Invoke-JsonOuNulo "http://localhost:$BackendPort/api/public/$Slug/config"
    if ($api -and $api.org) { Write-Ok "Backend de pe em :$BackendPort (organizacao: $($api.org.name))" }
    else { Write-Aviso "Porta $BackendPort ocupada, mas /api/public/$Slug/config nao respondeu." }
  }
}

# ------------------------------------------------------------ abrir tunel
if (-not $publicUrl) {
  Remove-Item $LogPath -Force -ErrorAction SilentlyContinue
  $argList = @('http', "$FrontendPort", '--log', $LogPath, '--log-format', 'json')
  if ($ConfigPath) { $argList += @('--config', $ConfigPath) }
  if ($Url) { $argList += @('--url', $Url) }

  Write-Host ''
  Write-Host ('Iniciando: ngrok ' + ($argList -join ' ')) -ForegroundColor DarkGray
  $proc = Start-Process -FilePath $ngrokExe -ArgumentList $argList -PassThru -WindowStyle Normal
  Save-Pid $proc.Id
  Write-Ok "ngrok iniciado (PID $($proc.Id)). A janela dele ficou aberta - fechar essa janela derruba o link."

  $deadline = (Get-Date).AddSeconds(45)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 1000
    $publicUrl = Get-UrlDoTunel (Get-Tunnels $InspectPort) $FrontendPort
    if ($publicUrl) { break }
    if ($proc.HasExited) { break }
  }

  if (-not $publicUrl) {
    Write-Erro 'O tunel nao ficou pronto em 45s. Leia a janela do ngrok.'
    if (Test-Path $LogPath) {
      $logTxt = Get-Content $LogPath -Raw -ErrorAction SilentlyContinue
      if ($logTxt -match 'ERR_NGROK_(\d+)') {
        switch ($Matches[1]) {
          '334' { Write-Erro 'ERR_NGROK_334: esse dominio ja esta online em outro tunel da MESMA conta. Solucao: use uma conta/dominio separado (config em .ngrok-frontend) ou derrube o outro tunel.' }
          '4018' { Write-Erro 'ERR_NGROK_4018: o plano free nao permite esse tunel adicional nesta conta.' }
          '1002' { Write-Erro 'ERR_NGROK_1002: authtoken invalido para esta config.' }
          '8011' { Write-Erro 'ERR_NGROK_8011: esse dominio nao pertence a conta deste authtoken.' }
          default { Write-Erro "ERR_NGROK_$($Matches[1]) - veja a janela do ngrok." }
        }
      }
      if ($logTxt -match 'authtoken') { Write-Erro 'Parece problema de authtoken: rode  ngrok config add-authtoken <token> --config "<config>"  numa janela de terminal.' }
    }
    Write-Erro "Log completo em: $LogPath"
    exit 1
  }
}

# ------------------------------------------------- teste ponta a ponta
Write-Host ''
Write-Host 'Testando o caminho tunel -> frontend -> backend...' -ForegroundColor Cyan
# o edge do ngrok pode levar alguns segundos para rotear o endpoint recém-criado
$json = $null
for ($i = 1; $i -le 5 -and -not $json; $i++) {
  try {
    $r = Invoke-WebRequest -Uri "$publicUrl/api/public/$Slug/config" `
          -Headers @{ 'ngrok-skip-browser-warning' = 'true' } -TimeoutSec 25 -UseBasicParsing
    $txt = [System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
    $json = $txt | ConvertFrom-Json
  } catch {
    if ($i -lt 5) { Write-Host "  tentativa $i falhou ($($_.Exception.Message)), aguardando o ngrok propagar..." -ForegroundColor DarkGray; Start-Sleep -Seconds 4 }
    else { Write-Aviso "Teste pela URL publica falhou: $($_.Exception.Message)" }
  }
}
try {
  if ($json -and $json.org) {
    $qtdServicos = @($json.services).Count
    $qtdAtendentes = @($json.barbers).Count
    Write-Ok "Frontend falando com o backend pelo tunel. Organizacao: $($json.org.name) | servicos: $qtdServicos | atendentes: $qtdAtendentes"
  } else {
    Write-Aviso "A API respondeu mas nao trouxe a organizacao. Confira o slug '$Slug'."
  }
} catch {
  Write-Aviso "Teste pela URL publica falhou: $($_.Exception.Message)"
  Write-Aviso 'O tunel pode estar no ar com o backend parado. Confira as janelas de dev e rode de novo.'
}

# ---------------------------------------------------------- entrega o link
try { Set-Clipboard -Value $publicUrl } catch {}
@"
Link de agendamento - gerado em $((Get-Date).ToString('dd/MM/yyyy HH:mm'))
$publicUrl

Obs 1: no ngrok free aparece uma pagina de aviso na primeira visita de cada aparelho
       ("This website is served for free through ngrok.com") - basta tocar em "Visit Site".
Obs 2: o link funciona enquanto frontend (:3000), backend (:3001) e esta janela do
       ngrok estiverem abertos na sua maquina.
"@ | Set-Content -Path $LinkFile -Encoding UTF8

Write-Host ''
Write-Host '=============================================' -ForegroundColor Green
Write-Host "  $publicUrl" -ForegroundColor Green
Write-Host '=============================================' -ForegroundColor Green
Write-Host ' Link na area de transferencia e salvo em link-agendamento.txt'
if (-not $NoQr) {
  & node (Join-Path $PSScriptRoot 'print-qr.cjs') $publicUrl $BackendPath
}
Write-Host ''
Write-Host ' Para derrubar este tunel:  .\scripts\ngrok-frontend.ps1 -Stop' -ForegroundColor DarkGray
Write-Host ''
