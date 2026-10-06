import { Routes, Route, Outlet } from "react-router-dom";
import { UploadPage } from "@ponto/pages/UploadPage";
import { ResultPage } from "@ponto/pages/ResultPage";
import { EmployeeDetailPage } from "@ponto/pages/EmployeeDetailPage";
import { DominioSettingsPage } from "@ponto/pages/DominioSettingsPage";
import { DominioExportPage } from "@ponto/pages/DominioExportPage";

export default function ProcessarPontoApp() {
  return (
    <div className="ponto-root min-h-screen bg-background text-textPrimary">
      <main className="container mx-auto p-4 py-8">
        {/* Rotas aninhadas de verdade (via Outlet) para que os links "voltar"
            relativos (Link to="..") subam pelo nível de rota correto. */}
        <Routes>
          <Route index element={<UploadPage />} />
          <Route path="configuracoes/dominio" element={<DominioSettingsPage />} />
          <Route path="result/:uploadId" element={<Outlet />}>
            <Route index element={<ResultPage />} />
            <Route path="employee/:employeeId" element={<EmployeeDetailPage />} />
            <Route path="dominio" element={<DominioExportPage />} />
          </Route>
        </Routes>
      </main>
    </div>
  );
}
