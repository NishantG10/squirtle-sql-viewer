import React from 'react';
import { 
  List, 
  ListItemButton, 
  ListItemText, 
  TextField, 
  Paper, 
  Box, 
  Typography, 
  Switch, 
  FormControlLabel,
  useTheme,
  ListItemIcon
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage'; // You might need to install @mui/icons-material
import TableChartIcon from '@mui/icons-material/TableChart';
import SearchIcon from '@mui/icons-material/Search';
import InputAdornment from '@mui/material/InputAdornment';

interface SidebarProps {
  tables: string[];
  selectedTable: string | null;
  onTableSelect: (table: string) => void;
  mode: 'light' | 'dark';
  onToggleMode: () => void;
}

function Sidebar({ tables, selectedTable, onTableSelect, mode, onToggleMode }: SidebarProps) {
  const [filter, setFilter] = React.useState('');
  const theme = useTheme();

  const filteredTables = tables.filter((table) =>
    table.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Paper 
      elevation={0} 
      className="sidebar-container"
      sx={{ 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        bgcolor: 'background.paper',
        borderRight: `1px solid ${theme.palette.divider}` 
      }}
    >
      <Box p={3} pb={1}>
        <Box display="flex" alignItems="center" gap={1} mb={3}>
           <Box 
             sx={{ 
               width: 32, 
               height: 32, 
               bgcolor: 'primary.main', 
               borderRadius: '8px', 
               display: 'flex', 
               alignItems: 'center', 
               justifyContent: 'center',
               color: 'white'
             }}
           >
             <StorageIcon fontSize="small" />
           </Box>
           <Typography variant="h6" fontWeight="bold" color="text.primary">
             Squirtle SQL
           </Typography>
        </Box>

        <TextField
          placeholder="Search tables..."
          variant="outlined"
          fullWidth
          size="small"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          sx={{ 
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              bgcolor: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
              '& fieldset': { borderWidth: 0 },
              '&.Mui-focused fieldset': { borderWidth: 1 }
            }
           }}
           InputProps={{
             startAdornment: (
               <InputAdornment position="start">
                 <SearchIcon fontSize="small" color="disabled" />
               </InputAdornment>
             ),
           }}
        />
      </Box>
      
      <Box flex={1} overflow="auto" px={2}>
        <Typography variant="overline" color="text.secondary" sx={{ px: 1, fontWeight: 600 }}>
          Tables ({filteredTables.length})
        </Typography>
        <List>
          {filteredTables.map((table) => {
            const isSelected = selectedTable === table;
            return (
              <ListItemButton 
                key={table} 
                onClick={() => onTableSelect(table)}
                selected={isSelected}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'white'
                    }
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: isSelected ? 'white' : 'text.secondary' }}>
                   <TableChartIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText 
                  primary={table} 
                  primaryTypographyProps={{ 
                    fontSize: '0.9rem', 
                    fontWeight: isSelected ? 600 : 400 
                  }} 
                />
              </ListItemButton>
            );
          })}
        </List>
      </Box>

      <Box p={2} borderTop={`1px solid ${theme.palette.divider}`}>
        <FormControlLabel
          control={<Switch checked={mode === 'dark'} onChange={onToggleMode} />}
          label={mode === 'dark' ? 'Dark Mode' : 'Light Mode'}
        />
      </Box>
    </Paper>
  );
}

export default Sidebar;
