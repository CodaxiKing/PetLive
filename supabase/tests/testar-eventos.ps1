param([string]$Container = 'supabase_db_PetLive')
$ErrorActionPreference = 'Stop'
# Aplica a migração e os testes só na transação. Nada é persistido.
$migration = Join-Path $PSScriptRoot '../migrations/20261122000000_eventos_pet.sql'
$tests = Join-Path $PSScriptRoot 'eventos.sql'
$sql = "begin;`n" + (Get-Content -Raw $migration) + "`n" + (Get-Content -Raw $tests) + "`nrollback;"
$sql | docker exec -i $Container psql -U postgres -d postgres -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) { throw 'Falha nos testes de eventos.' }
