/**
 * Utility functions for formatting and matching IDs in URLs.
 * Converts padded IDs like 'proj-001' to 'proj-1' for clean, human-friendly URLs.
 * Supports clean project URLs like /admin/:projectKey/:projectName (e.g. /admin/ECOMM/e-commerce-platform).
 */

/**
 * Strips leading zeros from numeric suffixes in IDs for URLs.
 * Examples:
 *   'proj-001' -> 'proj-1'
 *   'task-005' -> 'task-5'
 *   'spr-012' -> 'spr-12'
 *   'bug-001' -> 'bug-1'
 *   '1' -> '1'
 */
export function toUrlId(id: string | undefined | null): string {
  if (!id) return '';
  return id.replace(/-0+(\d+)/g, '-$1');
}

/**
 * Flexible ID matcher that matches an entity's canonical ID against a URL parameter.
 * Supports:
 *   - Exact match: 'proj-001' === 'proj-001'
 *   - Stripped leading zeros: 'proj-001' matches 'proj-1'
 *   - Pure numeric suffix: 'proj-001' matches '1'
 *   - Case-insensitive comparison
 */
export function matchId(entityId: string | undefined | null, urlParamId: string | undefined | null): boolean {
  if (!entityId || !urlParamId) return false;
  if (entityId === urlParamId) return true;

  const cleanEntity = entityId.toLowerCase().trim();
  const cleanUrl = urlParamId.toLowerCase().trim();
  if (cleanEntity === cleanUrl) return true;

  // Compare normalized zero-stripped forms: e.g. proj-001 -> proj-1, task-001 -> task-1
  const normEntity = cleanEntity.replace(/-0+(\d+)/g, '-$1');
  const normUrl = cleanUrl.replace(/-0+(\d+)/g, '-$1');
  if (normEntity === normUrl) return true;

  // If URL has a prefix (e.g. 'task-1', 'epic-1', 'subtask-1'), do not match entities with different prefix
  const entityPrefixMatch = cleanEntity.match(/^([a-z]+)-/i);
  const urlPrefixMatch = cleanUrl.match(/^([a-z]+)-/i);
  if (urlPrefixMatch && entityPrefixMatch && urlPrefixMatch[1] !== entityPrefixMatch[1]) {
    return false;
  }

  // Compare numeric portion only when URL parameter is purely numeric: e.g. '1' matches 'proj-001' or 'proj-1'
  if (!urlPrefixMatch) {
    const numEntity = cleanEntity.replace(/^[a-z]+-0*/i, '');
    const numUrl = cleanUrl.replace(/^0*/i, '');
    if (numEntity && numUrl && numEntity === numUrl) return true;
  }

  return false;
}

/**
 * Converts a text title/name into a URL-friendly slug.
 * Example: 'E-Commerce Platform' -> 'e-commerce-platform'
 */
export function slugify(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generates the clean URL for a project based on role, project key, and project name.
 * Format: /{rolePrefix}/{projectKey}/{projectNameSlug}
 * Example: /admin/ECOMM/e-commerce-platform
 */
export function getProjectUrl(
  project: { id: string; key?: string; code?: string; name: string } | undefined | null,
  role?: string
): string {
  if (!project) return '/';
  const rolePrefix =
    role === 'ADMIN'
      ? '/admin'
      : role === 'TEAM_LEADER'
      ? '/tl'
      : role === 'MEMBER'
      ? '/member'
      : '/pm';

  const key = project.key || project.code || toUrlId(project.id);
  const nameSlug = slugify(project.name) || toUrlId(project.id);
  return `${rolePrefix}/${encodeURIComponent(key)}/${nameSlug}`;
}

/**
 * Flexible project matcher that matches a project by:
 * - projectKey (e.g. 'ECOMM')
 * - projectName (e.g. 'e-commerce-platform')
 * - projectId (e.g. 'proj-1', 'proj-001', '1')
 */
export function matchProject(
  project: { id: string; key?: string; code?: string; name: string },
  params: { projectId?: string; projectKey?: string; projectName?: string } | string | undefined | null
): boolean {
  if (!project || !params) return false;

  if (typeof params === 'string') {
    return (
      matchId(project.id, params) ||
      Boolean(project.key && project.key.toLowerCase() === params.toLowerCase()) ||
      Boolean(project.code && project.code.toLowerCase() === params.toLowerCase()) ||
      slugify(project.name) === slugify(params)
    );
  }

  const { projectId, projectKey, projectName } = params;

  // 1. If projectKey is provided, check if it matches project.key, project.code, or project.id
  if (projectKey) {
    const keyLower = projectKey.toLowerCase();
    if (project.key && project.key.toLowerCase() === keyLower) return true;
    if (project.code && project.code.toLowerCase() === keyLower) return true;
    if (matchId(project.id, projectKey)) return true;
  }

  // 2. If projectId is provided, check matchId or key/code
  if (projectId) {
    if (matchId(project.id, projectId)) return true;
    const idLower = projectId.toLowerCase();
    if (project.key && project.key.toLowerCase() === idLower) return true;
    if (project.code && project.code.toLowerCase() === idLower) return true;
  }

  // 3. If projectName is provided and matches slug
  if (projectName && slugify(project.name) === slugify(projectName)) {
    return true;
  }

  return false;
}
