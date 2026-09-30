type PagePlaceholderProps = {
  eyebrow: string
  title: string
  description: string
  symbol: string
}

export function PagePlaceholder({
  eyebrow,
  title,
  description,
  symbol,
}: PagePlaceholderProps) {
  return (
    <>
      <header className="page-heading">
        <div>
          <p className="page-eyebrow">{eyebrow}</p>
          <h1 className="page-title">{title}</h1>
        </div>
      </header>
      <section aria-label={title} className="placeholder-content">
        <span aria-hidden="true" className="placeholder-symbol">{symbol}</span>
        <h2 className="placeholder-title">Em breve</h2>
        <p className="placeholder-description">{description}</p>
      </section>
    </>
  )
}