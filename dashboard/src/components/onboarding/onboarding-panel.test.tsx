import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/render';
import { userEvent } from '@testing-library/user-event';

const mockUseOnboardingState = vi.fn();
vi.mock('@/hooks/use-onboarding-state', () => ({
  useOnboardingState: () => mockUseOnboardingState(),
}));
vi.mock('@/lib/telemetry/rum', () => ({ reportEvent: vi.fn() }));

import { OnboardingPanel } from './onboarding-panel';

function makeHookResult(overrides: Record<string, unknown> = {}) {
  return {
    state: {
      dismissed: false,
      steps: {
        cli_installed: false,
        logged_in: false,
        project_initialized: false,
        deploy_succeeded: false,
        domain_added: false,
      },
    },
    completed: 0,
    total: 5,
    percent: 0,
    dismiss: vi.fn(),
    replay: vi.fn(),
    markStepDone: vi.fn(),
    isVisible: true,
    ...overrides,
  };
}

beforeEach(() => {
  mockUseOnboardingState.mockReset();
});

describe('OnboardingPanel (Sprint 3 T3.2 v2 — floating panel pattern)', () => {
  it('test_renders_collapsed_badge_by_default', () => {
    mockUseOnboardingState.mockReturnValue(makeHookResult({ completed: 2, percent: 40 }));
    render(<OnboardingPanel />);
    expect(screen.getByLabelText(/get your app live/i)).toBeInTheDocument();
    // Counter chip on badge
    expect(screen.getByText('2/5')).toBeInTheDocument();
  });

  it('test_does_not_render_when_dismissed', () => {
    mockUseOnboardingState.mockReturnValue(makeHookResult({ isVisible: false }));
    render(<OnboardingPanel />);
    expect(screen.queryByLabelText(/get your app live/i)).not.toBeInTheDocument();
  });

  it('test_expands_to_panel_on_badge_click', async () => {
    mockUseOnboardingState.mockReturnValue(makeHookResult({ completed: 1 }));
    render(<OnboardingPanel />);
    await userEvent.click(screen.getByLabelText(/get your app live/i));
    // The checklist opens as the standard modal, not as a panel pinned to a corner.
    const dialog = await screen.findByRole('dialog', { name: 'Get your app live' });
    expect(dialog.querySelector('[data-slot="modal-header"]')).not.toBeNull();
    expect(dialog.querySelector('[data-slot="modal-body"]')).not.toBeNull();
  });

  it('test_collapses_back_to_badge_via_chevron', async () => {
    mockUseOnboardingState.mockReturnValue(makeHookResult({ completed: 1 }));
    render(<OnboardingPanel />);
    await userEvent.click(screen.getByLabelText(/get your app live/i));
    await screen.findByRole('dialog', { name: 'Get your app live' }); // the checklist is fetched on open
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('test_dismiss_button_calls_dismiss_when_expanded', async () => {
    const dismiss = vi.fn();
    mockUseOnboardingState.mockReturnValue(makeHookResult({ completed: 1, dismiss }));
    render(<OnboardingPanel />);
    await userEvent.click(screen.getByLabelText(/get your app live/i));
    await screen.findByRole('dialog', { name: 'Get your app live' }); // the checklist is fetched on open
    await userEvent.click(screen.getByLabelText('Dismiss onboarding'));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('test_renders_all_5_steps_when_expanded', async () => {
    mockUseOnboardingState.mockReturnValue(makeHookResult());
    render(<OnboardingPanel />);
    await userEvent.click(screen.getByLabelText(/get your app live/i));
    await screen.findByRole('dialog', { name: 'Get your app live' }); // the checklist is fetched on open
    expect(screen.getByText('Install the LoopScale CLI')).toBeInTheDocument();
    expect(screen.getByText('Sign in')).toBeInTheDocument();
    expect(screen.getByText('Initialize your first project')).toBeInTheDocument();
    expect(screen.getByText('Deploy your first project')).toBeInTheDocument();
    expect(screen.getByText('Add a custom domain')).toBeInTheDocument();
  });

  it('test_cli_commands_visible_for_all_incomplete_steps', async () => {
    mockUseOnboardingState.mockReturnValue(makeHookResult());
    render(<OnboardingPanel />);
    await userEvent.click(screen.getByLabelText(/get your app live/i));
    await screen.findByRole('dialog', { name: 'Get your app live' }); // the checklist is fetched on open
    // All 5 CLI commands visible em panel expanded.
    // Sprint 4 qa-sprint4-cleanup-2026-06-25 #32: `loopscale init` (which does NOT
    // exist in the CLI then) replaced with canonical `loopscale project create my-app`.
    expect(screen.getByText('npm install -g loopscale')).toBeInTheDocument();
    expect(screen.getByText('loopscale login')).toBeInTheDocument();
    expect(screen.getByText('loopscale project create my-app')).toBeInTheDocument();
    expect(screen.getByText('loopscale deploy')).toBeInTheDocument();
    expect(screen.getByText('loopscale domain add app.example.com')).toBeInTheDocument();
  });

  it('test_optional_label_on_domain_step', async () => {
    mockUseOnboardingState.mockReturnValue(makeHookResult());
    render(<OnboardingPanel />);
    await userEvent.click(screen.getByLabelText(/get your app live/i));
    await screen.findByRole('dialog', { name: 'Get your app live' }); // the checklist is fetched on open
    expect(screen.getByText('optional')).toBeInTheDocument();
  });

  // Red Team loop-console#81 closure: the onboarding progress used to ship
  // as a generic <div> with only aria-label — AT users heard the label as
  // static text and never as a progress indicator. The track now renders
  // with role=progressbar + aria-valuenow/min/max so it matches the
  // billing usage meters' shape.
  it('progress track is role=progressbar with aria-valuenow (#81)', async () => {
    mockUseOnboardingState.mockReturnValue(makeHookResult({ completed: 3, percent: 60 }));
    render(<OnboardingPanel />);
    // Expand the panel so the progress bar is visible.
    await userEvent.click(screen.getByLabelText(/get your app live/i));
    await screen.findByRole('dialog', { name: 'Get your app live' }); // the checklist is fetched on open
    const bar = screen.getByRole('progressbar', { name: /onboarding progress/i });
    expect(bar).toBeInTheDocument();
    expect(bar.getAttribute('aria-valuenow')).toBe('60');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
  });

  it('test_mark_cli_installed_via_override_button', async () => {
    const markStepDone = vi.fn();
    mockUseOnboardingState.mockReturnValue(makeHookResult({ markStepDone }));
    render(<OnboardingPanel />);
    await userEvent.click(screen.getByLabelText(/get your app live/i));
    await screen.findByRole('dialog', { name: 'Get your app live' }); // the checklist is fetched on open
    await userEvent.click(screen.getByRole('button', { name: 'I installed it' }));
    expect(markStepDone).toHaveBeenCalledWith('cli_installed');
  });
});
