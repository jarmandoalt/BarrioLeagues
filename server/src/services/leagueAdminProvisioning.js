import bcrypt from 'bcryptjs'
import { League } from '../models/League.js'
import { LeagueAdminCredential } from '../models/LeagueAdminCredential.js'

export const provisionLeagueAdminCredentials = async () => {
  const leagues = await League.find({}, 'slug').lean()
  if (!leagues.length) return

  const existingSlugs = new Set(await LeagueAdminCredential.distinct('leagueSlug'))
  const missingLeagues = leagues.filter((league) => !existingSlugs.has(league.slug))
  if (!missingLeagues.length) return

  const operations = await Promise.all(missingLeagues.map(async ({ slug }) => ({
    updateOne: {
      filter: { leagueSlug: slug },
      update: {
        $setOnInsert: {
          leagueSlug: slug,
          passwordHash: await bcrypt.hash(slug, 12),
          mustChangePassword: true,
        },
      },
      upsert: true,
    },
  })))

  await LeagueAdminCredential.bulkWrite(operations)
  console.info(`Cuentas iniciales de liga provisionadas: ${missingLeagues.length}`)
}