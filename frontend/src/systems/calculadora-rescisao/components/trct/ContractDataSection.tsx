import { TRCTSectionHeader } from './TRCTSectionHeader';
import { TRCTFieldCell } from './TRCTFieldCell';

interface Props {
  causaAfastamento: string;
  dataAdmissao: string;
  dataAfastamento: string;
  codigoAfastamento: string;
}

export function ContractDataSection({
  causaAfastamento,
  dataAdmissao,
  dataAfastamento,
  codigoAfastamento,
}: Props) {
  return (
    <div>
      <TRCTSectionHeader title="Dados do Contrato" />
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <TRCTFieldCell number="21" label="Causa do Afastamento" value={causaAfastamento} colSpan={2} />
            <TRCTFieldCell number="22" label="Cód. Afastamento" value={codigoAfastamento} />
          </tr>
          <tr>
            <TRCTFieldCell number="23" label="Data de Admissão" value={dataAdmissao} />
            <TRCTFieldCell number="24" label="Data de Afastamento" value={dataAfastamento} />
            <TRCTFieldCell number="25" label="" value="" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
