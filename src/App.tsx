/* Main App Component - Handles routing (using react-router-dom), query client and other providers - use this file to add all routes */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/hooks/use-auth'
import Index from './pages/Index'
import Buscar from './pages/Buscar'
import Novo from './pages/Novo'
import NovoItem from './pages/NovoItem'
import Item from './pages/Item'
import EditarItem from './pages/EditarItem'
import Pendentes from './pages/Pendentes'
import ImportarReuniao from './pages/ImportarReuniao'
import Revisao from './pages/Revisao'
import RevisarSugestao from './pages/RevisarSugestao'
import ProjetoHistorico from './pages/ProjetoHistorico'
import Legado from './pages/Legado'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'

// ONLY IMPORT AND RENDER WORKING PAGES, NEVER ADD PLACEHOLDER COMPONENTS OR PAGES IN THIS FILE
// AVOID REMOVING ANY CONTEXT PROVIDERS FROM THIS FILE (e.g. TooltipProvider, Toaster, Sonner)

const App = () => (
  <BrowserRouter>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Index />} />
            <Route path="/buscar" element={<Buscar />} />
            <Route path="/novo" element={<Novo />} />
            <Route path="/novo/:tipo" element={<NovoItem />} />
            <Route path="/item/:id" element={<Item />} />
            <Route path="/item/:id/editar" element={<EditarItem />} />
            <Route path="/pendentes" element={<Pendentes />} />
            {/* SPEC-165: reuniões de projeto, fila de revisão e histórico do projeto */}
            <Route path="/importar-reuniao" element={<ImportarReuniao />} />
            <Route path="/revisao" element={<Revisao />} />
            <Route path="/revisao/:id" element={<RevisarSugestao />} />
            <Route path="/projeto/:codigo" element={<ProjetoHistorico />} />
          </Route>
          {/* SPEC-164: app antigo (estático, public/app/) continua acessível em /legado */}
          <Route path="/legado/*" element={<Legado />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </TooltipProvider>
  </BrowserRouter>
)

export default App
