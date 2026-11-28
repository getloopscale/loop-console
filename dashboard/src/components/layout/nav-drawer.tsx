import { useEffect, useRef, type ReactNode } from 'react';

interface NavDrawerProps {
  /** Whether the sidebar is over the page. Only matters below the `md` breakpoint. */
  readonly open: boolean;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

/**
 * Where the sidebar lives. From `md` up it is a column of the layout and `open` changes
 * nothing. Below `md` it is off the page until opened, and then slides over it with a scrim
 * behind; the scrim and Escape close it.
 *
 * Closed, the panel is `invisible` on a narrow window, which takes its links out of the tab
 * order as well as out of sight.
 */
export function NavDrawer({ open, onClose, children }: NavDrawerProps) {
  const panel = useRef<HTMLDivElement>(null);
  // Escape closes from wherever the focus is: the control that opened the menu is outside the
  // panel. Opening moves the focus to the first entry, so the keyboard lands in the menu.
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('a[href], button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <>
      {open ? (
        <button
          type="button"
          data-testid="nav-drawer-scrim"
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
        />
      ) : null}
      <div
        ref={panel}
        data-testid="nav-drawer"
        className={`h-full shrink-0 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:shadow-2xl max-md:transition-[translate,visibility] max-md:duration-200 ${
          open ? 'max-md:translate-x-0' : 'max-md:invisible max-md:-translate-x-full'
        }`}
      >
        {children}
      </div>
    </>
  );
}
