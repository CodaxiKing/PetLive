# Cria as tasks do PetLive como itens do GitHub Project.
#
# Antes de rodar, entre com a conta dona do projeto e libere o escopo "project":
#   gh auth login
#   gh auth refresh -s project
#
# Teste sem criar nada:   .\criar-tasks-github.ps1 -DryRun
# Criar de verdade:       .\criar-tasks-github.ps1
param(
  [string]$Owner = "CodaxiKing",
  [int]$Project = 5,
  [string]$File = "$PSScriptRoot\backlog.psv",
  [switch]$DryRun
)

$linhas = Get-Content $File -Encoding UTF8 | Where-Object { $_.Trim() -and -not $_.StartsWith('#') }
$total = $linhas.Count
$n = 0
foreach ($linha in $linhas) {
  $p = $linha -split '\|', 4
  $titulo = "[$($p[0])] $($p[1]): $($p[3])"
  $corpo = "Tag: $($p[0])`nMódulo: $($p[1])`nFase: $($p[2])"
  $n++
  if ($DryRun) {
    Write-Host "($n/$total) $titulo"
  } else {
    gh project item-create $Project --owner $Owner --title $titulo --body $corpo | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Error "Falhou em: $titulo"; break }
    Write-Host "($n/$total) criada: $titulo"
  }
}
