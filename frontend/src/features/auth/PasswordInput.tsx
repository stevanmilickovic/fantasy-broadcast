import { Eye, EyeOff } from 'lucide-react'
const PASSWORD_MIN_LENGTH = 12

export function PasswordInput({
  label,
  value,
  showPassword,
  autoComplete,
  onChange,
  onToggle,
  disabled = false,
}: {
  label: string
  value: string
  showPassword: boolean
  autoComplete: 'current-password' | 'new-password'
  onChange: (value: string) => void
  onToggle: () => void
  disabled?: boolean
}) {
  const id = label.toLowerCase().replaceAll(' ', '-')
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div className="password-field">
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          disabled={disabled}
          maxLength={200}
          minLength={autoComplete === 'new-password' ? PASSWORD_MIN_LENGTH : 5}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          aria-label={`${showPassword ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          disabled={disabled}
          onClick={onToggle}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </>
  )
}
