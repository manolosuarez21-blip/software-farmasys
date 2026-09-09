const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { startServer } = require('./server');

let mainWindow;
const PORT = process.env.PORT || 3000;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    title: 'FARMAsys - Sistema de Gestión Farmacéutica',
    icon: path.join(__dirname, 'logo.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  Menu.setApplicationMenu(null);

  const targetUrl = `http://localhost:${PORT}`;

  let retryCount = 0;
  function loadApp() {
    mainWindow.loadURL(targetUrl).catch(() => {
      // Reintentar si el servidor aún está iniciando
    });
  }

  mainWindow.webContents.on('did-fail-load', () => {
    retryCount++;
    if (retryCount <= 10) {
      setTimeout(loadApp, 800);
    } else {
      // Fallback a archivo estático si falla el servidor HTTP
      mainWindow.loadFile(path.join(__dirname, 'farmasys.html'));
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Mostrar si carga exitosamente
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
  });

  loadApp();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    await startServer();
  } catch (error) {
    console.error('Advertencia iniciando servidor:', error);
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
