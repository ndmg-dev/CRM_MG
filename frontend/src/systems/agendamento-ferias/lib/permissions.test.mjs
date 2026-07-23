import assert from "node:assert/strict";
import test from "node:test";
import {
  canDecideRequest,
  canDeleteRequest,
  canLaunchFor,
  getFeriasPermissions,
  normalizeSector,
} from "./permissions.js";

const admin = { perfil: "Administrador", setor: "Global", email: "admin@mendoncagalvao.com.br" };
const manager = { perfil: "Gestor", setor: "Global", email: "gestor@mendoncagalvao.com.br" };
const coordinator = { perfil: "Coordenador", setor: "Departamento Pessoal", email: "coord@mendoncagalvao.com.br" };
const analyst = { perfil: "Analista", setor: "Fiscal", email: "ana@mendoncagalvao.com.br" };
const dpCollaborator = { setor: "DP", email: "pessoa@mendoncagalvao.com.br" };
const fiscalAnalyst = { setor: "Fiscal", email: "ana@mendoncagalvao.com.br" };

test("normaliza aliases e setores legados com perfil no nome", () => {
  assert.equal(normalizeSector("DP"), "DEPARTAMENTO PESSOAL");
  assert.equal(normalizeSector("Coordenador DP"), "DEPARTAMENTO PESSOAL");
  assert.equal(normalizeSector("Contábil"), "CONTABIL");
});

test("administrador e gestor operam todos os setores", () => {
  assert.equal(canLaunchFor(admin, dpCollaborator), true);
  assert.equal(canDecideRequest(manager, { setor: "Fiscal" }), true);
});

test("coordenador opera somente o próprio setor", () => {
  assert.equal(canLaunchFor(coordinator, dpCollaborator), true);
  assert.equal(canDecideRequest(coordinator, { setor: "DP" }), true);
  assert.equal(canDecideRequest(coordinator, { setor: "Fiscal" }), false);
});

test("analista lança somente para si e nunca decide", () => {
  assert.equal(canLaunchFor(analyst, fiscalAnalyst), true);
  assert.equal(canLaunchFor(analyst, { ...fiscalAnalyst, email: "outra@mendoncagalvao.com.br" }), false);
  assert.equal(canDecideRequest(analyst, { setor: "Fiscal" }), false);
});

test("somente administrador exclui solicitações e gerencia usuários", () => {
  assert.equal(canDeleteRequest(admin), true);
  assert.equal(canDeleteRequest(manager), false);
  assert.equal(getFeriasPermissions(admin).canManageUsers, true);
  assert.equal(getFeriasPermissions(manager).canManageUsers, false);
});
