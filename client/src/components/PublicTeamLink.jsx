import { useNavigate, useParams } from 'react-router-dom'

const PublicTeamLink = ({ team, children, className = '' }) => {
  const navigate = useNavigate()
  const { slug } = useParams()

  if (!team?._id) return <>{children || team?.nombre || 'Equipo'}</>

  return (
    <button
      type="button"
      className={`public-team-link ${className}`}
      onClick={() => navigate(`/${slug}/equipos`, {
        state: { openTeamId: String(team._id) },
        viewTransition: true,
      })}
      aria-label={`Ver equipo ${team.nombre || ''}`}
      title={`Ver equipo ${team.nombre || ''}`}
    >
      {children || team.nombre || 'Equipo'}
    </button>
  )
}

export default PublicTeamLink
