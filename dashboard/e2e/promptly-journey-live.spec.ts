// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 The LoopScale Authors
//
// M25 item 8 — a jornada inteira contra a INSTÂNCIA IMPLANTADA.
//
// O irmão `promptly-journey.spec.ts` roda hermético contra mocks e prova que o
// CÓDIGO funciona. Este prova que o SISTEMA funciona — e a distinção entre os dois
// é a que custou o dia: um e2e verde contra mock convive com um BFF que devolve 502
// em produção, e conviveu, por três horas (`#366`).
//
// ── COMO ELE SE AUTENTICA, E POR QUE ASSIM ────────────────────────────────────
//
// A instância exige sessão de operador (Kratos), que não se obtém por variável de
// ambiente. Em vez de embutir credencial — que teria de existir em algum lugar e
// vazaria no primeiro log —, o spec CONECTA-SE a um Chrome já autenticado por CDP e
// reusa o contexto dele. Nenhum segredo entra no repositório, no CI ou no processo.
//
// Consequência honesta, e ela é o limite deste arquivo: **isto não roda no CI**.
// Depende de um navegador logado na máquina de quem mede. É um spec de verificação
// operada, não um gate automático — e está declarado no `test.skip` abaixo, que o
// pula quando o Chrome não está lá, em vez de falhar e virar ruído vermelho.
//
// ── O QUE ELE NÃO FAZ, DELIBERADAMENTE ────────────────────────────────────────
//
// Não promove. Promover reaponta o label que agentes em execução resolvem, e este
// spec roda contra dado real de um ambiente compartilhado. Ele exercita a jornada
// ATÉ a confirmação — que é onde vivem as garantias do milestone (política vigente
// exibida antes do ato, e a revisão que deixa de servir nomeada) — e cancela,
// verificando que o ponteiro NÃO se moveu. O ato de promover é medição destrutiva e
// pede autorização explícita, não um spec que roda sozinho.

import { test, expect, chromium, type Page } from '@playwright/test';

const BORDA = process.env.PW_LIVE_URL ?? 'https://app-dev.getloopscale.com';
const CDP = process.env.PW_CDP_URL ?? 'http://127.0.0.1:9222';
/** Semeado para esta verificação: 14 revisões, `prod` apontando para a do MEIO. */
const PROMPT = process.env.PW_LIVE_PROMPT ?? 'validacao-borda-longo';

async function conectar(): Promise<{ page: Page; fechar: () => Promise<void> } | null> {
  try {
    const browser = await chromium.connectOverCDP(CDP, { timeout: 5000 });
    const ctx = browser.contexts()[0];
    if (!ctx) return null;
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    return { page, fechar: () => browser.close() };
  } catch {
    return null; // sem Chrome logado: o teste se pula, não falha
  }
}

test.describe('M25 — a jornada contra a instância implantada', () => {
  test('do menu ao detalhe, com o sha carimbado e o ponteiro intacto', async () => {
    const conn = await conectar();
    test.skip(conn === null, `sem Chrome autenticado em ${CDP} — verificação operada, não gate de CI`);
    if (!conn) return;
    const { page, fechar } = conn;

    try {
      // ── O SHA PRIMEIRO. Sem ele, todo resultado abaixo é anônimo — e duas ordens
      // afirmando "recriei o container" já se provaram falsas neste ambiente.
      await page.goto(`${BORDA}/`, { waitUntil: 'domcontentloaded' });
      const versao = await page.evaluate(async () => (await fetch('/v1/version')).json());
      expect(versao.version, 'a borda precisa reportar uma revisão').toBeTruthy();
      // eslint-disable-next-line no-console
      console.log(`[live] borda=${versao.version} built_at=${versao.built_at}`);

      const sessao = await page.evaluate(async () => (await fetch('/sessions/whoami')).status);
      test.skip(sessao !== 200, 'o Chrome conectado não está autenticado');

      // ── NAVEGAÇÃO POR CLIQUE. Digitar a URL é o único caminho que o operador não
      // tem; um spec que faz goto na rota profunda fica verde com o menu quebrado.
      await page.getByRole('complementary').getByRole('link', { name: /^prompts$/i }).click();
      await expect(page.getByRole('complementary').getByRole('link', { name: /^projects$/i })).toHaveCount(0);
      await expect(page).toHaveURL(/\/promptly$/);

      // ── CATÁLOGO: conteúdo, não status. Uma tabela vazia servida com 200 é o modo
      // de falha real de um BFF, e "a página carregou" passa nele.
      await expect(page.getByRole('link', { name: PROMPT })).toBeVisible();
      await expect(page.getByText(/Could not load the catalog/i)).toHaveCount(0);

      // ── DETALHE, alcançado pelo nome — o caminho que a lista oferece.
      await page.getByRole('link', { name: PROMPT }).click();
      await expect(page).toHaveURL(new RegExp(`/promptly/${PROMPT}$`));

      // A JANELA CERTA: as mais RECENTES. Se a rota devolvesse o começo do histórico
      // (o defeito do #364), v14 estaria ausente e v1 presente — é o par.
      await expect(page.getByRole('cell', { name: 'v14', exact: true })).toBeVisible();
      await expect(page.getByRole('cell', { name: 'v1', exact: true })).toHaveCount(0);
      await expect(page.getByText(/up to v14/i)).toBeVisible();

      // O ponteiro de ambiente, lido do serviço.
      await expect(page.getByText('prod → v6', { exact: true })).toBeVisible();

      // ── A CONFIRMAÇÃO: onde vivem as garantias do milestone.
      await page.getByRole('button', { name: /Promote prod to revision v14/i }).click();
      const dialogo = page.getByRole('dialog');
      // (a) a POLÍTICA vigente, ANTES do ato — lida do serviço, não adivinhada.
      await expect(dialogo.getByText(/promotion is unrestricted|minimum score/i)).toBeVisible();
      // (b) QUAL revisão deixa de servir — número vindo de `/labels`, não inferido.
      await expect(dialogo.getByText(/deixa de servir a v6/i)).toBeVisible();
      await expect(dialogo.getByText(/passa a servir a v14/i)).toBeVisible();
      // (c) o gate de frase digitada existe.
      await expect(dialogo.getByRole('textbox')).toBeVisible();

      // ── CANCELA. E o oráculo do cancelamento é o ESTADO: o ponteiro não se moveu.
      await dialogo.getByRole('button', { name: /cancelar/i }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByText('prod → v6', { exact: true })).toBeVisible();
      await expect(page.getByText('prod → v14', { exact: true })).toHaveCount(0);
    } finally {
      await fechar();
    }
  });
});
