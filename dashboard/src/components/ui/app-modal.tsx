import type { ReactNode } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { TriangleAlert, X } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

/**
 * AppModal — the system-wide standardized modal primitive.
 *
 * A traditional CENTERED modal (overlay + centered panel), built directly on
 * `@radix-ui/react-dialog` so it renders correctly regardless of the design system.
 *
 * Why not the `@getloopscale/ui` `Dialog`? The original reason was a bug: in
 * `@getloopscale/ui@0.28.2` `Dialog` and `Sheet` were the SAME object, and `Sheet.Content =
 * <drawer>` ran after `Dialog.Content = <centered>` and clobbered it, so every "dialog"
 * rendered as a right-anchored drawer.
 *
 * THAT BUG IS FIXED. Measured on the installed `@getloopscale/ui@0.35.1`
 * (2026-08-10): `dist/` ships a separate `primitives/dialog/`, and the bundle carries a
 * centered panel (`left-1/2 top-1/2 -translate-x-1/2`) alongside the lateral sheet
 * (`inset-y-0 right-0`). Leaving the old rationale in place would have been a Rule-9
 * justification that stopped being true — the kind of stale claim that outlives its
 * own reason and then defends whatever is there.
 *
 * So what still justifies a local primitive is NOT the bug; it is the width scale below
 * (`AppModalSize`), which is the whole point of this file: "how wide is a modal" has ONE
 * answer in this product. Adopting the upstream `Dialog` would mean either giving that
 * up or re-implementing it on top — a real question, and a separate one. It is filed
 * rather than decided here, because deciding it inside a consolidation plan is how a
 * migration turns into a redesign.
 *
 * Radix still owns focus-trap / focus-restore / ESC / overlay-click and the WAI-ARIA
 * `role="dialog"` + `aria-modal` contract (Rule 9 — Don't Reinvent).
 *
 * Use this instead of `<Dialog.Content>` for every transient action screen — it is the
 * traditional-modal pattern for the whole dashboard (New folder / New page / connect / …).
 *
 * Controlled only: pass `open` + `onClose`. All exits (ESC / overlay / X) call `onClose`.
 */
type AppModalSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Size token → max-width. One width scale instead of an ad-hoc `max-w-*` per call site.
 * Below the `sm` breakpoint the panel is a bottom sheet that spans the screen, whatever
 * its size token.
 */
const SIZE_MAX_WIDTH: Record<AppModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

type AppModalIntent = 'default' | 'destructive';

export interface AppModalProps {
  /** Controlled open state. */
  readonly open: boolean;
  /** Called on every close path (ESC / overlay / close button). */
  readonly onClose: () => void;
  /** The dialog's accessible name — required (Radix warns without a Title). */
  readonly title: ReactNode;
  /** Optional supporting copy under the title. */
  readonly description?: ReactNode;
  /** Width token — defaults to `md`. */
  readonly size?: AppModalSize;
  /**
   * `destructive` puts a warning mark in the header, so the panel says what kind of action
   * it is before the reader reaches the button.
   */
  readonly intent?: AppModalIntent;
  /** An icon for the header. A destructive panel gets its warning mark without one. */
  readonly icon?: ReactNode;
  /**
   * An action is in flight. ESC, the overlay and the close button stop closing the panel:
   * closing in the middle of a request leaves the operator without the answer, and on a
   * delete that answer is the only evidence of what happened.
   */
  readonly busy?: boolean;
  /**
   * Footer actions (e.g. Cancel + primary). Omitted → no footer region.
   *
   * ⚠️ The footer renders as a SIBLING of `children`, not inside it. A `type="submit"`
   * button here is therefore OUTSIDE any `<form>` in the body, and clicking it does
   * nothing — while the screen renders identically. This cost the modal consolidation
   * its most expensive defect; on a destructive confirmation it is the worst possible
   * failure mode, because the operator sees no error either.
   *
   * Give the `<form>` an `id` and the button `form="<id>"` — the native HTML association,
   * already the idiom in `create-project-sheet.tsx`. Enforced over EVERY call site by
   * `modal-primitive.test.ts § "todo botão de enviar dentro de um modal alcança o seu
   * form"`, not by review.
   */
  readonly footer?: ReactNode;
  /** Modal body. */
  readonly children?: ReactNode;
  /** Escape hatch for a rare bespoke width/spacing; merged after the size token. */
  readonly contentClassName?: string;
  /** Escape hatch for a body that manages its own padding (a table, a full-bleed preview). */
  readonly bodyClassName?: string;
  /** Hide the built-in close (X) button (Radix still closes on ESC/overlay). */
  readonly hideCloseButton?: boolean;
  /**
   * A click outside the panel does not close it. For a long form, where a stray click on the
   * overlay would throw the typing away. ESC and the close button still close.
   */
  readonly keepOnOutsideClick?: boolean;
}

