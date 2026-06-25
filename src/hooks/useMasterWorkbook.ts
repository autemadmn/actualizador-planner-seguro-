import { useState } from 'react';
import { readMasterExcel } from '../services/masterExcel';
import type { ParsedMasterWorkbook } from '../types/master';

interface MasterUploadState {
  fileName: string | null;
  workbook: ParsedMasterWorkbook | null;
  error: string | null;
}

interface UseMasterWorkbookResult extends MasterUploadState {
  isProcessing: boolean;
  isReady: boolean;
  loadMasterFile: (file: File) => Promise<void>;
  clearMasterFile: () => void;
}

const initialState: MasterUploadState = {
  fileName: null,
  workbook: null,
  error: null,
};

function errorMessageFromUnknown(error: unknown): string {
  return error instanceof Error ? error.message : 'No se ha podido procesar el Excel maestro.';
}

export function useMasterWorkbook(): UseMasterWorkbookResult {
  const [state, setState] = useState<MasterUploadState>(initialState);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadMasterFile = async (file: File): Promise<void> => {
    setState({
      fileName: file.name,
      workbook: null,
      error: null,
    });
    setIsProcessing(true);

    try {
      const workbook = await readMasterExcel(file);
      setState({
        fileName: file.name,
        workbook,
        error: null,
      });
    } catch (error) {
      setState({
        fileName: file.name,
        workbook: null,
        error: errorMessageFromUnknown(error),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const clearMasterFile = (): void => {
    setState(initialState);
  };

  return {
    ...state,
    isProcessing,
    isReady: Boolean(state.workbook),
    loadMasterFile,
    clearMasterFile,
  };
}
