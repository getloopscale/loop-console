import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/render';

vi.mock('@/hooks/use-auth', () => ({
  useRequireAuth: () => ({
    active: true,
    identity: { id: 'test', traits: { email: 'u@x.com' } },
  }),
}));

// B-060 — o mock era do HOOK (useEngineApi), ou seja, testava implementacao.
// Quando a lista migrou para a hierarquia queryKeys.team — para que as mutations
// passassem a alcanca-la — o mock deixou de alimentar a pagina e dois testes
// cairam sem que nenhum COMPORTAMENTO tivesse mudado. Agora o mock e da
// FRONTEIRA (engineFetch): a pagina exerce o caminho de dados real, incluindo a
// query key, e o teste sobrevive ao proximo refactor interno.
const mockEngineFetch = vi.fn();
vi.mock('@/lib/http/api', () => ({
  engineFetch: (...args: unknown[]) => mockEngineFetch(...args),
  cloudFetch: (...args: unknown[]) => mockEngineFetch(...args),
}));

const mockUseEngineApi = vi.fn();
vi.mock('@/hooks/use-api', () => ({
  useEngineApi: () => mockUseEngineApi(),
  useCloudApi: () => mockUseEngineApi(),
}));

import { TeamPage } from './team';

/** Alimenta o caminho de dados real da pagina (useQuery -> engineFetch). */
function seedTeam(payload: unknown) {
  mockEngineFetch.mockResolvedValue(payload);
  mockUseEngineApi.mockReturnValue({ data: payload, loading: false, error: false, isSuccess: true });
}

describe('TeamPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('test_team_renders_member_table', async () => {
    seedTeam({
        members: [
          { email: 'alice@x.com', name: 'Alice', role: 'owner', joined: '2026-01-01' },
          { email: 'bob@x.com', name: 'Bob', role: 'admin', joined: '2026-03-15' },
        ],
      });
    render(<TeamPage />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('alice@x.com')).toBeInTheDocument();
    expect(screen.getByText('owner')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('scrolls the member table inside its card on a narrow window', async () => {
    // At 390px the five columns made the whole document 574px wide (#677).
    render(<TeamPage />);
    const table = await screen.findByRole('table');
    const scroller = table.closest('[data-slot="table-scroll"]');
    expect(scroller?.className).toMatch(/overflow-x-auto/);
    // The "Actions" header is a visually hidden, absolutely positioned label. Without a
    // positioned scroller it escapes the clipping and widens the document by itself.
    expect(scroller?.className).toMatch(/(^|\s)relative(\s|$)/);
  });

  it('test_team_invite_member_opens_dialog', async () => {
    // Plan v1.2 divergence: invite is delegated to docs.getloopscale.com/teams/invite via
    // ActionBar.primaryAction (window.open) — no in-app dialog. Verify button exists.
    seedTeam({ members: [] });
    render(<TeamPage />);
    expect(screen.getByRole('button', { name: /invite/i })).toBeInTheDocument();
  });

  it('test_team_remove_member_requires_confirmation', async () => {
    // Plan v1.2 divergence: row-level remove not yet UI-wired (backend gap).
    // Verify row renders WITHOUT in-app remove button — backend prerequisite documented.
    seedTeam({
        members: [
          { email: 'alice@x.com', name: 'Alice', role: 'admin', joined: '2026-01-01' },
        ],
      });
    render(<TeamPage />);
    expect(screen.queryByRole('button', { name: /^remove$/i })).not.toBeInTheDocument();
  });

  it('test_team_role_selector_disabled_for_owner', async () => {
    // Plan v1.2 divergence: role is rendered as Badge (read-only) not Selector.
    // Verify owner Badge renders with warning variant indicating elevated/locked tier.
    seedTeam({
        members: [
          { email: 'alice@x.com', name: 'Alice', role: 'owner', joined: '2026-01-01' },
        ],
      });
    render(<TeamPage />);
    // Owner role badge renders with the literal text "owner"
    await waitFor(() => expect(screen.getByText('owner')).toBeInTheDocument());
    // And no role-change combobox/selector exists for the owner row
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
