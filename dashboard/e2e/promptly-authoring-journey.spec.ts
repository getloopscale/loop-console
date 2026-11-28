// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 The LoopScale Authors
//
// M12 — a jornada de AUTORAR e COMPARAR, ponta a ponta PELA TELA.
//
// Complementa o e2e do M25 (catálogo → detalhe → promover) com a metade que faltava para o
// ciclo fechar: criar uma revisão e entender o que mudou entre duas. É o ÚNICO e2e do
// milestone — o resto da cobertura vive em lógica pura, testada sem browser.
//
// A NAVEGAÇÃO É POR CLIQUE, A PARTIR DA RAIZ. Digitar a URL é o único caminho que o usuário real
// não tem; um e2e que faz `goto` na rota profunda fica verde com o menu quebrado, que é
// exatamente o defeito que este milestone tinha de fechar.
//
// AS ASSERÇÕES SÃO SOBRE CONTEÚDO, NUNCA SOBRE STATUS.
//
// NENHUM CONTROLE FATURÁVEL É CLICADO. Derivado por varredura do marcador `ModelInvoker` no
// produto: a única rota que invoca modelo é `POST /evaluations/runs`, e ela não aparece em
// nenhuma tela desta jornada. O preview desta tela é substituição LOCAL — é o que torna esse
// eixo fechado por construção, e não por disciplina de quem escreve o teste.
//
// ESCOPO, dito por inteiro: roda hermético contra o Vite local com `VITE_USE_MOCKS=true`. Prova
// a jornada da INTERFACE contra o contrato medido do `loopprompt` — não prova que o serviço
// implantado devolve estes corpos. Essa metade se verifica em `/acceptance`, contra o build da
// tag; afirmá-la aqui seria teatro.

import { test, expect, type Page } from '@playwright/test';

/**
 * Chega ao catálogo CLICANDO — as duas metades do menu, como o usuário faz.
 *
 * **O destino é `Catálogo`, não `Overview`, desde o M13.** A lista saiu da raiz: `/promptly` virou
 * o painel, como em memory/rag/lens. Este helper continuou clicando `Overview` e a jornada passou
 * a procurar links de prompt numa tela que já não os tem — falhando trinta segundos depois, no
 * timeout, dizendo apenas que um link não apareceu.
 *
 * O M25 sofreu o mesmo e foi corrigido em `afc0f72`; ESTE spec não, porque **ele não roda no CI**
 * (`e2e-ui.yml` enumera os specs um a um e não o inclui). Um spec fora do portão é um spec que
 * apodrece em silêncio — e foi o M13 que o apodreceu.
 */
async function navegarAteOCatalogoPeloMenu(page: Page) {
  await page.goto('/');
  await page.getByRole('complementary').getByRole('link', { name: /^prompts$/i }).click();
  // O submenu tem de TROCAR antes do clique seguinte: a raiz também tem itens de mesmo nome, e
  // clicar cedo demais acerta o dela com a navegação parecendo funcionar.
  await expect(page.getByRole('complementary').getByRole('link', { name: /^projects$/i })).toHaveCount(0);
  await page.getByRole('complementary').getByRole('link', { name: /^catalog$/i }).click();
  await expect(page).toHaveURL(/\/promptly\/catalog$/);
}

