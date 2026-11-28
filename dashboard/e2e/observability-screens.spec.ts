/**
 * Playwright browser-runtime E2E — as telas de Observability (LoopScale Lens).
 *
 * Prova que cada capacidade do lens RENDERIZA num navegador real (sessão mock,
 * `VITE_USE_MOCKS=true`) sem crash/error boundary, alcançada PELO MENU — roteamento
 * client-side, do jeito que o usuário navega, nunca digitando a URL.
 *
 * A LISTA VEM DO REGISTRO, NÃO DE UMA CÓPIA À MÃO.
 *
 * Até 2026-08-02 este arquivo mantinha um manifesto literal de 12 telas, copiado do menu.
 * Ele derivou, e derivou em silêncio: `Guards` foi renomeado para `Monitors` no M136 (com
 * redirect declarado) e `Webhooks` foi acrescentado — o manifesto não soube de nenhum dos
 * dois. `LENS_CAPABILITIES` existe desde o M70 exatamente por isso, e a razão registrada lá
 * é a mesma que se repetiu aqui: *"a auditoria achou Alerts roteado e ausente"*. Manter uma
 * segunda lista ao lado do registro é reconstruir o defeito que o registro eliminou.
 *
 * Derivar do registro NÃO torna a asserção circular: o registro diz o que **deve** existir;
 * o navegador prova o que **de fato** monta, sob que endereço, com heading visível e sem
 * error boundary. Nada disso o registro consegue afirmar sozinho.
 *
 * NÃO HÁ SLEEP FIXO AQUI, e a razão foi medida. Um probe com `waitForTimeout(700)` seguido de
 * consulta que não espera reportou a tela de `Monitors` **sem heading nenhum** — e o DOM tinha
 * o `<h1>` intacto, com a mesma cadeia de ancestrais de uma tela sã. O defeito era do
 * instrumento. Toda espera abaixo é por CONDIÇÃO (`toBeVisible`), nunca por relógio.
 */
import { expect, test } from '@playwright/test';
import { LENS_CAPABILITIES } from '../src/components/layout/lens-capabilities';

/**
 * Telas cujo título diverge do rótulo do menu — MEDIDO, não suposto (2026-08-02).
 *
 * Duas divergem hoje, e ambas por uma razão legítima: `Overview` é o item de menu de uma tela
 * que se intitula pelo produto inteiro, e `Queues` é a abreviação de "Labeling Queue". A tabela
 * existe para que a divergência seja **declarada** em vez de afrouxar a asserção para todas:
 * cair num `getByRole('heading')` genérico faria a tela errada passar, que é justamente o que
 * este teste existe para pegar.
 */
const TITULO_DIVERGENTE: Record<string, RegExp> = {
  Overview: /^(overview|observability)$/i,
  Queues: /labeling queue/i,
};

const tituloDe = (label: string): RegExp =>
  TITULO_DIVERGENTE[label] ?? new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

test.describe('Observability — as telas do lens renderizam (runtime de navegador)', () => {
  test('cada tela do registro abre PELO MENU, monta e não estoura error boundary', async ({
    page,
  }) => {
    const erros: string[] = [];
    page.on('pageerror', (e) => erros.push(e.message));

    await page.goto('/observability');
    // O menu do lens está presente antes de qualquer clique.
    await expect(page.getByRole('complementary').getByRole('link', { name: /^Traces$/ })).toBeVisible();

    for (const cap of LENS_CAPABILITIES) {
      // `Overview` já é a tela em que se está; as demais alcançam-se CLICANDO.
      if (cap.path !== '/observability') {
        await page.getByRole('complementary').getByRole('link', { name: new RegExp(`^${cap.label}$`) }).click();
      }

      await expect(page).toHaveURL(new RegExp(`${cap.path.replace(/\//g, '\\/')}$`));
      // O título da própria tela renderiza — prova que a rota resolveu E o componente montou.
      await expect(page.getByRole('heading', { name: tituloDe(cap.label) }).first()).toBeVisible();
      await expect(page.getByText(/something went wrong|application error/i)).toHaveCount(0);
    }

    expect(erros, `erros não capturados na página: ${erros.join('; ')}`).toHaveLength(0);
  });
});

/*
 * POR QUE O SEGUNDO TESTE DESTE ARQUIVO FOI REMOVIDO, e não apenas consertado.
 *
 * Ele comparava os botões do menu contra o manifesto literal, para acusar "uma tela nova no
 * menu que ninguém exercita". Duas razões o aposentam, e a segunda é a que pesa:
 *
 * 1. Tautologia. Menu e teste passam a derivar do MESMO registro, então a comparação não pode
 *    falhar — e um teste que não pode falhar não protege nada.
 *
 * 2. Ele NUNCA foi capaz de fazer o que dizia. O filtro de candidatos era uma lista literal com
 *    os mesmos nomes do manifesto, então uma tela nova era descartada antes da comparação.
 *    Medido: `Webhooks` entrou no menu e o portão ficou verde e mudo. Ele só detectava remoções
 *    — exatamente o oposto do que o comentário prometia.
 *
 * A garantia que ele QUERIA — nenhuma tela do lens alcançável só digitando o endereço — segue
 * valendo e é a que custou o M23. Ela mudou de lugar: hoje é estrutural pelo lado do menu (o
 * menu é derivado do registro), e o que resta descoberto é o inverso — uma rota em `app.tsx`
 * ausente do registro. Isso pede um portão que leia as rotas declaradas e as confronte com o
 * registro, com exceções nomeadas para as intencionais (`/observability/guards` é redirect,
 * `/observability/sessions/:sessionId` é drill-down). É trabalho próprio, não um remendo aqui.
 */
