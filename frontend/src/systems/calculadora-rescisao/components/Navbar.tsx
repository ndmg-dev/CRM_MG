import { Link, useLocation } from '@calc/lib/nav';

const navLinks = [
  { path: '/calc', label: 'Calculadora' },
  { path: '/tabelas', label: 'Tabelas' },
  { path: '/recibo', label: 'Recibo' },
];

export function Navbar() {
  const location = useLocation();

  return (
    <nav className="navbar-blur no-print">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/calc" className="group">
          <span className="text-base font-semibold text-foreground transition-colors group-hover:text-primary">
            Calculadora de Rescisões
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background-subtle'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
