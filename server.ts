import express from 'express'
import fs from 'node:fs'
import path from 'node:path'

const dist = path.resolve('dist')
const PORT = process.env.PORT ?? '8080'

const BACKEND_URL = process.env.VITE_BACKEND_URL
if (!BACKEND_URL) throw new Error('Missing required environment variable: VITE_BACKEND_URL')

const app = express()

app.use(express.static(dist, { index: false }))

app.use((_req, res) => {
  const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf-8')
  const injected = template.replace(
    '<!-- envVars -->',
    `<script>window.env = ${JSON.stringify({ VITE_BACKEND_URL: BACKEND_URL })}</script>`
  )
  res.setHeader('Content-Type', 'text/html')
  res.send(injected)
})

app.listen(Number(PORT), () => {
  console.log(`Frontend server listening on port ${PORT}`)
})
