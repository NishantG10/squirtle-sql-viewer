import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  CircularProgress,
  Alert,
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    setLoading(true);
    setError('');
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
    <Dialog open={open} onClose={handleClose}>
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
