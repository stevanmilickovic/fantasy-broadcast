import { useEffect, useRef, useState } from 'react'
import { Download, Share2, X } from 'lucide-react'
import { useDialogMotion } from '../../../shared/ui/useDialogMotion'
import { LeagueImageArtwork } from './LeagueImageArtwork'
import { exportImage, prepareImageAssets } from './imageExport'
import { imageFilename, imagePages, imageTitles, type LeagueImage } from './imageData'
import './league-images.css'

export function LeagueImageDialog({
  image,
  onDismiss,
}: {
  image: LeagueImage
  onDismiss: () => void
}) {
  const { dialog, show, close, closing, onClose } = useDialogMotion()
  const trigger = useRef(document.activeElement)
  const artwork = useRef<HTMLDivElement>(null)
  const preview = useRef<HTMLDivElement>(null)
  const [format, setFormat] = useState<'square' | 'story'>('square')
  const [page, setPage] = useState(0)
  const [scale, setScale] = useState(0.3)
  const [prepared, setPrepared] = useState<LeagueImage>()
  const [attempt, setAttempt] = useState(0)
  const [failure, setFailure] = useState<{ key: string; message: string }>()
  const [result, setResult] = useState<{ key: string; file: File; url: string }>()
  const [sharing, setSharing] = useState(false)
  const sharePending = useRef(false)
  const height = format === 'square' ? 1080 : 1920
  const key = `${format}:${page}:${attempt}`
  const ready = result?.key === key ? result : undefined
  const error =
    failure?.key === key || failure?.key === `assets:${attempt}` ? failure.message : undefined
  const dismiss = () =>
    close(() => {
      onDismiss()
      if (trigger.current instanceof HTMLElement && trigger.current.isConnected)
        trigger.current.focus()
    })
  useEffect(() => {
    show()
  }, [show])
  useEffect(() => {
    const element = preview.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / 1080))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    void prepareImageAssets(image, controller.signal)
      .then(setPrepared)
      .catch(() => {
        if (!controller.signal.aborted)
          setFailure({
            key: `assets:${attempt}`,
            message: 'Could not prepare this image. Please retry.',
          })
      })
    return () => controller.abort()
  }, [image, attempt])
  useEffect(() => {
    if (!prepared || !artwork.current) return
    const controller = new AbortController()
    let url: string | undefined
    void exportImage(artwork.current, height, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return
        url = URL.createObjectURL(blob)
        setResult({
          key,
          file: new File([blob], imageFilename(image, format, page), { type: 'image/png' }),
          url,
        })
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setFailure({ key, message: 'Could not create the PNG. Please try again.' })
      })
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [prepared, format, page, height, key, image])
  const canShare =
    ready &&
    typeof navigator.canShare === 'function' &&
    typeof navigator.share === 'function' &&
    navigator.canShare({ files: [ready.file] })
  const share = async () => {
    if (!ready || !canShare || sharePending.current) return
    sharePending.current = true
    setSharing(true)
    try {
      await navigator.share({
        files: [ready.file],
        title: `${image.league} · ${imageTitles[image.kind]}`,
      })
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        setFailure({ key, message: 'Sharing failed. You can still download the PNG.' })
    } finally {
      sharePending.current = false
      setSharing(false)
    }
  }
  return (
    <dialog
      ref={dialog}
      className="league-image-dialog dialog-motion"
      data-closing={closing}
      aria-labelledby="league-image-title"
      onClose={() => {
        onClose()
        onDismiss()
      }}
      onCancel={(event) => {
        event.preventDefault()
        dismiss()
      }}
      onClick={(event) => {
        if (event.target === dialog.current) dismiss()
      }}
    >
      <header>
        <div>
          <span className="kicker">CREATE IMAGE</span>
          <h2 id="league-image-title">{imageTitles[image.kind]}</h2>
        </div>
        <button type="button" aria-label="Close image preview" onClick={dismiss}>
          <X size={20} />
        </button>
      </header>
      <div className="league-image-controls">
        <div role="group" aria-label="Image format">
          {(['square', 'story'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={format === value}
              onClick={() => setFormat(value)}
              disabled={sharing}
            >
              {value === 'square' ? 'Square · 1:1' : 'Story · 9:16'}
            </button>
          ))}
        </div>
        {imagePages(image) > 1 && (
          <label>
            Image{' '}
            <select
              aria-label="Image page"
              value={page}
              onChange={(event) => setPage(Number(event.target.value))}
              disabled={sharing}
            >
              {Array.from({ length: imagePages(image) }, (_, index) => (
                <option key={index} value={index}>
                  {index + 1} of {imagePages(image)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div
        className="league-image-preview"
        ref={preview}
        style={{ aspectRatio: `1080 / ${height}` }}
        aria-label="Image preview"
        aria-busy={!ready && !error}
      >
        {prepared && (
          <div className="league-image-scaled" style={{ transform: `scale(${scale})` }}>
            <LeagueImageArtwork image={prepared} format={format} page={page} artworkRef={artwork} />
          </div>
        )}
      </div>
      <footer>
        <div className="league-image-export-status" role={error ? 'alert' : 'status'}>
          {error ? (
            <>
              {error}{' '}
              <button type="button" onClick={() => setAttempt((value) => value + 1)}>
                Retry image
              </button>
            </>
          ) : ready ? (
            `${1080} × ${height} · PNG`
          ) : (
            'Preparing image…'
          )}
        </div>
        <div className="league-image-export-actions">
          <button
            type="button"
            disabled={!ready || sharing}
            onClick={() => {
              if (!ready) return
              const link = document.createElement('a')
              link.href = ready.url
              link.download = ready.file.name
              document.body.append(link)
              link.click()
              link.remove()
            }}
          >
            <Download size={18} /> Download PNG
          </button>
          {canShare && (
            <button type="button" disabled={sharing} onClick={() => void share()}>
              <Share2 size={18} />
              {sharing ? 'Sharing…' : 'Share'}
            </button>
          )}
        </div>
      </footer>
    </dialog>
  )
}
