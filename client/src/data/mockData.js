export const leagueData = {
  standings: [
    { pos: 1, nombre: 'Club Norte', pj: 10, g: 7, e: 2, p: 1, gf: 22, gc: 8, dg: '+14', pts: 23 },
    { pos: 2, nombre: 'Atlético Barrio', pj: 10, g: 6, e: 2, p: 2, gf: 18, gc: 9, dg: '+9', pts: 20 },
    { pos: 3, nombre: 'Deportivo Sur', pj: 10, g: 5, e: 3, p: 2, gf: 15, gc: 10, dg: '+5', pts: 18 },
    { pos: 4, nombre: 'CF Este', pj: 10, g: 5, e: 1, p: 4, gf: 14, gc: 12, dg: '+2', pts: 16 },
    { pos: 5, nombre: 'Unión Oeste', pj: 10, g: 4, e: 3, p: 3, gf: 13, gc: 11, dg: '+2', pts: 15 },
    { pos: 6, nombre: 'San Roque', pj: 10, g: 3, e: 4, p: 3, gf: 11, gc: 12, dg: '-1', pts: 13 },
    { pos: 7, nombre: 'Los Pinos', pj: 10, g: 2, e: 3, p: 5, gf: 9, gc: 15, dg: '-6', pts: 9 },
    { pos: 8, nombre: 'FC Central', pj: 10, g: 1, e: 2, p: 7, gf: 7, gc: 20, dg: '-13', pts: 5 },
  ],

  teams: [
    {
      nombre: 'FC Central',
      ciudad: 'Colonia Centro',
      puntos: 12,
      partidos: 10,
      goles: 18,
      diferencia: '+7',
      entrenador: 'Luis Ortega',
      abreviatura: 'FC'
    },
    {
      nombre: 'Atlético Barrio',
      ciudad: 'Barrio Las Flores',
      puntos: 10,
      partidos: 10,
      goles: 17,
      diferencia: '+9',
      entrenador: 'Raúl Serrano',
      abreviatura: 'AB'
    },
    {
      nombre: 'San Roque',
      ciudad: 'Ejido San Antonio',
      puntos: 9,
      partidos: 10,
      goles: 14,
      diferencia: '+2',
      entrenador: 'Diego Alvarado',
      abreviatura: 'SR'
    },
    {
      nombre: 'Club Norte',
      ciudad: 'Fraccionamiento Norte',
      puntos: 11,
      partidos: 10,
      goles: 21,
      diferencia: '+14',
      entrenador: 'Marco Rivera',
      abreviatura: 'CN'
    },
    {
      nombre: 'Unión Oeste',
      ciudad: 'Zona Oeste',
      puntos: 8,
      partidos: 10,
      goles: 13,
      diferencia: '+2',
      entrenador: 'Sergio Vega',
      abreviatura: 'UO'
    },
    {
      nombre: 'Los Pinos',
      ciudad: 'Las Pinos',
      puntos: 7,
      partidos: 10,
      goles: 9,
      diferencia: '-6',
      entrenador: 'Hugo Gutiérrez',
      abreviatura: 'LP'
    },
    {
      nombre: 'Deportivo Sur',
      ciudad: 'Sur del Municipio',
      puntos: 8,
      partidos: 10,
      goles: 15,
      diferencia: '+5',
      entrenador: 'Carlos Peña',
      abreviatura: 'DS'
    },
    {
      nombre: 'CF Este',
      ciudad: 'Frente a la Estación',
      puntos: 7,
      partidos: 10,
      goles: 14,
      diferencia: '+2',
      entrenador: 'Pablo Rivas',
      abreviatura: 'CE'
    }
  ],

  matches: [
    { fecha: 'Jornada 1', local: 'La Purísima FC', visita: 'Barrio United', resultado: '2 - 1' },
    { fecha: 'Jornada 2', local: 'Los Rápidos', visita: 'Atlético La Loma', resultado: '1 - 1' },
    { fecha: 'Jornada 3', local: 'Barrio United', visita: 'Los Rápidos', resultado: '3 - 0' },
  ],

  stats: {
    goleadores: [
      { jugador: 'M. Fernández', equipo: 'Club Norte', goles: 12 },
      { jugador: 'L. Romero', equipo: 'Atlético Barrio', goles: 9 },
      { jugador: 'A. Torres', equipo: 'Deportivo Sur', goles: 7 },
    ],
    porteros: [
      { jugador: 'D. Pardo', equipo: 'Unión Oeste', partidos: 5 },
      { jugador: 'J. Morales', equipo: 'San Roque', partidos: 4 },
      { jugador: 'R. Castro', equipo: 'CF Este', partidos: 3 },
    ],
    tarjetasRojas: [
      { jugador: 'F. Silva', equipo: 'Atlético Barrio', rojas: 2 },
      { jugador: 'P. López', equipo: 'CF Este', rojas: 1 },
      { jugador: 'M. Ruiz', equipo: 'Club Norte', rojas: 1 },
    ],
    tarjetasAmarillas: [
      { jugador: 'T. Jiménez', equipo: 'Deportivo Sur', amarillas: 4 },
      { jugador: 'S. Vega', equipo: 'Unión Oeste', amarillas: 3 },
      { jugador: 'N. Herrera', equipo: 'San Roque', amarillas: 3 },
    ],
  },
}
