import { Tooltip } from "@fronteira-ui";

const TEXTO =
  "O perfil da empresa é o mesmo em todo o sistema — só o valor usado no cálculo muda conforme o módulo:\n\n" +
  "[Front] Fronteira: percentual de agregação, aplicado como multiplicador à base antes de calcular o imposto.\n\n" +
  "[Antec] Antecipação interna: alíquota efetiva, aplicada diretamente sobre a base para calcular o imposto.";

/** Ícone "?" com tooltip explicando que Perfil tem significado diferente em
 * cada módulo (agregação no fronteira, alíquota efetiva na antecipação). */
export function PerfilInfoIcon() {
  return (
    <Tooltip variant="highlight" content={<span style={{ whiteSpace: "pre-line" }}>{TEXTO}</span>}>
      <span
        aria-label="O que é o perfil?"
        tabIndex={0}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: "1px solid #f59e0b",
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1,
          color: "#f59e0b",
          cursor: "help",
          marginLeft: 6,
        }}
      >
        ?
      </span>
    </Tooltip>
  );
}
