import { contextBridge, ipcRenderer } from 'electron';
import { IpcRenderer, IpcRendererEvent } from 'electron';
import { config as MSSQLConfig } from 'mssql';

declare global {
  interface Window {
    electronAPI: {
      connect: (config: MSSQLConfig) => Promise<any>;
      getTables: () => Promise<string[]>;
      getTableData: (tableName: string) => Promise<any[]>;
      getPrimaryKey: (tableName: string) => Promise<string[]>;
      updateTableData: (tableName: string, data: any, primaryKeyColumns: string[], originalPkValues?: any) => Promise<any>;
      getCredentials: () => Promise<any>;
      saveCredentials: (credentials: any) => Promise<any>;
      deleteTableRows: (tableName: string, rowPks: any[], primaryKeyColumns: string[]) => Promise<any>;
    };
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  connect: (config: MSSQLConfig) => ipcRenderer.invoke('db-connect', config),
  getTables: () => ipcRenderer.invoke('db-get-tables'),
  getTableData: (tableName: string) => ipcRenderer.invoke('db-get-table-data', tableName),
  getPrimaryKey: (tableName: string) => ipcRenderer.invoke('db-get-primary-key', tableName),
  updateTableData: (tableName: string, data: any, primaryKeyColumns: string[], originalPkValues?: any) => ipcRenderer.invoke('db-update-table-data', tableName, data, primaryKeyColumns, originalPkValues),
  getCredentials: () => ipcRenderer.invoke('db-get-credentials'),
  saveCredentials: (credentials: any) => ipcRenderer.invoke('db-save-credentials', credentials),
  deleteTableRows: (tableName: string, rowPks: any[], primaryKeyColumns: string[]) => ipcRenderer.invoke('db-delete-table-rows', tableName, rowPks, primaryKeyColumns),
  getColumns: (tableName: string) => ipcRenderer.invoke('db-get-columns', tableName),
  insertTableRow: (tableName: string, row: any, validColumns?: string[]) => ipcRenderer.invoke('db-insert-table-row', tableName, row, validColumns),
});
