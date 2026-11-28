import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useRequireAuth } from '@/hooks/use-auth';
import { isEmailVerified } from '@/lib/auth/session';
import { PageMetaProvider } from '@/hooks/use-page-meta';
import { useCommandPalette } from '@/hooks/use-command-palette';
import { useProjects } from '@/hooks/projects/use-projects';
import { VerificationBanner } from '@/components/verification-banner';
import { CommandPalette } from '@/components/command/command-palette';
import { buildCommands, sortByRecentDeploy } from '@/components/command/commands';
import { OnboardingPanel } from '@/components/onboarding/onboarding-panel';
import { AppSidebar } from './app-sidebar';
import { resolveActiveMenu } from './app-sidebar-menus';
import { StatusBar } from './status-bar';
import { TopBar } from './top-bar';

interface DashboardLayoutProps {
  children: ReactNode;
}

/**
 * DashboardLayout — shell for all protected routes. Wraps children with
 * <PageMetaProvider> so pages can call useSetPageTitle() to control TopBar.
 *
 * Sidebar width 220px + main content with TopBar h-14 + p-6.
 *
 * Auth pages (Login/Register/Verification/Recovery/DeviceSuccess) do NOT
 * use this layout — they render standalone via the public Routes block in
 * app.tsx (per D5 of plan v1.2).
 */
export function DashboardLayout({ children }: DashboardLayoutProps) {
  const session = useRequireAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // M57 T6.1 (ADR-D3): the onboarding nag (email banner + FAB) is an
  // account/onboarding concern — suppress it on the observability workspace so
  // it stops stealing vertical space from every /observability screen. Exact +
  // nested match so a sibling like /observability-foo (none today) is unaffected.
  const onObservability =
    pathname === '/observability' || pathname.startsWith('/observability/');
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPalette();
  const { projects } = useProjects();
  // The project of the route, by the same rule that picks the sidebar menu.
  const currentProject = resolveActiveMenu(pathname).projectName;

  // EC-12: project quick-jumps sorted by last_deploy DESC, tiebreaker created_at
  const commands = useMemo(
    () => buildCommands({ navigate, recentProjects: sortByRecentDeploy(projects), currentProject }),
    [navigate, projects, currentProject],
  );

  if (session === null) {
    return (
      <div className="bg-background min-h-screen text-foreground flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-primary animate-spin" aria-label="Loading" />
      </div>
    );
  }

  const verified = isEmailVerified(session);

  return (
    <PageMetaProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:text-body-sm focus:font-medium"
      >
        Skip to main content
      </a>
      {/*
        Fixed-viewport app shell (Linear/Vercel/Arize pattern): the outer frame is
        h-screen + overflow-hidden so the WINDOW never scrolls, and <main> is the
        single scroll container. This makes the mouse wheel scroll the content on
        EVERY page (timeline, sessions grid, traces grid, session conversation) —
        the previous min-h-screen document-scroll was unreliable under the flex
        shell. TopBar + sidebar stay pinned; only the content region scrolls.
      */}
      <div className="bg-background h-screen overflow-hidden text-foreground flex">
        {/* The sidebar is as tall as the window and scrolls its own list of entries. */}
        <div className="h-full shrink-0">
          <AppSidebar session={session} />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar onCommandPaletteOpen={() => setPaletteOpen(true)} />
          <main id="main-content" className="flex-1 overflow-y-auto">
            <div className="w-full px-6 py-5">
              {!verified && !onObservability && (
                <div className="mb-6">
                  <VerificationBanner />
                </div>
              )}
              {children}
            </div>
          </main>
          <StatusBar />
        </div>
      </div>
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        commands={commands}
      />
      {/* Sprint 3 T3.2 v2: Floating onboarding panel (Linear/Vercel 2026
          pattern). Bottom-right fixed, never competes with sidebar nav.
          Collapses to badge with progress ring. Replaces cramped sidebar
          widget (220px largura era ilegível). */}
      {!onObservability && <OnboardingPanel />}
    </PageMetaProvider>
  );
}
