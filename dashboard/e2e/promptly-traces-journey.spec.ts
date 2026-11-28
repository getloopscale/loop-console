// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 The LoopScale Authors
//
// M23 — o caminho da aba de um prompt até as resoluções individuais dele.
//
// A aba *Uso em produção* mostra um agregado. Quando o número surpreende, não havia para onde ir:
// os spans `prompt.resolve` já existiam, já estavam indexados por `prompt.id` no `looptrace`, e a
// única forma de chegar neles era digitar a URL (`getloopscale/loop-console#463`).
//
// POR QUE ESTE SPEC EXISTE, e por que ele afirma no DESTINO:
//
// O `/review` do M22 achou um BLOCKER em que o produtor escrevia `?prompt=` e a tela de destino
// NUNCA lia o parâmetro. Todos os testes de unidade estavam verdes — porque afirmavam o `href` do
// produtor e chamavam aquilo de jornada. O peer maduro (Langfuse) também não testa o link
// equivalente: 0 dos 236 arquivos de teste dele o mencionam. Isso é evidência de que o buraco é
// COMUM, não de que é tolerável.
//
// A navegação é por CLIQUE, a partir da raiz. Chegar digitando o endereço usa o único caminho que
// o usuário real não tem.
//
// HONESTIDADE SOBRE O ESCOPO: roda hermético contra o Vite local com `VITE_USE_MOCKS=true`, como
// todo e2e deste repositório. Prova a JORNADA DA INTERFACE — que o produtor constrói o endereço e
// que o consumidor o honra. Não prova que o serviço implantado devolve os spans certos; essa
// metade se verifica contra o ambiente e se registra como evidência de aceitação.

import { test, expect, type Page } from '@playwright/test';

/**
 * Chega ao catálogo CLICANDO a partir da raiz — o helper canônico de `promptly-journey.spec.ts`.
 *
 * São duas etapas porque o menu tem duas: o item `Prompts` entra no submenu (`drillsInto`) e o
 * item dele abre a tela. A espera no meio existe porque a raiz tem itens de mesmo nome: clicar
 * cedo demais acerta o da raiz e a jornada segue em `/`, com a navegação parecendo funcionar.
 */
async function navegarAteOCatalogoPeloMenu(page: Page) {
  await page.goto('/');
  await page.getByRole('complementary').getByRole('link', { name: /^prompts$/i }).click();
  await expect(page.getByRole('complementary').getByRole('link', { name: /^projects$/i })).toHaveCount(0);
  await page.getByRole('complementary').getByRole('link', { name: /^catalog$/i }).click();
  await expect(page).toHaveURL(/\/promptly\/catalog$/);
}

test.describe('M23 — do número na aba até as resoluções que o produziram', () => {
  test('do catálogo ao explorador filtrado, sem digitar endereço', async ({ page }) => {
    await navegarAteOCatalogoPeloMenu(page);

    // ---- Abrir um prompt e a aba de uso, clicando --------------------------------------
    await page.getByRole('link', { name: 'saudacao', exact: true }).click();
    await page.getByRole('link', { name: 'Production usage' }).click();

    // ---- O caminho existe, e diz ao operador o que vai encontrar -----------------------
    const caminho = page.getByRole('link', { name: /runs in traces/i });
    await expect(caminho).toBeVisible();

    await caminho.click();

    // ---- O DESTINO consumiu o parâmetro ------------------------------------------------
    // Esta é a asserção que faltava no M22. Um destino que ignora o parâmetro chega aqui com a
    // URL certa e a lista errada — por isso o que se afirma abaixo é o CHIP e as LINHAS, nunca
    // apenas o endereço.
    await expect(page).toHaveURL(/\/observability\/traces\?/);
    await expect(page).toHaveURL(/span_query=attr%3Aprompt\.id%3Dsaudacao/);

    // O chip de filtro nomeia o atributo — prova de que o destino leu e aplicou.
    await expect(page.getByText(/PROMPT\.ID=SAUDACAO/i)).toBeVisible();

    // E a listagem mostra AS TRÊS resoluções, e nada que não seja resolução. `toHaveCount(3)` e
    // não `.first()`: com `.first()` uma lista filtrada que perdesse duas linhas seguia verde.
    await expect(page.getByText('prompt.resolve')).toHaveCount(3);
    await expect(page.getByText('chat.completion')).toHaveCount(0);

    // ---- E o ramo SEM filtro do fixture, que nada no repositório executava -------------
    //
    // A força da asserção acima repousa inteiramente em o mock devolver uma lista DIFERENTE sem
    // filtro. Enquanto ninguém exercitava esse ramo, o `chat.completion` era código morto do
    // ponto de vista da suíte: um handler que devolvesse resoluções SEMPRE passaria igual, e a
    // jornada anunciaria um poder discriminante que não tinha.
    //
    // De brinde, isto prova que o destino refaz a busca ao limpar o filtro — o risco R2 do plano,
    // que não tinha cobertura alguma.
    await page.getByRole('button', { name: 'Remove attribute filter' }).click();
    await expect(page.getByText('chat.completion')).toBeVisible();
  });

  test('o destino filtra pelo prompt CERTO — um segundo prompt não vê as resoluções do primeiro', async ({
    page,
  }) => {
    // Sem este contraste, a asserção da primeira jornada era satisfeita por um destino que
    // ignorasse o valor do filtro por completo. Medido: mutar o handler para devolver as mesmas
    // três resoluções a qualquer `prompt.id` deixava aquela jornada VERDE. Um teste que passa com
    // e sem a discriminação não prova a discriminação.
    //
    // `despedida` tem uso na aba (logo o caminho é oferecido) e nenhuma resolução no explorador.
    await navegarAteOCatalogoPeloMenu(page);
    await page.getByRole('link', { name: 'despedida', exact: true }).click();
    await page.getByRole('link', { name: 'Production usage' }).click();
    await page.getByRole('link', { name: /runs in traces/i }).click();

    await expect(page).toHaveURL(/span_query=attr%3Aprompt\.id%3Ddespedida/);
    await expect(page.getByText(/PROMPT\.ID=DESPEDIDA/i)).toBeVisible();
    // Nenhuma resolução — e, principalmente, NENHUMA das de `saudacao`.
    await expect(page.getByText('prompt.resolve')).toHaveCount(0);
  });
});
