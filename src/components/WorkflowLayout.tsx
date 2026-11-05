import { Box } from '@mui/material';
import React from 'react';

interface WorkflowLayoutProps {
  sidebar: React.ReactNode;
  content: React.ReactNode;
  footer?: React.ReactNode;
}

export const WorkflowLayout: React.FC<WorkflowLayoutProps> = ({ sidebar, content, footer }) => {
  return (
    <Box sx={{ display: 'flex', gap: 3, height: 'calc(100vh - 200px)' }}>
      {/* Sidebar - 30% */}
      <Box sx={{ width: '30%', minWidth: '300px', height: '100%' }}>
        <Box
          sx={{
            p: 3,
            height: '100%',
            bgcolor: 'grey.50',
            borderRadius: 1,
            overflowY: 'auto'
          }}
        >
          {sidebar}
        </Box>
      </Box>

      {/* Main Content - 70% */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
        <Box
          sx={{
            p: 3,
            flex: 1,
            bgcolor: 'background.paper',
            borderRadius: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {content}
        </Box>

        {footer && (
          <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            {footer}
          </Box>
        )}
      </Box>
    </Box>
  );
};
