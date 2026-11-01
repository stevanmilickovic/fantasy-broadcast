export function ChatAuthor({ name, email }: { name: string; email: string }) {
  return (
    <span className="chat-author">
      <strong>{name}</strong> <span className="chat-author-email">{email}</span>
    </span>
  )
}
