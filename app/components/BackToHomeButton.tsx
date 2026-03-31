import Link from 'next/link'

type BackToHomeButtonProps = {
  className?: string
}

export default function BackToHomeButton({
  className = '',
}: BackToHomeButtonProps) {
  return (
    <Link
      href="/"
      className={`inline-block rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-stone-200 transition hover:border-white/20 hover:bg-white/10 ${className}`.trim()}
    >
      ← Zurück zur Startseite
    </Link>
  )
}