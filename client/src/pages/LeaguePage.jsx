import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getLeagueBySlug } from '../services/leagueApi'
import '../index.css'

const LeaguePage = () => {
  const { slug } = useParams()
  const [league, setLeague] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    const loadLeague = async () => {
      setLoading(true)
      setError('')

      try {
        const data = await getLeagueBySlug(slug)
        if (active) setLeague(data)
      } catch (requestError) {
        if (active) {
          setError(requestError.response?.data?.message || 'No se pudo cargar la liga.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadLeague()
    return () => {
      active = false
    }
  }, [slug])

  if (loading) return <div className="loading-state">Cargando liga...</div>

  if (error) {
    return (
      <main className="league-page-state">
        <h1>Liga no disponible</h1>
        <p>{error}</p>
        <Link to="/">Volver al inicio</Link>
      </main>
    )
  }

  return (
    <div className="league-page" style={{ '--league-primary': league.branding?.colores?.primario || '#0d3d9c', '--league-secondary': league.branding?.colores?.secundario || '#0E8A4E' }}>
      <header className="league-page-header">
        <Link to="/" className="brand">barrio leagues</Link>
        <Link to="/admin" className="league-admin-link">Administrar</Link>
      </header>

      <main className="league-page-main">
        <section className="league-hero">
          <div className="league-brand-mark">
            {league.branding?.logo ? <img src={league.branding.logo} alt={`Logo de ${league.nombre}`} /> : league.nombre.slice(0, 1)}
          </div>
          <div>
            <p className="league-page-label">Liga deportiva</p>
            <h1>{league.nombre}</h1>
            <p className="league-slug">/{league.slug}</p>
          </div>
          <span className={`league-status ${league.status}`}>{league.status}</span>
        </section>

        <section className="league-info-grid">
          <article className="league-info-card"><span>Dueño</span><strong>{league.dueno.nombre}</strong><small>{league.dueno.contacto}</small></article>
          <article className="league-info-card"><span>Estado</span><strong>{league.status === 'activo' ? 'Liga activa' : 'Liga inactiva'}</strong><small>Administración Barrio Leagues</small></article>
          <article className="league-info-card"><span>Identificador</span><strong>{league.slug}</strong><small>URL pública de la liga</small></article>
        </section>

        <nav className="league-sections" aria-label="Secciones de la liga">
          <Link to="/">Tabla general</Link>
          <Link to="/equipos">Equipos</Link>
          <Link to="/partidos">Partidos</Link>
          <Link to="/estadisticas">Estadísticas</Link>
        </nav>
      </main>
    </div>
  )
}

export default LeaguePage
