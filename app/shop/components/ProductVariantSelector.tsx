'use client'

import { useState } from 'react'

export type ProductVariantOption = {
  label: string
  values: string[]
}

type ProductVariantSelectorProps = {
  options: ProductVariantOption[]
  onChange?: (selection: Record<string, string>) => void
}

export default function ProductVariantSelector({
  options,
  onChange,
}: ProductVariantSelectorProps) {
  const [selected, setSelected] = useState<Record<string, string>>({})

  // Produkte ohne Varianten benötigen keine Auswahl.
  if (options.length === 0) {
    return null
  }

  function handleSelect(label: string, value: string) {
    const updated = {
      ...selected,
      [label]: value,
    }

    setSelected(updated)
    onChange?.(updated)
  }

  return (
    <div className="mt-6 space-y-6">

      {options.map((option) => (
        <div key={option.label}>

          <div className="mb-3 text-sm font-semibold text-[#20241F]">
            {option.label}
            {selected[option.label] && (
              <span className="ml-2 font-normal text-[#626760]">
                – {selected[option.label]}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-3">

            {option.values.map((value) => {
              const isSelected = selected[option.label] === value

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleSelect(option.label, value)}
                  aria-pressed={isSelected}
                  className={`min-h-[44px] min-w-[54px] rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                    isSelected
                      ? 'border-[#244B36] bg-[#244B36] text-white'
                      : 'border-[#D7D3C9] bg-white text-[#20241F] hover:border-[#244B36]'
                  }`}
                >
                  {value}
                </button>
              )
            })}

          </div>

        </div>
      ))}

    </div>
  )
}