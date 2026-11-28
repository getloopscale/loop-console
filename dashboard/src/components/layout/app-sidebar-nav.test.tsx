// live-test-gaps-fix F-4 — the Memory/main sub-nav must navigate via PLAIN
// react-router navigate (NO View Transition) so the lazy+Suspense route panel
// re-renders on click. Regression guard against re-introducing ANY View Transition
// wrapper (raw document.startViewTransition OR RR-native { viewTransition: true }),
// which snapshots the old DOM before the lazy chunk commits → stale panel until
// reload (verified live in Chrome 2026-06-24).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent } from '@testing-library/react';

import { render, screen } from '@/test/render';
import { AppSidebar } from './app-sidebar';
import type { Session } from '@/lib/auth/session';

const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));

vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});

function makeSession(): Session {
  return { active: true, identity: { id: 'sess-1', traits: { email: 'p@example.com' } } };
}

describe('AppSidebar navigation (F-4)', () => {
  beforeEach(() => navigateSpy.mockClear());

  it('navigates with PLAIN react-router navigate (no view transition) on sub-nav click', () => {
    render(<AppSidebar session={makeSession()} />);
    fireEvent.click(screen.getByRole('link', { name: /Projects/i }));
    // PLAIN navigate — path only, NO viewTransition option (F-4 correction).
    expect(navigateSpy).toHaveBeenCalledWith('/projects');
    expect(navigateSpy.mock.calls[0]).toHaveLength(1);
  });

  it('navigates back with PLAIN react-router navigate (no view transition)', () => {
    // The `memory` menu has parent 'main', so rendering at /memory surfaces the
    // "Back to LoopScale" control wired to handleBack (the 2nd F-4 call site).
    render(<AppSidebar session={makeSession()} />, { initialEntries: ['/memory'] });
    const back = screen.getByRole('button', { name: /back to/i });
    navigateSpy.mockClear();
    fireEvent.click(back);
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy.mock.calls[0]).toHaveLength(1); // path only, no viewTransition
  });
});
