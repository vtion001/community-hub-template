// Entry point for serving the site through the Tailscale Funnel path-mount
// at /sig-espresso. Sets env before importing index.ts so its module-level
// distDir/basePath resolution picks up the tunnel values, then starts its
// own listener (index.ts only auto-listens when run directly).
process.env.BASE_PATH ??= '/sig-espresso'
process.env.DIST_DIR ??= 'dist-tunnel'
process.env.PORT ??= '4500'

const { app } = await import('./index.ts')

app.listen(Number(process.env.PORT), () => {
  console.log(`Tunnel server listening on port ${process.env.PORT} under base ${process.env.BASE_PATH}`)
})
