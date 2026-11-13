'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { packageFields, standardLetterCode, type ShippingConfig, type ShippingRate } from '../../../lib/shop/shipping-config'
import type { Merchandise } from '../../../lib/shop/merchandise'
import { fieldStyle, formCountries, formNumber } from '../shipping/fields'
import { shopAdminRequest } from './request'

const labels = { lengthMm: 'Länge (mm)', widthMm: 'Breite (mm)', depthMm: 'Höhe oder Dicke (mm)', weightG: 'Gewicht (g)' }

export function productShippingFields(form: FormData) {
  if (!form.has('shipping_config_loaded')) return {}
  const measurements = packageFields.map(field => [field, formNumber(form, field)] as const)
  return {
    shipping_config: {
      rateCodes: form.getAll('shipping_rate'),
      domesticOnly: form.has('domestic_only'),
      countries: formCountries(form),
      package: measurements.every(([, value]) => value === null) ? null : Object.fromEntries(measurements),
      standardLetterVerified: form.has('standard_letter_verified'),
    },
  }
}

export default function ProductShipping({ config, fulfillment, disabled }: {
  config: ShippingConfig | null
  fulfillment: Merchandise['fulfillment_type']
  disabled: boolean
}) {
  const [rates, setRates] = useState<ShippingRate[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void shopAdminRequest('/api/admin/shop/shipping').then(({ rates }) => { if (active) setRates(rates) })
      .catch(error => { if (active) setError(error.message) })
    return () => { active = false }
  }, [])

  return <fieldset disabled={disabled} className="rounded-xl border border-white/15 bg-black/20 p-4 sm:col-span-2">
    <legend className="px-2 text-lg font-bold">Versand & Fulfillment</legend>
    <p className="mb-3 text-sm text-stone-300">Versandarten und Versandbeschränkungen für dieses Produkt vorbereiten.</p>
    {error && <p role="alert" className="text-amber-200">{error}</p>}
    {!rates && !error && <p role="status">Versandarten werden geladen …</p>}
    {rates && <>
      <input type="hidden" name="shipping_config_loaded" value="true" />
      <div className="grid gap-2 sm:grid-cols-2">
        {rates.filter(rate => config?.rateCodes.includes(rate.code) ||
          (fulfillment === 'self' ? rate.mode === 'self' : rate.mode === 'partner' && rate.partner === fulfillment))
          .map(rate => <label className="rounded-lg border border-white/15 px-3 py-2 text-sm" key={rate.code}>
            <input name="shipping_rate" className="mr-2" type="checkbox" value={rate.code} defaultChecked={config?.rateCodes.includes(rate.code)} />
            {rate.carrier} · {rate.name}{!rate.active && ' (inaktiv)'}
          </label>)}
      </div>
      <Link href="/admin/shop/shipping" className="mt-3 inline-block text-sm text-emerald-300 underline">Zentrale Versandarten</Link>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label><input name="domestic_only" className="mr-2" type="checkbox" defaultChecked={config?.domesticOnly} />Nur Deutschland</label>
        <label>Zulässige Länder (optional)<input name="countries" className={fieldStyle} defaultValue={config?.countries.join(', ') ?? ''} /></label>
        {packageFields.map(field => <label key={field}>{labels[field]} inklusive Verpackung
          <input name={field} className={fieldStyle} type="number" min="1" max={field === 'weightG' ? 10000000 : 100000} defaultValue={config?.package?.[field] ?? ''} />
        </label>)}
      </div>
      {fulfillment === 'self' && rates.some(rate => rate.code === standardLetterCode) && <label className="mt-4 block">
        <input name="standard_letter_verified" className="mr-2" type="checkbox" defaultChecked={config?.standardLetterVerified} />
        Standardbrief geprüft. Maße und Gewicht wurden an der verpackten Sendung gemessen. Die Sendung erfüllt die Anforderungen an die maschinelle Verarbeitung.
      </label>}
    </>}
  </fieldset>
}
