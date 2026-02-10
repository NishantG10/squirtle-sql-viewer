import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import sql, { ConnectionPool } from 'mssql';
import squirrel from 'electron-squirrel-startup';

let pool: ConnectionPool;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (squirrel) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

ipcMain.handle('db-connect', async (event, config) => {
  try {
    pool = await sql.connect(config);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db-get-tables', async () => {
  try {
    const result = await pool.request().query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
    `);
    return result.recordset.map((row) => row.TABLE_NAME);
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('db-get-table-data', async (event, tableName) => {
  try {
    const result = await pool.request().query(`SELECT * FROM ${tableName}`);
    return result.recordset;
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('db-update-table-data', async (event, tableName, data) => {
  try {
    const { id, field, value } = data;
    const request = pool.request();
    // This is a simplified example. For a real application, you would need a more robust way
    // to handle different data types and to prevent SQL injection.
    // Using parameterized queries is a good practice.
    await request.query(`UPDATE ${tableName} SET ${field} = '${value}' WHERE id = ${id}`);
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
