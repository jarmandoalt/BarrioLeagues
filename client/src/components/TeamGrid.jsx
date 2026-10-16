import TeamCard from './TeamCard'

export default function TeamGrid({ teams, onView }) {
  return (
    <div className="grid grid-cols-1 gap-4 rounded-2xl bg-slate-50 p-4 w-full">
      {teams.map((team) => <TeamCard key={team._id} team={team} onView={onView} />)}
    </div>
  )
}
