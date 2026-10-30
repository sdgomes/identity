export function cpfDigits(value: string) {
  return value.replace(/\D/g, '').slice(0, 11)
}

// Aplica a máscara 000.000.000-00 conforme os dígitos são digitados.
export function formatCpf(value: string) {
  const digits = cpfDigits(value)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
}

// Mesma regra de public.is_valid_cpf no banco.
export function isValidCpf(value: string) {
  const cpf = cpfDigits(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const digits = cpf.split('').map(Number)
  return [9, 10].every((position) => {
    const sum = digits.slice(0, position).reduce((total, digit, index) => total + digit * (position + 1 - index), 0)
    return (sum * 10) % 11 % 10 === digits[position]
  })
}
