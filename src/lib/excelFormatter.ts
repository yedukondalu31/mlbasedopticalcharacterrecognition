import ExcelJS from 'exceljs';
import { ExportSettings } from '@/hooks/useExportSettings';

export class ExcelFormatter {
  private wb: ExcelJS.Workbook;
  private settings: ExportSettings;

  constructor(settings: ExportSettings) {
    this.wb = new ExcelJS.Workbook();
    this.settings = settings;
  }

  private hexToArgb(hex: string): string {
    hex = hex.replace('#', '');
    return 'FF' + hex.toUpperCase();
  }

  private addHeaderInfo(sheetData: any[], sheetName: string): any[] {
    if (!this.settings.includeHeader) return sheetData;

    const headerRows: any[] = [];

    if (this.settings.schoolName) {
      headerRows.push({ '': this.settings.schoolName });
      headerRows.push({ '': '' });
    }

    headerRows.push({ '': sheetName });
    headerRows.push({ '': `Generated: ${new Date().toLocaleString()}` });
    headerRows.push({ '': '' });

    return [...headerRows, ...sheetData];
  }

  addSheet(
    sheetName: string,
    data: any[],
    columnWidths?: { wch: number }[],
    includeHeader: boolean = true
  ) {
    const safeName = sheetName.replace(/[\/\\?*\[\]]/g, '_').substring(0, 31);
    const ws = this.wb.addWorksheet(safeName);

    if (data.length === 0) return;

    // Add school header info rows BEFORE the table
    let headerRowsAdded = 0;
    if (this.settings.includeHeader) {
      if (this.settings.schoolName) {
        const r = ws.addRow([this.settings.schoolName]);
        r.getCell(1).font = { name: this.settings.fontFamily, size: 14, bold: true };
        headerRowsAdded++;
        ws.addRow([]);
        headerRowsAdded++;
      }
      const r2 = ws.addRow([sheetName]);
      r2.getCell(1).font = { name: this.settings.fontFamily, size: 11, italic: true };
      headerRowsAdded++;
      const r3 = ws.addRow([`Generated: ${new Date().toLocaleString()}`]);
      r3.getCell(1).font = { name: this.settings.fontFamily, size: 9, color: { argb: 'FF666666' } };
      headerRowsAdded++;
      ws.addRow([]);
      headerRowsAdded++;
    }

    // Get headers from ACTUAL data (not prepended header rows)
    const headers = Object.keys(data[0]);
    
    // Add column header row
    const headerRow = ws.addRow(headers);
    
    // Style header row
    const headerColor = this.hexToArgb(this.settings.headerColor);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: headerColor },
      };
      cell.font = {
        name: this.settings.fontFamily,
        size: 12,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
      };
    });

    // Add data rows
    data.forEach((row) => {
      const values = headers.map((header) => row[header]);
      const dataRow = ws.addRow(values);
      dataRow.eachCell((cell) => {
        cell.font = { name: this.settings.fontFamily, size: 11 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        };
      });
    });

    // Set column widths
    if (columnWidths) {
      columnWidths.forEach((width, index) => {
        const col = ws.getColumn(index + 1);
        col.width = width.wch;
      });
    }

    // Add footer if configured
    if (this.settings.footerText) {
      ws.addRow([]);
      const footerRow = ws.addRow([this.settings.footerText]);
      const footerCell = footerRow.getCell(1);
      footerCell.font = {
        name: this.settings.fontFamily,
        size: 9,
        italic: true,
        color: { argb: 'FF666666' },
      };
      footerCell.alignment = { horizontal: 'center' };
      
      if (headers.length > 1) {
        ws.mergeCells(footerRow.number, 1, footerRow.number, headers.length);
      }
    }
  }

  async generateFile(filename: string) {
    const buffer = await this.wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  getWorkbook(): ExcelJS.Workbook {
    return this.wb;
  }
}

