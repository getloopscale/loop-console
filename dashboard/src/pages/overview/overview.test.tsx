import { describe, it, expect, vi, beforeEach } from 'vitest';
import { userEvent } from '@testing-library/user-event';
import { render, screen } from '@/test/render';

vi.mock('@/hooks/use-auth', () => ({
  useRequireAuth: () => ({
    active: true,
    identity: { id: 'test', traits: { email: 'u@x.com' } },
  }),
}));

const mockUseProjects = vi.fn();
vi.mock('@/hooks/projects/use-projects', () => ({
  useProjects: () => mockUseProjects(),
}));

const mockUseCloudApi = vi.fn();
vi.mock('@/hooks/use-api', () => ({
  useCloudApi: () => mockUseCloudApi(),
  useEngineApi: () => mockUseCloudApi(),
}));

// T-P1: the deploys-activity + KPI strip read useBuildStats (engineFetch). Mock it
// so the Overview test is deterministic and never hits the network.
const mockUseBuildStats = vi.fn();
vi.mock('@/hooks/overview/use-build-stats', () => ({
  useBuildStats: () => mockUseBuildStats(),
}));

import { AGENT_SERVICES_GROUP_TITLE, MENUS } from '@/components/layout/app-sidebar-menus';
import { OverviewPage } from './overview';

describe('OverviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProjects.mockReturnValue({ projects: [], loading: false, total: 0 });
    // Default: billing returns null (covers fallback path)
    mockUseCloudApi.mockReturnValue({ data: null, loading: false, error: false, isSuccess: true });
    // Default: no deploy activity (deterministic empty state)
    mockUseBuildStats.mockReturnValue({ byDay: [], last7d: 0, total: 0, loading: false, error: false });
  });

  it('creates a project from the Overview, in the same modal as the Projects screen', async () => {
    // The button was "Add New" and only took the user to Projects, where they had to find and
    // click "New Project" again.
    render(<OverviewPage />);
    await userEvent.click(screen.getByRole('button', { name: 'New Project' }));
    const dialog = await screen.findByRole('dialog', { name: 'New project' });
    expect(dialog.querySelector('[data-slot="modal-header"]')).not.toBeNull();
  });


  // B-125 — seis casos de `Usage` saíram DESTE arquivo e entraram em `settings/billing.test.tsx`.
  //
  // Eles travavam um contrato real: o painel ligava as chaves de billing verdadeiras
  // (`projects`, `builds_per_month`, `environments`, `seats`) e não o vocabulário do mockup
  // Vercel. O painel saiu da Overview porque cota é pergunta de COBRANÇA numa tela de operação,
  // e ele gastava 56 linhas com ela.
  //
  // Medido antes de mover, e é o que impediu uma perda silenciosa: `/billing` renderiza toda
  // chave de `billing.usage` dinamicamente, então as quatro já apareciam lá — conferido no
  // navegador, com os mesmos números. Apagar os casos junto com o painel teria deixado o
  // contrato sem guarda em tela nenhuma.

  it('test_overview_no_alerts_section_removed_v12', () => {
    // T-DR-1.1 v1.2: Alerts EmptyState removed (closes P1-1 CC-3 violation).
    // Re-introduce when backend alert engine ships, as inline Alert banner.
    render(<OverviewPage />);
    expect(screen.queryByText('Get alerted for anomalies')).not.toBeInTheDocument();
  });

  it('test_overview_renders_projects_empty_when_no_data', () => {
    mockUseProjects.mockReturnValue({ projects: [], loading: false });
    render(<OverviewPage />);
    // Copy reform v1.2 (audit Section 6 fold): "No projects yet" → "Deploy your first project"
    expect(screen.getByText('Deploy your first project')).toBeInTheDocument();
  });

  it('test_overview_renders_project_cards_when_data_present', () => {
    mockUseProjects.mockReturnValue({
      projects: [
        { name: 'alpha', apps: [], last_deploy: '2026-05-23' },
        { name: 'beta', apps: [], last_deploy: '2026-05-22' },
      ],
      loading: false,
    });
    render(<OverviewPage />);
    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
  });

  it('test_overview_no_recent_previews_section_removed_v12', () => {
    // T-DR-1.1 v1.2: Recent Previews EmptyState removed (closes P1-1 CC-3
    // violation, section ≥240px cortado). Re-introduce when preview list
    // backend endpoint ships, as compact inline list.
    render(<OverviewPage />);
    expect(screen.queryByText('No recent previews')).not.toBeInTheDocument();
  });

  it('test_overview_search_input_filters_projects', async () => {
    mockUseProjects.mockReturnValue({
      projects: [
        { name: 'alpha', apps: [] },
        { name: 'beta', apps: [] },
      ],
      loading: false,
    });
    const user = userEvent.setup();
    render(<OverviewPage />);
    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
    const search = screen.getByPlaceholderText('Search projects...');
    await user.type(search, 'alp');
    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.queryByText('beta')).not.toBeInTheDocument();
  });

  // ---- T-P0: real-key Usage binding ----





  // ---- T-P3: Upgrade is a real link, not a dead badge ----


  // ---- T-P2: projects "View all" affordance ----

  it('test_overview_view_all_projects_link_when_more_than_three', () => {
    mockUseProjects.mockReturnValue({
      projects: [
        { name: 'a', apps: [] },
        { name: 'b', apps: [] },
        { name: 'c', apps: [] },
        { name: 'd', apps: [] },
        { name: 'e', apps: [] },
      ],
      loading: false,
      total: 5,
    });
    render(<OverviewPage />);
    // Only 3 cards shown, plus a "View all" link carrying the real count.
    const viewAll = screen.getByRole('link', { name: /view all 5 projects/i });
    expect(viewAll).toHaveAttribute('href', '/projects');
  });

  it('test_overview_no_view_all_link_with_three_or_fewer', () => {
    mockUseProjects.mockReturnValue({
      projects: [{ name: 'a', apps: [] }, { name: 'b', apps: [] }],
      loading: false,
      total: 2,
    });
    render(<OverviewPage />);
    expect(screen.queryByRole('link', { name: /view all/i })).not.toBeInTheDocument();
  });

  // Red Team loop-console#53/#76 closure: the Overview project card used to
  // pass the raw RFC3339Nano ISO string (e.g. "2026-06-26T14:16:43.712767Z")
  // to ProjectCard.lastDeployedAt, which rendered it verbatim. The
  // /projects list humanizes the same field via formatDate(..., 'relative').
  // The card MUST now render a humanized "X ago" form — never the raw ISO.
  it('overview project card renders humanized relative timestamp (#53/#76)', () => {
    const recent = new Date(Date.now() - 32 * 60 * 1000).toISOString(); // ~32min ago
    mockUseProjects.mockReturnValue({
      projects: [
        {
          name: 'loopzero-example',
          last_deploy: recent,
          last_deploy_status: 'live',
          apps: [],
        },
      ],
      loading: false,
    });
    render(<OverviewPage />);
    // RED #53/#76: the raw ISO MUST NOT appear anywhere.
    expect(screen.queryByText(recent)).not.toBeInTheDocument();
    // RED #53/#76: a relative phrase ("ago" / "yesterday" / "in") MUST
    // render somewhere within the card. The Intl.RelativeTimeFormat
    // English locale always emits these tokens for past times.
    const card = screen
      .getByRole('link', { name: /loopzero-example/i })
      .closest('article, div, section');
    expect(card?.textContent ?? '').toMatch(/ago|yesterday|just now/i);
  });

  it('test_overview_heading_hierarchy_h1_to_h2_no_skip_closes_25', () => {
    // Sprint 3 Phase 5 (#25) v1.1 — WCAG 1.3.1 Info and Relationships.
    // PageShell renders the page h1; section labels (Usage, Projects, Quick
    // actions) must be h2 (not h3 / h4) so AT users navigate unbroken.
    render(<OverviewPage />);
    const headings = screen.getAllByRole('heading');
    const levels = headings.map((h) => parseInt(h.tagName.slice(1), 10));
    // Walk the document order — no step may jump by more than +1.
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeLessThanOrEqual(levels[i - 1] + 1);
    }
    // At least one h2 must exist (the section labels we promoted).
    expect(levels).toContain(2);
  });

  it('a Overview representa a PLATAFORMA, e não só o sistema de aplicações (B-112)', () => {
    // O teste de WIRING. `capability-grid.test.tsx` prova que o grid funciona; este prova que ele
    // está NA TELA — a distinção que o repositório trata como pilar (a) da tríade, e sem a qual um
    // componente correto e nunca montado passa por entregue.
    //
    // Quantificado sobre o registro do menu pelo mesmo motivo de sempre: uma lista escrita aqui
    // passaria verde no dia em que a nona capacidade fosse criada e esquecida.
    render(<OverviewPage />);

    const grupo = MENUS.main?.groups.find((g) => g.title === AGENT_SERVICES_GROUP_TITLE);
    const declaradas = grupo?.items ?? [];
    expect(declaradas.length).toBeGreaterThanOrEqual(8);

    const ausentes = declaradas
      .filter((d) => screen.queryByTestId(`capability-card-${d.path}`) === null)
      .map((d) => d.label);

    expect(ausentes, 'capacidade declarada no menu e ausente da tela inicial').toEqual([]);
  });
});

