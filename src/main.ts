import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import sql, { ConnectionPool } from 'mssql';
import squirrel from 'electron-squirrel-startup';

let pool: ConnectionPool;

const CONFIG_FILE_NAME = 'user-preferences.json';

// Helper to get config path
const getConfigPath = () => path.join(app.getPath('userData'), CONFIG_FILE_NAME);

ipcMain.handle('db-get-credentials', async () => {
  try {
    const configPath = getConfigPath();
    const data = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist or other error, return null or empty object
    return null;
  }
});

ipcMain.handle('db-save-credentials', async (event, credentials) => {
  try {
    const configPath = getConfigPath();
    await fs.writeFile(configPath, JSON.stringify(credentials, null, 2), 'utf-8');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

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

ipcMain.handle('db-get-primary-key', async (event, tableName) => {
  try {
    const query = `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE OBJECTPROPERTY(OBJECT_ID(CONSTRAINT_SCHEMA + '.' + CONSTRAINT_NAME), 'IsPrimaryKey') = 1
      AND TABLE_NAME = @tableName
    `;
    const request = pool.request();
    request.input('tableName', tableName);
    const result = await request.query(query);
    
    if (result.recordset.length > 0) {
      return result.recordset.map((row) => row.COLUMN_NAME);
    } else {
      return [];
    }
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('db-update-table-data', async (event, tableName, row, primaryKeyColumns, originalPkValues) => {
  try {
    const request = pool.request();
    const setClauses: string[] = [];
    const whereClauses: string[] = [];

    // If no primary key is provided or found, we can't safely update
    if (!primaryKeyColumns || primaryKeyColumns.length === 0) {
        throw new Error("No Primary Key identified for this table. Update cannot be performed safely.");
    }
    
    // Build WHERE clause
    // We use originalPkValues if provided (to handle PK updates), otherwise fallback to current row values
    primaryKeyColumns.forEach((pkCol: string) => {
        // Use original value if available, else current row value
        const pkValue = (originalPkValues && originalPkValues[pkCol] !== undefined) 
                        ? originalPkValues[pkCol] 
                        : row[pkCol];

        if (pkValue === undefined || pkValue === null) {
            throw new Error(`Row data is missing values for a primary key column: ${pkCol}`);
        }
        // Use a unique parameter name for the PK to avoid collision with set clauses
        request.input(`pk_${pkCol}`, pkValue);
        whereClauses.push(`${pkCol} = @pk_${pkCol}`);
    });

    Object.keys(row).forEach((key) => {
      // We assume everything in 'row' (except internal fields) is a value to be set.
      // Even if it is a PK column, if it's in 'row', we update it.
      // We skip 'id' and '_originalPks'.
      if (key !== 'id' && key !== '_originalPks') {
        request.input(key, row[key]);
        setClauses.push(`${key} = @${key}`);
      }
    });

    if (setClauses.length === 0) {
         return { success: true }; // Nothing to update
    }

    const query = `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
    
    await request.query(query);
    return { success: true };
  } catch (err: any) {
    console.error("Update error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db-delete-table-rows', async (event, tableName, rowPks, primaryKeyColumns) => {
  try {
    const request = pool.request();
    
    if (!primaryKeyColumns || primaryKeyColumns.length === 0) {
        throw new Error("No Primary Key identified. Cannot delete rows safely.");
    }

    // rowPks is an array of objects, each containing the PK values for a row
    // e.g. [{ id: 1 }, { id: 2 }] or [{ id1: 1, id2: 'a' }]
    
    // For simplicity, we'll execute one delete per row. 
    // Optimization: Use IN clause for single PK, or batch them.
    
    for (const [index, pkValues] of rowPks.entries()) {
        const whereClauses: string[] = [];
        primaryKeyColumns.forEach((pkCol: string) => {
             const paramName = `pk_${pkCol}_${index}`;
             request.input(paramName, pkValues[pkCol]);
             whereClauses.push(`${pkCol} = @${paramName}`);
        });
        
        const query = `DELETE FROM ${tableName} WHERE ${whereClauses.join(' AND ')}`;
        await request.query(query);
    }

    return { success: true };
  } catch (err: any) {
    console.error("Delete error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('db-get-columns', async (event, tableName) => {
  try {
    const query = `
      SELECT 
        c.COLUMN_NAME, 
        c.IS_NULLABLE, 
        c.DATA_TYPE,
        COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') AS IS_IDENTITY
      FROM INFORMATION_SCHEMA.COLUMNS c
      WHERE c.TABLE_NAME = @tableName
    `;
    const request = pool.request();
    request.input('tableName', tableName);
    const result = await request.query(query);
    return result.recordset;
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('db-insert-table-row', async (event, tableName, row, validColumnNames) => {
    try {
        const request = pool.request();
        // If validColumnNames is provided, intersection. Else heuristic.
        let columnsToInsert = Object.keys(row).filter(key => key !== 'id' && key !== '_originalPks' && key !== '_isNew');
        
        if (Array.isArray(validColumnNames)) {
             columnsToInsert = columnsToInsert.filter(key => validColumnNames.includes(key));
        }

        if (columnsToInsert.length === 0) return { success: true }; 

        const valParams = columnsToInsert.map(col => `@${col}`);
        columnsToInsert.forEach(col => request.input(col, row[col]));

        const query = `INSERT INTO ${tableName} (${columnsToInsert.join(', ')}) VALUES (${valParams.join(', ')})`;
        await request.query(query);
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
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
