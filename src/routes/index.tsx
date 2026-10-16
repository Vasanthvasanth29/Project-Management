import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getDashboardPath } from '../utils/roleUtils';
import type { Role } from '../types';

// Layout
import { AppShell } from '../components/layout/AppShell';

// Auth Pages
import { LoginPage } from '../pages/auth/LoginPage';

// Admin Pages
import { AdminDashboard } from '../pages/admin/AdminDashboard';
import { UsersPage } from '../pages/admin/UsersPage';
import { AdminProjectsPage } from '../pages/admin/AdminProjectsPage';
import { RolesPermissionsPage } from '../pages/admin/RolesPermissionsPage';
import { AdminSettingsPage } from '../pages/admin/AdminSettingsPage';

// PM Pages
import { PMDashboard } from '../pages/pm/PMDashboard';
import { PMProjectsPage } from '../pages/pm/PMProjectsPage';
import { ProjectWorkspace } from '../pages/pm/ProjectWorkspace';
import { CrossProjectRoadmap } from '../pages/pm/CrossProjectRoadmap';
import { ProjectHealthPage } from '../pages/pm/projectHealth/ProjectHealthPage';
import { SprintDetailPage } from '../pages/pm/SprintDetailPage';
import { IterationsModuleRoute } from '../pages/pm/IterationsModuleRoute';
import { IssueSearchPage } from '../pages/pm/IssueSearchPage';
import { IssueDetailsPage } from '../pages/pm/IssueDetailsPage';

// Initiative Management
import { InitiativesPage } from '../pages/initiatives/InitiativesPage';
import { InitiativeDetailPage } from '../pages/initiatives/InitiativeDetailPage';

// TL Pages
import { TLDashboard } from '../pages/tl/TLDashboard';
import { TeamPage } from '../pages/tl/TeamPage';

// Member Pages
import { MemberDashboard } from '../pages/member/MemberDashboard';
import { MemberProjectsPage } from '../pages/member/MemberProjectsPage';
import { MyTasksPage } from '../pages/member/MyTasksPage';
import { MySprintPage } from '../pages/member/MySprintPage';

// Shared Pages
import { KanbanBoard } from '../pages/shared/KanbanBoard';
import { TasksListPage } from '../pages/shared/TasksListPage';
import { NotificationsPage } from '../pages/shared/NotificationsPage';
import { ActivityPage } from '../pages/shared/ActivityPage';
import { TodoPage } from '../pages/shared/TodoPage';
import { SettingsPage } from '../pages/shared/SettingsPage';
import { BugsPage } from '../pages/shared/BugsPage';
import { BugDetailPage } from '../pages/shared/BugDetailPage';
import { FlaggedTasksPage } from '../pages/shared/FlaggedTasksPage';

