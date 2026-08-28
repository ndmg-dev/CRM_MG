import { useEffect } from "react";
import { Toaster } from "@suporte/components/ui/toaster";
import { Toaster as Sonner } from "@suporte/components/ui/sonner";
import { TooltipProvider } from "@suporte/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SupportRouterProvider, Routes, Route } from "@suporte/lib/router-shim";
import Portal from "./pages/portal/PortalHome";
import Layout from "./components/Layout";
import KanbanBoard from "./pages/admin/KanbanBoard";
import AdminSettings from "./pages/admin/AdminSettings";
import Incidents from "./pages/admin/Incidents";
import Reports from "./pages/admin/Reports";
import TicketConsultation from "./pages/admin/TicketConsultation";
import Tasks from "./pages/admin/Tasks";
import NewTicket from "./pages/portal/NewTicket";
import NewTicketTI from "./pages/portal/NewTicketTI";
import NewTicketChat from "./pages/portal/NewTicketChat";
import MyTickets from "./pages/portal/MyTickets";
import NotFound from "./pages/NotFound";
import { requestBrowserNotificationPermission } from "@suporte/hooks/useBrowserNotifications";
import { SupportSessionGate } from "@suporte/components/auth/SupportSessionGate";
import { useSyncProfilePhoto } from "@suporte/hooks/useSyncProfilePhoto";
const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    requestBrowserNotificationPermission();
  }, []);
  // Sincroniza a foto do Google pra `profiles` a cada abertura do sistema —
  // ver hooks/useSyncProfilePhoto.ts.
  useSyncProfilePhoto();

  return (
  <div className="suporte-root min-h-screen bg-background text-foreground">
    <SupportSessionGate>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <SupportRouterProvider initial="/portal">
          <Routes>
            <Route path="/portal" element={<Layout />}>
              <Route index element={<Portal />} />
              <Route path="new-ticket" element={<NewTicket />} />
              {/* Abertura de chamado TI em formato de chat (perguntas
                  guiadas) — substituiu o formulário pra atacar o problema de
                  categoria errada na abertura. O formulário antigo segue
                  acessível pela rota abaixo (fora dos menus) enquanto o novo
                  fluxo é validado; remover quando não for mais necessário. */}
              <Route path="new-ticket-ti" element={<NewTicketChat />} />
              <Route path="new-ticket-ti-formulario" element={<NewTicketTI />} />
              <Route path="my-tickets" element={<MyTickets />} />
            </Route>
            <Route path="/admin" element={<Layout />}>
              <Route path="kanban" element={<KanbanBoard />} />
              <Route path="incidents" element={<Incidents />} />
              <Route path="reports" element={<Reports />} />
              <Route path="consultation" element={<TicketConsultation />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SupportRouterProvider>
      </TooltipProvider>
    </QueryClientProvider>
    </SupportSessionGate>
  </div>
  );
};
export default App;

