import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { displayStatusLabel, isCancelledWorkItem } from './roleUtils';
import type { Task, Sprint, Release, Project, User, Team } from '../types';

// Cancelled work (DONE + CANCELLED) is out of scope for every completion
// metric: it is neither done nor remaining.
const scopeOf = (list: Task[]): Task[] => list.filter((t) => !isCancelledWorkItem(t));

function addHeader(doc: jsPDF, title: string, subtitle: string) {
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 22);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(subtitle, 14, 30);
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 34, 196, 34);
}

function addMetrics(doc: jsPDF, y: number, metrics: { label: string; value: string }[]): number {
  let currentY = y + 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('SUMMARY METRICS', 14, currentY);
  currentY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  const colWidth = 182 / Math.min(metrics.length, 4);
  for (let i = 0; i < metrics.length; i += 4) {
    const row = metrics.slice(i, i + 4);
    row.forEach((m, j) => {
      const x = 14 + j * colWidth;
      doc.setFont('helvetica', 'bold');
      doc.text(m.value, x, currentY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(m.label, x, currentY + 4);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
    });
    currentY += 12;
  }
  return currentY + 4;
}

function addTaskTable(doc: jsPDF, y: number, tasks: Task[], users: User[]): number {
  if (tasks.length === 0) return y;
  const headers = [['ID', 'Title', 'Status', 'Priority', 'Assignee', 'Points', 'Due Date']];
  const rows = tasks.map((t) => {
    const assignee = users.find((u) => u.id === t.assigneeId);
    return [
      t.id.substring(0, 12),
      t.title.substring(0, 40),
      displayStatusLabel(t),
      t.priority,
      assignee?.name || 'Unassigned',
      String(t.storyPoints || '-'),
      t.dueDate || '-',
    ];
  });
  autoTable(doc, {
    startY: y,
    head: headers,
    body: rows,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });
  return (doc as any).lastAutoTable.finalY + 8;
}

export function generateSprintReportPDF(
  sprint: Sprint,
  tasks: Task[],
  users: User[],
  project: Project
): Blob {
  const doc = new jsPDF();
  addHeader(doc, `Iteration Report: ${sprint.name}`, `${project.name} | ${sprint.startDate} to ${sprint.endDate}`);
  const sprintTasks = tasks.filter((t) => t.sprintId === sprint.id);
  const scopeTasks = scopeOf(sprintTasks);
  const done = scopeTasks.filter((t) => t.status === 'DONE').length;
  const totalPoints = scopeTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
  const completedPoints = scopeTasks.filter((t) => t.status === 'DONE').reduce((s, t) => s + (t.storyPoints || 0), 0);
  const totalEst = sprintTasks.reduce((s, t) => s + (t.estimatedHours || 0), 0);
  const totalLogged = sprintTasks.reduce((s, t) => s + (t.loggedHours || 0), 0);
  const completionPct = scopeTasks.length > 0 ? Math.round((done / scopeTasks.length) * 100) : 0;

  let y = addMetrics(doc, 34, [
    { label: 'TOTAL TASKS', value: String(scopeTasks.length) },
    { label: 'COMPLETED', value: String(done) },
    { label: 'COMPLETION %', value: `${completionPct}%` },
    { label: 'ITERATION GOAL', value: (sprint.goal || 'Not set').substring(0, 30) },
    { label: 'STORY POINTS', value: `${completedPoints}/${totalPoints}` },
    { label: 'VELOCITY', value: String(completedPoints) },
    { label: 'ESTIMATED HOURS', value: `${totalEst}h` },
    { label: 'LOGGED HOURS', value: `${totalLogged}h` },
  ]);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('TASK BREAKDOWN', 14, y);
  y += 4;
  y = addTaskTable(doc, y, sprintTasks, users);

  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated: ${new Date().toLocaleString()} | FlowExec Project Management`, 14, 285);

  return doc.output('blob');
}

export function generateProjectReportPDF(
  project: Project,
  tasks: Task[],
  sprints: Sprint[],
  releases: Release[],
  users: User[]
): Blob {
  const doc = new jsPDF();
  addHeader(doc, `Project Report: ${project.name}`, `Status: ${project.status} | ${project.startDate} to ${project.targetDate}`);

  const scopeTasks = scopeOf(tasks);
  const done = scopeTasks.filter((t) => t.status === 'DONE').length;
  const totalPoints = scopeTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
  const completedPoints = scopeTasks.filter((t) => t.status === 'DONE').reduce((s, t) => s + (t.storyPoints || 0), 0);
  const totalEst = tasks.reduce((s, t) => s + (t.estimatedHours || 0), 0);
  const totalLogged = tasks.reduce((s, t) => s + (t.loggedHours || 0), 0);
  const blocked = tasks.filter((t) => t.status === 'BLOCKED').length;

  let y = addMetrics(doc, 34, [
    { label: 'TOTAL TASKS', value: String(scopeTasks.length) },
    { label: 'COMPLETED', value: String(done) },
    { label: 'COMPLETION %', value: `${project.progress}%` },
    { label: 'BLOCKED', value: String(blocked) },
    { label: 'STORY POINTS', value: `${completedPoints}/${totalPoints}` },
    { label: 'ITERATIONS', value: String(sprints.length) },
    { label: 'RELEASES', value: String(releases.length) },
    { label: 'HOURS', value: `${totalLogged}h / ${totalEst}h` },
  ]);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('ALL PROJECT TASKS', 14, y);
  y += 4;
  y = addTaskTable(doc, y, tasks, users);

  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated: ${new Date().toLocaleString()} | FlowExec Project Management`, 14, 285);

  return doc.output('blob');
}

