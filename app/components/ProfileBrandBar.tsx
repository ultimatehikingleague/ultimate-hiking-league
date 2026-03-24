import Image from 'next/image'

export default function ProfileBrandBar() {
  return (
    <div className="mb-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 shadow-xl shadow-black/10 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <Image
          src="/ultimate-logo-transparent-weiss.png"
          alt="Ultimate European Hiking League"
          width={44}
          height={44}
          className="h-11 w-11 object-contain"
          priority
        />

        <div className="leading-tight">
          <div className="text-xs uppercase tracking-[0.28em] text-stone-400">
            Official Member
          </div>

          <div className="mt-1 text-base font-semibold text-white">
            Ultimate European Hiking League
          </div>
        </div>
      </div>

      <div className="text-[11px] uppercase tracking-[0.18em] text-stone-500">
        Official Member
      </div>
    </div>
  )
}