import { useState } from 'react'
import { useTeamEmblems } from './teamEmblems'
import './team-emblems.css'

export function TeamEmblem({
  entryId,
  managerId,
  revealRole,
}: {
  entryId?: number
  managerId?: string
  revealRole?: 'home-emblem' | 'away-emblem'
}) {
  const { teams } = useTeamEmblems()
  const [failed, setFailed] = useState<string>()
  const url = teams.find((team) =>
    entryId !== undefined ? team.entryId === entryId : team.managerId === managerId,
  )?.url
  if (!url || failed === url) return null
  return (
    <img
      className="team-emblem"
      data-reveal-role={revealRole}
      src={url}
      alt=""
      width={32}
      height={32}
      decoding="async"
      onError={() => setFailed(url)}
    />
  )
}
