// Vistas públicas/privadas P0-T2: allowlists explícitas.
// El broadcast nunca incluye isLiar (ni character ajeno) salvo en FINISHED,
// donde revelar es correcto para GameOver. El rol propio viaja solo por
// canal privado (yourPlayer / ACK).

const PUBLIC_PLAYER_FIELDS = [
  'id',
  'roomId',
  'name',
  'hasRevealed',
  'isReady',
  'isEliminated',
  'isConnected',
  'joinedAt',
] as const

const PRIVATE_PLAYER_FIELDS = [
  ...PUBLIC_PLAYER_FIELDS,
  'isLiar',
  'character',
] as const

function pick(
  obj: Record<string, unknown>,
  fields: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    out[f] = obj[f]
  }
  return out
}

/** Allowlist pública: sin isLiar ni character (salvo revealRoles). */
export function toPublicPlayer(player: any, revealRoles: boolean) {
  if (!player) return player
  if (revealRoles)
    return pick(player as Record<string, unknown>, PRIVATE_PLAYER_FIELDS)
  return pick(player as Record<string, unknown>, PUBLIC_PLAYER_FIELDS)
}

/** Allowlist privada: solo para el dueño (ACK / canal directo). */
export function toPrivatePlayer(player: any) {
  if (!player) return player
  return pick(player as Record<string, unknown>, PRIVATE_PLAYER_FIELDS)
}

/** Sanea un voto: voter/votedFor con la misma allowlist que players. */
export function toPublicVote(vote: any, revealRoles: boolean) {
  if (!vote) return vote
  const { voter, votedFor, ...rest } = vote as Record<string, unknown>
  return {
    ...rest,
    ...(voter ? { voter: toPublicPlayer(voter, revealRoles) } : {}),
    ...(votedFor ? { votedFor: toPublicPlayer(votedFor, revealRoles) } : {}),
  }
}

export function toPublicRoom(room: any) {
  if (!room) return room
  const revealRoles = room.status === 'FINISHED'
  return {
    ...room,
    players: (room.players ?? []).map((p: any) =>
      toPublicPlayer(p, revealRoles),
    ),
    votes: Array.isArray(room.votes)
      ? room.votes.map((v: any) => toPublicVote(v, revealRoles))
      : room.votes,
  }
}
