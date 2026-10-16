import React, { useState, useRef, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ArrowUp, Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export const AppShell: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const [showScrollTop, setShowScrollTop] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const location = useLocation();

  const normalizedPath = location.pathname.replace(/\/+$/, '');
  const isDashboard = ['/admin', '/pm', '/tl', '/member'].includes(normalizedPath);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  // Check scroll position to display the scroll to top button
  const handleScroll = () => {
    const mainEl = mainRef.current;
    if (mainEl) {
      setShowScrollTop(mainEl.scrollTop > 180);
    } else {
      setShowScrollTop(window.scrollY > 180);
    }
  };

  // Reset scroll on route change
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    setShowScrollTop(false);
  }, [location.pathname]);

  // Global scroll listener fallback
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    if (mainRef.current) {
      mainRef.current.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f6f9]">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-shrink-0 transition-all duration-300">
        <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full z-50 shadow-modal">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col bg-[#f4f6f9]">
        {isDashboard && (
          <Topbar
            onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
            sidebarOpen={sidebarOpen}
          />
        )}
        {!isDashboard && (
          <button
            type="button"
            className="lg:hidden fixed top-3 left-3 z-30 p-2 rounded-xl bg-white/90 backdrop-blur-sm shadow-md border border-slate-200 text-slate-600 hover:text-slate-900 cursor-pointer"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open mobile menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <main
          ref={mainRef}
          onScroll={handleScroll}
          className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden scrollbar-thin relative z-0 scroll-smooth"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4 pb-8 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Floating Scroll to Top Button */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-20 right-6 z-40 flex items-center gap-1.5 px-3.5 py-2.5 rounded-full bg-slate-900/90 hover:bg-slate-900 text-white text-xs font-semibold shadow-xl hover:shadow-2xl border border-slate-700/60 backdrop-blur-md transition-all duration-200 hover:-translate-y-1 active:translate-y-0 group cursor-pointer animate-fade-in"
          title="Scroll back to top"
          aria-label="Scroll back to top"
        >
          <ArrowUp className="w-4 h-4 transition-transform duration-200 group-hover:-translate-y-0.5 text-teal-400" />
          <span className="hidden sm:inline">Top</span>
        </button>
      )}
    </div>
  );
};
