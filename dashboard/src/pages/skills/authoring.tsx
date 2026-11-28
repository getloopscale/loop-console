import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Badge, Button, Card, Input } from '@getloopscale/ui';
import { RouteModal } from '@/components/ui/route-modal';

import { Alert } from '@/components/ui/alert-guard';
import { faseDaOperacao } from '@/pages/skills/components/operation-state';
import { evaluateFile, toBase64 } from '@/hooks/skills/skill-upload';
import { usePageMeta } from '@/hooks/use-page-meta';
import { useRequireAuth } from '@/hooks/use-auth';
import { useSkillOperation } from '@/hooks/skills/use-skills';
import {
  createSkill,
  createSkillFromZip,
  diagnoseDiscoverability,
  promotionRefusal,
  validateSkill,
  validationDiagnostic,
} from '@/hooks/skills/skills-api';

/**
 * M31 — `/skills/new`: escrever uma skill sem publicar às cegas.
 *
 * O M30 entregou a API da autoria e ela ficou **sem consumidor**: `POST /v1/skills:validate` valida
 * sem efeito colateral e o erro traz `field` e `line` — e nada disso alcançava um autor, porque não
 * havia tela de autoria.
 *
 * A jornada é: escrever → **validar** (sem publicar) → corrigir com o erro posicionado → publicar
 * **acompanhando a operação** → testar a descoberta. O último passo importa: publicar e voltar à
 * lista deixaria o autor sem saber se a skill é encontrável, que é a única coisa que ele quer saber.
 */

/**
 * O exemplo que o autor encontra ao abrir a tela — e, por isso, o que ele imita.
 *
 * A `description` diz **quando** usar a skill, não só o que ela é. Não é estilo: é exatamente o
 * que o diagnóstico de descobribilidade cobra logo abaixo, e é o que a busca por intenção compara.
 * Um modelo que falhasse o próprio diagnóstico do produto ensinaria o hábito errado na primeira
 * tela que o autor vê.
 */
const MODELO = `---
name: convert-currency
description: Converts a foreign-currency amount into BRL using the day's official rate. Use it when the user gives an amount in another currency and needs the value in reais.
category: finance
execution: remote
---

# Convert currency

When the user asks to convert an amount from another currency, use the official
rate for the day and state which rate you used.
`;

interface ValidacaoOk {
  readonly ok: boolean;
  readonly name?: string;
  readonly description?: string;
  readonly execution?: string;
}

interface Diagnostico {
  readonly discoverable: boolean;
  readonly causes: string[];
  readonly hints: string[];
  readonly embedder: string;
}

interface OperacaoEstado {
  readonly operation_id: string;
  readonly state?: string;
  readonly error?: string | null;
}

