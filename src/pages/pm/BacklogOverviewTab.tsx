import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, Clock, Flag,
  Filter, Search, MoreHorizontal, ChevronDown, ChevronRight,
  Users, ExternalLink, Plus, X, Layers, Calendar, Check,
  ArrowRight, FileText, Sparkles, Hash, Edit3, Trash2, Eye,
  ArrowUpRight, Link2, Share2, Shield, BarChart3, RefreshCw,
  ListTodo, MoveRight, CornerDownRight, Tag, Play, CheckCircle,
  FolderKanban, ArrowDownToLine, ChevronUp, CalendarRange, History, FolderInput
} from 'lucide-react';
import { toast } from 'sonner';
import { WorkItemIcon } from '../../components/common/WorkItemIcon';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { matchId } from '../../utils/idUtils';
import { getIssueKeyPrefix } from '../../utils/projectIdentity';
import { issuePath } from '../../utils/issueUrl';
import { isCancelledWorkItem } from '../../utils/roleUtils';
import { buildSprintIdentifiers, formatSprintIdentifier } from '../../utils/sprintIdentifier';
import { CreateIterationModal } from './CreateIterationModal';
import { MoveTaskModal } from '../shared/tasks/MoveTaskModal';
import type { TaskStatus, Priority, Task, Sprint } from '../../types';

interface BacklogOverviewTabProps {
  projectId: string;
  embedded?: boolean;
  hideEpicsBreakdown?: boolean;
  /** Renders only the compact Jira-style backlog: slim header + flat issue list
   *  + inline create. Hides dashboard chrome (stat chips, quick-filter pills,
   *  EPICS row, grooming readiness, linked-PRDs menu entry, epics breakdown). */
  compact?: boolean;
}

interface LinkedPage {
  id: string;
  title: string;
  url: string;
  space: string;
  updatedAt: string;
}

interface BacklogIssue {
  id: string;
  key: string;
  title: string;
  type: 'STORY' | 'TASK' | 'BUG' | 'EPIC';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: TaskStatus;
  /** Terminal resolution, so DONE + CANCELLED renders as Cancelled (never Done). */
  resolution?: string;
  releaseTag: string;
  epicName: string;
  epicColor: string;
  assigneeName: string;
  assigneeInitial: string;
  assigneeAvatarColor: string;
  avatarUrl?: string;
  storyPoints: number;
  updatedDate: string;
  sprintId: string | null; // null = Backlog
  isGroomed: boolean;
  isFlagged?: boolean;
}

// Epic badge palette generator
const EPIC_COLORS = [
  'bg-[#433827] text-[#fcd34d] border-[#785d26]', // Amber/Brown
  'bg-[#b45309] text-white border-[#92400e]',       // Orange
  'bg-[#86198f] text-white border-[#701a75]',       // Purple
  'bg-[#be123c] text-white border-[#9f1239]',       // Rose
  'bg-[#c2410c] text-white border-[#9a3412]',       // Dark Orange
  'bg-[#1d4ed8] text-white border-[#1e40af]',       // Blue
  'bg-[#0369a1] text-white border-[#075985]',       // Cyan
  'bg-[#047857] text-white border-[#065f46]',       // Emerald
];

