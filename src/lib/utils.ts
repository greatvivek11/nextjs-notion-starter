export function cn(
  ...inputs: (
    | string
    | boolean
    | undefined
    | null
    | { [key: string]: boolean | undefined | null }
  )[]
) {
  return inputs
    .flatMap((input) => {
      if (!input) return []
      if (typeof input === 'string') return [input]
      return Object.entries(input)
        .filter(([_, value]) => !!value)
        .map(([key]) => key)
    })
    .join(' ')
}
