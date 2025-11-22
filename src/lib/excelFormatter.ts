import * as XLSX from 'xlsx';
import { ExportSettings } from '@/hooks/useExportSettings';

interface CellStyle {
  fill?: { fgColor: { rgb: string } };
  font?: { name?: string; sz?: number; bold?: boolean; color?: { rgb: string } };
  alignment?: { horizontal?: string; vertical?: string };
  border?: {
    top?: { style: string; color: { rgb: string } };
    bottom?: { style: string; color: { rgb: string } };
    left?: { style: string; color: { rgb: string } };
    right?: { style: string; color: { rgb: string } };
  };
}

export class ExcelFormatter {
  private wb: XLSX.WorkBook;
  private settings: ExportSettings;

  constructor(settings: ExportSettings) {
    this.wb = XLSX.utils.book_new();
    this.settings = settings;
  }

  private hexToRgb(hex: string): string {
    // Remove # if present
    hex = hex.replace('#', '');
    return hex.toUpperCase();
  }

  private applyHeaderStyle(ws: XLSX.WorkSheet, range: XLSX.Range, includeHeader: boolean = true) {
    if (!includeHeader || !ws['!ref']) return;

    const headerColor = this.hexToRgb(this.settings.headerColor);
    
    // Apply styles to header row
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!ws[address]) continue;
      
      if (!ws[address].s) ws[address].s = {};
      ws[address].s = {
        fill: { fgColor: { rgb: headerColor } },
        font: {
          name: this.settings.fontFamily,
          sz: 12,
          bold: true,
          color: { rgb: 'FFFFFF' },
        },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } },
        },
      };
    }
  }

  private addHeaderInfo(sheetData: any[], sheetName: string): any[] {
    if (!this.settings.includeHeader) return sheetData;

    const headerRows: any[] = [];

    // Add school name if available
    if (this.settings.schoolName) {
      headerRows.push({ '': this.settings.schoolName });
      headerRows.push({ '': '' }); // Empty row
    }

    // Add sheet title
    headerRows.push({ '': sheetName });
    headerRows.push({ '': `Generated: ${new Date().toLocaleString()}` });
    headerRows.push({ '': '' }); // Empty row

    return [...headerRows, ...sheetData];
  }

  private addFooter(ws: XLSX.WorkSheet, lastRow: number) {
    if (!this.settings.footerText || !ws['!ref']) return;

    const range = XLSX.utils.decode_range(ws['!ref']);
    const footerRow = lastRow + 2;
    const address = XLSX.utils.encode_cell({ r: footerRow, c: 0 });

    ws[address] = {
      t: 's',
      v: this.settings.footerText,
      s: {
        font: {
          name: this.settings.fontFamily,
          sz: 9,
          italic: true,
          color: { rgb: '666666' },
        },
        alignment: { horizontal: 'center' },
      },
    };

    // Merge footer across all columns
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({
      s: { r: footerRow, c: 0 },
      e: { r: footerRow, c: range.e.c },
    });
  }

  addSheet(
    sheetName: string,
    data: any[],
    columnWidths?: { wch: number }[],
    includeHeader: boolean = true
  ) {
    // Add header info to data
    const formattedData = this.addHeaderInfo(data, sheetName);

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(formattedData);

    // Set column widths
    if (columnWidths) {
      ws['!cols'] = columnWidths;
    }

    // Apply header styles
    if (ws['!ref']) {
      const range = XLSX.utils.decode_range(ws['!ref']);
      const dataStartRow = this.settings.includeHeader ? 5 : 0;
      
      // Apply header styles to data headers
      this.applyHeaderStyle(
        ws,
        { s: { r: dataStartRow, c: range.s.c }, e: { r: dataStartRow, c: range.e.c } },
        includeHeader
      );

      // Add footer
      this.addFooter(ws, range.e.r);
    }

    // Add sheet to workbook
    XLSX.utils.book_append_sheet(this.wb, ws, sheetName.substring(0, 31));
  }

  generateFile(filename: string) {
    XLSX.writeFile(this.wb, filename);
  }

  getWorkbook(): XLSX.WorkBook {
    return this.wb;
  }
}

