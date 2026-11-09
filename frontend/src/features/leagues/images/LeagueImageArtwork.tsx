import type { Ref } from 'react'
import {
  imagePages,
  imageTitles,
  type ImageClub,
  type ImageMatch,
  type LeagueImage,
} from './imageData'

function Emblem({ club }: { club: ImageClub }) {
  return club.emblem ? (
    <img src={club.emblem} alt="" className="art-emblem" />
  ) : (
    <span className="art-monogram">{club.name.slice(0, 1)}</span>
  )
}
function Identity({ club }: { club: ImageClub }) {
  return (
    <div className="art-identity">
      <span className="art-emblem-slot">
        <Emblem club={club} />
      </span>
      <div>
        <b>{club.name}</b>
        <small>{club.manager}</small>
      </div>
    </div>
  )
}
function Movement({ club }: { club: ImageClub }) {
  return (
    <span
      className="art-movement"
      data-direction={
        club.movement === null || club.movement === 0 ? 'same' : club.movement > 0 ? 'up' : 'down'
      }
    >
      {club.movement === null
        ? '—'
        : club.movement === 0
          ? ''
          : `${club.movement > 0 ? '↑' : '↓'} ${Math.abs(club.movement)}`}
    </span>
  )
}
function Form({ club }: { club: ImageClub }) {
  return (
    <div className="art-form">
      {club.form.map((match, index) => (
        <span key={index} data-result={match.result} data-provisional={match.provisional}>
          {match.result}
        </span>
      ))}
    </div>
  )
}
function Match({ match }: { match: ImageMatch }) {
  return (
    <article className="art-match" data-result={match.result ?? 'unknown'}>
      <div className="art-match-meta art-result-status">
        <span>
          {match.status}
          {match.result === 'draw' ? ' · Draw' : ''}
        </span>
        <span>{match.source}</span>
      </div>
      <div className="art-match-teams">
        {match.clubs.map((club, side) => (
          <div
            className="art-match-team"
            key={side}
            data-winner={match.result === (side === 0 ? 'first' : 'second')}
            data-loser={match.result === (side === 0 ? 'second' : 'first')}
          >
            <Emblem club={club} />
            <div className="art-match-identity">
              <b>{club.name}</b>
              <small>{club.manager}</small>
            </div>
            <strong>{match.scores[side] ?? '—'}</strong>
          </div>
        ))}
      </div>
    </article>
  )
}
function FeaturedMatch({ match }: { match: ImageMatch }) {
  return (
    <section className="art-featured-match" aria-label="Matchup result">
      {match.clubs.map((club, side) => (
        <div className="art-featured-emblem" data-side={side} key={side}>
          <Emblem club={club} />
        </div>
      ))}
      <div className="art-featured-content">
        <p className="art-featured-meta art-result-status">
          {match.status}
          {match.result === 'draw' ? ' · Draw' : ''} · {match.source}
        </p>
        <div className="art-featured-scoreboard">
          {match.clubs.map((club, side) => (
            <div className="art-featured-team" data-side={side} key={side}>
              <div>
                <b>{club.name}</b>
                <small>{club.manager}</small>
              </div>
              <strong>{match.scores[side] ?? '—'}</strong>
            </div>
          ))}
          <span className="art-featured-dash" aria-hidden="true">
            –
          </span>
        </div>
      </div>
    </section>
  )
}
export function LeagueImageArtwork({
  image,
  format,
  page,
  artworkRef,
}: {
  image: LeagueImage
  format: 'square' | 'story'
  page: number
  artworkRef: Ref<HTMLDivElement>
}) {
  const h2h = image.scoring === 'H2H'
  const matches = image.matches.slice(page * 10, (page + 1) * 10)
  const matchRows =
    format === 'square' && matches.length > 3 ? Math.ceil(matches.length / 2) : matches.length
  return (
    <div
      ref={artworkRef}
      className="league-art"
      data-format={format}
      data-kind={image.kind}
      data-scoring={image.scoring}
      data-many-clubs={image.clubs.length > 10}
      data-few-clubs={image.clubs.length <= 6}
      data-dense={matches.length > 5 || (format === 'square' && matches.length > 3)}
    >
      <header className="art-header">
        <div className="art-brand">
          <span className="art-brand-mark">FB</span>
          <span>
            FANTASY
            <br />
            BROADCAST
          </span>
        </div>
        <div className="art-edition">
          <b>GW {image.week}</b>
          <span>
            {image.source}
            {image.status ? ` · ${image.status}` : ''}
            {image.stale ? ' · Stale' : ''}
          </span>
        </div>
      </header>
      <div className="art-heading">
        <span>
          {image.kind === 'standings' && image.totalClubs > 12
            ? 'THE TOP 12'
            : imageTitles[image.kind].toUpperCase()}
        </span>
        <h1>{image.league}</h1>
        <div className="art-rule" />
      </div>
      <main className="art-content">
        {image.kind === 'standings' && (
          <div className="art-standings">
            <div className="art-table-heading">
              <span>#</span>
              <span>Club / Manager</span>
              <span>Move</span>
              {h2h && (
                <>
                  <span>Form</span>
                  <span className="art-numeric-heading">
                    Fantasy
                    <br />
                    pts
                  </span>
                </>
              )}
              <span className="art-numeric-heading">
                {h2h ? 'League' : 'Total'}
                <br />
                pts
              </span>
            </div>
            {image.clubs.map((club) => (
              <div className="art-standing" key={club.id}>
                <strong className="art-rank">{club.rank ?? '—'}</strong>
                <Identity club={club} />
                <Movement club={club} />
                {h2h && (
                  <>
                    <Form club={club} />
                    <span className="art-secondary-points">{club.fantasyPoints ?? '—'}</span>
                  </>
                )}
                <strong className="art-points">{club.points ?? '—'}</strong>
              </div>
            ))}
          </div>
        )}
        {image.kind === 'club' &&
          image.clubs.map((club) => (
            <div className="art-club" key={club.id}>
              <Emblem club={club} />
              <h2>{club.name}</h2>
              <p>{club.manager}</p>
              <div className="art-club-stats">
                <div>
                  <span>League position</span>
                  <strong>{club.rank === null ? '—' : `#${club.rank}`}</strong>
                  <Movement club={club} />
                </div>
                <div>
                  <span>{h2h ? 'League points' : 'Total fantasy points'}</span>
                  <strong>{club.points ?? '—'}</strong>
                  {h2h && <small>{club.fantasyPoints ?? '—'} fantasy points</small>}
                </div>
              </div>
              {h2h && club.form.length > 0 && (
                <div className="art-club-form">
                  <span>Recent form</span>
                  <Form club={club} />
                </div>
              )}
            </div>
          ))}
        {image.kind === 'matchup' && matches[0] && <FeaturedMatch match={matches[0]} />}
        {image.kind === 'matchups' && (
          <div
            className="art-match-list"
            style={{
              gridTemplateRows: `repeat(${matchRows}, minmax(0, 1fr))`,
              height: matchRows * 160 + (matchRows - 1) * 14,
            }}
          >
            {matches.map((match, index) => (
              <Match key={index} match={match} />
            ))}
          </div>
        )}
      </main>
      <footer className="art-footer">
        <div>
          <span>{h2h ? 'HEAD-TO-HEAD' : 'TOTAL POINTS'}</span>
          <small>
            {new Date(image.capturedAt).toLocaleString('en-GB', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
            {imagePages(image) > 1 ? ` · ${page + 1}/${imagePages(image)}` : ''}
          </small>
        </div>
        <b>
          fantasybroadcast.net <span>↗</span>
        </b>
      </footer>
    </div>
  )
}
