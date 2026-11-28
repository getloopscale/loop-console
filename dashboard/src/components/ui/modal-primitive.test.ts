// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const SRC = resolve(__dirname, '../..');

/**
 * Plano `modal-primitive-consolidation` — UM primitivo de modal, e só um.
 *
 * ## O que este teste trava
 *
 * O dashboard tinha DOIS wrappers locais de `@radix-ui/react-dialog`:
 * `ui/dialog.tsx` (composto: `Dialog.Root/Content/Header/…`) e `ui/app-modal.tsx`
 * (declarativo: `<AppModal size=… />`). O overlay era idêntico byte a byte, e o
 * `app-modal` se declarava, no próprio doc-comment, *"the system-wide
 * standardized modal primitive"* — enquanto 17 call sites usavam o outro,
 * inclusive os três modais compartilhados que o resto do produto copia.
 *
 * Enquanto a porta errada existir, ela é uma opção. Deletar `ui/dialog.tsx` foi
 * o passo que impediu a volta; este teste é o que impede a PRÓXIMA.
 *
 * ## Por que quantificar sobre o import do Radix, e não sobre nomes de arquivo
 *
 * Um teste que procurasse `ui/dialog.tsx` verificaria a FORMA: bastaria alguém
 * criar `ui/modal-v2.tsx` para reintroduzir o problema com a suíte verde. O que
 * define um segundo primitivo não é o nome — é compor `@radix-ui/react-dialog`
 * por conta própria.
 *
 * Então a asserção é sobre o EFEITO: exatamente um arquivo de produção pode
 * importar o Radix dialog, e ele é o primitivo. Qualquer outro é, por definição,
 * uma segunda porta.
 */

const PRIMITIVO = 'components/ui/app-modal.tsx';

/**
 * O nome LOCAL do primitivo neste arquivo, ou `null` se ele não o importa.
 *
 * ## Por que resolver pelo import, e não pela tag
 *
 * A primeira versão abria os casos com `if (!src.includes('<AppModal')) continue`.
 * O review de testes derrubou isso com uma sonda de quatro linhas: trocar para
 * `import { AppModal as Modal }` + `<Modal` fez o guard passar **4/4 com o
 * `form=` removido da árvore**. Um alias — coisa que ninguém escreve por
 * malícia, e que qualquer refactor de conflito de nomes produz — tirava o
 * arquivo inteiro de cobertura sem que nada acusasse.
 *
 * É a mesma lição que o cabeçalho deste arquivo já pregava para o OUTRO caso
 * ("um teste que procurasse `ui/dialog.tsx` verificaria a FORMA") e que eu não
 * apliquei aqui. O import é o fato; a tag é a grafia dele.
 */
function nomeLocalDoPrimitivo(src: string): string | null {
  const m = src.match(
    /import\s*\{([^}]*)\}\s*from\s*'@\/components\/ui\/app-modal'/,
  );
  if (!m) return null;
  for (const parte of m[1].split(',')) {
    const [orig, alias] = parte.split(/\s+as\s+/).map((s) => s.trim());
    if (orig === 'AppModal') return alias ?? orig;
  }
  return null;
}



function arquivosDeProducao(dir = SRC, out: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    if (entrada === 'node_modules' || entrada === 'vendor' || entrada === 'mocks') continue;
    const caminho = join(dir, entrada);
    if (statSync(caminho).isDirectory()) arquivosDeProducao(caminho, out);
    else if (/\.tsx?$/.test(entrada) && !/\.(test|spec)\.tsx?$/.test(entrada)) out.push(caminho);
  }
  return out;
}

