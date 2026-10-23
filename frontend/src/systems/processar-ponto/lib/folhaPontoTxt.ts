// Gera a "Folha de Ponto" preenchida em .txt, uma por colaborador, a partir
// do resultado já processado do espelho de ponto. Layout replicado do
// modelo em uso pelo escritório (arquivo de referência: modelo_folha_de_ponto.doc) —
// colunas separadas por tabulação, pensado pra impressão/assinatura física:
//
//   Folha de Ponto - Período: __/__
//   Empregador(a) — Nome / CPF
//   Empregado(a) — Nome / CPF, Cargo / CTPS
//   Dia | Entrada | Início do Intervalo | Fim do Intervalo | Saída | Hora Extra | Assinatura
//
// Cada colaborador vira uma folha; várias folhas no mesmo arquivo ficam
// separadas por form feed (\f), convenção de "quebra de página" em texto
// puro — útil tanto pra impressão quanto pra localizar cada folha no editor.

import type { Employee, PointRecord, UploadResult } from "@ponto/types/point";

// Só os status que tomam o dia inteiro (sem marcação de horário) viram um
// rótulo na coluna "Entrada" — os demais (TRABALHADO, MARCACAO_IMPAR,
// ATESTADO_PARCIAL, FALTA_PARCIAL) mostram os horários batidos de verdade.
const STATUS_DIA_INTEIRO: Record<string, string> = {
  DOMINGO: "DOMINGO",
  SABADO: "FOLGA (SÁBADO)",
  FERIADO: "FERIADO",
  ATESTADO_INTEGRAL: "ATESTADO",
  FALTA_INTEGRAL: "FALTA",
};

const CABECALHO_TABELA = [
  "Dia",
  "Entrada",
  "Início do Intervalo",
  "Fim do Intervalo",
  "Saída",
  "Hora Extra",
  "Assinatura do Empregado(a)",
].join("\t");

function diaDoRegistro(record: PointRecord): number | null {
  const [dia] = record.date.split("/");
  const n = Number(dia);
  return Number.isFinite(n) ? n : null;
}

function linhaDoDia(dia: number, record?: PointRecord): string {
  if (!record) {
    return [dia, "", "", "", "", "", ""].join("\t");
  }
  const rotulo = STATUS_DIA_INTEIRO[record.status];
  if (rotulo) {
    return [dia, rotulo, "", "", "", "", ""].join("\t");
  }
  return [
    dia,
    record.first_period_entry || "",
    record.first_period_exit || "",
    record.second_period_entry || "",
    record.second_period_exit || "",
    // Hora Extra fica em branco de propósito: o espelho traz o total do mês
    // (summary.overtime_50/70/100), não um valor diário confiável por si
    // só — preencher aqui exigiria recalcular jornada esperada x
    // trabalhada dia a dia, o que fica fácil de divergir do valor oficial
    // do resumo. Mais seguro deixar em branco do que arriscar um número
    // errado num documento assinado pelo colaborador.
    "",
    "",
  ].join("\t");
}

function folhaDoColaborador(employee: Employee, periodo: string, empresa: string, empresaDocumento: string): string {
  const porDia = new Map<number, PointRecord>();
  for (const r of employee.records) {
    const dia = diaDoRegistro(r);
    if (dia !== null) porDia.set(dia, r);
  }

  const linhas: string[] = [];
  linhas.push(`Folha de Ponto - Período:\t${periodo}`);
  linhas.push("");
  linhas.push("Empregador(a)");
  linhas.push(`Nome:\t${empresa}\tCPF:\t${empresaDocumento}`);
  linhas.push("");
  linhas.push("Empregado(a)");
  linhas.push(`Nome:\t${employee.name}\tCPF:\t${employee.cpf}`);
  linhas.push(`Cargo:\t${employee.role}\tCTPS:\t`);
  linhas.push("");
  linhas.push(CABECALHO_TABELA);
  for (let dia = 1; dia <= 31; dia++) {
    linhas.push(linhaDoDia(dia, porDia.get(dia)));
  }
  return linhas.join("\n");
}

export function buildFolhasDePontoTxt(data: UploadResult): string {
  const periodo = data.period_start && data.period_end ? `${data.period_start} a ${data.period_end}` : "/";
  const empresa = data.company_name || "";
  const empresaDocumento = data.company_cnpj || "";

  return data.employees
    .map((e) => folhaDoColaborador(e, periodo, empresa, empresaDocumento))
    .join("\n\f\n");
}

export function downloadFolhasDePontoTxt(data: UploadResult): void {
  const conteudo = buildFolhasDePontoTxt(data);
  // BOM UTF-8 na frente: sem ele, acentos (é, ã, ç) aparecem corrompidos em
  // editores que assumem Latin-1/ANSI por padrão ao abrir um .txt puro
  // (ex.: Bloco de Notas do Windows em versões mais antigas).
  const blob = new Blob(["﻿" + conteudo], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `folhas_de_ponto_${data.upload_id}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
