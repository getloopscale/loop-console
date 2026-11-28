import { Route, Navigate, useParams } from 'react-router-dom';
import { Boundaried } from '@/routes/boundaried';
import {
  PromptDetailPage,
  PromptlyCatalogPage,
  PromptlyCreatePage,
  PromptlyDiffPage,
  PromptlyOverviewPage,
  PromptlyPlaygroundPage,
} from '@/app-routes-lazy';

/**
 * As rotas do domínio `promptly` (B-003).
 *
 * Um VALOR JSX, e não um componente: `<Routes>` só percorre `<Route>` e
 * `React.Fragment`, e ignora qualquer outro elemento EM SILÊNCIO — um
 * componente aqui faria o domínio inteiro virar 404 com a suíte verde.
 * `subtree-wiring.test.tsx` pergunta isso ao próprio react-router.
 */
/**
 * Redireciona uma aba em português preservando o nome do prompt.
 *
 * O nome é INGLÊS e termina em `Redirect` de propósito: `route-boundary.test.ts:141` isenta
 * de `Boundaried` os elementos cujo bloco casa `/Navigate|Redirect|Alias/`, porque um
 * redirect não renderiza página e não tem o que proteger. Chamá-lo `RedirecionaAba` fazia o
 * guard tratá-lo como tela e reprovar — a convenção já existia em `PreviewsRedirect` e
 * `RepositoryAlias`.
 *
 * `<Navigate to="…">` não interpola `:promptName`, então uma aba precisa ler o parâmetro e
 * remontar o destino. O nome é RE-CODIFICADO: o M16 trouxe pastas, e `m16-sup/relatorio` é um
 * nome com barra — sem codificar, a barra viraria segmento e o redirect apontaria para lugar
 * nenhum, que é o 404 que este bloco existe para impedir.
 */
function TabRedirect({ sufixo }: { readonly sufixo: string }) {
  const { promptName } = useParams();
  return <Navigate to={`/promptly/${encodeURIComponent(promptName ?? '')}/${sufixo}`} replace />;
}

export const rotasDePromptly = (
  <>
    <Route path="/promptly" element={<Boundaried path="/promptly"><PromptlyOverviewPage /></Boundaried>} />
    {/* `/promptly/new` ANTES do segmento dinâmico. O ranking do roteador já
    prefere o estático, mas a ordem explícita é o que impede alguém de ler
    "new" como nome de prompt ao mover uma linha daqui. */}
    <Route path="/promptly/new" element={<Boundaried path="/promptly/new"><PromptlyOverviewPage /><PromptlyCreatePage /></Boundaried>} />
    {/* `/promptly/catalogo` é literal e cai na mesma classe de `/promptly/new`:
    precede o segmento dinâmico, senão o roteador o trata como nome de prompt. */}
    {/* As rotas em português continuam RESOLVENDO. A URL é parte do que o usuário vê, mas um
    endereço já colado num ticket, salvo num favorito ou mandado numa mensagem não pode
    virar 404 porque o produto mudou de idioma. Mesmo contrato de `skills-routes.tsx:30`,
    e `replace` para não empilhar a URL antiga no histórico. */}
    <Route path="/promptly/catalogo" element={<Navigate to="/promptly/catalog" replace />} />
    <Route path="/promptly/:promptName/producao" element={<TabRedirect sufixo="production" />} />
    <Route path="/promptly/:promptName/consumo" element={<TabRedirect sufixo="consumption" />} />
    <Route path="/promptly/catalog" element={<Boundaried path="/promptly/catalog"><PromptlyCatalogPage /></Boundaried>} />
    <Route path="/promptly/:promptName" element={<Boundaried path="/promptly/:promptName"><PromptDetailPage /></Boundaried>} />
    {/* M21 DoD-1 — as três abas que não são a índice. A índice É
    `/promptly/:promptName` acima, e é o endereço que já circulava: links para
    ele existem no catálogo, no diff e na lista de dependentes do M20. As
    quatro montam o MESMO componente, que decide o recorte pela rota — o
    estado da aba fica no endereço, e não em memória. */}
    <Route path="/promptly/:promptName/config" element={<Boundaried path="/promptly/:promptName/config"><PromptDetailPage /></Boundaried>} />
    <Route path="/promptly/:promptName/production" element={<Boundaried path="/promptly/:promptName/production"><PromptDetailPage /></Boundaried>} />
    <Route path="/promptly/:promptName/consumption" element={<Boundaried path="/promptly/:promptName/consumption"><PromptDetailPage /></Boundaried>} />
    <Route path="/promptly/:name/diff" element={<Boundaried path="/promptly/:name/diff"><PromptlyDiffPage /></Boundaried>} />
    <Route path="/promptly/:promptName/playground" element={<Boundaried path="/promptly/:promptName/playground"><PromptlyPlaygroundPage /></Boundaried>} />
  </>
);
