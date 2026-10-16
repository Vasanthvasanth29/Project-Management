import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, GitBranch, CalendarRange, ClipboardList, Users, Activity,
  LayoutDashboard, Columns, Plus, Settings, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, AlertCircle,
  MoreVertical, Pencil, ArrowRight, Star, Check, RotateCcw, X,
  PieChart as PieIcon, CheckCircle2, ShieldAlert, Calendar as CalendarIcon,
  BarChart3, Flag, Package, Link2, Zap, Search, Download, Clock,
  AlertTriangle, MessageSquare, EyeOff, SlidersHorizontal, Filter,
  HardDrive, Layers, ListTodo
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { canManageWorkflow } from '../../utils/roleUtils';
import { matchId, toUrlId, matchProject, getProjectUrl } from '../../utils/idUtils';
import { ProgressBar } from '../../components/common/ProgressBar';
import { Avatar } from '../../components/common/Avatar';
import { WorkflowBuilder } from './WorkflowBuilder';
import { SprintManager } from './SprintManager';
import { ProjectCalendar } from './ProjectCalendar';
import { ActivityFeed } from '../../components/common/ActivityFeed';
import { StatCard } from '../../components/common/StatCard';
import { KanbanBoard } from '../shared/KanbanBoard';
import { TasksListPage } from '../shared/TasksListPage';
import { ReportsPage } from './reports/ReportsPage';
import { ProjectRoadmap } from './reports/ProjectRoadmap';
import { ReleaseManagement } from './reports/ReleaseManagement';
import { ProjectChatTab } from './chat/ProjectChatTab';
import { ProjectChatDrawer } from './chat/ProjectChatDrawer';
import { formatDate } from '../../utils/dateUtils';
import { DependenciesView } from './DependenciesView';
import { AutomationRulesPage } from './AutomationRulesPage';
import { AdvancedSearchPage } from './AdvancedSearchPage';
import { ExportPanel } from './ExportPanel';
import { ProjectAssetVaultTab } from './assets/ProjectAssetVaultTab';
import { IterationsOverviewTab } from './IterationsOverviewTab';
import { BacklogOverviewTab } from './BacklogOverviewTab';

type Tab = 'command-center' | 'workflow' | 'work-queue' | 'iterations' | 'iterations-overview' | 'backlog-overview' | 'execution-board' | 'work-items' | 'asset-vault' | 'delivery-risk' | 'calendar' | 'team-hub' | 'activity-pulse' | 'insights' | 'delivery-timeline' | 'delivery-releases' | 'automation-studio' | 'query-builder' | 'export' | 'chat';

interface TabDefinition {
  id: Tab;
  defaultLabel: string;
  icon: React.ElementType;
  category: 'core' | 'execution' | 'planning' | 'insights' | 'tools';
}

const DEFAULT_TABS_CONFIG: TabDefinition[] = [
  { id: 'command-center', defaultLabel: 'Command Center', icon: LayoutDashboard, category: 'core' },
  { id: 'workflow', defaultLabel: 'Workflow', icon: GitBranch, category: 'core' },
  { id: 'work-queue', defaultLabel: 'Work Queue', icon: ClipboardList, category: 'execution' },
  { id: 'iterations', defaultLabel: 'Iterations', icon: CalendarRange, category: 'planning' },
  { id: 'iterations-overview', defaultLabel: 'Iterations Overview', icon: Layers, category: 'planning' },
  { id: 'backlog-overview', defaultLabel: 'Work Queue Overview', icon: ListTodo, category: 'planning' },
  { id: 'execution-board', defaultLabel: 'Execution Board', icon: Columns, category: 'execution' },
  { id: 'work-items', defaultLabel: 'Work Items', icon: ClipboardList, category: 'execution' },
  { id: 'asset-vault', defaultLabel: 'Asset Vault', icon: HardDrive, category: 'execution' },
  { id: 'delivery-risk', defaultLabel: 'Delivery Risk', icon: Link2, category: 'insights' },
  { id: 'calendar', defaultLabel: 'Calendar', icon: CalendarIcon, category: 'planning' },
  { id: 'team-hub', defaultLabel: 'Team Hub', icon: Users, category: 'core' },
  { id: 'activity-pulse', defaultLabel: 'Activity Pulse', icon: Activity, category: 'insights' },
  { id: 'insights', defaultLabel: 'Insights', icon: BarChart3, category: 'insights' },
  { id: 'delivery-timeline', defaultLabel: 'Delivery Timeline', icon: Flag, category: 'planning' },
  { id: 'delivery-releases', defaultLabel: 'Delivery Releases', icon: Package, category: 'planning' },
  { id: 'automation-studio', defaultLabel: 'Automation Studio', icon: Zap, category: 'tools' },
  { id: 'query-builder', defaultLabel: 'Query Builder', icon: Search, category: 'tools' },
  { id: 'export', defaultLabel: 'Export Center', icon: Download, category: 'tools' },
  { id: 'chat', defaultLabel: 'Live Chat', icon: MessageSquare, category: 'tools' },
];

interface ProjectTabsPrefs {
  tabOrder: Tab[];
  visibleTabIds?: Tab[];
  customLabels: Partial<Record<Tab, string>>;
  defaultTab: Tab;
}

