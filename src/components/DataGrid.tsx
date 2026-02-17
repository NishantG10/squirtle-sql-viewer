import React from 'react';
import { DataGrid, GridColDef, GridRowsProp, GridRowModel, GridRowSelectionModel } from '@mui/x-data-grid';

interface DataGridProps {
  columns: GridColDef[];
  rows: GridRowsProp;
  processRowUpdate: (newRow: GridRowModel, oldRow: GridRowModel) => Promise<GridRowModel>;
  rowSelectionModel?: GridRowSelectionModel;
  onRowSelectionModelChange?: (newSelectionModel: GridRowSelectionModel) => void;
  rowCount?: number;
  paginationModel?: { page: number; pageSize: number };
  onPaginationModelChange?: (model: { page: number; pageSize: number }) => void;
}

function MyDataGrid({ columns, rows, processRowUpdate, rowSelectionModel, onRowSelectionModelChange, rowCount, paginationModel, onPaginationModelChange }: DataGridProps) {
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
        paginationMode="server"
        rowCount={rowCount || 0}
        paginationModel={paginationModel}
        onPaginationModelChange={onPaginationModelChange}
        pageSizeOptions={[25, 50, 100]}
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
