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
  openLogin: () => ipcRenderer.invoke('overlay:open-login'),
  onLoginComplete: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('overlay:login-complete', listener)
    return () => ipcRenderer.removeListener('overlay:login-complete', listener)
  },
})
