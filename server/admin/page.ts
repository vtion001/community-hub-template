export function renderAdminPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Admin — Sig & Espresso</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 16px; }
    input, button, textarea { font: inherit; padding: 8px; margin: 4px 0; width: 100%; box-sizing: border-box; }
    button { cursor: pointer; }
    #roster-list { list-style: none; padding: 0; }
    #roster-list li { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #ddd; }
    .error { color: #b00; }
  </style>
</head>
<body>
  <div id="app">Loading…</div>
  <script>
    const app = document.getElementById('app')

    async function me() {
      const res = await fetch('/api/auth/me')
      return res.ok ? res.json() : null
    }

    function renderLogin() {
      app.innerHTML = \`
        <h1>Admin login</h1>
        <form id="login-form">
          <input name="identifier" type="email" placeholder="Admin email" required />
          <input name="password" type="password" placeholder="Password" required />
          <button type="submit">Log in</button>
          <p class="error" id="login-error"></p>
        </form>
      \`
      document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault()
        const form = new FormData(e.target)
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: form.get('identifier'), password: form.get('password') }),
        })
        if (res.ok) return boot()
        document.getElementById('login-error').textContent = 'Login failed.'
      })
    }

    async function renderRoster() {
      const res = await fetch('/api/admin/roster')
      const roster = res.ok ? await res.json() : []
      app.innerHTML = \`
        <h1>Roster</h1>
        <button id="logout">Log out</button>
        <textarea id="numbers" rows="4" placeholder="One WhatsApp number per line"></textarea>
        <button id="add">Add numbers</button>
        <ul id="roster-list">
          \${roster.map((r) => \`<li>\${r.whatsapp_number}\${r.note ? ' — ' + r.note : ''} <button data-id="\${r.id}" class="remove">Remove</button></li>\`).join('')}
        </ul>
      \`
      document.getElementById('logout').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        boot()
      })
      document.getElementById('add').addEventListener('click', async () => {
        const numbers = document.getElementById('numbers').value.split('\\n').map((s) => s.trim()).filter(Boolean)
        await fetch('/api/admin/roster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ numbers }),
        })
        renderRoster()
      })
      document.querySelectorAll('.remove').forEach((btn) => {
        btn.addEventListener('click', async () => {
          await fetch('/api/admin/roster/' + btn.dataset.id, { method: 'DELETE' })
          renderRoster()
        })
      })
    }

    async function boot() {
      const user = await me()
      if (user && user.role === 'admin') return renderRoster()
      renderLogin()
    }

    boot()
  </script>
</body>
</html>`
}
