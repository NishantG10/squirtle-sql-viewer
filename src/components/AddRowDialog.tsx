import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
} from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';

interface AddRowDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (rowData: any) => void;
  columns: GridColDef[];
}

function AddRowDialog({ open, onClose, onAdd, columns }: AddRowDialogProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      const initialData: Record<string, any> = {};
      columns.forEach((col) => {
        if (col.field !== 'id' && col.editable !== false) {
          initialData[col.field] = '';
        }
      });
      setFormData(initialData);
      setErrors({});
    }
  }, [open, columns]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = () => {
    // Basic validation
    const newErrors: Record<string, string> = {};
    
    // You can add validation logic here if needed
    // For now, we'll just check if required fields are filled
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Add the row
    onAdd(formData);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  // Filter out non-editable columns (like identity columns)
  const editableColumns = columns.filter(
    (col) => col.field !== 'id' && col.editable !== false
  );

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="md" fullWidth>
      <DialogTitle>Add New Row</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            Fill in the details for the new row. Leave identity/auto-generated fields empty.
          </Alert>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {editableColumns.map((col) => (
              <TextField
                key={col.field}
                label={col.headerName || col.field}
                value={formData[col.field] || ''}
                onChange={(e) => handleChange(col.field, e.target.value)}
                error={!!errors[col.field]}
                helperText={errors[col.field]}
                fullWidth
                size="small"
                variant="outlined"
              />
            ))}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleCancel} variant="outlined">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          Add Row
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AddRowDialog;
