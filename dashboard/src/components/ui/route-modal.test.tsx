import { describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen } from '@/test/render';
import { RouteModal } from './route-modal';

function Screens() {
  return (
    <Routes>
      <Route path="/things" element={<p>the list of things</p>} />
      <Route
        path="/things/new"
        element={
          <RouteModal title="New thing" backTo="/things">
            <label>
              Name
              <input />
            </label>
          </RouteModal>
        }
      />
    </Routes>
  );
}

describe('RouteModal — a creation route shown as a modal', () => {
  it('opens the form of the route as a wide dialog', () => {
    render(<Screens />, { initialEntries: ['/things/new'] });
    const dialog = screen.getByRole('dialog', { name: 'New thing' });
    expect(dialog.className).toMatch(/max-w-4xl/);
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
  });

  it('goes back to the list when it is closed', () => {
    render(<Screens />, { initialEntries: ['/things/new'] });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByText('the list of things')).toBeInTheDocument();
  });

  it('goes back to the list on Escape', () => {
    render(<Screens />, { initialEntries: ['/things/new'] });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByText('the list of things')).toBeInTheDocument();
  });

  it('stays open on a click outside, so a long form is not lost to a stray click', () => {
    render(<Screens />, { initialEntries: ['/things/new'] });
    fireEvent.pointerDown(document.body);
    expect(screen.getByRole('dialog', { name: 'New thing' })).toBeInTheDocument();
  });
});
