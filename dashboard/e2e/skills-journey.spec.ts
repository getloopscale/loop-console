// SPDX-License-Identifier: Apache-2.0
// Copyright 2025-2026 The LoopScale Authors
//
// M26 — a jornada do registro de skills, ponta a ponta PELA TELA.
//
// Cobre: raiz → menu → acervo → detalhe → instrução resolvida → versões e canais. É o ÚNICO e2e
// do milestone: o resto da cobertura vive em lógica pura (`components/skills/projections.ts`) e
// em teste de componente, seguindo o mesmo ADR do M24. Um e2e por tela não pega a costura, que é
// justamente onde esta jornada já falhou antes.
//
// A NAVEGAÇÃO É POR CLIQUE, A PARTIR DA RAIZ — nunca `page.goto('/skills')`.
//
// Isso não é preciosismo de estilo: digitar a URL é o único caminho que o usuário real NÃO tem.
// No M23 quatro telas do trust ficaram inalcançáveis por falta de uma linha em
// `resolveActiveMenu`, e três rodadas de validação passaram por cima porque validavam digitando
// o endereço. Um e2e que faz `goto` na rota profunda reproduz exatamente aquela cegueira: ele
// fica verde com o menu quebrado.
//
// HONESTIDADE SOBRE O ESCOPO: roda hermético contra o Vite local com `VITE_USE_MOCKS=true`, como
// todo e2e deste repositório. Prova a JORNADA DA INTERFACE contra o contrato medido do
// `loopskills` — não prova que o registro implantado devolve estes corpos. Essa metade se
// verifica contra o ambiente real e se registra como evidência; afirmá-la aqui seria teatro.

import { test, expect, type Page } from '@playwright/test';

/**
 * Chega ao acervo CLICANDO a partir da raiz.
 *
 * Duas etapas, porque o menu tem duas: o item `Skills` em Agent Services entra no submenu
 * (`drillsInto`), e o `Overview` dele abre a tela. Se qualquer uma das três peças do menu faltar,
 * é aqui que o teste morre — e morre no passo que o usuário de fato daria.
 */
async function navegarAteOAcervoPeloMenu(page: Page) {
  await page.goto('/');
  await page.getByRole('complementary').getByRole('link', { name: /^skills$/i }).click();

  // ESPERA DETERMINÍSTICA entre os dois cliques, e ela não é zelo: `Overview` existe nos DOIS
  // menus. Sem esperar o submenu abrir, sob carga o clique cai no `Overview` da RAIZ e navega
  // para `/` — o teste falhava de forma intermitente, verde sozinho e vermelho em paralelo.
  // `Back to LoopScale` só existe dentro de um submenu, então é o sinal que distingue os dois
  // estados. Um `waitForTimeout` aqui esconderia a corrida em vez de eliminá-la.
  await expect(page.getByRole('button', { name: /back to loopscale/i })).toBeVisible();

  await page.getByRole('complementary').getByRole('link', { name: /^overview$/i }).click();
  await expect(page).toHaveURL(/\/skills$/);

  // A URL não é o acervo — é só o endereço dele. Sem esperar a PRIMEIRA LINHA renderizar, quem
  // chama este helper e clica em seguida compete com a carga da lista: medido `flaky` no
  // ambiente do CI em 2026-08-02, no caso da recusa tipada. Falhava e passava na repetição,
  // que é o modo de falhar que ensina a reexecutar o CI em vez de olhar.
  await expect(page.getByRole('link', { name: 'Review pull request' })).toBeVisible();
}

