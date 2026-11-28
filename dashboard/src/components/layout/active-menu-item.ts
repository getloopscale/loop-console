import { resolvePlaceholders, type MenuDefinition } from './app-sidebar-menus';

/** Whether `pathname` is `path` or a route under it. The root matches itself only. */
function isAtOrUnder(pathname: string, path: string): boolean {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * The path of the entry of `menu` the user is in: the entry whose route is the longest one that
 * contains `pathname`. On `/sandboxes/sbx_1` that is `/sandboxes`; on a project's deployments it
 * is Deployments and not Overview, whose route contains every other. Undefined when no entry
 * contains the route.
 */
export function activeItemPath(
  menu: MenuDefinition,
  pathname: string,
  projectName?: string,
): string | undefined {
  let best: string | undefined;
  for (const group of menu.groups) {
    for (const item of group.items) {
      const path = resolvePlaceholders(item.path, projectName);
      if (isAtOrUnder(pathname, path) && (best === undefined || path.length > best.length)) {
        best = path;
      }
    }
  }
  return best;
}
