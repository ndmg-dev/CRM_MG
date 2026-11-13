"""Importa clientes a partir da planilha "EMPRESAS MG.xlsx" (aba EMPRESAS ATUAIS).

Mapeia apenas os campos que já existem no modelo Cliente:
    RAZÃO               -> razao_social
    CNPJ                -> cnpj (normalizado para 14 dígitos, zero-padded)
    REGIME 2026         -> regime_tributario (enum RegimeTributario)
    INATIVA / ZERADA    -> status_cnpj (ou "ATIVA" quando vazio)

Idempotente por CNPJ: insere quem não existe e atualiza os campos mapeados de
quem já existe. Por segurança roda em dry-run; use --commit para gravar.

Uso:
    python -m scripts.import_clientes_xlsx "../EMPRESAS MG.xlsx"            # dry-run
    python -m scripts.import_clientes_xlsx "../EMPRESAS MG.xlsx" --commit   # grava
"""
import argparse
import asyncio
import re
import sys

from openpyxl import load_workbook

SHEET = "EMPRESAS ATUAIS"

# Colunas (índice 0-based) na aba EMPRESAS ATUAIS.
COL_REGIME = 1
COL_RAZAO = 2
COL_CNPJ = 3
COL_STATUS = 9  # "INATIVA / ZERADA"

# REGIME 2026 -> valor do enum RegimeTributario. MEI mapeia para Simples
# Nacional (é modalidade dentro do Simples). Texto não reconhecido -> None.
REGIME_MAP = {
    "LP": "LUCRO_PRESUMIDO",
    "SN": "SIMPLES_NACIONAL",
    "LR": "LUCRO_REAL",
    "MEI": "SIMPLES_NACIONAL",
    "SN - NORMAL ESTADO": "SIMPLES_NACIONAL",
}


def _norm_cnpj(value) -> str:
    """Só dígitos, com zero-padding à esquerda para 14 (Excel come os zeros)."""
    if value is None:
        return ""
    return re.sub(r"\D", "", str(value)).zfill(14)


def _clean(value) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def parse_rows(path: str) -> list[dict]:
    """Lê a planilha e devolve os clientes mapeados (função pura, sem banco)."""
    wb = load_workbook(path, read_only=True, data_only=True)
    if SHEET not in wb.sheetnames:
        raise ValueError(f"Aba '{SHEET}' não encontrada. Abas: {wb.sheetnames}")
    ws = wb[SHEET]

    clientes: list[dict] = []
    for row in list(ws.iter_rows(values_only=True))[1:]:  # pula cabeçalho
        razao = _clean(row[COL_RAZAO])
        if not razao:
            continue  # linha sem razão social = linha vazia/separadora

        cnpj = _norm_cnpj(row[COL_CNPJ])
        if len(cnpj) != 14 or cnpj == "0" * 14:
            continue  # sem CNPJ válido não há como cadastrar (cnpj é unique/not null)

        regime_raw = _clean(row[COL_REGIME])
        regime = REGIME_MAP.get(regime_raw.upper(), None) if regime_raw else None

        status = _clean(row[COL_STATUS]) or "ATIVA"

        clientes.append(
            {
                "razao_social": razao[:255],
                "cnpj": cnpj,
                "regime_tributario": regime,
                "status_cnpj": status[:100],
            }
        )
    return clientes


def _dedupe(clientes: list[dict]) -> list[dict]:
    """Remove CNPJs repetidos dentro da própria planilha (fica o último)."""
    by_cnpj: dict[str, dict] = {}
    for c in clientes:
        by_cnpj[c["cnpj"]] = c
    return list(by_cnpj.values())


async def _import(clientes: list[dict], commit: bool) -> None:
    # Imports de banco só aqui dentro, para o dry-run não exigir config/env.
    from sqlalchemy import select

    from app.db.session import AsyncSessionLocal
    from app.models.client import Cliente

    inserted = updated = unchanged = 0
    async with AsyncSessionLocal() as session:
        existentes = {
            c.cnpj: c
            for c in (await session.execute(select(Cliente))).scalars().all()
        }
        for dados in clientes:
            atual = existentes.get(dados["cnpj"])
            if atual is None:
                session.add(Cliente(**dados))
                inserted += 1
            else:
                mudou = False
                for campo, valor in dados.items():
                    if getattr(atual, campo) != valor:
                        setattr(atual, campo, valor)
                        mudou = True
                if mudou:
                    updated += 1
                else:
                    unchanged += 1

        if commit:
            await session.commit()
            print(f"\n✓ Gravado: {inserted} inseridos, {updated} atualizados, "
                  f"{unchanged} inalterados.")
        else:
            await session.rollback()
            print(f"\n[DRY-RUN] Seria gravado: {inserted} inseridos, "
                  f"{updated} atualizados, {unchanged} inalterados. "
                  f"Use --commit para efetivar.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Importa clientes do XLSX.")
    parser.add_argument("xlsx", help="Caminho do arquivo EMPRESAS MG.xlsx")
    parser.add_argument("--commit", action="store_true",
                        help="Grava no banco (sem isso, apenas simula).")
    parser.add_argument("--db", action="store_true",
                        help="Força checagem contra o banco mesmo em dry-run.")
    args = parser.parse_args()

    clientes = _dedupe(parse_rows(args.xlsx))
    com_regime = sum(1 for c in clientes if c["regime_tributario"])
    print(f"Clientes válidos na planilha: {len(clientes)} "
          f"({com_regime} com regime mapeado, "
          f"{len(clientes) - com_regime} sem regime).")
    for c in clientes[:5]:
        print("  exemplo:", c)

    if args.commit or args.db:
        asyncio.run(_import(clientes, commit=args.commit))
    else:
        print("\n[DRY-RUN sem banco] Parsing OK. "
              "Rode com --db para comparar com o banco, ou --commit para gravar.")


if __name__ == "__main__":
    sys.exit(main())
