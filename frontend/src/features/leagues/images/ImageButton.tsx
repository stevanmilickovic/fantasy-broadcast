import { ImagePlus } from 'lucide-react'
import './league-images.css'
export function ImageButton({
  label,
  onClick,
  disabled = false,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className="league-image-button"
      aria-label={label}
      title={label}
      aria-haspopup="dialog"
      onClick={onClick}
      disabled={disabled}
    >
      <ImagePlus size={18} aria-hidden="true" />
    </button>
  )
}
