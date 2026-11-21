const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('overlay', {
  setMode: (mode) => ipcRenderer.send('overlay:set-mode', mode),
  onForceHud: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('overlay:force-hud', listener)
    return () => ipcRenderer.removeListener('overlay:force-hud', listener)
  },
  dragStart: () => ipcRenderer.send('overlay:drag-start'),
  dragMove: () => ipcRenderer.send('overlay:drag-move'),
  dragEnd: () => ipcRenderer.send('overlay:drag-end'),
  openDashboard: () => ipcRenderer.send('overlay:open-dashboard'),
  openSettings: () => ipcRenderer.send('overlay:open-settings'),
  openLogin: () => ipcRenderer.invoke('overlay:open-login'),
  hide: () => ipcRenderer.send('overlay:hide'),
  quit: () => ipcRenderer.send('overlay:quit'),
  menu: () => ipcRenderer.send('overlay:menu'),
  showInFolder: (repoPath, relativePath) => ipcRenderer.send('overlay:show-in-folder', repoPath, relativePath),
  onLoginComplete: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('overlay:login-complete', listener)
    return () => ipcRenderer.removeListener('overlay:login-complete', listener)
  },
})
