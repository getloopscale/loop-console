import { lazy, Suspense, useState } from 'react';
import { Rocket } from 'lucide-react';
import { useOnboardingState } from '@/hooks/use-onboarding-state';

/**
 * OnboardingPanel (Sprint 3 T3.2 v2) — Linear/Vercel 2026 floating pattern.
 *
 * Replaces the cramped sidebar widget (220px wide, hard to read) with a
 * floating panel bottom-right (360x480 expanded) + circular progress badge
 * (52x52 collapsed). Per 2026 FAANG synthesis:
 *
 * - Floating position NEVER competes with sidebar nav real estate
 * - Larger surface = legible CLI commands + full descriptions
 * - Collapsed badge shows progress ring — user always aware without forced UI
 * - Dismiss collapses to badge (state preserved); long-dismiss via Settings
 *
 * Anti-patterns avoided:
 * - ❌ Modal jail (full-screen takeover)
 * - ❌ Forced wizard with Next buttons
 * - ❌ Tiny sidebar widget that competes with nav
 * - ❌ Persistent always-expanded panel (blocks content)
 *
 * EC-17: CopyButton from @getloopscale/ui handles clipboard fallback (HTTPS vs HTTP).
 */

const OnboardingChecklist = lazy(() => import('./onboarding-checklist'));

export function OnboardingPanel() {
  const { state, completed, total, percent, dismiss, markStepDone, isVisible } =
    useOnboardingState();
  // Local UI state — collapsed (badge only) vs expanded (full panel)
  // Default collapsed: user opts in to see full panel via badge click.
  const [expanded, setExpanded] = useState(false);

  if (!isVisible) return null;

  // The badge stays where it is; the checklist opens over the page as a modal.
  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="fixed bottom-6 right-6 z-50 size-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        /* Red Team loopscale/loopscale#163 — WCAG 2.5.3 Label in Name: the collapsed
         * FAB renders only an icon + the badge "{completed}/{total}" as
         * visible text (the "Get your app live" heading is only shown in the
         * expanded panel). Accessible name must lead with the badge visible
         * text so voice-control activation by "Click 2 slash 5" works. */
        aria-label={`${completed}/${total} — Get your app live. Click to expand.`}
      >
        <ProgressRing percent={percent} size={56} />
        <Rocket
          className="size-5 absolute"
          aria-hidden="true"
        />
        <span className="absolute -top-1 -right-1 bg-background text-foreground border border-border rounded-full text-[10px] font-mono tabular-nums px-1.5 py-0.5 leading-none">
          {completed}/{total}
        </span>
      </button>
      {expanded && (
        <Suspense fallback={null}>
          <OnboardingChecklist
            state={state}
            completed={completed}
            total={total}
            percent={percent}
            dismiss={dismiss}
            markStepDone={markStepDone}
            onClose={() => setExpanded(false)}
          />
        </Suspense>
      )}
    </>
  );
}

/** Circular progress ring for the collapsed badge. SVG-based, lightweight. */
function ProgressRing({ percent, size }: { percent: number; size: number }) {
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="absolute inset-0"
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-primary-foreground/20"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-primary-foreground transition-all duration-500"
        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
      />
    </svg>
  );
}
