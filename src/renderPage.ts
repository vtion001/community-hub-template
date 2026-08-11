export type TextBlock = { type: 'text'; body: string }
export type ListBlock = { type: 'list'; items: string[] }
export type CardsBlock = { type: 'cards'; items: { title: string; body: string }[] }
export type CtaBlock = { type: 'cta'; label: string; href: string }
export type Block = TextBlock | ListBlock | CardsBlock | CtaBlock
export type PageData = { title: string; intro: string; blocks: Block[] }

export function renderPage(page: PageData | undefined): string {
  if (!page) {
    return `<div class="py-24 text-center font-brand text-[var(--color-muted)]">content coming soon.</div>`
  }
  return `
    <h1 class="font-brand text-4xl font-bold sm:text-5xl">${page.title}</h1>
    <p class="mt-4 max-w-2xl text-[var(--color-fg)]">${page.intro}</p>
    <div class="mt-10 space-y-8">
      ${page.blocks.map(renderBlock).join('')}
    </div>
  `
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
      return `<div class="grid gap-4 sm:grid-cols-2">${block.items
        .map(
          (c) =>
            `<div class="rounded-[var(--radius-brand)] border border-[var(--color-fg)]/15 p-5"><h3 class="font-brand font-bold">${c.title}</h3><p class="mt-2 text-sm text-[var(--color-muted)]">${c.body}</p></div>`
        )
        .join('')}</div>`
    case 'cta':
      return `<a href="${block.href}" class="inline-block rounded-[var(--radius-brand)] bg-[var(--color-accent)] px-6 py-3 font-brand text-sm font-bold uppercase text-[var(--color-bg)] hover:opacity-90">${block.label}</a>`
  }
}
