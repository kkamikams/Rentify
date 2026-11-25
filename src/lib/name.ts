export const isValidName = (value: string) =>
  !/[\p{N}\d]/u.test(value.trim()) &&
  /\p{L}/u.test(value.trim())

export const digitsOnly = (value: string) => value.replace(/\D/g, '')

export const isValidPhone = (value: string) => /^\d{10,15}$/.test(digitsOnly(value))
