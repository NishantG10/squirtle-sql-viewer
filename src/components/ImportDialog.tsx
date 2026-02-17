import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  LinearProgress,
  Chip,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (file: File) => Promise<void>;
  tableName: string;
}

function ImportDialog({ open, onClose, onImport, tableName }: ImportDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file type
      const validTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];
      
      const isValidType = validTypes.includes(file.type) || 
                         file.name.endsWith('.csv') || 
                         file.name.endsWith('.xlsx') || 
                         file.name.endsWith('.xls');
      
      if (!isValidType) {
        setError('Please select a valid CSV or Excel file');
        setSelectedFile(null);
        return;
      }
      
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    
    setImporting(true);
    setError(null);
    
    try {
      await onImport(selectedFile);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to import file');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (!importing) {
      setSelectedFile(null);
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import Data to {tableName}</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>Important:</strong>
            </Typography>
            <Typography variant="body2" component="div">
              • The first row of the file will be skipped (assumed to be headers)
              <br />
              • Column order in the file must match the table column order
              <br />
              • Identity/auto-generated columns should be excluded or left empty
              <br />
              • Supported formats: CSV, XLS, XLSX
            </Typography>
          </Alert>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box
            sx={{
              border: '2px dashed',
              borderColor: selectedFile ? 'success.main' : 'divider',
              borderRadius: 2,
              p: 3,
              textAlign: 'center',
              bgcolor: 'background.default',
              cursor: 'pointer',
              transition: 'all 0.3s',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
              },
            }}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".csv,.xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
              disabled={importing}
            />
            
            {selectedFile ? (
              <Box>
                <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                <Typography variant="body1" fontWeight="600" gutterBottom>
                  {selectedFile.name}
                </Typography>
                <Chip 
                  label={`${(selectedFile.size / 1024).toFixed(2)} KB`} 
                  size="small" 
                  color="success"
                />
              </Box>
            ) : (
              <Box>
                <UploadFileIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body1" color="text.secondary">
                  Click to select a file
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  CSV, XLS, or XLSX
                </Typography>
              </Box>
            )}
          </Box>

          {importing && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                Importing data...
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={importing} variant="outlined">
          Cancel
        </Button>
        <Button 
          onClick={handleImport} 
          disabled={!selectedFile || importing}
          variant="contained" 
          color="primary"
        >
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ImportDialog;
