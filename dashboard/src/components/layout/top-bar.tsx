import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, FolderKanban, Menu, Search } from 'lucide-react';
import { Select } from '@getloopscale/ui';
import { useProjects } from '@/hooks/projects/use-projects';
import { breadcrumbTrail } from './breadcrumb-trail';

interface TopBarProps {
  showProjectSelector?: boolean;
  /** Sprint 2 T2.6 — invoked when user clicks the search/command button. */
  onCommandPaletteOpen?: () => void;
  /** Opens the sidebar on a window narrow enough to have it put away. */
  onMenuOpen?: () => void;
  menuOpen?: boolean;
}

// EC-13 platform-aware shortcut display
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const SHORTCUT_LABEL = isMac ? '⌘K' : 'Ctrl+K';

/**
 * TopBar — horizontal strip above main content (h-14, border-b).
 *
 * Composition:
 *   left:   project selector Select (hidden on Settings/Profile/Billing)
 *   right:  reserved slot for future quick actions (NotificationBell,
 *           CommandPalette trigger)
 *
 * The pageTitle text was removed 2026-05-26 — it duplicated the heading that
 * PageShell already renders in the page body, and on project-scoped routes
 * it duplicated the value shown by the Select itself. The `useSetPageTitle`
 * hook + PageMetaProvider stay in place for future consumers (e.g., browser
 * tab `document.title` sync).
 *
 * Project selector defaults to the current `:name` route param when present
 * so the dropdown reflects "where you are" instead of resetting to "All".
 *
 * Uses use-projects.ts cache (D-3 v1.1) — same fetch shared with Overview
 * and Projects page without duplicate network calls.
 */
export function TopBar({ showProjectSelector = true, onCommandPaletteOpen, onMenuOpen, menuOpen = false }: TopBarProps) {
  const { projects } = useProjects();
  const location = useLocation();
  const navigate = useNavigate();

  // Hide selector on routes that don't make project sense
  const hideOnPaths = ['/settings', '/profile', '/billing'];
  const shouldShowSelector =
    showProjectSelector && !hideOnPaths.some((p) => location.pathname.startsWith(p));

  // The layout mounts this bar above the routes that carry `:name`, so useParams has no
  // project here. The name is read from the path and counts only when it is a listed project.
  const routeProjectName = matchPath('/projects/:name/*', location.pathname)?.params.name;
  const trail = breadcrumbTrail(location.pathname);
  const selectorValue = projects.some((p) => p.name === routeProjectName) ? routeProjectName! : 'all';

  return (
    <header className="h-12 shrink-0 border-b border-border bg-card sticky top-0 z-20 flex items-center gap-3 px-4">
      {onMenuOpen && (
        <button
          type="button"
          onClick={onMenuOpen}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-foreground/75 hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden"
        >
          <Menu className="size-4" aria-hidden="true" />
        </button>
      )}
      {/* Left slot — project selector (the primary nav widget for project-scoped
       * pages). Placed first per Vercel/Linear convention. */}
      {shouldShowSelector && (
        <Select
          value={selectorValue}
          onValueChange={(value) => {
            if (value === 'all') {
              navigate('/projects');
            } else {
              navigate(`/projects/${value}`);
            }
          }}
        >
          <Select.Trigger
            aria-label="Select project"
            className="w-[200px] gap-2"
          >
            <FolderKanban
              className="size-3.5 text-muted-foreground shrink-0"
              aria-hidden="true"
            />
            <Select.Value placeholder="All Projects" />
          </Select.Trigger>
          <Select.Content className="min-w-[220px]">
            <Select.Item value="all">All Projects</Select.Item>
            {projects.map((p) => (
              <Select.Item
                key={p.name}
                value={p.name}
                className="truncate overflow-hidden"
              >
                {p.name}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      )}

      {trail.length > 0 && (
        <nav aria-label="You are here" className="min-w-0 border-l border-border pl-3">
          <ol className="flex min-w-0 items-center gap-1 text-[13px]">
            {trail.map((name, index) => (
              <li key={name} className="flex min-w-0 items-center gap-1">
                {index > 0 && (
                  <ChevronRight className="size-3.5 shrink-0 text-foreground/30" aria-hidden="true" />
                )}
                <span
                  aria-current={index === trail.length - 1 ? 'page' : undefined}
                  className={`truncate ${index === trail.length - 1 ? 'font-medium text-foreground' : 'text-foreground/55'}`}
                >
                  {name}
                </span>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* Right slot — Sprint 2 T2.6: CommandPalette trigger button.
       * EC-13: shortcut label adapts to platform (⌘K em Mac, Ctrl+K em Win/Linux).
       * Sized +25% vs original per sponsor feedback (px-3 py-1.5 text-label →
       * px-4 py-2 text-body-sm + larger icon + min-width). Bigger tap target +
       * stronger visual affordance — search é uma surface principal de produto. */}
      <div className="ml-auto">
        {onCommandPaletteOpen && (
          <button
            type="button"
            onClick={onCommandPaletteOpen}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-2.5 text-[13px] text-foreground/75 hover:bg-muted/60 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            /* Red Team loopscale/loopscale#163 — WCAG 2.5.3 Label in Name: the
             * accessible name MUST contain the visible text. The button's
             * visible text is "Search…"; the previous aria-label started
             * with "Open" and never mentioned Search — voice-control
             * activation by "Click Search" failed. New form starts with
             * the visible text verbatim, preserves the shortcut hint. */
            aria-label={`Search — open command palette (${SHORTCUT_LABEL})`}
          >
            <Search className="size-4" aria-hidden="true" />
            <span className="text-left max-sm:hidden">Search…</span>
            <kbd className="rounded border border-border px-1 font-mono text-[11px] text-foreground/60 max-sm:hidden">
              {SHORTCUT_LABEL}
            </kbd>
          </button>
        )}
      </div>
    </header>
  );
}
