type Messages = typeof import('../messages/en.json')

export type UiFeedback<Namespace extends keyof Messages> = {
  key: Extract<keyof Messages[Namespace], string>
  detail?: string
}
