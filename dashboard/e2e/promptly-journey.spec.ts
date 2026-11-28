// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 The LoopScale Authors
//
// M25 — a jornada de operar prompts, ponta a ponta PELA TELA.
//
// Cobre: raiz → menu → catálogo → detalhe → política vigente → promoção confirmada → o label
// passa a servir outra revisão. É o ÚNICO e2e do milestone: o resto da cobertura vive em lógica
// pura (`components/promptly/projections.ts`) e em teste de componente, seguindo o mesmo ADR do
// M24. Um e2e por tela não pega a costura, que é justamente onde esta jornada falha.
//
// A NAVEGAÇÃO É POR CLIQUE, A PARTIR DA RAIZ — nunca `page.goto('/promptly')`.
//
// Digitar a URL é o único caminho que o usuário real NÃO tem. No M23 quatro telas do trust
// ficaram inalcançáveis por falta de uma linha em `resolveActiveMenu`, e três rodadas de
// validação passaram por cima porque validavam digitando o endereço. Um e2e que faz `goto` na
// rota profunda reproduz exatamente aquela cegueira: fica verde com o menu quebrado.
//
// AS ASSERÇÕES SÃO SOBRE CONTEÚDO, NUNCA SOBRE STATUS HTTP. Uma tabela vazia servida com 200 é
// o modo de falha real de um BFF que devolve lista vazia quando a leitura falhou — e um teste
// que afirma "a página carregou" passa nele.
//
// HONESTIDADE SOBRE O ESCOPO: roda hermético contra o Vite local com `VITE_USE_MOCKS=true`, como
// todo e2e deste repositório. Prova a JORNADA DA INTERFACE contra o contrato medido do
// `loopprompt` — não prova que o serviço implantado devolve estes corpos, nem que um agente em
// execução passa a resolver a revisão promovida. Essa metade se verifica contra o ambiente real
// e se registra como evidência; afirmá-la aqui seria teatro.

import { test, expect, type Page } from '@playwright/test';

/**
 * Chega ao catálogo CLICANDO a partir da raiz.
 *
 * Duas etapas, porque o menu tem duas: o item `Prompts` em Agent Services entra no submenu
 * (`drillsInto`), e o item dele abre a tela. Se qualquer uma das três peças do menu faltar,
 * é aqui que o teste morre — e morre no passo que o usuário de fato daria.
 *
 * **O destino é `Catálogo`, não `Overview`, desde o M13.** A lista saiu da raiz — `/promptly`
 * virou o painel, como em memory/rag/lens — e este helper continuou clicando `Overview`. As
 * quatro jornadas do M25 passaram a procurar links de prompt numa tela que já não os tem, e
 * falhavam trinta segundos depois, no timeout, dizendo apenas que um link não apareceu. Mover
 * uma rota e deixar a jornada apontando para a antiga é como o e2e vira um alarme que ninguém
 * sabe ler.
 */
async function navegarAteOCatalogoPeloMenu(page: Page) {
  await page.goto('/');
  await page.getByRole('complementary').getByRole('link', { name: /^prompts$/i }).click();
  // Esperar o submenu TROCAR antes de clicar no item dele. A raiz também tem itens de mesmo
  // nome: clicar cedo demais acerta o da raiz e a jornada continua em `/`, com a navegação
  // parecendo funcionar. O sinal de troca é a ausência de um item que só a raiz tem.
  await expect(page.getByRole('complementary').getByRole('link', { name: /^projects$/i })).toHaveCount(0);
  await page.getByRole('complementary').getByRole('link', { name: /^catalog$/i }).click();
  await expect(page).toHaveURL(/\/promptly\/catalog$/);
}