const getEpicColor = (epicName: string): string => {
  let hash = 0;
  for (let i = 0; i < epicName.length; i++) {
    hash = (hash << 5) - hash + epicName.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % EPIC_COLORS.length;
  return EPIC_COLORS[index];
};

export const BacklogOverviewTab: React.FC<BacklogOverviewTabProps> = ({
  projectId,
  embedded = false,
  hideEpicsBreakdown = false,
  compact = false,
}) => {
  const navigate = useNavigate();
  const {
    projects, sprints, pis, tasks, users, teams,
    updateSprintStatus, updateTask, createTask
  } = useAppStore();
  const { currentUser } = useAuthStore();

  const project = projects.find((p) => p.id === projectId);
  const projectKey = getIssueKeyPrefix(project) || 'PRJ';

  // Find all sprints for this project (Previous, Active, and Future/Planned)
  const projectSprints = useMemo(() => {
    const list = sprints
      .filter((s) => s.projectId === projectId)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    const hasCompleted = list.some((s) => s.status === 'COMPLETED');
    const hasActive = list.some((s) => s.status === 'ACTIVE');
    const hasPlanned = list.some((s) => s.status === 'PLANNED');

    const enriched = [...list];

    // Synthetic fallback sprints get their own PI (beyond the real ones) so they can
    // never shift the numbering of real sprints in either view.
    const realPiMax = list.length
      ? Math.max(...list.map((s) => Number(s.name.match(/\d+/)?.[0] || 1)))
      : 0;
    const syntheticPiNumber = realPiMax + 1;
    const syntheticPiId =
      pis.find((p) => p.projectId === projectId && p.number === syntheticPiNumber)?.id || '';
    let syntheticSeq = 0;
    const syntheticName = () => `${projectKey} ${syntheticPiNumber}.${++syntheticSeq}`;
    const syntheticIterationNumber = () => `${syntheticPiNumber}.${syntheticSeq}`;

    // Ensure at least one previous sprint is available for moving tasks to
    if (!hasCompleted) {
      enriched.unshift({
        id: `spr-prev-${projectKey}`,
        projectId,
        piId: syntheticPiId,
        name: syntheticName(),
        iterationNumber: syntheticIterationNumber(),
        goal: 'Initial architecture & baseline MVP',
        status: 'COMPLETED' as const,
        startDate: '2024-07-01',
        endDate: '2024-07-14',
        taskIds: [],
        createdById: 'u-pm-01',
        createdAt: '2024-06-25T00:00:00Z',
      });
    }

    // Ensure an active sprint exists
    if (!hasActive) {
      enriched.push({
        id: `spr-act-${projectKey}`,
        projectId,
        piId: syntheticPiId,
        name: syntheticName(),
        iterationNumber: syntheticIterationNumber(),
        goal: 'Core feature development and user workflows',
        status: 'ACTIVE' as const,
        startDate: '2024-09-01',
        endDate: '2024-09-14',
        taskIds: [],
        createdById: 'u-pm-01',
        createdAt: '2024-08-25T00:00:00Z',
      });
    }

    // Ensure future/planned sprint exists
    if (!hasPlanned) {
      enriched.push({
        id: `spr-plan-${projectKey}`,
        projectId,
        piId: syntheticPiId,
        name: syntheticName(),
        iterationNumber: syntheticIterationNumber(),
        goal: 'Advanced integrations, scale & release rollout',
        status: 'PLANNED' as const,
        startDate: '2024-10-01',
        endDate: '2024-10-14',
        taskIds: [],
        createdById: 'u-pm-01',
        createdAt: '2024-09-05T00:00:00Z',
      });
    }

    return enriched;
  }, [sprints, pis, projectId, projectKey]);

  // One-based sprint identifiers: <Project Key><PI>.<Iteration Number>, e.g. ECOMM4.1
  // (archived sprints are excluded so labels match the Iterations Overview headers)
  const sprintIdentifiers = useMemo(
    () => buildSprintIdentifiers(projectSprints.filter((s) => !s.isArchived), projectKey),
    [projectSprints, projectKey]
  );
  const sprintLabel = (sprint: Sprint) =>
    formatSprintIdentifier(sprint, projectKey, sprintIdentifiers);
  const detailSprintLabel = (sprintId: string | null) => {
    const sprint = projectSprints.find((s) => s.id === sprintId);
    return sprint ? sprintLabel(sprint) : 'Iteration';
  };

  // Active, Planned/Future, and Previous/Closed sprints
  const activeSprints = useMemo(() => {
    return projectSprints.filter((s) => s.status === 'ACTIVE');
  }, [projectSprints]);

  const plannedSprints = useMemo(() => {
    return projectSprints.filter((s) => s.status === 'PLANNED');
  }, [projectSprints]);

  const closedSprints = useMemo(() => {
    return projectSprints.filter((s) => s.status === 'COMPLETED');
  }, [projectSprints]);

  // Project team members for Quick Filters
  const projectTeamMembers = useMemo(() => {
    const teamIds = project?.teamIds || [];
    const relTeams = teams.filter((t) => teamIds.includes(t.id));
    const memberIds = [...new Set(relTeams.flatMap((t) => t.memberIds))];
    const teamUsers = users.filter((u) => memberIds.includes(u.id) || u.id === project?.projectManagerId);

    if (teamUsers.length > 0) {
      return teamUsers;
    }
    return users.slice(0, 15);
  }, [project, teams, users]);

  // Domain templates for common project types
  const isHealthcare = project?.category?.toLowerCase().includes('health') || project?.name?.toLowerCase().includes('hospital');
  const isEcommerce = project?.category?.toLowerCase().includes('retail') || project?.name?.toLowerCase().includes('e-commerce') || project?.name?.toLowerCase().includes('commerce');

  const domainEpics = useMemo(() => {
    return isHealthcare
      ? ['Patient Records', 'Doctor Scheduling', 'Billing & Claims', 'Pharmacy & Lab', 'EMR Integration']
      : isEcommerce
      ? ['Checkout & Cart', 'Product Catalog', 'Payment Gateway', 'Order Processing', 'Search & Discovery']
      : ['Core Platform', 'Security & IAM', 'Workflow Engine', 'Integration APIs', 'Analytics & Reporting'];
  }, [isHealthcare, isEcommerce]);

  // Build master pool of issues across Iterations and Work Queue
  const initialIssues = useMemo<BacklogIssue[]>(() => {
    const projectTasks = tasks.filter((t) => t.projectId === projectId && t.type !== 'EPIC');

    const domainSeedBacklog: { title: string; epic: string; points: number; priority: Priority; assignee: string; isGroomed: boolean }[] = isHealthcare
      ? [
          { title: 'HL7 FHIR Clinical Telemetry API Connector for Inpatient Monitors', epic: 'EMR Integration', points: 8, priority: 'CRITICAL', assignee: 'Alex Chen', isGroomed: true },
          { title: 'Patient Consent & HIPAA Audit Log Data Retention Automation', epic: 'Patient Records', points: 5, priority: 'HIGH', assignee: 'Priya Sharma', isGroomed: true },
          { title: 'Automated Pharmacy Formulary Drug-Drug Interaction Warning Guard', epic: 'Pharmacy & Lab', points: 5, priority: 'HIGH', assignee: 'David Kim', isGroomed: true },
          { title: 'Outpatient Telehealth WebRTC Session Recording & Cloud Archival', epic: 'EMR Integration', points: 3, priority: 'MEDIUM', assignee: 'Marcus Vance', isGroomed: false },
          { title: 'Medical Insurance Pre-Authorization Automated Claims EDI 278 Engine', epic: 'Billing & Claims', points: 8, priority: 'HIGH', assignee: 'Maya Patel', isGroomed: true },
          { title: 'Physician On-Call Rotations Shift Swapping Mobile Flow', epic: 'Doctor Scheduling', points: 3, priority: 'LOW', assignee: 'Elena Rostova', isGroomed: false },
          { title: 'Emergency Department Real-time Bed Occupancy Dashboard on Wallboard', epic: 'Doctor Scheduling', points: 5, priority: 'HIGH', assignee: 'Alex Chen', isGroomed: true },
          { title: 'Lab Results Automated SMS Patient Notification with Secure Token', epic: 'Pharmacy & Lab', points: 2, priority: 'MEDIUM', assignee: 'Priya Sharma', isGroomed: true },
        ]
      : isEcommerce
      ? [
          { title: 'Apple Pay & Google Pay One-Touch Express Checkout Gateway', epic: 'Payment Gateway', points: 5, priority: 'CRITICAL', assignee: 'Elena Rostova', isGroomed: true },
          { title: 'Real-time Multi-Warehouse Inventory Allocation & Split Shipments', epic: 'Order Processing', points: 8, priority: 'HIGH', assignee: 'Priya Sharma', isGroomed: true },
          { title: 'AI-Powered Related Products Recommendation Carousel on PDP', epic: 'Search & Discovery', points: 5, priority: 'HIGH', assignee: 'Marcus Vance', isGroomed: true },
          { title: 'Dynamic Multi-Currency Price Localization & Geolocation GeoIP', epic: 'Product Catalog', points: 3, priority: 'MEDIUM', assignee: 'Alex Chen', isGroomed: false },
          { title: 'Automated Abandoned Cart Recovery Email Sequence with Discount Token', epic: 'Checkout & Cart', points: 5, priority: 'HIGH', assignee: 'Maya Patel', isGroomed: true },
          { title: 'Customer Product Reviews & Star Rating System with Photo Upload', epic: 'Product Catalog', points: 3, priority: 'MEDIUM', assignee: 'David Kim', isGroomed: true },
          { title: 'Self-Service Customer Returns Portal with Prepaid Return Label PDF', epic: 'Order Processing', points: 5, priority: 'HIGH', assignee: 'Marcus Vance', isGroomed: false },
          { title: 'B2B Bulk Wholesale Order Matrix & Net-30 Invoicing Engine', epic: 'Checkout & Cart', points: 8, priority: 'MEDIUM', assignee: 'Liam O\'Connor', isGroomed: true },
          { title: 'Automated TaxJar & Avalara Sales Tax Calculation Sync', epic: 'Payment Gateway', points: 3, priority: 'LOW', assignee: 'Elena Rostova', isGroomed: false },
        ]
      : [
          { title: 'Multi-Tenant Database Row-Level Security Partitioning Engine', epic: 'Core Platform', points: 8, priority: 'CRITICAL', assignee: 'Priya Sharma', isGroomed: true },
          { title: 'Real-time WebSocket Push Notification Service with Redis PubSub', epic: 'Integration APIs', points: 5, priority: 'HIGH', assignee: 'Alex Chen', isGroomed: true },
          { title: 'Enterprise SSO SCIM 2.0 User Provisioning & Deprovisioning Flow', epic: 'Security & IAM', points: 5, priority: 'HIGH', assignee: 'Marcus Vance', isGroomed: true },
          { title: 'Custom Workflow Visual State Diagram Editor with Node Connectors', epic: 'Workflow Engine', points: 8, priority: 'HIGH', assignee: 'David Kim', isGroomed: false },
          { title: 'Automated PDF & CSV Scheduled Executive Delivery Export Queue', epic: 'Analytics & Reporting', points: 3, priority: 'MEDIUM', assignee: 'Maya Patel', isGroomed: true },
          { title: 'API Rate Limiting by Tenant Tier with Cloudflare Worker Interceptor', epic: 'Integration APIs', points: 5, priority: 'HIGH', assignee: 'Elena Rostova', isGroomed: false },
        ];

    const result: BacklogIssue[] = [];

    // 1. Existing tasks from appStore
    projectTasks.forEach((t, index) => {
      const assignee = users.find((u) => u.id === t.assigneeId);
      const epic = domainEpics[index % domainEpics.length];
      const keyNum = 100 + index;
      result.push({
        id: t.id,
        key: `${projectKey}-${keyNum}`,
        title: t.title,
        type: t.type === 'BUG_FIX' ? 'BUG' : t.type === 'FEATURE' ? 'STORY' : 'TASK',
        priority: t.priority,
        status: t.status,
        resolution: t.resolution,
        releaseTag: `${projectKey} PI24`,
        epicName: epic,
        epicColor: getEpicColor(epic),
        assigneeName: assignee ? assignee.name : 'Unassigned',
        assigneeInitial: assignee ? assignee.name[0] : 'U',
        assigneeAvatarColor: assignee?.avatarColor || '#64748b',
        avatarUrl: assignee?.avatarUrl,
        storyPoints: t.storyPoints || 3,
        updatedDate: t.updatedAt ? t.updatedAt.split('T')[0] : '2026-09-15',
        sprintId: t.sprintId || null,
        isGroomed: true,
        isFlagged: t.isFlagged,
      });
    });

    // 2. Unassigned candidate stories for the Product Work Queue pool
    domainSeedBacklog.forEach((seed, idx) => {
      const keyNum = 201 + idx;
      const assigneeUser = projectTeamMembers[idx % projectTeamMembers.length];
      result.push({
        id: `backlog-seed-${keyNum}`,
        key: `${projectKey}-${keyNum}`,
        title: seed.title,
        type: 'STORY',
        priority: seed.priority,
        status: 'TODO',
        releaseTag: `${projectKey} Work Queue`,
        epicName: seed.epic,
        epicColor: getEpicColor(seed.epic),
        assigneeName: assigneeUser ? assigneeUser.name : seed.assignee,
        assigneeInitial: assigneeUser ? assigneeUser.name[0] : seed.assignee[0],
        assigneeAvatarColor: assigneeUser?.avatarColor || '#0284c7',
        avatarUrl: assigneeUser?.avatarUrl,
        storyPoints: seed.points,
        updatedDate: '2026-09-15',
        sprintId: null, // specifically in unassigned backlog
        isGroomed: seed.isGroomed,
      });
    });

    return result;
  }, [tasks, projectId, projectKey, users, projectTeamMembers, domainEpics, isHealthcare, isEcommerce]);

  // Master issues state
  const [issues, setIssues] = useState<BacklogIssue[]>(initialIssues);

  useEffect(() => {
    setIssues(initialIssues);
  }, [initialIssues]);

  // Collapsed states per sprint card (sprintId or 'backlog' as key)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSectionCollapse = (id: string) => {
    setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isSectionExpanded = (id: string) => {
    if (collapsedSections[id] !== undefined) {
      return !collapsedSections[id];
    }
    // Previous/completed sprints start collapsed by default; active, planned, and backlog start expanded
    const isPreviousSprint = closedSprints.some((s) => s.id === id);
    return !isPreviousSprint;
  };

  const [allExpanded, setAllExpanded] = useState<boolean>(true);

  const toggleExpandAll = () => {
    if (allExpanded) {
      const collapsed: Record<string, boolean> = { backlog: true };
      projectSprints.forEach((s) => {
        collapsed[s.id] = true;
      });
      setCollapsedSections(collapsed);
      setAllExpanded(false);
    } else {
      setCollapsedSections({});
      setAllExpanded(true);
    }
  };

  // Quick filters state
  const [activePersonFilters, setActivePersonFilters] = useState<string[]>([]);
  const [activeEpicFilter, setActiveEpicFilter] = useState<string | null>(null);
  const [onlyMyIssues, setOnlyMyIssues] = useState<boolean>(false);
  const [onlyGroomed, setOnlyGroomed] = useState<boolean>(false);
  const [onlyHighPriority, setOnlyHighPriority] = useState<boolean>(false);
  const [onlyUnassigned, setOnlyUnassigned] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected issues for multi-selection
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  const [bulkSprintDropdownOpen, setBulkSprintDropdownOpen] = useState<boolean>(false);

  // Active hover sprint move dropdown
  const [targetSprintForIssue, setTargetSprintForIssue] = useState<string | null>(null);

  // Inline inputs tracker per section (sprintId or 'backlog')
  const [inlineInputs, setInlineInputs] = useState<Record<string, string>>({});

  // Modals & Popovers
  const [showCreateIssueModal, setShowCreateIssueModal] = useState<boolean>(false);
  const [showCreateSprintModal, setShowCreateSprintModal] = useState<boolean>(false);
  const [showLinkedPagesModal, setShowLinkedPagesModal] = useState<boolean>(false);
  const [selectedIssueDetail, setSelectedIssueDetail] = useState<BacklogIssue | null>(null);
  const [isEpicsBreakdownExpanded, setIsEpicsBreakdownExpanded] = useState<boolean>(true);

  // Compact header state (standalone Work Queue view)
  const [showInlineAdd, setShowInlineAdd] = useState<boolean>(false);
  const [backlogMenuOpen, setBacklogMenuOpen] = useState<boolean>(false);
  const backlogMenuRef = useRef<HTMLDivElement>(null);

  // Close the "..." backlog menu on outside click
  useEffect(() => {
    if (!backlogMenuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (backlogMenuRef.current && !backlogMenuRef.current.contains(e.target as Node)) {
        setBacklogMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [backlogMenuOpen]);

  // Create Work Item form state
  const [newIssueSummary, setNewIssueSummary] = useState('');
  const [newIssueType, setNewIssueType] = useState<'STORY' | 'TASK' | 'BUG'>('STORY');
  const [newIssuePriority, setNewIssuePriority] = useState<Priority>('HIGH');
  const [newIssuePoints, setNewIssuePoints] = useState<number>(5);
  const [newIssueEpic, setNewIssueEpic] = useState(domainEpics[0] || 'Core Platform');
  const [newIssueAssignee, setNewIssueAssignee] = useState(projectTeamMembers[0]?.name || 'Priya Sharma');
  const [newIssueTargetSection, setNewIssueTargetSection] = useState<string>('backlog');

  // Create Iteration state — delegated to the shared PI-aware Create Iteration
  // modal (Project → PI → Iteration); only the open/close flag lives here.
  const [createIterationPiId, setCreateIterationPiId] = useState<string | undefined>(undefined);

  // Linked Pages
  const [linkedPages, setLinkedPages] = useState<LinkedPage[]>([
    {
      id: 'lp-b1',
      title: `${project?.name || 'Project'} — Product Roadmap & Work Queue Vision PRD`,
      url: 'https://confluence.enterprise.internal/pages/product-vision-prd',
      space: `${projectKey} Product Management`,
      updatedAt: '12/Sep/26 3:30 PM'
    },
    {
      id: 'lp-b2',
      title: `${projectKey} Quarterly OKRs & Epics Prioritization Scoring Matrix`,
      url: 'https://confluence.enterprise.internal/pages/okr-prioritization',
      space: 'Executive Strategy',
      updatedAt: '14/Sep/26 11:00 AM'
    },
    {
      id: 'lp-b3',
      title: `${projectKey} Non-Functional Requirements & Security Baseline Spec`,
      url: 'https://confluence.enterprise.internal/pages/nfr-security-baseline',
      space: `${projectKey} Architecture`,
      updatedAt: '15/Sep/26 4:15 PM'
    }
  ]);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageUrl, setNewPageUrl] = useState('');

  // Filter issues according to quick filters
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesKey = issue.key.toLowerCase().includes(query);
        const matchesTitle = issue.title.toLowerCase().includes(query);
        const matchesEpic = issue.epicName.toLowerCase().includes(query);
        const matchesAssignee = issue.assigneeName.toLowerCase().includes(query);
        if (!matchesKey && !matchesTitle && !matchesEpic && !matchesAssignee) {
          return false;
        }
      }

      // Quick filter: Person
      if (activePersonFilters.length > 0) {
        if (!activePersonFilters.includes(issue.assigneeName)) {
          return false;
        }
      }

      // Quick filter: Epic chip
      if (activeEpicFilter && issue.epicName !== activeEpicFilter) {
        return false;
      }

      // Quick filter: Unassigned
      if (onlyUnassigned && issue.assigneeName !== 'Unassigned') {
        return false;
      }

      // Quick filter: Only My Work Items
      if (onlyMyIssues) {
        const myName = currentUser?.name?.toLowerCase() || '';
        if (!issue.assigneeName.toLowerCase().includes(myName.split(' ')[0])) {
          return false;
        }
      }

      // Quick filter: High priority
      if (onlyHighPriority && issue.priority !== 'HIGH' && issue.priority !== 'CRITICAL') {
        return false;
      }

      // Quick filter: Groomed only
      if (onlyGroomed && !issue.isGroomed) {
        return false;
      }

      return true;
    });
  }, [issues, searchQuery, activePersonFilters, activeEpicFilter, onlyUnassigned, onlyMyIssues, onlyHighPriority, onlyGroomed, currentUser]);

  // Group filtered issues by sprintId and backlog
  const sprintGroups = useMemo(() => {
    const map = new Map<string | null, BacklogIssue[]>();

    // initialize for all sprints (active, future/planned, and previous/completed)
    projectSprints.forEach((s) => {
      map.set(s.id, []);
    });
    map.set(null, []); // for Backlog

    filteredIssues.forEach((issue) => {
      if (issue.sprintId && map.has(issue.sprintId)) {
        map.get(issue.sprintId)!.push(issue);
      } else {
        map.get(null)!.push(issue);
      }
    });

    return map;
  }, [filteredIssues, projectSprints]);

  // Statistics calculation for any issue array
  const calculatePoints = (items: BacklogIssue[]) => {
    let todoCount = 0;
    let inProgCount = 0;
    let doneCount = 0;
    let totalPoints = 0;

    items.forEach((item) => {
      // Cancelled work is out of scope for estimation counts.
      if (isCancelledWorkItem(item)) return;
      totalPoints += item.storyPoints;
      if (item.status === 'DONE') {
        doneCount += item.storyPoints;
      } else if (item.status === 'IN_PROGRESS' || item.status === 'IN_REVIEW' || item.status === 'TESTING' || item.status === 'BUG_FIX') {
        inProgCount += item.storyPoints;
      } else {
        todoCount += item.storyPoints;
      }
    });

    return { todoPoints: todoCount, inProgPoints: inProgCount, donePoints: doneCount, totalPoints };
  };

  // Work Queue pool statistics
  const backlogPoolIssues = sprintGroups.get(null) || [];
  const backlogStats = useMemo(() => {
    let totalPts = 0;
    let highPts = 0;
    let groomedPts = 0;
    let groomedCount = 0;

    backlogPoolIssues.forEach((t) => {
      totalPts += t.storyPoints;
      if (t.priority === 'HIGH' || t.priority === 'CRITICAL') highPts += t.storyPoints;
      if (t.isGroomed) {
        groomedPts += t.storyPoints;
        groomedCount++;
      }
    });

    const readinessPct = backlogPoolIssues.length > 0 ? Math.round((groomedCount / backlogPoolIssues.length) * 100) : 0;
    return { totalIssues: backlogPoolIssues.length, totalPoints: totalPts, highPoints: highPts, groomedPoints: groomedPts, readinessPct };
  }, [backlogPoolIssues]);

  // Epics breakdown
  const epicBreakdown = useMemo(() => {
    return domainEpics.map((epic) => {
      const epicIssues = filteredIssues.filter((i) => i.epicName === epic);
      const points = epicIssues.reduce((sum, i) => sum + i.storyPoints, 0);
      return {
        name: epic,
        color: getEpicColor(epic),
        issueCount: epicIssues.length,
        points,
      };
    });
  }, [domainEpics, filteredIssues]);

  const togglePersonFilter = (name: string) => {
    setActivePersonFilters((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
  };

  const clearAllFilters = () => {
    setActivePersonFilters([]);
    setActiveEpicFilter(null);
    setOnlyMyIssues(false);
    setOnlyGroomed(false);
    setOnlyHighPriority(false);
    setOnlyUnassigned(false);
    setSearchQuery('');
    toast.info('All filters cleared');
  };

  // Move issue to a destination (sprintId or null for backlog)
  const handleMoveIssue = (issueId: string, destSprintId: string | null) => {
    const issueToMove = issues.find((i) => i.id === issueId);
    if (!issueToMove) return;

    // Check if real task exists
    const realTask = tasks.find((t) => t.id === issueId);
    if (realTask) {
      updateTask(issueId, { sprintId: destSprintId || undefined });
    }

    setIssues((prev) =>
      prev.map((i) => (i.id === issueId ? { ...i, sprintId: destSprintId } : i))
    );
    setTargetSprintForIssue(null);

    // Auto-expand destination section so user immediately sees the moved issue
    if (destSprintId) {
      setCollapsedSections((prev) => ({ ...prev, [destSprintId]: false }));
    } else {
      setCollapsedSections((prev) => ({ ...prev, backlog: false }));
    }

    const destSprint = projectSprints.find((s) => s.id === destSprintId);
    const sprintCategory = destSprint
      ? destSprint.status === 'COMPLETED'
        ? 'Previous Iteration'
        : destSprint.status === 'ACTIVE'
        ? 'Live Iteration'
        : 'Future Iteration'
      : 'Product Work Queue';

    const destName = destSprint
      ? `${sprintLabel(destSprint)} (${sprintCategory})`
      : 'Product Work Queue';

    toast.success(`Moved ${issueToMove.key} to ${destName}`);
  };

  // Bulk move selected issues to a destination
  const handleBulkMove = (destSprintId: string | null) => {
    if (selectedIssueIds.length === 0) return;

    selectedIssueIds.forEach((id) => {
      const realTask = tasks.find((t) => t.id === id);
      if (realTask) {
        updateTask(id, { sprintId: destSprintId || undefined });
      }
    });

    setIssues((prev) =>
      prev.map((i) => (selectedIssueIds.includes(i.id) ? { ...i, sprintId: destSprintId } : i))
    );

    // Auto-expand destination section
    if (destSprintId) {
      setCollapsedSections((prev) => ({ ...prev, [destSprintId]: false }));
    } else {
      setCollapsedSections((prev) => ({ ...prev, backlog: false }));
    }

    const destSprint = projectSprints.find((s) => s.id === destSprintId);
    const sprintCategory = destSprint
      ? destSprint.status === 'COMPLETED'
        ? 'Previous Iteration'
        : destSprint.status === 'ACTIVE'
        ? 'Live Iteration'
        : 'Future Iteration'
      : 'Product Work Queue';

    const destName = destSprint
      ? `${sprintLabel(destSprint)} (${sprintCategory})`
      : 'Product Work Queue';

    toast.success(`Moved ${selectedIssueIds.length} stories into ${destName}`);
    setSelectedIssueIds([]);
    setBulkSprintDropdownOpen(false);
  };

  // Inline create for a specific section
  const handleInlineCreateForSection = (sectionKey: string | null, e: React.KeyboardEvent<HTMLInputElement>) => {
    const text = inlineInputs[sectionKey || 'backlog'] || '';
    if (e.key === 'Enter' && text.trim()) {
      const nextIdNum = 200 + issues.length + 1;
      const newKey = `${projectKey}-${nextIdNum}`;
      const newIssue: BacklogIssue = {
        id: `backlog-quick-${nextIdNum}`,
        key: newKey,
        title: text.trim(),
        type: 'STORY',
        priority: 'HIGH',
        status: 'TODO',
        releaseTag: `${projectKey} PI24`,
        epicName: activeEpicFilter || domainEpics[0] || 'Core Platform',
        epicColor: getEpicColor(activeEpicFilter || domainEpics[0] || 'Core Platform'),
        assigneeName: projectTeamMembers[0]?.name || 'Priya Sharma',
        assigneeInitial: (projectTeamMembers[0]?.name || 'P')[0],
        assigneeAvatarColor: '#0284c7',
        storyPoints: 3,
        updatedDate: new Date().toISOString().split('T')[0],
        sprintId: sectionKey,
        isGroomed: true,
      };

      setIssues((prev) => [newIssue, ...prev]);
      setInlineInputs((prev) => ({ ...prev, [sectionKey || 'backlog']: '' }));
      toast.success(`Created ${newKey}`);
    }
  };

  // Modal create issue
  const handleCreateIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIssueSummary.trim()) return;

    const nextIdNum = 200 + issues.length + 1;
    const newKey = `${projectKey}-${nextIdNum}`;
    const targetSprintId = newIssueTargetSection === 'backlog' ? null : newIssueTargetSection;

    const newIssue: BacklogIssue = {
      id: `backlog-new-${nextIdNum}`,
      key: newKey,
      title: newIssueSummary.trim(),
      type: newIssueType,
      priority: newIssuePriority,
      status: 'TODO',
      releaseTag: `${projectKey} PI24`,
      epicName: newIssueEpic,
      epicColor: getEpicColor(newIssueEpic),
      assigneeName: newIssueAssignee,
      assigneeInitial: newIssueAssignee[0] || 'U',
      assigneeAvatarColor: '#0284c7',
      storyPoints: Number(newIssuePoints) || 3,
      updatedDate: new Date().toISOString().split('T')[0],
      sprintId: targetSprintId,
      isGroomed: true,
    };

    setIssues((prev) => [newIssue, ...prev]);
    toast.success(`Created ${newKey} in ${targetSprintId ? 'Iteration' : 'Product Work Queue'}`);
    setNewIssueSummary('');
    setShowCreateIssueModal(false);
  };

  // Open the shared PI-aware Create Iteration modal, optionally preselecting a PI.
  const openCreateIteration = (piId?: string) => {
    setCreateIterationPiId(piId);
    setShowCreateSprintModal(true);
  };

  // Find an existing Epic task matching this issue's epic name in the current project,
  // or create one, so the child task's parent hierarchy can be resolved dynamically from
  // real data instead of only showing an epic label with no navigable parent.
  const resolveEpicParentId = (epicName: string): string | undefined => {
    if (!epicName) return undefined;
    // Freshest store snapshot so records created earlier in this handler stay visible.
    const currentTasks = useAppStore.getState().tasks;
    const existingEpic = currentTasks.find(
      (t) => t.projectId === projectId && t.type === 'EPIC' && t.title.toLowerCase() === epicName.toLowerCase()
    );
    if (existingEpic) return existingEpic.id;
    const createdEpic = createTask({
      projectId,
      title: epicName,
      description: `Epic grouping delivery work for ${epicName}.`,
      type: 'EPIC',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      createdById: currentUser?.id || 'u-pm-01',
    });
    return createdEpic.id;
  };

  // Resolve the immediate parent of a non-Epic work item: Epic -> Story -> Task, so a
  // task is never stored directly on its epic — it hangs off the story under that epic.
  const resolveStoryParentId = (epicName: string): string | undefined => {
    const epicId = resolveEpicParentId(epicName);
    if (!epicId) return undefined;
    const currentTasks = useAppStore.getState().tasks;
    const existingStory = currentTasks.find(
      (t) => t.projectId === projectId && t.type === 'STORY' && t.parentId === epicId
    );
    if (existingStory) return existingStory.id;
    const createdStory = createTask({
      projectId,
      parentId: epicId,
      title: `${epicName} Delivery`,
      description: `Story grouping implementation tasks for ${epicName}.`,
      type: 'STORY',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      createdById: currentUser?.id || 'u-pm-01',
    });
    return createdStory.id;
  };

  // Immediate parent for a newly materialized issue, resolved from real hierarchy data.
  const resolveImmediateParentId = (issue: BacklogIssue): string | undefined => {
    if (issue.type === 'EPIC') return undefined;
    return resolveStoryParentId(issue.epicName);
  };

  // Resolve an issue row to a real store task id, materialising seed rows into
  // the store on first use. Shared by Open and Move Work Item.
  const ensureTaskForIssue = (issue: BacklogIssue): string => {
    // Identity-based lookup only: rows built from store tasks carry the real
    // task id, so the issue always opens its own record — never a same-titled one.
    const existing = tasks.find((t) => matchId(t.id, issue.id));
    if (existing) return existing.id;

    const assignedUser = users.find((u) => u.name === issue.assigneeName) || users[0];
    const parentId = resolveImmediateParentId(issue);
    const created = createTask({
      projectId,
      sprintId: issue.sprintId || undefined,
      parentId,
      title: issue.title,
      description: `Work Queue scope and implementation details for ${issue.title} under epic ${issue.epicName}.`,
      type: issue.type === 'BUG' ? 'BUG_FIX' : issue.type === 'EPIC' ? 'EPIC' : 'TASK',
      status: issue.status,
      priority: issue.priority,
      assigneeId: assignedUser?.id,
      createdById: currentUser?.id || 'u-pm-01',
      storyPoints: issue.storyPoints,
      dueDate: '2024-10-31',
    });
    return created.id;
  };

  // Open the dedicated task detail page
  const handleOpenTask = (issue: BacklogIssue, openInNewTab = false) => {
    const targetTaskId = ensureTaskForIssue(issue);

    const targetUrl = issuePath(targetTaskId);
    if (openInNewTab) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } else {
      navigate(targetUrl);
    }
  };

  // Row action menu (⋯): Open / Move Work Item. The menu itself never
  // navigates — only its explicit items act, each stopping propagation so the
  // row's own click → Details navigation is never triggered.
  const ROW_ACTION_MENU_W = 176;
  const [rowActionMenu, setRowActionMenu] = useState<{
    issue: BacklogIssue;
    x: number;
    y: number;
  } | null>(null);
  const [movingTask, setMovingTask] = useState<Task | null>(null);

  useEffect(() => {
    if (!rowActionMenu) return;

    const closeOnPointer = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-row-menu]')) return;
      setRowActionMenu(null);
    };
    const closeOnKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRowActionMenu(null);
    };
    const closeOnScroll = () => setRowActionMenu(null);

    document.addEventListener('mousedown', closeOnPointer);
    document.addEventListener('keydown', closeOnKeyDown);
    window.addEventListener('scroll', closeOnScroll, true);
    return () => {
      document.removeEventListener('mousedown', closeOnPointer);
      document.removeEventListener('keydown', closeOnKeyDown);
      window.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [rowActionMenu]);

  const toggleRowActionMenu = (e: React.MouseEvent, issue: BacklogIssue) => {
    e.stopPropagation();
    e.preventDefault();

    // Close competing popovers on this list.
    setTargetSprintForIssue(null);
    setBulkSprintDropdownOpen(false);
    setBacklogMenuOpen(false);

    if (rowActionMenu && rowActionMenu.issue.id === issue.id) {
      setRowActionMenu(null);
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(8, Math.min(rect.left, window.innerWidth - ROW_ACTION_MENU_W - 8));
    const y = Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 96));
    setRowActionMenu({ issue, x, y });
  };

  const rowActionOpen = () => {
    if (!rowActionMenu) return;
    const { issue } = rowActionMenu;
    setRowActionMenu(null);
    handleOpenTask(issue, false);
  };

  const rowActionMove = () => {
    if (!rowActionMenu) return;
    const { issue } = rowActionMenu;
    setRowActionMenu(null);

    const targetTaskId = ensureTaskForIssue(issue);
    const targetTask = useAppStore.getState().tasks.find((t) => t.id === targetTaskId);
    if (targetTask) setMovingTask(targetTask);
  };

  const handleAddLinkedPage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPageTitle.trim()) return;

    const newPage: LinkedPage = {
      id: `lp-b-${Date.now()}`,
      title: newPageTitle.trim(),
      url: newPageUrl.trim() || `https://confluence.enterprise.internal/pages/${encodeURIComponent(newPageTitle)}`,
      space: `${projectKey} Product Management`,
      updatedAt: 'Just now'
    };

    setLinkedPages((prev) => [newPage, ...prev]);
    setNewPageTitle('');
    setNewPageUrl('');
    toast.success('Linked specification document added');
  };

  // Render a single issue row (Jira-style table row)
  const renderIssueRow = (issue: BacklogIssue, currentSprintId: string | null) => {
    const isSelected = selectedIssueIds.includes(issue.id);
    const isCancelled = isCancelledWorkItem(issue);
    const isDone = issue.status === 'DONE' && !isCancelled;

    return (
      <div
        key={issue.id}
        onClick={(e) => {
          // Ignore clicks on row controls (checkbox, move button, menus) so
          // selection/actions never trigger row navigation.
          const target = e.target as HTMLElement;
          if (target.closest('input, button, a, select, textarea')) return;
          handleOpenTask(issue, e.ctrlKey || e.metaKey);
        }}
        className={`group px-4 py-2.5 flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer ${
          isSelected ? 'bg-[#deebff]/40' : 'hover:bg-[#f4f5f7] bg-white'
        }`}
      >
        {/* Left: Checkbox, Type, Priority, Key, Title */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              setSelectedIssueIds((prev) =>
                prev.includes(issue.id) ? prev.filter((id) => id !== issue.id) : [...prev, issue.id]
              );
            }}
            className="rounded border-[#dfe1e6] text-[#0052cc] focus:ring-[#0052cc] cursor-pointer"
          />

          {/* Work Item Icon (FlowExec neutral, one style for every type) */}
          <WorkItemIcon typeLabel={issue.type} />

          {/* Priority */}
          <div className="flex-shrink-0 flex items-center" title={`Priority: ${issue.priority}`}>
            {issue.priority === 'CRITICAL' ? (
              <div className="text-red-600 font-black text-xs leading-none">⇈</div>
            ) : issue.priority === 'HIGH' ? (
              <div className="text-[#ff5630] font-bold text-xs leading-none">═</div>
            ) : issue.priority === 'MEDIUM' ? (
              <div className="text-[#ffab00] font-bold text-xs leading-none">═</div>
            ) : (
              <div className="text-[#36b37e] font-bold text-xs leading-none">⇊</div>
            )}
          </div>

          {/* Key with strikethrough if resolved */}
          {/* Keeps the link-blue color even when done so the strikethrough (which
              communicates completion) never removes the key's clickable-link affordance. */}
          <span
            onClick={(e) => {
              e.stopPropagation();
              handleOpenTask(issue, e.ctrlKey || e.metaKey);
            }}
            className={`font-semibold tracking-tight whitespace-nowrap text-[#0052cc] hover:underline cursor-pointer ${
              isDone ? 'line-through' : ''
            }`}
            title="Click to open task page"
          >
            {issue.key}
          </span>

          {/* Title */}
          <span
            onClick={(e) => {
              e.stopPropagation();
              handleOpenTask(issue, e.ctrlKey || e.metaKey);
            }}
            className={`font-medium truncate text-[#172b4d] hover:text-[#0052cc] transition-colors cursor-pointer ${isDone ? 'text-[#6b778c]' : ''}`}
            title={`Click to open task page: ${issue.title}`}
          >
            {issue.title}
          </span>

          {isCancelled && (
            <span
              className="flex-shrink-0 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 text-[9px] font-bold text-slate-600 uppercase tracking-wide"
              title="Cancelled — removed from scope, never counted as done"
            >
              Cancelled
            </span>
          )}

          {issue.isFlagged && (
            <span title="Impediment Flagged" className="flex-shrink-0 inline-flex items-center">
              <Flag className="w-3.5 h-3.5 fill-red-500 text-red-500" />
            </span>
          )}
        </div>

        {/* Right: Epic Badge, Assignee, Points, Move Action */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {issue.epicName && (
            <span
              className={`hidden md:inline-block px-2 py-0.5 rounded text-[10px] font-bold truncate max-w-[130px] border ${issue.epicColor}`}
              title={issue.epicName}
            >
              {issue.epicName}
            </span>
          )}

          {/* Assignee Avatar */}
          <div className="flex-shrink-0" title={`Assignee: ${issue.assigneeName}`}>
            {issue.avatarUrl ? (
              <img
                src={issue.avatarUrl}
                alt={issue.assigneeName}
                className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-200"
              />
            ) : (
              <div
                className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center ring-1 ring-slate-200"
                style={{ backgroundColor: issue.assigneeAvatarColor }}
              >
                {issue.assigneeInitial}
              </div>
            )}
          </div>

          {/* Story Points */}
          <span
            className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#ebecf0] text-[#42526e]"
            title={`Story points: ${issue.storyPoints}`}
          >
            {issue.storyPoints}
          </span>

          {/* Move to Iteration / Work Queue dropdown */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setTargetSprintForIssue(targetSprintForIssue === issue.id ? null : issue.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-50 text-[#0052cc] hover:bg-[#0052cc] hover:text-white border border-blue-200 flex items-center gap-1 cursor-pointer shadow-2xs"
              title="Move issue to another iteration or work queue"
            >
              <span>Move to</span>
              <MoveRight className="w-3 h-3" />
            </button>

            {targetSprintForIssue === issue.id && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-7 w-64 bg-white rounded-xl shadow-2xl border border-[#dfe1e6] py-1.5 z-40 animate-scale-in text-xs max-h-80 overflow-y-auto"
              >
                <div className="px-3 py-1 text-[10px] font-bold uppercase text-[#6b778c] tracking-wider border-b border-[#ebecf0]">
                  Move {issue.key} to:
                </div>

                {/* 1. LIVE ITERATION */}
                {activeSprints.length > 0 && (
                  <div>
                    <div className="px-3 pt-2 pb-1 text-[9px] font-black uppercase text-emerald-700 tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Live Iteration
                    </div>
                    {activeSprints.map((sprint) => {
                      const isCurrent = sprint.id === currentSprintId;
                      return (
                        <button
                          key={sprint.id}
                          disabled={isCurrent}
                          onClick={() => handleMoveIssue(issue.id, sprint.id)}
                          className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors ${
                            isCurrent
                              ? 'bg-emerald-50/70 text-emerald-800 font-bold opacity-60 cursor-default'
                              : 'hover:bg-emerald-50 text-slate-800 hover:text-emerald-800 cursor-pointer'
                          }`}
                        >
                          <span className="font-semibold truncate">{sprintLabel(sprint)}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                            {isCurrent ? 'Current' : 'Active'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 2. FUTURE / PLANNED SPRINTS */}
                {plannedSprints.length > 0 && (
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <div className="px-3 pt-1 pb-1 text-[9px] font-black uppercase text-blue-700 tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      Future Iterations
                    </div>
                    {plannedSprints.map((sprint) => {
                      const isCurrent = sprint.id === currentSprintId;
                      return (
                        <button
                          key={sprint.id}
                          disabled={isCurrent}
                          onClick={() => handleMoveIssue(issue.id, sprint.id)}
                          className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors ${
                            isCurrent
                              ? 'bg-blue-50/70 text-blue-800 font-bold opacity-60 cursor-default'
                              : 'hover:bg-blue-50 text-slate-800 hover:text-blue-800 cursor-pointer'
                          }`}
                        >
                          <span className="font-semibold truncate">{sprintLabel(sprint)}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                            {isCurrent ? 'Current' : 'Future'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 3. PREVIOUS / COMPLETED SPRINTS */}
                {closedSprints.length > 0 && (
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <div className="px-3 pt-1 pb-1 text-[9px] font-black uppercase text-slate-600 tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      Previous Iterations
                    </div>
                    {closedSprints.map((sprint) => {
                      const isCurrent = sprint.id === currentSprintId;
                      return (
                        <button
                          key={sprint.id}
                          disabled={isCurrent}
                          onClick={() => handleMoveIssue(issue.id, sprint.id)}
                          className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors ${
                            isCurrent
                              ? 'bg-slate-100 text-slate-800 font-bold opacity-60 cursor-default'
                              : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900 cursor-pointer'
                          }`}
                        >
                          <span className="font-medium truncate">{sprintLabel(sprint)}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                            {isCurrent ? 'Current' : 'Previous'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 4. PRODUCT WORK QUEUE (UNASSIGN) */}
                <div className="border-t border-slate-100 mt-1 pt-1">
                  <button
                    disabled={currentSprintId === null}
                    onClick={() => handleMoveIssue(issue.id, null)}
                    className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors ${
                      currentSprintId === null
                        ? 'bg-purple-50/70 text-purple-800 font-bold opacity-60 cursor-default'
                        : 'hover:bg-purple-50 text-purple-700 font-semibold cursor-pointer'
                    }`}
                  >
                    <span>Product Work Queue (Unassign)</span>
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Row actions (⋯): Open / Move Work Item.
              stopPropagation keeps the row click → Details. */}
          <span className="relative inline-flex" data-row-menu="">
            <button
              type="button"
              onClick={(e) => toggleRowActionMenu(e, issue)}
              className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              title="Row actions"
              aria-label={`Actions for ${issue.key || issue.title}`}
              aria-haspopup="menu"
              aria-expanded={!!rowActionMenu && rowActionMenu.issue.id === issue.id}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {rowActionMenu && rowActionMenu.issue.id === issue.id && (
              <div
                data-row-menu=""
                role="menu"
                className="fixed z-50 w-44 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 animate-scale-in"
                style={{ left: rowActionMenu.x, top: rowActionMenu.y }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={rowActionOpen}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  Open
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={rowActionMove}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <FolderInput className="w-3.5 h-3.5 text-slate-400" />
                  Move Work Item
                </button>
              </div>
            )}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      className="animate-fade-in font-sans text-[#172b4d] min-w-0 w-full space-y-2"
    >
          {/* Compact Work Queue header */}
          <div className="pt-1 flex flex-wrap items-center justify-between gap-3 select-none min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <button
                type="button"
                onClick={() => toggleSectionCollapse('backlog')}
                className="p-1 rounded hover:bg-[#ebecf0] text-[#6b778c] transition-colors cursor-pointer"
                title={isSectionExpanded('backlog') ? 'Collapse work queue' : 'Expand work queue'}
              >
                {isSectionExpanded('backlog') ? (
                  <ChevronDown className="w-4 h-4 text-[#172b4d]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#172b4d]" />
                )}
              </button>

              <h1 className="text-[17px] font-bold tracking-tight text-[#172b4d]">Work Queue</h1>

              <span className="text-xs font-semibold text-[#6b778c]">
                {backlogPoolIssues.length} work items
              </span>

              <ListTodo className="w-4 h-4 text-[#6b778c]" />

              {!compact && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#42526e] text-white"
                  title={`Total Work Queue Story Points: ${backlogStats.totalPoints}`}
                >
                  {backlogStats.totalPoints} pts
                </span>
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white"
                  title={`High Priority Points: ${backlogStats.highPoints}`}
                >
                  {backlogStats.highPoints} high
                </span>
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#00875a] text-white"
                  title={`Ready for Iteration Points: ${backlogStats.groomedPoints}`}
                >
                  {backlogStats.groomedPoints} ready
                </span>
              </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => openCreateIteration()}
                className="px-2.5 py-1 rounded-md text-xs font-semibold text-[#42526e] hover:bg-[#ebecf0] hover:text-[#172b4d] transition-colors cursor-pointer"
              >
                Create Iteration
              </button>

              <div className="relative" ref={backlogMenuRef}>
                <button
                  type="button"
                  onClick={() => setBacklogMenuOpen((v) => !v)}
                  aria-label="More work queue actions"
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    backlogMenuOpen
                      ? 'bg-[#ebecf0] text-[#172b4d]'
                      : 'text-[#42526e] hover:bg-[#ebecf0]'
                  }`}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {backlogMenuOpen && (
                  <div className="absolute right-0 top-8 w-60 bg-white rounded-xl shadow-2xl border border-[#dfe1e6] py-1.5 z-40 animate-scale-in text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setBacklogMenuOpen(false);
                        setShowCreateIssueModal(true);
                      }}
                      className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[#f4f5f7] text-[#172b4d] font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#0052cc]" />
                      Create Work Item
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBacklogMenuOpen(false);
                        toggleExpandAll();
                      }}
                      title={allExpanded ? 'Collapse all iterations and work queue' : 'Expand all iterations and work queue'}
                      className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[#f4f5f7] text-[#172b4d] font-semibold cursor-pointer"
                    >
                      {allExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      {allExpanded ? 'Collapse All' : 'Expand All'}
                    </button>
                    {!compact && (
                    <button
                      type="button"
                      onClick={() => {
                        setBacklogMenuOpen(false);
                        setShowLinkedPagesModal(true);
                      }}
                      className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-[#f4f5f7] text-[#172b4d] font-semibold cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      Linked PRDs &amp; Specs ({linkedPages.length})
                    </button>
                    )}
                    <div className="border-t border-[#ebecf0] my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setBacklogMenuOpen(false);
                        clearAllFilters();
                      }}
                      disabled={!(
                        activePersonFilters.length > 0 ||
                        activeEpicFilter ||
                        onlyMyIssues ||
                        onlyGroomed ||
                        onlyHighPriority ||
                        onlyUnassigned ||
                        searchQuery
                      )}
                      className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-red-50 text-red-600 font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <X className="w-3.5 h-3.5" />
                      Clear filters
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Compact search + quick filters */}
          <div className="flex items-start gap-2 flex-wrap min-w-0">
            <div className="relative min-w-[140px] max-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b778c]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={compact ? 'Filter work queue items...' : 'Search work queue items, epics...'}
                className="w-full pl-8 pr-7 py-1 text-xs bg-white border border-[#dfe1e6] rounded-md focus:border-[#4c9aff] focus:ring-1 focus:ring-[#4c9aff] transition-all outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {!compact && (
            <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
              {projectTeamMembers.slice(0, 7).map((user) => {
                const isActive = activePersonFilters.includes(user.name);
                return (
                  <button
                    key={user.id}
                    onClick={() => togglePersonFilter(user.name)}
                    className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#deebff] text-[#0052cc] font-bold ring-1 ring-[#0052cc]/30 shadow-2xs'
                        : 'text-[#42526e] hover:bg-[#ebecf0] hover:text-[#172b4d]'
                    }`}
                  >
                    {user.name.split(' ')[0]}
                  </button>
                );
              })}

              <button
                onClick={() => setOnlyUnassigned(!onlyUnassigned)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  onlyUnassigned
                    ? 'bg-[#deebff] text-[#0052cc] font-bold ring-1 ring-[#0052cc]/30'
                    : 'text-[#42526e] hover:bg-[#ebecf0]'
                }`}
              >
                Unassigned
              </button>

              <button
                onClick={() => setOnlyHighPriority(!onlyHighPriority)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  onlyHighPriority
                    ? 'bg-rose-100 text-rose-800 font-bold ring-1 ring-rose-300'
                    : 'text-[#42526e] hover:bg-[#ebecf0]'
                }`}
              >
                High Priority
              </button>

              <button
                onClick={() => setOnlyGroomed(!onlyGroomed)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  onlyGroomed
                    ? 'bg-emerald-100 text-emerald-800 font-bold ring-1 ring-emerald-300'
                    : 'text-[#42526e] hover:bg-[#ebecf0]'
                }`}
              >
                Ready for Iteration
              </button>

              <button
                onClick={() => setOnlyMyIssues(!onlyMyIssues)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  onlyMyIssues
                    ? 'bg-[#deebff] text-[#0052cc] font-bold ring-1 ring-[#0052cc]/30'
                    : 'text-[#42526e] hover:bg-[#ebecf0]'
                }`}
              >
                My Items
              </button>

              <button
                type="button"
                onClick={toggleExpandAll}
                className="text-xs px-2.5 py-1 rounded-md font-medium text-[#42526e] hover:bg-[#ebecf0] hover:text-[#172b4d] flex items-center gap-1 cursor-pointer transition-colors border border-slate-200 bg-white shadow-2xs"
                title={allExpanded ? 'Collapse all iterations and work queue' : 'Expand all iterations and work queue'}
              >
                {allExpanded ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                    <span>Collapse All</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                    <span>Expand All</span>
                  </>
                )}
              </button>

              {(activePersonFilters.length > 0 || activeEpicFilter || onlyMyIssues || onlyGroomed || onlyHighPriority || onlyUnassigned || searchQuery) && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  Clear filters
                </button>
              )}
            </div>
            )}
          </div>

          {/* Epics chips + grooming readiness */}
          {!compact && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#6b778c] pb-0.5 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
                <Tag className="w-3 h-3" />
                EPICS:
              </span>
              <button
                onClick={() => setActiveEpicFilter(null)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  activeEpicFilter === null
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Epics
              </button>
              {domainEpics.map((epic) => (
                <button
                  key={epic}
                  onClick={() => setActiveEpicFilter(activeEpicFilter === epic ? null : epic)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                    activeEpicFilter === epic
                      ? `${getEpicColor(epic)} font-bold ring-2 ring-blue-400`
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {epic}
                </button>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-1.5 font-medium text-[#42526e] ml-auto">
              <span className="text-slate-400">Grooming Readiness:</span>
              <span className="font-bold text-emerald-700">{backlogStats.readinessPct}% Estimated</span>
            </div>
          </div>
          )}

      {/* Global Bulk Action Toolbar when items are selected */}
      {selectedIssueIds.length > 0 && (
        <div className="bg-[#deebff] border border-[#0052cc]/40 rounded-xl p-3 flex items-center justify-between gap-4 animate-slide-in shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#0052cc]" />
            <span className="text-xs font-bold text-[#0052cc]">
              {selectedIssueIds.length} work items selected across work queue
            </span>
          </div>

          <div className="flex items-center gap-2 relative">
            <button
              onClick={() => setBulkSprintDropdownOpen(!bulkSprintDropdownOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-[#0052cc] hover:bg-[#0747a6] text-white shadow-xs cursor-pointer"
            >
              <span>Move Selected to...</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {bulkSprintDropdownOpen && (
              <div className="absolute right-0 top-8 w-64 bg-white rounded-xl shadow-2xl border border-[#dfe1e6] py-1.5 z-40 animate-scale-in text-xs max-h-80 overflow-y-auto">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase text-[#6b778c] tracking-wider border-b border-[#ebecf0]">
                  Move Selected ({selectedIssueIds.length}) To:
                </div>

                {/* 1. LIVE ITERATION */}
                {activeSprints.length > 0 && (
                  <div>
                    <div className="px-3 pt-2 pb-1 text-[9px] font-black uppercase text-emerald-700 tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Live Iteration
                    </div>
                    {activeSprints.map((sprint) => (
                      <button
                        key={sprint.id}
                        onClick={() => handleBulkMove(sprint.id)}
                        className="w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-emerald-50 text-slate-800 hover:text-emerald-800 transition-colors cursor-pointer"
                      >
                        <span className="font-semibold truncate">{sprintLabel(sprint)}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                          Active
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* 2. FUTURE / PLANNED SPRINTS */}
                {plannedSprints.length > 0 && (
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <div className="px-3 pt-1 pb-1 text-[9px] font-black uppercase text-blue-700 tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      Future Iterations
                    </div>
                    {plannedSprints.map((sprint) => (
                      <button
                        key={sprint.id}
                        onClick={() => handleBulkMove(sprint.id)}
                        className="w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-blue-50 text-slate-800 hover:text-blue-800 transition-colors cursor-pointer"
                      >
                        <span className="font-semibold truncate">{sprintLabel(sprint)}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                          Future
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* 3. PREVIOUS / COMPLETED SPRINTS */}
                {closedSprints.length > 0 && (
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <div className="px-3 pt-1 pb-1 text-[9px] font-black uppercase text-slate-600 tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      Previous Iterations
                    </div>
                    {closedSprints.map((sprint) => (
                      <button
                        key={sprint.id}
                        onClick={() => handleBulkMove(sprint.id)}
                        className="w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
                      >
                        <span className="font-medium truncate">{sprintLabel(sprint)}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                          Previous
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* 4. PRODUCT WORK QUEUE */}
                <div className="border-t border-slate-100 mt-1 pt-1">
                  <button
                    onClick={() => handleBulkMove(null)}
                    className="w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-purple-50 text-purple-700 font-semibold transition-colors cursor-pointer"
                  >
                    <span>Product Work Queue (Unassign)</span>
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedIssueIds([])}
              className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

          {/* Borderless backlog list */}
          <div className="min-w-0">
            {isSectionExpanded('backlog') && (
              <div className="min-w-0 border-t border-[#dfe1e6]">
                <div className="divide-y divide-[#f4f5f7] min-w-0">
                  {backlogPoolIssues.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      All work queue stories have been planned into live iterations!
                    </div>
                  ) : (
                    backlogPoolIssues.map((issue) => renderIssueRow(issue, null))
                  )}
                </div>

                {/* Bottom "+ Create issue" row -> reveals the inline quick-add input */}
                <div className="border-t border-[#dfe1e6] bg-white px-4 py-2 min-w-0">
                  {showInlineAdd ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <Plus className="w-4 h-4 text-[#0052cc] flex-shrink-0" />
                      <input
                        type="text"
                        autoFocus
                        value={inlineInputs['backlog'] || ''}
                        onChange={(e) =>
                          setInlineInputs((prev) => ({ ...prev, backlog: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setShowInlineAdd(false);
                            return;
                          }
                          handleInlineCreateForSection(null, e);
                        }}
                        placeholder="What needs to be done? Type story title and press Enter to add to work queue..."
                        className="flex-1 min-w-0 text-xs bg-transparent border-none outline-none focus:ring-0 placeholder:text-slate-400 text-[#172b4d]"
                      />
                      <span className="hidden sm:inline text-[11px] text-slate-400 font-medium flex-shrink-0">
                        Press Enter to add
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowInlineAdd(true)}
                      className="flex items-center gap-2 text-xs font-semibold text-[#6b778c] hover:text-[#0052cc] transition-colors cursor-pointer w-full"
                    >
                      <Plus className="w-4 h-4" />
                      Create work item
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

      {/* Epics Scope & Capacity Breakdown Drawer — flat section, no card chrome */}
      {!embedded && !hideEpicsBreakdown && !compact && (
        <div className="border-t border-[#dfe1e6] min-w-0">
          <button
            onClick={() => setIsEpicsBreakdownExpanded(!isEpicsBreakdownExpanded)}
            className="w-full py-3 flex items-center justify-between gap-3 text-left transition-colors select-none cursor-pointer"
          >
            <div className="flex items-center gap-2">
              {isEpicsBreakdownExpanded ? (
                <ChevronDown className="w-4 h-4 text-[#172b4d]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[#172b4d]" />
              )}
              <span className="font-bold text-sm text-[#172b4d]">
                Epics Scope & Weight Breakdown
              </span>
              <span className="text-xs text-[#6b778c] font-medium">
                {domainEpics.length} Epics in {project?.name}
              </span>
            </div>
            <span className="text-xs font-bold text-[#0052cc] bg-[#deebff] px-2.5 py-0.5 rounded-full">
              Capacity Estimation
            </span>
          </button>

          {isEpicsBreakdownExpanded && (
            <div className="pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {epicBreakdown.map((epic) => (
                <div
                  key={epic.name}
                  onClick={() => setActiveEpicFilter(activeEpicFilter === epic.name ? null : epic.name)}
                  className={`p-3.5 rounded-md border transition-all cursor-pointer ${
                    activeEpicFilter === epic.name
                      ? 'border-[#0052cc] bg-[#deebff]/20 shadow-xs'
                      : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${epic.color}`}>
                      {epic.name}
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      {epic.points} pts
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center justify-between">
                    <span>{epic.issueCount} work items</span>
                    <span className="text-[11px] text-[#0052cc] font-semibold hover:underline">
                      {activeEpicFilter === epic.name ? 'Clear filter' : 'Filter by epic'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Create Iteration (shared, PI-aware — Project → PI → Iteration) */}
      <CreateIterationModal
        projectId={projectId}
        isOpen={showCreateSprintModal}
        initialPiId={createIterationPiId}
        onClose={() => setShowCreateSprintModal(false)}
      />

      {/* Modal: Create Work Item */}
      {showCreateIssueModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-in text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#0052cc]" />
                <h3 className="text-base font-bold text-[#172b4d]">
                  Create Work Item
                </h3>
              </div>
              <button
                onClick={() => setShowCreateIssueModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateIssue} className="space-y-3.5">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Issue Summary</label>
                <input
                  type="text"
                  value={newIssueSummary}
                  onChange={(e) => setNewIssueSummary(e.target.value)}
                  placeholder={`e.g. Implement ${project?.name} checkout flow`}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#0052cc]"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Destination</label>
                <select
                  value={newIssueTargetSection}
                  onChange={(e) => setNewIssueTargetSection(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#0052cc]"
                >
                  <option value="backlog">Product Work Queue (Unassigned)</option>
                  {[...activeSprints, ...plannedSprints].map((s) => (
                    <option key={s.id} value={s.id}>
                      {sprintLabel(s)} ({s.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Issue Type</label>
                  <select
                    value={newIssueType}
                    onChange={(e) => setNewIssueType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#0052cc]"
                  >
                    <option value="STORY">Story</option>
                    <option value="TASK">Task</option>
                    <option value="BUG">Bug</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Story Points</label>
                  <input
                    type="number"
                    min="1"
                    max="13"
                    value={newIssuePoints}
                    onChange={(e) => setNewIssuePoints(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#0052cc]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Epic / Component</label>
                  <select
                    value={newIssueEpic}
                    onChange={(e) => setNewIssueEpic(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#0052cc]"
                  >
                    {domainEpics.map((ep) => (
                      <option key={ep} value={ep}>{ep}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Priority</label>
                  <select
                    value={newIssuePriority}
                    onChange={(e) => setNewIssuePriority(e.target.value as Priority)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#0052cc]"
                  >
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Assignee</label>
                <select
                  value={newIssueAssignee}
                  onChange={(e) => setNewIssueAssignee(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-[#0052cc]"
                >
                  <option value="Unassigned">Unassigned</option>
                  {projectTeamMembers.map((user) => (
                    <option key={user.id} value={user.name}>{user.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateIssueModal(false)}
                  className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#0052cc] text-white hover:bg-[#0747a6] font-bold cursor-pointer"
                >
                  Create Work Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Issue Detail Preview */}
      {selectedIssueDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-in text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-[#0052cc]">{selectedIssueDetail.key}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                  {selectedIssueDetail.sprintId
                    ? detailSprintLabel(selectedIssueDetail.sprintId)
                    : 'PRODUCT WORK QUEUE'}
                </span>
              </div>
              <button
                onClick={() => setSelectedIssueDetail(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h3 className="text-base font-bold text-slate-900 leading-snug">
              {selectedIssueDetail.title}
            </h3>

            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <div className="text-slate-500 mb-1">Epic / Component</div>
                <div className="font-semibold text-slate-800">{selectedIssueDetail.epicName}</div>
              </div>
              <div>
                <div className="text-slate-500 mb-1">Assignee</div>
                <div className="font-semibold text-slate-800">{selectedIssueDetail.assigneeName}</div>
              </div>
              <div>
                <div className="text-slate-500 mb-1">Story Points</div>
                <div className="font-semibold text-slate-800">{selectedIssueDetail.storyPoints} pts</div>
              </div>
              <div>
                <div className="text-slate-500 mb-1">Priority</div>
                <div className="font-semibold text-slate-800">{selectedIssueDetail.priority}</div>
              </div>
              <div>
                <div className="text-slate-500 mb-1">Release Scope</div>
                <div className="font-semibold text-slate-800">{selectedIssueDetail.releaseTag}</div>
              </div>
              <div>
                <div className="text-slate-500 mb-1">Current Placement</div>
                <div className="font-semibold text-slate-800">
                  {selectedIssueDetail.sprintId
                    ? detailSprintLabel(selectedIssueDetail.sprintId)
                    : 'Unassigned Work Queue Pool'}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              {/* Quick destination switch */}
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">Quick Move:</span>
                {[...activeSprints, ...plannedSprints].slice(0, 2).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      handleMoveIssue(selectedIssueDetail.id, s.id);
                      setSelectedIssueDetail(null);
                    }}
                    className="px-2.5 py-1 rounded bg-[#0052cc] text-white hover:bg-[#0747a6] font-bold text-[11px] cursor-pointer"
                  >
                    → {sprintLabel(s)}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const taskToOpen = selectedIssueDetail;
                    setSelectedIssueDetail(null);
                    handleOpenTask(taskToOpen, false);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0052cc] text-white hover:bg-[#0747a6] flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Open full dedicated task page"
                >
                  <span>Open Task Page</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setSelectedIssueDetail(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: View Linked Documentation Pages */}
      {showLinkedPagesModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-in text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#0052cc]" />
                <h3 className="text-base font-bold text-[#172b4d]">Work Queue Specifications & PRDs</h3>
              </div>
              <button
                onClick={() => setShowLinkedPagesModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {linkedPages.map((page) => (
                <div
                  key={page.id}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-[#0052cc] transition-all flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-[#0052cc] hover:underline flex items-center gap-1.5"
                    >
                      <span>{page.title}</span>
                      <ExternalLink className="w-3 h-3 text-[#0052cc]" />
                    </a>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Space: {page.space} • Updated {page.updatedAt}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add new link form */}
            <form onSubmit={handleAddLinkedPage} className="pt-2 border-t border-slate-200 space-y-2">
              <div className="text-xs font-bold text-slate-800">Add Specification Document</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newPageTitle}
                  onChange={(e) => setNewPageTitle(e.target.value)}
                  placeholder="e.g. Checkout PRD Specification v2"
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#0052cc]"
                  required
                />
                <input
                  type="url"
                  value={newPageUrl}
                  onChange={(e) => setNewPageUrl(e.target.value)}
                  placeholder="https://confluence.internal/..."
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-[#0052cc]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowLinkedPagesModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0052cc] text-white hover:bg-[#0747a6] cursor-pointer"
                >
                  + Link Specification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Move Work Item (two-step: form → confirmation) */}
      <MoveTaskModal
        isOpen={!!movingTask}
        task={movingTask}
        onClose={() => setMovingTask(null)}
      />
    </div>
  );
};
