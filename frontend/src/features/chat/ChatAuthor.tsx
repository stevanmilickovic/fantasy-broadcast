export function ChatAuthor({ name }: { name: string }) {
  return (
    <span className="chat-author">
      <strong>{name}</strong>
    </span>
  )
}
