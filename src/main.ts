import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import sql, { ConnectionPool } from 'mssql';
import squirrel from 'electron-squirrel-startup';

let pool: ConnectionPool;

const CONFIG_FILE_NAME = 'user-preferences.json';

const BLANK_REPLACEMENT_VALUE = 'NA';

// Helper to get config path
const getConfigPath = () => path.join(app.getPath('userData'), CONFIG_FILE_NAME);

const isBlankValue = (value: any) => {
  if (value === null || value === undefined) return true;
  return typeof value === 'string' && value.trim() === '';
};

const normalizeBlankValue = (value: any) => {
  if (isBlankValue(value)) {
    return BLANK_REPLACEMENT_VALUE;
  }
  return value;
};

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
    // Open the DevTools in development mode.
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
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
      SELECT TABLE_SCHEMA, TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    const tables = result.recordset.map((row) => `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`);
    return tables;
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('db-get-table-count', async (event, tableName, filters = []) => {
  try {
    // Parse schema.table format
    let schemaName = 'dbo';
    let realTableName = tableName;
    if (tableName.includes('.')) {
        const parts = tableName.split('.');
        schemaName = parts[0];
        realTableName = parts[1];
    }
    
    // Build WHERE clause from filters
    let whereClause = '';
    const request = pool.request();
    
    if (filters && filters.length > 0) {
      const conditions = filters.map((filter: any, index: number) => {
        if (filter.field && filter.value) {
          const paramName = `filterValue${index}`;
          
          // Check operator type (contains or exact)
          if (filter.operator === 'exact') {
            request.input(paramName, filter.value);
            return `CAST([${filter.field}] AS NVARCHAR(MAX)) = @${paramName}`;
          } else {
            // Default to 'contains' behavior
            request.input(paramName, `%${filter.value}%`);
            return `CAST([${filter.field}] AS NVARCHAR(MAX)) LIKE @${paramName}`;
          }
        }
        return null;
      }).filter(Boolean);
      
      if (conditions.length > 0) {
        whereClause = 'WHERE ' + conditions.join(' AND ');
      }
    }
    
    // If we have filters, we must use COUNT(*) as sys.partitions doesn't respect WHERE
    if (whereClause) {
      const safeTableName = `[${schemaName}].[${realTableName}]`;
      const countResult = await request.query(`SELECT COUNT(*) as count FROM ${safeTableName} ${whereClause}`);
      return parseInt(countResult.recordset[0].count, 10);
    }
    
    // Try fast count using sys.partitions (only when no filters)
    const fastQuery = `
      SELECT SUM(p.rows) as count
      FROM sys.tables t
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      JOIN sys.partitions p ON t.object_id = p.object_id
      WHERE s.name = @schema
      AND t.name = @tableName
      AND p.index_id < 2
    `;
    request.input('schema', schemaName);
    request.input('tableName', realTableName);
    const fastResult = await request.query(fastQuery);

    // If fast count returns a positive number, use it
    if (fastResult.recordset.length > 0 && fastResult.recordset[0].count > 0) {
         const count = parseInt(fastResult.recordset[0].count, 10);
         return count;
    }

    // Fallback to COUNT(*)
    const safeTableName = `[${schemaName}].[${realTableName}]`;
    const countResult = await pool.request().query(`SELECT COUNT(*) as count FROM ${safeTableName}`);
    return parseInt(countResult.recordset[0].count, 10);
  } catch (err: any) {
    console.error("Count Error for", tableName, ":", err.message);
    return 0;
  }
});

