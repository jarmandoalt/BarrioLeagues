import { useEffect, useState } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { getLeagueBySlug } from '../services/leagueApi'
import { fetchLeagueData } from '../features/league/leagueSlice'
import '../index.css'

const LeagueLayout = () => {
  const { slug } = useParams()
  const dispatch = useDispatch()
  const [league, setLeague] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const loadLeague = async () => {
      setLoading(true)
      setError('')

      try {
        const leagueData = await getLeagueBySlug(slug)
        if (!active) return
        setLeague(leagueData)
        dispatch(fetchLeagueData(slug))
      } catch (requestError) {
        if (active) setError(requestError.response?.data?.message || 'No se pudo cargar la liga.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadLeague()
    return () => {
      active = false
    }
  }, [dispatch, slug])

  if (loading) return <div className="loading-state">Cargando liga...</div>

  if (error) {
    return (
      <main className="league-page-state">
        <h1>Liga no disponible</h1>
        <p>{error}</p>
        <Link to="/admin">Ir a administración</Link>
      </main>
    )
  }

  return (
    <div className="league-context" style={{ '--league-primary': league?.branding?.colores?.primario || '#0d3d9c', '--league-secondary': league?.branding?.colores?.secundario || '#0E8A4E' }}>
      <Outlet context={{ league }} />
    </div>
  )
}

export default LeagueLayout
