import React from 'react';
import { List, ListItemButton, ListItemText, TextField, Paper } from '@mui/material';

interface SidebarProps {
  tables: string[];
  onTableSelect: (table: string) => void;
}

function Sidebar({ tables, onTableSelect }: SidebarProps) {
  const [filter, setFilter] = React.useState('');

  const filteredTables = tables.filter((table) =>
    table.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Paper elevation={3} style={{ height: '100vh', overflow: 'auto' }}>
      <TextField
        label="Filter tables"
        variant="outlined"
        fullWidth
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ margin: '10px', width: 'calc(100% - 20px)' }}
      />
      <List>
        {filteredTables.map((table) => (
          <ListItemButton key={table} onClick={() => onTableSelect(table)}>
            <ListItemText primary={table} />
          </ListItemButton>
        ))}
      </List>
    </Paper>
  );
}

export default Sidebar;
