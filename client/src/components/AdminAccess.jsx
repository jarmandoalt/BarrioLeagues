import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { AdminAuthContext } from './AdminAuthContext'
import FloatingNotifications from './FloatingNotifications'
import LeagueSetupWizard from './LeagueSetupWizard'
import { changeLeagueAdminPassword, getAdminSession, loginAdmin, loginLeagueAdmin, logoutAdmin } from '../services/leagueApi'
import '../index.css'

const PasswordField = ({ value, onChange, disabled = false, autoComplete, minLength }) => {
  const [visible, setVisible] = useState(false)

  return <div className="password-input-wrap">
    <input
      type={visible ? 'text' : 'password'}
      autoComplete={autoComplete}
      minLength={minLength}
      required
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
    <button
      className="password-visibility-button"
      type="button"
      aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      aria-pressed={visible}
      onClick={() => setVisible((current) => !current)}
      disabled={disabled}
    >
      {visible ? 'Ocultar' : 'Mostrar'}
    </button>
  </div>
}

const AdminAccess = ({ children }) => {
  const { slug } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [username, setUsername] = useState(slug || '')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [mustConfigureLeague, setMustConfigureLeague] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    getAdminSession()
      .then((session) => {
        if (!active) return
        const routeMatches = slug
          ? session.role === 'superadmin' || (session.role === 'league-admin' && session.leagueSlug === slug)
          : session.role === 'superadmin'
        const isAuthenticated = session.authenticated && routeMatches
        setConfigured(session.configured || Boolean(slug))
        setAuthenticated(isAuthenticated)
        setMustChangePassword(isAuthenticated && session.role === 'league-admin' && session.mustChangePassword)
        setMustConfigureLeague(isAuthenticated && session.role === 'league-admin' && session.mustConfigureLeague)
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'No se pudo contactar al servidor.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [slug])

  const handleLogin = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const session = slug
        ? await loginLeagueAdmin(slug, username.trim(), password)
        : await loginAdmin(username.trim(), password)
      setPassword('')
      setMustChangePassword(Boolean(session.mustChangePassword))
      setMustConfigureLeague(Boolean(session.mustConfigureLeague))
      setAuthenticated(true)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo iniciar sesión.')
    } finally {
      setBusy(false)
    }
  }

  const handleChangePassword = async (event) => {
    event.preventDefault()
    setError('')
    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setBusy(true)
    try {
      const result = await changeLeagueAdminPassword(slug, newPassword)
      setMustChangePassword(false)
      setMustConfigureLeague(Boolean(result.mustConfigureLeague))
      setNewPassword('')
      setConfirmPassword('')
      setNotice('Contraseña actualizada. Ya puedes administrar tu liga.')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No se pudo cambiar la contraseña.')
    } finally {
      setBusy(false)
    }
  }

  const handleLogout = async () => {
    try {
      await logoutAdmin()
    } finally {
      setAuthenticated(false)
      setPassword('')
    }
  }

  if (loading) return <main className="admin-access-shell"><p>Cargando sesión...</p></main>

  if (mustChangePassword && authenticated) {
    return <main className="admin-access-shell"><section className="admin-access-panel">
      <FloatingNotifications notifications={error ? [{ id: 'access-error', type: 'error', message: error }] : []} />
      <p className="admin-eyebrow">Liga /{slug}</p>
      <h1>Cambia tu contraseña</h1>
      <p>La contraseña inicial es temporal. Cámbiala para continuar.</p>
      <form className="admin-access-form" onSubmit={handleChangePassword}>
        <label>Nueva contraseña<PasswordField autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} disabled={busy} /></label>
        <label>Repite la contraseña<PasswordField autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={busy} /></label>
        <button className="admin-primary-button" type="submit" disabled={busy}>{busy ? 'Actualizando...' : 'Guardar contraseña'}</button>
      </form>
    </section></main>
  }

  if (mustConfigureLeague && authenticated) {
    if (slug && !location.pathname.endsWith('/admin/configurar-liga')) {
      return <Navigate to={`/${slug}/admin/configurar-liga`} replace />
    }
    return <LeagueSetupWizard onComplete={() => {
      setMustConfigureLeague(false)
      navigate(`/${slug}/admin`, { replace: true })
    }} />
  }

  if (!authenticated) {
    return <main className="admin-access-shell">
      <FloatingNotifications notifications={[
        notice && { id: 'access-notice', type: 'success', message: notice },
        error && { id: 'access-error', type: 'error', message: error },
        !configured && { id: 'access-unconfigured', type: 'warning', message: 'El acceso todavía no está configurado en el servidor.' },
      ]} />
      <section className="admin-access-panel">
        <p className="admin-eyebrow">{slug ? `Administración · /${slug}` : 'Barrio Leagues'}</p>
        <h1>{slug ? 'Acceso de liga' : 'Acceso administrativo'}</h1>
        <form className="admin-access-form" onSubmit={handleLogin}>
          <label>Usuario<input autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} readOnly={Boolean(slug)} disabled={!configured || busy} /></label>
          <label>Contraseña<PasswordField autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={!configured || busy} /></label>
          <button className="admin-primary-button" type="submit" disabled={!configured || busy}>{busy ? 'Verificando...' : 'Iniciar sesión'}</button>
        </form>
      </section>
    </main>
  }

  return <AdminAuthContext.Provider value={{ logout: handleLogout }}>{children}</AdminAuthContext.Provider>
}

export default AdminAccess