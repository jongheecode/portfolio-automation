import { spawn } from 'node:child_process'
import net from 'node:net'

const PORT = 5174

function waitForPort(port, timeoutMs = 15000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.connect(port, 'localhost')
      socket.once('connect', () => {
        socket.end()
        resolve()
      })
      socket.once('error', () => {
        socket.destroy()
        if (Date.now() - start > timeoutMs) reject(new Error('vite dev server did not start in time'))
        else setTimeout(tryConnect, 300)
      })
    }
    tryConnect()
  })
}

const vite = spawn('npx', ['vite', '--port', String(PORT)], { stdio: 'inherit', shell: true })

try {
  await waitForPort(PORT)
} catch (err) {
  vite.kill()
  throw err
}

const electron = spawn('npx', ['electron', '.'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VITE_DEV_SERVER_URL: `http://localhost:${PORT}` },
})

electron.on('exit', (code) => {
  vite.kill()
  process.exit(code ?? 0)
})
