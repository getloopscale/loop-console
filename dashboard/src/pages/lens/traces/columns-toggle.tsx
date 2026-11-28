import { useRef, useState } from 'react';
import { Button, Checkbox } from '@getloopscale/ui';
import { Columns3 } from 'lucide-react';

import { AppModal } from '@/components/ui/app-modal';

import { TOGGLEABLE_COLUMNS, type ColumnState } from './view-encoding';

/**
 * M59 P3 — the column-visibility control (blueprint §3 / Arize Screen 1 "select tracing table
 * columns"). A button reveals a small panel of `Checkbox`es for the optional spine columns
 * (latency/tokens/cost); toggling writes the encoded `cols=` URL param via `onChange`, so the M52
 * saved view captures the choice for free (no schema change — ADR D4). Composed from `@getloopscale/ui`
 * primitives.
 *
 * It opens as the shared modal, like every other dialog of the console. The modal owns Escape,
 * the focus trap and the return of focus to the trigger.
 */
export function ColumnsToggle({
  state,
  onChange,
}: {
  state: ColumnState;
  onChange: (next: ColumnState) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  // Closing hands the focus back to the button, so the keyboard continues from where it was.
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  };

  const toggle = (key: string) =>
    onChange({ ...state, visibility: { ...state.visibility, [key]: !(state.visibility[key] ?? true) } });

  return (
    <>
      <Button
        ref={trigger}
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Choose columns"
        onClick={() => setOpen(true)}
      >
        <Columns3 className="mr-1 h-4 w-4" />
        Columns
      </Button>
      <AppModal
        open={open}
        onClose={close}
        size="sm"
        title="Choose columns"
        description="The choice is kept in the address, so a saved view carries it."
      >
        <div data-testid="columns-panel" className="flex flex-col gap-3">
          {TOGGLEABLE_COLUMNS.map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm capitalize">
              <Checkbox
                checked={state.visibility[key] ?? true}
                onCheckedChange={() => toggle(key)}
                aria-label={`Toggle ${key} column`}
              />
              {key}
            </label>
          ))}
        </div>
      </AppModal>
    </>
  );
}