describe('primitivo de modal único', () => {
  it('só o `app-modal` compõe o Radix dialog', () => {
    const donos = arquivosDeProducao()
      .filter((f) => /from '@radix-ui\/react-dialog'/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f).replace(/\\/g, '/'))
      .sort();

    expect(
      donos,
      'Mais de um arquivo de produção compõe `@radix-ui/react-dialog`.\n\n' +
        'Isso é um SEGUNDO primitivo de modal, independentemente do nome do\n' +
        'arquivo. Foi exatamente assim que o dashboard chegou a ter dois wrappers\n' +
        'com overlay idêntico e escalas de largura diferentes: um deles se\n' +
        'declarava o padrão, e dezessete call sites usavam o outro.\n\n' +
        'Se a tela precisa de algo que o `AppModal` não oferece, a resposta é\n' +
        'estender o `AppModal` — uma prop nova serve todo mundo; um primitivo novo\n' +
        'serve quem o escreveu e divide o produto.\n',
    ).toEqual([PRIMITIVO]);
  });

  it('no screen opens a side drawer or the upstream dialog', () => {
    // The console has ONE way to show a transient screen: the centered `AppModal`. A side
    // drawer (`Sheet`) or the design system `Dialog` is a second way, with its own width,
    // header and footer, and that is how "Add secret" came to slide in from the right while
    // "New environment", on the screen next to it, opened in the middle.
    //
    // The command palette is the one exception: it is a search box, with no title bar and no
    // footer, so the layout of a modal does not apply to it.
    const EXCEPTIONS = new Set(['components/command/command-palette.tsx']);
    const offenders: string[] = [];
    let scanned = 0;
    for (const f of arquivosDeProducao()) {
      const rel = relative(SRC, f).replace(/\\/g, '/');
      const src = readFileSync(f, 'utf8');
      scanned++;
      if (EXCEPTIONS.has(rel)) continue;
      for (const m of src.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*'@getloopscale\/ui'/g)) {
        const names = m[1].split(',').map((part) => part.trim().split(/\s+as\s+/)[0]);
        for (const name of names) {
          if (name === 'Sheet' || name === 'Dialog') offenders.push(`${rel}: ${name}`);
        }
      }
    }
    expect(scanned, 'the guard scanned no file').toBeGreaterThanOrEqual(200);
    expect(
      offenders,
      'A screen imports `Sheet` or `Dialog` from the design system.\n\n' +
        'Use `AppModal` (`@/components/ui/app-modal`). If it lacks something the screen needs,\n' +
        'add it to `AppModal`, so every modal gets it.\n',
    ).toEqual([]);
  });

  it('every creation route opens its form as a modal over the list it came from', () => {
    // `/skills/new`, `/promptly/new` and `/trust/guardrails/new` were whole pages while every
    // other creation in the console was a modal. A route ending in `/new` now renders the list
    // and, after it, a screen built on `RouteModal`.
    const lazy = readFileSync(join(SRC, 'app-routes-lazy.ts'), 'utf8');
    const fileOf = (component: string): string => {
      const found = new RegExp(`export const ${component} = lazy\\(\\(\\) =>\\s*import\\('@/([^']+)'\\)`).exec(lazy);
      if (!found) throw new Error(`no lazy import for ${component}`);
      return join(SRC, `${found[1]}.tsx`);
    };
    const offenders: string[] = [];
    let creationRoutes = 0;
    for (const f of arquivosDeProducao(join(SRC, 'routes'))) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/<Route path="([^"]*\/new)" element=\{([^\n]+)\} \/>/g)) {
        creationRoutes++;
        const components = [...m[2].matchAll(/<([A-Z]\w+) \/>/g)].map((c) => c[1]);
        const form = components.at(-1);
        if (components.length < 2 || !form || !/<RouteModal\b/.test(readFileSync(fileOf(form), 'utf8'))) {
          offenders.push(m[1]);
        }
      }
    }
    expect(creationRoutes, 'the guard found no creation route').toBeGreaterThanOrEqual(3);
    expect(offenders, 'Render the list and then a screen built on RouteModal.\n').toEqual([]);
  });

  it('a confirmation that deletes, removes or revokes is marked destructive', () => {
    // Found on staging: "Delete project" opened with the neutral button and no warning mark,
    // while "Delete Team", one screen away, had both. The mark and the red button come from
    // `intent="destructive"`, and a call site that forgets it looks like a harmless question.
    const offenders: string[] = [];
    let confirmations = 0;
    for (const f of arquivosDeProducao()) {
      const src = readFileSync(f, 'utf8');
      // The element ends at the `/>` that sits at the indent of its own opening tag: a `/>`
      // further in belongs to something inside `description`.
      for (const m of src.matchAll(/^([ \t]*)<ConfirmDialog\b([\s\S]*?)\n\1\/>/gm)) {
        confirmations++;
        const props = m[2];
        const title = /title=\{?[`"']([^\n]{0,80})/.exec(props)?.[1] ?? '';
        const label = /confirmLabel=\{?[`"']([^\n`"']{0,40})/.exec(props)?.[1] ?? '';
        const destroys = /^(delete|remove|revoke)\b/i.test(title) || /^(delete|remove|revoke)\b/i.test(label);
        if (destroys && !/\bintent=/.test(props)) {
          offenders.push(`${relative(SRC, f).replace(/\\/g, '/')}: ${title || label}`);
        }
      }
    }
    expect(confirmations, 'the guard scanned no confirmation').toBeGreaterThanOrEqual(20);
    expect(offenders, 'Add `intent="destructive"` to the ConfirmDialog.\n').toEqual([]);
  });

  it('nenhum call site escolhe uma largura da MESMA FAMÍLIA dos tokens', () => {
    // O outro modo de a padronização vazar: manter um primitivo só e deixar a
    // largura voltar pelo `className` de cada call site.
    //
    // A regra é precisa de propósito, e a distinção importa:
    //
    //   `max-w-2xl` em `contentClassName`  → um TOKEN disfarçado. É `lg`, escrito
    //                                        à mão, e é assim que a escala perde o
    //                                        monopólio de "quão largo é um modal".
    //   `max-w-none` + `w-[75vw]`          → uma OPÇÃO DE SAIR da escala. O modal
    //                                        deixa de ser "um passo de largura" e
    //                                        vira outra coisa — um editor de
    //                                        página com trilho, no caso do
    //                                        `rag/wiki.tsx`, com o motivo escrito
    //                                        na linha acima.
    //
    // O doc do `AppModal` chama `contentClassName` de *"escape hatch for a rare
    // bespoke width/spacing"*. Proibi-lo por inteiro seria o teste contradizendo o
    // contrato do primitivo que ele existe para proteger. `max-w-none` é
    // autoexplicativo: ele DIZ que não há largura máxima.
    const ofensores: string[] = [];
    let varridos = 0;
    for (const f of arquivosDeProducao()) {
      const src = readFileSync(f, 'utf8');
      if (!nomeLocalDoPrimitivo(src)) continue;
      varridos++;
      // `="…"` e `={"…"}` — a forma de expressão também precisa ser vista.
      for (const m of src.matchAll(/contentClassName=\{?"([^"]*)"\}?/g)) {
        // `max-w-none` é a saída explícita; qualquer outro `max-w-*` é um token
        // da escala escrito à mão.
        if (/max-w-(?!none\b)[a-z0-9]/.test(m[1])) {
          ofensores.push(`${relative(SRC, f).replace(/\\/g, '/')}: ${m[1]}`);
        }
      }
    }

    // O piso de não-vacuidade, e a razão de ele existir DUAS vezes:
    //
    // `ofensores` vazio tem duas causas indistinguíveis — nenhum call site declara
    // largura (o que se quer), ou o laço não varreu call site nenhum (o que passaria
    // verde com a padronização inteira quebrada). Só a contagem separa as duas.
    //
    // Eu já tinha posto este piso no caso do rodapé e NÃO aqui, e a minha própria
    // re-verificação do achado deu "fechado" porque procurou o literal
    // `toBeGreaterThanOrEqual(20)` no ARQUIVO e o encontrou — no outro caso. É a
    // sexta ocorrência, nesta fatia, de medir o arquivo em vez do construto; quem
    // pegou foi o lint, reclamando de uma variável contada e nunca usada.
    expect(varridos, 'o guard não varreu call site nenhum').toBeGreaterThanOrEqual(20);

    expect(
      ofensores,
      'Largura de modal declarada em `contentClassName` em vez do token `size`.\n\n' +
        'A escala existe para que "quão largo é este modal" tenha UMA resposta no\n' +
        'produto inteiro. Uma largura no call site é como a deriva recomeça — e ela\n' +
        'recomeça sem que nada quebre, que é o que a torna difícil de ver.\n\n' +
        'Use `size` (`sm` `md` `lg` `xl`). Se nenhum token serve, acrescente um à\n' +
        'escala em `app-modal.tsx` com o motivo — aí a escolha vale para todos.\n\n' +
        'Se o modal não pertence à escala (um editor em tela cheia, por exemplo),\n' +
        '`max-w-none` com uma largura de viewport é a saída explícita e aceita.\n',
    ).toEqual([]);
  });

  it('todo botão de enviar dentro de um modal alcança o seu form', () => {
    // O `AppModal` renderiza o `footer` FORA do container dos children. Quando o
    // botão de confirmar é `type="submit"` e o `<form>` está no corpo, mover o
    // footer o tira do form: a tela renderiza IDÊNTICA e o clique não faz nada.
    //
    // Foi o defeito mais caro desta migração. O teste de `delete-environment`
    // pegou — "Number of calls: 0" — mas três dos catorze call sites não têm
    // teste co-locado, então a suíte sozinha não teria pego todos, e uma revisão
    // visual por amostra também não.
    //
    // A saída é o atributo NATIVO `form="id"`, que `create-project-sheet.tsx` e
    // `add-domain-sheet.tsx` já usavam antes desta migração — o idioma existia,
    // faltava aplicá-lo. Verificado no navegador: `submit.form.id` resolve com o
    // botão fora do form.
    //
    // Este caso troca a amostra por uma quantificação: TODO submit dentro de um
    // AppModal, em todo arquivo de produção.
    const quebrados: string[] = [];
    let varridos = 0;
    for (const f of arquivosDeProducao()) {
      const src = readFileSync(f, 'utf8');
      if (!nomeLocalDoPrimitivo(src)) continue;
      varridos++;

      const ids = new Set([...src.matchAll(/<form[^>]*\bid="([^"]+)"/g)].map((m) => m[1]));
      // B-193 — um `id` também pode ser uma EXPRESSÃO. `add-webhook-dialog.tsx` usa `useId()`,
      // que é a resposta da própria plataforma para o problema que ids literais têm: dois
      // diálogos montados na mesma página compartilhariam o literal, e um `<label htmlFor>`
      // ambíguo manda o leitor de tela para o campo errado.
      //
      // Aceitar `id={x}` + `form={x}` não afrouxa o guarda — prova a mesma coisa de forma mais
      // forte, porque exige o MESMO identificador dos dois lados em vez de duas strings que só
      // por hábito coincidem. O que continua reprovado é o que sempre foi o defeito: um submit
      // no footer sem `form` nenhum.
      const idsPorExpressao = new Set(
        [...src.matchAll(/<form[^>]*\bid=\{([A-Za-z0-9_$.]+)\}/g)].map((m) => m[1]),
      );
      const rel = relative(SRC, f).replace(/\\/g, '/');

      // SÓ a região do `footer={…}`, e não o arquivo inteiro.
      //
      // A primeira versão varria o arquivo e acusou `rag/graphrag.tsx`, que tem
      // um `<form>` com submit no CORPO DA PÁGINA — nada a ver com o modal, que
      // vem depois. Medir o ARQUIVO em vez do CONSTRUTO é o erro que este
      // repositório vem repetindo: foi ele que pôs a escala de tokens na tabela
      // de "larguras ad-hoc" do levantamento, e que me fez atribuir um
      // `max-w-sm` de um `<div>` de layout ao modal de `memory/skills.tsx`.
      for (const abre of src.matchAll(/footer=\{/g)) {
        let nivel = 0;
        let i = abre.index! + 'footer='.length;
        const inicio = i;
        while (i < src.length) {
          if (src[i] === '{') nivel++;
          else if (src[i] === '}' && --nivel === 0) break;
          i++;
        }
        const regiao = src.slice(inicio, i);
        for (const m of regiao.matchAll(/<Button\b[^>]*?type="submit"[^>]*?>/gs)) {
          const literal = m[0].match(/\bform="([^"]+)"/)?.[1];
          const expressao = m[0].match(/\bform=\{([A-Za-z0-9_$.]+)\}/)?.[1];
          if (literal === undefined && expressao === undefined) {
            quebrados.push(`${rel}: submit no footer sem \`form=\``);
          } else if (literal !== undefined && !ids.has(literal)) {
            quebrados.push(`${rel}: form="${literal}" não existe no arquivo`);
          } else if (expressao !== undefined && !idsPorExpressao.has(expressao)) {
            quebrados.push(`${rel}: form={${expressao}} não casa nenhum \`<form id={…}>\``);
          }
        }
      }
    }

    expect(varridos, 'o guard não varreu call site nenhum').toBeGreaterThanOrEqual(20);

    expect(
      quebrados,
      'Botão de enviar num modal sem alcançar o seu `<form>`.\n\n' +
        'O `AppModal` renderiza o `footer` FORA dos children. Um `type="submit"`\n' +
        'ali não pertence ao `<form>` do corpo, e o clique NÃO FAZ NADA — a tela\n' +
        'renderiza idêntica e a ação some. É o pior modo de falha possível numa\n' +
        'confirmação destrutiva.\n\n' +
        'Dê um `id` ao `<form>` e `form="<id>"` ao botão. É o atributo nativo do\n' +
        'HTML, e o idioma que `create-project-sheet.tsx` já usava.\n',
    ).toEqual([]);
  });

  it('o primitivo existe e expõe a escala — a asserção acima não passa por vacuidade', () => {
    // Sem este caso, apagar `app-modal.tsx` faria o primeiro caso falhar (bom)
    // mas esvaziar a escala passaria despercebido no segundo. É a contraparte
    // positiva: quem afirma ausência precisa provar que olhou.
    const primitivo = readFileSync(join(SRC, PRIMITIVO), 'utf8');
    for (const token of ['sm:', 'md:', 'lg:', 'xl:']) {
      expect(primitivo, `a escala perdeu o token \`${token.slice(0, -1)}\``).toContain(token);
    }
    expect(primitivo).toMatch(/max-w-/);
  });
});

describe('no dialog is made by hand', () => {
  it('only the shared modal gives an element the dialog role', () => {
    // The onboarding checklist and the Traces column choice were `<div role="dialog">` panels:
    // one pinned to a corner, the other 92px wide under its button. Neither imported a dialog
    // library, so the import ratchets above could not see them. The role is what makes a
    // dialog, so the role is what this looks for.
    const offenders: string[] = [];
    let scanned = 0;
    for (const f of arquivosDeProducao()) {
      const rel = relative(SRC, f).replace(/\\/g, '/');
      scanned++;
      if (rel === PRIMITIVO) continue;
      if (/role=["'{]+(?:alert)?dialog/.test(readFileSync(f, 'utf8'))) offenders.push(rel);
    }
    expect(scanned).toBeGreaterThan(100);
    expect(offenders, 'Use AppModal (or ConfirmDialog, RouteModal) instead of a hand-made dialog').toEqual([]);
  });
});
