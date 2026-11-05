import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  Box,
  Step,
  StepLabel,
  Stepper,
  Typography,
  Chip,
  LinearProgress,
} from '@mui/material';
import React from 'react';

export type WorkflowStep =
  | 'data-entry'
  | 'validate-tickets'
  | 'create-tickets'
  | 'validate-entries'
  | 'export-tempo';

interface WorkflowStepConfig {
  key: WorkflowStep;
  label: string;
  description: string;
}

const WORKFLOW_STEPS: WorkflowStepConfig[] = [
  {
    key: 'data-entry',
    label: 'Data Entry',
    description: 'Import or enter time entries',
  },
  {
    key: 'validate-tickets',
    label: 'Validate Tickets',
    description: 'Check that tickets exist in Jira',
  },
  {
    key: 'create-tickets',
    label: 'Create Tickets',
    description: 'Create new tickets in Jira',
  },
  {
    key: 'validate-entries',
    label: 'Validate Entries',
    description: 'Review data before exporting',
  },
  {
    key: 'export-tempo',
    label: 'Export to Tempo',
    description: 'Upload entries to Tempo',
  },
];

interface EnhancedWorkflowStepperProps {
  currentStep: WorkflowStep;
  completedSteps: WorkflowStep[];
  entriesCount?: number;
  newTicketsCount?: number;
  validatedCount?: number;
  uploadProgress?: { current: number; total: number };
}

export const EnhancedWorkflowStepper: React.FC<EnhancedWorkflowStepperProps> = ({
  currentStep,
  completedSteps,
  entriesCount = 0,
  newTicketsCount = 0,
  validatedCount = 0,
  uploadProgress,
}) => {
  const currentStepIndex = WORKFLOW_STEPS.findIndex((s) => s.key === currentStep);

  const getStepStatus = (stepKey: WorkflowStep): 'completed' | 'active' | 'pending' => {
    if (completedSteps.includes(stepKey)) return 'completed';
    if (stepKey === currentStep) return 'active';
    return 'pending';
  };

  const getStepBadge = (stepKey: WorkflowStep) => {
    const status = getStepStatus(stepKey);

    switch (stepKey) {
      case 'data-entry':
        if (status === 'completed' && entriesCount > 0) {
          return <Chip label={`${entriesCount} entries`} size="small" color="success" />;
        }
        break;
      case 'validate-tickets':
        if (status === 'completed' && validatedCount > 0) {
          return <Chip label={`${validatedCount} valid`} size="small" color="success" />;
        }
        break;
      case 'create-tickets':
        if (newTicketsCount > 0) {
          return (
            <Chip
              label={`${newTicketsCount} new`}
              size="small"
              color={status === 'completed' ? 'success' : 'warning'}
            />
          );
        } else if (status === 'completed') {
          return <Chip label="No new tickets" size="small" color="default" />;
        }
        break;
      case 'validate-entries':
        if (status === 'completed') {
          return <Chip label="Ready" size="small" color="success" />;
        }
        break;
      case 'export-tempo':
        if (uploadProgress && uploadProgress.total > 0) {
          return (
            <Chip
              label={`${uploadProgress.current}/${uploadProgress.total}`}
              size="small"
              color="primary"
            />
          );
        } else if (status === 'completed') {
          return <Chip label="Completed" size="small" color="success" />;
        }
        break;
    }

    return null;
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom fontWeight="bold">
          Workflow
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Step {currentStepIndex + 1} of {WORKFLOW_STEPS.length}
        </Typography>
      </Box>

      {/* Progress Bar */}
      <Box sx={{ mb: 3 }}>
        <LinearProgress
          variant="determinate"
          value={((currentStepIndex + 1) / WORKFLOW_STEPS.length) * 100}
          sx={{ height: 8, borderRadius: 1 }}
        />
      </Box>

      {/* Stepper */}
      <Stepper activeStep={currentStepIndex} orientation="vertical">
        {WORKFLOW_STEPS.map((step) => {
          const status = getStepStatus(step.key);
          const isActive = status === 'active';
          const isCompleted = status === 'completed';

          return (
            <Step key={step.key} completed={isCompleted}>
              <StepLabel
                StepIconComponent={() =>
                  isCompleted ? (
                    <CheckCircleIcon sx={{ color: 'success.main', fontSize: 28 }} />
                  ) : (
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: isActive ? 'primary.main' : 'grey.300',
                        color: isActive ? 'white' : 'grey.600',
                        fontWeight: 'bold',
                        fontSize: 14,
                      }}
                    >
                      {WORKFLOW_STEPS.findIndex((s) => s.key === step.key) + 1}
                    </Box>
                  )
                }
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography
                    variant="body1"
                    fontWeight={isActive ? 'bold' : 'normal'}
                    color={isActive ? 'primary.main' : 'text.primary'}
                  >
                    {step.label}
                  </Typography>
                  {getStepBadge(step.key)}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {step.description}
                </Typography>
              </StepLabel>
            </Step>
          );
        })}
      </Stepper>

      {/* Overall Progress */}
      {uploadProgress && uploadProgress.total > 0 && (
        <Box sx={{ mt: 3, p: 2, bgcolor: 'primary.50', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Upload Progress
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(uploadProgress.current / uploadProgress.total) * 100}
            sx={{ mb: 1, height: 6, borderRadius: 1 }}
          />
          <Typography variant="body2" fontWeight="bold">
            {uploadProgress.current} of {uploadProgress.total} entries uploaded
          </Typography>
        </Box>
      )}
    </Box>
  );
};