export const formatEvaluationExport = (
  settings: ExportSettings,
  evaluationData: {
    rollNumber?: string;
    subjectCode?: string;
    score: number;
    totalQuestions: number;
    accuracy: number;
    confidence?: string;
    imageQuality?: string;
    lowConfidenceCount?: number;
    gridConfig?: { rows: number; columns: number };
    extractedAnswers: string[];
    correctAnswers: string[];
    detailedResults?: Array<{
      question: number;
      extracted: string;
      correct: string;
      isCorrect: boolean;
      confidence: string;
      note: string;
    }>;
  }
): string => {
  const formatter = new ExcelFormatter(settings);

  // Summary Sheet
  const summaryData = [
    { Field: 'Roll Number', Value: evaluationData.rollNumber || 'Not Detected' },
    { Field: 'Subject Code', Value: evaluationData.subjectCode || 'Not Detected' },
    { Field: 'Date & Time', Value: new Date().toLocaleString() },
    {
      Field: 'Grid Configuration',
      Value: evaluationData.gridConfig
        ? `${evaluationData.gridConfig.rows}×${evaluationData.gridConfig.columns}`
        : 'Sequential',
    },
    { Field: '', Value: '' },
    { Field: 'Score', Value: `${evaluationData.score}/${evaluationData.totalQuestions}` },
    { Field: 'Accuracy', Value: `${evaluationData.accuracy.toFixed(2)}%` },
    { Field: 'Confidence', Value: evaluationData.confidence?.toUpperCase() || 'N/A' },
    { Field: 'Image Quality', Value: evaluationData.imageQuality?.toUpperCase() || 'N/A' },
    { Field: 'Low Confidence Answers', Value: evaluationData.lowConfidenceCount || 0 },
  ];
  formatter.addSheet('Summary', summaryData, [{ wch: 25 }, { wch: 30 }]);

  // Detailed Answers Sheet
  const answersData = evaluationData.extractedAnswers.map((extracted, index) => ({
    Question: index + 1,
    Extracted: extracted,
    Correct: evaluationData.correctAnswers[index],
    Result: extracted === evaluationData.correctAnswers[index] ? '✓ Correct' : '✗ Wrong',
    Confidence: evaluationData.detailedResults?.[index]?.confidence?.toUpperCase() || 'UNKNOWN',
    Notes: evaluationData.detailedResults?.[index]?.note || '-',
  }));
  formatter.addSheet('Detailed Answers', answersData, [
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 40 },
  ]);

  // Statistics Sheet
  const correctCount = evaluationData.extractedAnswers.filter(
    (ans, idx) => ans === evaluationData.correctAnswers[idx]
  ).length;
  const wrongCount = evaluationData.totalQuestions - correctCount;
  const statsData = [
    {
      Category: 'Correct Answers',
      Count: correctCount,
      Percentage: `${((correctCount / evaluationData.totalQuestions) * 100).toFixed(2)}%`,
    },
    {
      Category: 'Wrong Answers',
      Count: wrongCount,
      Percentage: `${((wrongCount / evaluationData.totalQuestions) * 100).toFixed(2)}%`,
    },
    { Category: '', Count: '', Percentage: '' },
    {
      Category: 'High Confidence',
      Count: evaluationData.detailedResults?.filter((r) => r.confidence === 'high').length || 0,
      Percentage: '',
    },
    {
      Category: 'Medium Confidence',
      Count: evaluationData.detailedResults?.filter((r) => r.confidence === 'medium').length || 0,
      Percentage: '',
    },
    {
      Category: 'Low Confidence',
      Count: evaluationData.detailedResults?.filter((r) => r.confidence === 'low').length || 0,
      Percentage: '',
    },
  ];
  formatter.addSheet('Statistics', statsData, [{ wch: 20 }, { wch: 10 }, { wch: 15 }]);

  // Generate filename
  const filename = evaluationData.rollNumber
    ? `Evaluation_${evaluationData.rollNumber}_${evaluationData.subjectCode || 'Unknown'}_${
        new Date().toISOString().split('T')[0]
      }.xlsx`
    : `Evaluation_${new Date().toISOString().split('T')[0]}.xlsx`;

  formatter.generateFile(filename);
  return filename;
};

