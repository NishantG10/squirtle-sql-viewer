declare module 'electron-squirrel-startup';

declare global {
  interface Window {
    electronAPI: {
      connect: (config: any) => Promise<any>;
      getTables: () => Promise<string[]>;
      getTableData: (tableName: string) => Promise<any[]>;
      getPrimaryKey: (tableName: string) => Promise<string[]>;
      updateTableData: (tableName: string, data: any, primaryKeyColumns: string[], originalPkValues?: any) => Promise<any>;
      getCredentials: () => Promise<any>;
      saveCredentials: (credentials: any) => Promise<any>;
      deleteTableRows: (tableName: string, rowPks: any[], primaryKeyColumns: string[]) => Promise<any>;
      getColumns: (tableName: string) => Promise<any[]>;
      insertTableRow: (tableName: string, row: any, validColumns?: string[]) => Promise<any>;
    };
  }
}

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