test.describe('M12 — autorar e comparar prompts pelo dashboard', () => {
  test('a jornada inteira: menu → criar → preview → salvar → comparar → reverter', async ({ page }) => {
    await navegarAteOCatalogoPeloMenu(page);

    // ---- A AUTORIA É ALCANÇÁVEL PELO MENU -------------------------------------------------
    // Este é o passo que o milestone existe para provar. Se o item de submenu faltar, morre
    // aqui — no passo que o usuário de fato daria, e não numa asserção sobre a URL.
    await page.getByRole('link', { name: /new revision/i }).first().click();
    await expect(page).toHaveURL(/\/promptly\/new$/);

    // ---- A PERMANÊNCIA É DITA ANTES DE GRAVAR ---------------------------------------------
    // Não há DELETE no produto. Descobrir isso depois de salvar é tarde demais para agir.
    await expect(page.getByText(/immutable/i)).toBeVisible();

    // ---- O PREVIEW RENDERIZA SEM CHAMAR MODELO --------------------------------------------
    await page.getByLabel('Prompt name').fill('boas-vindas');
    await page.getByLabel('Prompt text').fill('Hello {{name}}, welcome to {{product}}.');

    // Campo em branco deixa o marcador À VISTA — o buraco não pode passar despercebido.
    await expect(page.getByTestId('promptly-preview')).toContainText('{{name}}');

    await page.getByLabel('name', { exact: true }).fill('Paulo');
    await expect(page.getByTestId('promptly-preview')).toContainText('Hello Paulo');
    // E o que segue em branco continua marcado: o preview mostra o estado real, não um otimista.
    await expect(page.getByTestId('promptly-preview')).toContainText('{{product}}');

    // ---- O PORQUÊ É OBRIGATÓRIO (M17) ------------------------------------------------------
    // Sem descrição o botão fica DESABILITADO — a recusa acontece antes do clique, e não
    // depois. Provar isso aqui, e não só em teste de unidade, é o que garante que a regra
    // chega ao usuário: um `validarCriacao` correto ligado a um botão sempre habilitado
    // ficaria verde na unidade e quebrado na tela.
    await expect(page.getByRole('button', { name: /create revision/i })).toBeDisabled();

    await page.getByLabel('Why this revision exists').fill('primeira versão das boas-vindas');

    // E habilita assim que o porquê existe — o controle que dá sentido à asserção acima.
    await expect(page.getByRole('button', { name: /create revision/i })).toBeEnabled();

    // ---- SALVAR LEVA AO DETALHE DO PROMPT CRIADO ------------------------------------------
    await page.getByRole('button', { name: /create revision/i }).click();
    await expect(page).toHaveURL(/\/promptly\/boas-vindas$/);

    // ---- COMPARAR: alcançado a partir do prompt, não do menu -------------------------------
    // Comparar é POR PROMPT — uma entrada de menu exigiria um nome que o menu não tem.
    await navegarAteOCatalogoPeloMenu(page);
    // `exact` porque o M13 acrescentou o atalho `Comparar revisões de saudacao` em cada linha:
    // sem ele o localizador casa DOIS elementos e o Playwright recusa por strict mode.
    await page.getByRole('link', { name: 'saudacao', exact: true }).click();
    // Esperar o CATÁLOGO DESMONTAR antes de procurar `Comparar`, e não só a URL mudar.
    //
    // A tela de detalhe é lazy (`app.tsx`), então durante a transição o React mantém o DOM
    // anterior montado enquanto a URL já é a nova — `toHaveURL` passa e o localizador seguinte
    // ainda resolve no catálogo. Desde o M13 o catálogo tem um link `Comparar revisões de X` por
    // linha, então o Playwright recusa por strict mode e a mensagem culpa o seletor, não a corrida.
    // O campo de busca só existe no catálogo: a ausência dele prova a troca.
    await expect(page).toHaveURL(/\/promptly\/saudacao$/);
    await expect(page.getByRole('searchbox')).toHaveCount(0);
    await page.getByRole('link', { name: /compare/i }).click();
    await expect(page).toHaveURL(/\/promptly\/saudacao\/diff$/);

    // A tela precisa ter TERMINADO de carregar antes de qualquer contagem. `count()` NÃO
    // auto-espera — foi assim que a primeira versão deste teste falhou contra uma tela correta,
    // medindo o fallback de Suspense em vez do conteúdo.
    await expect(page.getByRole('heading', { name: /differences/i })).toBeVisible();

    // O conteúdo do diff, não o status da página: a tela mostra alguma diferença OU declara que
    // não há. As duas são respostas; uma página em branco não é nenhuma.
    const temDiff = await page.getByTestId('promptly-diff').count();
    const temIguais = await page.getByTestId('promptly-diff-identical').count();
    expect(temDiff + temIguais).toBeGreaterThan(0);

    // ---- REVERTER: o verbo que fechava a jornada e faltava no e2e (FU-1) -------------------
    // Vai no MESMO teste, não num novo: a DoD pede UM e2e da jornada, e um segundo arquivo
    // provaria os passos isolados em vez da costura entre eles.
    await page.getByRole('link', { name: /back to saudacao/i }).click();
    await expect(page).toHaveURL(/\/promptly\/saudacao$/);

    await page.getByLabel(/Roll back to revision v1/i).first().click();

    // A confirmação nomeia a revisão que será CRIADA, e DIZ que o histórico não encolhe.
    //
    // A asserção negativa mudou de forma na tradução para inglês, e a razão vale registrar: ela
    // proibia a frase "volta para", porque um texto assim faria o operador esperar o histórico
    // encolher — e ele nunca encolhe. Em inglês, o TÍTULO legítimo passou a ser "Roll … back to
    // v1", que nomeia o alvo e é exatamente o que a tela deve dizer. Proibir "back to" passou a
    // proibir o produto correto.
    //
    // A intenção nunca foi banir palavras: era garantir que a confirmação NÃO promete reversão
    // de histórico. Isso se afirma melhor pelo positivo — a frase que o corpo tem de conter — do
    // que por uma lista de frases que ele não pode ter.
    await expect(page.getByText(/creates revision v\d+/i)).toBeVisible();
    await expect(page.getByText(/history does not shrink/i)).toBeVisible();

    await page.getByRole('textbox').last().fill('saudacao');
    await page.getByRole('button', { name: /^roll back$/i }).click();

    // Este prompt serve DOIS ambientes, então reverter sem nomear um produz a recusa tipada
    // `400 label_required` — e a tela tem de transformá-la em ESCOLHA, não repetir o erro.
    // É o caminho mais rico da jornada, e o que a fixture de propósito produz.
    await expect(page.getByText(/which environment do you want to roll back/i)).toBeVisible();

    // Os labels vêm do que o SERVIÇO devolveu, como botões — nunca um campo de digitação.
    // Um label digitado errado é respondido como "prompt não encontrado", com o nome de um
    // prompt que existe; oferecer só o que a API devolveu torna esse engano inalcançável.
    await expect(page.getByRole('button', { name: 'prod', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'staging', exact: true })).toBeVisible();
  });

  // O par "vazio oferece criar / vazio-por-FALHA não oferece" NÃO está aqui, e a ausência é
  // decisão medida: os mocks deste repositório interceptam no `fetch` da aplicação, antes da
  // camada de rede, então `page.route` nunca vê a chamada e o teste ficaria VERDE sem exercitar
  // nada — um guard que não distingue os dois estados é pior que nenhum. O par vive em
  // `src/pages/promptly.test.tsx`, onde a falha é injetável de verdade. E o milestone pede UM
  // e2e da jornada, não um por asserção.
});
