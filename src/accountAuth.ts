import { withBase } from './basePath'
import { renderBlocks, type Block } from './renderPage'

export type DashboardSection = { key: string; title: string; blocks: Block[] }

function renderPasswordField(name: string, placeholder: string, fieldLabel: string, extra = ''): string {
  return `
    <div class="relative">
      <input name="${name}" type="password" placeholder="${placeholder}" required ${extra} class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/20 bg-[var(--color-bg)] px-3 py-2 pr-16" />
      <button type="button" class="account-toggle-password absolute right-2 top-1/2 -translate-y-1/2 font-brand text-[10px] uppercase tracking-wide text-[var(--color-muted)] hover:text-[var(--color-fg)]" data-field-label="${fieldLabel}" aria-label="Show ${fieldLabel}">Show</button>
    </div>
  `
}

function renderStampTrack(tiers: string[]): string {
  return `
    <div class="mb-3 flex items-baseline justify-between font-brand text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
      <span id="account-card-label">Membership Card</span>
      <span>${tiers[0]} &rarr; ${tiers[tiers.length - 1]}</span>
    </div>
    <div class="mb-3 flex gap-2">
      ${tiers
        .map(
          (t, i) =>
            `<span class="h-5 w-5 rounded-full ${i === 0 ? 'bg-[var(--color-accent)]' : 'border border-[var(--color-fg)]/20'}" title="${t}"></span>`
        )
        .join('')}
    </div>
    <p class="mb-6 font-brand text-[10px] text-[var(--color-muted)]">Everyone starts as a Newcomer and moves up by showing up.</p>
  `
}

function renderTabs(tabs: { key: string; label: string }[]): string {
  return `
    <div class="mb-4 flex gap-4 border-b border-[var(--color-fg)]/10 pb-2 font-brand text-xs uppercase tracking-wide">
      ${tabs.map((t) => `<button type="button" class="account-tab text-[var(--color-muted)]" data-tab="${t.key}">${t.label}</button>`).join('')}
    </div>
  `
}

function renderGuestRegion(whatsappHref: string): string {
  return `
    <div id="account-card-guest" class="hidden">
      ${renderTabs([
        { key: 'signup', label: 'Sign up' },
        { key: 'login', label: 'Log in' },
      ])}
      <div data-tab-panel="signup">
        <form id="signup-form" class="space-y-2">
          <input name="name" type="text" placeholder="Name" required class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/20 bg-[var(--color-bg)] px-3 py-2" />
          <input name="whatsappNumber" type="tel" placeholder="WhatsApp number" required class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/20 bg-[var(--color-bg)] px-3 py-2" />
          ${renderPasswordField('password', 'Password', 'new account password', 'minlength="8"')}
          <button type="submit" class="w-full rounded-[var(--radius-brand)] bg-[var(--color-accent)] px-4 py-2 text-sm font-bold uppercase text-[var(--color-fg)] hover:opacity-90">Sign up</button>
          <p id="signup-error" class="text-sm text-[var(--color-accent-text)]"></p>
        </form>
      </div>
      <div data-tab-panel="login" class="hidden">
        <form id="login-form" class="space-y-2">
          <input name="identifier" type="text" placeholder="WhatsApp number" required class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/20 bg-[var(--color-bg)] px-3 py-2" />
          ${renderPasswordField('password', 'Password', 'login password')}
          <button type="submit" class="w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/40 px-4 py-2 text-sm font-bold uppercase hover:border-[var(--color-fg)]">Log in</button>
          <p id="login-error" class="text-sm text-[var(--color-accent-text)]"></p>
        </form>
      </div>
      <a href="${withBase(whatsappHref)}" class="mt-4 block text-center font-brand text-xs uppercase tracking-wide text-[var(--color-accent-text)] hover:underline">Join via WhatsApp</a>
    </div>
  `
}

