import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button, Card, FormField, Textarea } from '@getloopscale/ui';
import { RouteModal } from '@/components/ui/route-modal';

import { Alert } from '@/components/ui/alert-guard';
import { usePageMeta } from '@/hooks/use-page-meta';
import { useRequireAuth } from '@/hooks/use-auth';
import { createRevision } from '@/hooks/promptly/promptly-api';
import { DESCRIPTION_MAX, validarCriacao, fraseDePermanencia } from '@/pages/promptly/components/create-form';
import { variableFields, renderTemplate, textVariables } from '@/pages/promptly/components/preview';
import { rejectionMessage } from '@/pages/promptly/components/rollback';

/**
 * M12 T3 — `/promptly/new`: autorar uma revisão.
 *
 * A tela que faltava para o catálogo deixar de ser um beco: até o M25 o operador via o que
 * existia e era mandado para a CLI para criar qualquer coisa.
 *
 * Duas coisas que a tela diz e que a API não obriga ninguém a dizer:
 *  - **a permanência**. Revisões são imutáveis e o produto não expõe `DELETE`. Descobrir isso
 *    depois de salvar é tarde;
 *  - **o render**. O preview mostra o texto com as variáveis substituídas ANTES de gravar, e é
 *    substituição local: nenhuma chamada a modelo, nenhum custo.
 */