// Guard Component
// ADMIN is a full-access system administrator: it bypasses every role gate so
// an admin can open any route regardless of allowedRoles.
const ProtectedRoute: React.FC<{ allowedRoles?: Role[]; children: React.ReactNode }> = ({
  allowedRoles,
  children,
}) => {
  const { currentUser, isAuthenticated } = useAuthStore();

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (
    allowedRoles &&
    currentUser.role !== 'ADMIN' &&
    !allowedRoles.includes(currentUser.role)
  ) {
    return <Navigate to={getDashboardPath(currentUser.role)} replace />;
  }

  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  const { isAuthenticated, currentUser } = useAuthStore();

  return (
    <Routes>
      {/* Public / Auth */}
      <Route
        path="/login"
        element={
          isAuthenticated && currentUser ? (
            <Navigate to={getDashboardPath(currentUser.role)} replace />
          ) : (
            <LoginPage />
          )
        }
      />
      <Route
        path="/register"
        element={<Navigate to="/login" replace />}
      />

      {/* Protected App Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        {/* Index redirect to user role dashboard */}
        <Route
          index
          element={
            currentUser ? (
              <Navigate to={getDashboardPath(currentUser.role)} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* ADMIN ROUTES */}
        <Route
          path="admin"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'PROJECT_MANAGER']}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/projects"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminProjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/roles"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <RolesPermissionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/settings"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/projects/:projectId"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ProjectWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/:projectKey/iterations/*"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <IterationsModuleRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/:projectKey/:projectName/iterations/*"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <IterationsModuleRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/:projectKey/:projectName"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ProjectWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/:projectKey"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ProjectWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/activity"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ActivityPage />
            </ProtectedRoute>
          }
        />

        {/* PROJECT MANAGER ROUTES */}
        <Route
          path="pm"
          element={
            <ProtectedRoute allowedRoles={['PROJECT_MANAGER', 'ADMIN']}>
              <PMDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="pm/projects"
          element={
            <ProtectedRoute allowedRoles={['PROJECT_MANAGER', 'ADMIN']}>
              <PMProjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="pm/projects/:projectId"
          element={
            <ProtectedRoute allowedRoles={['PROJECT_MANAGER', 'ADMIN']}>
              <ProjectWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="pm/projects/:projectId/sprints/:sprintId"
          element={
            <ProtectedRoute allowedRoles={['PROJECT_MANAGER', 'ADMIN']}>
              <SprintDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="pm/:projectKey/:projectName/sprints/:sprintId"
          element={
            <ProtectedRoute allowedRoles={['PROJECT_MANAGER', 'ADMIN']}>
              <SprintDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="pm/:projectKey/iterations/*"
          element={
            <ProtectedRoute allowedRoles={['PROJECT_MANAGER', 'ADMIN']}>
              <IterationsModuleRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="pm/:projectKey/:projectName/iterations/*"
          element={
            <ProtectedRoute allowedRoles={['PROJECT_MANAGER', 'ADMIN']}>
              <IterationsModuleRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="pm/:projectKey/:projectName"
          element={
            <ProtectedRoute allowedRoles={['PROJECT_MANAGER', 'ADMIN']}>
              <ProjectWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="pm/:projectKey"
          element={
            <ProtectedRoute allowedRoles={['PROJECT_MANAGER', 'ADMIN']}>
              <ProjectWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="pm/project-health"
          element={
            <ProtectedRoute allowedRoles={['PROJECT_MANAGER', 'TEAM_LEADER', 'ADMIN']}>
              <ProjectHealthPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="pm/roadmap"
          element={
            <ProtectedRoute allowedRoles={['PROJECT_MANAGER', 'TEAM_LEADER', 'ADMIN']}>
              <CrossProjectRoadmap />
            </ProtectedRoute>
          }
        />
        {/* Initiative Management — PM/TL/ADMIN manage; MEMBER is read-only
            (mutation controls are gated inside the pages by role helpers). */}
        <Route
          path="pm/initiatives"
          element={
            <ProtectedRoute allowedRoles={['PROJECT_MANAGER', 'TEAM_LEADER', 'MEMBER', 'ADMIN']}>
              <InitiativesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="pm/initiatives/:initiativeId"
          element={
            <ProtectedRoute allowedRoles={['PROJECT_MANAGER', 'TEAM_LEADER', 'MEMBER', 'ADMIN']}>
              <InitiativeDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="pm/activity"
          element={
            <ProtectedRoute allowedRoles={['PROJECT_MANAGER', 'ADMIN']}>
              <ActivityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="pm/issues/search"
          element={
            <ProtectedRoute>
              <IssueSearchPage />
            </ProtectedRoute>
          }
        />

        {/* TEAM LEADER ROUTES */}
        <Route
          path="tl"
          element={
            <ProtectedRoute allowedRoles={['TEAM_LEADER', 'ADMIN']}>
              <TLDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="tl/projects"
          element={
            <ProtectedRoute allowedRoles={['TEAM_LEADER', 'ADMIN']}>
              <PMProjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="tl/projects/:projectId"
          element={
            <ProtectedRoute allowedRoles={['TEAM_LEADER', 'ADMIN']}>
              <ProjectWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="tl/:projectKey/iterations/*"
          element={
            <ProtectedRoute allowedRoles={['TEAM_LEADER', 'ADMIN']}>
              <IterationsModuleRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="tl/:projectKey/:projectName/iterations/*"
          element={
            <ProtectedRoute allowedRoles={['TEAM_LEADER', 'ADMIN']}>
              <IterationsModuleRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="tl/:projectKey/:projectName"
          element={
            <ProtectedRoute allowedRoles={['TEAM_LEADER', 'ADMIN']}>
              <ProjectWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="tl/:projectKey"
          element={
            <ProtectedRoute allowedRoles={['TEAM_LEADER', 'ADMIN']}>
              <ProjectWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="tl/team"
          element={
            <ProtectedRoute allowedRoles={['TEAM_LEADER', 'PROJECT_MANAGER', 'ADMIN']}>
              <TeamPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="tl/tasks"
          element={
            <ProtectedRoute allowedRoles={['TEAM_LEADER', 'PROJECT_MANAGER', 'MEMBER', 'ADMIN']}>
              <TasksListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="tl/tasks/:issueKey"
          element={
            <ProtectedRoute allowedRoles={['TEAM_LEADER', 'PROJECT_MANAGER', 'MEMBER', 'ADMIN']}>
              <IssueDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="tl/bugs"
          element={
            <ProtectedRoute allowedRoles={['TEAM_LEADER', 'PROJECT_MANAGER', 'ADMIN']}>
              <BugsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="tl/bugs/:bugId"
          element={
            <ProtectedRoute allowedRoles={['TEAM_LEADER', 'ADMIN']}>
              <BugDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="tl/activity"
          element={
            <ProtectedRoute allowedRoles={['TEAM_LEADER', 'ADMIN']}>
              <ActivityPage />
            </ProtectedRoute>
          }
        />

        {/* MEMBER ROUTES */}
        <Route
          path="member"
          element={
            <ProtectedRoute allowedRoles={['MEMBER', 'ADMIN']}>
              <MemberDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="member/projects"
          element={
            <ProtectedRoute allowedRoles={['MEMBER', 'ADMIN']}>
              <MemberProjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="member/projects/:projectId"
          element={
            <ProtectedRoute allowedRoles={['MEMBER', 'ADMIN']}>
              <ProjectWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="member/:projectKey/iterations/*"
          element={
            <ProtectedRoute allowedRoles={['MEMBER', 'ADMIN']}>
              <IterationsModuleRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="member/:projectKey/:projectName/iterations/*"
          element={
            <ProtectedRoute allowedRoles={['MEMBER', 'ADMIN']}>
              <IterationsModuleRoute />
            </ProtectedRoute>
          }
        />
        <Route
          path="member/:projectKey/:projectName"
          element={
            <ProtectedRoute allowedRoles={['MEMBER', 'ADMIN']}>
              <ProjectWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="member/:projectKey"
          element={
            <ProtectedRoute allowedRoles={['MEMBER', 'ADMIN']}>
              <ProjectWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="member/tasks"
          element={
            <ProtectedRoute allowedRoles={['MEMBER', 'ADMIN']}>
              <MyTasksPage />
            </ProtectedRoute>
          }
        />
        {/* Issue entry point (My Tasks, My Iteration, Iterations, Live Iteration,
            search, dashboards, notifications, activity ...). The URL carries
            the public issue key (e.g. /member/tasks/ECOMM-500); legacy
            internal-id URLs still resolve. It renders the SAME canonical
            issue-detail component as /browse/:issueKey. */}
        <Route
          path="member/tasks/:issueKey"
          element={
            <ProtectedRoute>
              <IssueDetailsPage />
            </ProtectedRoute>
          }
        />
        {/* Canonical Jira-style issue details page, reachable by any role. */}
        <Route
          path="browse/:issueKey"
          element={
            <ProtectedRoute>
              <IssueDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="member/sprint"
          element={
            <ProtectedRoute allowedRoles={['MEMBER', 'ADMIN']}>
              <MySprintPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="member/bugs"
          element={
            <ProtectedRoute allowedRoles={['MEMBER', 'ADMIN']}>
              <BugsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="member/bugs/:bugId"
          element={
            <ProtectedRoute allowedRoles={['MEMBER', 'ADMIN']}>
              <BugDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="member/activity"
          element={
            <ProtectedRoute allowedRoles={['MEMBER', 'ADMIN']}>
              <ActivityPage />
            </ProtectedRoute>
          }
        />

        {/* SHARED ROUTES */}
        <Route path="flagged-tasks" element={<FlaggedTasksPage />} />
        <Route path="bookmarks" element={<FlaggedTasksPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="my-todo" element={<TodoPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route
          path="bugs/:bugId"
          element={
            <ProtectedRoute>
              <BugDetailPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
