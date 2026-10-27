import type { FplClubShirt } from './types'
export function shirtCodeFor(clubName: string, shirtCodes: FplClubShirt[]) {
  const requestedName = normalizeClubName(clubName)
  const exactMatch = shirtCodes.find((team) =>
    [team.name, team.shortName].some((name) => normalizeClubName(name) === requestedName),
  )
  if (exactMatch) return exactMatch.code

  const match = shirtCodes
    .map((team) => ({
      team,
      score: Math.max(
        clubNameSimilarity(requestedName, normalizeClubName(team.name)),
        clubShortNameSimilarity(requestedName, normalizeClubName(team.shortName)),
      ),
    }))
    .filter((candidate) => candidate.score >= 50)
    .sort((left, right) => right.score - left.score)[0]
  return match?.team.code
}

function normalizeClubName(name: string | undefined) {
  return (name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function clubNameSimilarity(firstName: string, secondName: string) {
  if (!firstName || !secondName) return 0
  if (firstName.includes(secondName) || secondName.includes(firstName)) return 100
  const firstWords = firstName.split(' ')
  const secondWords = secondName.split(' ')
  const sharedWords = firstWords.filter((word) => secondWords.includes(word)).length
  const firstWordMatches = abbreviatedWordMatches(firstWords[0], secondWords[0])
  const lastWordMatches = abbreviatedWordMatches(firstWords.at(-1), secondWords.at(-1))
  return sharedWords * 30 + (firstWordMatches ? 25 : 0) + (lastWordMatches ? 25 : 0)
}

function clubShortNameSimilarity(clubName: string, shortName: string) {
  if (!clubName || !shortName) return 0
  return clubName
    .split(' ')
    .some((word) => word.startsWith(shortName) || shortName.startsWith(word))
    ? 70
    : 0
}

function abbreviatedWordMatches(firstWord: string | undefined, secondWord: string | undefined) {
  if (!firstWord || !secondWord) return false
  return (
    firstWord.startsWith(secondWord) ||
    secondWord.startsWith(firstWord) ||
    firstWord.slice(0, 3) === secondWord.slice(0, 3) ||
    (firstWord[0] === secondWord[0] && firstWord.at(-1) === secondWord.at(-1))
  )
}
