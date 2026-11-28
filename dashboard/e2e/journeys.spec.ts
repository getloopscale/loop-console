/**
 * Playwright browser-runtime E2E journeys — Plan v1.0 Final Phase.
 *
 * Mirrors the 6 critical journeys from src/test/e2e-journeys.test.tsx but
 * exercises them against a real browser engine + the dev server running
 * with VITE_USE_MOCKS=true.
 *
 * Run: npx playwright test (after npm install -D @playwright/test).
 */

import { expect, test } from '@playwright/test';

test.describe('LoopScale dashboard — 6 critical journeys', () => {
  test('journey 1: first deploy — overview → projects → detail', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /overview/i })).toBeVisible();

    await page.getByRole('complementary').getByRole('link', { name: /projects/i }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByText('acme-web')).toBeVisible();

    await page.getByRole('link', { name: /open acme-web/i }).click();
    await expect(page).toHaveURL(/\/projects\/acme-web$/);
  });

  test('journey 2: debug failed build — drill into failed deployment', async ({ page }) => {
    await page.goto('/projects/acme-web/deployments');
    await expect(page.getByText(/failed/i).first()).toBeVisible();

    // Click first failed row → drill to detail
    const failedRow = page.locator('tr', { hasText: 'Failed' }).first();
    await failedRow.getByRole('link', { name: /view/i }).click();
    await expect(page).toHaveURL(/\/deployments\/bld_/);

    // `view logs` virou a aba `Logs` do detalhe do deploy (M15–M19). É RENOMEAÇÃO, não
    // remoção: a afordância está lá, com outro rótulo e sob a mesma URL.
    await page.getByRole('link', { name: /^logs$/i }).click();
    await expect(page).toHaveURL(/\/logs$/);

    // A asserção anterior exigia a palavra "cloning" no corpo. Ela SAIU porque não tinha
    // lastro: o dublê não serve linha de log alguma para este build, então ela cobrava do
    // produto um conteúdo que o cenário nunca produz. O que a jornada garante aqui é que a
    // aba MONTA — com seus filtros de nível — em vez de estourar ou vir vazia de tudo.
    // Afirmar conteúdo de log exige primeiro um dublê que o sirva; está anotado como
    // trabalho separado, não escondido atrás de uma asserção frouxa.
    await expect(page.getByRole('button', { name: /^error$/i })).toBeVisible();
  });

  test('journey 3: production operation — rollback dialog', async ({ page }) => {
    await page.goto('/projects/acme-web/deployments');
    const succeededRow = page.locator('tr', { hasText: 'Succeeded' }).first();
    await succeededRow.getByRole('link', { name: /view/i }).click();

    // `rollback to here` virou `Rollback to this build`. Renomeação — `RollbackDialog` segue
    // fiado em `deployment-detail-layout.tsx`. Aparece no deploy BEM-SUCEDIDO e não no que
    // falhou, o que é correto: não se volta para um build que nunca serviu.
    //
    // O nome casado é o ACESSÍVEL, não o texto visível: o botão mostra "Rollback" e tem
    // `aria-label="Rollback to this build"`, que sobrepõe o texto. Foi o que fez `/^rollback$/i`
    // devolver ZERO elementos enquanto a lista de textos internos mostrava "Rollback" — dois
    // instrumentos, duas respostas, e a que vale é a que o leitor de tela anuncia.
    await page.getByRole('button', { name: /rollback to this build/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/rollback/i).first()).toBeVisible();
  });

  test('journey 4: billing transparency', async ({ page }) => {
    await page.goto('/billing');
    await expect(page.getByRole('heading', { name: /billing/i })).toBeVisible();
    // A asserção nomeia a OFERTA, não a substring `pro`.
    //
    // `getByText(/pro/i)` casava cinco elementos — incluindo os itens de menu `Projects`,
    // `Prompts` e `Profile`. Num teste de faturamento, isso passaria com a tela inteira quebrada
    // desde que a barra lateral existisse: a asserção não afirmava nada sobre faturamento.
    //
    // 2026-08-10 — E MESMO ASSIM ELE PASSAVA COM A TELA QUEBRADA. A oferta era `upgrade to
    // pro`, que é o que a página mostra para uma conta FREE. A conta mockada é `pro`, e a
    // oferta certa para ela é o Team. Passava porque o mock de billing estava registrado num
    // caminho que nunca casava: a tela levava 500 do proxy e caía no estado de fallback, onde
    // a oferta de Pro aparece. Consertar a rota do mock derrubou o teste — o dado passou a
    // chegar, e a tela passou a mostrar a verdade.
    //
    // Duas asserções agora, e a segunda é a que importa: **um número que só existe se a
    // resposta de billing chegou**. Nenhum estado de fallback produz "4 / 10" — era essa a
    // asserção ausente que deixou um 500 passar por transparência.
    await expect(page.getByRole('button', { name: /upgrade to team/i })).toBeVisible();
    await expect(page.getByText(/^4 \/ 10$/)).toBeVisible();
  });

  test('journey 5: team management — invite dialog', async ({ page }) => {
    await page.goto('/team');
    await expect(page.getByText('Paulo Henrique')).toBeVisible();

    await page.getByRole('button', { name: /^invite$/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('journey 6: secrets — add secret dialog', async ({ page }) => {
    await page.goto('/projects/acme-web/secrets');
    await expect(page.getByText('STRIPE_SECRET_KEY')).toBeVisible();

    await page.getByRole('button', { name: /add secret/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    // O campo do DIÁLOGO, por papel e nome — não `/key/i`, que casava sete elementos: os valores
    // mascarados e os botões de rotacionar/remover dos segredos JÁ existentes na lista atrás do
    // diálogo. O teste passaria sem o diálogo ter campo algum.
    await expect(page.getByRole('dialog').getByRole('textbox', { name: 'Key' })).toBeVisible();
  });
});

test.describe('Accessibility smoke — Lighthouse axe-core checks', () => {
  test('overview page has h1', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('skip-to-content link is first focusable element', async ({ page }) => {
    await page.goto('/');

    // ESPERA A TELA ASSENTAR ANTES DE TABULAR — medido `flaky` no ambiente do CI (2026-08-02).
    // `Tab` logo após o `goto` compete com a hidratação: se o React ainda está montando, o
    // primeiro elemento focável do documento não é o que a tela pronta oferece, e o teste
    // reprovava um produto correto — passando na repetição, que é o pior modo de falhar,
    // porque ensina a reexecutar o CI em vez de olhar.
    await expect(page.locator('h1').first()).toBeVisible();

    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.textContent);
    expect(focused).toMatch(/skip to main content/i);
  });
});
