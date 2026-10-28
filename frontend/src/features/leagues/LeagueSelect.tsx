import { Check, ChevronDown, X } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { useDialogMotion } from '../../shared/ui/useDialogMotion'

type Option = { value: number; label: string; description?: string; badge?: string }

// Native dialogs keep the picker inside the viewport, including browser device emulation.
export function LeagueSelect({
  label,
  value,
  options,
  onChange,
  icon,
  action,
  showDescription = true,
}: {
  label: string
  value: number
  options: Option[]
  onChange: (value: number) => void
  icon?: ReactNode
  showDescription?: boolean
  action?: { label: string; onClick: () => void }
}) {
  const id = useId()
  const { dialog, open, closing, close, show, onClose } = useDialogMotion()
  const selected = options.find((option) => option.value === value)
  return (
    <div className="league-select">
      <button
        className="league-select-trigger"
        type="button"
        aria-label={label}
        aria-describedby={`${id}-value`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          show()
          dialog.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus()
        }}
      >
        {icon}
        <span id={`${id}-value`}>
          <strong>
            {selected?.label ?? 'Choose an option'}
            {selected?.badge && <span className="owner-badge">{selected.badge}</span>}
          </strong>
          {showDescription && selected?.description && <small>{selected.description}</small>}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <dialog
        ref={dialog}
        className="league-select-dialog dialog-motion"
        data-closing={closing}
        aria-labelledby={`${id}-title`}
        onClose={onClose}
        onCancel={(event) => {
          event.preventDefault()
          close()
        }}
        onClick={(event) => {
          if (event.target === dialog.current) close()
        }}
      >
        <header>
          <div>
            <span className="kicker">Choose</span>
            <h2 id={`${id}-title`}>{label}</h2>
          </div>
          <button
            type="button"
            aria-label={`Close ${label.toLowerCase()} selection`}
            onClick={() => close()}
          >
            <X size={20} />
          </button>
        </header>
        <div className="league-select-options">
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={option.value === value}
              onClick={() => {
                close(() => onChange(option.value))
              }}
              onKeyDown={(event) => {
                const next =
                  event.key === 'ArrowDown'
                    ? (index + 1) % options.length
                    : event.key === 'ArrowUp'
                      ? (index + options.length - 1) % options.length
                      : event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? options.length - 1
                          : undefined
                if (next !== undefined) {
                  event.preventDefault()
                  event.currentTarget.parentElement?.querySelectorAll('button')[next]?.focus()
                }
              }}
            >
              <span>
                <strong>
                  {option.label}
                  {option.badge && <span className="owner-badge">{option.badge}</span>}
                </strong>
                {option.description && <small>{option.description}</small>}
              </span>
              {option.value === value && <Check size={18} aria-hidden="true" />}
            </button>
          ))}
        </div>
        {action && (
          <footer>
            <button type="button" onClick={() => close(action.onClick)}>
              {action.label}
            </button>
          </footer>
        )}
      </dialog>
    </div>
  )
}
