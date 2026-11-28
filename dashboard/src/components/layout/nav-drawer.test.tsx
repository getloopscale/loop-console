import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@/test/render';
import { NavDrawer } from './nav-drawer';

describe('NavDrawer — the sidebar on a narrow window', () => {
  it('keeps the sidebar off the page until it is opened', () => {
    // On a phone the sidebar took 256 of 390 pixels at all times, with no way to put it away.
    render(<NavDrawer open={false} onClose={() => {}}><a href="/x">Projects</a></NavDrawer>);
    const panel = screen.getByTestId('nav-drawer');
    expect(panel.className).toMatch(/max-md:-translate-x-full/);
    expect(panel.className).toMatch(/max-md:invisible/);
    expect(document.querySelector('[data-testid="nav-drawer-scrim"]')).toBeNull();
  });

  it('slides the sidebar over the page when open, with a scrim behind it', () => {
    render(<NavDrawer open onClose={() => {}}><a href="/x">Projects</a></NavDrawer>);
    const panel = screen.getByTestId('nav-drawer');
    expect(panel.className).toMatch(/max-md:translate-x-0/);
    expect(panel.className).not.toMatch(/max-md:invisible/);
    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();
  });

  it('closes on the scrim and on Escape', () => {
    const onClose = vi.fn();
    render(<NavDrawer open onClose={onClose}><a href="/x">Projects</a></NavDrawer>);
    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    // Escape reaches the drawer from outside it: the control that opened it is in the top bar.
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('moves the focus into the menu when it opens', () => {
    render(<NavDrawer open onClose={() => {}}><a href="/x">Projects</a></NavDrawer>);
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveFocus();
  });

  it('takes its place in the layout from the md breakpoint up', () => {
    render(<NavDrawer open={false} onClose={() => {}}><a href="/x">Projects</a></NavDrawer>);
    const classes = screen.getByTestId('nav-drawer').className.split(/\s+/);
    // Every class that moves or hides the panel is scoped to narrow windows.
    expect(classes.filter((c) => /fixed|translate|invisible|z-40/.test(c)).every((c) => c.startsWith('max-md:'))).toBe(true);
  });
});
