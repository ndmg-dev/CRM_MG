import { TRCTSectionHeader } from './TRCTSectionHeader';
import { TRCTFieldCell } from './TRCTFieldCell';

interface Props {
  cnpj: string;
  empresa: string;
}

export function EmployerIdentificationSection({ cnpj, empresa }: Props) {
  return (
    <div>
      <TRCTSectionHeader title="Identificação do Empregador" />
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <TRCTFieldCell number="01" label="CNPJ / CEI" value={cnpj} />
            <TRCTFieldCell number="02" label="Razão Social / Nome" value={empresa} colSpan={3} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
