import { TRCTSectionHeader } from './TRCTSectionHeader';
import { TRCTFieldCell } from './TRCTFieldCell';

interface Props {
  colaborador: string;
  cpf: string;
}

export function EmployeeIdentificationSection({ colaborador, cpf }: Props) {
  return (
    <div>
      <TRCTSectionHeader title="Identificação do Trabalhador" />
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <TRCTFieldCell number="10" label="Nome do Trabalhador" value={colaborador} colSpan={3} />
            <TRCTFieldCell number="11" label="CPF" value={cpf} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
