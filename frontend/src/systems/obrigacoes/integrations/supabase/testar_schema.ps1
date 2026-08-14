# Valida o schema do modulo de Obrigacoes Acessorias num Postgres descartavel:
# aplica shim + migrations + seed e roda os testes de RLS, auth hook e motor de
# prazo. Requer apenas Docker Desktop rodando.
#
#   powershell -NoProfile -File frontend/src/systems/obrigacoes/integrations/supabase/testar_schema.ps1
#
# Este arquivo e mantido em ASCII puro de proposito: o PowerShell 5.1 le
# scripts sem BOM como ANSI, e acentos aqui quebrariam o parser. Os .sql tem
# acentos normalmente -- por isso vao para o container via `docker cp`, sem
# passar por pipe (o pipe do PS 5.1 reencoda e corromperia o UTF-8).

$ErrorActionPreference = 'Stop'

$container = 'mg-obrigacoes-test'
$image     = 'postgres:16-alpine'
$base      = $PSScriptRoot

function Invoke-Sql([string]$file) {
    $nome = Split-Path -Leaf $file
    docker cp $file "${container}:/tmp/$nome" | Out-Null
    docker exec -e PGCLIENTENCODING=UTF8 $container `
        psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -o /dev/null -f "/tmp/$nome"
    if ($LASTEXITCODE -ne 0) { throw "Falhou ao aplicar $nome" }
}

# Nao usar `2>$null` em executavel nativo: no PS 5.1 isso vira NativeCommandError
# e aborta o script mesmo com exit code 0. Checa a existencia antes de remover.
function Remove-Container {
    $existe = docker ps -aq --filter "name=^$container$"
    if ($existe) { docker rm -f $container | Out-Null }
}

Remove-Container

Write-Host "Subindo $image..." -ForegroundColor Cyan
docker run -d --name $container -e POSTGRES_PASSWORD=postgres -e POSTGRES_INITDB_ARGS="--encoding=UTF8" $image | Out-Null

$pronto = $false
foreach ($i in 1..60) {
    docker exec $container pg_isready -U postgres -q
    if ($LASTEXITCODE -eq 0) { $pronto = $true; break }
    Start-Sleep -Milliseconds 500
}
if (-not $pronto) { docker logs $container; throw 'Postgres nao subiu a tempo' }

try {
    Invoke-Sql "$base\tests\00_shim_supabase.sql"

    Get-ChildItem "$base\migrations\*.sql" | Sort-Object Name | ForEach-Object {
        Write-Host "  migration $($_.Name)" -ForegroundColor DarkGray
        Invoke-Sql $_.FullName
    }

    Write-Host "  seed" -ForegroundColor DarkGray
    Invoke-Sql "$base\seed.sql"

    foreach ($t in @('rls_dois_tenants', 'auth_hook', 'motor_prazo', 'painel', 'validacao',
                     'portal', 'baixa_recibo')) {
        Write-Host "Rodando teste: $t" -ForegroundColor Cyan
        Invoke-Sql "$base\tests\$t.sql"
    }

    Write-Host "OK - schema, seed, RLS, auth hook e motor de prazo validados." -ForegroundColor Green
}
finally {
    Remove-Container
}
