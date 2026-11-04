import {
  toPublicPlayer,
  toPrivatePlayer,
  toPublicRoom,
  toPublicVote,
} from './rooms-view.mapper'

const FULL_PLAYER = {
  id: '123e4567-e89b-42d3-a456-426614174001',
  roomId: '123e4567-e89b-42d3-a456-426614174000',
  name: 'Host',
  character: 'Iron Man',
  isLiar: true,
  hasRevealed: true,
  isReady: true,
  isEliminated: false,
  isConnected: true,
  secret: '123e4567-e89b-42d3-a456-426614174099',
  joinedAt: new Date('2026-01-01'),
  passwordHash: 'x-secret-leak-check',
}

describe('rooms-view.mapper (P0-T2)', () => {
  it('vista pública: sin isLiar ni character, solo allowlist', () => {
    const pub: any = toPublicPlayer(FULL_PLAYER, false)
    expect('isLiar' in pub).toBe(false)
    expect('character' in pub).toBe(false)
    expect('passwordHash' in pub).toBe(false)
    expect(pub).toEqual({
      id: FULL_PLAYER.id,
      roomId: FULL_PLAYER.roomId,
      name: FULL_PLAYER.name,
      hasRevealed: true,
      isReady: true,
      isEliminated: false,
      isConnected: true,
      joinedAt: FULL_PLAYER.joinedAt,
    })
  })

  it('vista privada: incluye isLiar y character, sin extras', () => {
    const priv: any = toPrivatePlayer(FULL_PLAYER)
    expect(priv.isLiar).toBe(true)
    expect(priv.character).toBe('Iron Man')
    // P2-T4: el secreto viaja solo aquí, nunca en la pública.
    expect(priv.secret).toBe(FULL_PLAYER.secret)
    expect('passwordHash' in priv).toBe(false)
    const pub2: any = toPublicPlayer(FULL_PLAYER, false)
    expect('secret' in pub2).toBe(false)
  })

  it('FINISHED revela roles pero NUNCA el secret', () => {
    const finished: any = toPublicPlayer(FULL_PLAYER, true)
    expect(finished.isLiar).toBe(true)
    expect(finished.character).toBe('Iron Man')
    // P2: el secreto no viaja ni siquiera con roles revelados.
    expect('secret' in finished).toBe(false)
    expect('passwordHash' in finished).toBe(false)

    const roomFinished: any = toPublicRoom({
      id: 'r',
      status: 'FINISHED',
      players: [FULL_PLAYER],
      votes: [
        {
          id: 'v1',
          roomId: 'r',
          voterId: FULL_PLAYER.id,
          votedForId: 'other',
          round: 1,
          voter: FULL_PLAYER,
          votedFor: { ...FULL_PLAYER, id: 'other', isLiar: false },
        },
      ],
    })
    expect(roomFinished.players[0].isLiar).toBe(true)
    expect(JSON.stringify(roomFinished)).not.toContain('secret')
    expect(JSON.stringify(roomFinished)).not.toContain(
      FULL_PLAYER.secret as string,
    )
  })

  it('toPublicRoom sanea votes[].voter/votedFor anidados', () => {
    const room = {
      id: 'r',
      status: 'VOTING',
      players: [FULL_PLAYER],
      votes: [
        {
          id: 'v1',
          roomId: 'r',
          voterId: FULL_PLAYER.id,
          votedForId: 'other',
          round: 1,
          voter: FULL_PLAYER,
          votedFor: { ...FULL_PLAYER, id: 'other', isLiar: false },
        },
      ],
    }
    const pub: any = toPublicRoom(room)
    expect('isLiar' in pub.players[0]).toBe(false)
    expect('character' in pub.players[0]).toBe(false)
    // El voto plano se conserva, lo anidado se sanea.
    expect(pub.votes[0].voterId).toBe(FULL_PLAYER.id)
    expect('isLiar' in pub.votes[0].voter).toBe(false)
    expect('character' in pub.votes[0].voter).toBe(false)
    expect('isLiar' in pub.votes[0].votedFor).toBe(false)
    expect('character' in pub.votes[0].votedFor).toBe(false)
    // Sin status FINISHED no hay fuga por ningún campo.
    expect(JSON.stringify(pub)).not.toContain('isLiar')
  })

  it('toPublicVote tolera votos sin anidados', () => {
    const v: any = toPublicVote(
      { id: 'v', voterId: 'a', votedForId: 'b', round: 1 },
      false,
    )
    expect(v).toEqual({ id: 'v', voterId: 'a', votedForId: 'b', round: 1 })
  })
})
