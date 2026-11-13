import { useEffect, useState } from 'react'
import { Button, Modal } from 'react-bootstrap'
import { useAdminAuth } from '../components/AdminAuthContext'
import LeagueHeader from '../components/LeagueHeader'
import FloatingNotifications from '../components/FloatingNotifications'
import { createLeague, getLeagueAdminContact, getLeagues, getWhatsAppFlowTest, resetLeagueAdminPasswordBySuperAdmin, startWhatsAppFlowTest, updateLeague } from '../services/leagueApi'
import '../index.css'

const initialLeagueForm = {
  slug: '', nombre: '', jornada: 1, duenoNombre: '', duenoContacto: '', duenoEmail: '', status: 'activo', logo: '', primario: '#000000', secundario: '#0E8A4E',
}

const initialLeagueEditForm = {
  nombre: '',
  jornada: 1,
  duenoNombre: '',
  duenoContacto: '',
  duenoEmail: '',
  status: 'activo',
  logo: '',
  primario: '#000000',
  secundario: '#0E8A4E',
}

const Admin = () => {
  const { logout } = useAdminAuth()
  const [leagues, setLeagues] = useState([])
  const [leagueForm, setLeagueForm] = useState(initialLeagueForm)
  const [editingLeague, setEditingLeague] = useState(null)
  const [editLeagueForm, setEditLeagueForm] = useState(initialLeagueEditForm)
  const [showLeagueForm, setShowLeagueForm] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [saving, setSaving] = useState(false)
  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const [resetSlugInput, setResetSlugInput] = useState('')
  const [resetAdminPassword, setResetAdminPassword] = useState('')
  const [showResetAdminPassword, setShowResetAdminPassword] = useState(false)
  const [resetStatus, setResetStatus] = useState({ type: '', message: '' })
  const [whatsAppFlow, setWhatsAppFlow] = useState(null)
  const [startingWhatsAppFlow, setStartingWhatsAppFlow] = useState(false)
  const [pollWhatsAppFlow, setPollWhatsAppFlow] = useState(false)

  const loadLeagues = async () => {
    try {
      setLeagues(await getLeagues())
    } catch (error) {
      setStatus({ type: 'error', message: error.response?.data?.message || 'No se pudieron cargar las ligas.' })
    }
  }

  useEffect(() => {
    let active = true
    getLeagues()
      .then((loadedLeagues) => {
        if (active) setLeagues(loadedLeagues)
      })
      .catch((error) => {
        if (active) {
          setStatus({ type: 'error', message: error.response?.data?.message || 'No se pudieron cargar las ligas.' })
        }
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!pollWhatsAppFlow) return undefined

    let checking = false
    const interval = setInterval(async () => {
      if (checking) return
      checking = true
      try {
        const { flow } = await getWhatsAppFlowTest()
        if (!flow) return
        setWhatsAppFlow(flow)
        if (['completed', 'failed'].includes(flow.workflowState)) setPollWhatsAppFlow(false)
      } catch (error) {
        setStatus({ type: 'error', message: error.response?.data?.message || 'No se pudo consultar el estado de la prueba.' })
        setPollWhatsAppFlow(false)
      } finally {
        checking = false
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [pollWhatsAppFlow])

  const handleWhatsAppFlowTest = async () => {
    setStartingWhatsAppFlow(true)
    setStatus({ type: '', message: '' })
    try {
      const flow = await startWhatsAppFlowTest()
      setWhatsAppFlow(flow)
      setPollWhatsAppFlow(true)
    } catch (error) {
      if (error.response?.data?.flow) {
        setWhatsAppFlow(error.response.data.flow)
        setPollWhatsAppFlow(true)
      }
      setStatus({ type: 'error', message: error.response?.data?.message || 'No se pudo iniciar el flujo de WhatsApp.' })
    } finally {
      setStartingWhatsAppFlow(false)
    }
  }

  const whatsAppFlowStatus = !whatsAppFlow
    ? ''
    : whatsAppFlow.workflowState === 'waiting_response'
      ? 'Flujo iniciado → Esperando 6 min'
      : whatsAppFlow.workflowState === 'processing'
        ? 'Procesando mensajes finales...'
        : whatsAppFlow.workflowState === 'retry'
          ? 'Reintentando envío...'
          : whatsAppFlow.workflowState === 'completed'
            ? `Terminado${whatsAppFlow.response === 'yes' ? ' · respondió SÍ' : whatsAppFlow.response === 'no' ? ' · respondió NO' : ' · sin respuesta SÍ/NO'}`
            : whatsAppFlow.workflowState === 'failed'
              ? `Falló: ${whatsAppFlow.lastError || 'no se pudo completar el envío'}`
              : ''

  const updateLeagueField = (field, value) => setLeagueForm((current) => ({ ...current, [field]: value }))
  const updateEditLeagueField = (field, value) => setEditLeagueForm((current) => ({ ...current, [field]: value }))
  const resetSlugMatches = editingLeague && resetSlugInput.trim().toLowerCase() === editingLeague.slug

  const openLeaguePasswordReset = () => {
    setShowPasswordReset(true)
    setResetSlugInput('')
    setResetAdminPassword('')
    setShowResetAdminPassword(false)
    setResetStatus({ type: '', message: '' })
  }

  const handleLeaguePasswordReset = async () => {
    if (!editingLeague || !resetSlugMatches || !resetAdminPassword) return
    setSaving(true)
    setResetStatus({ type: '', message: '' })
    try {
      await resetLeagueAdminPasswordBySuperAdmin(editingLeague.slug, editingLeague.slug, resetAdminPassword)
      setResetAdminPassword('')
      setShowPasswordReset(false)
      setResetSlugInput('')
      setResetStatus({ type: 'success', message: `Contraseña restablecida. Usuario y contraseña inicial: ${editingLeague.slug}. Se pedirá cambiarla al próximo ingreso.` })
    } catch (error) {
      setResetStatus({ type: 'error', message: error.response?.data?.message || 'No se pudo restablecer la contraseña.' })
    } finally {
      setSaving(false)
    }
  }

  const handleLeagueSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      await createLeague({
        slug: leagueForm.slug.trim().toLowerCase(),
        nombre: leagueForm.nombre.trim(),
        jornada: Number(leagueForm.jornada),
        dueno: { nombre: leagueForm.duenoNombre.trim(), contacto: leagueForm.duenoContacto.trim(), email: leagueForm.duenoEmail.trim().toLowerCase() },
        status: leagueForm.status,
        estado: 'configuracion',
        wizardCompletado: false,
        branding: { logo: leagueForm.logo.trim(), colores: { primario: leagueForm.primario, secundario: leagueForm.secundario } },
      })
      await loadLeagues()
      setLeagueForm(initialLeagueForm)
      setShowLeagueForm(false)
      setStatus({ type: 'success', message: 'Liga creada. Usuario inicial: slug; contraseña inicial: slug. Se solicitará cambiarla al primer acceso.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.response?.data?.message || 'No se pudo crear la liga.' })
    } finally {
      setSaving(false)
    }
  }

  const openLeagueEditor = async (league) => {
    setStatus({ type: '', message: '' })
    try {
      const { email } = await getLeagueAdminContact(league.slug)
      setEditLeagueForm({
        nombre: league.nombre,
        jornada: league.jornada,
        duenoNombre: league.dueno.nombre,
        duenoContacto: league.dueno.contacto,
        duenoEmail: email || '',
        status: league.status,
        logo: league.branding?.logo || '',
        primario: league.branding?.colores?.primario || '#000000',
        secundario: league.branding?.colores?.secundario || '#0E8A4E',
      })
      setEditingLeague(league)
    } catch (error) {
      setStatus({ type: 'error', message: error.response?.data?.message || 'No se pudieron cargar los datos de la liga.' })
    }
  }

  const handleLeagueEditSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setStatus({ type: '', message: '' })
    try {
      await updateLeague(editingLeague.slug, {
        nombre: editLeagueForm.nombre.trim(),
        jornada: Number(editLeagueForm.jornada),
        dueno: {
          nombre: editLeagueForm.duenoNombre.trim(),
          contacto: editLeagueForm.duenoContacto.trim(),
          email: editLeagueForm.duenoEmail.trim().toLowerCase(),
        },
        status: editLeagueForm.status,
        branding: {
          logo: editLeagueForm.logo.trim(),
          colores: { primario: editLeagueForm.primario, secundario: editLeagueForm.secundario },
        },
      })
      await loadLeagues()
      setEditingLeague(null)
      setStatus({ type: 'success', message: 'Liga actualizada correctamente.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.response?.data?.message || 'No se pudo actualizar la liga.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dashboard-shell admin-shell">
      <FloatingNotifications notifications={[
        status.message && { id: 'admin-status', type: status.type, message: status.message },
        resetStatus.message && { id: 'password-reset-status', type: resetStatus.type, message: resetStatus.message },
      ]} />
      <LeagueHeader title="Barrio Leagues" subtitle="Panel de administración" links={[{ to: '/', label: 'Inicio' }, { to: '/admin', label: 'Admin' }]}>
        <Button variant="outline-danger" size="sm" onClick={logout}>Cerrar sesión</Button>
      </LeagueHeader>

      <main className="admin-main">
        <div className="admin-heading-row">
          <div><p className="admin-eyebrow">Panel privado</p><h1 className="admin-title">Administración</h1><p className="admin-description">Gestiona los datos generales de tus ligas.</p></div>
          <button className="admin-primary-button" type="button" onClick={() => setShowLeagueForm((current) => !current)}>{showLeagueForm ? 'Cerrar formulario' : '+ Crear nueva liga'}</button>
        </div>

        <section className="form-section" aria-labelledby="whatsapp-flow-test-title">
          <h2 id="whatsapp-flow-test-title">Prueba de WhatsApp</h2>
          <p>Envía mensajes reales al número de prueba y registra la respuesta durante 6 minutos.</p>
          <button
            className="admin-secondary-button"
            type="button"
            onClick={handleWhatsAppFlowTest}
            disabled={startingWhatsAppFlow || pollWhatsAppFlow}
          >
            {startingWhatsAppFlow ? 'Enviando...' : 'PROBAR FLUJO COMPLETO (6 MIN) - 4494481016'}
          </button>
          {whatsAppFlowStatus && <p role="status" aria-live="polite">{whatsAppFlowStatus}</p>}
        </section>

        {showLeagueForm && <form className="league-form" onSubmit={handleLeagueSubmit}>
          <div className="form-section"><h2>Nueva liga</h2><div className="form-grid">
            <label>Nombre<input required value={leagueForm.nombre} onChange={(event) => updateLeagueField('nombre', event.target.value)} /></label>
            <label>Slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={leagueForm.slug} onChange={(event) => updateLeagueField('slug', event.target.value)} /></label>
            <label>Jornada actual<input required type="number" min="0" value={leagueForm.jornada} onChange={(event) => updateLeagueField('jornada', event.target.value)} /></label>
            <label>Dueño<input required value={leagueForm.duenoNombre} onChange={(event) => updateLeagueField('duenoNombre', event.target.value)} /></label>
            <label>Contacto<input required value={leagueForm.duenoContacto} onChange={(event) => updateLeagueField('duenoContacto', event.target.value)} /></label>
            <label>Correo del administrador<input required type="email" autoComplete="email" value={leagueForm.duenoEmail} onChange={(event) => updateLeagueField('duenoEmail', event.target.value)} /></label>
            <label>Estado<select value={leagueForm.status} onChange={(event) => updateLeagueField('status', event.target.value)}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></label>
          </div></div>
          <div className="form-section"><h2>Branding</h2><div className="form-grid">
            <label>Logo<input value={leagueForm.logo} onChange={(event) => updateLeagueField('logo', event.target.value)} /></label>
            <label>Color primario<input type="color" value={leagueForm.primario} onChange={(event) => updateLeagueField('primario', event.target.value)} /></label>
            <label>Color secundario<input type="color" value={leagueForm.secundario} onChange={(event) => updateLeagueField('secundario', event.target.value)} /></label>
          </div></div>
          <button className="admin-save-button" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar liga'}</button>
        </form>}

        <section className="league-admin-grid">
          {leagues.map((league) => <article className="league-admin-card" key={league._id}>
            <div><p className="admin-eyebrow">/{league.slug}</p><h2>{league.nombre}</h2><p>Estado: {league.status}</p></div>
            <div className="league-card-actions"><button className="admin-secondary-button" type="button" onClick={() => openLeagueEditor(league)}>Editar</button></div>
          </article>)}
          {leagues.length === 0 && <p className="empty-players">No hay ligas registradas todavía.</p>}
        </section>

        <Modal show={Boolean(editingLeague)} onHide={() => { setEditingLeague(null); setResetAdminPassword(''); setShowPasswordReset(false) }} centered>
          <Modal.Header closeButton>
            <Modal.Title>{editingLeague ? `Editar liga · /${editingLeague.slug}` : 'Editar liga'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {editingLeague && <form className="player-modal-form" onSubmit={handleLeagueEditSubmit}>
              <label>Nombre de la liga<input required value={editLeagueForm.nombre} onChange={(event) => updateEditLeagueField('nombre', event.target.value)} /></label>
              <label>Slug<input value={editingLeague.slug} readOnly /></label>
              <label>Jornada actual<input required type="number" min="0" value={editLeagueForm.jornada} onChange={(event) => updateEditLeagueField('jornada', event.target.value)} /></label>
              <label>Propietario<input required value={editLeagueForm.duenoNombre} onChange={(event) => updateEditLeagueField('duenoNombre', event.target.value)} /></label>
              <label>Forma de contacto<input required value={editLeagueForm.duenoContacto} onChange={(event) => updateEditLeagueField('duenoContacto', event.target.value)} /></label>
              <label>Correo del administrador<input required type="email" autoComplete="email" value={editLeagueForm.duenoEmail} onChange={(event) => updateEditLeagueField('duenoEmail', event.target.value)} /></label>
              <label>Estado<select value={editLeagueForm.status} onChange={(event) => updateEditLeagueField('status', event.target.value)}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></label>
              <label>Logo<input value={editLeagueForm.logo} onChange={(event) => updateEditLeagueField('logo', event.target.value)} /></label>
              <label>Color primario<input type="color" value={editLeagueForm.primario} onChange={(event) => updateEditLeagueField('primario', event.target.value)} /></label>
              <label>Color secundario<input type="color" value={editLeagueForm.secundario} onChange={(event) => updateEditLeagueField('secundario', event.target.value)} /></label>
              <div className="league-card-actions">
                <Button variant="outline-secondary" type="button" onClick={() => setEditingLeague(null)}>Cancelar</Button>
                <Button variant="outline-danger" type="button" onClick={openLeaguePasswordReset} disabled={saving}>Resetear contraseña</Button>
                <Button variant="primary" type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
              </div>
              {showPasswordReset && <div className="league-password-reset">
                <p>Escribe el slug exacto de la liga para confirmar el reseteo.</p>
                <label>Slug de confirmación<input autoComplete="off" value={resetSlugInput} onChange={(event) => { setResetSlugInput(event.target.value); setResetStatus({ type: '', message: '' }) }} /></label>
                {resetSlugMatches && <>
                  <label>Contraseña del administrador general<div className="password-input-wrap">
                    <input type={showResetAdminPassword ? 'text' : 'password'} autoComplete="current-password" value={resetAdminPassword} onChange={(event) => setResetAdminPassword(event.target.value)} />
                    <button className="password-visibility-button" type="button" aria-label={showResetAdminPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showResetAdminPassword} onClick={() => setShowResetAdminPassword((current) => !current)}>{showResetAdminPassword ? 'Ocultar' : 'Mostrar'}</button>
                  </div></label>
                  <Button variant="danger" type="button" onClick={handleLeaguePasswordReset} disabled={saving || !resetAdminPassword}>{saving ? 'Restableciendo...' : 'Confirmar reseteo'}</Button>
                </>}
              </div>}
            </form>}
          </Modal.Body>
        </Modal>
      </main>
    </div>
  )
}

export default Admin
