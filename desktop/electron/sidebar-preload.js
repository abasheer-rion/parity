// The sidebar's side of the desktop app (DEC-0041): read the sections, open one, and hear
// which one is showing.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("paritySidebar", {
  sections: () => ipcRenderer.invoke("sidebar:sections"),
  go: (id) => ipcRenderer.send("sidebar:go", String(id)),
  onActive: (fn) => ipcRenderer.on("sidebar:active", (_e, id) => fn(id)),
});
