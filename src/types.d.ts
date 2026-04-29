declare module 'electron-squirrel-startup';

declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.jpg' {
  const value: string;
  export default value;
}

declare module '*.jpeg' {
  const value: string;
  export default value;
}

declare module '*.gif' {
  const value: string;
  export default value;
}

declare module '*.svg' {
  const value: string;
  export default value;
}

declare global {
  interface Window {
    electronAPI: {
      connect: (config: any) => Promise<any>;
      getTables: () => Promise<string[]>;
      getTableData: (tableName: string, page: number, pageSize: number, orderByColumn?: string) => Promise<any[]>;
      getTableCount: (tableName: string) => Promise<number>;
      getPrimaryKey: (tableName: string) => Promise<string[]>;
      updateTableData: (tableName: string, data: any, primaryKeyColumns: string[], originalPkValues?: any, oldRowData?: any) => Promise<any>;
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
