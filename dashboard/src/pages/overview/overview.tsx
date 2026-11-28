import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  FolderKanban,
  Loader2,
  Plus,
} from 'lucide-react';
import {
  Card,
  EmptyState,
  ProjectCard,
} from '@getloopscale/ui';
import { PageShell } from '@/components/ui/page-shell';
import { ContentGrid } from '@/components/layout';
import { OverviewKPIStrip } from '@/pages/overview/components/overview-kpi-strip';
import { DeploysActivity } from '@/pages/overview/components/deploys-activity';
import { CapabilityGrid } from '@/pages/overview/capability-grid';
import { PlatformSignals } from '@/pages/overview/platform-signals';
import { usePageMeta } from '@/hooks/use-page-meta';
import { useRequireAuth } from '@/hooks/use-auth';
import { useProjects } from '@/hooks/projects/use-projects';
import { CreateProjectSheet } from '@/pages/projects/components/create-project-sheet';
import { useBuildStats } from '@/hooks/overview/use-build-stats';
import { formatDate, isZeroTime } from '@/lib/formatting/format';


/**
 * OverviewPage — mockup-aligned literal implementation per
 * cloud/dashboard/design/loopscale_overview_dashboard_mockup.html (Pattern D-1
 * of plan v1.2). 2-asymmetric grid (1.2fr:1fr) with Usage + Alerts on
 * left, Projects + Recent Previews on right.
 *
 * Usage data sourced from /v1/billing (BillingResponse.usage map) per T-A.2
 * of plan v1.1. Per ADR-D1.bis: limit:null renders "Unlimited" (Enterprise
 * tier). Per EC-6: used>limit renders actual numeric (over-quota visual).
 */
