export const fieldStyle = 'mt-1 block w-full rounded-lg border border-white/20 bg-stone-900 px-3 py-2 text-white'
export const buttonStyle = 'rounded-lg border border-white/20 px-4 py-2 font-semibold disabled:opacity-50'

export function formText(form: FormData, key: string) {
  return String(form.get(key) ?? '').trim()
}

export function formNumber(form: FormData, key: string) {
  const value = formText(form, key)
  return value === '' ? null : Number(value)
}

export function formCountries(form: FormData) {
  return formText(form, 'countries').toUpperCase().split(/[\s,]+/).filter(Boolean)
}
