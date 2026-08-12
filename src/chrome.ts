import { withBase } from './basePath'

export type NavItem = { label: string; href: string; slug: string }
export type Track = { title: string; src: string }
export type SiteChrome = {
  brand: { name: string; shortName: string; logo: string }
  nav: { items: NavItem[]; cta: { label: string; href: string } }
  player: { tracks: Track[] }
}

function navLinkClass(isActive: boolean): string {
  return isActive
    ? 'text-[var(--color-fg)] border-b-2 border-[var(--color-accent)]'
    : 'hover:text-[var(--color-fg)]'
}

function renderNavLinks(items: NavItem[], activePage: string): string {
  return items
    .map((item) => `<a href="${withBase(item.href)}" class="${navLinkClass(item.slug === activePage)}">${item.label}</a>`)
    .join('')
}

export function renderHeader(site: SiteChrome, activePage: string): string {
  const navLinks = renderNavLinks(site.nav.items, activePage)

  return `
    <header class="sticky top-0 z-20 border-b border-[var(--color-fg)]/10 bg-[var(--color-bg)]/95 backdrop-blur">
      <div class="relative flex items-center justify-between gap-6 px-6 py-3">
        <a href="${withBase('/')}" class="flex items-center gap-2 font-brand text-sm tracking-wide">
          <img src="${withBase(site.brand.logo)}" alt="" width="32" height="32" />
          ${site.brand.name}
        </a>
        <nav id="desktop-nav" class="hidden flex-1 items-center justify-center gap-5 font-brand text-xs uppercase tracking-wide text-[var(--color-muted)] lg:flex">
          ${navLinks}
        </nav>
        <div class="flex items-center gap-3">
          <details class="lg:hidden">
            <summary class="cursor-pointer list-none font-brand text-xs uppercase tracking-wide text-[var(--color-fg)]">Menu</summary>
            <nav id="mobile-nav" class="absolute inset-x-0 top-full flex flex-col gap-1 border-b border-[var(--color-fg)]/10 bg-[var(--color-bg)] px-6 py-4 font-brand text-xs uppercase tracking-wide text-[var(--color-muted)]">
              ${navLinks}
            </nav>
          </details>
          <a href="${withBase(site.nav.cta.href)}" class="rounded-[var(--radius-brand)] bg-[var(--color-accent)] px-4 py-2 font-brand text-xs font-bold uppercase text-[var(--color-fg)] hover:opacity-90">
            ${site.nav.cta.label}
          </a>
        </div>
      </div>
    </header>
  `
}

export function renderFooter(site: SiteChrome): string {
  const firstTrack = site.player.tracks[0]
  return `
    <footer class="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-fg)]/10 bg-[var(--color-panel)] px-6 py-3 font-brand text-xs text-[var(--color-muted)]">
      <div class="flex items-center gap-4">
        <button id="player-prev" type="button" aria-label="Previous track" class="hover:text-[var(--color-fg)]">&#9664;&#9664;</button>
        <button id="player-toggle" type="button" aria-label="Play" class="w-4 hover:text-[var(--color-fg)]">&#9654;</button>
        <button id="player-next" type="button" aria-label="Next track" class="hover:text-[var(--color-fg)]">&#9654;&#9654;</button>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <span id="player-title" class="truncate">${firstTrack ? firstTrack.title : 'no tracks'}</span>
            <span id="player-count" class="shrink-0 text-[var(--color-muted)]">${site.player.tracks.length ? `1/${site.player.tracks.length}` : ''}</span>
          </div>
          <div id="player-progress-track" class="mt-1 h-1 w-full cursor-pointer rounded-full bg-[var(--color-fg)]/10">
            <div id="player-progress-fill" class="h-1 w-0 rounded-full bg-[var(--color-accent)]"></div>
          </div>
        </div>
        <span class="hidden shrink-0 sm:inline">${site.brand.shortName}</span>
      </div>
      <audio id="player-audio" preload="none"></audio>
    </footer>
  `
}

export function mountPlayer(site: SiteChrome): void {
  const tracks = site.player.tracks
  const audio = document.querySelector<HTMLAudioElement>('#player-audio')
  const toggleBtn = document.querySelector<HTMLButtonElement>('#player-toggle')
  const prevBtn = document.querySelector<HTMLButtonElement>('#player-prev')
  const nextBtn = document.querySelector<HTMLButtonElement>('#player-next')
  const titleEl = document.querySelector<HTMLSpanElement>('#player-title')
  const countEl = document.querySelector<HTMLSpanElement>('#player-count')
  const progressTrack = document.querySelector<HTMLDivElement>('#player-progress-track')
  const progressFill = document.querySelector<HTMLDivElement>('#player-progress-fill')

  if (!tracks.length || !audio || !toggleBtn || !prevBtn || !nextBtn || !titleEl || !countEl || !progressTrack || !progressFill) {
    return
  }

  let index = 0

  function load(i: number, autoplay: boolean) {
    index = (i + tracks.length) % tracks.length
    audio!.src = withBase(tracks[index].src)
    titleEl!.textContent = tracks[index].title
    countEl!.textContent = `${index + 1}/${tracks.length}`
    progressFill!.style.width = '0%'
    if (autoplay) audio!.play().catch(() => {})
  }

  toggleBtn.addEventListener('click', () => {
    if (!audio.src) {
      load(index, true)
      return
    }
    if (audio.paused) audio.play().catch(() => {})
    else audio.pause()
  })
  prevBtn.addEventListener('click', () => load(index - 1, true))
  nextBtn.addEventListener('click', () => load(index + 1, true))
  audio.addEventListener('play', () => {
    toggleBtn.innerHTML = '&#10074;&#10074;'
  })
  audio.addEventListener('pause', () => {
    toggleBtn.innerHTML = '&#9654;'
  })
  audio.addEventListener('ended', () => load(index + 1, true))
  audio.addEventListener('timeupdate', () => {
    if (audio.duration) progressFill.style.width = `${(audio.currentTime / audio.duration) * 100}%`
  })
  progressTrack.addEventListener('click', (e) => {
    if (!audio.duration) return
    const rect = progressTrack.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    audio.currentTime = ratio * audio.duration
  })
}