export const formatBatchExport = (
  settings: ExportSettings,
  items: Array<{
    fileName: string;
    status: string;
    rollNumber?: string;
    subjectCode?: string;
    score?: number;
    totalQuestions?: number;
    accuracy?: number;
    error?: string;
  }>,
  answerKey?: string[]
): string => {
  const formatter = new ExcelFormatter(settings);
  const completedItems = items.filter((item) => item.status === 'completed');
  const errorCount = items.filter((item) => item.status === 'error').length;

  // Batch Summary Sheet
  const summaryData = [
    { Metric: 'Batch Date', Value: new Date().toLocaleString() },
    { Metric: 'Total Sheets Processed', Value: items.length },
    { Metric: 'Successful', Value: completedItems.length },
    { Metric: 'Failed', Value: errorCount },
    { Metric: '', Value: '' },
    {
      Metric: 'Average Score',
      Value:
        completedItems.length > 0
          ? `${(
              completedItems.reduce((sum, item) => sum + (item.score || 0), 0) / completedItems.length
            ).toFixed(2)}/${completedItems[0]?.totalQuestions || 'N/A'}`
          : 'N/A',
    },
    {
      Metric: 'Average Accuracy',
      Value:
        completedItems.length > 0
          ? `${(
              completedItems.reduce((sum, item) => sum + (item.accuracy || 0), 0) / completedItems.length
            ).toFixed(2)}%`
          : 'N/A',
    },
    {
      Metric: 'Unique Students',
      Value: new Set(completedItems.map((item) => item.rollNumber).filter(Boolean)).size,
    },
    {
      Metric: 'Unique Subjects',
      Value: new Set(completedItems.map((item) => item.subjectCode).filter(Boolean)).size,
    },
  ];
  formatter.addSheet('Batch Summary', summaryData, [{ wch: 25 }, { wch: 30 }]);

  // All Results Sheet
  const allResultsData = completedItems.map((item) => ({
    'File Name': item.fileName,
    'Roll Number': item.rollNumber || 'N/A',
    'Subject Code': item.subjectCode || 'N/A',
    Score: item.score || 0,
    Total: item.totalQuestions || 0,
    'Accuracy %': item.accuracy ? Number(item.accuracy).toFixed(2) : 'N/A',
  }));
  formatter.addSheet('All Results', allResultsData, [
    { wch: 30 },
    { wch: 15 },
    { wch: 15 },
    { wch: 8 },
    { wch: 8 },
    { wch: 12 },
  ]);

  // Subject-wise Sheets
  const groupedBySubject: { [key: string]: any[] } = {};
  completedItems.forEach((item) => {
    const subjectCode = item.subjectCode || 'NO_SUBJECT';
    if (!groupedBySubject[subjectCode]) {
      groupedBySubject[subjectCode] = [];
    }
    groupedBySubject[subjectCode].push(item);
  });

  Object.keys(groupedBySubject)
    .sort()
    .forEach((subjectCode) => {
      const sheetData = groupedBySubject[subjectCode].map((item) => ({
        'REGD NO': item.rollNumber || 'N/A',
        'File Name': item.fileName,
        Score: `${item.score}/${item.totalQuestions}`,
        Accuracy: `${item.accuracy?.toFixed(1)}%`,
      }));
      formatter.addSheet(subjectCode.substring(0, 31), sheetData, [
        { wch: 15 },
        { wch: 30 },
        { wch: 10 },
        { wch: 10 },
      ]);
    });

  // Answer Key Sheet
  if (answerKey && answerKey.length > 0) {
    const answerKeyData: any[] = [{ Info: 'Answer Key Used' }];
    const keyRow: any = {};
    answerKey.forEach((ans, idx) => {
      keyRow[`Q${idx + 1}`] = ans;
    });
    answerKeyData.push(keyRow);

    const akColWidths = [{ wch: 15 }];
    for (let i = 0; i < answerKey.length; i++) {
      akColWidths.push({ wch: 5 });
    }
    formatter.addSheet('Answer Key', answerKeyData, akColWidths);
  }

  // Failed Sheets Log
  if (errorCount > 0) {
    const failedItems = items.filter((item) => item.status === 'error');
    const failedData = failedItems.map((item) => ({
      'File Name': item.fileName,
      Error: item.error || 'Unknown error',
    }));
    formatter.addSheet('Failed Sheets', failedData, [{ wch: 30 }, { wch: 50 }]);
  }

  // Generate filename
  const fileName = `Batch_Results_${new Date().toISOString().split('T')[0]}_${
    completedItems.length
  }students.xlsx`;
  formatter.generateFile(fileName);
  return fileName;
};
