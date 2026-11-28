// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 The LoopScale Authors
//
// M21 — a jornada das QUATRO ABAS, ponta a ponta pela tela.
//
// Cobre: menu → catálogo → prompt → cada aba por clique → COPIAR o trecho de consumo → promover a
// partir de uma aba que não é a de ambientes, e ver a confirmação abrir sem trocar de rota. É o
// DoD-1 (as quatro perguntas, e nenhum endereço perdido), o DoD-2 (o trecho é copiável e aponta
// para este prompt) e o DoD-3 (a AÇÃO de promover, não só o cartão).
//
// O `/review` classificou a versão anterior como falso-verde em dois pontos: ela dizia cobrir a
// promoção e só verificava cabeçalhos, e dizia cobrir o consumo e só verificava um `<pre>`. Um
// título de teste que promete mais do que a asserção entrega é pior que ausência de teste.
//
// A navegação é sempre por CLIQUE, a partir da raiz. Validar digitando o endereço usa o único
// caminho que o usuário real não tem — foi assim que quatro telas do `loopguardrails` ficaram
// inalcançáveis com três rodadas de validação passando por cima.
//
// HONESTIDADE SOBRE O ESCOPO: roda hermético contra o Vite local com `VITE_USE_MOCKS=true`, como
// todo e2e deste repositório. Prova a JORNADA DA INTERFACE — não prova que o trecho copiado resolve
// um prompt no serviço implantado. Essa metade se verifica contra o ambiente e se registra como
// evidência de aceitação; afirmá-la aqui seria teatro.

import { test, expect, type Page } from '@playwright/test';

async function navegarAteOCatalogoPeloMenu(page: Page) {
  await page.goto('/');
  await page.getByRole('complementary').getByRole('link', { name: /^prompts$/i }).click();
  // Esperar o submenu TROCAR antes de clicar no item dele — a raiz tem itens de mesmo nome, e
  // clicar cedo demais acerta o da raiz com a navegação parecendo funcionar.
  await expect(page.getByRole('complementary').getByRole('link', { name: /^projects$/i })).toHaveCount(0);
  await page.getByRole('complementary').getByRole('link', { name: /^catalog$/i }).click();
  await expect(page).toHaveURL(/\/promptly\/catalog$/);
}

test.describe('M21 — as quatro perguntas do detalhe', () => {
  test('do menu às quatro abas, ao trecho que se copia, e à promoção sem sair', async ({ page }) => {
    await navegarAteOCatalogoPeloMenu(page);

    // ---- O endereço que já circulava (DoD-1) ---------------------------------------------
    // O link do catálogo aponta para `/promptly/:name`, sem sufixo. Ele continua resolvendo, e
    // abre a aba de conteúdo — quebrá-lo trocaria uma tela melhor por caminhos mortos.
    await page.getByRole('link', { name: 'saudacao', exact: true }).click();
    await expect(page).toHaveURL(/\/promptly\/saudacao$/);
    await expect(page.getByRole('link', { name: 'Content', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('heading', { name: 'Revisions' })).toBeVisible();

    // ---- Cada aba responde a SUA pergunta -------------------------------------------------
    // `exact: true` nas quatro abas, e o motivo não é estilo.
    //
    // O `name` do `getByRole` casa SUBSTRING por padrão. Em 2026-08-10 o indicador de status
    // do rodapé passou a publicar o nome acessível
    //   "System status: 1 operational, 1 unreachable, 1 not configured, 0 without provenance"
    // — que contém "not **config**ured". `getByRole('link', { name: 'Config' })` passou a
    // casar DOIS elementos e o teste morreu em strict mode, acusando um produto correto.
    //
    // O rótulo da aba é exatamente "Config". Pedir substring era pedir mais do que se queria,
    // e a colisão só não tinha acontecido antes porque nenhum texto da página continha a
    // palavra. Um seletor frouxo é uma colisão esperando o vocabulário certo aparecer.
    await page.getByRole('link', { name: 'Config', exact: true }).click();
    await expect(page).toHaveURL(/\/promptly\/saudacao\/config$/);
    await expect(page.getByRole('heading', { name: 'Required variables' })).toBeVisible();
    // E não mostra o que é de outra aba — sem isto, um recorte que renderizasse tudo em toda aba
    // passaria, e a tela continuaria sendo o scroll único com uma barra decorativa em cima.
    await expect(page.getByRole('heading', { name: 'Revisions' })).toHaveCount(0);

    await page.getByRole('link', { name: 'Production usage', exact: true }).click();
    await expect(page).toHaveURL(/\/promptly\/saudacao\/production$/);
    await expect(page.getByRole('heading', { name: 'Usage by revision' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What references this prompt' })).toBeVisible();

    // ---- A aba de consumo entrega código (DoD-2) -----------------------------------------
    await page.getByRole('link', { name: 'How to consume', exact: true }).click();
    await expect(page).toHaveURL(/\/promptly\/saudacao\/consumption$/);

    for (const rotulo of ['SDK (TypeScript)', 'REST (curl)', 'MCP']) {
      await expect(page.getByRole('heading', { name: rotulo })).toBeVisible();
    }
    // O trecho aponta para ESTE prompt — é o que separa "código de exemplo" de "código que roda".
    const trechos = page.locator('pre');
    await expect(trechos.first()).toContainText('saudacao');
    // E não carrega credencial: um trecho é feito para ser copiado.
    await expect(trechos.first()).not.toContainText('promptly_live_');

    // ---- Recarregar mantém o lugar (ADR-1: a aba é rota, não estado) ----------------------
    await page.reload();
    await expect(page.getByRole('link', { name: 'How to consume', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );

    // ---- DoD-2: o botão de copiar existe e COPIA ------------------------------------------
    // A versão anterior deste spec verificava só o `<pre>`, e o `/review` classificou isso como
    // falso-verde: o DoD diz "copiar o trecho e executá-lo", e um bloco visível sem botão que
    // funcione não cumpre a primeira metade.
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: /Copy the REST/ }).click();
    await expect(page.getByRole('button', { name: /Copy the REST/ })).toHaveText('Copied');
    const copiado = await page.evaluate(() => navigator.clipboard.readText());
    expect(copiado).toContain('curl');
    expect(copiado).toContain('saudacao');

    // ---- DoD-3: promover a partir de uma aba que NÃO é a de ambientes ---------------------
    // A AÇÃO, não só o cartão. O `/review` mediu que a versão anterior deste bloco verificava dois
    // cabeçalhos e passava com ZERO botões de promoção — a ação inteira vivia na aba de conteúdo,
    // e três lugares (comentário, teste e CHANGELOG) afirmavam o contrário.
    await expect(page.getByRole('heading', { name: 'Environments' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tags' })).toBeVisible();
    const promover = page.getByRole('button', { name: /^Promote prod to the latest revision/ });
    await expect(promover).toBeVisible();

    // E ela ABRE a confirmação, sem sair da aba de consumo.
    await promover.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page).toHaveURL(/\/promptly\/saudacao\/consumption$/);
    await page.keyboard.press('Escape');

    // ---- E o caminho de volta existe ------------------------------------------------------
    await page.getByRole('link', { name: 'Content', exact: true }).click();
    await expect(page).toHaveURL(/\/promptly\/saudacao$/);
    await expect(page.getByRole('heading', { name: 'Revisions' })).toBeVisible();
  });
});
