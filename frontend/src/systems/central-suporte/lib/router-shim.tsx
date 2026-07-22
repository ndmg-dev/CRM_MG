import React, { createContext, useContext, useState, useEffect, ReactNode, forwardRef } from "react";

interface RouterContextType {
  pathname: string;
  navigate: (to: string) => void;
  currentOutlet: ReactNode | null;
  setCurrentOutlet: (outlet: ReactNode | null) => void;
}

const RouterContext = createContext<RouterContextType>({
  pathname: "/",
  navigate: () => {},
  currentOutlet: null,
  setCurrentOutlet: () => {},
});

export function SupportRouterProvider({ children, initial = "/" }: { children: ReactNode; initial?: string }) {
  const [pathname, setPathname] = useState(initial);
  const [currentOutlet, setCurrentOutlet] = useState<ReactNode | null>(null);

  const navigate = (to: string) => {
    setPathname(to);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0 });
    }
  };

  return (
    <RouterContext.Provider value={{ pathname, navigate, currentOutlet, setCurrentOutlet }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useNavigate() {
  const { navigate } = useContext(RouterContext);
  return navigate;
}

export function useLocation() {
  const { pathname } = useContext(RouterContext);
  return { pathname };
}

export function Routes({ children }: { children: ReactNode }) {
  const { pathname, setCurrentOutlet } = useContext(RouterContext);
  
  const routesArray = React.Children.toArray(children) as React.ReactElement<any>[];
  
  let matchedElement: ReactNode = null;
  let matchedRoute: React.ReactElement<any> | null = null;

  // 1. Find exact path match (excluding wildcard)
  for (const route of routesArray) {
    const { path } = route.props;
    if (path === pathname) {
      matchedElement = route.props.element;
      matchedRoute = route;
      break;
    }
  }

  // 2. Find prefix match for nested routes (e.g., path="/portal" matches "/portal/new-ticket")
  if (!matchedRoute) {
    for (const route of routesArray) {
      const { path } = route.props;
      if (path && path !== "/" && (pathname === path || pathname.startsWith(path + "/"))) {
        matchedElement = route.props.element;
        matchedRoute = route;
        break;
      }
    }
  }

  // 3. Fallback to wildcard '*'
  if (!matchedRoute) {
    for (const route of routesArray) {
      const { path } = route.props;
      if (path === "*") {
        matchedElement = route.props.element;
        matchedRoute = route;
        break;
      }
    }
  }

  // Handle nested rendering in Outlets
  useEffect(() => {
    if (matchedRoute && matchedRoute.props.children) {
      const childrenArray = React.Children.toArray(matchedRoute.props.children) as React.ReactElement<any>[];
      const basePath = matchedRoute.props.path || "";
      const subPath = pathname.substring(basePath.length); // e.g. "/new-ticket"
      const relativeSubPath = subPath.replace(/^\//, ""); // e.g. "new-ticket"

      let childElement: ReactNode = null;

      for (const child of childrenArray) {
        const childPath = child.props.path;
        const isIndex = child.props.index;

        if (isIndex && (relativeSubPath === "" || relativeSubPath === "/")) {
          childElement = child.props.element;
          break;
        } else if (childPath === relativeSubPath) {
          childElement = child.props.element;
          break;
        }
      }

      setCurrentOutlet(childElement);
    } else {
      setCurrentOutlet(null);
    }
  }, [pathname, matchedRoute, setCurrentOutlet]);

  return matchedElement;
}

export function Route({ path, index, element, children }: { path?: string; index?: boolean; element: ReactNode; children?: ReactNode }) {
  return <>{element}</>;
}

export function Outlet() {
  const { currentOutlet } = useContext(RouterContext);
  return <>{currentOutlet}</>;
}

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  ({ to, children, className, onClick, ...props }, ref) => {
    const navigate = useNavigate();
    return (
      <a
        ref={ref}
        href="#"
        className={className}
        onClick={(e) => {
          e.preventDefault();
          if (onClick) onClick(e);
          navigate(to);
        }}
        {...props}
      >
        {children}
      </a>
    );
  }
);
Link.displayName = "Link";

export interface NavLinkProps extends Omit<LinkProps, "className" | "children"> {
  children: React.ReactNode | ((props: { isActive: boolean; isPending: boolean }) => React.ReactNode);
  className?: string | ((props: { isActive: boolean; isPending: boolean }) => string);
}

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ to, children, className, onClick, ...props }, ref) => {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    
    const isActive = pathname === to || (to !== "/" && pathname.startsWith(to + "/"));
    const isPending = false;

    const computedClassName = typeof className === "function" 
      ? className({ isActive, isPending }) 
      : className;

    const computedChildren = typeof children === "function"
      ? children({ isActive, isPending })
      : children;

    return (
      <a
        ref={ref}
        href="#"
        className={computedClassName}
        onClick={(e) => {
          e.preventDefault();
          if (onClick) onClick(e);
          navigate(to);
        }}
        {...props}
      >
        {computedChildren}
      </a>
    );
  }
);
NavLink.displayName = "NavLink";
