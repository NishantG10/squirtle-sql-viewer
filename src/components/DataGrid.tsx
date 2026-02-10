import React from 'react';
import { DataGrid, GridColDef, GridRowsProp, GridRowModel, GridRowSelectionModel } from '@mui/x-data-grid';

interface DataGridProps {
  columns: GridColDef[];
  rows: GridRowsProp;
  processRowUpdate: (newRow: GridRowModel, oldRow: GridRowModel) => Promise<GridRowModel>;
  rowSelectionModel?: GridRowSelectionModel;
  onRowSelectionModelChange?: (newSelectionModel: GridRowSelectionModel) => void;
}

function MyDataGrid({ columns, rows, processRowUpdate, rowSelectionModel, onRowSelectionModelChange }: DataGridProps) {
  const safeRows = Array.isArray(rows) ? rows : [];
  return (
    <div style={{ height: '100%', width: '100%' }}>
      <DataGrid
        rows={safeRows}
        columns={columns}
        processRowUpdate={processRowUpdate}
        checkboxSelection
        disableRowSelectionOnClick
        rowSelectionModel={rowSelectionModel || { type: 'include', ids: new Set() }}
        onRowSelectionModelChange={onRowSelectionModelChange}
        sx={{
            border: 0,
            '& .MuiDataGrid-cell:focus': {
                outline: 'none'
            }
        }}
      />
    </div>
  );
}

export default MyDataGrid;
