// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 The LoopScale Authors
//
// M13 T4.2 — a jornada do painel de prompts, ponta a ponta pela tela.
//
// Cobre: raiz → painel (pelo MENU) → catálogo (pelo MENU) → filtrar → comparar. É o ÚNICO e2e do
// milestone; o resto da cobertura vive em lógica pura e teste de componente (122 casos), seguindo
// o que o M12 e o M24 já fizeram.
//
// O QUE ESTE ARQUIVO PROVA, E POR QUE NAVEGA POR CLIQUE. No `loopguardrails` (M23) quatro telas foram
// declaradas no submenu e NUNCA abriram, porque faltava a linha em `resolveActiveMenu` — e três
// rodadas de validação passaram por cima, porque validavam digitando a URL, que é o único caminho
// que o usuário real não tem. Por isso aqui há UM único `page.goto`, na raiz: todo o resto é
// clique. Um `goto` a mais tornaria o spec verde sobre uma navegação quebrada.
//
// HONESTIDADE SOBRE O ESCOPO: roda hermético contra o Vite local com `VITE_USE_MOCKS=true`, como
// todo e2e deste repositório. Prova a JORNADA DA INTERFACE — não prova que o `Link … rel="next"`
// atravessa o BFF real até o navegador. Essa metade é verificada contra o `app-dev` e registrada
// como evidência de aceitação; um mock jamais poderia prová-la.
//
// NENHUM PASSO CLICA EM CONTROLE FATURÁVEL: a única rota faturável do produto é
// `POST /evaluations/runs` (derivado por varredura do marcador `ModelInvoker`), e ela não está
// nesta jornada.

import { test, expect } from '@playwright/test';

test.describe('M13 — a jornada do painel de prompts', () => {
  test('painel → catálogo → comparar, sempre por clique', async ({ page }) => {
    // O ÚNICO goto do arquivo. Daqui em diante, só clique.
    await page.goto('/');

    // --- 1. chegar ao painel pelo MENU, não pela URL ---
    // A entrada da capacidade é um BOTÃO de drill-in (`drillsInto: 'promptly'`) que abre o
    // submenu E navega para a raiz; os itens do submenu também são botões, não links. Medido no
    // snapshot da própria jornada — eu havia suposto links, e é para isso que este e2e existe.
    await page.getByRole('complementary').getByRole('link', { name: 'Prompts', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Prompts', level: 1 })).toBeVisible();

    // O painel responde a pergunta que a lista não responde.
    await expect(page.getByText(/what is not live yet/i)).toBeVisible();
    await expect(page.getByTestId('kpi-nao-promovidos')).toBeVisible();

    // --- 2. chegar ao catálogo pelo painel ---
    await page.getByRole('link', { name: /see the catalog/i }).click();
    await expect(page.getByRole('heading', { name: /prompt catalog/i, level: 1 })).toBeVisible();
    await expect(page.getByText('saudacao')).toBeVisible();

    // --- 3. a busca filtra NO SERVIDOR, e a tela não se desculpa mais (M16) ---
    //
    // Até o M16 esta linha exigia a frase "o filtro roda sobre os prompts já carregados nesta
    // página". Ela era verdadeira, e por isso estava na tela. Deixou de ser: o termo vai ao
    // servidor. Manter a exigência seria travar uma desculpa por uma limitação que não existe
    // mais — pior que não ter guarda nenhuma.
    await expect(page.getByText(/carregad/i)).toHaveCount(0);
    await page.getByRole('searchbox').fill('saud');
    await expect(page.getByText('saudacao')).toBeVisible();
    await expect(page.getByText('despedida')).toHaveCount(0);

    // --- 4. o terceiro estado vazio: filtro sem resultado ≠ workspace vazio (EC-2) ---
    await page.getByRole('searchbox').fill('zzz-nao-existe');
    await expect(page.getByRole('link', { name: /criar o primeiro/i })).toHaveCount(0);
    await page.getByRole('button', { name: /limpar/i }).click();
    await expect(page.getByText('saudacao')).toBeVisible();

    // --- 5. comparar, a um clique da linha ---
    await page.getByRole('link', { name: /compare revisions of saudacao/i }).click();
    await expect(page).toHaveURL(/\/promptly\/saudacao\/diff/);
  });

  test('o catálogo é alcançável pelo submenu, não só pelo botão do painel', async ({ page }) => {
    // A metade da navegação que ninguém lembra: declarar o item não basta; `resolveActiveMenu`
    // precisa reconhecer a rota para o submenu ABRIR. Este teste falha se ela sumir.
    await page.goto('/');

    await page.getByRole('complementary').getByRole('link', { name: 'Prompts', exact: true }).click();
    await page.getByRole('complementary').getByRole('link', { name: 'Catalog', exact: true }).click();

    await expect(page.getByRole('heading', { name: /prompt catalog/i, level: 1 })).toBeVisible();
  });
});
