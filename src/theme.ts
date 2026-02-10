import { createTheme, ThemeOptions } from '@mui/material/styles';
import type {} from '@mui/x-data-grid/themeAugmentation';

const baseTheme: ThemeOptions = {
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '2rem', fontWeight: 600 },
    h2: { fontSize: '1.5rem', fontWeight: 600 },
    h3: { fontSize: '1.25rem', fontWeight: 600 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 12,
          fontWeight: 600,
          padding: '8px 16px',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
      },
    },
    MuiDataGrid: {
        styleOverrides: {
            root: {
                border: 'none',
                '& .MuiDataGrid-cell': {
                    borderBottom: '1px solid rgba(224, 224, 224, 0.1)',
                },
                '& .MuiDataGrid-columnHeaders': {
                    borderBottom: '1px solid rgba(224, 224, 224, 0.2)',
                    backgroundColor: 'rgba(0,0,0,0.02)',
                },
            }
        }
    }
  },
};

export const lightTheme = createTheme({
  ...baseTheme,
  palette: {
    mode: 'light',
    primary: {
      main: '#6C5DD3', // Purple from reference
    },
    secondary: {
      main: '#A098E5',
    },
    background: {
      default: '#f4f5f7',
      paper: '#ffffff',
    },
    text: {
      primary: '#11142D',
      secondary: '#808191',
    },
  },
});

export const darkTheme = createTheme({
  ...baseTheme,
  palette: {
    mode: 'dark',
    primary: {
      main: '#6C5DD3', // Purple from reference
    },
    secondary: {
      main: '#A098E5',
    },
    background: {
      default: '#1f1d2b', // Dark background
      paper: '#252836',   // Slightly lighter for cards
    },
    text: {
      primary: '#ffffff',
      secondary: '#808191',
    },
    divider: 'rgba(255, 255, 255, 0.05)',
  },
  components: {
    ...baseTheme.components,
    MuiDataGrid: {
        styleOverrides: {
            root: {
                border: 'none',
                '& .MuiDataGrid-cell': {
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                },
                '& .MuiDataGrid-columnHeaders': {
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                },
                '& .MuiDataGrid-footerContainer': {
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                }
            }
        }
    }
  }
});
