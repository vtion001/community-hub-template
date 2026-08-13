export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+63${digits.slice(1)}`
  }
  if (digits.length === 10 && !digits.startsWith('0')) {
    return `+63${digits}`
  }
  if (digits.length === 12 && digits.startsWith('63')) {
    return `+${digits}`
  }
  return null
}
