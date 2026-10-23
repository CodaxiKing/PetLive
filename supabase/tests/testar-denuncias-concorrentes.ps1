param([string]$Container = 'supabase_db_PetLive')
$ErrorActionPreference = 'Stop'
$bancoTeste = 'petlive_denuncias_' + [guid]::NewGuid().ToString('N')
$processos = @()

function Nova-Conexao([string]$sql) {
  $info = [System.Diagnostics.ProcessStartInfo]::new('docker')
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardInput = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  foreach ($argumento in @('exec','-i',$Container,'psql','-X','-U','supabase_admin','-d',$bancoTeste,'-At','-v','ON_ERROR_STOP=1')) { $info.ArgumentList.Add($argumento) }
  $processo = [System.Diagnostics.Process]::new()
  $processo.StartInfo = $info
  $null = $processo.Start()
  $processo.StandardInput.WriteLine($sql)
  $processo.StandardInput.Flush()
  return $processo
}

docker exec $Container createdb -U supabase_admin $bancoTeste
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível criar o banco descartável.' }
try {
  # Usa o schema real do projeto. Só o serviço Auth é substituído por uma
  # tabela de usuários e auth.uid(), sem conexão com contas ou dados reais.
  $schema = Get-Content -Raw (Join-Path $PSScriptRoot '../migrations/20261020000001_schema_inicial.sql')
  $avisos = Get-Content -Raw (Join-Path $PSScriptRoot '../migrations/20261030000000_caixa_avisos.sql')
  $inicioAvisos = $avisos.IndexOf('create table public.notification_log')
  $avisos = $avisos.Substring($inicioAvisos, $avisos.IndexOf('create index', $inicioAvisos) - $inicioAvisos)
  $eventos = Get-Content -Raw (Join-Path $PSScriptRoot '../migrations/20261122000000_eventos_pet.sql')
  $eventos = $eventos.Substring(0, $eventos.IndexOf('create or replace function public.eventos_por_perto'))
  $migracao = Get-Content -Raw (Join-Path $PSScriptRoot '../migrations/20261128000000_evento_denuncias.sql')
  $auth = @'
create schema auth;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
'@
  $fixture = @'
insert into auth.users(id, email)
select ('a0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'teste-' || n || '@example.invalid'
from generate_series(1,4) n;
insert into public.events(id, criado_por, titulo, tipo, descricao, inicio_em, fim_em, local_nome, lat, lng, status)
values ('a0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000004',
  'Evento concorrente', 'encontro', 'Encontro público no parque', now() + interval '2 days',
  now() + interval '2 days 2 hours', 'Parque', -22, -43, 'publicado');
'@
  "$auth`n$schema`n$avisos`n$eventos`n$migracao`n$fixture" | docker exec -i $Container psql -X -U supabase_admin -d $bancoTeste -v ON_ERROR_STOP=1 > $null
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao preparar schema de teste.' }

  $bloqueio = Nova-Conexao "begin; select id from public.events for update;"
  $processos += $bloqueio
  $bloqueio.StandardInput.WriteLine('\echo BLOQUEADO')
  $bloqueio.StandardInput.Flush()
  do { $linha = $bloqueio.StandardOutput.ReadLine(); if ($null -eq $linha) { throw 'Falha ao bloquear evento.' } } while ($linha -ne 'BLOQUEADO')

  foreach ($n in 1..3) {
    $usuario = 'a0000000-0000-4000-8000-' + $n.ToString().PadLeft(12,'0')
    $sql = "set application_name = 'petlive_denuncia_$n'; set statement_timeout = '20s'; set role authenticated; select set_config('request.jwt.claims', '{`"sub`":`"$usuario`"}', false); select public.evento_denunciar('a0000000-0000-4000-8000-000000000005', 'spam');"
    $p = Nova-Conexao $sql
    $p.StandardInput.Close()
    $processos += $p
  }
  $esperando = 0
  foreach ($tentativa in 1..30) {
    $esperando = docker exec $Container psql -X -U supabase_admin -d $bancoTeste -Atc "select count(*) from pg_stat_activity where datname = '$bancoTeste' and application_name like 'petlive_denuncia_%' and wait_event_type = 'Lock'"
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao conferir conexões.' }
    if ([int]$esperando -eq 3) { break }
    Start-Sleep -Milliseconds 100
  }
  if ([int]$esperando -ne 3) { throw 'As três denúncias não chegaram ao bloqueio simultaneamente.' }
  $bloqueio.StandardInput.WriteLine("commit;`n\q")
  $bloqueio.StandardInput.Close()
  foreach ($p in $processos) {
    if (-not $p.WaitForExit(25000)) { throw 'Conexão de teste não terminou.' }
    if ($p.ExitCode -ne 0) { throw $p.StandardError.ReadToEnd() }
  }
  $resultado = docker exec $Container psql -X -U supabase_admin -d $bancoTeste -Atc "select case when e.status = 'oculto' and (select count(*) from event_reports) = 3 and (select count(*) from notification_log) = 1 then 'OK' else 'FALHA' end from events e"
  if ($LASTEXITCODE -ne 0 -or $resultado -ne 'OK') { throw 'Três denúncias concorrentes não produziram a ocultação e um único aviso.' }
  Write-Output 'OK: três conexões simultâneas, evento oculto e um único aviso.'
} finally {
  foreach ($p in $processos) { if (-not $p.HasExited) { $p.Kill($true) }; $p.Dispose() }
  docker exec $Container dropdb -U supabase_admin --force $bancoTeste
  if ($LASTEXITCODE -ne 0) { throw "Falha ao remover banco descartável $bancoTeste" }
}
