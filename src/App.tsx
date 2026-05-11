import React, { useState, useEffect, useMemo } from 'react';
import { Button, Container, CssBaseline, Paper, Box, Snackbar, Alert, Backdrop, ThemeProvider, Typography, IconButton, TextField, MenuItem, Chip, Stack, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import ConnectionDialog from './components/ConnectionDialog';
import Sidebar from './components/Sidebar';
import MyDataGrid from './components/DataGrid';
import AddRowDialog from './components/AddRowDialog';
import ImportDialog from './components/ImportDialog';
import CatLoader from './components/CatLoader';
import { GridColDef, GridRowModel, GridRowSelectionModel } from '@mui/x-data-grid';
import { lightTheme, darkTheme } from './theme';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import UndoIcon from '@mui/icons-material/Undo';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import UploadFileIcon from '@mui/icons-material/UploadFile';

interface FilterRule {
  id: string;
  field: string;
  value: string;
  operator: 'contains' | 'exact';
}

interface ModifiedRowEntry {
  newRow: GridRowModel;
  oldRow?: GridRowModel;
}

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
  const [modifiedRows, setModifiedRows] = useState<Record<string, ModifiedRowEntry>>({});
  const [rowSelectionModel, setRowSelectionModel] = useState<GridRowSelectionModel>({ type: 'include', ids: new Set() });
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('success');
  const [deletedRowsOriginalPks, setDeletedRowsOriginalPks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filters, setFilters] = useState<FilterRule[]>([]);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [rowCount, setRowCount] = useState(0);
  const [addRowDialogOpen, setAddRowDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importErrorLog, setImportErrorLog] = useState<string[]>([]);
  const [importErrorDialogOpen, setImportErrorDialogOpen] = useState(false);

  const filteredRows = useMemo(() => {
    // No longer needed for client-side filtering since we use server-side
    return rows;
  }, [rows]);

  const handleAddFilter = () => {
    if (columns.length > 0) {
      setFilters(prev => [...prev, { id: Date.now().toString(), field: columns[0].field, value: '', operator: 'contains' }]);
    }
  };

  const handleRemoveFilter = (id: string) => {
    setFilters(prev => prev.filter(f => f.id !== id));
  };

  const handleFilterChange = (id: string, field: keyof FilterRule, value: string) => {
    setFilters(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  // Re-fetch data when filters change
  React.useEffect(() => {
    if (selectedTable && connected) {
      const applyFilters = async () => {
        setLoading(true);
        setPaginationModel(prev => ({ ...prev, page: 0 })); // Reset to first page
        
        // Re-fetch count with filters
        const countResult = await window.electronAPI.getTableCount(selectedTable, filters);
        setRowCount(typeof countResult === 'number' ? countResult : 0);
        
        // Re-fetch data with filters
        await fetchTableData(selectedTable, 0, paginationModel.pageSize, primaryKeys);
        setLoading(false);
      };
      
      applyFilters();
    }
  }, [filters]);

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

  const fetchTableData = async (table: string, page: number, pageSize: number, pks: string[]) => {
      try {
        const dataResult = await window.electronAPI.getTableData(table, page, pageSize, pks && pks.length > 0 ? pks[0] : undefined, filters);
        if (Array.isArray(dataResult)) {
            const newRows = dataResult.map((row, index) => {
                let rowId: string | number = index;
                const originalPks: any = {};
    
                if (pks.length > 0) {
                    const pkValues = pks.map(pk => row[pk]);
                    if (pkValues.every(val => val !== undefined && val !== null)) {
                        rowId = pkValues.join('|||');
                    }
                    pks.forEach(pk => {
                        originalPks[pk] = row[pk];
                    });
                }
                return { ...row, id: rowId, _originalPks: originalPks };
            });
            setRows(newRows);
            setOriginalRows(newRows);
        }
      } catch (e) {
          console.error("Error fetching page", e);
      }
  };

  const handleTableSelect = async (table: string) => {
    setSelectedTable(table);
    setModifiedRows({}); 
    setDeletedRowsOriginalPks([]);
    setRowSelectionModel({ type: 'include', ids: new Set() });
    setPrimaryKeys([]);
    setLoading(true);
    setFilters([]);
    
    // Reset pagination state without triggering immediate effect (if we block it)
    // Or just set it, and rely on the metadata load.
    const initialPage = 0;
    const initialPageSize = 25;
    setPaginationModel({ page: initialPage, pageSize: initialPageSize }); 
    
    try {
      // Fetch Metadata & Count First
      const [columnResult, pkResult, countResult] = await Promise.all([
        window.electronAPI.getColumns(table),
        window.electronAPI.getPrimaryKey(table),
        window.electronAPI.getTableCount(table, filters)
      ]);
      
      const finalCount = typeof countResult === 'number' ? countResult : 0;
      setRowCount(finalCount);
      const pks = Array.isArray(pkResult) ? pkResult : [];
      setPrimaryKeys(pks);

      // Configure Columns
      if (Array.isArray(columnResult)) {
         const newColumns: GridColDef[] = columnResult.map((col: any) => ({
            field: col.COLUMN_NAME,
            headerName: col.COLUMN_NAME,
            width: 150,
            editable: !col.IS_IDENTITY, 
         }));
         setColumns(newColumns);
      } else {
         setColumns([]);
      }
      
      // Now fetch initial data
      await fetchTableData(table, initialPage, initialPageSize, pks);

    } catch (e) {
      console.error("Error loading table details", e);
    } finally {
      setLoading(false);
    }
  };
  
  // Replaces the useEffect added previously
  const handlePaginationModelChange = async (model: { page: number; pageSize: number }) => {
      setPaginationModel(model);
      if (selectedTable) {
          setLoading(true);
          await fetchTableData(selectedTable, model.page, model.pageSize, primaryKeys);
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
      next[newRow.id] = { newRow, oldRow };
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
        const validColumnNames = columns
          .filter((c) => c.editable !== false)
          .map((c) => c.field);
        const promises = Object.values(modifiedRows).map((entry) => {
          const row = entry.newRow;
          if ((row as any)._isNew) {
            return window.electronAPI.insertTableRow(selectedTable, row, validColumnNames);
            } else {
            return window.electronAPI.updateTableData(selectedTable, row, primaryKeys, (row as any)._originalPks, entry.oldRow);
            }
        });

        const results = await Promise.all(promises);
        const failedUpdates = results.filter((result: any) => !result.success);

        if (failedUpdates.length > 0) {
            console.error('Some rows failed to save:', failedUpdates);
            setSnackbarMessage(`Saved with errors. Failed to save ${failedUpdates.length} rows.`);
            setSnackbarSeverity('warning');
        } else {
            setSnackbarMessage('Changes (updates, deletions, inserts) saved successfully!');
            setSnackbarSeverity('success');
        }

        // Always refresh table data after save to stay in sync with DB
        const newCount = await window.electronAPI.getTableCount(selectedTable, filters);
        setRowCount(typeof newCount === 'number' ? newCount : 0);
        await fetchTableData(selectedTable, paginationModel.page, paginationModel.pageSize, primaryKeys);
        
        // Clear modification tracking
        setModifiedRows({});
        setDeletedRowsOriginalPks([]);
        setRowSelectionModel({ type: 'include', ids: new Set() });
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
    setAddRowDialogOpen(true);
  };

  const handleAddRowFromDialog = (rowData: any) => {
    const tempId = `temp-${Date.now()}`;
    const newRow: any = { 
      id: tempId, 
      _isNew: true,
      ...rowData
    };
    
    setRows((prev) => [newRow, ...prev]);
    setModifiedRows((prev) => ({ ...prev, [tempId]: { newRow } }));
  };

  const handleImport = async (file: File) => {
    if (!selectedTable) {
      setSnackbarMessage('No table selected');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    try {
      setLoading(true);

      // Read the file
      const buffer = await file.arrayBuffer();
      
      // Import xlsx dynamically
      const XLSX = await import('xlsx');
      
      // Parse the file - cellDates:false and raw:true to keep dates as original strings
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: true });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to JSON, keeping raw strings
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true, rawNumbers: false }) as any[][];
      
      if (jsonData.length < 2) {
        setSnackbarMessage('File must contain at least one data row (excluding headers)');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        setLoading(false);
        return;
      }

      // Skip first row (headers) and get data rows
      const dataRows = jsonData.slice(1);
      
      // Get column names from the table (excluding computed/identity columns)
      const tableColumns = columns
        .filter(col => col.editable !== false)
        .map(col => col.field);

      // Convert array rows to objects with column names
      const rowObjects = dataRows.map(row => {
        const obj: any = {};
        tableColumns.forEach((colName, index) => {
          obj[colName] = row[index] !== undefined ? row[index] : null;
        });
        return obj;
      });

      // Call bulk insert
      const result = await window.electronAPI.bulkInsert(selectedTable, rowObjects, tableColumns);

      if (result.success) {
        setSnackbarMessage(`Import completed: ${result.successCount} rows imported successfully${result.failCount > 0 ? `, ${result.failCount} failed` : ''}`);
        setSnackbarSeverity(result.failCount > 0 ? 'warning' : 'success');
        
        // Store error log if there are failures
        if (result.failCount > 0 && result.errors && result.errors.length > 0) {
          setImportErrorLog(result.errors);
          setImportErrorDialogOpen(true);
        }

        // Refresh the table data
        const newCount = await window.electronAPI.getTableCount(selectedTable, filters);
        setRowCount(typeof newCount === 'number' ? newCount : 0);
        await fetchTableData(selectedTable, paginationModel.page, paginationModel.pageSize, primaryKeys);
      } else {
        setSnackbarMessage(`Import failed: ${result.error || 'Unknown error'}`);
        setSnackbarSeverity('error');
      }
      
      setSnackbarOpen(true);
      setLoading(false);
      setImportDialogOpen(false);
    } catch (error: any) {
      console.error('Import error:', error);
      setSnackbarMessage(`Import failed: ${error.message || 'Unknown error'}`);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      setLoading(false);
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

  // Effect to handle pagination changes - removed as it conflicts with handlePaginationModelChange
  useEffect(() => {
     // Intentionally left empty to remove previous effect logic if any
  }, []);

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
                          color="primary"
                          startIcon={<UploadFileIcon />}
                          onClick={() => setImportDialogOpen(true)}
                        >
                          Import
                        </Button>
                        <Button
                            variant={showFilterPanel ? "contained" : "outlined"}
                            color="info"
                            startIcon={<FilterListIcon />}
                            onClick={() => setShowFilterPanel(!showFilterPanel)}
                        >
                            Filter
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

                  {showFilterPanel && (
                    <Paper 
                      elevation={0} 
                      sx={{ 
                        mx: 3, 
                        mb: 2, 
                        p: 2, 
                        bgcolor: 'background.paper', 
                        borderRadius: 3,
                        border: theme.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)'
                      }}
                    >
                      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                        <Typography variant="subtitle2" fontWeight="600">Active Filters</Typography>
                        <Button size="small" startIcon={<AddIcon />} onClick={handleAddFilter}>Add Filter</Button>
                      </Box>
                      <Stack spacing={2}>
                        {filters.length === 0 ? (
                           <Typography variant="body2" color="text.secondary" fontStyle="italic">No filters active. Click "Add Filter" to create one.</Typography>
                        ) : (
                          filters.map((filter) => (
                            <Box key={filter.id} display="flex" gap={2} alignItems="center">
                              <TextField
                                select
                                size="small"
                                label="Column"
                                value={filter.field}
                                onChange={(e) => handleFilterChange(filter.id, 'field', e.target.value)}
                                sx={{ minWidth: 150 }}
                              >
                                {columns.map((col) => (
                                  <MenuItem key={col.field} value={col.field}>{col.headerName || col.field}</MenuItem>
                                ))}
                              </TextField>
                              <TextField
                                select
                                size="small"
                                label="Operator"
                                value={filter.operator}
                                onChange={(e) => handleFilterChange(filter.id, 'operator', e.target.value)}
                                sx={{ minWidth: 120 }}
                              >
                                <MenuItem value="contains">Contains</MenuItem>
                                <MenuItem value="exact">Exact Match</MenuItem>
                              </TextField>
                              <TextField
                                size="small"
                                label="Value"
                                value={filter.value}
                                onChange={(e) => handleFilterChange(filter.id, 'value', e.target.value)}
                                fullWidth
                              />
                               <IconButton size="small" color="error" onClick={() => handleRemoveFilter(filter.id)}>
                                 <CloseIcon />
                               </IconButton>
                            </Box>
                          ))
                        )}
                      </Stack>
                    </Paper>
                  )}

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
                            rowCount={rowCount}
                            paginationModel={paginationModel}
                            onPaginationModelChange={handlePaginationModelChange}
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
        <CatLoader size={150} />
      </Backdrop>
      <AddRowDialog
        open={addRowDialogOpen}
        onClose={() => setAddRowDialogOpen(false)}
        onAdd={handleAddRowFromDialog}
        columns={columns}
      />
      <ImportDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImport={handleImport}
        tableName={selectedTable || ''}
      />
      {/* Import Error Log Dialog */}
      <Dialog
        open={importErrorDialogOpen}
        onClose={() => setImportErrorDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Import Error Log ({importErrorLog.length} errors)
          <IconButton onClick={() => setImportErrorDialogOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box
            sx={{
              fontFamily: 'monospace',
              fontSize: '13px',
              maxHeight: '400px',
              overflowY: 'auto',
              backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
              borderRadius: 1,
              p: 2,
            }}
          >
            {importErrorLog.map((err, idx) => (
              <Box
                key={idx}
                sx={{
                  py: 0.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  color: 'error.main',
                  '&:last-child': { borderBottom: 'none' },
                }}
              >
                {err}
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              const logContent = importErrorLog.join('\n');
              const blob = new Blob([logContent], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `import-errors-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.log`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            variant="outlined"
            color="error"
          >
            Download Error Log
          </Button>
          <Button onClick={() => setImportErrorDialogOpen(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}

export default App;