function renderMemberRegion(dashboardSections: DashboardSection[]): string {
  return `
    <div id="account-card-member" class="hidden">
      ${renderTabs(dashboardSections.map((s) => ({ key: s.key, label: s.title })))}
      ${dashboardSections
        .map(
          (s) => `
        <div data-tab-panel="${s.key}" class="space-y-2 text-sm text-[var(--color-fg)]">
          ${renderBlocks(s.blocks)}
        </div>
      `
        )
        .join('')}
      <button id="account-auth-logout" type="button" class="mt-4 w-full rounded-[var(--radius-brand)] border border-[var(--color-fg)]/40 px-4 py-2 text-sm font-bold uppercase hover:border-[var(--color-fg)]">Log out</button>
    </div>
  `
}

export function renderAuthSection(dashboardSections: DashboardSection[], tiers: string[], whatsappHref: string): string {
  return `
    <section id="account-auth" class="mx-auto max-w-md px-6 py-10">
      <div class="relative rounded-[var(--radius-brand)] border border-[var(--color-fg)]/60 bg-white p-6">
        <span class="absolute -left-[7px] top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full border border-[var(--color-fg)]/60 bg-[var(--color-bg)]"></span>
        <span class="absolute -right-[7px] top-1/2 h-[14px] w-[14px] -translate-y-1/2 rounded-full border border-[var(--color-fg)]/60 bg-[var(--color-bg)]"></span>

        ${renderStampTrack(tiers)}

        <div id="account-auth-loading" class="text-sm text-[var(--color-muted)]">Checking your session…</div>

        ${renderGuestRegion(whatsappHref)}
        ${renderMemberRegion(dashboardSections)}
      </div>
    </section>
  `
}

export function mountAuthSection(): void {
  const loading = document.querySelector<HTMLDivElement>('#account-auth-loading')
  const guest = document.querySelector<HTMLDivElement>('#account-card-guest')
  const member = document.querySelector<HTMLDivElement>('#account-card-member')
  const label = document.querySelector<HTMLSpanElement>('#account-card-label')
  const logoutBtn = document.querySelector<HTMLButtonElement>('#account-auth-logout')
  const signupForm = document.querySelector<HTMLFormElement>('#signup-form')
  const loginForm = document.querySelector<HTMLFormElement>('#login-form')
  const signupError = document.querySelector<HTMLParagraphElement>('#signup-error')
  const loginError = document.querySelector<HTMLParagraphElement>('#login-error')

  if (!loading || !guest || !member || !label || !logoutBtn || !signupForm || !loginForm || !signupError || !loginError) {
    return
  }

  function wireTabGroup(root: HTMLElement): void {
    const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('.account-tab'))
    const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-tab-panel]'))

    function activate(target: string) {
      tabs.forEach((t) => {
        const active = t.dataset.tab === target
        t.classList.toggle('text-[var(--color-fg)]', active)
        t.classList.toggle('font-bold', active)
        t.classList.toggle('border-b-2', active)
        t.classList.toggle('border-[var(--color-accent)]', active)
        t.classList.toggle('text-[var(--color-muted)]', !active)
      })
      panels.forEach((p) => {
        p.classList.toggle('hidden', p.dataset.tabPanel !== target)
      })
    }

    tabs.forEach((t) => t.addEventListener('click', () => activate(t.dataset.tab!)))
    if (tabs.length) activate(tabs[0].dataset.tab!)
  }

  wireTabGroup(guest)
  wireTabGroup(member)

  document.querySelectorAll<HTMLButtonElement>('.account-toggle-password').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling as HTMLInputElement
      const showing = input.type === 'text'
      input.type = showing ? 'password' : 'text'
      btn.textContent = showing ? 'Show' : 'Hide'
      btn.setAttribute('aria-label', `${showing ? 'Show' : 'Hide'} ${btn.dataset.fieldLabel}`)
    })
  })

  async function refresh() {
    const res = await fetch(withBase('/api/auth/me'))
    loading!.classList.add('hidden')
    if (res.ok) {
      const user = await res.json()
      label!.textContent = `Welcome back, ${user.name}`
      member!.classList.remove('hidden')
      guest!.classList.add('hidden')
    } else {
      label!.textContent = 'Membership Card'
      member!.classList.add('hidden')
      guest!.classList.remove('hidden')
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
