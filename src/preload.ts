import { contextBridge, ipcRenderer } from 'electron';
import { IpcRenderer, IpcRendererEvent } from 'electron';
import { config as MSSQLConfig } from 'mssql';

declare global {
  interface Window {
    electronAPI: {
      connect: (config: MSSQLConfig) => Promise<any>;
      getTables: () => Promise<string[]>;
      getTableData: (tableName: string) => Promise<any[]>;
      updateTableData: (tableName: string, data: any) => Promise<any>;
    };
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  connect: (config: MSSQLConfig) => ipcRenderer.invoke('db-connect', config),
  getTables: () => ipcRenderer.invoke('db-get-tables'),
  getTableData: (tableName: string) => ipcRenderer.invoke('db-get-table-data', tableName),
  updateTableData: (tableName: string, data: any) => ipcRenderer.invoke('db-update-table-data', tableName, data),
});
