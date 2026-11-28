import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FlaskConical, ShieldCheck } from 'lucide-react';
import { Button, Card, FormField, Textarea } from '@getloopscale/ui';
import { RouteModal } from '@/components/ui/route-modal';

import { GuardrailRuleFields } from '@/pages/trust/components/guardrail-rule-fields';

import { Alert } from '@/components/ui/alert-guard';
import { usePageMeta } from '@/hooks/use-page-meta';
import { useRequireAuth } from '@/hooks/use-auth';
import { useInvalidateTrust } from '@/hooks/trust/use-trust';
import {
  createGuardrail,
  serviceCode,
  serviceMessage,
  testGuardrail,
} from '@/hooks/trust/trust-api';
import {
  EMPTY_DRAFT,
  cleanTerms,
  draftProblems,
  toCreateBody,
  toTestBody,
  verdictSummary,
  visibleFieldProblems,
  type DraftField,
  type DryRunVerdict,
  type GuardrailDraft,
} from '@/pages/trust/components/guardrail-draft';

/**
 * M24 T5.1 — criar uma guardrail, com o teste como PASSAGEM OBRIGATÓRIA.
 *
 * A decisão que define esta tela (ADR D1): **não existe caminho para gravar sem antes testar**.
 * Não é um botão desabilitado nem um aviso — a ação de gravar simplesmente não é renderizada
 * enquanto não houver veredito de dry-run da spec vigente.
 *
 * O prior art mostra o custo de fazer diferente. O Langfuse tem um belo diálogo de revisão com
 * diff… e um botão "Save" ao lado dele, que pula tudo. O PostHog testa a flag numa aba, depois
 * de ela já existir. Nenhum dos dois é modelo aqui, porque o objeto é diferente: uma guardrail
 * errada bloqueia conversa de produção inline, no instante em que é gravada.
 *
 * O veredito é amarrado à SERIALIZAÇÃO da spec testada. Editar qualquer campo o invalida — mas
 * reescrever um campo com o mesmo valor, não. É a diferença entre "testou esta spec" e "clicou
 * em testar em algum momento".
 */