export function OverviewPage() {
  useRequireAuth();
  const { setPageTitle } = usePageMeta();
  const navigate = useNavigate();
  const { projects, loading } = useProjects();
  const deployStats = useBuildStats('7d');
  const [searchQuery, setSearchQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );




  return (
    <PageShell
      title="Overview"
      onTitleChange={setPageTitle}
      search={{
        placeholder: 'Search projects...',
        value: searchQuery,
        onChange: setSearchQuery,
      }}
      primaryAction={{
        label: 'New Project',
        icon: Plus,
        onClick: () => setCreateOpen(true),
      }}
    >
      {/* J-06 T3.1: the KPI strip is the authenticated home's at-a-glance row. */}
      <div className="mb-6">
        <OverviewKPIStrip />
      </div>
      {/* B-112 — a Overview é da PLATAFORMA, e esta seção é o que faz dela isso.
          Antes daqui a tela consumia `useProjects`, `useBuildStats` e billing, e as OITO
          capacidades que o menu declara não apareciam nela: quem chegava concluía, da tela
          inicial, que o produto é um PaaS de deploy. Fica ACIMA do grid de duas colunas de
          propósito — o que a plataforma oferece vem antes do detalhe de um subsistema dela. */}
      <section className="mb-6">
        <h2 className="text-label-caps text-muted-foreground uppercase mb-3 tracking-wider">
          Platform
        </h2>
        <CapabilityGrid />
      </section>
      <ContentGrid columns="2-asymmetric" gap={6}>
        {/* B-125 — a coluna esquerda deixou de ser cotas de cobrança.
            `Usage` gastava 56 linhas com `4/10 projetos` e `145/1.000 builds`: pergunta de
            COBRANÇA numa tela de operação, e `/billing` existe para ela. No lugar entram as duas
            perguntas que nenhuma outra tela do produto responde — "tem algo errado agora?" e
            "quanto os agentes custaram" —, porque cada capacidade só enxerga a si mesma e esta é
            a única superfície de onde elas são respondíveis. */}
        <div className="space-y-6">
          <PlatformSignals />

          {/* T-P1: deploy activity — the "what happened recently" view, from the
              real /api/v1/builds/stats 7-day series (useBuildStats). Pairs with the
              "Deploys (7d)" KPI: the KPI is the count, these bars are the distribution. */}
          <section>
            <h2 className="text-label-caps text-muted-foreground uppercase mb-3 tracking-wider">
              Deploy activity
            </h2>
            <DeploysActivity byDay={deployStats.byDay} loading={deployStats.loading} error={deployStats.error} />
          </section>
        </div>

        {/* Right column — Projects + Recent Previews */}
        <div className="space-y-6">
          <section>
            <h2 className="text-label-caps text-muted-foreground uppercase mb-3 tracking-wider">
              Projects
            </h2>
            {loading ? (
              <Card>
                <Card.Body className="py-8 text-center">
                  <Loader2
                    className="mx-auto size-5 text-muted-foreground animate-spin"
                    aria-label="Loading projects"
                  />
                </Card.Body>
              </Card>
            ) : filteredProjects.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title={searchQuery ? 'No matching projects' : 'Deploy your first project'}
                description={
                  searchQuery ? (
                    <>Try a different search term.</>
                  ) : (
                    <>
                      Run{' '}
                      <code className="bg-muted px-2 py-0.5 rounded font-mono">
                        loopscale project create my-app
                      </code>{' '}
                      in your terminal to connect a repo and ship.
                    </>
                  )
                }
              />
            ) : (
              <div className="space-y-3">
                {filteredProjects.slice(0, 3).map((p) => (
                  <ProjectCard
                    key={p.name}
                    project={{
                      id: p.name,
                      name: p.name,
                      // B-134 — era `branch: 'main'` fixo, com um comentário explicando que era
                      // um placeholder até o payload expor `deploy_branch`. O comentário estava
                      // certo sobre o payload e errado sobre o remédio: um cartão que diz `main`
                      // para um projeto que faz deploy de `develop` não é um default sensato, é
                      // uma afirmação errada com a confiança de uma certa — e quem lê não tem como
                      // saber que aquele campo é um chute.
                      //
                      // Um travessão é a convenção deste repositório para "não sabemos", e ela
                      // custa menos que estar errado. Quando o resumo de projetos expuser
                      // `deploy_branch` (aditivo e não-quebrante), o valor entra aqui.
                      branch: '—',
                      commitSha: '',
                      // Release-aware status (#119, qa-dogfood-cleanup-2026-06-21
                      // T3.2 / ADR-Q2): backend already maps the aggregate
                      // status via pkg/enforcement.MapProjectStatus, exposed
                      // as `last_deploy_status` enum ('live'|'building'|
                      // 'failed'|'idle'|'queued'). Consume it directly rather
                      // than deriving from `last_deploy ? 'live' : 'queued'`
                      // which contradicts the hero/list state when releases
                      // are absent. Fallback 'queued' preserves prior shape
                      // when older backends omit the field.
                      // Map backend ProjectStatus to UI DeploymentStatus enum
                      // @getloopscale/ui@0.13.1 / @getloopscale/loopzero-ui@0.18.0 added
                      // 'idle' to DeploymentStatus — projects that have
                      // never deployed now render with a neutral gray
                      // badge + "Idle" label (vs the prior stopgap that
                      // collapsed 'idle' to 'cancelled'). Distinguishes
                      // from amber-pulsing 'queued' (deploy in progress).
                      // Closes #119 canonical end-to-end (qa-dogfood-
                      // cleanup-2026-06-21).
                      status: (p.last_deploy_status ?? 'idle') as
                        | 'queued'
                        | 'building'
                        | 'live'
                        | 'failed'
                        | 'cancelled'
                        | 'idle',
                      // Zero-time guard (#118 T3.1): backend now serializes
                      // *time.Time omitempty so absent → undefined here;
                      // isZeroTime catches legacy zero-literal regress.
                      // Red Team loop-console#53/#76 closure: previously we
                      // forwarded the raw RFC3339Nano ISO string and let
                      // ProjectCard render it verbatim — producing the
                      // "2026-06-26T14:16:43.712767Z" leak the Red Team
                      // caught. We now humanize via the same canonical
                      // `formatDate(..., 'relative')` helper the /projects
                      // list uses on line 126, so both views render
                      // identical "32 minutes ago"-style copy. Empty
                      // string still routes ProjectCard's internal
                      // null-guard to "Never deployed".
                      lastDeployedAt:
                        !p.last_deploy || isZeroTime(p.last_deploy)
                          ? ''
                          : formatDate(p.last_deploy, 'relative'),
                      framework: p.apps?.[0]?.framework,
                    }}
                    href={`/projects/${p.name}`}
                  />
                ))}
                {/* T-P2: the preview shows the first 3; link to the full list
                    when there are more, carrying the real count. */}
                {filteredProjects.length > 3 ? (
                  <Link
                    to="/projects"
                    className="flex items-center justify-center gap-1.5 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
                  >
                    View all {filteredProjects.length} projects
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
            )}
          </section>

        </div>
      </ContentGrid>
      <CreateProjectSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(p) => navigate(`/projects/${encodeURIComponent(p.name)}`)}
      />
    </PageShell>
  );
}
