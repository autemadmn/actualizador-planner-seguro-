import { useState } from 'react';
import { readPlannerExcel } from '../services/excelReader';
import type { ParsedPlannerSheet } from '../types/excel';

interface PlannerUploadState {
  fileName: string | null;
  parsedSheet: ParsedPlannerSheet | null;
  error: string | null;
}

interface UsePlannerWorkbookResult extends PlannerUploadState {
  isProcessing: boolean;
  isReady: boolean;
  loadPlannerFile: (file: File) => Promise<void>;
  clearPlannerFile: () => void;
}

const initialState: PlannerUploadState = {
  fileName: null,
  parsedSheet: null,
  error: null,
};

function errorMessageFromUnknown(error: unknown): string {
  return error instanceof Error ? error.message : 'No se ha podido procesar el Excel de Planner.';
}

export function usePlannerWorkbook(): UsePlannerWorkbookResult {
  const [state, setState] = useState<PlannerUploadState>(initialState);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadPlannerFile = async (file: File): Promise<void> => {
    setState({
      fileName: file.name,
      parsedSheet: null,
      error: null,
    });
    setIsProcessing(true);

    try {
      const parsedSheet = await readPlannerExcel(file);
      setState({
        fileName: file.name,
        parsedSheet,
        error: null,
      });
    } catch (error) {
      setState({
        fileName: file.name,
        parsedSheet: null,
        error: errorMessageFromUnknown(error),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const clearPlannerFile = (): void => {
    setState(initialState);
  };

  return {
    ...state,
    isProcessing,
    isReady: Boolean(state.parsedSheet),
    loadPlannerFile,
    clearPlannerFile,
  };
}
