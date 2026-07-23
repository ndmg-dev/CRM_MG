const PROFILE_PREFIX = /^(ADMINISTRADOR|COORDENADOR|GESTOR|ANALISTA)\s+/;

export function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

export function normalizeSector(value) {
  const normalized = normalizeText(value).replace(PROFILE_PREFIX, "");
  const aliases = {
    DP: "DEPARTAMENTO PESSOAL",
    RH: "RECURSOS HUMANOS",
    TI: "TECNOLOGIA DA INFORMACAO",
    CONTABILIDADE: "CONTABIL",
  };
  return aliases[normalized] || normalized;
}

export function getFeriasPermissions(user) {
  const profile = normalizeText(user?.perfil);
  const isAdmin = profile.includes("ADMINISTRADOR") || profile === "ADMIN";
  const isManager = profile.includes("GESTOR");
  const isCoordinator = profile.includes("COORDENADOR");
  const isAnalyst = profile.includes("ANALISTA");

  return {
    isAdmin,
    isManager,
    isCoordinator,
    isAnalyst,
    canManageAll: isAdmin || isManager,
    canManageUsers: isAdmin,
    canConfigure: isAdmin,
  };
}

export function isSameUser(user, collaborator) {
  return normalizeText(user?.email) !== ""
    && normalizeText(user?.email) === normalizeText(collaborator?.email);
}

export function canViewCollaborator(user, collaborator) {
  const access = getFeriasPermissions(user);
  if (access.canManageAll) return true;
  if (access.isCoordinator) {
    return normalizeSector(user?.setor) === normalizeSector(collaborator?.setor);
  }
  return access.isAnalyst && isSameUser(user, collaborator);
}

export function canLaunchFor(user, collaborator) {
  return canViewCollaborator(user, collaborator);
}

export function canDecideRequest(user, request) {
  const access = getFeriasPermissions(user);
  if (access.canManageAll) return true;
  if (!access.isCoordinator) return false;
  const requestSector = request?.colaboradores?.setor || request?.setor;
  return normalizeSector(user?.setor) === normalizeSector(requestSector);
}

export function canEditRequest(user, request) {
  return normalizeText(request?.status) === "PENDENTE"
    && canDecideRequest(user, request);
}

export function canDeleteRequest(user) {
  return getFeriasPermissions(user).isAdmin;
}
