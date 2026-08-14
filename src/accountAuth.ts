import { withBase } from './basePath'
import { renderBlocks, type Block } from './renderPage'

export type DashboardSection = { key: string; title: string; blocks: Block[] }

function renderPasswordField(name: string, placeholder: string, extra = ''): string {
  return `
    <div class="relative">
      <input name="${name}" type="password" placeholder="${placeholder}" required ${extra} class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/20 bg-[var(--color-bg)] px-3 py-2 pr-16" />
      <button type="button" class="account-toggle-password absolute right-2 top-1/2 -translate-y-1/2 font-brand text-[10px] uppercase tracking-wide text-[var(--color-muted)] hover:text-[var(--color-fg)]">Show</button>
    </div>
  `
}

function renderDashboardSections(sections: DashboardSection[]): string {
  return `
    <div class="grid gap-4 sm:grid-cols-3">
      ${sections
        .map(
          (s) => `
        <div class="rounded-[var(--radius-brand)] border border-[var(--color-fg)]/15 bg-[var(--color-panel)] p-5">
          <h3 class="font-brand font-bold">${s.title}</h3>
          <div class="mt-2 space-y-2 text-sm text-[var(--color-fg)]">${renderBlocks(s.blocks)}</div>
        </div>
      `
        )
        .join('')}
    </div>
  `
}

export function renderAuthSection(dashboardSections: DashboardSection[]): string {
  return `
    <section id="account-auth" class="mx-auto max-w-4xl px-6 py-10">
      <div id="account-auth-loading" class="text-sm text-[var(--color-muted)]">Checking your session…</div>
      <div id="account-auth-loggedin" class="hidden space-y-6">
        <p class="font-brand text-sm uppercase tracking-wide text-[var(--color-muted)]">Welcome back, <span id="account-auth-name" class="font-bold text-[var(--color-fg)]"></span></p>
        ${renderDashboardSections(dashboardSections)}
        <button id="account-auth-logout" type="button" class="rounded-[var(--radius-brand)] border border-[var(--color-fg)]/40 px-4 py-2 text-sm font-bold uppercase hover:border-[var(--color-fg)]">Log out</button>
      </div>
      <div id="account-auth-forms" class="hidden space-y-8 rounded-[var(--radius-brand)] border border-[var(--color-fg)]/15 bg-[var(--color-panel)] p-6">
        <form id="signup-form" class="space-y-2">
          <h3 class="font-brand font-bold">Create an account</h3>
          <input name="name" type="text" placeholder="Name" required class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/20 bg-[var(--color-bg)] px-3 py-2" />
          <input name="whatsappNumber" type="tel" placeholder="WhatsApp number" required class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/20 bg-[var(--color-bg)] px-3 py-2" />
          ${renderPasswordField('password', 'Password', 'minlength="8"')}
          <button type="submit" class="w-full rounded-[var(--radius-brand)] bg-[var(--color-accent)] px-4 py-2 text-sm font-bold uppercase text-[var(--color-fg)] hover:opacity-90">Sign up</button>
          <p id="signup-error" class="text-sm text-[var(--color-accent-text)]"></p>
        </form>
        <form id="login-form" class="space-y-2">
          <h3 class="font-brand font-bold">Log in</h3>
          <input name="identifier" type="text" placeholder="WhatsApp number" required class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/20 bg-[var(--color-bg)] px-3 py-2" />
          ${renderPasswordField('password', 'Password')}
          <button type="submit" class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/40 px-4 py-2 text-sm font-bold uppercase hover:border-[var(--color-fg)]">Log in</button>
          <p id="login-error" class="text-sm text-[var(--color-accent-text)]"></p>
        </form>
      </div>
    </section>
  `
}

export function mountAuthSection(dashboardSections: DashboardSection[]): void {
  const loading = document.querySelector<HTMLDivElement>('#account-auth-loading')
  const loggedIn = document.querySelector<HTMLDivElement>('#account-auth-loggedin')
  const forms = document.querySelector<HTMLDivElement>('#account-auth-forms')
  const nameEl = document.querySelector<HTMLSpanElement>('#account-auth-name')
  const logoutBtn = document.querySelector<HTMLButtonElement>('#account-auth-logout')
  const signupForm = document.querySelector<HTMLFormElement>('#signup-form')
  const loginForm = document.querySelector<HTMLFormElement>('#login-form')
  const signupError = document.querySelector<HTMLParagraphElement>('#signup-error')
  const loginError = document.querySelector<HTMLParagraphElement>('#login-error')

  if (!loading || !loggedIn || !forms || !nameEl || !logoutBtn || !signupForm || !loginForm || !signupError || !loginError) {
    return
  }

  document.querySelectorAll<HTMLButtonElement>('.account-toggle-password').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling as HTMLInputElement
      const showing = input.type === 'text'
      input.type = showing ? 'password' : 'text'
      btn.textContent = showing ? 'Show' : 'Hide'
    })
  })

  async function refresh() {
    const res = await fetch(withBase('/api/auth/me'))
    loading!.classList.add('hidden')
    if (res.ok) {
      const user = await res.json()
      nameEl!.textContent = user.name
      loggedIn!.classList.remove('hidden')
      forms!.classList.add('hidden')
    } else {
      loggedIn!.classList.add('hidden')
      forms!.classList.remove('hidden')
    }
  }

  logoutBtn.addEventListener('click', async () => {
    await fetch(withBase('/api/auth/logout'), { method: 'POST' })
    refresh()
  })

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    signupError.textContent = ''
    const form = new FormData(signupForm)
    const res = await fetch(withBase('/api/auth/signup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        whatsappNumber: form.get('whatsappNumber'),
        password: form.get('password'),
      }),
    })
    if (res.ok) return refresh()
    const body = await res.json().catch(() => ({}))
    signupError.textContent = body.error ?? 'Signup failed.'
  })

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    loginError.textContent = ''
    const form = new FormData(loginForm)
    const res = await fetch(withBase('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: form.get('identifier'), password: form.get('password') }),
    })
    if (res.ok) return refresh()
    loginError.textContent = 'Login failed.'
  })

  refresh()
}