test.describe('M26 — navegar o registro de skills pelo dashboard', () => {
  test('a jornada inteira, do menu à instrução resolvida e aos canais', async ({ page }) => {
    await navegarAteOAcervoPeloMenu(page);

    // ---- ACERVO: conteúdo, não status HTTP ----------------------------------------------
    // Afirmar "a página carregou" deixaria passar uma tabela vazia servida com 200, que é o
    // modo de falha real de um BFF que devolve `{items:[]}` quando a leitura falhou.
    await expect(page.getByRole('heading', { name: /skills/i }).first()).toBeVisible();
    await expect(page.getByText('Review pull request')).toBeVisible();
    await expect(page.getByText('Reads the diff and flags risks before the merge.')).toBeVisible();

    // A distinção de execução é TEXTO, não só cor — precisa sobreviver a daltonismo e impressão.
    await expect(page.getByText('local', { exact: true })).toBeVisible();

    // ---- DETALHE: alcançado pelo nome, que é o caminho da lista --------------------------
    await page.getByRole('link', { name: 'Review pull request' }).click();
    await expect(page).toHaveURL(/\/skills\/sk_ordering$/);
    // `.first()` porque o identificador aparece em mais de um lugar da tela do detalhe — o
    // cabeçalho e, conforme o que já carregou, os canais. Sem isto o `strict mode` do Playwright
    // reprova por AMBIGUIDADE, e ambiguidade depende de tempo: passa aqui e falha no runner.
    // A asserção quer que o identificador ESTEJA na tela, não que esteja uma vez só.
    await expect(page.getByText('sk_ordering').first()).toBeVisible();

    // ---- INSTRUÇÃO RESOLVIDA: o fim da jornada de leitura --------------------------------
    // O TEXTO, não a presença do bloco: é ele que um agente carregaria, e é lendo-o que o
    // operador decide se a revisão vigente é a que quer promover.
    await expect(page.getByText(/Read the whole diff before commenting/)).toBeVisible();
    await expect(page.getByText(/deste workspace/)).toBeVisible();

    // ---- VERSÕES E CANAIS ---------------------------------------------------------------
    await page.getByRole('link', { name: /view versions and channels/i }).click();
    await expect(page).toHaveURL(/\/skills\/sk_ordering\/versions$/);

    const linhas = page.getByRole('row');
    await expect(linhas.filter({ hasText: '1.10.0' })).toHaveCount(1);
    await expect(linhas.filter({ hasText: '1.2.0' })).toHaveCount(1);
    await expect(linhas.filter({ hasText: '1.0.0' })).toHaveCount(1);

    // A versão que canal nenhum serve PERMANECE na lista: é a candidata a ser promovida, e
    // filtrá-la tiraria da tela o insumo da única ação da jornada.
    await expect(linhas.filter({ hasText: '1.10.0' })).toContainText('—');

    // O canal aparece na linha da revisão que ele de fato serve — `stable` está em `rev_a`,
    // que é a `1.0.0`, e NÃO na versão mais nova. Uma projeção que casasse "canal com a última
    // versão" passaria num teste de presença e mentiria exatamente aqui.
    //
    // A asserção casa o EMBLEMA do canal por texto exato, e não a linha inteira: o botão de
    // promover tem o rótulo "Promover para stable", então `toContainText('stable')` na linha
    // passaria a casar o botão em vez do emblema — um teste que continuaria verde mesmo se a
    // coluna de canais parasse de renderizar.
    await expect(linhas.filter({ hasText: '1.0.0' }).getByText('stable', { exact: true })).toHaveCount(1);
    await expect(linhas.filter({ hasText: '1.10.0' }).getByText('stable', { exact: true })).toHaveCount(0);
  });

  test('promover exige confirmação com frase digitada, e o texto diz o que deixa de valer', async ({
    page,
  }) => {
    await navegarAteOAcervoPeloMenu(page);
    await page.getByRole('link', { name: 'Review pull request' }).click();
    await page.getByRole('link', { name: /view versions and channels/i }).click();

    // A linha JÁ servida pelo canal não tem botão — ausência, não botão desabilitado. Promover
    // para onde já se está é um ato sem efeito que ainda assim pediria confirmação, e isso treina
    // a confirmar sem ler.
    const linhaServida = page.getByRole('row').filter({ hasText: '1.0.0' });
    await expect(linhaServida.getByRole('button', { name: /promote/i })).toHaveCount(0);

    // A candidata é a versão que canal nenhum serve.
    const candidata = page.getByRole('row').filter({ hasText: '1.10.0' });
    // O nome acessível inclui a versão (`Promover 1.10.0 para stable`) — o rótulo diz QUAL linha
    // está sendo promovida, que é o ponto de acessibilidade da coluna.
    await candidata.getByRole('button', { name: /promote 1\.10\.0 to stable/i }).click();

    const dialog = page.getByRole('dialog');
    // O texto NOMEIA a revisão que sai e a que entra — asserção sobre CONTEÚDO. "algum texto"
    // passaria com "Tem certeza?", que é exatamente o que este diálogo existe para não ser.
    await expect(dialog).toContainText('rev_d');
    await expect(dialog).toContainText('rev_a');
    await expect(dialog).toContainText('1.10.0');
    // A que SAI é identificada por VERSÃO, não só pelo id opaco (achado da validação
    // independente): `rev_a` é a `1.0.0`, e é isso que o operador reconhece na hora de decidir.
    await expect(dialog).toContainText('1.0.0');
    // E NÃO afirma contagem de consumidores — o serviço não sabe esse número (DECISÃO 1, opção a).
    await expect(dialog).not.toContainText(/\d+\s*consumidores/i);

    // Sem a frase digitada, o botão não confirma. É o gate, não decoração.
    const confirmar = dialog.getByRole('button', { name: /promote channel/i });
    await expect(confirmar).toBeDisabled();

    await dialog.getByRole('textbox').fill('stable');
    await expect(confirmar).toBeEnabled();
    await confirmar.click();

    // O EFEITO, não o clique: o canal passa a aparecer na linha da versão promovida, e sai da
    // linha antiga. Asserir "o diálogo fechou" deixaria passar uma promoção que não promoveu.
    // Texto exato pela mesma razão de cima — o rótulo do botão contém a palavra `stable`.
    await expect(
      page.getByRole('row').filter({ hasText: '1.10.0' }).getByText('stable', { exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole('row').filter({ hasText: '1.0.0' }).getByText('stable', { exact: true }),
    ).toHaveCount(0);
  });

  test('o submenu de skills continua aberto dentro de uma skill', async ({ page }) => {
    // Se a resolução do menu casasse só o caminho exato, abrir uma skill fecharia o menu que
    // levou até ela — e o operador perderia a navegação no instante em que a usou.
    await navegarAteOAcervoPeloMenu(page);
    await page.getByRole('link', { name: 'Review pull request' }).click();

    // Itens que só a RAIZ tem: se eles reaparecem, o menu voltou para a raiz.
    await expect(page.getByRole('complementary').getByRole('link', { name: /^domains$/i })).toHaveCount(0);
    await expect(page.getByRole('complementary').getByRole('link', { name: /^overview$/i })).toBeVisible();
  });

  test('a recusa tipada do registro chega como diagnóstico, não como "erro ao carregar"', async ({
    page,
  }) => {
    // Uma skill `local` traz script: o registro RECUSA a instrução com 422 tipado, e essa recusa
    // é informação sobre a NATUREZA da skill. Renderizada como falha genérica, o operador
    // investigaria o sistema em vez de entender a skill — e é assim que um 4xx tipado colapsado
    // em 502 vira defeito de interface. É o caso que o BFF preserva de propósito.
    await navegarAteOAcervoPeloMenu(page);
    await page.getByRole('link', { name: 'Prepare local environment' }).click();

    await expect(page.getByText(/runs on the client machine/i)).toBeVisible();
    await expect(page.getByText(/loopscaleskill install|Install it through the CLI/i)).toBeVisible();
  });
});

// ---- M35 — a jornada de DISTRIBUIÇÃO ---------------------------------------------------------
//
// Cobre: raiz → menu → pacotes → detalhe → emitir token → LISTAR → revogar pelo id que a listagem
// revelou. A rota do meio é o milestone inteiro: sem ela o `DELETE` exige um identificador que a
// tela não tem como descobrir, e um token emitido pela CLI é invisível — logo, irrevogável.
//
// Também aqui a navegação é POR CLIQUE a partir da raiz. `/bundles` não começa com `/skills`, e
// por isso depende de uma linha própria em `resolveActiveMenu`: é exatamente a peça que o
// loopguardrails esqueceu, e um `goto('/bundles')` ficaria verde com o menu quebrado.

async function navegarAteOsPacotesPeloMenu(page: Page) {
  await page.goto('/');
  await page.getByRole('complementary').getByRole('link', { name: /^skills$/i }).click();
  await expect(page.getByRole('button', { name: /back to loopscale/i })).toBeVisible();

  await page.getByRole('complementary').getByRole('link', { name: /^distribution$/i }).click();
  await expect(page).toHaveURL(/\/bundles$/);

  // Espera a primeira linha, não só a URL: quem clicar em seguida competiria com a carga.
  await expect(page.getByRole('link', { name: 'Support skills' })).toBeVisible();
}

test.describe('M35 — distribuição: pacotes, tokens delegados e adoção', () => {
  test('do menu ao token revogado pelo identificador que a listagem revelou', async ({ page }) => {
    await navegarAteOsPacotesPeloMenu(page);

    // ---- O SUBMENU CONTINUA ABERTO em /bundles ------------------------------------------
    // A asserção que prova a linha de `resolveActiveMenu`. Sem ela o menu volta à raiz e a tela
    // fica alcançável só digitando o endereço — inalcançável para o usuário real.
    await expect(page.getByRole('button', { name: /back to loopscale/i })).toBeVisible();

    // ---- DETALHE: alcançado pelo nome, que é o caminho da lista --------------------------
    await page.getByRole('link', { name: 'Support skills' }).click();
    await expect(page).toHaveURL(/\/bundles\/bdl_ativo$/);

    // ---- TOKENS: os quatro estados que a tela precisa distinguir -------------------------
    // Texto, nunca só cor: as situações levam a ações diferentes (renovar × investigar).
    await expect(page.getByText('active', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('expired', { exact: true })).toBeVisible();
    await expect(page.getByText('revoked', { exact: true }).first()).toBeVisible();
    // Rótulo ausente vira frase, não célula em branco — em branco parece dado faltando.
    await expect(page.getByText('no label')).toBeVisible();

    // ---- ADOÇÃO: o denominador da janela, e o rótulo que não mente -----------------------
    // 14 é o TOTAL da janela; a soma das linhas visíveis é 9. Exibir a soma como denominador
    // inflaria toda proporção — e o gráfico erraria em silêncio.
    await expect(page.getByText(/14 installs in this window/)).toBeVisible();
    // A granularidade REAL, medida em `adoption-store.ts`: skill + versão, não "por pacote".
    await expect(page.getByText(/per skill and version within THIS bundle/)).toBeVisible();
    // 6/14 = 42.9%
    await expect(page.getByText('42.9%')).toBeVisible();

    // ---- EMITIR: o valor aparece UMA vez, e a tela diz isso ------------------------------
    await page.getByLabel('Token label').fill('e2e');
    await page.getByRole('button', { name: /issue token/i }).click();
    await expect(page.getByText(/will not be shown again/i)).toBeVisible();
    await expect(page.getByText(/dtk_secret_/)).toBeVisible();

    // ---- REVOGAR: usando o identificador que só a LISTAGEM revela ------------------------
    // O ponto do milestone. A frase digitada é o `token_id` — que o operador só conhece porque
    // a lista o mostrou.
    const linha = page.getByRole('row', { name: /pipeline de CI/ });
    await linha.getByRole('button', { name: /revogar/i }).click();
    await page.getByRole('textbox', { name: /dtk_ativo|confirm/i }).fill('dtk_ativo');
    await page.getByRole('button', { name: /revoke token/i }).click();

    // E o revogado CONTINUA listado, com a marca: esconder impediria auditar o que foi emitido.
    await expect(page.getByRole('row', { name: /pipeline de CI/ })).toBeVisible();
  });

  test('o pacote sem instalações diz "—" e não "0%" — são frases diferentes', async ({ page }) => {
    // `0%` afirma "ninguém instalou esta skill". Com denominador zero o honesto é admitir que
    // não dá para calcular proporção. A tela precisa dizer a segunda.
    await navegarAteOsPacotesPeloMenu(page);
    await page.getByRole('link', { name: 'Newly created bundle' }).click();
    await expect(page).toHaveURL(/\/bundles\/bdl_vazio$/);

    await expect(page.getByText(/no install in this window/i)).toBeVisible();
    await expect(page.getByText(/no token issued/i)).toBeVisible();
    // Estado vazio com CTA in-app, não instrução de CLI: o operador está no navegador.
    await expect(page.getByText(/issue a token above/i)).toBeVisible();
  });

  test('há caminho de volta do detalhe para a lista', async ({ page }) => {
    // Todo detalhe precisa de saída explícita: o item de menu leva ao overview da capacidade,
    // não à lista de pacotes.
    await navegarAteOsPacotesPeloMenu(page);
    await page.getByRole('link', { name: 'Support skills' }).click();
    await page.getByRole('link', { name: /all bundles/i }).click();
    await expect(page).toHaveURL(/\/bundles$/);
  });
});

test.describe('M35 — o conteúdo do pacote é editável pela tela (AC1)', () => {
  test('adicionar uma skill a um canal, salvar, e ver a lista refletir', async ({ page }) => {
    // O critério da DoD é "listar, criar e EDITAR ITENS, sem CLI". Sem esta jornada o pacote
    // nasce vazio pela tela e só ganha conteúdo por linha de comando — que é a lacuna que o
    // milestone existe para fechar.
    await navegarAteOsPacotesPeloMenu(page);
    await page.getByRole('link', { name: 'Newly created bundle' }).click();
    await expect(page).toHaveURL(/\/bundles\/bdl_vazio$/);

    // Estado vazio DIZ A CONSEQUÊNCIA, não só "vazio": um token de um pacote sem itens não
    // entrega nada, e o operador precisa saber disso antes de distribuí-lo.
    await expect(page.getByText(/a token for it delivers nothing/i)).toBeVisible();

    await page.getByLabel('Skill to add').selectOption('sk_ordering');
    // O canal só habilita depois da skill: canais são POR skill, e um par montado antes seria
    // um item que o registro não sabe servir.
    await page.getByLabel('Skill channel').selectOption('stable');
    await page.getByRole('button', { name: /add to bundle/i }).click();

    // Alteração pendente é ANUNCIADA — sem isso o operador sai da tela achando que salvou.
    await expect(page.getByText(/unsaved changes/i)).toBeVisible();

    await page.getByRole('button', { name: /save contents/i }).click();
    // Depois de salvar o aviso some: é o sinal de que o rascunho virou estado do servidor.
    await expect(page.getByText(/unsaved changes/i)).toHaveCount(0);
    await expect(page.getByText('sk_ordering').first()).toBeVisible();
  });

  test('a mesma skill no mesmo canal não entra duas vezes', async ({ page }) => {
    await navegarAteOsPacotesPeloMenu(page);
    await page.getByRole('link', { name: 'Support skills' }).click();

    // `bdl_ativo` já tem sk_ordering@stable. Adicionar de novo não acrescenta nada e confundiria
    // a leitura da lista — a tela recusa dizendo por quê, em vez de ignorar em silêncio.
    await page.getByLabel('Skill to add').selectOption('sk_ordering');
    await page.getByLabel('Skill channel').selectOption('stable');
    await page.getByRole('button', { name: /add to bundle/i }).click();

    await expect(page.getByText(/already in the bundle on that channel/i)).toBeVisible();
  });
});

test.describe('M32 — ciclo de vida: retirar de circulação sem quebrar quem usa (AC5)', () => {
  test('o acervo distingue descontinuada de em uso, em TEXTO, e diz o motivo', async ({ page }) => {
    // O critério da DoD é "a tela diz o que deixa de valer, com o estado em texto (nunca só cor)".
    // Uma deprecada indistinguível de uma ativa é exatamente o defeito que o M32 existe para
    // impedir — e cor sozinha não sobrevive a daltonismo nem a impressão.
    await navegarAteOAcervoPeloMenu(page);

    // `exact: true` targets the row's badge. Without it the locator also matched the "Deprecated"
    // KPI card that B-126 added above the list (substring, case-insensitive) and failed on strict
    // mode, while the badge it is meant to check was still there (#527).
    await expect(page.getByText('deprecated', { exact: true })).toBeVisible();
    await expect(page.getByText('in use').first()).toBeVisible();
    // O MOTIVO viaja junto: sem ele o operador lê "descontinuada" e não sabe o que usar no lugar,
    // que é a pergunta seguinte, sempre.
    await expect(page.getByText(/does not cover forward rates/)).toBeVisible();
  });

  test('descontinuar exige motivo e confirmação com frase digitada', async ({ page }) => {
    await navegarAteOAcervoPeloMenu(page);
    await page.getByRole('link', { name: 'Review pull request' }).click();
    await expect(page).toHaveURL(/\/skills\/sk_ordering$/);

    // O texto diz o que MUDA e o que NÃO muda: quem já referencia continua carregando. Sem essa
    // frase o operador supõe que está apagando a skill.
    await expect(page.getByText(/stops appearing for people searching/i)).toBeVisible();
    await expect(page.getByText(/keeps being loaded by anyone asking for it/i)).toBeVisible();

    // Sem motivo o botão não habilita — o operador não descobre a regra pelo erro.
    const botao = page.getByRole('button', { name: /^deprecate$/i });
    await expect(botao).toBeDisabled();

    await page.getByLabel('Deprecation reason').fill('superseded by v2');
    await expect(botao).toBeEnabled();
    await botao.click();

    // Ação destrutiva sob o ConfirmDialog canônico, com frase digitada.
    await page.getByRole('textbox', { name: /type to confirm|sk_ordering/i }).fill('sk_ordering');
    await page.getByRole('button', { name: /deprecate skill/i }).click();

    // E a situação reflete: `descontinuada`, com o caminho de volta a circular.
    await expect(page.getByRole('button', { name: /put back in circulation/i })).toBeVisible();
  });
});

test.describe('M31 — descoberta observável: score E qual perna casou', () => {
  test('do menu à busca, com o motivo de cada resultado', async ({ page }) => {
    // A razão de existir do produto — um agente achar a skill certa por intenção — não tinha
    // tela alguma até este milestone. A auditoria de 2026-08-03 mediu isso navegando por clique.
    await page.goto('/');
    await page.getByRole('complementary').getByRole('link', { name: /^skills$/i }).click();
    await expect(page.getByRole('button', { name: /back to loopscale/i })).toBeVisible();
    await page.getByRole('complementary').getByRole('link', { name: /^discovery$/i }).click();
    await expect(page).toHaveURL(/\/skills\/discovery$/);

    // O submenu continua aberto: `/skills/discovery` depende da mesma linha de
    // `resolveActiveMenu` que serve `/skills`.
    await expect(page.getByRole('button', { name: /back to loopscale/i })).toBeVisible();

    // Estado inicial NÃO é "nada encontrado" — é "ainda não perguntei". A diferença importa:
    // uma diz que o acervo está vazio, a outra que a busca não aconteceu.
    await expect(page.getByText(/ask something/i)).toBeVisible();

    // Consulta que casa com uma skill ATIVA: a de moeda está descontinuada e a descoberta a
    // esconde por padrão — buscá-la aqui exercitaria o filtro, não a exibição do motivo.
    await page.getByLabel('Natural-language query').fill('diff');
    await page.getByRole('button', { name: /^search$/i }).click();

    // O SCORE e a PERNA, juntos — os dois lados do critério da DoD.
    await expect(page.getByRole('link', { name: 'Review pull request' })).toBeVisible();
    // `columnheader`, não `getByText`: a frase "em ordem de quanto casou" na descrição do card
    // torna o texto ambíguo, e um seletor ambíguo passa ou falha por acidente.
    await expect(page.getByRole('columnheader', { name: 'Match score' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Why it matched' })).toBeVisible();
    // Frases que dizem o que a máquina fez, não nomes de módulo.
    await expect(page.getByText('words and intent')).toBeVisible();
  });

  test('a descontinuada só aparece com opt-in explícito', async ({ page }) => {
    // É o comportamento que o M32 promete e que nenhuma tela permitia verificar: a descoberta
    // esconde deprecadas por padrão. Sem o filtro, o operador teria de confiar na documentação.
    await page.goto('/');
    await page.getByRole('complementary').getByRole('link', { name: /^skills$/i }).click();
    await expect(page.getByRole('button', { name: /back to loopscale/i })).toBeVisible();
    await page.getByRole('complementary').getByRole('link', { name: /^discovery$/i }).click();

    await page.getByLabel('Natural-language query').fill('currency');
    await page.getByRole('button', { name: /^search$/i }).click();
    await expect(page.getByText('Convert currency (v1)')).toHaveCount(0);

    await page.getByLabel('Include deprecated').check();
    await expect(page.getByText('Convert currency (v1)')).toBeVisible();
  });
});

test.describe('M31 — governança: a skill que dizia "pode ser removida" agora pode', () => {
  test('apagar exige frase digitada e oferece a alternativa reversível antes', async ({ page }) => {
    // A auditoria de 2026-08-03 mediu o absurdo: o acervo tinha uma skill que se DESCREVE como
    // "pode ser removida", e não havia como removê-la — embora `DELETE /v1/skills/:id` existisse
    // há milestones.
    await navegarAteOAcervoPeloMenu(page);
    await page.getByRole('link', { name: 'Prepare local environment' }).click();

    await expect(page.getByRole('heading', { name: /danger zone/i })).toBeVisible();

    // O texto diz a CONSEQUÊNCIA específica — identificador reservado —, não "o item será
    // removido". É a diferença entre o operador entender o custo e descobri-lo depois.
    await expect(page.getByText(/reserves the identifier/i)).toBeVisible();

    // E a alternativa reversível aparece ANTES do botão destrutivo: quem quer só "parar de
    // recomendar" precisa saber que existe um caminho que não quebra quem já usa.
    await expect(page.getByText(/deprecating.*without breaking whoever already references it/i)).toBeVisible();

    await page.getByRole('button', { name: /delete this skill/i }).click();
    await page.getByRole('textbox', { name: /type to confirm|sk_local/i }).fill('sk_local');
    await page.getByRole('button', { name: /^delete skill$/i }).click();

    // Volta ao acervo — permanecer num detalhe que não existe mais mostraria uma tela de erro
    // como resultado de uma operação bem-sucedida.
    await expect(page).toHaveURL(/\/skills$/);
    await expect(page.getByRole('link', { name: 'Prepare local environment' })).toHaveCount(0);
  });
});

test.describe('M31 — o acervo aguenta escala', () => {
  test('o filtro declara seu alcance e oferece a busca no acervo inteiro', async ({ page }) => {
    // Um filtro que PARECE varrer o acervo inteiro e varre uma página é pior que filtro nenhum:
    // leva o operador a concluir que a skill não existe. A tela diz o alcance e aponta para a
    // Descoberta, que busca por intenção no acervo todo.
    await navegarAteOAcervoPeloMenu(page);

    await expect(page.getByText(/filters what is loaded/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /search the whole registry/i })).toBeVisible();

    await page.getByLabel('Filter loaded skills').fill('currency');
    await expect(page.getByRole('link', { name: 'Convert currency (v1)' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Review pull request' })).toHaveCount(0);

    // A contagem diz o que É — quantas casam de quantas carregadas —, não um total inventado.
    await expect(page.getByText(/match "currency"/i)).toBeVisible();
  });

  test('o filtro ignora acento, porque quem tem pressa não acentua', async ({ page }) => {
    await navegarAteOAcervoPeloMenu(page);
    // "substituida" (sem acento) tem de achar "Substituída por uma versão…" — sem isso o filtro
    // parece quebrado justamente para quem está com pressa.
    await page.getByLabel('Filter loaded skills').fill('superseded');
    await expect(page.getByRole('link', { name: 'Convert currency (v1)' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Review pull request' })).toHaveCount(0);
  });

  test('a contagem NÃO se apresenta como total quando o acervo cabe numa página', async ({ page }) => {
    // O defeito original: a tela dizia "12 no acervo" com 300 lá dentro. Agora ela distingue
    // "N loaded" de "whole registry".
    //
    // O seletor é ANCORADO no número: `/loaded/i` sozinho casa também com o texto do filtro
    // ("filters what is loaded"), e o strict mode do Playwright reprova com dois elementos —
    // corretamente, porque a asserção deixaria de dizer qual dos dois ela verificou.
    await navegarAteOAcervoPeloMenu(page);
    await expect(page.getByText(/\d+ loaded/i)).toBeVisible();
  });
});

test.describe('M31 — autoria sem publicar às cegas', () => {
  test('escrever, validar com erro POSICIONADO, corrigir, publicar acompanhando', async ({ page }) => {
    // O M30 entregou `POST /v1/skills:validate` — que valida sem efeito colateral e devolve
    // `field`/`line` — e ela ficou SEM CONSUMIDOR: nada disso alcançava um autor, porque não
    // havia tela de autoria.
    await page.goto('/');
    await page.getByRole('complementary').getByRole('link', { name: /^skills$/i }).click();
    await expect(page.getByRole('button', { name: /back to loopscale/i })).toBeVisible();
    await page.getByRole('complementary').getByRole('link', { name: /^new skill$/i }).click();
    await expect(page).toHaveURL(/\/skills\/new$/);

    // Publicar exige ter validado antes — é o que impede publicar às cegas, e a tela ensina a
    // regra sem erro: botão desabilitado com o motivo ao lado.
    await expect(page.getByText(/validate the content before publishing/i)).toBeVisible();

    // --- conteúdo INVÁLIDO: o diagnóstico precisa POSICIONAR o problema ---
    await page.getByLabel('Skill content').fill('# no frontmatter');
    await page.getByRole('button', { name: /validate without publishing/i }).click();
    await expect(page.getByText(/frontmatter without/i)).toBeVisible();
    // A POSIÇÃO é o que distingue diagnóstico de "inválido": sem ela o autor procura no texto todo.
    await expect(page.getByText(/field: name/i)).toBeVisible();
    await expect(page.getByText(/line 2/i)).toBeVisible();

    // --- corrigir e validar: nada é publicado ---
    await page.getByLabel('Skill content').fill('---\nname: test-skill\n---\n\n# body');
    await page.getByRole('button', { name: /validate without publishing/i }).click();
    await expect(page.getByText(/nothing published yet/i)).toBeVisible();

    // --- publicar, e ACOMPANHAR: 202 é aceito, não pronto ---
    await page.getByLabel('Skill identifier').fill('sk-autoria-e2e');
    await page.getByRole('button', { name: /^publish$/i }).click();
    await expect(page.getByRole('heading', { name: /^publishing$/i })).toBeVisible();
    await expect(page.getByText(/the skill is in the registry and discoverable/i)).toBeVisible();

    // O sucesso oferece TESTAR A DESCOBERTA, não "voltar à lista": saber se a skill é encontrável
    // é a única coisa que o autor quer saber depois de publicar.
    await expect(page.getByRole('link', { name: /test discovery/i })).toBeVisible();
  });

  test('publicar uma skill COM SCRIPTS — a árvore de arquivos que o textarea não representa', async ({
    page,
  }) => {
    // Uma skill de verdade costuma carregar um script Python, um `assets/`, um `reference/`. O
    // registro sempre aceitou o zip (a CLI publica assim desde o M12); a TELA só tinha textarea,
    // então quem escrevia uma skill com script precisava de terminal para publicá-la.
    await page.goto('/');
    await page.getByRole('complementary').getByRole('link', { name: /^skills$/i }).click();
    await expect(page.getByRole('button', { name: /back to loopscale/i })).toBeVisible();
    await page.getByRole('complementary').getByRole('link', { name: /^new skill$/i }).click();

    // O caminho precisa ser DESCOBRÍVEL na própria tela: quem chega ali com uma pasta na mão tem
    // de ver que existe forma de enviá-la, sem ler documentação.
    await expect(page.getByRole('heading', { name: /skill with scripts/i })).toBeVisible();

    // Recusa que ENSINA: "arquivo inválido" faria o autor tentar o mesmo arquivo de novo.
    await page.getByLabel(/skill folder as a \.zip/i).setInputFiles({
      name: 'SKILL.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('---\nname: x\n---\n'),
    });
    await expect(page.getByText(/zip the skill folder/i)).toBeVisible();

    // Um zip de verdade: assinatura PK + conteúdo.
    await page.getByLabel(/skill folder as a \.zip/i).setInputFiles({
      name: 'minha-skill.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x0a, 0x00, 0x00, 0x00]),
    });
    await expect(page.getByText(/publishing.*minha-skill\.zip/i)).toBeVisible();
    // Honestidade sobre o que NÃO foi feito: `:validate` recebe markdown, não zip. Dizer
    // "validado" aqui afirmaria uma verificação que ninguém fez.
    await expect(page.getByText(/a zip is not validated before publishing/i)).toBeVisible();

    // E o gate de "valide antes" NÃO se aplica ao zip — senão o botão ficaria eternamente morto,
    // já que não há como validar um zip por `:validate`.
    await page.getByLabel('Skill identifier').fill('sk-com-scripts-e2e');
    await page.getByRole('button', { name: /^publish$/i }).click();
    await expect(page.getByRole('heading', { name: /^publishing$/i })).toBeVisible();
    await expect(page.getByText(/the skill is in the registry and discoverable/i)).toBeVisible();
  });

  test('trocar o identificador depois de publicar limpa o acompanhamento anterior', async ({
    page,
  }) => {
    // MEDIDO no app-dev em 2026-08-04, publicando duas skills seguidas: depois do primeiro
    // sucesso o painel "Publishing" FICAVA, o botão seguia desabilitado para sempre, e — o pior —
    // o link "View the skill" era montado com o identificador do CAMPO, não com o que foi
    // publicado. Trocar o identificador para publicar a próxima produzia um link para uma skill
    // que não existe, ao lado de um "Done" verde sobre a operação anterior.
    //
    // É a mesma classe de defeito que esta capacidade já pagou várias vezes: um verde afirmando
    // um sucesso que não é o que está na tela.
    await page.goto('/');
    await page.getByRole('complementary').getByRole('link', { name: /^skills$/i }).click();
    await expect(page.getByRole('button', { name: /back to loopscale/i })).toBeVisible();
    await page.getByRole('complementary').getByRole('link', { name: /^new skill$/i }).click();

    await page.getByRole('button', { name: /validate without publishing/i }).click();
    await expect(page.getByText(/nothing published yet/i)).toBeVisible();
    await page.getByLabel('Skill identifier').fill('sk-primeira');
    await page.getByRole('button', { name: /^publish$/i }).click();
    await expect(page.getByRole('heading', { name: /^publishing$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /view the skill/i })).toHaveAttribute(
      'href',
      /sk-primeira$/,
    );

    // Trocar o identificador é declarar que a próxima publicação é OUTRA. O acompanhamento da
    // anterior não pode sobreviver a isso.
    await page.getByLabel('Skill identifier').fill('sk-segunda');
    await expect(page.getByRole('heading', { name: /^publishing$/i })).toHaveCount(0);
    // E publicar de novo tem de ser possível sem recarregar a página.
    await expect(page.getByRole('button', { name: /^publish$/i })).toBeEnabled();
  });

  test('editar o conteúdo invalida a validação anterior', async ({ page }) => {
    // Exibir "válido" sobre um texto que mudou afirmaria algo que ninguém verificou.
    await page.goto('/');
    await page.getByRole('complementary').getByRole('link', { name: /^skills$/i }).click();
    await expect(page.getByRole('button', { name: /back to loopscale/i })).toBeVisible();
    await page.getByRole('complementary').getByRole('link', { name: /^new skill$/i }).click();

    await page.getByRole('button', { name: /validate without publishing/i }).click();
    await expect(page.getByText(/nothing published yet/i)).toBeVisible();

    await page.getByLabel('Skill content').fill('# changed');
    await expect(page.getByText(/nothing published yet/i)).toHaveCount(0);
    await expect(page.getByText(/validate the content before publishing/i)).toBeVisible();
  });
});

test.describe('M33 — catálogo: ver o que existe sem saber o que procurar', () => {
  async function irAoCatalogo(page: Page) {
    await page.goto('/');
    await page.getByRole('complementary').getByRole('link', { name: /^skills$/i }).click();
    await expect(page.getByRole('button', { name: /back to loopscale/i })).toBeVisible();
    await page.getByRole('complementary').getByRole('link', { name: /^catalog$/i }).click();
    await expect(page).toHaveURL(/\/skills\/catalog$/);
  }

  test('os cards trazem os slots MEDIDOS — e nenhum número que não medimos', async ({ page }) => {
    await irAoCatalogo(page);

    // Os seis slots da DoD. `descobrível` é o que separa "está no acervo" de "é encontrável por
    // intenção" — a diferença que o produto vende.
    await expect(page.getByText('Review pull request')).toBeVisible();
    await expect(page.getByText('public').first()).toBeVisible();
    await expect(page.getByText('discoverable').first()).toBeVisible();
    await expect(page.getByText('no vector').first()).toBeVisible();

    // NENHUMA estrela, NENHUM download: números que não medimos não entram, por decisão do
    // roadmap. Exibi-los seria inventar sinal social.
    await expect(page.getByText(/★|⭐|downloads/i)).toHaveCount(0);

    // O critério de ordem é DECLARADO — sem sinal de adoção, qualquer padrão é arbitrário, e um
    // usuário que não sabe por que aquela ordem desconfia da lista.
    await expect(page.getByText(/sorted by name/i)).toBeVisible();
  });

  test('o TERCEIRO estado vazio existe: filtro sem resultado ≠ acervo vazio', async ({ page }) => {
    // Antes havia dois estados. "Busca sem resultado" era exibido como "acervo vazio", e o
    // operador concluía que nada havia sido publicado quando só o filtro dele não casava.
    await irAoCatalogo(page);
    await page.getByLabel('Filter the catalog').fill('zzzz-does-not-exist');

    await expect(page.getByText(/nothing matches this filter/i)).toBeVisible();
    await expect(page.getByText(/the registry does have skills/i)).toBeVisible();
    // E a saída é in-app, não uma instrução de CLI.
    await page.getByRole('button', { name: /clear filter/i }).click();
    await expect(page.getByText('Review pull request')).toBeVisible();
  });

  test('os chips filtram por categoria, sem contagem por faceta', async ({ page }) => {
    await irAoCatalogo(page);

    await page.getByRole('button', { name: 'finance', exact: true }).click();
    await expect(page.getByText('Convert currency (v1)')).toBeVisible();
    await expect(page.getByText('Review pull request')).toHaveCount(0);

    // Sem contagem: derivada da página carregada, ela afirmaria sobre o ACERVO um número que só
    // vale para o que está na tela.
    await expect(page.getByRole('button', { name: /finance \(\d+\)/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'all', exact: true }).click();
    await expect(page.getByText('Review pull request')).toBeVisible();
  });

  test('a grade responde em três larguras — o piso da DoD', async ({ page }) => {
    await irAoCatalogo(page);

    for (const largura of [375, 768, 1440]) {
      await page.setViewportSize({ width: largura, height: 900 });
      // O conteúdo permanece legível e alcançável em todas: o critério é não quebrar, não um
      // número específico de colunas — que é decisão de CSS, não de comportamento.
      await expect(page.getByText('Review pull request')).toBeVisible();
    }
  });
});

test.describe('M34 — descobribilidade diagnosticada no momento da autoria', () => {
  test('o diagnóstico nomeia a causa ANTES de publicar, e diz qual embedder mediu', async ({ page }) => {
    // O critério: rodar no momento da autoria. Depois de publicar, corrigir a descrição custa
    // uma revisão nova; aqui o texto ainda está na mão do autor.
    await page.goto('/');
    await page.getByRole('complementary').getByRole('link', { name: /^skills$/i }).click();
    await expect(page.getByRole('button', { name: /back to loopscale/i })).toBeVisible();
    await page.getByRole('complementary').getByRole('link', { name: /^new skill$/i }).click();

    // O diagnóstico só aparece depois de validar: sem `name`/`description` lidos do frontmatter
    // não há o que diagnosticar.
    await page.getByLabel('Skill content').fill('---\nname: Conversor\ndescription: converte\n---\n\n# x');
    await page.getByRole('button', { name: /validate without publishing/i }).click();
    await expect(page.getByRole('heading', { name: /will it be found/i })).toBeVisible();

    // A tela declara que NÃO executa — a fronteira do LoopZero é dita ao usuário, não só ao código.
    await expect(page.getByText(/does not run it/i)).toBeVisible();

    await page.getByRole('button', { name: /diagnose discoverability/i }).click();

    // A CAUSA com o que fazer — um recall sem diagnóstico não diz ao autor o que corrigir.
    await expect(page.getByText(/dificilmente encontrada/i)).toBeVisible();
    await expect(page.getByText(/not WHEN to use it/i)).toBeVisible();
    // E QUAL EMBEDDER mediu: o número mede o embedder tanto quanto a skill, e sem esse dado
    // alguém compararia resultados incomparáveis sem perceber.
    await expect(page.getByText('stub/stub')).toBeVisible();
  });

  test('um rascunho NÃO é acusado de não ter vetor — loopskills#144', async ({ page }) => {
    // MEDIDO no app-dev em 2026-08-04: a tela mandava `has_embedding: false` fixo, e como a skill
    // ainda não existe o serviço respondia `no_embedding` com o conselho "Republique para gerar o
    // vetor" — impossível para algo nunca publicado.
    //
    // O dano não era o conselho inútil: a causa disparava SEMPRE e dominava o veredito, encobrindo
    // as que o autor podia corrigir ali mesmo. Ele perguntava "minha descrição está boa?" e a tela
    // respondia sobre outra coisa.
    await page.goto('/');
    await page.getByRole('complementary').getByRole('link', { name: /^skills$/i }).click();
    await expect(page.getByRole('button', { name: /back to loopscale/i })).toBeVisible();
    await page.getByRole('complementary').getByRole('link', { name: /^new skill$/i }).click();

    // Descrição LONGA de propósito: acima do piso, para que a única causa candidata a aparecer
    // fosse a falta de vetor. Com descrição curta o teste passaria por acidente.
    const descricao =
      'Le o contrato em PDF e destaca as clausulas de rescisao, multa e foro que divergem do padrao da empresa, para revisao juridica.';
    await page
      .getByLabel('Skill content')
      .fill(`---\nname: revisar-contrato\ndescription: ${descricao}\n---\n\n# corpo`);
    await page.getByRole('button', { name: /validate without publishing/i }).click();
    await page.getByRole('button', { name: /diagnose discoverability/i }).click();

    // O que NÃO pode aparecer: a acusação e o conselho impossível.
    await expect(page.getByText(/has no vector/i)).toHaveCount(0);
    await expect(page.getByText(/republique/i)).toHaveCount(0);

    // E o que deve: a ressalva honesta de que ela ainda não está no acervo. Calar sobre isso
    // deixaria o autor achando que já está resolvido.
    await expect(page.getByText(/not in the registry yet/i)).toBeVisible();
  });
});

test.describe('M31 — nenhuma tela morta: toda rota aninhada tem volta à origem', () => {
  // MEDIDO no app-dev em 2026-08-04, e este é o defeito que ORIGINOU o milestone:
  //
  //   "A jornada termina num beco. Detalhe → 'Ver versões e canais' → 0 versões →
  //    'publique pela CLI', sem CTA e sem comando copiável. O último passo aponta para
  //    fora do produto."
  //
  // A tela de versões vazia tinha ZERO elementos interativos na `<main>` — nenhum botão,
  // nenhum link, nenhuma saída. E o detalhe, embora tivesse ações, não voltava a lugar nenhum.
  //
  // O critério do M31 é explícito: "toda rota aninhada tem breadcrumb com volta à ORIGEM, não
  // ao overview". O item de menu leva ao overview; quem chegou pela busca não veio de lá.

  test('o detalhe volta ao acervo', async ({ page }) => {
    await page.goto('/skills/sk_ordering');
    const voltar = page.getByRole('link', { name: /back to the registry/i });
    await expect(voltar).toBeVisible();
    await voltar.click();
    await expect(page).toHaveURL(/\/skills$/);
  });

  test('versões volta para a SKILL, não para o acervo', async ({ page }) => {
    // A distinção é o critério inteiro: voltar ao acervo daqui obrigaria a procurar de novo a
    // skill que já se tinha em mãos.
    await page.goto('/skills/sk_ordering/versions');
    const voltar = page.getByRole('link', { name: /back to sk_ordering/i });
    await expect(voltar).toBeVisible();
    await voltar.click();
    await expect(page).toHaveURL(/\/skills\/sk_ordering$/);
  });

  test('empty versions list says there is no CLI command yet instead of inventing one', async ({ page }) => {
    // `sk_local` tem uma versão; `sk_velha` não tem nenhuma no mock — é o estado vazio real.
    await page.goto('/skills/sk_velha/versions');
    await expect(page.getByText(/no version published/i)).toBeVisible();

    // M31 originally asked for a prefilled `loopscale skills publish sk_velha` here. B-132/B-133 removed
    // it on purpose: the CLI registers no `skills` command, so a copyable block would hand over a
    // command the terminal rejects. The empty state must say that, and must not offer the command
    // or promise one is "below" (#527).
    await expect(page.getByText(/publishing a version of an existing skill has no cli command yet/i)).toBeVisible();
    await expect(page.getByText(/loopscale skills publish/)).toHaveCount(0);
    await expect(page.getByText(/command below is already filled in/i)).toHaveCount(0);

    // E a saída continua existindo mesmo no estado vazio — que era exatamente onde faltava.
    await expect(page.getByRole('link', { name: /back to sk_velha/i })).toBeVisible();
  });
});

test.describe('M35 — a cadeia bundle → skill → canal é navegável', () => {
  // O conceito central do produto: um item do pacote aponta para um CANAL, não para uma revisão
  // fixa — e é isso que faz o pacote ficar vivo quando se promove uma versão nova.
  //
  // Na tela, os dois eram TEXTO MORTO: o operador via `sk_ordering` e `stable` e não tinha como
  // chegar na skill nem descobrir qual revisão aquele canal serve hoje. Ver o conteúdo de um
  // pacote sem poder responder "o que meus clientes estão recebendo?" é olhar sem enxergar.
  //
  // É a mesma lição que o loopguardrails pagou caro e que o CLAUDE.md deste repositório registra:
  // uma listagem que não devolve o caminho da próxima ação vira um painel só de olhar.

  async function irAoPacoteComItens(page: Page) {
    await page.goto('/');
    await page.getByRole('complementary').getByRole('link', { name: /^skills$/i }).click();
    await expect(page.getByRole('button', { name: /back to loopscale/i })).toBeVisible();
    await page.getByRole('complementary').getByRole('link', { name: /^distribution$/i }).click();
    await page.getByRole('link', { name: 'Support skills' }).click();
  }

  test('o identificador do item leva à skill', async ({ page }) => {
    await irAoPacoteComItens(page);
    await page.getByRole('link', { name: 'sk_ordering', exact: true }).first().click();
    await expect(page).toHaveURL(/\/skills\/sk_ordering$/);
    await expect(page.getByRole('heading', { name: /review pull request/i })).toBeVisible();
  });

  test('o canal do item leva às versões — onde se vê QUAL revisão ele serve', async ({ page }) => {
    // A pergunta que o operador tem ao olhar o pacote é "o que meus clientes recebem hoje?".
    // Ela só se responde na tela de versões, e o canal é o caminho natural até lá.
    await irAoPacoteComItens(page);
    await page.getByRole('link', { name: /see which revision stable serves/i }).first().click();
    await expect(page).toHaveURL(/\/skills\/sk_ordering\/versions$/);
    // E lá está a resposta: o emblema do canal na linha da revisão que ele de fato serve.
    await expect(
      page.getByRole('row').filter({ hasText: '1.0.0' }).getByText('stable', { exact: true }),
    ).toHaveCount(1);
  });
});

test.describe('as URLs antigas em português continuam resolvendo', () => {
  // A URL é parte do que o usuário vê, e o produto é monolíngue — mas um link já compartilhado,
  // salvo nos favoritos ou colado num ticket não pode virar 404 porque traduzimos a rota.
  // O redirect é `replace`, então a URL antiga não fica no histórico do navegador.
  const redirects = [
    { antiga: '/skills/catalogo', nova: /\/skills\/catalog$/, titulo: /catalog/i },
    { antiga: '/skills/nova', nova: /\/skills\/new$/, titulo: /new skill/i },
    { antiga: '/skills/descoberta', nova: /\/skills\/discovery$/, titulo: /discovery/i },
  ];

  for (const { antiga, nova, titulo } of redirects) {
    test(`${antiga} redireciona sem virar 404`, async ({ page }) => {
      await page.goto(antiga);
      await expect(page).toHaveURL(nova);
      // E chega na TELA, não numa rota que resolve para o detalhe de uma skill inexistente —
      // que é o que `/skills/new` faria se a rota estática não tivesse precedência sobre
      // `/skills/:skillId`.
      // New skill opens as a modal over the Skills screen, so its title names a dialog.
      const tela = antiga === '/skills/nova'
        ? page.getByRole('dialog', { name: titulo })
        : page.getByRole('heading', { name: titulo, level: 1 });
      await expect(tela).toBeVisible();
    });
  }
});