ipcMain.handle('db-get-table-data', async (event, tableName, page = 0, pageSize = 100, orderByColumn = null, filters = []) => {
  try {
    const offset = page * pageSize;
    
    // Parse schema.table
    let schemaName = 'dbo';
    let realTableName = tableName;
    if (tableName.includes('.')) {
        const parts = tableName.split('.');
        schemaName = parts[0];
        realTableName = parts[1];
    }
    
    const safeTableName = `[${schemaName}].[${realTableName}]`;
    
    // Build WHERE clause from filters
    let whereClause = '';
    const request = pool.request();
    
    if (filters && filters.length > 0) {
      const conditions = filters.map((filter: any, index: number) => {
        if (filter.field && filter.value) {
          const paramName = `filterValue${index}`;
          
          // Check operator type (contains or exact)
          if (filter.operator === 'exact') {
            request.input(paramName, filter.value);
            return `CAST([${filter.field}] AS NVARCHAR(MAX)) = @${paramName}`;
          } else {
            // Default to 'contains' behavior
            request.input(paramName, `%${filter.value}%`);
            return `CAST([${filter.field}] AS NVARCHAR(MAX)) LIKE @${paramName}`;
          }
        }
        return null;
      }).filter(Boolean);
      
      if (conditions.length > 0) {
        whereClause = 'WHERE ' + conditions.join(' AND ');
      }
    }
    
    let orderClause = 'ORDER BY (SELECT NULL)'; 
    
    if (orderByColumn) {
        orderClause = `ORDER BY [${orderByColumn.replace(/\]/g, ']]')}]`;
    } else {
        // We need an ORDER BY clause for OFFSET/FETCH to work in SQL Server
        // Try to find a primary key first
        const pkResult = await pool.request()
        .input('tableName', realTableName)
        .input('schema', schemaName)
        .query(`
          SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
          WHERE OBJECTPROPERTY(OBJECT_ID(CONSTRAINT_SCHEMA + '.' + CONSTRAINT_NAME), 'IsPrimaryKey') = 1
          AND TABLE_NAME = @tableName
          AND TABLE_SCHEMA = @schema
        `);

        if (pkResult.recordset.length > 0) {
            orderClause = `ORDER BY [${pkResult.recordset[0].COLUMN_NAME.replace(/\]/g, ']]')}]`;
        } else {
            // Fallback to first column if no PK
            const colResult = await pool.request()
            .input('tableName', realTableName)
            .input('schema', schemaName)
            .query(`
                SELECT TOP 1 COLUMN_NAME 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = @tableName
                AND TABLE_SCHEMA = @schema
                ORDER BY ORDINAL_POSITION
            `);
            
            if (colResult.recordset.length > 0) {
                orderClause = `ORDER BY [${colResult.recordset[0].COLUMN_NAME.replace(/\]/g, ']]')}]`;
            }
        }
    }

    const query = `
      SELECT * FROM ${safeTableName}
      ${whereClause}
      ${orderClause}
      OFFSET ${offset} ROWS
      FETCH NEXT ${pageSize} ROWS ONLY
    `;
    
    const result = await request.query(query);
    return result.recordset;
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('db-get-primary-key', async (event, tableName) => {
  try {
    let schemaName = 'dbo';
    let realTableName = tableName;
    if (tableName.includes('.')) {
        const parts = tableName.split('.');
        schemaName = parts[0];
        realTableName = parts[1];
    }

    const query = `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE OBJECTPROPERTY(OBJECT_ID(CONSTRAINT_SCHEMA + '.' + CONSTRAINT_NAME), 'IsPrimaryKey') = 1
      AND TABLE_NAME = @tableName
      AND TABLE_SCHEMA = @schema
    `;
    const request = pool.request();
    request.input('tableName', realTableName);
    request.input('schema', schemaName);
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

ipcMain.handle('db-update-table-data', async (event, tableName, row, primaryKeyColumns, originalPkValues, oldRowData) => {
  try {
    const request = pool.request();
    const setClauses: string[] = [];
    const whereClauses: string[] = [];

    // Parse schema.table for safe quoting
    let schemaName = 'dbo';
    let realTableName = tableName;
    if (tableName.includes('.')) {
        const parts = tableName.split('.');
        schemaName = parts[0];
        realTableName = parts[1];
    }
    const safeTableName = `[${schemaName}].[${realTableName}]`;

    const identityColumnsResult = await pool.request()
      .input('tableName', realTableName)
      .input('schema', schemaName)
      .query(`
        SELECT c.COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS c
        WHERE c.TABLE_NAME = @tableName
          AND c.TABLE_SCHEMA = @schema
          AND COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') = 1
      `);
    const identityColumns = new Set(identityColumnsResult.recordset.map((r: any) => r.COLUMN_NAME));

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
      if (key !== 'id' && key !== '_originalPks' && key !== '_isNew' && !identityColumns.has(key)) {
        const normalizedValue = normalizeBlankValue(row[key]);
        const hasChanged = oldRowData ? normalizedValue !== normalizeBlankValue(oldRowData[key]) : true;
        if (hasChanged) {
          request.input(key, normalizedValue);
          setClauses.push(`${key} = @${key}`);
        }
      }
    });

    if (setClauses.length === 0) {
         return { success: true }; // Nothing to update
    }

    const query = `UPDATE ${safeTableName} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`;
    
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
    
    // Parse schema.table for safe quoting
    let schemaName = 'dbo';
    let realTableName = tableName;
    if (tableName.includes('.')) {
        const parts = tableName.split('.');
        schemaName = parts[0];
        realTableName = parts[1];
    }
    const safeTableName = `[${schemaName}].[${realTableName}]`;

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
        
        const query = `DELETE FROM ${safeTableName} WHERE ${whereClauses.join(' AND ')}`;
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
    let schemaName = 'dbo';
    let realTableName = tableName;
    if (tableName.includes('.')) {
        const parts = tableName.split('.');
        schemaName = parts[0];
        realTableName = parts[1];
    }
  
    const query = `
      SELECT 
        c.COLUMN_NAME, 
        c.IS_NULLABLE, 
        c.DATA_TYPE,
        COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') AS IS_IDENTITY
      FROM INFORMATION_SCHEMA.COLUMNS c
      WHERE c.TABLE_NAME = @tableName
      AND c.TABLE_SCHEMA = @schema
    `;
    const request = pool.request();
    request.input('tableName', realTableName);
    request.input('schema', schemaName);
    const result = await request.query(query);
    return result.recordset;
  } catch (err: any) {
    return { error: err.message };
  }
});

ipcMain.handle('db-insert-table-row', async (event, tableName, row, validColumnNames) => {
    try {
        const request = pool.request();
        
        let schemaName = 'dbo';
        let realTableName = tableName;
        if (tableName.includes('.')) {
            const parts = tableName.split('.');
            schemaName = parts[0];
            realTableName = parts[1];
        }
        const safeTableName = `[${schemaName}].[${realTableName}]`;

        const identityColumnsResult = await pool.request()
          .input('tableName', realTableName)
          .input('schema', schemaName)
          .query(`
            SELECT c.COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS c
            WHERE c.TABLE_NAME = @tableName
              AND c.TABLE_SCHEMA = @schema
              AND COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') = 1
          `);
        const identityColumns = new Set(identityColumnsResult.recordset.map((r: any) => r.COLUMN_NAME));

        // If validColumnNames is provided, intersection. Else heuristic.
        let columnsToInsert = Object.keys(row).filter(key => key !== 'id' && key !== '_originalPks' && key !== '_isNew');
        
        if (Array.isArray(validColumnNames)) {
             columnsToInsert = columnsToInsert.filter(key => validColumnNames.includes(key));
        }

        columnsToInsert = columnsToInsert.filter((key) => !identityColumns.has(key));

        if (columnsToInsert.length === 0) return { success: true }; 

        const valParams = columnsToInsert.map(col => `@${col}`);
        columnsToInsert.forEach(col => request.input(col, normalizeBlankValue(row[col])));

        const query = `INSERT INTO ${safeTableName} (${columnsToInsert.map((c) => `[${c}]`).join(', ')}) VALUES (${valParams.join(', ')})`;
        await request.query(query);
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('db-bulk-insert', async (event, tableName, rows, columnNames) => {
    try {
        let schemaName = 'dbo';
        let realTableName = tableName;
        if (tableName.includes('.')) {
            const parts = tableName.split('.');
            schemaName = parts[0];
            realTableName = parts[1];
        }
        const safeTableName = `[${schemaName}].[${realTableName}]`;

        const identityColumnsResult = await pool.request()
          .input('tableName', realTableName)
          .input('schema', schemaName)
          .query(`
            SELECT c.COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS c
            WHERE c.TABLE_NAME = @tableName
              AND c.TABLE_SCHEMA = @schema
              AND COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') = 1
          `);
        const identityColumns = new Set(identityColumnsResult.recordset.map((r: any) => r.COLUMN_NAME));

        let successCount = 0;
        let failCount = 0;
        const errors: string[] = [];

        // Insert rows one by one
        for (let i = 0; i < rows.length; i++) {
            try {
                const request = pool.request();
                const row = rows[i];
                
                // Insert all non-identity columns and normalize blank values to NA.
                const columnsToInsert = columnNames.filter((col: string) => !identityColumns.has(col));

                if (columnsToInsert.length === 0) {
                    failCount++;
                    errors.push(`Row ${i + 2}: No valid data`);
                    continue;
                }

                const valParams = columnsToInsert.map((col: string) => `@${col}`);
                columnsToInsert.forEach((col: string) => {
                  request.input(col, normalizeBlankValue(row[col]));
                });

                const query = `INSERT INTO ${safeTableName} (${columnsToInsert.map((c: string) => `[${c}]`).join(', ')}) VALUES (${valParams.join(', ')})`;
                await request.query(query);
                successCount++;
            } catch (err: any) {
                failCount++;
                errors.push(`Row ${i + 2}: ${err.message}`); // +2 because we skip header row
            }
        }

        return { 
            success: true, 
            successCount, 
            failCount,
            errors // Return all errors
        };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('db-export-table', async (event, tableName, filters = []) => {
    try {
        let schemaName = 'dbo';
        let realTableName = tableName;
        if (tableName.includes('.')) {
            const parts = tableName.split('.');
            schemaName = parts[0];
            realTableName = parts[1];
        }
        const safeTableName = `[${schemaName}].[${realTableName}]`;

        // Build WHERE clause from filters (same logic as db-get-table-data)
        let whereClause = '';
        const request = pool.request();

        if (filters && filters.length > 0) {
            const conditions = filters.map((filter: any, index: number) => {
                if (filter.field && filter.value) {
                    const paramName = `filterValue${index}`;
                    if (filter.operator === 'exact') {
                        request.input(paramName, filter.value);
                        return `CAST([${filter.field}] AS NVARCHAR(MAX)) = @${paramName}`;
                    } else {
                        request.input(paramName, `%${filter.value}%`);
                        return `CAST([${filter.field}] AS NVARCHAR(MAX)) LIKE @${paramName}`;
                    }
                }
                return null;
            }).filter(Boolean);

            if (conditions.length > 0) {
                whereClause = 'WHERE ' + conditions.join(' AND ');
            }
        }

        const result = await request.query(`SELECT * FROM ${safeTableName} ${whereClause}`);
        const rows = result.recordset;

        // Build Excel workbook using dynamic import
        const XLSX = await import('xlsx');
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, realTableName.substring(0, 31));

        const { filePath, canceled } = await dialog.showSaveDialog({
            title: 'Export to Excel',
            defaultPath: `${realTableName}.xlsx`,
            filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
        });

        if (canceled || !filePath) {
            return { success: false, canceled: true };
        }

        const buffer: Buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        await fs.writeFile(filePath, buffer);

        return { success: true, filePath, rowCount: rows.length };
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
