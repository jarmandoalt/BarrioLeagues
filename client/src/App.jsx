import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Equipos from './pages/Equipos'
import Partidos from './pages/Partidos'
import Estadisticas from './pages/Estadisticas'
import Admin from './pages/Admin'
import LeagueLayout from './pages/LeagueLayout'
import LeagueAdmin from './pages/LeagueAdmin'
import AdminAccess from './components/AdminAccess'
import Arbitros from './pages/Arbitros'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/las-huertas" replace />} />
        <Route path="/admin" element={<AdminAccess><Admin /></AdminAccess>} />
        <Route path="/:slug" element={<LeagueLayout />}>
          <Route index element={<Home />} />
          <Route path="partidos" element={<Partidos />} />
          <Route path="equipos" element={<Equipos />} />
          <Route path="estadisticas" element={<Estadisticas />} />
          <Route path="arbitro" element={<Arbitros />} />
          <Route path="arbitros" element={<Arbitros />} />
          <Route path="equipo/:codigo" element={<AdminAccess><LeagueAdmin /></AdminAccess>} />
          <Route path="admin" element={<AdminAccess><LeagueAdmin /></AdminAccess>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App