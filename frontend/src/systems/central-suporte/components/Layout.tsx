import { Topbar } from "@suporte/components/Topbar";
import { Outlet } from "@suporte/lib/router-shim";
import { NotificationBell } from "@suporte/components/NotificationBell";

const Layout = () => {
  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <Topbar />
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-6 lg:p-8 w-full space-y-8 animate-fade-in">
          <header className="flex items-center gap-4 mb-8">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-primary">Sistema de Gestão de Chamados</h1>
            </div>
            <NotificationBell />
          </header>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;


