import { Topbar } from "@suporte/components/Topbar";
import { Outlet } from "@suporte/lib/router-shim";

const Layout = () => {
  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <Topbar />
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-6 lg:p-8 w-full space-y-8 animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;


