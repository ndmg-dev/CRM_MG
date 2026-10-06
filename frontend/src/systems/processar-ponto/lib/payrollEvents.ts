// Converte o resultado já processado do Processar Ponto (Employee, do
// schema do espelho de ponto) nos "eventos consolidados" que a integração
// com o Domínio espera (PayrollEvent) — nunca batidas brutas, só os totais
// por tipo de evento, igual INTEGRACAO_DOMINIO_FOLHA_API.md §1/§10.
//
// O PDF do ponto não tem CPF (ver documento, §9) — o "employeeCpf" aqui é só
// informativo; o CPF usado de verdade no envio vem do cadastro complementar
// (DominioEmployeeProfile), configurado à parte por colaborador.

import type { Employee } from "@ponto/types/point";
import type { PayrollEvent } from "./dominioApi";

function hhmmToMinutes(value: string): number {
  if (!value) return 0;
  const negativo = value.trim().startsWith("-");
  const limpo = value.replace("-", "");
  const [h, m] = limpo.split(":").map(Number);
  const total = (h || 0) * 60 + (m || 0);
  return negativo ? -total : total;
}

function isoDate(diaMes: string, competence: string): string {
  // diaMes vem como "dd/mm" do parser do espelho de ponto.
  const [dia, mes] = diaMes.split("/");
  const ano = competence.slice(0, 4);
  return `${ano}-${mes}-${dia}`;
}

export function buildPayrollEvents(employee: Employee, competence: string): PayrollEvent[] {
  const employeeId = employee.matricula || employee.id;
  const employeeCpf = (employee.cpf || "").replace(/\D/g, "");
  const events: PayrollEvent[] = [];

  const pushHoras = (eventType: string, minutos: number) => {
    if (minutos > 0) {
      events.push({ employeeId, employeeCpf, competence, eventType, amountMinutes: minutos });
    }
  };

  pushHoras("OVERTIME_50", hhmmToMinutes(employee.summary.overtime_50));
  pushHoras("OVERTIME_100", hhmmToMinutes(employee.summary.overtime_100));
  pushHoras("NIGHT_ADDITIONAL", hhmmToMinutes(employee.summary.night_additional_total));
  pushHoras("DSR", hhmmToMinutes(employee.summary.dsr_discount));

  const diasFaltaIntegral = employee.records.filter((r) => r.status === "FALTA_INTEGRAL");
  const minutosFaltaIntegral = diasFaltaIntegral.reduce((acc, r) => acc + r.discounted_minutes, 0);
  if (minutosFaltaIntegral > 0) {
    events.push({
      employeeId,
      employeeCpf,
      competence,
      eventType: "FULL_ABSENCE",
      amountMinutes: minutosFaltaIntegral,
      missedDays: diasFaltaIntegral.map((r) => isoDate(r.date, competence)),
    });
  }

  const minutosFaltaParcial = employee.records
    .filter((r) => r.status === "FALTA_PARCIAL")
    .reduce((acc, r) => acc + r.discounted_minutes, 0);
  if (minutosFaltaParcial > 0) {
    events.push({ employeeId, employeeCpf, competence, eventType: "PARTIAL_ABSENCE", amountMinutes: minutosFaltaParcial });
  }

  return events;
}

export function buildPayrollEventsForAll(employees: Employee[], competence: string): PayrollEvent[] {
  return employees.flatMap((e) => buildPayrollEvents(e, competence));
}