export function TrustGuardrailNewPage() {
  const { setPageTitle } = usePageMeta();
  useEffect(() => setPageTitle('Trust — new guardrail'), [setPageTitle]);
  useRequireAuth();
  const navigate = useNavigate();
  const invalidarTrust = useInvalidateTrust();

  const [draft, setDraft] = useState<GuardrailDraft>(EMPTY_DRAFT);
  const [termsText, setTermsText] = useState('');
  const [sample, setSample] = useState('');
  const [verdict, setVerdict] = useState<DryRunVerdict | null>(null);
  /** A spec exata que foi testada. Enquanto bater com a atual, o veredito vale. */
  const [testedSpec, setTestedSpec] = useState<string | null>(null);
  /** Campos que o operador já visitou — só eles podem acusar erro. */
  const [touched, setTouched] = useState<ReadonlySet<DraftField>>(new Set());
  const markTouched = (field: DraftField) =>
    setTouched((t) => (t.has(field) ? t : new Set(t).add(field)));
  const [busy, setBusy] = useState<'idle' | 'testing' | 'saving'>('idle');
  const [error, setError] = useState<{ title: string; description: string } | null>(null);

  const current: GuardrailDraft = useMemo(
    () => ({ ...draft, terms: termsText.split('\n') }),
    [draft, termsText],
  );

  const problems = draftProblems(current);
  // Só o campo já visitado acusa erro — ver `visibleFieldProblems`.
  const fieldProblems = visibleFieldProblems(current, touched);
  const currentSpec = useMemo(() => JSON.stringify(toCreateBody(current)), [current]);

  // O coração da tela: o veredito só vale para a spec que o produziu.
  const verdictIsCurrent = testedSpec !== null && testedSpec === currentSpec;
  const summary = verdictIsCurrent ? verdictSummary(verdict) : null;

  // `busy` NÃO entra aqui de propósito: durante o save o botão precisa continuar renderizado
  // para mostrar progresso (`DESIGN.md § 2.2`). O que ele não pode é ser clicado de novo —
  // e disso cuida o `disabled` abaixo.
  //
  // `summary` entra porque o DoD pede "mostra o RESULTADO antes de permitir a criação". Se o
  // serviço devolver uma ação que não sabemos traduzir (um `kind` novo, por exemplo),
  // `verdictSummary` responde null — e liberar o salvar ali daria ao operador a impressão de
  // que ele viu um veredito que a tela nunca mostrou. Achado do review do M24.
  const canSave = verdictIsCurrent && summary !== null && problems.length === 0;

  async function onTest() {
    setBusy('testing');
    setError(null);
    try {
      // O `/v1/validators:test` responde `{valid, result:{action, modified}}` — o veredito vem
      // ANINHADO. Ler `action` do topo devolveria sempre `undefined`, e a tela ficaria muda
      // depois de um teste bem-sucedido. Foi o e2e que pegou isto: o teste de unidade passava
      // porque o dobre dele devolvia o formato achatado, e não o do serviço.
      const response = await testGuardrail<{ result?: DryRunVerdict } & DryRunVerdict>(
        toTestBody(current, sample),
      );
      setVerdict(response?.result ?? response ?? null);
      setTestedSpec(currentSpec);
    } catch (err) {
      setVerdict(null);
      setTestedSpec(null);
      setError({
        title: 'The test could not be run',
        description: serviceMessage(err, 'The guardrail was not created and nothing changed in production.'),
      });
    } finally {
      setBusy('idle');
    }
  }

  async function onSave() {
    setBusy('saving');
    setError(null);
    try {
      await createGuardrail(toCreateBody(current));
      // B-052 — invalida o DOMÍNIO, não uma chave literal.
      //
      // Esta linha citava `['cloud', '/v1/dashboard/trust/validators']`, e no
      // instante em que `guardrails.tsx` passou a ler pela factory ela virou uma
      // invalidação de chave que ninguém lê: criar um guardrail deixaria de
      // atualizar a lista. Foi o defeito de árvores disjuntas se recriando em
      // tempo real, por migrar leitor antes de escritor.
      invalidarTrust();
      void navigate('/trust/guardrails');
    } catch (err) {
      const code = serviceCode(err);
      setError({
        title:
          code === 'VALIDATOR_NAME_RESERVED'
            ? 'That name belongs to the platform'
            : code === 'CONFLICT'
              ? 'A guardrail with that name already exists'
              : 'The guardrail was not created',
        // A mensagem do serviço nomeia o campo e o motivo; substituí-la por texto nosso
        // faria o operador tentar de novo exatamente igual.
        description: serviceMessage(err, 'The service refused the creation and nothing changed in production.'),
      });
      setBusy('idle');
    }
  }

  return (
    <RouteModal
      title="New guardrail"
      description="The terms below start being blocked in this workspace conversations as soon as the rule is saved."
      backTo="/trust/guardrails"
      busy={busy === 'saving'}
      footer={
        <Button variant="ghost" asChild>
          <Link to="/trust/guardrails">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to guardrails
          </Link>
        </Button>
      }
    >
      <div className="space-y-6">
      <GuardrailRuleFields
        draft={draft}
        termsText={termsText}
        fieldProblems={fieldProblems}
        onDraftChange={(patch: Partial<GuardrailDraft>) => setDraft((d) => ({ ...d, ...patch }))}
        onTermsTextChange={setTermsText}
        onFieldTouched={markTouched}
      />

      <Card>
        <Card.Header>
          <Card.Title asChild>
            <h2>Test before saving</h2>
          </Card.Title>
          <Card.Description>
            Write a sample message and see what would happen to it. This step changes nothing —
            and it is the way through to saving.
          </Card.Description>
        </Card.Header>

        <Card.Body className="space-y-4">
          <FormField id="guardrail-sample">
            <FormField.Label>Sample message</FormField.Label>
            <FormField.Control>
              <Textarea
                aria-label="Sample message"
                rows={2}
                value={sample}
                placeholder="a message containing one of the terms above"
                onChange={(e) => setSample(e.target.value)}
              />
            </FormField.Control>
          </FormField>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              disabled={problems.length > 0 || busy !== 'idle'}
              onClick={() => void onTest()}
            >
              <FlaskConical className="size-4" />
              {busy === 'testing' ? 'Testing…' : 'Test'}
            </Button>

            {/* Um botão cinza sem motivo faz o operador procurar o que não existe. Os erros por
                campo só aparecem depois que ele visita o campo — correto —, mas isso deixava a
                tela recém-aberta sem pista alguma do que falta. Esta frase é a pista, e não
                acusa nada: descreve o próximo passo. */}
            {problems.length > 0 ? (
              <p className="text-body-sm text-muted-foreground">
                Give it a name and at least one term to be able to test.
              </p>
            ) : null}
          </div>

          {summary ? (
            <div role="status">
              <Alert intent="info" title={summary} />
            </div>
          ) : null}

          {testedSpec !== null && !verdictIsCurrent ? (
            <p className="text-sm text-muted-foreground" role="status">
              The rule changed after the test. Test again to be able to save.
            </p>
          ) : null}
        </Card.Body>
      </Card>

      {error ? (
        <Alert intent="destructive" title={error.title} description={error.description} />
      ) : null}

      {/*
        A ação de gravar NÃO é renderizada sem veredito da spec vigente. Um botão desabilitado
        convidaria a procurar como habilitá-lo; a ausência diz que falta um passo, e o texto
        acima diz qual.
      */}
      {canSave ? (
        <Card>
          <Card.Header>
            <Card.Title asChild>
              <h2>Ativar</h2>
            </Card.Title>
            <Card.Description>
              On save, {cleanTerms(current.terms).length} term(s) take effect immediately in this
              workspace conversations.
            </Card.Description>
          </Card.Header>
          <Card.Footer>
            <Button disabled={busy !== 'idle'} onClick={() => void onSave()}>
              <ShieldCheck className="size-4" />
              {busy === 'saving' ? 'Saving…' : 'Save and activate'}
            </Button>
          </Card.Footer>
        </Card>
      ) : null}
      </div>
    </RouteModal>
  );
}
