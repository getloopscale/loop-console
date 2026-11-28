import { useNavigate } from 'react-router-dom';
import { AppModal, type AppModalProps } from './app-modal';

interface RouteModalProps
  extends Omit<AppModalProps, 'open' | 'onClose' | 'size' | 'keepOnOutsideClick'> {
  /** Where closing the modal goes: the list the form belongs to. */
  readonly backTo: string;
}

/**
 * A creation screen that has a route of its own (`/skills/new`), shown as a modal over the
 * list it came from. The route keeps the screen linkable and keeps the menu entry working;
 * the modal makes it look and close like every other creation in the console.
 *
 * It is open while the route is the current one, and closing it navigates to `backTo`. A click
 * outside does not close it: these forms are long.
 */
export function RouteModal({ backTo, ...modal }: RouteModalProps) {
  const navigate = useNavigate();
  return <AppModal open onClose={() => void navigate(backTo)} size="xl" keepOnOutsideClick {...modal} />;
}
