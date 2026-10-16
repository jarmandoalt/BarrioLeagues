import { Pencil, Plus } from 'lucide-react'

export default function EquipoDetalle({ equipo, jugadores = [], onEditar, onAgregarJugador, onEditarJugador }) {
  return (
    <div className="min-h-screen bg-[#f8fafc] p-3 md:p-6">
      <div
        className="rounded-t-[24px] p-6 md:p-8 text-white flex flex-col md:flex-row items-center md:items-start gap-6"
        style={{ background: `linear-gradient(90deg, ${equipo.colorPrimario} 0%, ${equipo.colorSecundario} 100%)` }}
      >
        <img
          src={equipo.imagen}
          alt={equipo.nombre}
          className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-white p-2 shadow-xl object-contain"
        />

        <div className="flex-1 text-center md:text-left">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">{equipo.nombre}</h1>
          <div className="mt-2 inline-flex bg-white text-black font-bold px-3 py-1 rounded-lg text-sm">
            {equipo.nombreCorto}
          </div>
          <div className="mt-4 flex flex-col md:flex-row gap-3 md:gap-6 text-sm opacity-90">
            <span>👤 DT: {equipo.dt?.nombre}</span>
            <span>💬 WhatsApp {equipo.dt?.whatsapp}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="bg-white text-black rounded-xl px-6 py-3 text-center shadow-sm">
            <p className="text-xs text-gray-500 flex items-center gap-1">📈 PJ:</p>
            <p className="text-3xl font-bold">{equipo.stats?.pj ?? 0}</p>
          </div>
          <div className="bg-white text-black rounded-xl px-6 py-3 text-center shadow-sm">
            <p className="text-xs text-gray-500 flex items-center gap-1">🏆 PTS:</p>
            <p className="text-3xl font-bold">{equipo.stats?.pts ?? 0}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-b-[24px] rounded-t-none md:rounded-[24px] md:-mt-4 p-5 md:p-6 shadow-sm border border-gray-100">
        {(onEditar || onAgregarJugador) && <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          <button type="button" onClick={onEditar} className="w-full h-12 rounded-xl border border-gray-300 font-semibold text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2">
            <Pencil size={18} /> Editar equipo
          </button>
          <button type="button" onClick={onAgregarJugador} className="w-full h-12 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 flex items-center justify-center gap-2">
            <Plus size={20} /> Agregar jugador
          </button>
        </div>}

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Plantilla</h2>
          <span className="text-gray-500 text-sm">{jugadores.length} jugadores</span>
        </div>

        {jugadores.length === 0 ? (
          <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center bg-gray-50/50">
            <div className="mx-auto w-14 h-14 bg-gray-200 rounded-full flex items-center justify-center mb-3">👥</div>
            <h3 className="font-bold text-lg">Aún no hay jugadores en la plantilla</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-xl mx-auto">
              Comienza agregando jugadores a tu equipo para verlos aquí. Cuando agregues jugadores aparecerán en esta lista con su posición, dorsal y estadísticas.
            </p>
            {onAgregarJugador && <button type="button" onClick={onAgregarJugador} className="mt-4 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 inline-flex items-center gap-2">
              <Plus size={18} /> Agregar jugador
            </button>}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {jugadores.map((jugador) => (
              <li key={jugador._id} className="flex items-center justify-between gap-3 py-3">
                <span>
                  <strong>#{jugador.numero} {jugador.nombre_corto}</strong>
                  <small className="block text-gray-500">{jugador.nombre_completo} · {jugador.posicion} · {jugador.estado}</small>
                </span>
                {onEditarJugador && <button type="button" onClick={() => onEditarJugador(jugador)} className="rounded-lg border border-blue-600 px-4 py-1.5 text-sm font-semibold text-blue-600 hover:bg-blue-50">
                  Editar
                </button>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
