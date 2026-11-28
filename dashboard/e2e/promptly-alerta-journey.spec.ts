// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 The LoopScale Authors
//
// M22 — definir um monitor de PROMPT pela tela, sem `curl`.
//
// A `v0.83.0` liberou `prompt_resolutions` no backend e o validou no `app-dev`, mas o `Select` de
// métrica desta tela era fechado sobre três opções: a capacidade existia e era inalcançável por
// quem não montasse o `POST` à mão (`getloopscale/loop-console#459`).
//
// A navegação é por CLIQUE, a partir da raiz. Validar digitando o endereço usa o único caminho que
// o usuário real não tem — foi assim que quatro telas do `loopguardrails` ficaram inalcançáveis com
// três rodadas de validação passando por cima.
//
// A primeira versão deste spec dizia isso no cabeçalho e fazia `page.goto('/observability/alerts')`
// na linha seguinte. Um comentário que descreve o oposto do código abaixo dele é pior que nenhum.
//
// HONESTIDADE SOBRE O ESCOPO: roda hermético contra o Vite local com `VITE_USE_MOCKS=true`, como
// todo e2e deste repositório. Prova a JORNADA DA INTERFACE — não prova que a regra criada dispara
// contra o serviço implantado. Essa metade se verifica contra o ambiente e se registra como
// evidência de aceitação; afirmá-la aqui seria teatro.

import { test, expect, type Page } from '@playwright/test';

/** Chega à tela de alertas pelo MENU, a partir da raiz — nunca pelo endereço. */
async function navegarAteAlertasPeloMenu(page: Page) {
  await page.goto('/');
  await page.getByRole('complementary').getByRole('link', { name: /^observability$/i }).click();
  await page.getByRole('complementary').getByRole('link', { name: /^alerts$/i }).click();
  await expect(page).toHaveURL(/\/observability\/alerts$/);
}

test.describe('M22 — o monitor de prompt pela tela', () => {
  test('do menu à regra criada, com o uso medido e o estado de avaliação visíveis', async ({ page }) => {
    await navegarAteAlertasPeloMenu(page);

    // The create form is a modal, opened from the page's primary action.
    await page.getByRole('button', { name: /new alert rule/i }).click();

    // ---- A quarta métrica está oferecida ------------------------------------------------
    await page.getByRole('combobox', { name: /Metric/i }).click();
    await expect(page.getByRole('option', { name: /prompt/i })).toBeVisible();

    // ---- E as TRÊS de workspace seguem lá (regressão — a tela é compartilhada) -----------
    for (const rotulo of [/error rate/i, /cost/i, /latency/i]) {
      await expect(page.getByRole('option', { name: rotulo })).toBeVisible();
    }

    await page.getByRole('option', { name: /prompt/i }).click();

    // ---- O campo de prompt aparece SÓ agora ---------------------------------------------
    const campoPrompt = page.getByLabel(/^Prompt$/i);
    await expect(campoPrompt).toBeVisible();

    // ---- Sem o nome do prompt, criar fica bloqueado --------------------------------------
    await page.getByLabel(/Rule name/i).fill('uso da saudação');
    await page.getByLabel(/Threshold/i).fill('3');
    await page.getByRole('combobox', { name: /Notify webhook/i }).click();
    await page.getByRole('option', { name: /prod hook/i }).click();
    await expect(page.getByRole('button', { name: /create rule/i })).toBeDisabled();

    // ---- DoD-2: o valor MEDIDO aparece ao lado do limiar ---------------------------------
    // Um limite escolhido às cegas é o alerta mal calibrado que o M21 nomeia como risco. Este
    // bloco faltava na primeira versão do spec, e é o modo de falha mais visual da fatia.
    await campoPrompt.fill('saudacao');
    await expect(page.getByTestId('valor-medido')).toBeVisible();

    // ---- Com o nome, cria ---------------------------------------------------------------
    await expect(page.getByRole('button', { name: /create rule/i })).toBeEnabled();
    await page.getByRole('button', { name: /create rule/i }).click();

    // A asserção é a LINHA na lista, não uma mensagem de sucesso — uma mensagem pode aparecer
    // sem nada ter sido gravado.
    const linha = page.getByRole('row').filter({ hasText: 'uso da saudação' });
    await expect(linha).toBeVisible();

    // ---- DoD-4: a regra recém-criada diz que AINDA NÃO foi avaliada ----------------------
    // O avaliador roda a cada 60 s. Um travessão aqui faz o operador concluir que falhou e criar
    // a segunda regra. Esta asserção é a que teria pegado a coluna faltando por três commits.
    await expect(linha.getByText(/not evaluated yet/i)).toBeVisible();
  });

  test('a aba de produção leva ao monitor, e o destino JÁ VEM preenchido', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('complementary').getByRole('link', { name: /^prompts$/i }).click();
    await expect(page.getByRole('complementary').getByRole('link', { name: /^projects$/i })).toHaveCount(0);
    await page.getByRole('complementary').getByRole('link', { name: /^catalog$/i }).click();

    await page.getByRole('link', { name: 'saudacao', exact: true }).click();
    await page.getByRole('link', { name: 'Production usage' }).click();
    await expect(page).toHaveURL(/\/promptly\/saudacao\/production$/);

    // ---- CLICAR no caminho, não apenas conferir o href -----------------------------------
    // A primeira versão terminava em `toHaveAttribute('href', /prompt=saudacao/)` e chamava isso
    // de "leva ao monitor, carregando o nome". Provava o PRODUTOR do deep-link, e o destino
    // descartava o parâmetro — o operador caía num formulário vazio, em `error_rate`. Um link
    // cujo consumidor não existe não é um caminho: é um link que finge levar a algum lugar.
    await page.getByRole('link', { name: /monitor/i }).click();
    await expect(page).toHaveURL(/\/observability\/alerts\?prompt=saudacao$/);

    // O que prova a chegada: o formulário já está na métrica certa, com o nome preenchido.
    await expect(page.getByLabel(/^Prompt$/i)).toHaveValue('saudacao');
  });
});
