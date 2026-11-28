// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 The LoopScale Authors
//
// M15 T5.1 — a jornada até o uso por revisão, ponta a ponta pela tela.
//
// Cobre: raiz → prompts (pelo MENU) → catálogo → detalhe de um prompt → a coluna de uso, nos
// TRÊS estados que o milestone promete distinguir. É o único e2e do milestone; o resto da
// cobertura vive em lógica pura (`usage.ts`, 6 casos) e teste de componente (6 casos).
//
// POR QUE NAVEGA POR CLIQUE. No `loopguardrails` (M23) quatro telas foram declaradas no submenu e
// nunca abriram, porque faltava a linha em `resolveActiveMenu` — e três rodadas de validação
// passaram por cima, porque validavam digitando a URL, que é o único caminho que o usuário real
// não tem. Há UM `page.goto` neste arquivo, na raiz.
//
// O QUE ESTE ARQUIVO PROVA, E O QUE NÃO PROVA. Roda hermético contra o Vite local com
// `VITE_USE_MOCKS=true`. Prova a jornada da INTERFACE e as três renderizações distintas — não
// prova que o span de resolução sai do `loopprompt`, chega ao `looptrace` e volta agregado
// pelo BFF. Essa metade é verificada contra o `app-dev` e registrada como evidência de
// aceitação; nenhum mock poderia prová-la, e dizer o contrário seria o defeito que este
// milestone existe para eliminar.
//
// NENHUM PASSO CLICA EM CONTROLE FATURÁVEL: a rota faturável desta capacidade é o botão
// "Rodar" do playground, e ele não está nesta jornada.

import { test, expect } from '@playwright/test';

test.describe('M15 — a jornada do uso por revisão', () => {
  test('raiz → catálogo → detalhe → a coluna de uso, sempre por clique', async ({ page }) => {
    // O ÚNICO goto do arquivo.
    await page.goto('/');

    await page.getByRole('complementary').getByRole('link', { name: 'Prompts', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Prompts', level: 1 })).toBeVisible();

    // Do painel para o catálogo, pelo submenu — não pela URL.
    await page.getByRole('complementary').getByRole('link', { name: /catalog/i }).click();
    await expect(page.getByRole('heading', { name: /prompt catalog/i, level: 1 })).toBeVisible();

    // E do catálogo para o detalhe, clicando no prompt. O título da tela É o nome do prompt —
    // esperar por ele é o que garante que a navegação terminou antes de olhar a coluna.
    await page.getByRole('link', { name: 'saudacao' }).first().click();
    await expect(page.getByRole('heading', { name: 'saudacao', level: 1 })).toBeVisible();
    await expect(page.getByText('v3', { exact: true })).toBeVisible();

    // --- estado 1: houve uso, com custo ---
    // A janela precisa estar DITA na tela: implícita, o operador atribuiria o número ao
    // período errado.
    await expect(page.getByText(/usage \(7 days\)/i)).toBeVisible();
    await expect(page.getByText('12', { exact: true })).toBeVisible();
    await expect(page.getByText(/US\$ 0\.0312/)).toBeVisible();
    // O DoD-2 do ROADMAP enumera QUATRO números por revisão, não dois.
    await expect(page.getByText(/4\.2 ms · 1500 tokens/)).toBeVisible();

    // --- estado 2: houve uso, custo AUSENTE — vazio com razão, nunca estimado (DoD-4) ---
    await expect(page.getByText('4', { exact: true })).toBeVisible();
    await expect(page.getByText(/reported no cost/i)).toBeVisible();
    // E a condição do ADR-1 aparece, em vez de o operador ter de inferir do vazio.
    await expect(page.getByText(/same trace/i)).toBeVisible();

    // --- estado 3: revisão sem tráfego — "sem chamadas", que é diferente de zero (DoD-3) ---
    await expect(page.getByText(/no calls in the period/i).first()).toBeVisible();
  });

  test('quando a leitura do uso FALHA, a tela diz isso — e não mostra zeros', async ({ page }) => {
    // A distinção inteira do milestone. Um zero renderizado sobre uma leitura que falhou é
    // indistinguível de um zero verdadeiro, e leva o operador à conclusão oposta: "ninguém
    // usou este prompt, posso apagar".
    // NÃO com `page.route`: os mocks deste repositório são um wrap de `window.fetch`, não rede
    // real (ADR D1 — não é MSW), então a interceptação do Playwright nunca veria a requisição.
    // O interruptor entra antes de qualquer script da página, sem `goto` extra.
    await page.addInitScript(() => sessionStorage.setItem('__mock_uso', 'indisponivel'));

    await page.goto('/');
    await page.getByRole('complementary').getByRole('link', { name: 'Prompts', exact: true }).click();
    await page.getByRole('complementary').getByRole('link', { name: /catalog/i }).click();
    await page.getByRole('link', { name: 'saudacao' }).first().click();

    await expect(page.getByRole('heading', { name: 'saudacao', level: 1 })).toBeVisible();
    await expect(page.getByText('v3', { exact: true })).toBeVisible();
    await expect(page.getByText(/could not read this prompt usage/i).first()).toBeVisible();
    // O oráculo negativo, que é o que dá sentido ao positivo acima.
    await expect(page.getByText(/no calls in the period/i)).toHaveCount(0);
  });
});