describe('B-134 — o cartão não afirma uma branch que não leu', () => {
  // B-197 — este bloco vive FORA do `beforeEach` do describe anterior, e passava só porque herdava
  // os valores que aquele `beforeEach` deixava nos mocks. Sob `--sequence.shuffle` ele rodava
  // primeiro e `useBuildStats` devolvia `undefined`. Um teste que depende do que outro deixou não
  // está testando o que diz testar.
  beforeEach(() => {
    mockUseCloudApi.mockReturnValue({ data: null, loading: false, error: false });
    mockUseBuildStats.mockReturnValue({ byDay: [], last7d: 0, total: 0, loading: false, error: false });
  });

  it('mostra um travessão em vez de um "main" plausível e possivelmente errado', async () => {
    // O payload do resumo de projetos não expõe `deploy_branch`, e o cartão preenchia a lacuna com
    // `main` fixo. Para um projeto que faz deploy de `develop`, isso não é um default sensato: é
    // uma afirmação errada com a confiança de uma certa, e quem lê não tem como saber que aquele
    // campo é um chute. O travessão é a convenção deste repositório para "não sabemos".
    mockUseProjects.mockReturnValue({
      projects: [{ name: 'alpha', apps: [], last_deploy: '2026-05-23' }],
      loading: false,
    });
    const { container } = render(<OverviewPage />);

    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(container.textContent ?? '').not.toMatch(/\bmain\b/);
    // B-237 — a asserção acima só verificava a AUSÊNCIA de `main`, e um cartão que deixasse de
    // renderizar a branch por completo — ou a página inteira falhando em montar — passaria igual.
    // O travessão é a convenção deste repositório para "não sabemos", e é ELE que a correção do
    // B-134 promete: dizer que não se sabe, e não calar.
    // Mais de um travessão na página (outras métricas também dizem "não sabemos"); o que importa
    // é que existe ao menos um — a branch parou de ser afirmada sem deixar de ser respondida.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
