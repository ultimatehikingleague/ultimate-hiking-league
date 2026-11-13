export const invoiceNumber = /^UHL-\d{4}-\d{6,19}$/

async function existingFile(directory: FileSystemDirectoryHandle, name: string) {
  try {
    return await directory.getFileHandle(name)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return null
    throw error
  }
}

async function digest(bytes: ArrayBuffer) {
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
}

function isPdf(bytes: ArrayBuffer) {
  return new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-'
}

async function writeNew(directory: FileSystemDirectoryHandle, name: string, content: string | ArrayBuffer) {
  if (await existingFile(directory, name)) throw Error('File already exists')
  const handle = await directory.getFileHandle(name, { create: true })
  const options = { mode: 'exclusive' as const, keepExistingData: true }
  const stream = await handle.createWritable(options)
  try {
    if ((await handle.getFile()).size !== 0) throw Error('File appeared during synchronization')
    await stream.write(content)
    await stream.close()
  } catch (error) {
    await stream.abort().catch(() => {})
    throw error
  }
}

export async function synchronizeInvoiceBackup(
  root: FileSystemDirectoryHandle,
  read: (params: URLSearchParams) => Promise<Response>,
) {
  const result = { added: 0, existing: 0, failed: [] as string[], incomplete: false }
  let after: string | null = null

  do {
    const params = new URLSearchParams()
    if (after) params.set('after', after)
    let page: { numbers: string[]; next: string | null }
    try {
      const response = await read(params)
      if (!response.ok) throw Error('Invoice list unavailable')
      page = await response.json()
      if (!Array.isArray(page.numbers) || (page.next && (!invoiceNumber.test(page.next) || (after && page.next <= after)))) {
        throw Error('Invalid invoice list')
      }
    } catch {
      result.incomplete = true
      return result
    }

    for (const number of page.numbers) {
      try {
        if (!invoiceNumber.test(number)) throw Error('Invalid invoice number')
        const year = await root.getDirectoryHandle(number.slice(4, 8), { create: true })
        const directory = await year.getDirectoryHandle('Ausgangsrechnungen', { create: true })
        const name = number + '.pdf'
        const pdf = await existingFile(directory, name)
        const checksum = await existingFile(directory, name + '.sha256')
        const savedChecksum = checksum ? await (await checksum.getFile()).text() : null

        if (pdf) {
          const bytes = await (await pdf.getFile()).arrayBuffer()
          if (!isPdf(bytes) || savedChecksum !== `${await digest(bytes)}  ${name}\n`) {
            throw Error('Local invoice integrity check failed')
          }
          result.existing++
          continue
        }

        const response = await read(new URLSearchParams({ number }))
        if (!response.ok || response.headers.get('content-type') !== 'application/pdf') throw Error('Invoice unavailable')
        const bytes = await response.arrayBuffer()
        const sha = await digest(bytes)
        if (!isPdf(bytes) || sha !== response.headers.get('x-invoice-sha256')) throw Error('Invalid download')
        const expected = `${sha}  ${name}\n`
        if (savedChecksum !== null && savedChecksum !== expected) throw Error('Checksum conflict')
        if (!checksum) await writeNew(directory, name + '.sha256', expected)
        await writeNew(directory, name, bytes)
        result.added++
      } catch {
        result.failed.push(number)
      }
    }
    after = page.next
  } while (after)

  return result
}
