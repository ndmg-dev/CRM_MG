import logoRecibo from '@calc/assets/logo-recibo.png';

export function RescissionHeader() {
  return (
    <div className="border-2 border-gray-500 mb-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-400">
        <img src={logoRecibo} alt="Mendonça Galvão" className="h-10 w-auto object-contain" />
        <div className="text-center flex-1">
          <h1 className="text-xs font-bold uppercase tracking-widest">
            Termo de Rescisão do Contrato de Trabalho
          </h1>
        </div>
      </div>
    </div>
  );
}
