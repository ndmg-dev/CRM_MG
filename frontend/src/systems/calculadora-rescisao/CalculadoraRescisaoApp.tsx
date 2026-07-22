import { Toaster as SonnerToaster } from 'sonner';
import { CalcNavProvider, useLocation } from '@calc/lib/nav';
import CalculadoraPage from '@calc/pages/CalculadoraPage';
import TabelasPage from '@calc/pages/TabelasPage';
import ReciboPage from '@calc/pages/ReciboPage';
import FolhaPage from '@calc/pages/FolhaPage';
import FeriasPage from '@calc/pages/FeriasPage';

/**
 * Ponto de entrada da Calculadora de Rescisão embutida no CRM.
 *
 * A navegação entre as telas (Calc, Tabelas, Recibo, Folha, Férias) é feita
 * por um shim de estado (CalcNavProvider) — sem <Router> aninhado, já que o
 * CRM já roda dentro de um BrowserRouter (react-router v7 proíbe aninhar).
 * Todo o sistema é escopado pela classe `.calc-root` (ver index.css).
 */
function CalcScreens() {
  const { pathname } = useLocation();
  switch (pathname) {
    case '/tabelas':
      return <TabelasPage />;
    case '/recibo':
      return <ReciboPage />;
    case '/folha':
      return <FolhaPage />;
    case '/ferias':
      return <FeriasPage />;
    case '/calc':
    default:
      return <CalculadoraPage />;
  }
}

export default function CalculadoraRescisaoApp() {
  return (
    <div className="calc-root">
      <CalcNavProvider initial="/calc">
        <CalcScreens />
      </CalcNavProvider>
      <SonnerToaster theme="dark" position="bottom-right" richColors />
    </div>
  );
}
