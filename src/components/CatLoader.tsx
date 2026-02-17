import React from 'react';
import { Box, keyframes } from '@mui/material';
import psyduckImage from '../assets/psyduck.png';

const bounce = keyframes`
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-20px) scale(1.05);
  }
`;

const headShake = keyframes`
  0%, 100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-5deg);
  }
  75% {
    transform: rotate(5deg);
  }
`;

const waterDrop = keyframes`
  0% {
    transform: translateY(0) scale(0);
    opacity: 1;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: translateY(30px) scale(1);
    opacity: 0;
  }
`;

const pulse = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
`;

interface CatLoaderProps {
  size?: number;
}

const CatLoader: React.FC<CatLoaderProps> = ({ size = 120 }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
      }}
    >
      {/* Psyduck Image */}
      <Box
        sx={{
          width: size,
          height: size,
          animation: `${bounce} 1.5s ease-in-out infinite`,
          position: 'relative',
        }}
      >
        <Box
          component="img"
          src={psyduckImage}
          alt="Loading Psyduck"
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            animation: `${headShake} 2s ease-in-out infinite`,
            filter: 'drop-shadow(0 0 10px rgba(255, 193, 7, 0.5))',
          }}
        />
        
        {/* Water drops around Psyduck */}
        <Box
          sx={{
            position: 'absolute',
            top: '20%',
            left: '10%',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#64B5F6',
            animation: `${waterDrop} 2s ease-in infinite`,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: '15%',
            right: '15%',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#64B5F6',
            animation: `${waterDrop} 2s ease-in infinite 0.5s`,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: '25%',
            right: '20%',
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            backgroundColor: '#64B5F6',
            animation: `${waterDrop} 2s ease-in infinite 1s`,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: '20%',
            left: '25%',
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            backgroundColor: '#64B5F6',
            animation: `${waterDrop} 2s ease-in infinite 1.5s`,
          }}
        />
      </Box>

      {/* Loading Text */}
      <Box
        sx={{
          color: '#fff',
          fontSize: '18px',
          fontWeight: 500,
          textAlign: 'center',
          opacity: 0.9,
        }}
      >
        Psyduck is confused... Loading...
      </Box>

      {/* Water bubble animation */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          '& > div': {
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: '#64B5F6',
            opacity: 0.6,
            border: '2px solid #42A5F5',
          },
          '& > div:nth-of-type(1)': {
            animation: `${pulse} 1s ease-in-out infinite`,
          },
          '& > div:nth-of-type(2)': {
            animation: `${pulse} 1s ease-in-out infinite 0.2s`,
          },
          '& > div:nth-of-type(3)': {
            animation: `${pulse} 1s ease-in-out infinite 0.4s`,
          },
        }}
      >
        <div />
        <div />
        <div />
      </Box>
    </Box>
  );
};

export default CatLoader;
