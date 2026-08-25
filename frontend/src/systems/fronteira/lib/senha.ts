// Espelha a política de senha do backend (app/schemas/password.py). A validação
// aqui é só para dar retorno imediato ao usuário — o servidor continua sendo a
// autoridade e rejeita com 422 se algo passar.
export const SENHA_MIN_LEN = 10;

export const SENHA_REQUISITOS =
  "Mínimo 10 caracteres, com maiúscula, minúscula, número e caractere especial.";

/** Devolve a mensagem de erro, ou null se a senha atende à política. */
export function validarForcaSenha(senha: string): string | null {
  const faltando: string[] = [];

  if (senha.length < SENHA_MIN_LEN) faltando.push(`no mínimo ${SENHA_MIN_LEN} caracteres`);
  if (!/[A-Z]/.test(senha)) faltando.push("uma letra maiúscula");
  if (!/[a-z]/.test(senha)) faltando.push("uma letra minúscula");
  if (!/[0-9]/.test(senha)) faltando.push("um número");
  if (!/[^A-Za-z0-9]/.test(senha)) faltando.push("um caractere especial");

  return faltando.length ? `A senha deve conter ${faltando.join(", ")}.` : null;
}
