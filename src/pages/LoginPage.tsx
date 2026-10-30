import { useState, type FormEvent } from 'react'
import levelUpLogo from '../assets/logo-levelup.svg'
import { supabase } from '../lib/supabase'
import { authService } from '../services/auth'

const currentYear = new Date().getFullYear()

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showReset, setShowReset] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: signInError } = await authService.signIn(email.trim(), password)
    setSubmitting(false)
    // Em caso de sucesso, o AuthProvider recebe a nova sessão e troca a tela.
    if (signInError) {
      setError(signInError.message === 'Invalid login credentials'
        ? 'E-mail ou senha incorretos.'
        : 'Não foi possível entrar. Tente novamente.')
    }
  }

  // Tela cheia, sem cabeçalho: marca no centro, formulário logo abaixo e rodapé com a versão.
  return (
    <div className="login-screen">
      <main className="login">
        <h1 className="login-wordmark"><img src={levelUpLogo} alt="Level UP" /></h1>
        {!supabase && (
          <p className="alert" role="alert">
            Login indisponível: configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.
          </p>
        )}
        <form className="login-form" onSubmit={handleSubmit}>
          <input type="email" autoComplete="email" required placeholder="E-mail" aria-label="E-mail" value={email}
            onChange={(event) => setEmail(event.target.value)} />
          <input type="password" autoComplete="current-password" required placeholder="Senha" aria-label="Senha"
            value={password} onChange={(event) => setPassword(event.target.value)} />
          {error && <p className="alert" role="alert">{error}</p>}
          <button type="submit" disabled={submitting || !supabase}>
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        {/* Não há redefinição pelo app: a senha é trocada pela secretaria. */}
        <button type="button" className="login-link" aria-expanded={showReset} onClick={() => setShowReset(!showReset)}>
          Esqueci minha senha
        </button>
        {showReset && <p className="login-hint">Procure a secretaria para redefinir sua senha.</p>}
      </main>
      <footer className="login-footer">
        <span>© {currentYear}. LevelUp All Rights Reserved.</span>
        <span>v{__APP_INFO__.version}</span>
      </footer>
    </div>
  )
}
