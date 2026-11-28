import { Check, Rocket } from 'lucide-react';
import { Button, CopyButton } from '@getloopscale/ui';
import { AppModal } from '@/components/ui/app-modal';
import type { useOnboardingState } from '@/hooks/use-onboarding-state';
import { reportEvent } from '@/lib/telemetry/rum';

interface ChecklistStep {
  key: 'cli_installed' | 'logged_in' | 'project_initialized' | 'deploy_succeeded' | 'domain_added';
  title: string;
  description: string;
  cliCommand?: string;
  optional?: boolean;
}

const STEPS: ChecklistStep[] = [
  {
    key: 'cli_installed',
    title: 'Install the LoopScale CLI',
    description: 'The CLI is your primary tool. Dashboard is for status + history.',
    cliCommand: 'npm install -g loopscale',
  },
  {
    key: 'logged_in',
    title: 'Sign in',
    description: 'Connect the CLI to your LoopScale team.',
    cliCommand: 'loopscale login',
  },
  {
    key: 'project_initialized',
    title: 'Initialize your first project',
    description: 'Connect a repo or start from a starter template.',
    // Sprint 4 qa-sprint4-cleanup-2026-06-25 #32: `loopscale init` is NOT a real
    // subcommand of the CLI then. Replaced with the canonical
    // `loopscale project create my-app` per the CLI's actual surface.
    cliCommand: 'loopscale project create my-app',
  },
  {
    key: 'deploy_succeeded',
    title: 'Deploy your first project',
    description: 'Goes from your laptop to a live URL in about 4 minutes.',
    cliCommand: 'loopscale deploy',
  },
  {
    key: 'domain_added',
    title: 'Add a custom domain',
    description: 'Point your own domain at the deploy. TLS handled automatically.',
    cliCommand: 'loopscale domain add app.example.com',
    optional: true,
  },
];

type Onboarding = ReturnType<typeof useOnboardingState>;

interface OnboardingChecklistProps
  extends Pick<Onboarding, 'state' | 'completed' | 'total' | 'percent' | 'dismiss' | 'markStepDone'> {
  readonly onClose: () => void;
}

/**
 * The onboarding checklist, in the same modal as every other dialog of the console. The badge
 * that opens it lives in `onboarding-panel.tsx` and fetches this file on the first open, which
 * keeps the modal out of the first load.
 */
export default function OnboardingChecklist({
  state,
  completed,
  total,
  percent,
  dismiss,
  markStepDone,
  onClose,
}: OnboardingChecklistProps) {
  const activeKey = STEPS.find((s) => !state.steps[s.key])?.key;

  return (
    <AppModal
      open
      onClose={onClose}
      size="md"
      icon={<Rocket className="size-4" aria-hidden="true" />}
      title="Get your app live"
      description={completed === total ? 'All set! 🎉' : `${completed} of ${total} steps complete`}
      footer={
        <>
          <Button
            variant="ghost"
            aria-label="Dismiss onboarding"
            onClick={() => {
              dismiss();
              reportEvent('onboarding_dismissed');
            }}
          >
            Dismiss
          </Button>
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Larger progress bar — prominent visual.
            Red Team loop-console#81 closure: promote the outer track to
            role=progressbar with aria-valuenow/min/max so assistive
            tech announces the percentage as a progress indicator
            (consistent with the billing usage meters). The inner bar
            stays purely presentational. */}
        <div
          className="h-2 rounded-full bg-muted overflow-hidden"
          role="progressbar"
          aria-label="Onboarding progress"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${percent}%`}
        >
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 ease-out"
            style={{ width: `${percent}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="space-y-2">
        {STEPS.map((step, idx) => {
          const done = state.steps[step.key];
          const isActive = step.key === activeKey;
          return (
            <div
              key={step.key}
              className={`rounded-lg border p-3 transition-colors ${
                done
                  ? 'border-border/30 bg-muted/10'
                  : isActive
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  {done ? (
                    <div className="flex size-6 items-center justify-center rounded-full bg-success/15 border border-success/30">
                      <Check className="size-3.5 text-success" aria-label="done" />
                    </div>
                  ) : (
                    <div
                      className={`flex size-6 items-center justify-center rounded-full border-2 text-label font-mono tabular-nums ${
                        isActive
                          ? 'border-primary text-primary'
                          : 'border-border text-muted-foreground'
                      }`}
                      aria-label={isActive ? 'active step' : 'pending'}
                    >
                      {idx + 1}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-body-sm font-medium ${
                        done ? 'text-muted-foreground line-through' : 'text-foreground'
                      }`}
                    >
                      {step.title}
                    </p>
                    {step.optional && (
                      <span className="text-label text-muted-foreground uppercase">
                        optional
                      </span>
                    )}
                  </div>
                  <p className="text-label text-muted-foreground mt-0.5">
                    {step.description}
                  </p>

                  {/* CLI command — visible for ALL incomplete steps (not just active) */}
                  {!done && step.cliCommand && (
                    <div className="mt-2 flex items-center gap-2 bg-muted/40 rounded-md px-2.5 py-1.5 font-mono text-[12px]">
                      <span className="text-muted-foreground">$</span>
                      <span className="flex-1 truncate text-foreground">
                        {step.cliCommand}
                      </span>
                      <CopyButton value={step.cliCommand} label="Copy" />
                    </div>
                  )}

                  {/* "I installed it" override only for cli_installed step (EC-14) */}
                  {!done && step.key === 'cli_installed' && (
                    <div className="mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-label"
                        onClick={() => {
                          markStepDone('cli_installed');
                          reportEvent('onboarding_step_completed', { step: 'cli_installed' });
                        }}
                      >
                        I installed it
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        </div>
        <p className="text-label text-muted-foreground">
          Click the rocket badge anytime to reopen this checklist.
        </p>
      </div>
    </AppModal>
  );
}
