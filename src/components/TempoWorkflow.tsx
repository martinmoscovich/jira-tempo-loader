import React, { useState } from 'react';
import { useTimesheet } from '../context/TimesheetContext';
import { EnhancedWorkflowStepper, WorkflowStep } from './EnhancedWorkflowStepper';
import { WorkflowLayout } from './WorkflowLayout';
import { DataEntryStep } from './steps/DataEntryStep';
import { ValidateTicketsStep } from './steps/ValidateTicketsStep';
import { isIssueKey } from '../utils/ticketValidation';
import { CreateTicketsStep } from './steps/CreateTicketsStep';
import { ValidateEntriesStep } from './steps/ValidateEntriesStep';
import { ExportTempoStep } from './steps/ExportTempoStep';

export const TempoWorkflow: React.FC = () => {
  const { entries, validationGroups } = useTimesheet();
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('data-entry');
  const [completedSteps, setCompletedSteps] = useState<WorkflowStep[]>([]);
  const [uploadProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  const markStepComplete = (step: WorkflowStep) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps([...completedSteps, step]);
    }
  };

  const goToStep = (step: WorkflowStep) => {
    setCurrentStep(step);
  };

  const handleDataEntryComplete = () => {
    markStepComplete('data-entry');
    goToStep('validate-tickets');
  };

  const handleValidateTicketsComplete = () => {
    markStepComplete('validate-tickets');
    // Check if we need to create tickets
    if (validationGroups.length > 0) {
      goToStep('create-tickets');
    } else {
      // Skip create tickets, go directly to validate entries
      markStepComplete('create-tickets');
      goToStep('validate-entries');
    }
  };

  const handleCreateTicketsComplete = () => {
    markStepComplete('create-tickets');
    goToStep('validate-entries');
  };

  const handleValidateEntriesComplete = () => {
    markStepComplete('validate-entries');
    goToStep('export-tempo');
  };

  const handleExportComplete = () => {
    markStepComplete('export-tempo');
    // Workflow complete!
  };

  const handleBackFromValidateTickets = () => {
    goToStep('data-entry');
  };

  const handleBackFromCreateTickets = () => {
    goToStep('validate-tickets');
  };

  const handleBackFromValidateEntries = () => {
    // Go back to create tickets if there were new tickets, otherwise validate tickets
    if (validationGroups.length > 0) {
      goToStep('create-tickets');
    } else {
      goToStep('validate-tickets');
    }
  };

  const handleBackFromExport = () => {
    goToStep('validate-entries');
  };

  // Calculate stats for the stepper
  const validatedCount = entries.filter((e) => {
    const trimmed = e.issue.trim();
    return isIssueKey(trimmed);
  }).length;

  const newTicketsCount = validationGroups.length;

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'data-entry':
        return <DataEntryStep onContinue={handleDataEntryComplete} />;

      case 'validate-tickets':
        return (
          <ValidateTicketsStep
            onContinue={handleValidateTicketsComplete}
            onBack={handleBackFromValidateTickets}
          />
        );

      case 'create-tickets':
        return (
          <CreateTicketsStep
            onContinue={handleCreateTicketsComplete}
            onBack={handleBackFromCreateTickets}
          />
        );

      case 'validate-entries':
        return (
          <ValidateEntriesStep
            onContinue={handleValidateEntriesComplete}
            onBack={handleBackFromValidateEntries}
          />
        );

      case 'export-tempo':
        return (
          <ExportTempoStep onBack={handleBackFromExport} onComplete={handleExportComplete} />
        );

      default:
        return null;
    }
  };

  return (
    <WorkflowLayout
      sidebar={
        <EnhancedWorkflowStepper
          currentStep={currentStep}
          completedSteps={completedSteps}
          entriesCount={entries.length}
          newTicketsCount={newTicketsCount}
          validatedCount={validatedCount}
          uploadProgress={uploadProgress}
        />
      }
      content={renderStepContent()}
    />
  );
};
