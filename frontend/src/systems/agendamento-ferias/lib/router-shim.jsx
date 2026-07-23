import React, { createContext, forwardRef, useContext, useEffect, useState } from "react";

const RouterContext = createContext({ pathname: "/", navigate: () => {} });

export function FeriasRouterProvider({ children, initial = "/" }) {
  const [pathname, setPathname] = useState(initial);

  const navigate = (to) => {
    setPathname(to);
    window.scrollTo({ top: 0 });
  };

  return (
    <RouterContext.Provider value={{ pathname, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useNavigate() {
  return useContext(RouterContext).navigate;
}

export function useLocation() {
  return { pathname: useContext(RouterContext).pathname };
}

export function Routes({ children }) {
  const { pathname } = useContext(RouterContext);
  const routes = React.Children.toArray(children);
  const match = routes.find((route) => route.props.path === pathname)
    || routes.find((route) => route.props.path === "*");
  return match?.props.element || null;
}

export function Route() {
  return null;
}

export function Navigate({ to }) {
  const navigate = useNavigate();
  useEffect(() => navigate(to), [navigate, to]);
  return null;
}

export const Link = forwardRef(function Link(
  { to, children, className, onClick, ...props },
  ref,
) {
  const navigate = useNavigate();
  return (
    <a
      ref={ref}
      href="#"
      className={className}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
        navigate(to);
      }}
      {...props}
    >
      {children}
    </a>
  );
});