export const formatEvaluationExport = async (
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
): Promise<string> => {
  const formatter = new ExcelFormatter(settings);

  // Summary Sheet
  const summaryData = [
    { Field: 'Roll No', Value: evaluationData.rollNumber || 'Not Detected' },
    { Field: 'Subject Code', Value: evaluationData.subjectCode || 'Not Detected' },
    { Field: 'Date & Time', Value: new Date().toLocaleString() },
    {
      Field: 'Grid Configuration',
      Value: evaluationData.gridConfig
        ? `${evaluationData.gridConfig.rows}×${evaluationData.gridConfig.columns}`
        : 'Sequential',
    },
    { Field: '', Value: '' },
    { Field: 'Correct Questions Count', Value: evaluationData.score },
    { Field: 'Marks in Numbers', Value: `${evaluationData.score}/${evaluationData.totalQuestions}` },
    { Field: 'Percentage of Score', Value: `${evaluationData.accuracy.toFixed(2)}%` },
    { Field: 'Confidence', Value: evaluationData.confidence?.toUpperCase() || 'N/A' },
    { Field: 'Image Quality', Value: evaluationData.imageQuality?.toUpperCase() || 'N/A' },
    { Field: 'Low Confidence Answers', Value: evaluationData.lowConfidenceCount || 0 },
  ];
  formatter.addSheet('Summary', summaryData, [{ wch: 25 }, { wch: 30 }]);

  // Detailed Answers Sheet
  const answersData = evaluationData.extractedAnswers.map((extracted, index) => {
    const isUnattempted = extracted === 'UNATTEMPTED' || !extracted || extracted === '?';
    const isCorrect = !isUnattempted && extracted === evaluationData.correctAnswers[index];
    
    return {
      Question: index + 1,
      Extracted: extracted,
      Correct: evaluationData.correctAnswers[index],
      Result: isUnattempted ? '○ Unattempted' : (isCorrect ? '✓ Correct' : '✗ Wrong'),
      Confidence: evaluationData.detailedResults?.[index]?.confidence?.toUpperCase() || 'UNKNOWN',
      Notes: evaluationData.detailedResults?.[index]?.note || '-',
    };
  });
  formatter.addSheet('Detailed Answers', answersData, [
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 40 },
  ]);

  // Statistics Sheet
  const unattemptedCount = evaluationData.extractedAnswers.filter(
    (ans) => ans === 'UNATTEMPTED' || !ans || ans === '?'
  ).length;
  const correctCount = evaluationData.extractedAnswers.filter(
    (ans, idx) => ans && ans !== 'UNATTEMPTED' && ans !== '?' && ans === evaluationData.correctAnswers[idx]
  ).length;
  const wrongCount = evaluationData.totalQuestions - correctCount - unattemptedCount;
  const attemptedQuestions = evaluationData.totalQuestions - unattemptedCount;
  
  const statsData = [
    {
      Category: 'Total Questions',
      Count: evaluationData.totalQuestions,
      Percentage: '100%',
    },
    {
      Category: 'Attempted',
      Count: attemptedQuestions,
      Percentage: `${((attemptedQuestions / evaluationData.totalQuestions) * 100).toFixed(2)}%`,
    },
    {
      Category: 'Unattempted',
      Count: unattemptedCount,
      Percentage: `${((unattemptedCount / evaluationData.totalQuestions) * 100).toFixed(2)}%`,
    },
    { Category: '', Count: '', Percentage: '' },
    {
      Category: 'Correct Answers',
      Count: correctCount,
      Percentage: attemptedQuestions > 0 ? `${((correctCount / attemptedQuestions) * 100).toFixed(2)}%` : 'N/A',
    },
    {
      Category: 'Wrong Answers',
      Count: wrongCount,
      Percentage: attemptedQuestions > 0 ? `${((wrongCount / attemptedQuestions) * 100).toFixed(2)}%` : 'N/A',
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

  // Answer Distribution Analysis
  const answerDistribution: { [key: string]: number } = {};
  evaluationData.correctAnswers.forEach((answer) => {
    answerDistribution[answer] = (answerDistribution[answer] || 0) + 1;
  });

  const distributionData: any[] = [];
  ['A', 'B', 'C', 'D', 'E'].forEach((option) => {
    const count = answerDistribution[option] || 0;
    const percentage = (count / evaluationData.totalQuestions) * 100;
    distributionData.push({
      Option: option,
      Frequency: count,
      Chart: '█'.repeat(Math.floor(percentage / 2)),
    });
  });

  formatter.addSheet('Answer Distribution', distributionData, [{ wch: 15 }, { wch: 12 }, { wch: 50 }]);

  // Question-wise Performance Analysis
  const performanceData = evaluationData.extractedAnswers.map((extracted, index) => {
    const isUnattempted = extracted === 'UNATTEMPTED' || !extracted || extracted === '?';
    const isCorrect = !isUnattempted && extracted === evaluationData.correctAnswers[index];
    const confidence = evaluationData.detailedResults?.[index]?.confidence || 'unknown';
    
    return {
      'Q#': index + 1,
      'Student Answer': extracted,
      'Correct Answer': evaluationData.correctAnswers[index],
      'Status': isUnattempted ? 'Unattempted' : (isCorrect ? 'Correct' : 'Wrong'),
      'Confidence': confidence.toUpperCase(),
      'Confidence Bar': confidence === 'high' ? '████████████' : confidence === 'medium' ? '████████░░░░' : confidence === 'low' ? '████░░░░░░░░' : '░░░░░░░░░░░░',
      'Notes': evaluationData.detailedResults?.[index]?.note || '-',
    };
  });
  formatter.addSheet('Question Analysis', performanceData, [
    { wch: 5 },
    { wch: 15 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
    { wch: 40 },
  ]);

  // Common Mistakes Analysis
  const mistakes = evaluationData.extractedAnswers
    .map((extracted, idx) => ({
      question: idx + 1,
      extracted,
      correct: evaluationData.correctAnswers[idx],
      isWrong: extracted && extracted !== 'UNATTEMPTED' && extracted !== '?' && extracted !== evaluationData.correctAnswers[idx],
    }))
    .filter((item) => item.isWrong);

  const mistakePatterns: { [key: string]: number } = {};
  mistakes.forEach((mistake) => {
    const pattern = `${mistake.extracted} instead of ${mistake.correct}`;
    mistakePatterns[pattern] = (mistakePatterns[pattern] || 0) + 1;
  });

  const commonMistakesData: any[] = [
    { Metric: 'Total Wrong Answers', Value: mistakes.length, Percentage: '' },
  ];

  Object.entries(mistakePatterns)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .forEach(([pattern, count], index) => {
      commonMistakesData.push({
        Metric: `#${index + 1}: ${pattern}`,
        Value: count,
        Percentage: `${((count / mistakes.length) * 100).toFixed(1)}%`,
      });
    });

  if (mistakes.length > 0) {
    commonMistakesData.push({
      Metric: 'Wrong Questions',
      Value: mistakes.map((m) => `Q${m.question}`).join(', '),
      Percentage: '',
    });
  }

  formatter.addSheet('Common Mistakes', commonMistakesData, [{ wch: 30 }, { wch: 10 }, { wch: 12 }]);

  // Confidence Distribution Analysis
  const highConfCount = evaluationData.detailedResults?.filter((r) => r.confidence === 'high').length || 0;
  const mediumConfCount = evaluationData.detailedResults?.filter((r) => r.confidence === 'medium').length || 0;
  const lowConfCount = evaluationData.detailedResults?.filter((r) => r.confidence === 'low').length || 0;

  const highConfCorrect = evaluationData.detailedResults?.filter(
    (r) => r.confidence === 'high' && r.isCorrect
  ).length || 0;
  const mediumConfCorrect = evaluationData.detailedResults?.filter(
    (r) => r.confidence === 'medium' && r.isCorrect
  ).length || 0;
  const lowConfCorrect = evaluationData.detailedResults?.filter(
    (r) => r.confidence === 'low' && r.isCorrect
  ).length || 0;

  const confDistributionData = [
    {
      'Confidence Level': 'High',
      'Total': highConfCount,
      'Correct': highConfCorrect,
      'Accuracy': highConfCount > 0 ? `${((highConfCorrect / highConfCount) * 100).toFixed(1)}%` : 'N/A',
    },
    {
      'Confidence Level': 'Medium',
      'Total': mediumConfCount,
      'Correct': mediumConfCorrect,
      'Accuracy': mediumConfCount > 0 ? `${((mediumConfCorrect / mediumConfCount) * 100).toFixed(1)}%` : 'N/A',
    },
    {
      'Confidence Level': 'Low',
      'Total': lowConfCount,
      'Correct': lowConfCorrect,
      'Accuracy': lowConfCount > 0 ? `${((lowConfCorrect / lowConfCount) * 100).toFixed(1)}%` : 'N/A',
    },
  ];

  formatter.addSheet('Confidence Analysis', confDistributionData, [
    { wch: 20 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
  ]);

  // Performance Insights
  const avgAccuracy = evaluationData.accuracy;
  const performanceLevel =
    avgAccuracy >= 90 ? 'Excellent' : avgAccuracy >= 75 ? 'Good' : avgAccuracy >= 60 ? 'Average' : avgAccuracy >= 50 ? 'Below Average' : 'Poor';

  const insightsData: any[] = [
    { Insight: 'Overall Performance', Value: performanceLevel, Recommendation: '' },
    {
      Insight: 'Score',
      Value: `${evaluationData.score}/${evaluationData.totalQuestions}`,
      Recommendation: '',
    },
    { Insight: 'Accuracy', Value: `${avgAccuracy.toFixed(2)}%`, Recommendation: '' },
    {
      Insight: 'Attempted Questions',
      Value: attemptedQuestions,
      Recommendation:
        unattemptedCount > 0
          ? `${unattemptedCount} questions left unattempted. Recommend practicing time management.`
          : 'All questions attempted.',
    },
    {
      Insight: 'Confidence Level',
      Value: evaluationData.confidence?.toUpperCase() || 'UNKNOWN',
      Recommendation:
        lowConfCount > 5
          ? 'High number of low-confidence answers. Review fundamentals.'
          : 'Good confidence overall.',
    },
    {
      Insight: 'Image Quality',
      Value: evaluationData.imageQuality?.toUpperCase() || 'UNKNOWN',
      Recommendation:
        evaluationData.imageQuality === 'poor'
          ? 'Poor image quality detected. Use better lighting and avoid shadows.'
          : evaluationData.imageQuality === 'fair'
            ? 'Image quality is fair. Ensure sheets are flat and well-lit for best results.'
            : 'Good image quality.',
    },
  ];

  if (mistakes.length > 0) {
    insightsData.push({
      Insight: 'Most errors',
      Value: mistakes.length,
      Recommendation: `Review questions: ${mistakes.slice(0, 5).map((m) => m.question).join(', ')}${mistakes.length > 5 ? '...' : ''}`,
    });
  }

  if (lowConfCount > 0) {
    const lowConfQuestions = evaluationData.detailedResults
      ?.filter((r) => r.confidence === 'low')
      .slice(0, 5)
      .map((r) => r.question) || [];
    insightsData.push({
      Insight: 'Low Confidence Areas',
      Value: lowConfCount,
      Recommendation: `Focus on questions: ${lowConfQuestions.join(', ')}${lowConfCount > 5 ? '...' : ''}`,
    });
  }

  formatter.addSheet('Performance Insights', insightsData, [{ wch: 25 }, { wch: 20 }, { wch: 60 }]);

  // Generate filename
  const filename = evaluationData.rollNumber
    ? `Evaluation_${evaluationData.rollNumber}_${evaluationData.subjectCode || 'Unknown'}_${
        new Date().toISOString().split('T')[0]
      }.xlsx`
    : `Evaluation_${new Date().toISOString().split('T')[0]}.xlsx`;

  await formatter.generateFile(filename);
  return filename;
};

export const formatBatchExport = async (
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
): Promise<string> => {
  const formatter = new ExcelFormatter(settings);
  const wb = formatter.getWorkbook();
  const completedItems = items.filter((item) => item.status === 'completed');
  const errorItems = items.filter((item) => item.status === 'error');

  // ===== SINGLE CONSOLIDATED SHEET =====
  const ws = wb.addWorksheet('Results');

  let currentRow = 1;
  const maxCols = 7;

  const addMergedTitle = (text: string, bgColor: string, fontColor = 'FFFFFFFF', fontSize = 14) => {
    const row = ws.getRow(currentRow);
    row.getCell(1).value = text;
    row.getCell(1).font = { name: settings.fontFamily, size: fontSize, bold: true, color: { argb: fontColor } };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.mergeCells(currentRow, 1, currentRow, maxCols);
    row.height = fontSize === 14 ? 28 : 22;
    currentRow++;
  };

  const addKeyValue = (key: string, value: any) => {
    const row = ws.getRow(currentRow);
    row.getCell(1).value = key;
    row.getCell(1).font = { name: settings.fontFamily, size: 11, bold: true };
    row.getCell(2).value = value;
    row.getCell(2).font = { name: settings.fontFamily, size: 11 };
    currentRow++;
  };

  const addTableHeaders = (headers: string[], widths?: number[]) => {
    const headerColor = formatter['hexToArgb'](settings.headerColor);
    const row = ws.getRow(currentRow);
    headers.forEach((h, i) => {
      const cell = row.getCell(i + 1);
      cell.value = h;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } };
      cell.font = { name: settings.fontFamily, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
      };
    });
    currentRow++;
  };

  const addDataRow = (values: any[]) => {
    const row = ws.getRow(currentRow);
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.font = { name: settings.fontFamily, size: 11 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      };
    });
    currentRow++;
  };

  const addBlankRow = () => { currentRow++; };

  // Set column widths
  [18, 18, 25, 20, 18, 15, 30].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // ── SECTION 1: School Header ──
  if (settings.includeHeader && settings.schoolName) {
    addMergedTitle(settings.schoolName, formatter['hexToArgb'](settings.headerColor), 'FFFFFFFF', 16);
  }
  addMergedTitle('Batch Evaluation Report', 'FF2D3748', 'FFFFFFFF', 14);
  addMergedTitle(`Generated: ${new Date().toLocaleString()}`, 'FFF7FAFC', 'FF4A5568', 10);
  addBlankRow();

  // ── SECTION 2: Batch Summary ──
  addMergedTitle('📊 BATCH SUMMARY', 'FF3182CE', 'FFFFFFFF', 12);
  addKeyValue('Total Sheets Processed', items.length);
  addKeyValue('Successful', completedItems.length);
  addKeyValue('Failed', errorItems.length);
  
  if (completedItems.length > 0) {
    const avgScore = completedItems.reduce((s, i) => s + (i.score || 0), 0) / completedItems.length;
    const avgAccuracy = completedItems.reduce((s, i) => s + (i.accuracy || 0), 0) / completedItems.length;
    const highestScore = Math.max(...completedItems.map(i => i.score || 0));
    const lowestScore = Math.min(...completedItems.map(i => i.score || 0));
    const totalQ = completedItems[0]?.totalQuestions || 0;
    const sortedScores = completedItems.map(i => i.score || 0).sort((a, b) => a - b);
    const medianScore = sortedScores[Math.floor(sortedScores.length / 2)];
    
    addKeyValue('Average Score', `${avgScore.toFixed(2)}/${totalQ}`);
    addKeyValue('Average Accuracy', `${avgAccuracy.toFixed(2)}%`);
    addKeyValue('Highest Score', `${highestScore}/${totalQ}`);
    addKeyValue('Lowest Score', `${lowestScore}/${totalQ}`);
    addKeyValue('Median Score', `${medianScore}/${totalQ}`);
    addKeyValue('Unique Students', new Set(completedItems.map(i => i.rollNumber).filter(Boolean)).size);
    addKeyValue('Unique Subjects', new Set(completedItems.map(i => i.subjectCode).filter(Boolean)).size);
  }
  addBlankRow();

  // ── SECTION 3: All Student Results ──
  addMergedTitle('📋 ALL STUDENT RESULTS', 'FF38A169', 'FFFFFFFF', 12);
  addTableHeaders(['Roll No', 'Subject Code', 'Total Questions', 'Correct Count', 'Percentage of Score', 'Marks in Numbers', 'Status']);
  
  completedItems.forEach((item) => {
    const accuracy = item.accuracy ?? 0;
    const status = accuracy >= 90 ? 'Excellent' : accuracy >= 75 ? 'Good' : accuracy >= 60 ? 'Average' : accuracy >= 50 ? 'Below Avg' : 'Poor';
    addDataRow([
      item.rollNumber || 'N/A',
      item.subjectCode || 'N/A',
      item.totalQuestions || 0,
      item.score || 0,
      `${accuracy.toFixed(2)}%`,
      `${item.score || 0}/${item.totalQuestions || 0}`,
      status,
    ]);
  });
  addBlankRow();

  // ── SECTION 4: Score Distribution ──
  if (completedItems.length > 0) {
    addMergedTitle('📈 SCORE DISTRIBUTION', 'FFDD6B20', 'FFFFFFFF', 12);
    addTableHeaders(['Score Range', 'Student Count', 'Percentage', 'Visual']);
    
    const ranges = [
      { label: '90-100%', filter: (a: number) => a >= 90 },
      { label: '75-89%', filter: (a: number) => a >= 75 && a < 90 },
      { label: '60-74%', filter: (a: number) => a >= 60 && a < 75 },
      { label: '50-59%', filter: (a: number) => a >= 50 && a < 60 },
      { label: 'Below 50%', filter: (a: number) => a < 50 },
    ];
    
    ranges.forEach(({ label, filter }) => {
      const count = completedItems.filter(i => filter(i.accuracy || 0)).length;
      const pct = (count / completedItems.length) * 100;
      addDataRow([label, count, `${pct.toFixed(1)}%`, '█'.repeat(Math.floor(pct / 2))]);
    });
    addBlankRow();

    // ── SECTION 5: Subject-wise Breakdown ──
    const subjects = [...new Set(completedItems.map(i => i.subjectCode).filter(Boolean))] as string[];
    if (subjects.length > 0) {
      addMergedTitle('📚 SUBJECT-WISE BREAKDOWN', 'FF805AD5', 'FFFFFFFF', 12);
      addTableHeaders(['Subject Code', 'Students', 'Avg Score', 'Avg Accuracy', 'Highest', 'Lowest', 'Pass Rate (≥60%)']);
      
      subjects.sort().forEach((subj) => {
        const subjItems = completedItems.filter(i => i.subjectCode === subj);
        const avgS = subjItems.reduce((s, i) => s + (i.score || 0), 0) / subjItems.length;
        const avgA = subjItems.reduce((s, i) => s + (i.accuracy || 0), 0) / subjItems.length;
        const hi = Math.max(...subjItems.map(i => i.score || 0));
        const lo = Math.min(...subjItems.map(i => i.score || 0));
        const totalQ = subjItems[0]?.totalQuestions || 0;
        const passRate = (subjItems.filter(i => (i.accuracy || 0) >= 60).length / subjItems.length) * 100;
        addDataRow([subj, subjItems.length, `${avgS.toFixed(1)}/${totalQ}`, `${avgA.toFixed(1)}%`, `${hi}/${totalQ}`, `${lo}/${totalQ}`, `${passRate.toFixed(1)}%`]);
      });
      addBlankRow();
    }

    // ── SECTION 6: Top & Bottom Performers ──
    const sorted = [...completedItems].sort((a, b) => (b.accuracy || 0) - (a.accuracy || 0));
    if (sorted.length >= 3) {
      addMergedTitle('🏆 TOP PERFORMERS', 'FF2F855A', 'FFFFFFFF', 12);
      addTableHeaders(['Rank', 'Roll No', 'Subject', 'Score', 'Accuracy']);
      sorted.slice(0, Math.min(5, sorted.length)).forEach((item, idx) => {
        addDataRow([idx + 1, item.rollNumber || 'N/A', item.subjectCode || 'N/A', `${item.score}/${item.totalQuestions}`, `${(item.accuracy || 0).toFixed(1)}%`]);
      });
      addBlankRow();

      addMergedTitle('⚠️ NEEDS IMPROVEMENT', 'FFC53030', 'FFFFFFFF', 12);
      addTableHeaders(['Rank', 'Roll No', 'Subject', 'Score', 'Accuracy']);
      sorted.slice(-Math.min(5, sorted.length)).reverse().forEach((item, idx) => {
        addDataRow([idx + 1, item.rollNumber || 'N/A', item.subjectCode || 'N/A', `${item.score}/${item.totalQuestions}`, `${(item.accuracy || 0).toFixed(1)}%`]);
      });
      addBlankRow();
    }
  }

  // ── SECTION 7: Answer Key ──
  if (answerKey && answerKey.length > 0) {
    addMergedTitle('🔑 ANSWER KEY', 'FF4A5568', 'FFFFFFFF', 12);
    // Show answer key in rows of 10
    for (let start = 0; start < answerKey.length; start += 7) {
      const chunk = answerKey.slice(start, start + 7);
      const labels = chunk.map((_, i) => `Q${start + i + 1}`);
      addTableHeaders(labels);
      addDataRow(chunk);
    }
    addBlankRow();
  }

  // ── SECTION 8: Failed Sheets ──
  if (errorItems.length > 0) {
    addMergedTitle('❌ FAILED SHEETS', 'FFC53030', 'FFFFFFFF', 12);
    addTableHeaders(['File Name', 'Error']);
    errorItems.forEach((item) => {
      addDataRow([item.fileName, item.error || 'Unknown error']);
    });
    addBlankRow();
  }

  // ── Footer ──
  if (settings.footerText) {
    const row = ws.getRow(currentRow);
    row.getCell(1).value = settings.footerText;
    row.getCell(1).font = { name: settings.fontFamily, size: 9, italic: true, color: { argb: 'FF666666' } };
    row.getCell(1).alignment = { horizontal: 'center' };
    ws.mergeCells(currentRow, 1, currentRow, maxCols);
  }

  // Generate file
  const fileName = `Batch_Results_${new Date().toISOString().split('T')[0]}_${completedItems.length}students.xlsx`;
  await formatter.generateFile(fileName);
  return fileName;
};
