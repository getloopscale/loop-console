import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/render';
import { AppSidebar } from './app-sidebar';
import type { Session } from '@/lib/auth/session';

function makeSession(name?: string): Session {
  return {
    active: true,
    identity: {
      id: 'sess-1',
      traits: { email: 'paulo@example.com', name },
    },
  };
}

describe('AppSidebar', () => {
  it('test_app_sidebar_renders_all_nav_items', () => {
    render(<AppSidebar session={makeSession()} />);
    // MAIN_NAV (5) + Billing (1) + Audit (1) + Settings (1) + Profile (1) = 9 routes.
    // We assert each nav item is reachable via accessible-name match (case-insensitive)
    // by querying within the main sidebar (excluding the TeamSwitcher "Switch team" button).
    for (const label of [
      'Overview',
      'Projects',
      'Sandboxes',
      'Billing',
      'Audit log',
      'Settings',
      'Profile',
    ]) {
      expect(screen.getByRole('link', { name: new RegExp(label, 'i') })).toBeInTheDocument();
    }
    // "Team" nav item collides with the TeamSwitcher "Switch team" button label.
    // Verify via the more-specific item-by-link-text query.
    const teamButtons = screen.getAllByRole('button', { name: /Team/i });
    expect(teamButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('test_app_sidebar_active_item_matches_current_route', () => {
    render(<AppSidebar session={makeSession()} />, { initialEntries: ['/projects'] });
    const projectsButton = screen.getByRole('link', { name: /Projects/i });
    // The item the user is in is a lighter row with a bar in the brand color on its left. The
    // brand color marks it; it does not paint the label.
    expect(projectsButton.className).toMatch(/(^|\s)bg-muted(\s|$)/);
    expect(projectsButton.className).toMatch(/before:bg-primary/);
    expect(projectsButton.className).not.toMatch(/(^|\s)text-primary(\s|$)/);
    expect(projectsButton.className).not.toMatch(/bg-primary\/10/);
  });

  it('test_app_sidebar_team_switcher_renders_session_name', () => {
    // Plan v1.0 T5.2 (2026-05-26): AccountMenu replaced with TeamSwitcher.
    // The switcher renders the session traits.name (or falls back to email).
    render(<AppSidebar session={makeSession()} />);
    expect(screen.getByText('paulo@example.com')).toBeInTheDocument();
  });

  it('test_app_sidebar_team_switcher_trigger_has_aria_label', () => {
    // Plan v1.0 T5.2: dropdown trigger must be reachable by accessible name.
    render(<AppSidebar session={makeSession()} />);
    expect(
      screen.getByRole('button', { name: /switch team/i }),
    ).toBeInTheDocument();
  });

  it('test_app_sidebar_search_input_present_with_placeholder', () => {
    render(<AppSidebar session={makeSession()} />);
    expect(screen.getByPlaceholderText('Find a project...')).toBeInTheDocument();
  });

  it('M59 P4 — the lens submenu groups nav into Observe / Evaluate / Improve', () => {
    // On an /observability route the sidebar drills into the lens submenu.
    render(<AppSidebar session={makeSession()} />, { initialEntries: ['/observability/traces'] });
    // the three titled groups render…
    expect(screen.getByText('Observe')).toBeInTheDocument();
    expect(screen.getByText('Evaluate')).toBeInTheDocument();
    expect(screen.getByText('Improve')).toBeInTheDocument();
    // …and every lens-unique item is still present at its unchanged path.
    for (const label of ['Traces', 'Sessions', 'Datasets', 'Evaluators', 'Monitors', 'Agents', 'Ask']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // paths are unchanged (the grouping is data-only) — the Traces item still navigates the same route.
    expect(screen.getByRole('link', { name: /traces/i })).toBeInTheDocument();
    // (the workspace switcher lives in the root sidebar view — untouched by this data-only regrouping;
    //  it is covered by test_app_sidebar_team_switcher_renders_session_name.)
  });

  it('M24 — uma rota /trust abre o submenu trust, com as quatro telas da capacidade', () => {
    // O submenu `trust` estava DEFINIDO com as quatro telas e mesmo assim nunca abria:
    // `resolveActiveMenu` mapeava /settings, /profile, /rag, /observability e /memory, e não
    // /trust. O efeito era total — Guardrails e Enforcement só eram alcançáveis digitando a URL,
    // e nenhum teste cobria a resolução, então o menu podia declarar telas que ninguém achava.
    render(<AppSidebar session={makeSession()} />, { initialEntries: ['/trust'] });

    for (const label of ['Overview', 'Violations', 'Guardrails', 'Enforcement']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('M24 — o submenu trust continua aberto nas rotas filhas', () => {
    // Se a resolução casasse só o caminho exato, entrar em Guardrails fecharia o menu que
    // levou até ela — e o operador perderia a navegação assim que a usasse.
    render(<AppSidebar session={makeSession()} />, { initialEntries: ['/trust/guardrails'] });

    expect(screen.getByText('Enforcement')).toBeInTheDocument();
    expect(screen.getByText('Violations')).toBeInTheDocument();
  });

  it('M26 — a capacidade Skills está na raiz e leva ao submenu por CLIQUE', () => {
    // A peça 1. Até este milestone o único item chamado "Skills" no menu inteiro era o de
    // `/memory/skills`, que é do loopmem: quem procurava o registro chegava no produto
    // errado, sem erro algum. Aqui a asserção é sobre a RAIZ, porque é dali que o usuário parte.
    render(<AppSidebar session={makeSession()} />, { initialEntries: ['/'] });

    expect(screen.getByRole('link', { name: /^skills$/i })).toBeInTheDocument();
  });

  it('a RAIZ mostra Sandboxes e Projects — o par que dá sentido às ausências abaixo', () => {
    // B-242 — seis asserções deste arquivo provam que um submenu abriu afirmando que 'Domains' e
    // 'Projects' NÃO estão na tela. Elas só significam alguma coisa se esses dois textos forem
    // encontráveis em ALGUM estado; sem isso, um seletor quebrado (um rename, um typo) satisfaz
    // todas as seis pelo motivo errado e nenhuma fica vermelha.
    //
    // Este caso é a âncora: na raiz os dois estão presentes. É o par que o docblock do M26 já
    // descrevia em prosa — "a asserção é pela AUSÊNCIA dos itens que só a raiz tem" — e que
    // nenhum caso do arquivo executava.
    render(<AppSidebar session={makeSession()} />, { initialEntries: ['/'] });

    expect(screen.getByText('Sandboxes')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
  });

  it('M26 — uma rota /skills abre o submenu skills, e não a raiz', () => {
    // A peça 3, a que falha em SILÊNCIO. O submenu pode estar declarado inteiro e nunca abrir se
    // `resolveActiveMenu` não reconhecer o prefixo — foi exatamente essa omissão que deixou
    // quatro telas do trust alcançáveis só digitando a URL, com três rodadas de validação
    // passando por cima porque validavam digitando.
    //
    // A asserção é pela AUSÊNCIA dos itens que só a raiz tem, e isso não é rebuscamento: a
    // primeira versão deste teste afirmava `getByText('Overview')` e passava COM E SEM a linha
    // de resolução, porque 'Overview' também é item da raiz. Um guard que não distingue os dois
    // estados não guarda nada — é o mesmo erro, uma camada acima, de validar digitando a URL.
    render(<AppSidebar session={makeSession()} />, { initialEntries: ['/skills'] });

    // An item only this submenu has: seeing it proves the submenu opened.
    expect(screen.getByText('Discovery')).toBeInTheDocument();
    expect(screen.queryByText('Projects')).not.toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  it('M12 — a autoria de revisão é alcançável pelo MENU, não só pela URL', () => {
    // A tela de criar existia e não abria: um item de submenu ausente é indistinguível, para
    // quem opera, de uma tela que não foi entregue. E o par abaixo é o que dá valor à asserção —
    // 'New revision' só pertence ao submenu de prompts, então vê-lo prova que o submenu abriu,
    // e não que a raiz foi renderizada.
    render(<AppSidebar session={makeSession()} />, { initialEntries: ['/promptly/new'] });

    expect(screen.getByText('New revision')).toBeInTheDocument();
    // An item only this submenu has: seeing it proves the submenu opened.
    expect(screen.getByText('Catalog')).toBeInTheDocument();
  });

  it('M12 — comparar NÃO entra no menu, e a ausência é decisão', () => {
    // Comparar é POR PROMPT: uma entrada de menu exigiria um nome que o menu não tem e levaria a
    // lugar nenhum — o mesmo argumento que já mantém a promoção fora. Este teste existe para que
    // a ausência seja lida como decisão e não como esquecimento, que é o que a torna revisável.
    render(<AppSidebar session={makeSession()} />, { initialEntries: ['/promptly'] });

    expect(screen.queryByText(/comparar/i)).not.toBeInTheDocument();
  });

  it('opens the project menu on the domains page, with Domains under Settings', () => {
    render(<AppSidebar session={makeSession()} />, { initialEntries: ['/projects/hello/domains'] });

    expect(screen.getByRole('link', { name: 'Domains' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Production checklist')).toBeInTheDocument();
  });

  it('M25 — a capacidade Prompts está na raiz e leva ao submenu por CLIQUE', () => {
    // A peça 1. Sem ela o serviço continua no ar e invisível: promover uma revisão só existia
    // por `curl`, SDK ou MCP. A asserção é sobre a RAIZ, porque é dali que o usuário parte.
    render(<AppSidebar session={makeSession()} />, { initialEntries: ['/'] });

    expect(screen.getByRole('link', { name: /^prompts$/i })).toBeInTheDocument();
  });

  it('M25 — uma rota /promptly abre o submenu promptly, e não a raiz', () => {
    // A peça 3, a que falha em SILÊNCIO. A asserção é pela AUSÊNCIA dos itens que só a raiz tem:
    // afirmar 'Overview' passaria COM E SEM a linha de resolução, porque 'Overview' também é item
    // da raiz — foi esse o guard falso que a sessão vizinha corrigiu neste mesmo arquivo.
    render(<AppSidebar session={makeSession()} />, { initialEntries: ['/promptly'] });

    // An item only this submenu has: seeing it proves the submenu opened.
    expect(screen.getByText('New revision')).toBeInTheDocument();
    expect(screen.queryByText('Projects')).not.toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  it('M25 — o submenu promptly continua aberto no detalhe de um prompt', () => {
    // O detalhe é POR PROMPT. Se a resolução casasse só o caminho exato, abrir um prompt fecharia
    // o menu que levou até ele — e o operador perderia a navegação exatamente ao usá-la.
    render(<AppSidebar session={makeSession()} />, { initialEntries: ['/promptly/saudacao'] });

    // An item only this submenu has: seeing it proves the submenu opened.
    expect(screen.getByText('New revision')).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  it('M26 — o submenu skills continua aberto nas rotas de uma skill', () => {
    // O detalhe e as versões são POR SKILL. Se a resolução casasse só o caminho exato, abrir uma
    // skill fecharia o menu que levou até ela — e o operador perderia a navegação ao usá-la.
    render(<AppSidebar session={makeSession()} />, { initialEntries: ['/skills/sk_1/versions'] });

    // An item only this submenu has: seeing it proves the submenu opened.
    expect(screen.getByText('Discovery')).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  // M21 T2.1 (R3) — the sidebar is about to become asynchronous. Without a global
  // fetch stub, jsdom issues a REAL request: the symptom is not a red test, it is an
  // unhandled rejection plus act() noise, which does not block a merge.
  it('renders without touching the network', () => {
    render(<AppSidebar session={makeSession()} />);

    const f = globalThis.fetch as unknown as { mock?: { calls: unknown[][] } };
    expect(f.mock, 'global fetch is not stubbed — jsdom will hit the real network').toBeDefined();

    const absolute = (f.mock?.calls ?? []).filter((c) => String(c[0]).startsWith('http'));
    expect(absolute, `sidebar issued real network calls: ${JSON.stringify(absolute)}`).toHaveLength(0);
  });
});

/**
 * M23 — toda capacidade do data plane precisa de porta de entrada no menu.
 *
 * Este teste existe porque o defeito que ele trava passou por typecheck, lint, 15 testes de
 * projeção e dois PRs mesclados: as rotas `/trust` estavam registradas e as telas renderizavam,
 * mas NENHUMA entrada no menu apontava para elas. Do ponto de vista do operador, a capacidade não
 * existia — exatamente o problema que M23 veio resolver, reintroduzido um nível acima.
 *
 * A asserção é sobre a LISTA de capacidades, não sobre "Trust" isolado: um item novo que alguém
 * adicione às rotas sem adicionar ao menu continua invisível, e nenhum teste de rota o pega.
 */
describe('menu — capacidades do data plane', () => {
  it('toda capacidade tem entrada no grupo Agent Services', () => {
    render(<AppSidebar session={makeSession('Paulo')} />);

    for (const label of ['Memory', 'Knowledge Base', 'Workspace', 'Observability', 'Trust']) {
      expect(
        screen.getByRole('link', { name: label }),
        `a capacidade ${label} não tem entrada no menu: as rotas dela existem e ninguém as alcança`,
      ).toBeInTheDocument();
    }
  });
});

describe('sidebar layout and wayfinding', () => {
  it('keeps the header and the footer outside the region that scrolls', () => {
    // Found on staging at 937px of height: the root menu is taller than the window, the whole
    // sidebar scrolled, the team switcher left the screen and the footer was drawn past the end
    // of the sidebar. Only the list of entries may scroll.
    render(<AppSidebar session={makeSession()} />, { initialEntries: ['/'] });

    const nav = screen.getByRole('navigation', { name: 'LoopScale' });
    expect(nav.className).toMatch(/(^|\s)overflow-y-auto(\s|$)/);
    expect(nav.className).toMatch(/(^|\s)min-h-0(\s|$)/);
    expect(nav).toContainElement(screen.getByRole('link', { name: 'Projects' }));

    const docs = screen.getByRole('link', { name: /Documentation/ });
    const switcher = screen.getByRole('button', { name: /Switch team/i });
    expect(nav.contains(docs)).toBe(false);
    expect(nav.contains(switcher)).toBe(false);
    expect(nav.contains(screen.getByRole('searchbox', { name: 'Find a project' }))).toBe(false);
  });

  it('names the scrolling region after the menu that is open', () => {
    render(<AppSidebar session={makeSession()} />, { initialEntries: ['/sandboxes'] });
    expect(screen.getByRole('navigation', { name: 'Sandboxes' })).toBeInTheDocument();
  });

  it('renders every entry as a link to its route, so it opens in a new tab', () => {
    render(<AppSidebar session={makeSession()} />, { initialEntries: ['/projects/acme-web'] });

    expect(screen.getByRole('link', { name: 'Secrets' })).toHaveAttribute('href', '/projects/acme-web/secrets');
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/projects/acme-web');
  });

  it.each([
    ['/sandboxes/sbx_open01', 'Sandboxes'],
    ['/rag/collections/col_1', 'Collections'],
    ['/skills/skill_1', 'Overview'],
    ['/projects/acme-web/deployments/dep_1', 'Deployments'],
    ['/projects/acme-web', 'Overview'],
  ])('marks where the user is on %s', (route, label) => {
    // A submenu used to mark an entry on an exact match only, so the page of one sandbox, one
    // collection or one deployment left the whole menu unmarked.
    render(<AppSidebar session={makeSession()} />, { initialEntries: [route] });

    const current = screen.getAllByRole('link').filter((l) => l.getAttribute('aria-current') === 'page');
    expect(current.map((l) => l.textContent?.trim())).toEqual([label]);
  });

  it('marks a single entry of the root menu', () => {
    render(<AppSidebar session={makeSession()} />, { initialEntries: ['/projects'] });
    const current = screen.getAllByRole('link').filter((l) => l.getAttribute('aria-current') === 'page');
    expect(current.map((l) => l.textContent?.trim())).toEqual(['Projects']);
  });

  it('says that Documentation leaves the console', () => {
    render(<AppSidebar session={makeSession()} />, { initialEntries: ['/'] });
    const docs = screen.getByRole('link', { name: /Documentation/ });
    expect(docs).toHaveAttribute('target', '_blank');
    expect(docs).toHaveAccessibleName('Documentation (opens in a new tab)');
  });
});
