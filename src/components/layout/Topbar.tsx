import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search, Bell, ChevronDown, LogOut, Settings, User, Menu, X,
  Grid, LayoutDashboard, CalendarRange, FolderKanban, CheckSquare,
  UsersRound, Bug, Activity, ListTodo, Plus, Sparkles,
  ExternalLink, ShieldCheck, Check, Layers, Command, ClipboardList, Flag
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { useOrganizationBranding } from '../../store/adminSettingsStore';
import { Avatar } from '../common/Avatar';
import { getRoleLabel, getDashboardPath } from '../../utils/roleUtils';
import { formatTimeAgo } from '../../utils/dateUtils';
import { getProjectUrl } from '../../utils/idUtils';
import { issuePath } from '../../utils/issueUrl';
import { demoCredentials } from '../../data/mockData';
import { toast } from 'sonner';

interface TopbarProps {
  onMenuToggle: () => void;
  sidebarOpen: boolean;
}

export const Topbar: React.FC<TopbarProps> = ({ onMenuToggle, sidebarOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout, login } = useAuthStore();
  const { notifications, markNotificationRead, markAllNotificationsRead, users, projects, tasks } = useAppStore();
  const branding = useOrganizationBranding();

  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAppLauncher, setShowAppLauncher] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const appLauncherRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const userNotifs = notifications
    .filter((n) => n.userId === currentUser?.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);
  const unreadCount = userNotifs.filter((n) => !n.read).length;

  const closeAllDropdowns = useCallback(() => {
    setShowNotifs(false);
    setShowProfile(false);
    setShowAppLauncher(false);
    setShowSearch(false);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notifRef.current && !notifRef.current.contains(target)) setShowNotifs(false);
      if (profileRef.current && !profileRef.current.contains(target)) setShowProfile(false);
      if (appLauncherRef.current && !appLauncherRef.current.contains(target)) setShowAppLauncher(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAllDropdowns();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setShowSearch(true);
      }
    };

    document.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeAllDropdowns]);

  const handleLogout = () => {
    closeAllDropdowns();
    logout();
    navigate('/login');
  };

  const handleSwitchAccount = async (demo: typeof demoCredentials[0]) => {
    const res = await login({ email: demo.email, password: demo.password });
    if (res.success && res.role) {
      toast.success(`Switched to ${demo.label}`);
      closeAllDropdowns();
      navigate(getDashboardPath(res.role));
    }
  };

  const searchResults = searchQuery.length > 1 ? [
    ...projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 3).map(p => ({
      type: 'Project',
      title: p.name,
      id: p.id,
      url: getProjectUrl(p, currentUser?.role)
    })),
    ...tasks.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 4).map(t => ({
      type: 'Task',
      title: t.title,
      id: t.id,
      url: currentUser?.role === 'TEAM_LEADER' ? issuePath(t, '/tl/tasks') : issuePath(t)
    })),
    ...users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 3).map(u => ({
      type: 'User',
      title: u.name,
      id: u.id,
      url: currentUser?.role === 'ADMIN' || currentUser?.role === 'PROJECT_MANAGER'
        ? '/admin/users'
        : currentUser?.role === 'TEAM_LEADER'
        ? '/tl/team'
        : '/member/projects'
    })),
  ] : [];

  const platformApps = [
    { label: 'Dashboard', path: currentUser ? getDashboardPath(currentUser.role) : '/', icon: LayoutDashboard, color: '#0d9488', bg: '#ccfbf1' },
    { label: 'Kanban Board', path: currentUser?.role === 'ADMIN' ? '/admin' : currentUser?.role === 'TEAM_LEADER' ? '/tl' : currentUser?.role === 'MEMBER' ? '/member' : '/pm', icon: FolderKanban, color: '#6366f1', bg: '#e0e7ff' },
    ...(currentUser?.role === 'ADMIN'
      ? [
          { label: 'Users', path: '/admin/users', icon: UsersRound, color: '#7c3aed', bg: '#f3e8ff' },
          { label: 'Roles & Permissions', path: '/admin/roles', icon: ShieldCheck, color: '#4338ca', bg: '#e0e7ff' },
          { label: 'All Projects', path: '/admin/projects', icon: FolderKanban, color: '#2563eb', bg: '#dbeafe' },
        ]
      : currentUser?.role === 'PROJECT_MANAGER'
      ? [
          { label: 'Users', path: '/admin/users', icon: UsersRound, color: '#7c3aed', bg: '#f3e8ff' },
        ]
      : []),
    { label: 'Flagged Tasks', path: '/flagged-tasks', icon: Flag, color: '#f59e0b', bg: '#fef3c7' },
    { label: 'My Todo', path: '/my-todo', icon: ListTodo, color: '#f59e0b', bg: '#fef3c7' },
    ...(currentUser?.role !== 'MEMBER'
      ? [{ label: 'Team', path: '/tl/team', icon: UsersRound, color: '#0d9488', bg: '#ccfbf1' }]
      : []),
    { label: 'Bugs', path: currentUser?.role === 'MEMBER' ? '/member/bugs' : '/tl/bugs', icon: Bug, color: '#ef4444', bg: '#fee2e2' },
    { label: 'Activity', path: currentUser?.role === 'ADMIN' ? '/admin/activity' : currentUser?.role === 'PROJECT_MANAGER' ? '/pm/activity' : currentUser?.role === 'MEMBER' ? '/member/activity' : '/tl/activity', icon: Activity, color: '#10b981', bg: '#d1fae5' },
    { label: 'Notifications', path: '/notifications', icon: Bell, color: '#f59e0b', bg: '#fef3c7' },
    { label: 'Settings', path: '/settings', icon: Settings, color: '#64748b', bg: '#f1f5f9' },
  ];

  if (!currentUser) return null;

  return (
    <header className="h-16 flex items-center justify-between gap-4 px-4 lg:px-6 bg-white border-b border-[#e0e2ec] flex-shrink-0 z-30 sticky top-0">
      {/* Left: Brand & Menu Toggle */}
      <div className="flex items-center gap-2.5 min-w-[200px]">
        <button
          className="p-2 rounded-xl text-[#4b5563] hover:bg-[#f1f5f9] active:bg-[#e2e8f0] transition-colors lg:hidden cursor-pointer"
          onClick={onMenuToggle}
          aria-label="Toggle mobile menu"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="flex items-center gap-2.5 cursor-pointer group" onClick={() => navigate(getDashboardPath(currentUser.role))}>
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.name}
              title={branding.name}
              className="w-8 h-8 rounded-lg object-cover shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform border border-[#e2e5ea]"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg shadow-sm flex items-center justify-center flex-shrink-0 text-white group-hover:scale-105 transition-transform"
              style={{ background: 'linear-gradient(135deg, #0d9488, #06b6d4)' }}>
              <Layers className="w-4 h-4 text-white" />
            </div>
          )}
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-[#1a1d23] text-base tracking-tight font-display">FlowExec</span>
            <span className="text-[10px] font-semibold text-[#0d9488] bg-[#ccfbf1] px-1.5 py-0.5 rounded-md hidden sm:inline-block">
              Enterprise
            </span>
          </div>
        </div>
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-xl relative hidden md:block">
        <div className="search-pill group">
          <Search className="w-4 h-4 text-[#9ca3af] flex-shrink-0 group-focus-within:text-[#0d9488]" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search projects, tasks, members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowSearch(true)}
            className="w-full bg-transparent text-sm text-[#1a1d23] placeholder:text-[#9ca3af] focus:outline-none"
          />
          {searchQuery ? (
            <button
              className="p-1 rounded-lg hover:bg-[#e2e8f0] text-[#9ca3af]"
              onClick={() => setSearchQuery('')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-1 text-[10px] text-[#9ca3af] font-medium bg-[#f1f5f9] px-1.5 py-0.5 rounded-md border border-[#e2e8f0]">
              <Command className="w-3 h-3" />
              <span>K</span>
            </div>
          )}
        </div>

        {showSearch && searchResults.length > 0 && (
          <div className="absolute top-full mt-2 w-full bg-white border border-[#e2e5ea] rounded-2xl shadow-modal z-50 overflow-hidden animate-scale-in">
            <div className="p-3 border-b border-[#f1f5f9]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#9ca3af]">Results</span>
            </div>
            {searchResults.map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#f8fafc] cursor-pointer border-b border-[#f1f5f9] last:border-0 transition-colors"
                onMouseDown={() => {
                  navigate(r.url);
                  setShowSearch(false);
                  setSearchQuery('');
                }}
              >
                <span className={`badge text-[10px] ${r.type === 'Project' ? 'badge-teal' : r.type === 'Task' ? 'badge-amber' : 'badge-blue'
                  }`}>
                  {r.type}
                </span>
                <span className="text-sm font-medium text-[#1a1d23] truncate flex-1">{r.title}</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#9ca3af]" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 lg:gap-2">
        <button
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f0fdfa] hover:bg-[#ccfbf1] text-[#0d9488] text-xs font-semibold transition-all border border-[#ccfbf1]"
          onClick={() => navigate('/my-todo')}
          title="Quick Add"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Quick Add</span>
        </button>

        {/* App Launcher */}
        <div className="relative" ref={appLauncherRef}>
          <button
            className={`p-2.5 rounded-xl transition-colors ${showAppLauncher ? 'bg-[#f0fdfa] text-[#0d9488]' : 'text-[#4b5563] hover:bg-[#f1f5f9]'}`}
            onClick={() => { setShowAppLauncher(!showAppLauncher); setShowNotifs(false); setShowProfile(false); }}
            title="Platform Apps"
          >
            <Grid className="w-5 h-5" />
          </button>

          {showAppLauncher && (
            <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white border border-[#e0e2ec] rounded-3xl shadow-modal z-50 p-4 animate-scale-in">
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#f1f3f4] px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#444746]">FlowExec Platform Suite</span>
                <span className="text-[10px] text-[#0d9488] bg-[#ccfbf1] px-2 py-0.5 rounded-full font-semibold">Apps Suite</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {platformApps.map((app, i) => {
                  const Icon = app.icon;
                  return (
                    <button
                      key={i}
                      className="flex flex-col items-center justify-center p-3 rounded-2xl hover:bg-[#f0f4f9] active:bg-[#e8f0fe] transition-all group"
                      onClick={() => {
                        navigate(app.path);
                        setShowAppLauncher(false);
                      }}
                    >
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-1.5 shadow-xs transition-transform group-hover:scale-105" style={{ backgroundColor: app.bg }}>
                        <Icon className="w-5 h-5" style={{ color: app.color }} />
                      </div>
                      <span className="text-[11px] font-medium text-[#1f1f1f] text-center truncate max-w-full">{app.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative z-50" ref={notifRef}>
          <button
            className={`p-2.5 rounded-xl transition-colors relative cursor-pointer ${showNotifs ? 'bg-[#f0fdfa] text-[#0d9488]' : 'text-[#4b5563] hover:bg-[#f1f5f9]'}`}
            onClick={() => { setShowNotifs(!showNotifs); setShowProfile(false); setShowAppLauncher(false); }}
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 pointer-events-none" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-[#ef4444] rounded-full text-white text-[9px] flex items-center justify-center font-bold shadow-sm pointer-events-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-[#e0e2ec] rounded-3xl shadow-modal z-50 overflow-hidden animate-scale-in">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#f1f3f4]">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#1a1d23]">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="badge-red text-[10px] px-2 py-0.5">{unreadCount} new</span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    className="text-xs text-[#0d9488] hover:text-[#0f766e] font-semibold"
                    onClick={() => markAllNotificationsRead(currentUser.id)}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto scrollbar-thin">
                {userNotifs.length === 0 ? (
                  <div className="py-10 text-center text-sm text-[#9ca3af]">
                    <Bell className="w-8 h-8 mx-auto mb-2 text-[#e2e8f0]" />
                    No unread notifications
                  </div>
                ) : (
                  userNotifs.map((notif) => (
                    <div
                      key={notif.id}
                      className={`px-5 py-3 border-b border-[#f1f5f9] cursor-pointer hover:bg-[#f8fafc] transition-colors ${!notif.read ? 'bg-[#f0fdfa]/50' : ''}`}
                      onClick={() => markNotificationRead(notif.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!notif.read ? 'bg-[#0d9488]' : 'bg-transparent'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-[#1a1d23]">{notif.title}</div>
                          <div className="text-xs text-[#4b5563] mt-0.5 leading-relaxed">{notif.message}</div>
                          <div className="text-[10px] text-[#9ca3af] mt-1">{formatTimeAgo(notif.createdAt)}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-3 bg-[#f8fafc] border-t border-[#f1f5f9]">
                <button
                  className="w-full py-2 rounded-xl text-xs font-semibold text-[#0d9488] hover:bg-[#f0fdfa] text-center transition-colors"
                  onClick={() => { navigate('/notifications'); setShowNotifs(false); }}
                >
                  View all notifications →
                </button>
              </div>
            </div>
          )}
        </div>

      {/* Profile Menu */}
      <div className="relative z-50" ref={profileRef}>
        <button
          className={`flex items-center gap-2 p-1.5 rounded-xl transition-all cursor-pointer ${showProfile ? 'bg-[#f1f5f9] border border-[#e2e8f0]' : 'hover:bg-[#f1f5f9] border border-transparent hover:border-[#e2e8f0]'}`}
          onClick={() => { setShowProfile(!showProfile); setShowNotifs(false); setShowAppLauncher(false); }}
          aria-label="Profile menu"
          aria-expanded={showProfile}
        >
          <div className="relative">
            <Avatar name={currentUser.name} color={currentUser.avatarColor} size="sm" />
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#10b981] border-2 border-white pointer-events-none" />
          </div>
          <div className="hidden lg:block text-left pointer-events-none">
            <div className="text-xs font-bold text-[#1a1d23] leading-tight">{currentUser.name.split(' ')[0]}</div>
            <div className="text-[10px] text-[#9ca3af] leading-tight">{getRoleLabel(currentUser.role)}</div>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-[#9ca3af] hidden lg:block transition-transform duration-200 pointer-events-none ${showProfile ? 'rotate-180' : ''}`} />
        </button>

        {showProfile && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-[#e0e2ec] rounded-3xl shadow-modal z-50 overflow-hidden animate-scale-in p-4">
            {/* Account Header */}
            <div className="text-center pb-4 border-b border-[#f1f3f4]">
              <div className="text-[11px] font-semibold text-[#747775] mb-3">Enterprise Account</div>
              <div className="w-16 h-16 mx-auto mb-2 relative">
                <Avatar name={currentUser.name} color={currentUser.avatarColor} size="xl" className="w-16 h-16 text-xl shadow-md" />
              </div>
              <div className="text-sm font-bold text-[#1f1f1f]">{currentUser.name}</div>
              <div className="text-xs text-[#747775]">{currentUser.email}</div>
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#ccfbf1] text-[#0d9488] text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                {getRoleLabel(currentUser.role)} · {currentUser.employeeId}
              </div>
            </div>

            {/* Quick Switch Demo Profiles */}
            <div className="py-3 border-b border-[#f1f3f4]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#747775] px-2 mb-2">Switch Active Profile</div>
              <div className="space-y-1">
                {demoCredentials.map((demo) => {
                  const isCurrent = demo.email === currentUser.email;
                  return (
                    <button
                      key={demo.role}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${isCurrent ? 'bg-[#f0fdfa] text-[#0d9488] font-semibold' : 'hover:bg-[#f0f4f9] text-[#444746]'
                        }`}
                      onClick={() => handleSwitchAccount(demo)}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar name={demo.label} size="xs" color={isCurrent ? '#0d9488' : '#747775'} />
                        <div className="text-left">
                          <div className="font-medium">{demo.label}</div>
                          <div className="text-[10px] text-[#747775]">{demo.description}</div>
                        </div>
                      </div>
                      {isCurrent && <Check className="w-3.5 h-3.5 text-[#0d9488]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Account Navigation */}
            <div className="pt-2 space-y-1">
              <button
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-[#444746] hover:bg-[#f0f4f9] transition-colors"
                onClick={() => { navigate('/settings'); setShowProfile(false); }}
              >
                <Settings className="w-4 h-4 text-[#747775]" />
                Organization Settings
              </button>
              <button
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 text-rose-600" />
                Sign Out of FlowExec
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </header>
  );
};
