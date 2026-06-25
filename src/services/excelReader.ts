import ExcelJS from 'exceljs';
import type { ParsedPlannerSheet } from '../types/excel';
import { ColumnDetectionError } from '../utils/columnDetection';
import { parsePlannerWorksheet } from './excelParser';

export class ExcelReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExcelReadError';
  }
}

function ensureXlsxFile(file: File): void {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new ExcelReadError('El archivo seleccionado no es un archivo .xlsx válido.');
  }
}

function findPlannerSheet(workbook: ExcelJS.Workbook, fileName: string): ParsedPlannerSheet {
  let firstDetectionError: Error | null = null;

  for (const worksheet of workbook.worksheets) {
    try {
      return parsePlannerWorksheet(worksheet, fileName);
    } catch (error) {
      if (error instanceof ColumnDetectionError && !firstDetectionError) {
        firstDetectionError = error;
      }
    }
  }

  if (firstDetectionError) {
    throw firstDetectionError;
  }

  throw new ExcelReadError('Los archivos no parecen tener la misma estructura de planificación.');
}

export async function readPlannerExcel(file: File): Promise<ParsedPlannerSheet> {
  ensureXlsxFile(file);

  try {
    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);
    return findPlannerSheet(workbook, file.name);
  } catch (error) {
    if (error instanceof ColumnDetectionError || error instanceof ExcelReadError) {
      throw error;
    }

    throw new ExcelReadError('No se ha podido leer el archivo Excel seleccionado.');
  }
}
