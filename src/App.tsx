import React, { useState, useEffect } from 'react';
import { Button, Container, CssBaseline, Paper, Box } from '@mui/material';
import ConnectionDialog from './components/ConnectionDialog';
import Sidebar from './components/Sidebar';
import MyDataGrid from './components/DataGrid';
import { GridColDef, GridRowModel } from '@mui/x-data-grid';

function App() {
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<GridColDef[]>([]);
  const [modifiedRows, setModifiedRows] = useState<Record<GridRowModel['id'], GridRowModel>>({});

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = (isConnected: boolean) => {
    setOpen(false);
    if (isConnected) {
      setConnected(true);
    }
  };

  const handleTableSelect = async (table: string) => {
    setSelectedTable(table);
    setModifiedRows({}); // Clear modified rows when changing tables
    const result = await window.electronAPI.getTableData(table);
    if (Array.isArray(result)) {
      if (result.length > 0) {
        const newColumns: GridColDef[] = Object.keys(result[0]).map((key) => ({
          field: key,
          headerName: key,
          width: 150,
          editable: true,
        }));
        const newRows = result.map((row, index) => ({ ...row, id: row.id ?? index }));
        setColumns(newColumns);
        setRows(newRows);
      } else {
        setColumns([]);
        setRows([]);
      }
    } else {
      console.error('Error fetching table data:', (result as any).error);
    }
  };

  const handleProcessRowUpdate = async (newRow: GridRowModel, oldRow: GridRowModel): Promise<GridRowModel> => {
    // Update the rows state to reflect the change in the UI
    const updatedRows = rows.map((row) => (row.id === newRow.id ? newRow : row));
    setRows(updatedRows);

    // Add the modified row to the modifiedRows state
    setModifiedRows((prev) => ({
      ...prev,
      [newRow.id]: newRow,
    }));

    return newRow;
  };

  const handleSaveChanges = async () => {
    if (!selectedTable) return;

    const promises = Object.values(modifiedRows).map((row) =>
      window.electronAPI.updateTableData(selectedTable, row)
    );

    try {
      const results = await Promise.all(promises);
      const failedUpdates = results.filter((result) => !result.success);

      if (failedUpdates.length > 0) {
        console.error('Some rows failed to update:', failedUpdates);
        // Optionally, show an error message to the user
      } else {
        setModifiedRows({}); // Clear modified rows after successful save
        // Optionally, show a success message
      }
    } catch (error) {
      console.error('Error saving changes:', error);
    }
  };

  useEffect(() => {
    if (connected) {
      const fetchTables = async () => {
        const result = await window.electronAPI.getTables();
        if (Array.isArray(result)) {
          setTables(result);
        } else {
          console.error('Error fetching tables:', (result as any).error);
        }
      };
      fetchTables();
    }
  }, [connected]);

  return (
    <React.StrictMode>
      <CssBaseline />
      {!connected ? (
        <Container>
          <h1>Squirtle SQL Viewer</h1>
          <Button variant="contained" onClick={handleOpen}>
            Connect to Database
          </Button>
          <ConnectionDialog open={open} handleClose={handleClose} />
        </Container>
      ) : (
        <div style={{ display: 'flex' }}>
          <div style={{ width: '25%' }}>
            <Sidebar tables={tables} onTableSelect={handleTableSelect} />
          </div>
          <div style={{ width: '75%' }}>
            <Paper style={{ height: '100vh', overflow: 'auto', padding: '10px' }}>
              {selectedTable ? (
                <>
                  <Box mb={2}>
                    <Button
                      variant="contained"
                      onClick={handleSaveChanges}
                      disabled={Object.keys(modifiedRows).length === 0}
                    >
                      Save Changes
                    </Button>
                  </Box>
                  <MyDataGrid
                    columns={columns}
                    rows={rows}
                    processRowUpdate={handleProcessRowUpdate}
                  />
                </>
              ) : (
                <h2>Select a table to view its data</h2>
              )}
            </Paper>
          </div>
        </div>
      )}
    </React.StrictMode>
  );
}

export default App;
