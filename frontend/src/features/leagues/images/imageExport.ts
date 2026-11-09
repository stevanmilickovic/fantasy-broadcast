import type { LeagueImage } from './imageData'

async function embeddedImage(url: string, signal: AbortSignal): Promise<string | null> {
  try {
    const address = new URL(url, location.origin)
    if (address.origin !== location.origin) return null
    const response = await fetch(address, { credentials: 'same-origin', signal })
    if (!response.ok) return null
    const blob = await response.blob()
    if (!blob.type.startsWith('image/')) return null
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () =>
        typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('Invalid image'))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
    const image = new Image()
    image.src = dataUrl
    await image.decode()
    signal.throwIfAborted()
    return dataUrl
  } catch (error) {
    if (signal.aborted) throw error
    return null
  }
}
export async function prepareImageAssets(
  image: LeagueImage,
  signal: AbortSignal,
): Promise<LeagueImage> {
  const clubs = [...image.clubs, ...image.matches.flatMap((match) => match.clubs)]
  const urls = [...new Set(clubs.flatMap((club) => (club.emblem ? [club.emblem] : [])))]
  const resources = new Map(
    await Promise.all(urls.map(async (url) => [url, await embeddedImage(url, signal)] as const)),
  )
  signal.throwIfAborted()
  const prepare = (club: (typeof clubs)[number]) => ({
    ...club,
    emblem: club.emblem ? (resources.get(club.emblem) ?? null) : null,
  })
  return {
    ...image,
    clubs: image.clubs.map(prepare),
    matches: image.matches.map((match) => ({ ...match, clubs: match.clubs.map(prepare) })),
  }
}
export async function exportImage(
  node: HTMLElement,
  height: number,
  signal: AbortSignal,
): Promise<Blob> {
  const { toBlob } = await import('html-to-image')
  await document.fonts.ready
  await Promise.all([...node.querySelectorAll('img')].map((image) => image.decode()))
  signal.throwIfAborted()
  const options = {
    width: 1080,
    height,
    canvasWidth: 1080,
    canvasHeight: height,
    pixelRatio: 1,
    backgroundColor: '#17051f',
    style: { transform: 'none', margin: '0' },
  }
  // WebKit can omit decoded embedded images on its first canvas draw; warm up the same artwork.
  await toBlob(node, options)
  signal.throwIfAborted()
  const blob = await toBlob(node, options)
  signal.throwIfAborted()
  if (!blob) throw new Error('Image export failed. Please try again.')
  return blob
}
