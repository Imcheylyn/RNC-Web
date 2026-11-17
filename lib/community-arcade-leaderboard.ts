export const ARCADE_LEADERBOARD_LIMIT = 10

type Score = { name: string; score: number }
type RankedScore = Score & { rank: number; isMine: boolean }

export function rankArcadeScores<Player extends RankedScore, Seed extends Score>(
  entries: readonly Player[],
  seeds: readonly Seed[],
) {
  const players = entries.filter(entry => entry.rank <= ARCADE_LEADERBOARD_LIMIT)
  const seeded = seeds.map(entry => ({ ...entry, isMine: false, isSeed: true }))
  // Keep the database tie order and place players above seeded scores on a tie.
  const top = [...players, ...seeded]
    .sort((left, right) => right.score - left.score)
    .slice(0, ARCADE_LEADERBOARD_LIMIT)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))

  const savedScore = entries.find(entry => entry.isMine)
  const personal = savedScore ? {
    ...savedScore,
    rank: savedScore.rank + seeds.filter(entry => entry.score > savedScore.score).length,
  } : null

  return { top, personal }
}
