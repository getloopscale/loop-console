import { Route, Navigate } from 'react-router-dom';
import { Boundaried } from '@/routes/boundaried';
import {
  SkillAuthoringPage,
  SkillDetailPage,
  SkillVersionsPage,
  SkillsCatalogPage,
  SkillsDiscoveryPage,
  SkillsOverviewPage,
} from '@/app-routes-lazy';

/**
 * As rotas do domínio `skills` (B-003).
 *
 * Um VALOR JSX, e não um componente: `<Routes>` só percorre `<Route>` e
 * `React.Fragment`, e ignora qualquer outro elemento EM SILÊNCIO — um
 * componente aqui faria o domínio inteiro virar 404 com a suíte verde.
 * `subtree-wiring.test.tsx` pergunta isso ao próprio react-router.
 */
export const rotasDeSkills = (
  <>
    <Route path="/skills" element={<Boundaried path="/skills"><SkillsOverviewPage /></Boundaried>} />
    <Route path="/skills/catalog" element={<Boundaried path="/skills/catalog"><SkillsCatalogPage /></Boundaried>} />
    <Route path="/skills/new" element={<Boundaried path="/skills/new"><SkillsOverviewPage /><SkillAuthoringPage /></Boundaried>} />
    <Route path="/skills/discovery" element={<Boundaried path="/skills/discovery"><SkillsDiscoveryPage /></Boundaried>} />
    {/* As rotas antigas em português seguem RESOLVENDO, por redirect.
    A URL é parte do que o usuário vê, e o produto é monolíngue — mas um link
    já compartilhado ou salvo não pode virar 404 por causa disso. O redirect é
    `replace` para não empilhar a URL antiga no histórico do navegador. */}
    <Route path="/skills/catalogo" element={<Navigate to="/skills/catalog" replace />} />
    <Route path="/skills/nova" element={<Navigate to="/skills/new" replace />} />
    <Route path="/skills/descoberta" element={<Navigate to="/skills/discovery" replace />} />
    <Route path="/skills/:skillId" element={<Boundaried path="/skills/:skillId"><SkillDetailPage /></Boundaried>} />
    <Route path="/skills/:skillId/versions" element={<Boundaried path="/skills/:skillId/versions"><SkillVersionsPage /></Boundaried>} />
  </>
);
