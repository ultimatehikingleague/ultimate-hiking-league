import Link from '@/i18n/prototype/LocalizedLink'

type BackToHomeButtonProps = {
  className?: string
  label?: string
}

export default function BackToHomeButton({
  className = '',
  label = '← Zurück zur Startseite',
}: BackToHomeButtonProps) {
  return (
    <Link
      href="/"
      className={`inline-block rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-stone-200 transition hover:border-white/20 hover:bg-white/10 ${className}`.trim()}
    >
      {label}
    </Link>
  )
}