import './style.css'
import site from '../content/site.json'
import { renderHeader, renderFooter } from './chrome'

const tone = (t: string) => (t === 'accent' ? 'text-[var(--color-accent)]' : 'text-[var(--color-fg)]')

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  ${renderHeader(site as any, 'home')}

  <main class="relative isolate overflow-hidden">
    <img src="${site.hero.illustration}" alt="" class="pointer-events-none absolute right-[-8%] top-10 -z-10 hidden w-[55%] min-w-[420px] select-none md:block" />

    <section class="mx-auto max-w-6xl px-6 py-20">
      <h1 class="font-brand text-5xl font-bold leading-[0.95] sm:text-7xl">
        ${site.hero.headlineLines.map((l) => `<span class="block ${tone(l.tone)}">${l.text}</span>`).join('')}
      </h1>

      <div class="mt-8 space-y-1 font-brand text-lg text-[var(--color-fg)]">
        ${site.hero.taglineLines.map((l) => `<p>${l}</p>`).join('')}
        <p class="font-bold">${site.hero.ruleLine}</p>
      </div>

      <ul class="mt-6 flex flex-wrap gap-4 font-brand text-xs uppercase tracking-wide text-[var(--color-muted)]">
        ${site.hero.tiers.map((t) => `<li class="border-b border-[var(--color-muted)]/40 pb-1">${t}</li>`).join('')}
      </ul>

      <div class="mt-8 flex flex-wrap gap-4">
        <a href="${site.hero.ctaPrimary.href}" class="rounded-[var(--radius-brand)] bg-[var(--color-accent)] px-6 py-3 font-brand text-sm font-bold uppercase text-[var(--color-fg)] hover:opacity-90">
          ${site.hero.ctaPrimary.label}
        </a>
        <a href="${site.hero.ctaSecondary.href}" class="rounded-[var(--radius-brand)] border border-[var(--color-fg)]/40 px-6 py-3 font-brand text-sm font-bold uppercase hover:border-[var(--color-fg)]">
          ${site.hero.ctaSecondary.label}
        </a>
      </div>

      <div class="mt-24 max-w-xs text-right font-brand text-xs text-[var(--color-muted)] ml-auto">
        ${site.statsBlock.lines.map((l) => `<p>${l}</p>`).join('')}
        <p class="mt-2 space-x-3">
          ${site.statsBlock.links.map((l) => `<a href="${l.href}" class="hover:text-[var(--color-fg)]">${l.label}</a>`).join('')}
        </p>
      </div>
    </section>
  </main>

  ${renderFooter(site as any)}
`
