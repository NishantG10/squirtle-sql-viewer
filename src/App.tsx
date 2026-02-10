import React, { useState, useEffect, useMemo } from 'react';
import { Button, Container, CssBaseline, Paper, Box, Snackbar, Alert, Backdrop, CircularProgress, ThemeProvider, Typography } from '@mui/material';
import ConnectionDialog from './components/ConnectionDialog';
import Sidebar from './components/Sidebar';
import MyDataGrid from './components/DataGrid';
import { GridColDef, GridRowModel, GridRowSelectionModel } from '@mui/x-data-grid';
import { lightTheme, darkTheme } from './theme';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import UndoIcon from '@mui/icons-material/Undo';

function App() {
  const [mode, setMode] = useState<'light' | 'dark'>('dark');
  const theme = useMemo(() => (mode === 'light' ? lightTheme : darkTheme), [mode]);

  const [open, setOpen] = useState(false);

  const [connected, setConnected] = useState(false);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [primaryKeys, setPrimaryKeys] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [originalRows, setOriginalRows] = useState<any[]>([]);
  const [columns, setColumns] = useState<GridColDef[]>([]);
  const [modifiedRows, setModifiedRows] = useState<Record<string, GridRowModel>>({});
  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>({ type: 'include', ids: new Set() });
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('success');
  const [deletedRowsOriginalPks, setDeletedRowsOriginalPks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = (isConnected: boolean) => {
    setOpen(false);
    if (isConnected) {
      setConnected(true);
    }
  };

  const handleSnackbarClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  const handleTableSelect = async (table: string) => {
    setSelectedTable(table);
    setModifiedRows({}); 
    setDeletedRowsOriginalPks([]);
    setRowSelectionModel({ type: 'include', ids: new Set() });
    setPrimaryKeys([]);
    setLoading(true);
    
    try {
      // Fetch Table Data, Columns, and Primary Keys in parallel
      const [dataResult, columnResult, pkResult] = await Promise.all([
        window.electronAPI.getTableData(table),
        window.electronAPI.getColumns(table),
        window.electronAPI.getPrimaryKey(table)
      ]);
      
      const pks = Array.isArray(pkResult) ? pkResult : [];
      setPrimaryKeys(pks);

      // Configure Columns
      if (Array.isArray(columnResult)) {
         const newColumns: GridColDef[] = columnResult.map((col: any) => ({
            field: col.COLUMN_NAME,
            headerName: col.COLUMN_NAME,
            width: 150,
            editable: !col.IS_IDENTITY, // Disable editing for Identity columns
         }));
         setColumns(newColumns);
      } else {
         setColumns([]);
      }

      // Configure Rows
      if (Array.isArray(dataResult)) {
          // Generate IDs: If PK exists (single or composite), use it. Else fallback to index.
          const newRows = dataResult.map((row, index) => {
             let rowId: string | number = index;
             const originalPks: any = {};

             if (pks.length > 0) {
                 // Create a synthetic ID like "val1|||val2"
                 const pkValues = pks.map(pk => row[pk]);
                 // Check if all PK values are present (not undefined)
                 if (pkValues.every(val => val !== undefined && val !== null)) {
                     rowId = pkValues.join('|||');
                 }
                 // Store original PK values
                 pks.forEach(pk => {
                    originalPks[pk] = row[pk];
                 });
             }
             return { ...row, id: rowId, _originalPks: originalPks };
          });
          
          setRows(newRows);
          setOriginalRows(newRows);
      } else {
        console.error('Error fetching table data:', (dataResult as any)?.error);
        setRows([]);
        setOriginalRows([]);
      }
    } catch (e) {
      console.error("Error loading table details", e);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessRowUpdate = async (newRow: GridRowModel, oldRow: GridRowModel): Promise<GridRowModel> => {
    // Update the rows state to reflect the change in the UI
    // Use oldRow.id to match the row being updated, in case the ID itself was changed
    const updatedRows = rows.map((row) => (row.id === oldRow.id ? newRow : row));
    setRows(updatedRows);

    // Add the modified row to the modifiedRows state
    // Clean up old ID if it changed to avoid duplicates
    setModifiedRows((prev) => {
      const next = { ...prev };
      if (oldRow.id !== newRow.id && next[oldRow.id]) {
          delete next[oldRow.id];
      }
      next[newRow.id] = newRow;
      return next;
    });

    return newRow;
  };

  const handleDeleteSelected = () => {
      const selectedIds = rowSelectionModel.ids;
      if (!selectedIds || selectedIds.size === 0) return;

      const newRows = rows.filter((row) => !selectedIds.has(row.id));
      
      // Store original PKs of deleted rows
      const deletedPks = rows
        .filter((row) => selectedIds.has(row.id))
        .map((row) => row._originalPks);
      
      setDeletedRowsOriginalPks((prev) => [...prev, ...deletedPks]);
      setRows(newRows);
      setRowSelectionModel({ type: 'include', ids: new Set() });
  };

  const handleDiscardChanges = () => {
    setRows(originalRows);
    setModifiedRows({});
    setDeletedRowsOriginalPks([]);
    setRowSelectionModel({ type: 'include', ids: new Set() });
  };

  const handleSaveChanges = async () => {
    if (!selectedTable) return;
    
    if (primaryKeys.length === 0) {
        setSnackbarMessage('Cannot save: No Primary Key found for this table.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        return;
    }
    
    setLoading(true);

    try {
        // 1. Process Deletions
        if (deletedRowsOriginalPks.length > 0) {
            const deleteResult = await window.electronAPI.deleteTableRows(selectedTable, deletedRowsOriginalPks, primaryKeys);
            if (!deleteResult.success) {
                throw new Error(`Delete failed: ${deleteResult.error}`);
            }
        }

        // 2. Process Updates & Inserts
        const validColumnNames = columns.map(c => c.field);
        const promises = Object.values(modifiedRows).map((row) => {
            if ((row as any)._isNew) {
                return window.electronAPI.insertTableRow(selectedTable, row, validColumnNames);
            } else {
                return window.electronAPI.updateTableData(selectedTable, row, primaryKeys, (row as any)._originalPks);
            }
        });

        const results = await Promise.all(promises);
        const failedUpdates = results.filter((result: any) => !result.success);

        if (failedUpdates.length > 0) {
            console.error('Some rows failed to save:', failedUpdates);
            setSnackbarMessage(`Saved with errors. Failed to save ${failedUpdates.length} rows.`);
            setSnackbarSeverity('warning');
        } else {
            // Success! Refresh table to get new IDs/Defaults
            await handleTableSelect(selectedTable);
            
            setSnackbarMessage('Changes (updates, deletions, inserts) saved successfully!');
            setSnackbarSeverity('success');
        }
    } catch (error: any) {
      console.error('Error saving changes:', error);
      setSnackbarMessage(`Error saving changes: ${error.message}`);
      setSnackbarSeverity('error');
    } finally {
      setSnackbarOpen(true);
      setLoading(false);
    }
  };

  const handleAddRow = () => {
    if (!selectedTable || columns.length === 0) return;
    
    const tempId = `temp-${Date.now()}`;
    const newRow: any = { id: tempId, _isNew: true };
    
    columns.forEach((col) => {
        newRow[col.field] = null;
    });
    
    setRows((prev) => [newRow, ...prev]);
    setModifiedRows((prev) => ({ ...prev, [tempId]: newRow }));
  };  useEffect(() => {
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
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {!connected ? (
        <Box 
          display="flex" 
          flexDirection="column" 
          justifyContent="center" 
          alignItems="center" 
          minHeight="100vh" 
          bgcolor="background.default"
          p={3}
        >
          <Box mb={6} textAlign="center">
            <Typography variant="h2" component="h1" gutterBottom fontWeight="800" color="primary" sx={{ letterSpacing: '-0.02em', mb: 2 }}>
              Squirtle SQL
            </Typography>
            <Typography variant="h6" color="text.secondary" fontWeight="400" sx={{ maxWidth: 600 }}>
              Connecting to your data has never been this beautiful. 
              Secure, fast, and responsive.
            </Typography>
          </Box>
          <Button 
            variant="contained" 
            size="large" 
            onClick={handleOpen}
            sx={{ 
              px: 6, 
              py: 2, 
              fontSize: '1.1rem',
              borderRadius: 4,
              boxShadow: '0 20px 40px rgba(108, 93, 211, 0.3)'
            }}
          >
            Connect Database
          </Button>
          <ConnectionDialog open={open} handleClose={handleClose} />
        </Box>
      ) : (
        <Box display="flex" height="100vh" bgcolor="background.default">
          <Box width={280} flexShrink={0}>
             <Sidebar 
               tables={tables} 
               selectedTable={selectedTable}
               onTableSelect={handleTableSelect} 
               mode={mode}
               onToggleMode={() => setMode(mode === 'light' ? 'dark' : 'light')}
             />
          </Box>
          <Box flex={1} display="flex" flexDirection="column" overflow="hidden" p={0}>
            {selectedTable ? (
                <>
                  <Box 
                    p={3} 
                    display="flex" 
                    justifyContent="space-between" 
                    alignItems="center"
                    bgcolor="background.default"
                  >
                    <Box>
                        <Typography variant="h5" fontWeight="700" color="text.primary">
                           {selectedTable}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                           Manage your data entries
                        </Typography>
                    </Box>
                    <Box display="flex" gap={2}>
                        <Button
                          variant="outlined"
                          color="primary"
                          startIcon={<AddIcon />}
                          onClick={handleAddRow}
                        >
                          Add Row
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={handleDeleteSelected}
                          disabled={!rowSelectionModel || rowSelectionModel.ids.size === 0}
                        >
                          Delete
                        </Button>
                         <Button
                          variant="outlined"
                          color="secondary"
                          startIcon={<UndoIcon />}
                          onClick={handleDiscardChanges}
                          disabled={Object.keys(modifiedRows).length === 0 && deletedRowsOriginalPks.length === 0}
                        >
                          Discard
                        </Button>
                        <Button
                          variant="contained"
                          color="primary"
                          startIcon={<SaveIcon />}
                          onClick={handleSaveChanges}
                          disabled={Object.keys(modifiedRows).length === 0 && deletedRowsOriginalPks.length === 0}
                        >
                          Save
                        </Button>
                    </Box>
                  </Box>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                        flex: 1, 
                        mx: 3, 
                        mb: 3, 
                        overflow: 'hidden',
                        bgcolor: 'background.paper',
                        borderRadius: 3,
                        border: theme.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.05)' : 'none'
                    }}
                  >
                        <MyDataGrid
                            columns={columns}
                            rows={rows}
                            processRowUpdate={handleProcessRowUpdate}
                            rowSelectionModel={rowSelectionModel}
                            onRowSelectionModelChange={(newSelection) => setRowSelectionModel(newSelection)}
                        />
                  </Paper>
                </>
              ) : (
                <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100%">
                    <Typography variant="h5" color="text.secondary" fontWeight="500">
                        Select a table to view its data
                    </Typography>
                </Box>
              )}
          </Box>
        </Box>
      )}
      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleSnackbarClose}>
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={loading}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
    </ThemeProvider>
  );
}

export default App;
