export const updateTeamStatsFromMatch = async (localTeam, visitorTeam, homeGoals, awayGoals) => {
  const localResult = homeGoals > awayGoals ? 'G' : homeGoals < awayGoals ? 'P' : 'E'
  const visitorResult = localResult === 'G' ? 'P' : localResult === 'P' ? 'G' : 'E'

  const updateTeam = (team, goalsFor, goalsAgainst, result) => {
    team.stats.pj += 1
    team.stats.gf += goalsFor
    team.stats.gc += goalsAgainst

    if (result === 'G') team.stats.pg += 1
    if (result === 'E') team.stats.pe += 1
    if (result === 'P') team.stats.pp += 1

    team.racha = [...team.racha, result].slice(-5)
  }

  updateTeam(localTeam, homeGoals, awayGoals, localResult)
  updateTeam(visitorTeam, awayGoals, homeGoals, visitorResult)

  await Promise.all([localTeam.save(), visitorTeam.save()])
}