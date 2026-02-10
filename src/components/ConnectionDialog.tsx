import React, { useState, useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  CircularProgress,
  Alert,
  FormControlLabel,
  Checkbox,
} from '@mui/material';

interface ConnectionDialogProps {
  open: boolean;
  handleClose: (isConnected: boolean) => void;
}

function ConnectionDialog({ open, handleClose }: ConnectionDialogProps) {
  const [server, setServer] = useState('');
  const [database, setDatabase] = useState('');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [saveCredentials, setSaveCredentials] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      const loadCredentials = async () => {
        const stored = await window.electronAPI.getCredentials();
        if (stored) {
          setServer(stored.server || '');
          setDatabase(stored.database || '');
          setUser(stored.user || '');
          // If we have stored credentials, we assume the user wants to keep saving them
          setSaveCredentials(true);
          // Only auto-fill password if it was saved (security implication: plaintext storage)
          setPassword(stored.password || '');
        }
      };
      loadCredentials();
    }
  }, [open]);

  const handleConnect = async () => {
    setLoading(true);
    setError('');
    
    // Save or Clear credentials based on checkbox
    if (saveCredentials) {
        await window.electronAPI.saveCredentials({ server, database, user, password });
    } else {
        // If unchecked, we might want to clear them, or just update without password?
        // For now, let's clear them to respect "don't save"
        await window.electronAPI.saveCredentials({}); 
    }

    const result = await window.electronAPI.connect({
      server,
      database,
      user,
      password,
      options: {
        encrypt: false, // for Azure SQL
        trustServerCertificate: true,
      },
    });
    setLoading(false);
    if (result.success) {
      handleClose(true);
    } else {
      setError(result.error);
    }
  };

  return (
    <Dialog open={open} onClose={() => handleClose(false)}>
      <DialogTitle>Connect to SQL Server</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          autoFocus
          margin="dense"
          label="Server"
          type="text"
          fullWidth
          variant="standard"
          value={server}
          onChange={(e) => setServer(e.target.value)}
        />
        <TextField
          margin="dense"
          label="Database"
          type="text"
          fullWidth
          variant="standard"
          value={database}
          onChange={(e) => setDatabase(e.target.value)}
        />
        <TextField
          margin="dense"
          label="User"
          type="text"
          fullWidth
          variant="standard"
          value={user}
          onChange={(e) => setUser(e.target.value)}
        />
        <TextField
          margin="dense"
          label="Password"
          type="password"
          fullWidth
          variant="standard"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={saveCredentials}
              onChange={(e) => setSaveCredentials(e.target.checked)}
              color="primary"
            />
          }
          label="Save Credentials"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => handleClose(false)}>Cancel</Button>
        <Button onClick={handleConnect} disabled={loading}>
          {loading ? <CircularProgress size={24} /> : 'Connect'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConnectionDialog;