test.describe('M25 — operar prompts pelo dashboard', () => {
  test('a jornada inteira: do menu ao label servindo outra revisão', async ({ page }) => {
    await navegarAteOCatalogoPeloMenu(page);

    // ---- CATÁLOGO: conteúdo, não status --------------------------------------------------
    await expect(page.getByText('saudacao')).toBeVisible();
    await expect(page.getByText('despedida')).toBeVisible();

    // A coluna que responde "isto está servindo produção?" — a pergunta que traz o operador aqui.
    // A célula lista TODOS os ambientes do prompt numa string só, e a asserção é sobre ela
    // inteira: um `prod → v1` solto casaria por substring com o `prod → v12` de outro prompt.
    await expect(page.getByText('prod → v1, staging → v2', { exact: true })).toBeVisible();
    // E o prompt que não serve ambiente algum diz isso, em vez de deixar a célula vazia: célula
    // vazia é indistinguível de dado que não carregou.
    //
    // A asserção é escopada à LINHA do `despedida`, e não à página. Enquanto ele era o único prompt
    // sem ambiente, `getByText('none')` era não-ambíguo por acidente do fixture — o M20
    // acrescentou dois prompts de composição, também sem ambiente, e a asserção passou a casar três
    // elementos e falhar em modo estrito. O que ela sempre quis dizer é "a célula DESTE prompt diz
    // 'nenhum'"; agora ela diz isso.
    await expect(
      page.getByRole('row', { name: /despedida/ }).getByText('none'),
    ).toBeVisible();

    // ---- DETALHE: alcançado pelo NOME, que é o caminho da lista ---------------------------
    await page.getByRole('link', { name: 'saudacao', exact: true }).click();
    await expect(page).toHaveURL(/\/promptly\/saudacao$/);

    // O trecho da revisão — o suficiente para reconhecê-la. O corpo inteiro é editor, e editor
    // está fora deste milestone por decisão registrada.
    await expect(page.getByText(/I am the assistant/)).toBeVisible();
    // No detalhe cada ambiente é um selo próprio, então aqui a igualdade exata é a asserção certa.
    await expect(page.getByText('prod → v1', { exact: true })).toBeVisible();

    // ---- A POLÍTICA, ANTES DO ATO --------------------------------------------------------
    // Este prompt não tem política: a promoção é livre, e a tela precisa DIZER isso. Silêncio
    // aqui seria indistinguível de "não consegui ler a regra".
    await page.getByRole('button', { name: /Promote prod to revision v3/i }).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo.getByText(/promotion is unrestricted/i)).toBeVisible();

    // ---- A CONSEQUÊNCIA, NOMEADA ---------------------------------------------------------
    // Não "o item será alterado": QUAL revisão deixa de servir o label. O v1 vem de `/labels`.
    await expect(dialogo.getByText(/stops serving v1/i)).toBeVisible();
    await expect(dialogo.getByText(/starts serving v3/i)).toBeVisible();

    // ---- A PROMOÇÃO, ATRÁS DA FRASE DIGITADA ---------------------------------------------
    await dialogo.getByRole('textbox').fill('prod');
    await dialogo.getByRole('button', { name: /^Promote$/i }).click();

    // ---- O ORÁCULO É O ESTADO, NÃO A RESPOSTA --------------------------------------------
    // O que prova a promoção é o ponteiro ter mudado na tela: um 200 do servidor com o label
    // parado seria exatamente o defeito que este passo existe para pegar.
    await expect(page.getByText('prod → v3', { exact: true })).toBeVisible();
    await expect(page.getByText('prod → v1', { exact: true })).toHaveCount(0);
  });

  test('a recusa da política chega ao operador com o motivo do serviço', async ({ page }) => {
    // O par que discrimina o teste acima. `saudacao/staging` TEM política, e o serviço recusa com
    // os números. Sem este caso o e2e provaria só o caminho feliz — e a mensagem tipada poderia
    // estar sendo colapsada em "erro" genérico sem nada acusar.
    await navegarAteOCatalogoPeloMenu(page);
    await page.getByRole('link', { name: 'saudacao', exact: true }).click();

    await page.getByRole('button', { name: /Promote staging to revision v3/i }).click();
    const dialogo = page.getByRole('dialog');

    // A regra vigente é exibida ANTES do ato — é a razão de o GET de políticas existir neste
    // milestone em vez de ficar para depois.
    await expect(dialogo.getByText(/minimum score of 0\.8/i)).toBeVisible();

    await dialogo.getByRole('textbox').fill('staging');
    await dialogo.getByRole('button', { name: /^Promote$/i }).click();

    // O TEXTO do serviço, com os números que dizem POR QUE. Sem eles o operador vê "erro" e
    // tenta de novo igual.
    await expect(page.getByText(/best run of this revision scored 0\.41/i)).toBeVisible();
    // E o ponteiro NÃO se moveu: a recusa foi honrada, não apenas exibida.
    await expect(page.getByText('staging → v2')).toBeVisible();
  });

  test('num prompt longo, a lista mostra as revisões RECENTES — não o começo do histórico', async ({ page }) => {
    // #364. A rota ordena da mais ANTIGA para a mais nova e corta com `limit`: sem cursor, um
    // prompt de 30 revisões exibia v1..v10 sob o rótulo "as 10 mais recentes", e a revisão atual
    // não aparecia. Numa tela de PROMOÇÃO, quem clicasse na "mais nova" reapontaria produção para
    // uma revisão velha — com o diálogo confirmando a errada com convicção.
    await navegarAteOCatalogoPeloMenu(page);
    await page.getByRole('link', { name: 'longo', exact: true }).click();
    await expect(page).toHaveURL(/\/promptly\/longo$/);

    // A revisão ATUAL está na tela...
    await expect(page.getByRole('cell', { name: 'v30', exact: true })).toBeVisible();
    // ...e o começo do histórico NÃO está — este é o par que discrimina.
    await expect(page.getByRole('cell', { name: 'v1', exact: true })).toHaveCount(0);
    // A legenda declara até onde a página vai, em vez de prometer algo inauditável.
    await expect(page.getByText(/up to v30/i)).toBeVisible();
  });

  test('o prompt sem label algum diz isso, em vez de oferecer promoção às cegas', async ({ page }) => {
    // A frase MUDA com o dado. Sem label não há revisão que saia, e a tela não finge que há.
    await navegarAteOCatalogoPeloMenu(page);
    await page.getByRole('link', { name: 'despedida', exact: true }).click();
    await expect(page).toHaveURL(/\/promptly\/despedida$/);

    await expect(page.getByText(/No environment label points at this prompt/i)).toBeVisible();
  });
});