export function PromptlyCreatePage() {
  const { setPageTitle } = usePageMeta();
  useEffect(() => setPageTitle('New revision'), [setPageTitle]);
  useRequireAuth();

  const navigate = useNavigate();
  const [params] = useSearchParams();

  // Vindo do detalhe de um prompt, o nome chega pronto e o operador não o redigita — redigitar
  // um nome é como se cria um prompt novo por engano.
  const suggestedName = params.get('name') ?? '';
  const nextVersion = Number(params.get('next') ?? '1') || 1;

  const [name, setNome] = useState(suggestedName);
  const [content, setConteudo] = useState('');
  const [values, setValores] = useState<Record<string, string>>({});
  const [recusa, setRecusa] = useState<string | null>(null);
  // M17 — o porquê desta revisão. Obrigatório NESTA tela (ADR-3): quem decide está aqui.
  const [description, setDescricao] = useState('');

  // `useMutation` e não `async/await` cru num handler: é a convenção do repositório para escritas
  // (`detail.tsx` faz assim na promoção e na reversão) e dispensa dois `useState` mantidos à mão.
  //
  // HONESTIDADE SOBRE O MOTIVO: eu troquei isto acreditando que resolveria os testes de recusa,
  // que o vitest reporta como rejeição não tratada. **Não resolveu** — o teste continua vermelho
  // pelo mesmo motivo depois da troca. A hipótese estava errada, e fica registrada como errada
  // para ninguém a repetir. A mudança permanece porque se sustenta sozinha (consistência com as
  // outras duas escritas do módulo, menos estado à mão), não pelo motivo que me trouxe até ela.
  const create = useMutation({
    mutationFn: () => createRevision<unknown>(name.trim(), content, { changeDescription: description.trim() }),
    onSuccess: () => navigate(`/promptly/${encodeURIComponent(name.trim())}`),
    onError: (err: unknown) => setRecusa(rejectionMessage(err)),
  });

  const validacao = validarCriacao({ name, description });

  // As variáveis desta tela ainda não têm resposta da API para consultar — o conteúdo está sendo
  // digitado agora. Aqui, e SÓ aqui, elas são extraídas do texto; em toda tela de leitura a
  // lista vem de `variables`, que o serviço declara.
  const declaradas = useMemo(() => textVariables(content), [content]);

  const fields = variableFields(declaradas, content);
  const renderizado = renderTemplate(content, { ...fields, ...values });

  function save() {
    if (!validacao.ok) return;
    setRecusa(null);
    create.mutate();
  }

  return (
    <RouteModal
      title="New revision"
      description={fraseDePermanencia(suggestedName !== '', nextVersion)}
      backTo={suggestedName ? `/promptly/${encodeURIComponent(suggestedName)}` : '/promptly'}
      busy={create.isPending}
      footer={
        <>
          {/* The way out. Closing goes back; nothing immutable is written. */}
          <Button variant="ghost" asChild>
            <Link to={suggestedName ? `/promptly/${encodeURIComponent(suggestedName)}` : '/promptly'}>Cancel</Link>
          </Button>
          <Button onClick={save} disabled={!validacao.ok || create.isPending}>
            {create.isPending ? 'Creating…' : `Create revision v${nextVersion}`}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
      {recusa ? (
        <Alert intent="destructive" title="The revision was not created" description={recusa} />
      ) : null}

      <Card>
        <Card.Header>
          <Card.Title asChild>
            <h2>Content</h2>
          </Card.Title>
          <Card.Description>
            Use <code>{'{{variable}}'}</code> for the parts that change on every call.
          </Card.Description>
        </Card.Header>

        <div className="space-y-4 p-6 pt-0">
          <FormField id="promptly-nome">
            <FormField.Label>Prompt name</FormField.Label>
            <FormField.Control>
              <input
                aria-label="Prompt name"
                className="w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
                value={name}
                onChange={(e) => setNome(e.target.value)}
                readOnly={suggestedName !== ''}
                placeholder="onboarding.welcome"
              />
            </FormField.Control>
            {name !== '' && validacao.nameError !== null ? (
              <FormField.Error>{validacao.nameError}</FormField.Error>
            ) : null}
          </FormField>

          <FormField id="promptly-descricao">
            <FormField.Label>Why this revision exists</FormField.Label>
            <FormField.Control>
              <input
                aria-label="Why this revision exists"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={description}
                onChange={(e) => setDescricao(e.target.value)}
                maxLength={DESCRIPTION_MAX}
                placeholder="shortened the preamble to reduce tokens"
              />
            </FormField.Control>
            {/* O teto é dito ANTES de o operador estourar, não depois de a submissão falhar. */}
            <FormField.Hint>
              {`${String(description.trim().length)}/${String(DESCRIPTION_MAX)} — the diff shows what changed; this explains why.`}
            </FormField.Hint>
            {description !== '' && validacao.descriptionError !== null ? (
              <FormField.Error>{validacao.descriptionError}</FormField.Error>
            ) : null}
          </FormField>

          <FormField id="promptly-conteudo">
            <FormField.Label>Prompt text</FormField.Label>
            <FormField.Control>
              <Textarea
                aria-label="Prompt text"
                rows={12}
                className="font-mono text-sm"
                value={content}
                onChange={(e) => setConteudo(e.target.value)}
                placeholder={'You are a {{product}} assistant. Answer in {{language}}.'}
              />
            </FormField.Control>
          </FormField>
        </div>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title asChild>
            <h2>Prever o resultado</h2>
          </Card.Title>
          <Card.Description>
            Local substitution — no model call, no cost. An empty field leaves the placeholder
            visible, so the gap does not go unnoticed.
          </Card.Description>
        </Card.Header>

        <div className="space-y-4 p-6 pt-0">
          {declaradas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No variables in the text — the prompt is served exactly as written.
            </p>
          ) : (
            declaradas.map((v) => (
              <FormField key={v} id={`promptly-var-${v}`}>
                <FormField.Label>{v}</FormField.Label>
                <FormField.Control>
                  <input
                    aria-label={v}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={values[v] ?? ''}
                    onChange={(e) => setValores((atual) => ({ ...atual, [v]: e.target.value }))}
                  />
                </FormField.Control>
              </FormField>
            ))
          )}

          <div>
            <h3 className="mb-2 text-sm font-medium">What the model would receive</h3>
            <pre
              data-testid="promptly-preview"
              className="whitespace-pre-wrap rounded-md bg-muted p-4 font-mono text-xs"
            >
              {renderizado}
            </pre>
          </div>
        </div>
      </Card>

      </div>
    </RouteModal>
  );
}

