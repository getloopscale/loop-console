import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@getloopscale/loopzero-ui';
import { TEMA_LOOPSCALE } from '@/lib/theme/loopscale-theme';

import { ColumnsToggle } from './columns-toggle';
import type { ColumnState } from './view-encoding';

const state: ColumnState = { visibility: {}, density: 'comfortable' } as ColumnState;

function renderToggle() {
  return render(<ColumnsToggle state={state} onChange={vi.fn()} />, {
    wrapper: ({ children }) => (
      <ThemeProvider {...TEMA_LOOPSCALE}>
        <button type="button">outside</button>
        {children}
      </ThemeProvider>
    ),
  });
}

describe('ColumnsToggle a11y (M98 D-M5)', () => {
  it('Escape closes the panel and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    renderToggle();
    const trigger = screen.getByRole('button', { name: /choose columns/i });
    await user.click(trigger);
    expect(await screen.findByTestId('columns-panel')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('columns-panel')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('opens as the standard modal, with a header and a close button', async () => {
    // It was a hand-made 92px panel under the button: the one dialog of the console that was
    // neither centered nor built on the shared modal.
    const user = userEvent.setup();
    renderToggle();
    await user.click(screen.getByRole('button', { name: /choose columns/i }));
    const dialog = await screen.findByRole('dialog', { name: /choose columns/i });
    expect(dialog.querySelector('[data-slot="modal-header"]')).not.toBeNull();
    expect(dialog.contains(screen.getByTestId('columns-panel'))).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByTestId('columns-panel')).toBeNull());
  });

  it('the trigger wires aria-controls + aria-expanded for assistive tech', async () => {
    const user = userEvent.setup();
    renderToggle();
    const trigger = screen.getByRole('button', { name: /choose columns/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });
});
