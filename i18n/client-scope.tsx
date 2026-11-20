import { getMessages } from 'next-intl/server'
import type { ReactNode } from 'react'
import ClientMessages from './ClientMessages'

type Namespace = Exclude<keyof typeof import('../messages/en.json'), 'ui'>

export function clientScope(...namespaces: Namespace[]) {
  return async function ClientScope({ children }: { children: ReactNode }) {
    const messages = await getMessages()
    const selected = Object.fromEntries(namespaces.map(namespace => [namespace, messages[namespace]]))
    return <ClientMessages messages={selected}>{children}</ClientMessages>
  }
}
