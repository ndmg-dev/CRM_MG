import { SidebarProvider, SidebarTrigger } from "@suporte/components/ui/sidebar";
import { AppSidebar } from "@suporte/components/AppSidebar";
import { Outlet } from "@suporte/lib/router-shim";
import { NotificationBell } from "@suporte/components/NotificationBell";

const Layout = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 lg:p-8 w-full space-y-8 animate-fade-in">
            <header className="flex items-center gap-4 mb-8">
              <SidebarTrigger className="md:hidden" />
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-primary">Sistema de Gestão de Chamados</h1>
              </div>
              <NotificationBell />
            </header>
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Layout;


