import { Volume2 } from 'lucide-react'

export function NarrationCaption({
  id,
  text,
  status,
}: {
  id?: string
  text: string
  status: string
}) {
  const waiting = status === 'WAITING'
  if (waiting || !id) return null
  return (
    <aside
      key={id ?? 'waiting'}
      className={`narration-caption ${waiting ? 'waiting' : 'has-commentary'}`}
      aria-live="polite"
    >
      <Volume2 size={16} />
      <span>
        <small>AI-generated commentary</small>
        {text}
      </span>
    </aside>
  )
}
