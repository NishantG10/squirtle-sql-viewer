import React from 'react';
import { DataGrid, GridColDef, GridRowsProp, GridRowModel } from '@mui/x-data-grid';

interface DataGridProps {
  columns: GridColDef[];
  rows: GridRowsProp;
  processRowUpdate: (newRow: GridRowModel, oldRow: GridRowModel) => Promise<GridRowModel>;
}

function MyDataGrid({ columns, rows, processRowUpdate }: DataGridProps) {
  return (
    <div style={{ height: 'calc(100vh - 100px)', width: '100%' }}>
      <DataGrid
        rows={rows}
        columns={columns}
        processRowUpdate={processRowUpdate}
      />
    </div>
  );
}

export default MyDataGrid;
