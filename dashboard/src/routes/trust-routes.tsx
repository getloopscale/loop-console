import { Route } from 'react-router-dom';
import { Boundaried } from '@/routes/boundaried';
import {
  TrustEnforcementPage,
  TrustGuardrailNewPage,
  TrustGuardrailsPage,
  TrustOverviewPage,
  TrustViolationsPage,
} from '@/app-routes-lazy';

/**
 * As rotas do domínio de confiança (B-003).
 *
 * ## Por que um FRAGMENTO, e não um componente
 *
 * `<Routes>` não aceita um componente que devolva rotas: o
 * `createRoutesFromChildren` do react-router percorre os filhos procurando
 * `<Route>` e `React.Fragment`, e qualquer outro tipo de elemento é ignorado em
 * SILÊNCIO — as rotas simplesmente não existiriam, sem erro nenhum.
 *
 * Um fragmento ele percorre recursivamente. Por isso o subtree é um VALOR JSX
 * exportado, consumido como `{rotasDeTrust}`, e não `<TrustRoutes />`.
 */
export const rotasDeTrust = (
  <>
    <Route path="/trust" element={<Boundaried path="/trust"><TrustOverviewPage /></Boundaried>} />
    <Route path="/trust/violations" element={<Boundaried path="/trust/violations"><TrustViolationsPage /></Boundaried>} />
    <Route path="/trust/guardrails" element={<Boundaried path="/trust/guardrails"><TrustGuardrailsPage /></Boundaried>} />
    <Route path="/trust/guardrails/new" element={<Boundaried path="/trust/guardrails/new"><TrustGuardrailsPage /><TrustGuardrailNewPage /></Boundaried>} />
    <Route path="/trust/enforcement" element={<Boundaried path="/trust/enforcement"><TrustEnforcementPage /></Boundaried>} />
  </>
);