export function generateReleaseReportPDF(
  release: Release,
  tasks: Task[],
  users: User[],
  project: Project
): Blob {
  const doc = new jsPDF();
  addHeader(doc, `Release Report: ${release.name}`, `${project.name} | v${release.version} | ${release.startDate} to ${release.targetDate}`);

  const releaseTasks = tasks.filter((t) => t.releaseId === release.id);
  const scopeTasks = scopeOf(releaseTasks);
  const done = scopeTasks.filter((t) => t.status === 'DONE').length;
  const totalPoints = scopeTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
  const completedPoints = scopeTasks.filter((t) => t.status === 'DONE').reduce((s, t) => s + (t.storyPoints || 0), 0);

  let y = addMetrics(doc, 34, [
    { label: 'RELEASE STATUS', value: release.status.replace(/_/g, ' ') },
    { label: 'TOTAL TASKS', value: String(scopeTasks.length) },
    { label: 'COMPLETED', value: String(done) },
    { label: 'PROGRESS', value: `${release.progress}%` },
    { label: 'STORY POINTS', value: `${completedPoints}/${totalPoints}` },
    { label: 'VERSION', value: release.version },
  ]);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('RELEASE TASKS', 14, y);
  y += 4;
  y = addTaskTable(doc, y, releaseTasks, users);

  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated: ${new Date().toLocaleString()} | FlowExec Project Management`, 14, 285);

  return doc.output('blob');
}

export function generateRoadmapSummaryPDF(
  project: Project,
  epics: Task[],
  tasks: Task[],
  users: User[]
): Blob {
  const doc = new jsPDF();
  addHeader(doc, `Roadmap Summary: ${project.name}`, `Epics: ${epics.length} | Tasks: ${tasks.length}`);

  const scopeTasks = scopeOf(tasks);
  const done = scopeTasks.filter((t) => t.status === 'DONE').length;
  const totalPoints = scopeTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
  const completedPoints = scopeTasks.filter((t) => t.status === 'DONE').reduce((s, t) => s + (t.storyPoints || 0), 0);

  let y = addMetrics(doc, 34, [
    { label: 'TOTAL EPICS', value: String(epics.length) },
    { label: 'TOTAL TASKS', value: String(scopeTasks.length) },
    { label: 'COMPLETED', value: String(done) },
    { label: 'STORY POINTS', value: `${completedPoints}/${totalPoints}` },
    { label: 'PROJECT PROGRESS', value: `${project.progress}%` },
  ]);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('EPICS OVERVIEW', 14, y);
  y += 4;
  y = addTaskTable(doc, y, epics, users);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('ALL TASKS', 14, y);
  y += 4;
  y = addTaskTable(doc, y, tasks.slice(0, 50), users);

  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated: ${new Date().toLocaleString()} | FlowExec Project Management`, 14, 285);

  return doc.output('blob');
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