/**
 * The layout every modal shares: a header (icon, title, description), a body that scrolls
 * on its own, and a footer bar for the actions. The header and the footer stay in place
 * while a long body scrolls, so the title and the buttons never leave the screen.
 */
export function AppModal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  intent = 'default',
  icon,
  busy = false,
  footer,
  children,
  contentClassName,
  bodyClassName,
  hideCloseButton,
  keepOnOutsideClick = false,
}: AppModalProps) {
  const mark = icon ?? (intent === 'destructive' ? <TriangleAlert className="size-4" aria-hidden="true" /> : null);
  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] animate-modal-overlay" />
        <RadixDialog.Content
          data-intent={intent}
          aria-busy={busy || undefined}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (busy || keepOnOutsideClick) event.preventDefault();
          }}
          className={twMerge(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl animate-modal-in',
            // Phone: a sheet docked to the bottom edge. The `max-sm:` variants sit apart from
            // the base classes, so a call site that sets its own width keeps it on desktop.
            'max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:max-h-[92dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl',
            SIZE_MAX_WIDTH[size],
            contentClassName,
          )}
        >
          <div data-slot="modal-header" className="flex shrink-0 items-start gap-3 px-6 pb-4 pt-5 pr-14">
            {mark ? (
              <span
                data-slot="modal-icon"
                className={twMerge(
                  'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border',
                  intent === 'destructive'
                    ? 'border-destructive/30 bg-destructive/10 text-destructive'
                    : 'border-primary/20 bg-primary/10 text-primary',
                )}
              >
                {mark}
              </span>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <RadixDialog.Title className="text-base font-semibold leading-6 tracking-tight text-foreground">
                {title}
              </RadixDialog.Title>
              {description ? (
                // `asChild` + `<div>`: a descrição é um contêiner, não um parágrafo (B-104).
                //
                // `RadixDialog.Description` renderiza `Primitive.p`, e treze call sites passam
                // bloco nesta prop — `<p><div>…</div></p>`, HTML inválido. `asChild` faz o Radix
                // aplicar o `id` (o alvo do `aria-describedby`) ao elemento que damos, em vez de
                // criar o dele: o contrato de acessibilidade fica idêntico e o aninhamento passa
                // a ser legal.
                //
                // O que NÃO é o motivo, porque foi medido e é falso: a primeira versão do B-104
                // dizia que o parser fecharia o `<p>` e o leitor de tela perderia a descrição.
                // Medido em navegador real, o `aria-describedby` resolvia e o texto estava
                // inteiro — o React monta o DOM por API, não pelo parser. A invalidez é latente,
                // não ativa: ela cobra no dia em que este HTML for PARSEADO (render no servidor,
                // pré-render, hidratação a partir de markup).
                <RadixDialog.Description asChild>
                  <div className="text-body-sm text-muted-foreground">{description}</div>
                </RadixDialog.Description>
              ) : null}
            </div>
          </div>
          {/* `empty:hidden`: a confirmation with no fields has no body, and an empty band
              between the header and the footer would read as content that failed to load. */}
          <div
            data-slot="modal-body"
            className={twMerge('min-h-0 flex-1 overflow-y-auto border-t border-border px-6 py-5 empty:hidden', bodyClassName)}
          >
            {children}
          </div>
          {footer ? (
            <div
              data-slot="modal-footer"
              className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-muted/40 px-6 py-3 sm:flex-row sm:items-center sm:justify-end"
            >
              {footer}
            </div>
          ) : null}
          {!hideCloseButton ? (
            <RadixDialog.Close
              aria-label="Close"
              disabled={busy}
              className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
            >
              <X className="size-4" aria-hidden="true" />
            </RadixDialog.Close>
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