export function SkillAuthoringPage() {
  const { setPageTitle } = usePageMeta();
  useEffect(() => setPageTitle('New skill'), [setPageTitle]);
  useRequireAuth();

  const [skillId, setSkillId] = useState('');
  const [content, setConteudo] = useState(MODELO);
  const [diagnostico, setDiagnostico] = useState<{ message: string; field?: string; line?: number } | null>(null);
  const [validada, setValidada] = useState<ValidacaoOk | null>(null);
  const [operacaoId, setOperacaoId] = useState<string | null>(null);
  const [erroPublicacao, setErroPublicacao] = useState<string | null>(null);

  const validar = useMutation({
    mutationFn: () => validateSkill<ValidacaoOk>(content),
    onSuccess: (data) => {
      setDiagnostico(null);
      setValidada(data);
    },
    onError: (err) => {
      setValidada(null);
      // O diagnóstico POSICIONADO — sem `field`/`line` o autor lê "inválido" e procura o problema
      // no texto inteiro.
      setDiagnostico(validationDiagnostic(err));
    },
  });

  // M34 — o diagnóstico roda ANTES de publicar, no mesmo lugar onde `:validate` já responde.
  // Depois de publicar, corrigir a descrição custa uma revisão nova; aqui o texto ainda está na
  // mão do autor.
  const [achabilidade, setAchabilidade] = useState<Diagnostico | null>(null);

  // A skill como ÁRVORE de arquivos — o caso que o textarea não representa.
  //
  // Uma skill com script (Python, Bash) ou `assets/` não cabe num markdown só. O registro sempre
  // aceitou o zip; a tela é que não tinha o caminho, e por isso publicar uma skill com script
  // exigia terminal.
  const [zip, setZip] = useState<{ readonly name: string; readonly base64: string } | null>(null);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);

  const diagnosticar = useMutation({
    mutationFn: () =>
      diagnoseDiscoverability<Diagnostico>(
        validada?.name ?? '',
        validada?.description ?? '',
        // Um rascunho ainda não publicado NÃO tem vetor — e isso não é defeito dele.
        //
        // O comentário acima já estava aqui, e a linha abaixo dele dizia `false`, que faz o
        // serviço acusar exatamente disso. `no_embedding` disparava sempre e ENCOBRIA as causas
        // que o autor pode corrigir agora: descrição genérica e colisão com uma vizinha
        // (loopskills#144).
        //
        // `{ publicada: false }` omite o campo, e a ausência é o que diz ao serviço que a
        // pergunta é "minha descrição está boa?", não "por que não me acham?".
        { publicada: false },
      ),
    onSuccess: (d) => setAchabilidade(d),
    onError: () => setAchabilidade(null),
  });

  const publicar = useMutation({
    // Zip e markdown são EXCLUDENTES. O registro prioriza `skillMd` quando os dois chegam, e
    // descartaria os scripts em silêncio — a skill entraria no acervo incompleta, com 202 e sem
    // erro algum. O BFF recusa esse par; aqui a tela escolhe uma fonte só.
    mutationFn: () =>
      zip !== null
        ? createSkillFromZip<{ operation_id?: string }>(skillId.trim(), zip.base64)
        : createSkill<{ operation_id?: string }>(skillId.trim(), content),
    onSuccess: (data) => {
      setErroPublicacao(null);
      setOperacaoId(typeof data?.operation_id === 'string' ? data.operation_id : null);
    },
    onError: (err) => setErroPublicacao(promotionRefusal(err, 'Could not publish.')),
  });

  // ACOMPANHA a operação em vez de anunciar sucesso no 202 — que significa "aceito", não "pronto".
  // Anunciar no aceite faria o autor procurar a skill num acervo onde ela ainda não está.
  // B-052 — chave da factory. O `refetchInterval` continua sendo a FUNCAO do
  // estado, que e o que para o polling num estado terminal.
  const operacao = useSkillOperation<OperacaoEstado>(operacaoId ?? undefined, {
    refetchInterval: (q) => {
      const fase = faseDaOperacao((q.state.data as OperacaoEstado | undefined)?.state);
      // Para de sondar em estado TERMINAL. Sem isto o polling seguiria para sempre numa aba
      // esquecida aberta, custando requisição por segundo sem ninguém lendo — que foi
      // exatamente o que aconteceu enquanto a comparação usava um vocabulário inexistente.
      return fase === 'concluida' || fase === 'falhou' ? false : 1500;
    },
  });

  // A fase vem de uma função PURA e testada, não de comparações inline: enquanto elas viviam
  // aqui dentro, nenhum teste as alcançava e o vocabulário errado (`'succeeded'`/`'failed'`,
  // que o registro nunca emite) sobreviveu até ser publicado de verdade no app-dev.
  const fase = faseDaOperacao(operacao.data?.state);
  const estado = operacao.data?.state;
  const concluida = fase === 'concluida';
  const failed = fase === 'falhou';

  return (
    <RouteModal
      title="New skill"
      description="Write it, validate without publishing, and publish while watching the operation."
      backTo="/skills"
      footer={
        <Button variant="ghost" asChild>
          <Link to="/skills">Back to the registry</Link>
        </Button>
      }
    >
      <div className="space-y-6">

      {erroPublicacao !== null ? (
        <Alert intent="destructive" title="The skill was not published" description={erroPublicacao} />
      ) : null}

      {diagnostico !== null ? (
        <Alert
          intent="destructive"
          title="The content has a problem"
          description={
            <>
              {diagnostico.message}
              {/* A POSIÇÃO é o que distingue um diagnóstico de um "inválido". */}
              {diagnostico.field !== undefined || diagnostico.line !== undefined ? (
                <span className="mt-1 block font-mono text-xs">
                  {diagnostico.field !== undefined ? `field: ${diagnostico.field}` : null}
                  {diagnostico.field !== undefined && diagnostico.line !== undefined ? ' · ' : null}
                  {diagnostico.line !== undefined ? `line ${diagnostico.line}` : null}
                </span>
              ) : null}
            </>
          }
        />
      ) : null}

      {validada !== null && operacaoId === null ? (
        <Alert
          intent="success"
          title="Valid content — nothing published yet"
          description={
            <>
              Read as <strong>{validada.name}</strong>
              {validada.execution ? (
                <>
                  {' '}
                  · execution <Badge variant="outline">{validada.execution}</Badge>
                </>
              ) : null}
              . Give it an identifier below and publish.
            </>
          }
        />
      ) : null}

      <Card>
        <Card.Header>
          <Card.Title asChild>
            <h2>Content</h2>
          </Card.Title>
          <Card.Description>
            The <code className="font-mono text-xs">SKILL.md</code> — frontmatter with{' '}
            <code className="font-mono text-xs">name</code> and{' '}
            <code className="font-mono text-xs">description</code>, plus the instruction the agent
            will load.
          </Card.Description>
        </Card.Header>
        <div className="flex flex-col gap-3 px-6 pb-6">
          <textarea
            aria-label="Skill content"
            className="min-h-64 w-full rounded-md border bg-background p-3 font-mono text-xs"
            value={content}
            onChange={(e) => {
              setConteudo(e.target.value);
              // Editar invalida a validação anterior: exibir "válido" sobre um texto que mudou
              // afirmaria algo que ninguém verificou.
              setValidada(null);
              setDiagnostico(null);
              // O diagnóstico de achabilidade também morre: ele foi feito sobre o texto anterior,
              // e exibi-lo ao lado de um texto novo afirmaria algo que ninguém mediu.
              setAchabilidade(null);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => validar.mutate()} disabled={validar.isPending}>
              {validar.isPending ? 'Validating…' : 'Validate without publishing'}
            </Button>
            <span className="text-xs text-muted-foreground">
              Validating creates nothing — it is safe to repeat as often as you like.
            </span>
          </div>
        </div>
      </Card>

      {validada !== null && operacaoId === null ? (
        <Card>
          <Card.Header>
            <Card.Title asChild>
              <h2>Will it be found?</h2>
            </Card.Title>
            <Card.Description>
              Valid is not the same as findable. This diagnosis compares the skill against the
              registry — and <strong>does not run it</strong>.
            </Card.Description>
          </Card.Header>
          <div className="flex flex-col gap-3 px-6 pb-6">
            <div>
              <Button
                variant="secondary"
                onClick={() => diagnosticar.mutate()}
                disabled={diagnosticar.isPending}
              >
                {diagnosticar.isPending ? 'Diagnosing…' : 'Diagnose discoverability'}
              </Button>
            </div>

            {achabilidade !== null ? (
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant={achabilidade.discoverable ? 'success' : 'warning'}>
                    {achabilidade.discoverable ? 'seria encontrada' : 'dificilmente encontrada'}
                  </Badge>
                  {/* O EMBEDDER viaja no resultado: o número mede o embedder tanto quanto a
                      skill, e sem esse dado alguém compara resultados incomparáveis. */}
                  <span className="font-mono text-xs text-muted-foreground">{achabilidade.embedder}</span>
                </div>
                {/* As CAUSAS com o que fazer — um diagnóstico sem próximo passo é um número
                    com nome bonito. */}
                {achabilidade.hints.map((h) => (
                  <p key={h} className="text-muted-foreground">
                    {h}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* A skill como ÁRVORE de arquivos.

          Uma skill de verdade costuma carregar mais que um markdown: um script Python que ela
          executa, um `assets/`, um `reference/`. O registro sempre aceitou isso — a CLI publica
          um zip desde o M12 — mas a TELA só tinha textarea, então quem escrevia uma skill com
          script precisava de terminal para publicá-la. A assimetria era da superfície, não do
          contrato. */}
      <Card>
        <Card.Header>
          <Card.Title asChild>
            <h2>Skill with scripts</h2>
          </Card.Title>
          <Card.Description>
            If the skill is a folder — <code className="font-mono text-xs">SKILL.md</code> plus
            Python/Bash scripts, assets, references — zip that folder and upload it here instead of
            pasting the content above.
          </Card.Description>
        </Card.Header>
        <div className="flex flex-col gap-3 px-6 pb-6">
          <input
            type="file"
            accept=".zip,application/zip"
            aria-label="Skill folder as a .zip"
            className="text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              // Sem arquivo é LIMPAR, não erro: o autor desistiu do zip e volta ao markdown.
              if (file === null) {
                setZip(null);
                setErroArquivo(null);
                return;
              }
              const veredito = evaluateFile(file);
              if (!veredito.aceito) {
                setZip(null);
                setErroArquivo(veredito.reason);
                return;
              }
              void file.arrayBuffer().then((buffer) => {
                setZip({ name: veredito.name, base64: toBase64(buffer) });
                setErroArquivo(null);
                // Outro arquivo é outra publicação — mesmo motivo do identificador acima.
                setOperacaoId(null);
                setErroPublicacao(null);
              });
            }}
          />
          {erroArquivo !== null ? (
            <Alert intent="destructive" title="This file cannot be uploaded" description={erroArquivo} />
          ) : null}
          {zip !== null ? (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p>
                Publishing <strong>{zip.name}</strong> — the content typed above will be ignored.
              </p>
              {/* Honestidade sobre o que NÃO acontece: `:validate` recebe markdown, não zip. Dizer
                  "validado" aqui seria afirmar uma verificação que ninguém fez. O registro valida
                  na ingestão, e a falha aparece no acompanhamento logo abaixo. */}
              <p className="mt-1 text-xs text-muted-foreground">
                A zip is not validated before publishing — the registry checks its structure during
                ingestion, and any problem shows up in the operation below.
              </p>
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title asChild>
            <h2>Publish</h2>
          </Card.Title>
          <Card.Description>
            The identifier is permanent and shows up in logs and errors. Publishing is asynchronous: the
            ingestion generates the vectors that make the skill discoverable.
          </Card.Description>
        </Card.Header>
        <div className="flex flex-wrap items-end gap-2 px-6 pb-6">
          <label className="flex flex-col gap-1 text-sm">
            <span>Identifier</span>
            <Input
              aria-label="Skill identifier"
              placeholder="e.g. convert-currency"
              value={skillId}
              onChange={(e) => {
                setSkillId(e.target.value);
                // Trocar o identificador declara que a PRÓXIMA publicação é outra. Deixar o
                // acompanhamento anterior na tela mostrava um "Done" verde sobre uma operação que
                // não é a que o campo agora descreve — e o link "View the skill", montado com o
                // identificador do campo, apontava para uma skill inexistente. MEDIDO no app-dev.
                //
                // Limpar também é o que devolve o botão: enquanto houvesse operação registrada,
                // publicar uma segunda skill exigia recarregar a página.
                setOperacaoId(null);
                setErroPublicacao(null);
              }}
            />
          </label>
          {/* Publicar exige ter VALIDADO antes: é o que impede publicar às cegas, que é o nome do
              critério. O botão desabilitado com o motivo ao lado ensina a regra sem erro. */}
          <Button
            onClick={() => publicar.mutate()}
            disabled={skillId.trim() === '' || (zip === null && validada === null) || publicar.isPending || operacaoId !== null}
          >
            {publicar.isPending ? 'Sending…' : 'Publish'}
          </Button>
          {zip === null && validada === null ? (
            <span className="text-xs text-muted-foreground">Validate the content before publishing.</span>
          ) : null}
        </div>
      </Card>

      {operacaoId !== null ? (
        <Card>
          <Card.Header>
            <Card.Title asChild>
              <h2>Publishing</h2>
            </Card.Title>
            <Card.Description>
              {/* O 202 significa ACEITO, não pronto. A tela mostra o estado real. */}
              {concluida
                ? 'Done — the skill is in the registry and discoverable.'
                : failed
                  ? 'Ingestion failed. The skill is not in the registry.'
                  : 'In progress — ingestion is generating the discovery vectors.'}
            </Card.Description>
          </Card.Header>
          <div className="flex flex-wrap items-center gap-2 px-6 pb-6">
            <Badge variant={concluida ? 'success' : failed ? 'destructive' : 'outline'}>
              {estado ?? 'aguardando'}
            </Badge>
            <span className="font-mono text-xs text-muted-foreground">{operacaoId}</span>

            {concluida ? (
              <>
                {/* O sucesso oferece TESTAR A DESCOBERTA, não "voltar à lista": saber se a skill é
                    encontrável é a única coisa que o autor quer saber depois de publicar. */}
                <Button asChild size="sm">
                  <Link to="/skills/discovery">Test discovery</Link>
                </Button>
                <Button asChild variant="secondary" size="sm">
                  <Link to={`/skills/${encodeURIComponent(skillId.trim())}`}>View the skill</Link>
                </Button>
              </>
            ) : null}

            {failed && operacao.data?.error ? (
              <span className="text-xs text-destructive">{operacao.data.error}</span>
            ) : null}
          </div>
        </Card>
      ) : null}
      </div>
    </RouteModal>
  );
}
