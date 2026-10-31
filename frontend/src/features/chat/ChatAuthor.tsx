import { useState } from 'react'

export function ChatAuthor({ name, email }: { name: string; email: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <span className="chat-author" data-expanded={expanded}>
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        {name}
      </button>
      <span role="tooltip">{email}</span>
    </span>
  )
}
