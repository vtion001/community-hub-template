import { withBase } from './basePath'

export type TextBlock = { type: 'text'; body: string }
export type ListBlock = { type: 'list'; items: string[] }
export type CardsBlock = { type: 'cards'; items: { title: string; body: string; tag?: string }[] }
export type CtaBlock = { type: 'cta'; label: string; href: string }
export type HeadingBlock = { type: 'heading'; text: string }
export type Block = TextBlock | ListBlock | CardsBlock | CtaBlock | HeadingBlock
export type PageData = { title: string; intro: string; blocks: Block[] }

export function renderPage(page: PageData | undefined, opts?: { afterHero?: string }): string {
  if (!page) {
    return `<div class="py-24 text-center font-brand text-[var(--color-muted)]">content coming soon.</div>`
  }

  const ctaBlocks = page.blocks.filter((b): b is CtaBlock => b.type === 'cta')
  const bodyBlocks = page.blocks.filter((b) => b.type !== 'cta')

  return `
    <section class="relative isolate overflow-hidden border-b border-[var(--color-fg)]/10 bg-[var(--color-panel)]">
      <img src="${withBase('/images/hero-bg.svg')}" alt="" class="pointer-events-none absolute right-[-15%] top-1/2 -z-10 hidden w-[42%] min-w-[300px] -translate-y-1/2 select-none opacity-60 lg:block" />
      <div class="mx-auto max-w-4xl px-6 py-16">
        <h1 class="font-brand text-4xl font-bold sm:text-5xl">${page.title}</h1>
        <p class="mt-4 max-w-xl text-[var(--color-fg)]">${page.intro}</p>
      </div>
    </section>
    ${opts?.afterHero ?? ''}

    <section class="mx-auto max-w-4xl px-6 py-14">
      <div class="space-y-8">
        ${bodyBlocks.map(renderBlock).join('')}
      </div>
    </section>
    ${
      ctaBlocks.length
        ? `<section class="border-t border-[var(--color-fg)]/10 bg-[var(--color-panel)]">
      <div class="mx-auto max-w-4xl px-6 py-14 text-center">
        ${ctaBlocks.map(renderBlock).join('')}
      </div>
    </section>`
        : ''
    }
  `
}

export function renderBlocks(blocks: Block[]): string {
  return blocks.map(renderBlock).join('')
}

function renderBlock(block: Block): string {
  switch (block.type) {
    case 'text':
      return `<p class="max-w-2xl text-[var(--color-fg)]">${block.body}</p>`
    case 'list':
      return `<ul class="list-disc space-y-2 pl-5 text-[var(--color-fg)]">${block.items
        .map((i) => `<li>${i}</li>`)
        .join('')}</ul>`
    case 'cards':
      return `<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">${block.items
        .map(
          (c) =>
            `<div class="rounded-[var(--radius-brand)] border border-[var(--color-fg)]/15 p-5">${
              c.tag
                ? `<span class="mb-2 inline-block border-b border-[var(--color-muted)]/40 pb-1 font-brand text-xs uppercase tracking-wide text-[var(--color-muted)]">${c.tag}</span>`
                : ''
            }<h3 class="font-brand font-bold">${c.title}</h3><p class="mt-2 text-sm text-[var(--color-muted)]">${c.body}</p></div>`
        )
        .join('')}</div>`
    case 'heading':
      return `<h2 class="font-brand text-xs font-bold uppercase tracking-wide text-[var(--color-muted)]">${block.text}</h2>`
    case 'cta':
      return `<a href="${withBase(block.href)}" class="inline-block rounded-[var(--radius-brand)] bg-[var(--color-accent)] px-6 py-3 font-brand text-sm font-bold uppercase text-[var(--color-fg)] hover:opacity-90">${block.label}</a>`
  }
}
