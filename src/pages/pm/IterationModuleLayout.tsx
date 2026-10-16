import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, NavLink } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Layers, LayoutDashboard, LayoutGrid, BarChart3 } from 'lucide-react';
import type { Project } from '../../types';

export type IterationNavId = 'iterations' | 'completed' | 'live-iteration' | 'iteration-board' | 'reports';

interface IterationNavItem {
  id: IterationNavId;
  label: string;
  icon: React.ElementType;
  to: string;
}

// Base module URL + back-to-project URL, derived from the current path so every
// role/param pattern (pm/:key, pm/:key/:name, admin, tl, member) resolves correctly.
export const resolveIterationPaths = (pathname: string): { basePath: string; backUrl: string } => {
  const idx = pathname.indexOf('/iterations');
  return {
    basePath: idx >= 0 ? pathname.substring(0, idx) + '/iterations' : '/iterations',
    backUrl: idx > 0 ? pathname.substring(0, idx) : '/',
  };
};

export const resolveIterationNavId = (pathname: string): IterationNavId => {
  const p = pathname.replace(/\/+$/, '');
  if (p.endsWith('/completed')) return 'completed';
  if (p.endsWith('/live-iteration') || p.endsWith('/active-sprint')) return 'live-iteration';
  if (p.endsWith('/iteration-board')) return 'iteration-board';
  if (p.endsWith('/reports')) return 'reports';
  return 'iterations';
};

export const useIterationPaths = (): { basePath: string; backUrl: string } => {
  const location = useLocation();
  return useMemo(() => resolveIterationPaths(location.pathname), [location.pathname]);
};

// Navigation destinations: Iterations | Live Iteration | Iteration Board |
// Reports — the Completed Iterations history view is NOT a module nav tab; it
// is opened from the Iterations toolbar's "Completed Iterations" action, which
// navigates to `<basePath>/completed`.
const buildIterationNavItems = (basePath: string): IterationNavItem[] => [
  { id: 'iterations', label: 'Iterations', icon: Layers, to: basePath },
  { id: 'live-iteration', label: 'Live Iteration', icon: LayoutDashboard, to: `${basePath}/live-iteration` },
  { id: 'iteration-board', label: 'Iteration Board', icon: LayoutGrid, to: `${basePath}/iteration-board` },
  { id: 'reports', label: 'Reports', icon: BarChart3, to: `${basePath}/reports` },
];

interface IterationModuleLayoutProps {
  project: Project;
  children: React.ReactNode;
}

export const IterationModuleLayout: React.FC<IterationModuleLayoutProps> = ({ project, children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { backUrl } = useIterationPaths();
  const activeId = resolveIterationNavId(location.pathname);
  const navItems = useMemo(
    () => buildIterationNavItems(resolveIterationPaths(location.pathname).basePath),
    [location.pathname]
  );

  // The module nav row (Iterations | Live Iteration | …) is visible by
  // default — the chevron beside the page title collapses/expands it in
  // place.
  const [navOpen, setNavOpen] = useState(true);
  const navRef = useRef<HTMLDivElement>(null);

  // Collapse when clicking outside the breadcrumb + nav area, or pressing Escape
  // (same interaction pattern as the previous dropdown).
  useEffect(() => {
    if (!navOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setNavOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [navOpen]);

  return (
    <div className="min-w-0 -mt-2 flex flex-col">
      <div ref={navRef}>
        {/* Breadcrumb row: Back to Project | <Project Name> | Iterations ▼ */}
        <div className="flex-shrink-0 flex items-center gap-2.5 flex-wrap pb-1">
          <button
            onClick={() => navigate(backUrl)}
            className="flex items-center gap-1.5 text-xs font-medium text-[#5f6368] hover:text-[#1a73e8] transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Project
          </button>

          <div className="w-px h-4 bg-slate-300 flex-shrink-0" />

          <span className="text-sm font-semibold text-[#5f6368] truncate max-w-[220px] flex-shrink-0">
            {project.name}
          </span>

          <div className="w-px h-4 bg-slate-300 flex-shrink-0" />

          <h1 className="text-lg font-bold text-[#1f1f1f] tracking-tight font-display flex-shrink-0">
            Iterations
          </h1>

          {/* Chevron toggle: expands/collapses the module nav row below. */}
          <button
            type="button"
            onClick={() => setNavOpen((o) => !o)}
            aria-expanded={navOpen}
            aria-controls="iteration-module-nav"
            aria-label={navOpen ? 'Collapse iteration navigation' : 'Expand iteration navigation'}
            title={navOpen ? 'Hide navigation' : 'Show navigation'}
            className="p-1 -m-0.5 rounded-md text-[#5f6368] hover:text-[#1a73e8] hover:bg-[#f0f7ff] transition-colors cursor-pointer flex-shrink-0"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${navOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {/* Module navigation — the segmented row (Iterations | Live
            Iteration | Iteration Board | Reports), visible by default at the
            top of the page; the chevron collapses/expands it in place with a
            subtle height + fade transition. The Completed Iterations history
            view is opened from the toolbar action instead. */}
        <nav
          id="iteration-module-nav"
          aria-label="Iteration module navigation"
          className={`grid transition-all duration-200 ease-out ${
            navOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
          }`}
        >
          <div className="overflow-hidden min-h-0">
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 mb-2 flex-wrap">
              {navItems.map((item) => {
                // The Completed history view has no tab of its own — it keeps
                // the Iterations tab highlighted while it is open.
                const isActive =
                  activeId === item.id || (activeId === 'completed' && item.id === 'iterations');
                return (
                  <NavLink
                    key={item.id}
                    to={item.to}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      isActive
                        ? 'bg-white shadow-xs text-[#1a73e8]'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                    }`}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </nav>
      </div>

      {children}
    </div>
  );
};