export const ProjectWorkspace: React.FC = () => {
  const { projectId, projectKey, projectName } = useParams<{
    projectId?: string;
    projectKey?: string;
    projectName?: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { projects, users, workflows, tasks, sprints, teams, activities } = useAppStore();
  const { currentUser } = useAuthStore();

  // Project configuration (workflow) follows the centralized permission model:
  // Admin and Project Manager only.
  const canConfigureWorkflow = currentUser ? canManageWorkflow(currentUser.role) : false;

  const project = projects.find((p) => matchProject(p, { projectId, projectKey, projectName }));
  const canonicalProjectId = project?.id || projectId;

  const initialSprintId = searchParams.get('sprintId') || undefined;
  const initialView = searchParams.get('view') || undefined;
  const tabParam = searchParams.get('tab') as Tab | null;

  // Load project tabs preferences from localStorage
  const storageKey = `pm_tabs_prefs_${canonicalProjectId}`;
  const [tabOrder, setTabOrder] = useState<Tab[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: ProjectTabsPrefs = JSON.parse(saved);
        if (Array.isArray(parsed.tabOrder) && parsed.tabOrder.length > 0) {
          const validSaved = parsed.tabOrder.filter((id) =>
            DEFAULT_TABS_CONFIG.some((t) => t.id === id)
          );
          const missing = DEFAULT_TABS_CONFIG.map((t) => t.id).filter((id) => !validSaved.includes(id));
          return [...validSaved, ...missing];
        }
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_TABS_CONFIG.map((t) => t.id);
  });

  const [visibleTabIds, setVisibleTabIds] = useState<Tab[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: ProjectTabsPrefs = JSON.parse(saved);
        if (Array.isArray(parsed.visibleTabIds) && parsed.visibleTabIds.length > 0) {
          const valid = parsed.visibleTabIds.filter((id) =>
            DEFAULT_TABS_CONFIG.some((t) => t.id === id)
          );
          if (valid.length > 0) {
            if (!valid.includes('iterations-overview')) {
              valid.splice(4, 0, 'iterations-overview');
            }
            if (!valid.includes('backlog-overview')) {
              valid.splice(5, 0, 'backlog-overview');
            }
            if (tabParam && DEFAULT_TABS_CONFIG.some((t) => t.id === tabParam) && !valid.includes(tabParam)) {
              return [...valid, tabParam];
            }
            return valid;
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    // Default to the first 6 tabs
    const initialSix = DEFAULT_TABS_CONFIG.slice(0, 6).map((t) => t.id);
    if (tabParam && DEFAULT_TABS_CONFIG.some((t) => t.id === tabParam) && !initialSix.includes(tabParam)) {
      return [...initialSix, tabParam];
    }
    return initialSix;
  });

  const [customLabels, setCustomLabels] = useState<Partial<Record<Tab, string>>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: ProjectTabsPrefs = JSON.parse(saved);
        return parsed.customLabels || {};
      }
    } catch (e) {
      console.error(e);
    }
    return {};
  });

  const [defaultTab, setDefaultTab] = useState<Tab>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: ProjectTabsPrefs = JSON.parse(saved);
        if (parsed.defaultTab && DEFAULT_TABS_CONFIG.some((t) => t.id === parsed.defaultTab)) {
          return parsed.defaultTab;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return 'iterations';
  });

  // One-shot marker: set right before we redirect a project entry to the standalone
  // Iterations route, and consumed (cleared) the next time ProjectWorkspace mounts for
  // this project. Its presence means "the user just came back from Iterations" (e.g. via
  // "Back to Project"), so the auto-redirect-on-entry below must not fire again — otherwise
  // Back to Project would bounce straight back into Iterations in an infinite loop. Its
  // absence means this is a genuine fresh entry (from the Projects list, a bookmark, a
  // reload, etc.), so the auto-redirect should fire.
  const iterationsRedirectFlagKey = `pw_returned_from_iterations_${canonicalProjectId}`;
  const hasCheckedIterationsFlag = useRef(false);
  const skipIterationsAutoRedirect = useRef(false);
  // Read (and consume) the flag exactly once per component instance. Without this guard,
  // a later re-render of this SAME mount (e.g. triggered by the redirect effect itself
  // calling navigate()) would re-run this check, find the flag its own effect just set,
  // and immediately clear it — before the browser ever actually left this page. That made
  // the flag unable to survive to the NEXT mount, so "Back to Project" always found no
  // flag and re-triggered the auto-redirect, bouncing straight back into Iterations.
  if (!hasCheckedIterationsFlag.current) {
    hasCheckedIterationsFlag.current = true;
    try {
      if (sessionStorage.getItem(iterationsRedirectFlagKey)) {
        sessionStorage.removeItem(iterationsRedirectFlagKey);
        skipIterationsAutoRedirect.current = true;
      }
    } catch (e) {
      // sessionStorage unavailable — fall back to always redirecting.
    }
  }

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (tabParam && DEFAULT_TABS_CONFIG.some((t) => t.id === tabParam)) {
      return tabParam;
    }
    // Iterations is never rendered embedded in ProjectWorkspace (see effect below, which
    // redirects to the standalone Iterations route instead). Rest on Command Center here
    // so there is no path where the embedded IterationsOverviewTab briefly renders.
    return 'command-center';
  });

  // Command Center previously always landed with the full expanded project header,
  // while every other tab (reached via a click) auto-minimizes it through handleSelectTab.
  // Start minimized when Command Center is the initial/default tab so its first paint
  // matches the same compact rhythm other tabs already have.
  const [isHeaderMinimized, setIsHeaderMinimized] = useState(
    () => activeTab === 'command-center'
  );

  // Normal project entry defaults to the standalone Iterations route, not an embedded tab.
  // Skipped when returning from Iterations (see the one-shot flag above) or when the URL
  // explicitly requested a different tab via ?tab=.
  const hasRunIterationsRedirect = useRef(false);
  useEffect(() => {
    // Guard against React StrictMode's dev-only double-invocation of mount effects, which
    // would otherwise run this redirect twice for a single real visit.
    if (hasRunIterationsRedirect.current) {
      return;
    }
    hasRunIterationsRedirect.current = true;
    if (tabParam && DEFAULT_TABS_CONFIG.some((t) => t.id === tabParam)) {
      return;
    }
    if (skipIterationsAutoRedirect.current) {
      return;
    }
    try {
      sessionStorage.setItem(iterationsRedirectFlagKey, '1');
    } catch (e) {
      // sessionStorage unavailable — redirect still proceeds.
    }
    navigate(`${location.pathname}/iterations`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectTab = (tabId: Tab) => {
    if (tabId === 'iterations') {
      try {
        sessionStorage.setItem(iterationsRedirectFlagKey, '1');
      } catch (e) {
        // sessionStorage unavailable — navigation still proceeds.
      }
      const currentPath = location.pathname;
      const iterationsUrl = `${currentPath}/iterations`;
      navigate(iterationsUrl);
      return;
    }
    setActiveTab(tabId);
    setIsHeaderMinimized(true);
  };

  const [openPopupTabId, setOpenPopupTabId] = useState<Tab | null>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);
  const [renamingTabId, setRenamingTabId] = useState<Tab | null>(null);
  const [renameInput, setRenameInput] = useState<string>('');
  
  // Add Tab popup & filter states
  const [isAddTabMenuOpen, setIsAddTabMenuOpen] = useState(false);
  const [addTabMenuPos, setAddTabMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [tabSearchQuery, setTabSearchQuery] = useState('');
  const [selectedTabCategory, setSelectedTabCategory] = useState<string>('all');

  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const addTabBtnRef = useRef<HTMLButtonElement>(null);
  const addTabMenuRef = useRef<HTMLDivElement>(null);

  // Sync to localStorage
  useEffect(() => {
    try {
      const prefs: ProjectTabsPrefs = {
        tabOrder,
        visibleTabIds,
        customLabels,
        defaultTab,
      };
      localStorage.setItem(storageKey, JSON.stringify(prefs));
    } catch (e) {
      console.error(e);
    }
  }, [tabOrder, visibleTabIds, customLabels, defaultTab, storageKey]);

  // Scroll visibility controls for tab bar
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkTabScroll = () => {
    const el = tabsContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 6);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 6);
  };

  const scrollTabs = (direction: 'left' | 'right') => {
    const el = tabsContainerRef.current;
    if (!el) return;
    const offset = direction === 'left' ? -240 : 240;
    el.scrollBy({ left: offset, behavior: 'smooth' });
  };

  // Support mouse wheel horizontal scrolling over the tab bar
  useEffect(() => {
    const el = tabsContainerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0 && el.scrollWidth > el.clientWidth) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
        checkTabScroll();
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Update scroll bounds on resize or visible tab count change
  useEffect(() => {
    checkTabScroll();
    const el = tabsContainerRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkTabScroll, { passive: true });
    window.addEventListener('resize', checkTabScroll);
    return () => {
      el.removeEventListener('scroll', checkTabScroll);
      window.removeEventListener('resize', checkTabScroll);
    };
  }, [visibleTabIds.length]);

  // Auto-scroll active tab into view
  useEffect(() => {
    const el = tabsContainerRef.current;
    if (!el) return;
    const activeEl = el.querySelector(`[data-tab-id="${activeTab}"]`) as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeTab]);

  // Click outside or scroll/resize to close active popups
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsidePopup = popupRef.current && popupRef.current.contains(target);
      const isInsideAddMenu = addTabMenuRef.current && addTabMenuRef.current.contains(target);
      const isInsideAddBtn = addTabBtnRef.current && addTabBtnRef.current.contains(target);
      const isInsideTabs = tabsContainerRef.current && tabsContainerRef.current.contains(target);

      if (!isInsidePopup && !isInsideTabs && !isInsideAddMenu && !isInsideAddBtn) {
        setOpenPopupTabId(null);
        setRenamingTabId(null);
        setPopupPos(null);
        setIsAddTabMenuOpen(false);
        setAddTabMenuPos(null);
      }
    };
    const handleScrollOrResize = (e: Event) => {
      const target = e.target as Node;
      // CRITICAL: Do NOT close if the scroll occurred inside the Add Tab menu or inside tab popup!
      if (popupRef.current && (popupRef.current === target || popupRef.current.contains(target))) return;
      if (addTabMenuRef.current && (addTabMenuRef.current === target || addTabMenuRef.current.contains(target))) return;

      if (e.type === 'resize') {
        if (openPopupTabId) {
          setOpenPopupTabId(null);
          setRenamingTabId(null);
          setPopupPos(null);
        }
        if (isAddTabMenuOpen) {
          setIsAddTabMenuOpen(false);
          setAddTabMenuPos(null);
        }
        return;
      }

      // If document/window scrolled, close popups
      if (openPopupTabId) {
        setOpenPopupTabId(null);
        setRenamingTabId(null);
        setPopupPos(null);
      }
      if (isAddTabMenuOpen) {
        setIsAddTabMenuOpen(false);
        setAddTabMenuPos(null);
      }
    };
    if (openPopupTabId || isAddTabMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [openPopupTabId, isAddTabMenuOpen]);

  // Iteration automation on mount — completion runs first so an outgoing iteration is
  // replaced by its PLANNED successor in the same pass (one active sprint at a time).
  useEffect(() => {
    const { checkAndAutoStartSprints, checkAndAutoCompleteSprints } = useAppStore.getState();
    checkAndAutoCompleteSprints();
    checkAndAutoStartSprints();
  }, []);

  if (!project) {
    return (
      <div className="card p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-slate-800">Project not found</h2>
        <button className="btn-secondary mt-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
      </div>
    );
  }

  const workflow = workflows.find((w) => w.id === project.workflowId);
  const pm = users.find((u) => u.id === project.projectManagerId);
  const currentStage = workflow?.stages.find((s) => s.id === project.currentStageId);
  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const projectSprints = sprints.filter((s) => s.projectId === project.id);
  const projectTeams = teams.filter((t) => project.teamIds.includes(t.id));
  const projectActivities = activities.filter((a) =>
    a.entityId === project.id || projectTasks.some((t) => t.id === a.entityId)
  );

  const doneTasks = projectTasks.filter((t) => t.status === 'DONE').length;
  const inProgressTasks = projectTasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const blockedTasks = projectTasks.filter((t) => t.status === 'BLOCKED').length;

  // Build current ordered visible tabs list
  const visibleTabs = tabOrder
    .filter((id) => visibleTabIds.includes(id))
    .map((tabId) => {
      const def = DEFAULT_TABS_CONFIG.find((t) => t.id === tabId);
      if (!def) return null;
      return {
        id: def.id,
        label: customLabels[def.id] || def.defaultLabel,
        defaultLabel: def.defaultLabel,
        icon: def.icon,
        category: def.category,
      };
    })
    .filter(Boolean) as { id: Tab; label: string; defaultLabel: string; icon: React.ElementType; category: string }[];

  // Remaining tabs that are not currently visible
  const remainingTabs = tabOrder
    .filter((id) => !visibleTabIds.includes(id))
    .map((tabId) => {
      const def = DEFAULT_TABS_CONFIG.find((t) => t.id === tabId);
      if (!def) return null;
      return {
        id: def.id,
        label: customLabels[def.id] || def.defaultLabel,
        defaultLabel: def.defaultLabel,
        icon: def.icon,
        category: def.category,
      };
    })
    .filter(Boolean) as { id: Tab; label: string; defaultLabel: string; icon: React.ElementType; category: string }[];

  // Tab action handlers
  const handleSetAsDefault = (tabId: Tab, tabLabel: string) => {
    setDefaultTab(tabId);
    toast.success(`"${tabLabel}" set as default tab`);
  };

  const handleSaveRename = (tabId: Tab) => {
    const trimmed = renameInput.trim();
    const def = DEFAULT_TABS_CONFIG.find((t) => t.id === tabId);
    const finalName = trimmed || def?.defaultLabel || tabId;

    setCustomLabels((prev) => ({
      ...prev,
      [tabId]: finalName,
    }));
    toast.success(`Tab renamed to "${finalName}"`);
  };

  const handleMoveTabLeft = (index: number) => {
    if (index <= 0) return;
    const newVisible = [...visibleTabIds];
    const temp = newVisible[index - 1];
    newVisible[index - 1] = newVisible[index];
    newVisible[index] = temp;
    setVisibleTabIds(newVisible);
    const movedTab = visibleTabs[index];
    toast.success(`Moved "${movedTab.label}" left`);
  };

  const handleMoveTabRight = (index: number) => {
    if (index >= visibleTabIds.length - 1) return;
    const newVisible = [...visibleTabIds];
    const temp = newVisible[index + 1];
    newVisible[index + 1] = newVisible[index];
    newVisible[index] = temp;
    setVisibleTabIds(newVisible);
    const movedTab = visibleTabs[index];
    toast.success(`Moved "${movedTab.label}" right`);
  };

  const handleAddTab = (tabId: Tab) => {
    if (!visibleTabIds.includes(tabId)) {
      setVisibleTabIds((prev) => [...prev, tabId]);
    }
    setActiveTab(tabId);
    setIsHeaderMinimized(true);
    const def = DEFAULT_TABS_CONFIG.find((t) => t.id === tabId);
    const label = customLabels[tabId] || def?.defaultLabel || tabId;
    toast.success(`Added "${label}" to tabs`);

    setTimeout(() => {
      if (tabsContainerRef.current) {
        tabsContainerRef.current.scrollTo({
          left: tabsContainerRef.current.scrollWidth,
          behavior: 'smooth',
        });
        checkTabScroll();
      }
    }, 60);
  };

  const handleHideTab = (tabId: Tab) => {
    if (visibleTabIds.length <= 1) {
      toast.error('At least one tab must remain visible in the project');
      return;
    }
    const newVisible = visibleTabIds.filter((id) => id !== tabId);
    setVisibleTabIds(newVisible);
    const def = DEFAULT_TABS_CONFIG.find((t) => t.id === tabId);
    const label = customLabels[tabId] || def?.defaultLabel || tabId;
    toast.info(`Removed "${label}" from visible tabs`);

    if (activeTab === tabId) {
      setActiveTab(newVisible[0]);
    }
  };

  const handleResetToDefaultSixTabs = () => {
    const defaultSix = DEFAULT_TABS_CONFIG.slice(0, 6).map((t) => t.id);
    setVisibleTabIds(defaultSix);
    if (!defaultSix.includes(activeTab)) {
      setActiveTab(defaultSix[0]);
    }
    toast.success('Reset tab bar to default 6 tabs');
    setIsAddTabMenuOpen(false);
    setAddTabMenuPos(null);
  };

  const handleResetTab = (tabId: Tab) => {
    setCustomLabels((prev) => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
    toast.info('Tab reset to default name');
  };

  const handleTogglePopup = (e: React.MouseEvent<HTMLButtonElement>, tabId: Tab) => {
    e.stopPropagation();
    if (isAddTabMenuOpen) {
      setIsAddTabMenuOpen(false);
      setAddTabMenuPos(null);
    }
    if (openPopupTabId === tabId) {
      setOpenPopupTabId(null);
      setRenamingTabId(null);
      setPopupPos(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const popupWidth = 240;
      const left = Math.max(10, Math.min(window.innerWidth - popupWidth - 16, rect.right - popupWidth));
      const top = rect.bottom + 6;
      setPopupPos({ top, left });
      setOpenPopupTabId(tabId);
      setRenamingTabId(null);
      const currentTab = visibleTabs.find((t) => t.id === tabId);
      if (currentTab) setRenameInput(currentTab.label);
    }
  };

  const handleToggleAddTabMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (openPopupTabId) {
      setOpenPopupTabId(null);
      setRenamingTabId(null);
      setPopupPos(null);
    }
    if (isAddTabMenuOpen) {
      setIsAddTabMenuOpen(false);
      setAddTabMenuPos(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const menuWidth = 350;
      const left = Math.max(12, Math.min(window.innerWidth - menuWidth - 16, rect.left));
      const top = rect.bottom + 6;
      setAddTabMenuPos({ top, left });
      setIsAddTabMenuOpen(true);
      setTabSearchQuery('');
      setSelectedTabCategory('all');
    }
  };

  return (
    <div className={isHeaderMinimized ? 'space-y-2 animate-fade-in' : 'space-y-3.5 animate-fade-in'}>
      {/* Breadcrumb + Project Header (Collapsible / Minimized View) */}
      {isHeaderMinimized ? (
        <div className="px-3.5 py-1.5 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2.5 animate-fade-in">
          {/* Left: Breadcrumbs & Project Key & Name */}
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="hover:text-slate-800 text-slate-500 transition-colors flex items-center gap-1 text-xs font-medium cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>My Projects</span>
            </button>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[180px] md:max-w-[260px]">
              {project.name}
            </span>
            {project.key && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                {project.key}
              </span>
            )}
            <span className={`badge text-[10px] py-0.2 px-2 ${project.status === 'ACTIVE' ? 'badge-green' : 'badge-blue'}`}>
              {project.status}
            </span>
          </div>

          {/* Middle: Progress & Current Stage & Tasks */}
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <div className="flex items-center gap-2 min-w-[120px] sm:min-w-[160px]">
              <span className="text-slate-500 font-medium text-[11px]">Progress</span>
              <div className="flex-1 w-20 sm:w-24">
                <ProgressBar value={project.progress} height="sm" />
              </div>
              <span className="text-slate-800 font-bold text-xs">{project.progress}%</span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-100">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: currentStage?.color || '#94a3b8' }} />
              <span className="text-slate-500 text-[11px]">Stage:</span>
              <span className="font-semibold text-slate-800 text-xs">{currentStage?.name || 'Not configured'}</span>
            </div>

            <span className="hidden md:inline text-slate-400 text-[11px]">
              {projectTasks.length} tasks
            </span>
          </div>

          {/* Right: PM Info & Expand Header Button */}
          <div className="flex items-center gap-2">
            {pm && (
              <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-100" title={`Project Manager: ${pm.name}`}>
                <Avatar name={pm.name} color={pm.avatarColor} size="xs" />
                <span className="text-xs font-medium text-slate-700 max-w-[80px] truncate">{pm.name.split(' ')[0]}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsHeaderMinimized(false)}
              className="btn-secondary btn-sm flex items-center gap-1 text-xs py-0.5 px-2 text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50 cursor-pointer shadow-2xs"
              title="Expand project details"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Details</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Breadcrumb */}
          <div className="flex items-center justify-between gap-2 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(-1)} className="hover:text-slate-800 transition-colors flex items-center gap-1 cursor-pointer">
                <ArrowLeft className="w-4 h-4" />
                My Projects
              </button>
              <ChevronRight className="w-4 h-4" />
              <span className="text-slate-800 font-medium">{project.name}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsHeaderMinimized(true)}
              className="btn-ghost btn-sm flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
              title="Minimize project details"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Minimize</span>
            </button>
          </div>

          {/* Project Header */}
          <div className="card p-5 relative animate-fade-in">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {project.key && (
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                      {project.key}
                    </span>
                  )}
                  <span className={`badge ${project.status === 'ACTIVE' ? 'badge-green' : 'badge-blue'}`}>{project.status}</span>
                  <span className="badge-gray">{project.type}</span>
                  {project.category && (
                    <span className="px-2 py-0.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      {project.category}
                    </span>
                  )}
                  <span className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    {project.id}
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-1">{project.name}</h1>
                <p className="text-sm text-slate-500">{project.description}</p>
              </div>
              {pm && (
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100 min-w-[240px]">
                  <Avatar name={pm.name} color={pm.avatarColor} size="md" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Project Manager</div>
                    <div className="text-sm font-bold text-slate-900 truncate">{pm.name}</div>
                    <div className="text-xs text-slate-500 truncate">{pm.email}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Progress + Stage */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-600">Overall Progress</span>
                  <span className="text-sm font-bold text-slate-800">{project.progress}%</span>
                </div>
                <ProgressBar value={project.progress} height="lg" />
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: currentStage?.color || '#94a3b8' }} />
                <div>
                  <div className="text-xs text-slate-400">Current Stage</div>
                  <div className="text-sm font-semibold text-slate-800">{currentStage?.name || 'Not configured'}</div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span>Started {formatDate(project.startDate)}</span>
              <span>·</span>
              <span>Target {formatDate(project.targetDate)}</span>
              <span>·</span>
              <span>{projectTasks.length} total tasks</span>
            </div>
          </div>
        </>
      )}

      {/* Tabs Bar Wrapper */}
      <div className="relative flex items-center border-b border-[#e2e5ea] pb-0">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollTabs('left')}
            className="absolute left-0 z-40 h-full px-1.5 bg-gradient-to-r from-white via-white/95 to-transparent flex items-center justify-center text-slate-600 hover:text-teal-700 transition-all cursor-pointer shadow-xs"
            title="Scroll tabs left"
            aria-label="Scroll tabs left"
          >
            <div className="p-1 rounded-full bg-white/95 hover:bg-teal-50 border border-slate-200 shadow-xs">
              <ChevronLeft className="w-3.5 h-3.5" />
            </div>
          </button>
        )}

        <div
          ref={tabsContainerRef}
          className="flex items-center gap-1 relative z-30 overflow-x-auto scrollbar-thin min-w-0 flex-1 px-1 scroll-smooth"
        >
          {visibleTabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isPopupOpen = openPopupTabId === tab.id;

            return (
              <div
                key={tab.id}
                data-tab-id={tab.id}
                className={`relative group flex items-center border-b-2 transition-all select-none rounded-t-lg flex-shrink-0 whitespace-nowrap ${
                  isActive
                    ? 'border-[#0d9488] bg-[#f0fdfa] text-[#0d9488] font-semibold'
                    : 'border-transparent text-[#64748b] hover:text-[#1a1d23] hover:border-[#cbd5e1] hover:bg-[#f8fafc]'
                }`}
              >
                {/* Tab Click Area (Icon + Label) */}
                <button
                  type="button"
                  onClick={() => handleSelectTab(tab.id)}
                  className="flex items-center gap-1.5 pl-3 pr-2 py-2 text-xs sm:text-sm font-medium whitespace-nowrap text-inherit focus:outline-none cursor-pointer"
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{tab.label}</span>
                </button>

                {/* 3-Dots Filter / Options Trigger Button on Hover */}
                <button
                  type="button"
                  onClick={(e) => handleTogglePopup(e, tab.id)}
                  className={`w-6 h-6 mr-1.5 flex items-center justify-center rounded-md cursor-pointer transition-all ${
                    isPopupOpen
                      ? 'opacity-100 bg-[#ccfbf1] text-[#0d9488] shadow-xs'
                      : 'opacity-0 group-hover:opacity-100 hover:bg-slate-200/80 text-slate-400 hover:text-slate-800'
                  }`}
                  title={`Tab options for ${tab.label}`}
                  aria-label={`Tab options for ${tab.label}`}
                >
                  <MoreVertical className="w-3.5 h-3.5 pointer-events-none" />
                </button>
              </div>
            );
          })}

          {/* Button after visible tabs to add/filter remaining tabs */}
          <div className="flex items-center py-1 flex-shrink-0 ml-1">
            <button
              ref={addTabBtnRef}
              type="button"
              onClick={handleToggleAddTabMenu}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap border ${
                isAddTabMenuOpen
                  ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                  : 'bg-white hover:bg-teal-50 text-teal-700 hover:text-teal-800 border-teal-200 hover:border-teal-300 shadow-2xs'
              }`}
              title="Add more tabs to tab bar"
            >
              <Plus className={`w-3.5 h-3.5 transition-transform duration-200 ${isAddTabMenuOpen ? 'rotate-45' : ''}`} />
              <span>Add Tab</span>
              {remainingTabs.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isAddTabMenuOpen ? 'bg-teal-800 text-teal-100' : 'bg-teal-100 text-teal-800'
                }`}>
                  +{remainingTabs.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollTabs('right')}
            className="absolute right-0 z-40 h-full px-1.5 bg-gradient-to-l from-white via-white/95 to-transparent flex items-center justify-center text-slate-600 hover:text-teal-700 transition-all cursor-pointer shadow-xs"
            title="Scroll tabs right"
            aria-label="Scroll tabs right"
          >
            <div className="p-1 rounded-full bg-white/95 hover:bg-teal-50 border border-slate-200 shadow-xs">
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </button>
        )}
      </div>

        {/* Floating Pop-up Near Tab (rendered with fixed positioning to avoid overflow clipping) */}
        {openPopupTabId && popupPos && (() => {
          const tab = visibleTabs.find((t) => t.id === openPopupTabId);
          const index = visibleTabs.findIndex((t) => t.id === openPopupTabId);
          if (!tab || index === -1) return null;

          return (
            <div
              ref={popupRef}
              style={{
                top: `${popupPos.top}px`,
                left: `${popupPos.left}px`,
              }}
              className="fixed z-50 w-60 bg-white rounded-xl shadow-2xl border border-slate-200/90 py-1.5 text-xs animate-in fade-in-0 zoom-in-95 backdrop-blur-md select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-1.5 border-b border-slate-100 mb-1 flex items-center justify-between">
                <span className="font-bold text-slate-800 truncate max-w-[150px]">
                  {tab.label}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setOpenPopupTabId(null);
                    setRenamingTabId(null);
                    setPopupPos(null);
                  }}
                  className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 1. Set as default */}
              <button
                type="button"
                onClick={() => {
                  handleSetAsDefault(tab.id, tab.label);
                  setOpenPopupTabId(null);
                  setPopupPos(null);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-50 transition-colors ${
                  defaultTab === tab.id ? 'text-[#0d9488] font-semibold bg-[#f0fdfa]' : 'text-slate-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Star className={`w-3.5 h-3.5 ${defaultTab === tab.id ? 'fill-[#0d9488] text-[#0d9488]' : 'text-slate-400'}`} />
                  <span>Set as default</span>
                </span>
                {defaultTab === tab.id && (
                  <span className="text-[10px] bg-[#ccfbf1] text-[#0d9488] px-1.5 py-0.5 rounded-full font-semibold">
                    Active
                  </span>
                )}
              </button>

              {/* 2. Rename tab (compact inline edit with save/cancel) */}
              {renamingTabId === tab.id ? (
                <div className="px-3 py-2 bg-slate-50 border-y border-slate-100 my-1 space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-600">Rename Tab:</div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      autoFocus
                      value={renameInput}
                      onChange={(e) => setRenameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveRename(tab.id);
                          setRenamingTabId(null);
                          setOpenPopupTabId(null);
                          setPopupPos(null);
                        }
                        if (e.key === 'Escape') setRenamingTabId(null);
                      }}
                      className="px-2 py-1 text-xs rounded-md border border-[#0d9488] bg-white text-slate-900 outline-none flex-1 focus:ring-1 focus:ring-[#0d9488] shadow-xs"
                      placeholder="Tab name"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        handleSaveRename(tab.id);
                        setRenamingTabId(null);
                        setOpenPopupTabId(null);
                        setPopupPos(null);
                      }}
                      className="p-1 rounded-md bg-[#0d9488] hover:bg-[#0f766e] text-white transition-colors"
                      title="Save name"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingTabId(null)}
                      className="p-1 rounded-md hover:bg-slate-200 text-slate-500 transition-colors"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setRenamingTabId(tab.id);
                    setRenameInput(tab.label);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 text-slate-400" />
                  <span>Rename tab</span>
                </button>
              )}

              {/* 3. Move Right */}
              <button
                type="button"
                disabled={index === visibleTabs.length - 1}
                onClick={() => {
                  handleMoveTabRight(index);
                  setOpenPopupTabId(null);
                  setPopupPos(null);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                  index === visibleTabs.length - 1
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                <span>Move tab right</span>
              </button>

              {/* 4. Move Left */}
              <button
                type="button"
                disabled={index === 0}
                onClick={() => {
                  handleMoveTabLeft(index);
                  setOpenPopupTabId(null);
                  setPopupPos(null);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                  index === 0
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
                <span>Move tab left</span>
              </button>

              {/* 5. Hide tab from bar */}
              {visibleTabs.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    handleHideTab(tab.id);
                    setOpenPopupTabId(null);
                    setPopupPos(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                >
                  <EyeOff className="w-3.5 h-3.5 text-rose-500" />
                  <span>Hide tab from bar</span>
                </button>
              )}

              {/* 6. Reset to original name */}
              {customLabels[tab.id] && (
                <>
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      handleResetTab(tab.id);
                      setRenamingTabId(null);
                      setOpenPopupTabId(null);
                      setPopupPos(null);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3 text-slate-400" />
                    <span>Reset to original name</span>
                  </button>
                </>
              )}
            </div>
          );
        })()}

        {/* Floating Add Tab Filter & Selector Menu */}
        {isAddTabMenuOpen && addTabMenuPos && (() => {
          const categories = ['all', 'core', 'execution', 'planning', 'insights', 'tools'] as const;
          const filteredRemainingTabs = remainingTabs.filter((tab) => {
            const query = tabSearchQuery.trim().toLowerCase();
            const matchesQuery =
              !query ||
              tab.label.toLowerCase().includes(query) ||
              tab.defaultLabel.toLowerCase().includes(query) ||
              tab.category.toLowerCase().includes(query);
            const matchesCategory = selectedTabCategory === 'all' || tab.category === selectedTabCategory;
            return matchesQuery && matchesCategory;
          });

          return (
            <div
              ref={addTabMenuRef}
              style={{
                top: `${addTabMenuPos.top}px`,
                left: `${addTabMenuPos.left}px`,
              }}
              className="fixed z-50 w-88 bg-white rounded-2xl shadow-2xl border border-slate-200/95 py-3 px-3 text-xs animate-in fade-in-0 zoom-in-95 backdrop-blur-md select-none"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 leading-none">More Project Tabs</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {remainingTabs.length} available · click to add to your tab bar
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddTabMenuOpen(false);
                    setAddTabMenuPos(null);
                  }}
                  className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search Filter */}
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  value={tabSearchQuery}
                  onChange={(e) => setTabSearchQuery(e.target.value)}
                  placeholder="Filter tabs by name or category..."
                  className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all bg-slate-50/50"
                />
                {tabSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTabSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Category Chips */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1 mb-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedTabCategory(cat)}
                    className={`px-2 py-0.8 rounded-md text-[10px] font-medium capitalize whitespace-nowrap transition-colors cursor-pointer ${
                      selectedTabCategory === cat
                        ? 'bg-teal-700 text-white font-semibold'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Tabs List */}
              <div
                className="max-h-64 overflow-y-auto space-y-1 pr-1 scrollbar-thin overscroll-contain"
                onWheel={(e) => e.stopPropagation()}
              >
                {remainingTabs.length === 0 ? (
                  <div className="p-4 text-center text-slate-500">
                    <div className="text-xs font-semibold text-slate-700 mb-1">All tabs added!</div>
                    <p className="text-[11px] text-slate-400 mb-3">All available project tabs are currently visible in your top bar.</p>
                    <button
                      type="button"
                      onClick={handleResetToDefaultSixTabs}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                    >
                      Reset to default 6 tabs
                    </button>
                  </div>
                ) : filteredRemainingTabs.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs">
                    No tabs found matching &ldquo;{tabSearchQuery}&rdquo;
                  </div>
                ) : (
                  filteredRemainingTabs.map((tab) => {
                    const TabIcon = tab.icon;
                    return (
                      <div
                        key={tab.id}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-teal-50/60 border border-transparent hover:border-teal-100 transition-colors group cursor-pointer"
                        onClick={() => handleAddTab(tab.id)}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-teal-100 text-slate-600 group-hover:text-teal-800 flex items-center justify-center flex-shrink-0 transition-colors">
                            <TabIcon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800 group-hover:text-teal-900 truncate text-xs">
                              {tab.label}
                            </div>
                            <div className="text-[10px] text-slate-400 capitalize truncate">
                              {tab.category}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddTab(tab.id);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white group-hover:bg-teal-600 text-slate-700 group-hover:text-white border border-slate-200 group-hover:border-teal-600 font-semibold text-[11px] transition-all shadow-2xs hover:shadow-xs flex-shrink-0 ml-2"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Popover Footer */}
              <div className="pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>{visibleTabs.length} of {DEFAULT_TABS_CONFIG.length} tabs in bar</span>
                {visibleTabs.length !== 6 && (
                  <button
                    type="button"
                    onClick={handleResetToDefaultSixTabs}
                    className="text-teal-700 hover:text-teal-800 hover:underline font-medium cursor-pointer"
                  >
                    Reset to default 6
                  </button>
                )}
              </div>
            </div>
          );
        })()}

      {/* Tab Content */}
      <div className="animate-fade-in">
        {activeTab === 'command-center' && (
          <div className="space-y-4">
            {/* Delivery Confidence Score */}
            {(() => {
              const totalTasks = projectTasks.length;
              const doneTasksCount = projectTasks.filter((t) => t.status === 'DONE').length;
              const overdueCount = projectTasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE').length;
              const blockedCount = projectTasks.filter((t) => t.status === 'BLOCKED').length;
              const completionRate = totalTasks > 0 ? (doneTasksCount / totalTasks) * 100 : 0;
              const riskPenalty = totalTasks > 0 ? ((overdueCount + blockedCount * 2) / totalTasks) * 30 : 0;
              const confidence = Math.max(0, Math.min(100, Math.round(completionRate - riskPenalty)));
              const confColor = confidence >= 80 ? '#10b981' : confidence >= 50 ? '#f59e0b' : '#ef4444';
              const confLabel = confidence >= 80 ? 'On Track' : confidence >= 50 ? 'At Risk' : 'Critical';
              return (
                <div className="card p-4" style={{ borderLeft: `4px solid ${confColor}` }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `${confColor}15` }}>
                        <span className="text-2xl font-bold" style={{ color: confColor }}>{confidence}%</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#1a1d23]">Delivery Confidence</h3>
                        <p className="text-xs text-[#9ca3af]">Based on completion, overdue work, and blocked items</p>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold mt-1 px-2 py-0.5 rounded-lg" style={{ background: `${confColor}15`, color: confColor }}>
                          {confLabel}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-[#9ca3af] uppercase tracking-wider mb-1">Risk Factors</div>
                      <div className="flex items-center gap-3 text-xs">
                        {overdueCount > 0 && <span className="text-[#ef4444] font-bold">{overdueCount} overdue</span>}
                        {blockedCount > 0 && <span className="text-[#f59e0b] font-bold">{blockedCount} blocked</span>}
                        {overdueCount === 0 && blockedCount === 0 && <span className="text-[#10b981] font-bold">No risks</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Work Items" value={projectTasks.length} icon={ClipboardList} iconColor="#0d9488" iconBg="#ccfbf1" />
              <StatCard title="Completed" value={doneTasks} icon={CheckCircle2} iconColor="#10b981" iconBg="#d1fae5" />
              <StatCard title="In Progress" value={inProgressTasks} icon={Clock} iconColor="#06b6d4" iconBg="#cffafe" />
              <StatCard title="Blocked" value={blockedTasks} icon={AlertCircle}
                iconColor={blockedTasks > 0 ? '#ef4444' : '#10b981'}
                iconBg={blockedTasks > 0 ? '#fee2e2' : '#d1fae5'}
              />
            </div>

            {/* Tasks Pie Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 1. Task Status Distribution Pie Chart */}
              <div className="card p-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                      <PieIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Task Status Distribution</h2>
                      <p className="text-xs text-slate-400">Breakdown of tasks by workflow status</p>
                    </div>
                  </div>
                  <span className="badge badge-blue font-semibold">
                    {projectTasks.length > 0 ? `${Math.round((doneTasks / projectTasks.length) * 100)}% Done` : '0 Tasks'}
                  </span>
                </div>

                {projectTasks.length === 0 ? (
                  <div className="h-56 flex flex-col items-center justify-center text-slate-400 text-xs">
                    <ClipboardList className="w-8 h-8 text-slate-300 mb-2" />
                    No tasks created in this project yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    {/* Donut Chart */}
                    <div className="h-56 relative flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <RechartsTooltip
                            formatter={(value: any, name: any) => [
                              `${value} tasks (${Math.round(((value as number) / projectTasks.length) * 100)}%)`,
                              name,
                            ]}
                            contentStyle={{
                              backgroundColor: '#ffffff',
                              borderRadius: '12px',
                              border: '1px solid #e2e8f0',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                              fontSize: '12px',
                            }}
                          />
                          <Pie
                            data={[
                              { name: 'Completed', value: projectTasks.filter((t) => t.status === 'DONE').length, color: '#10b981' },
                              { name: 'In Progress', value: projectTasks.filter((t) => t.status === 'IN_PROGRESS').length, color: '#3b82f6' },
                              { name: 'In Review', value: projectTasks.filter((t) => t.status === 'IN_REVIEW').length, color: '#8b5cf6' },
                              { name: 'Testing', value: projectTasks.filter((t) => t.status === 'TESTING' || t.status === 'RETEST').length, color: '#06b6d4' },
                              { name: 'Bug Fix', value: projectTasks.filter((t) => t.status === 'BUG_FIX').length, color: '#f97316' },
                              { name: 'Blocked', value: projectTasks.filter((t) => t.status === 'BLOCKED').length, color: '#ef4444' },
                              { name: 'To Do', value: projectTasks.filter((t) => t.status === 'TODO').length, color: '#94a3b8' },
                            ].filter((d) => d.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={52}
                            outerRadius={78}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {[
                              { name: 'Completed', value: projectTasks.filter((t) => t.status === 'DONE').length, color: '#10b981' },
                              { name: 'In Progress', value: projectTasks.filter((t) => t.status === 'IN_PROGRESS').length, color: '#3b82f6' },
                              { name: 'In Review', value: projectTasks.filter((t) => t.status === 'IN_REVIEW').length, color: '#8b5cf6' },
                              { name: 'Testing', value: projectTasks.filter((t) => t.status === 'TESTING' || t.status === 'RETEST').length, color: '#06b6d4' },
                              { name: 'Bug Fix', value: projectTasks.filter((t) => t.status === 'BUG_FIX').length, color: '#f97316' },
                              { name: 'Blocked', value: projectTasks.filter((t) => t.status === 'BLOCKED').length, color: '#ef4444' },
                              { name: 'To Do', value: projectTasks.filter((t) => t.status === 'TODO').length, color: '#94a3b8' },
                            ].filter((d) => d.value > 0).map((entry, index) => (
                              <Cell key={`status-cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-bold text-slate-900">{projectTasks.length}</span>
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Tasks</span>
                      </div>
                    </div>

                    {/* Breakdown List */}
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {[
                        { name: 'Completed', value: projectTasks.filter((t) => t.status === 'DONE').length, color: '#10b981' },
                        { name: 'In Progress', value: projectTasks.filter((t) => t.status === 'IN_PROGRESS').length, color: '#3b82f6' },
                        { name: 'In Review', value: projectTasks.filter((t) => t.status === 'IN_REVIEW').length, color: '#8b5cf6' },
                        { name: 'Testing', value: projectTasks.filter((t) => t.status === 'TESTING' || t.status === 'RETEST').length, color: '#06b6d4' },
                        { name: 'Bug Fix', value: projectTasks.filter((t) => t.status === 'BUG_FIX').length, color: '#f97316' },
                        { name: 'Blocked', value: projectTasks.filter((t) => t.status === 'BLOCKED').length, color: '#ef4444' },
                        { name: 'To Do', value: projectTasks.filter((t) => t.status === 'TODO').length, color: '#94a3b8' },
                      ].filter((d) => d.value > 0).map((item) => (
                        <div key={item.name} className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-slate-50">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-slate-700 font-medium truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2 font-semibold text-slate-900">
                            <span>{item.value}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({Math.round((item.value / projectTasks.length) * 100)}%)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Tasks by Priority Pie Chart */}
              <div className="card p-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Tasks by Priority</h2>
                      <p className="text-xs text-slate-400">Urgency level distribution</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {projectTasks.filter((t) => t.priority === 'CRITICAL' || t.priority === 'HIGH').length} High/Critical
                  </span>
                </div>

                {projectTasks.length === 0 ? (
                  <div className="h-56 flex flex-col items-center justify-center text-slate-400 text-xs">
                    <ClipboardList className="w-8 h-8 text-slate-300 mb-2" />
                    No tasks created in this project yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    {/* Donut Chart */}
                    <div className="h-56 relative flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <RechartsTooltip
                            formatter={(value: any, name: any) => [
                              `${value} tasks (${Math.round(((value as number) / projectTasks.length) * 100)}%)`,
                              name,
                            ]}
                            contentStyle={{
                              backgroundColor: '#ffffff',
                              borderRadius: '12px',
                              border: '1px solid #e2e8f0',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                              fontSize: '12px',
                            }}
                          />
                          <Pie
                            data={[
                              { name: 'Critical', value: projectTasks.filter((t) => t.priority === 'CRITICAL').length, color: '#ef4444' },
                              { name: 'High', value: projectTasks.filter((t) => t.priority === 'HIGH').length, color: '#f97316' },
                              { name: 'Medium', value: projectTasks.filter((t) => t.priority === 'MEDIUM').length, color: '#eab308' },
                              { name: 'Low', value: projectTasks.filter((t) => t.priority === 'LOW').length, color: '#10b981' },
                            ].filter((d) => d.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={52}
                            outerRadius={78}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {[
                              { name: 'Critical', value: projectTasks.filter((t) => t.priority === 'CRITICAL').length, color: '#ef4444' },
                              { name: 'High', value: projectTasks.filter((t) => t.priority === 'HIGH').length, color: '#f97316' },
                              { name: 'Medium', value: projectTasks.filter((t) => t.priority === 'MEDIUM').length, color: '#eab308' },
                              { name: 'Low', value: projectTasks.filter((t) => t.priority === 'LOW').length, color: '#10b981' },
                            ].filter((d) => d.value > 0).map((entry, index) => (
                              <Cell key={`priority-cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-bold text-slate-900">{projectTasks.length}</span>
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Total</span>
                      </div>
                    </div>

                    {/* Breakdown List */}
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {[
                        { name: 'Critical', value: projectTasks.filter((t) => t.priority === 'CRITICAL').length, color: '#ef4444' },
                        { name: 'High', value: projectTasks.filter((t) => t.priority === 'HIGH').length, color: '#f97316' },
                        { name: 'Medium', value: projectTasks.filter((t) => t.priority === 'MEDIUM').length, color: '#eab308' },
                        { name: 'Low', value: projectTasks.filter((t) => t.priority === 'LOW').length, color: '#10b981' },
                      ].filter((d) => d.value > 0).map((item) => (
                        <div key={item.name} className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-slate-50">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-slate-700 font-medium truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2 font-semibold text-slate-900">
                            <span>{item.value}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({Math.round((item.value / projectTasks.length) * 100)}%)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Confidence Explanation */}
            {(() => {
              const totalTasks = projectTasks.length;
              const doneTasksCount = projectTasks.filter((t) => t.status === 'DONE').length;
              const overdueTasksList = projectTasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE');
              const blockedTasksList = projectTasks.filter((t) => t.status === 'BLOCKED');
              const highCriticalTasks = projectTasks.filter((t) => (t.priority === 'CRITICAL' || t.priority === 'HIGH') && t.status !== 'DONE');
              const completionRate = totalTasks > 0 ? (doneTasksCount / totalTasks) * 100 : 0;
              const riskPenalty = totalTasks > 0 ? ((overdueTasksList.length + blockedTasksList.length * 2) / totalTasks) * 30 : 0;
              const confidence = Math.max(0, Math.min(100, Math.round(completionRate - riskPenalty)));
              const upcomingDeadlines = projectTasks.filter((t) => t.dueDate && new Date(t.dueDate) > new Date() && t.status !== 'DONE').sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()).slice(0, 5);
              const uniqueAssignees = [...new Set(projectTasks.filter((t) => t.assigneeId).map((t) => t.assigneeId))];

              return (
                <>
                  {/* Confidence Explanation */}
                  <div className="card p-5">
                    <h3 className="text-sm font-bold text-slate-800 mb-3">How Delivery Confidence is Calculated</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                        <div className="font-bold text-emerald-700 mb-1">Completion: {Math.round(completionRate)}%</div>
                        <div className="text-emerald-600">{doneTasksCount} of {totalTasks} tasks done</div>
                      </div>
                      <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                        <div className="font-bold text-red-700 mb-1">Overdue Penalty: -{overdueTasksList.length > 0 ? Math.round((overdueTasksList.length / totalTasks) * 30) : 0}%</div>
                        <div className="text-red-600">{overdueTasksList.length} overdue tasks</div>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                        <div className="font-bold text-amber-700 mb-1">Blocked Penalty: -{blockedTasksList.length > 0 ? Math.round((blockedTasksList.length * 2 / totalTasks) * 30) : 0}%</div>
                        <div className="text-amber-600">{blockedTasksList.length} blocked tasks</div>
                      </div>
                    </div>
                  </div>

                  {/* Project Health Metrics */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="card p-4 text-center">
                      <div className="text-2xl font-bold text-red-500 font-display">{overdueTasksList.length}</div>
                      <div className="text-xs text-slate-500 mt-1">Overdue Tasks</div>
                    </div>
                    <div className="card p-4 text-center">
                      <div className="text-2xl font-bold text-amber-500 font-display">{blockedTasksList.length}</div>
                      <div className="text-xs text-slate-500 mt-1">Blocked Tasks</div>
                    </div>
                    <div className="card p-4 text-center">
                      <div className="text-2xl font-bold text-blue-500 font-display">{uniqueAssignees.length}</div>
                      <div className="text-xs text-slate-500 mt-1">Team Members</div>
                    </div>
                    <div className="card p-4 text-center">
                      <div className="text-2xl font-bold text-orange-500 font-display">{highCriticalTasks.length}</div>
                      <div className="text-xs text-slate-500 mt-1">High/Critical Tasks</div>
                    </div>
                  </div>

                  {/* Overdue + Blocked Lists + Upcoming Deadlines */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Overdue Tasks */}
                    <div className="card p-5">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <h3 className="text-sm font-bold text-slate-800">Overdue Tasks</h3>
                        <span className="badge-red text-[10px]">{overdueTasksList.length}</span>
                      </div>
                      {overdueTasksList.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {overdueTasksList.slice(0, 6).map((t) => {
                            const assignee = users.find((u) => u.id === t.assigneeId);
                            return (
                              <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-red-50 border border-red-100">
                                {assignee && <Avatar name={assignee.name} color={assignee.avatarColor} size="xs" />}
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-semibold text-slate-800 truncate">{t.title}</div>
                                  <div className="text-[10px] text-red-500">Due {formatDate(t.dueDate)}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-xs text-slate-400">No overdue tasks</div>
                      )}
                    </div>

                    {/* Blocked Tasks */}
                    <div className="card p-5">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                        <ShieldAlert className="w-4 h-4 text-amber-500" />
                        <h3 className="text-sm font-bold text-slate-800">Blocked Tasks</h3>
                        <span className="badge-amber text-[10px]">{blockedTasksList.length}</span>
                      </div>
                      {blockedTasksList.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {blockedTasksList.slice(0, 6).map((t) => {
                            const assignee = users.find((u) => u.id === t.assigneeId);
                            return (
                              <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-100">
                                {assignee && <Avatar name={assignee.name} color={assignee.avatarColor} size="xs" />}
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-semibold text-slate-800 truncate">{t.title}</div>
                                  <div className="text-[10px] text-amber-600">{t.priority} priority</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-xs text-slate-400">No blocked tasks</div>
                      )}
                    </div>

                    {/* Upcoming Deadlines */}
                    <div className="card p-5">
                      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                        <Clock className="w-4 h-4 text-blue-500" />
                        <h3 className="text-sm font-bold text-slate-800">Upcoming Deadlines</h3>
                      </div>
                      {upcomingDeadlines.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {upcomingDeadlines.map((t) => {
                            const assignee = users.find((u) => u.id === t.assigneeId);
                            return (
                              <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-100">
                                {assignee && <Avatar name={assignee.name} color={assignee.avatarColor} size="xs" />}
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-semibold text-slate-800 truncate">{t.title}</div>
                                  <div className="text-[10px] text-blue-600">Due {formatDate(t.dueDate)}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-xs text-slate-400">No upcoming deadlines</div>
                      )}
                    </div>
                  </div>

                  {/* Assignee Workload */}
                  <div className="card p-5">
                    <h3 className="text-sm font-bold text-slate-800 mb-3">Assignee Workload</h3>
                    <div className="space-y-2">
                      {uniqueAssignees.slice(0, 8).map((aId) => {
                        const user = users.find((u) => u.id === aId);
                        if (!user) return null;
                        const memberTasks = projectTasks.filter((t) => t.assigneeId === aId);
                        const activeCount = memberTasks.filter((t) => t.status !== 'DONE').length;
                        const doneCount = memberTasks.filter((t) => t.status === 'DONE').length;
                        const overdueCount = memberTasks.filter((t) => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < new Date()).length;
                        const pct = memberTasks.length > 0 ? Math.round((doneCount / memberTasks.length) * 100) : 0;
                        return (
                          <div key={aId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                            <Avatar name={user.name} color={user.avatarColor} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-slate-800">{user.name}</span>
                                <span className="text-[10px] text-slate-500">{activeCount} active, {doneCount} done</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5">
                                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                            {overdueCount > 0 && <span className="text-[10px] font-bold text-red-500">{overdueCount} overdue</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recent Project Activity */}
                  <div className="card p-5">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                      <h3 className="text-sm font-bold text-slate-800">Recent Project Activity</h3>
                    </div>
                    <ActivityFeed activities={projectActivities.slice(0, 8)} />
                  </div>
                </>
              );
            })()}
          </div>
        )}
        {activeTab === 'chat' && (
          <ProjectChatTab projectId={project.id} />
        )}
        {activeTab === 'workflow' && (
          canConfigureWorkflow ? (
            <WorkflowBuilder projectId={project.id} workflowId={project.workflowId} />
          ) : (
            <div className="card p-6">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-800">Workflow configuration is restricted</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Only Admins and Project Managers can view and edit project workflows.
                  </p>
                </div>
              </div>
            </div>
          )
        )}
        {activeTab === 'work-queue' && (
          <TasksListPage projectId={project.id} showBacklogOnly />
        )}
        {activeTab === 'iterations-overview' && (
          <IterationsOverviewTab projectId={project.id} />
        )}
        {activeTab === 'backlog-overview' && (
          <BacklogOverviewTab projectId={project.id} />
        )}
        {activeTab === 'execution-board' && (
          <KanbanBoard projectId={project.id} />
        )}
        {activeTab === 'work-items' && (
          <TasksListPage projectId={project.id} />
        )}
        {activeTab === 'calendar' && (
          <ProjectCalendar projectId={project.id} />
        )}
        {activeTab === 'team-hub' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectTeams.map((team) => {
              const leader = users.find((u) => u.id === team.teamLeaderId);
              const members = team.memberIds.map((id) => users.find((u) => u.id === id)).filter(Boolean);
              const teamTasks = tasks.filter((t) => t.teamId === team.id && t.projectId === project.id);
              const activeTasks = teamTasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'IN_REVIEW' || t.status === 'TESTING');
              const totalEstHours = teamTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
              const assignedHours = activeTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
              const totalPoints = teamTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
              const activePoints = activeTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
              const completedPoints = teamTasks.filter((t) => t.status === 'DONE').reduce((sum, t) => sum + (t.storyPoints || 0), 0);
              const capacityPerMember = 40; // Assuming 40h/week per member
              const totalCapacity = members.length * capacityPerMember;
              const remainingCapacity = totalCapacity - assignedHours;
              const isOverCapacity = remainingCapacity < 0;
              const capacityPct = totalCapacity > 0 ? Math.min(100, Math.round((assignedHours / totalCapacity) * 100)) : 0;

              return (
                <div key={team.id} className="card p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white"
                      style={{ backgroundColor: team.color }}>{team.name[0]}</div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{team.name}</h3>
                      <p className="text-xs text-slate-400">{team.memberIds.length} members</p>
                    </div>
                  </div>
                  {leader && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100 mb-3">
                      <Avatar name={leader.name} color={leader.avatarColor} size="xs" />
                      <div>
                        <div className="text-xs font-medium text-slate-700">{leader.name}</div>
                        <div className="text-xs text-slate-400">Team Leader</div>
                      </div>
                    </div>
                  )}
                  {/* Capacity Info */}
                  <div className={`p-3 rounded-xl border mb-3 ${isOverCapacity ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Capacity</span>
                      {isOverCapacity && (
                        <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">Over Capacity</span>
                      )}
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 mb-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${capacityPct > 100 ? 'bg-red-500' : capacityPct > 80 ? 'bg-amber-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(100, capacityPct)}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-xs font-bold text-slate-900">{totalCapacity}h</div>
                        <div className="text-[9px] text-slate-500">Total</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-blue-700">{assignedHours}h</div>
                        <div className="text-[9px] text-slate-500">Assigned</div>
                      </div>
                      <div>
                        <div className={`text-xs font-bold ${isOverCapacity ? 'text-red-700' : 'text-emerald-700'}`}>
                          {remainingCapacity}h
                        </div>
                        <div className="text-[9px] text-slate-500">Available</div>
                      </div>
                    </div>
                  </div>
                  {/* Story Points */}
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 mb-3">
                    <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-2">Story Points</div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-xs font-bold text-slate-900">{totalPoints}</div>
                        <div className="text-[9px] text-slate-500">Total</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-blue-700">{activePoints}</div>
                        <div className="text-[9px] text-slate-500">Active</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-emerald-700">{completedPoints}</div>
                        <div className="text-[9px] text-slate-500">Done</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mb-3 text-[10px] text-slate-500">
                    <span>{teamTasks.length} tasks assigned to project</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {members.slice(0, 6).map((m) => m && (
                      <Avatar key={m.id} name={m.name} color={m.avatarColor} size="xs" />
                    ))}
                    {members.length > 6 && (
                      <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs flex items-center justify-center font-medium">
                        +{members.length - 6}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {activeTab === 'activity-pulse' && (
          <div className="card p-5">
            <ActivityFeed activities={projectActivities} />
          </div>
        )}
        {activeTab === 'insights' && (
          <ReportsPage
            projectId={project.id}
            initialSprintId={initialSprintId}
            initialView={initialView}
          />
        )}
        {activeTab === 'delivery-timeline' && (
          <ProjectRoadmap projectId={project.id} />
        )}
        {activeTab === 'delivery-releases' && (
          <ReleaseManagement projectId={project.id} />
        )}
        {activeTab === 'delivery-risk' && (
          <DependenciesView projectId={project.id} />
        )}
        {activeTab === 'automation-studio' && (
          <AutomationRulesPage projectId={project.id} />
        )}
        {activeTab === 'query-builder' && (
          <AdvancedSearchPage projectId={project.id} />
        )}
        {activeTab === 'export' && (
          <ExportPanel projectId={project.id} />
        )}
        {activeTab === 'asset-vault' && (
          <ProjectAssetVaultTab projectId={project.id} />
        )}
      </div>

      {/* Floating Project Live Chat Widget */}
      <ProjectChatDrawer
        projectId={project.id}
        projectName={project.name}
        onOpenFullTab={() => setActiveTab('chat')}
      />
    </div>
  );
};
