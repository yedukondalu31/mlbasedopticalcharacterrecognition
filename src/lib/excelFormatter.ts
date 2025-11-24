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

  // Answer Distribution Analysis (for batch exports)
  const answerDistribution: { [key: string]: number } = {};
  evaluationData.correctAnswers.forEach((answer) => {
    answerDistribution[answer] = (answerDistribution[answer] || 0) + 1;
  });

  const distributionData = [
    { '': 'Answer Key Distribution', ' ': '', '  ': '' },
    { '': '', ' ': '', '  ': '' },
    { '': 'Option', ' ': 'Frequency', '  ': 'Chart' },
  ];

  ['A', 'B', 'C', 'D', 'E'].forEach((option) => {
    const count = answerDistribution[option] || 0;
    const percentage = (count / evaluationData.totalQuestions) * 100;
    distributionData.push({
      '': option,
      ' ': String(count),
      '  ': '█'.repeat(Math.floor(percentage / 2)),
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

  const commonMistakesData = [
    { Metric: 'Total Wrong Answers', Value: mistakes.length, Percentage: '' },
    { Metric: 'Most Common Errors', Value: '', Percentage: '' },
    { Metric: '', Value: '', Percentage: '' },
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
    commonMistakesData.push({ Metric: '', Value: '', Percentage: '' });
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
  const unknownConfCount = evaluationData.totalQuestions - highConfCount - mediumConfCount - lowConfCount;

  const confDistributionData = [
    { '': 'Confidence Distribution Chart', ' ': '', '  ': '', '   ': '' },
    { '': '', ' ': '', '  ': '', '   ': '' },
    {
      '': 'High',
      ' ': highConfCount,
      '  ': `${((highConfCount / evaluationData.totalQuestions) * 100).toFixed(1)}%`,
      '   ': '█'.repeat(Math.floor((highConfCount / evaluationData.totalQuestions) * 50)),
    },
    {
      '': 'Medium',
      ' ': mediumConfCount,
      '  ': `${((mediumConfCount / evaluationData.totalQuestions) * 100).toFixed(1)}%`,
      '   ': '█'.repeat(Math.floor((mediumConfCount / evaluationData.totalQuestions) * 50)),
    },
    {
      '': 'Low',
      ' ': lowConfCount,
      '  ': `${((lowConfCount / evaluationData.totalQuestions) * 100).toFixed(1)}%`,
      '   ': '█'.repeat(Math.floor((lowConfCount / evaluationData.totalQuestions) * 50)),
    },
    ...(unknownConfCount > 0
      ? [
          {
            '': 'Unknown',
            ' ': unknownConfCount,
            '  ': `${((unknownConfCount / evaluationData.totalQuestions) * 100).toFixed(1)}%`,
            '   ': '█'.repeat(Math.floor((unknownConfCount / evaluationData.totalQuestions) * 50)),
          },
        ]
      : []),
    { '': '', ' ': '', '  ': '', '   ': '' },
    { '': 'Confidence vs Accuracy', ' ': '', '  ': '', '   ': '' },
    { '': '', ' ': '', '  ': '', '   ': '' },
  ];

  // Confidence vs Accuracy Analysis
  const highConfCorrect = evaluationData.detailedResults?.filter(
    (r) => r.confidence === 'high' && r.isCorrect
  ).length || 0;
  const mediumConfCorrect = evaluationData.detailedResults?.filter(
    (r) => r.confidence === 'medium' && r.isCorrect
  ).length || 0;
  const lowConfCorrect = evaluationData.detailedResults?.filter(
    (r) => r.confidence === 'low' && r.isCorrect
  ).length || 0;

  confDistributionData.push(
    {
      '': 'Confidence Level',
      ' ': 'Total',
      '  ': 'Correct',
      '   ': 'Accuracy',
    },
    {
      '': 'High',
      ' ': String(highConfCount),
      '  ': String(highConfCorrect),
      '   ': highConfCount > 0 ? `${((highConfCorrect / highConfCount) * 100).toFixed(1)}%` : 'N/A',
    },
    {
      '': 'Medium',
      ' ': String(mediumConfCount),
      '  ': String(mediumConfCorrect),
      '   ': mediumConfCount > 0 ? `${((mediumConfCorrect / mediumConfCount) * 100).toFixed(1)}%` : 'N/A',
    },
    {
      '': 'Low',
      ' ': String(lowConfCount),
      '  ': String(lowConfCorrect),
      '   ': lowConfCount > 0 ? `${((lowConfCorrect / lowConfCount) * 100).toFixed(1)}%` : 'N/A',
    }
  );

  formatter.addSheet('Confidence Analysis', confDistributionData, [
    { wch: 20 },
    { wch: 10 },
    { wch: 12 },
    { wch: 50 },
  ]);

  // Performance Insights
  const avgAccuracy = evaluationData.accuracy;
  const performanceLevel =
    avgAccuracy >= 90 ? 'Excellent' : avgAccuracy >= 75 ? 'Good' : avgAccuracy >= 60 ? 'Average' : avgAccuracy >= 50 ? 'Below Average' : 'Poor';

  const insightsData = [
    { Insight: 'Overall Performance', Value: performanceLevel, Recommendation: '' },
    {
      Insight: 'Score',
      Value: `${evaluationData.score}/${evaluationData.totalQuestions}`,
      Recommendation: '',
    },
    { Insight: 'Accuracy', Value: `${avgAccuracy.toFixed(2)}%`, Recommendation: '' },
    { Insight: '', Value: '', Recommendation: '' },
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
    { Insight: '', Value: '', Recommendation: '' },
    { Insight: 'Areas for Improvement', Value: '', Recommendation: '' },
  ];

  if (mistakes.length > 0) {
    const firstMistake = mistakes[0];
    insightsData.push({
      Insight: `Most errors`,
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

  // Batch Performance Analytics
  if (completedItems.length > 0) {
    const batchAnalyticsData = [
      { Metric: 'Batch Performance Overview', Value: '', Details: '' },
      { Metric: '', Value: '', Details: '' },
      {
        Metric: 'Highest Score',
        Value: Math.max(...completedItems.map((i) => i.score || 0)),
        Details: completedItems.find((i) => i.score === Math.max(...completedItems.map((x) => x.score || 0)))
          ?.rollNumber || 'N/A',
      },
      {
        Metric: 'Lowest Score',
        Value: Math.min(...completedItems.map((i) => i.score || 0)),
        Details: completedItems.find((i) => i.score === Math.min(...completedItems.map((x) => x.score || 0)))
          ?.rollNumber || 'N/A',
      },
      {
        Metric: 'Median Score',
        Value: completedItems.length > 0
          ? completedItems.map((i) => i.score || 0).sort((a, b) => a - b)[Math.floor(completedItems.length / 2)]
          : 0,
        Details: '',
      },
      { Metric: '', Value: '', Details: '' },
      {
        Metric: 'Students >= 90%',
        Value: completedItems.filter((i) => (i.accuracy || 0) >= 90).length,
        Details: `${((completedItems.filter((i) => (i.accuracy || 0) >= 90).length / completedItems.length) * 100).toFixed(1)}%`,
      },
      {
        Metric: 'Students >= 75%',
        Value: completedItems.filter((i) => (i.accuracy || 0) >= 75).length,
        Details: `${((completedItems.filter((i) => (i.accuracy || 0) >= 75).length / completedItems.length) * 100).toFixed(1)}%`,
      },
      {
        Metric: 'Students >= 60%',
        Value: completedItems.filter((i) => (i.accuracy || 0) >= 60).length,
        Details: `${((completedItems.filter((i) => (i.accuracy || 0) >= 60).length / completedItems.length) * 100).toFixed(1)}%`,
      },
      {
        Metric: 'Students < 60%',
        Value: completedItems.filter((i) => (i.accuracy || 0) < 60).length,
        Details: `${((completedItems.filter((i) => (i.accuracy || 0) < 60).length / completedItems.length) * 100).toFixed(1)}%`,
      },
    ];

    formatter.addSheet('Batch Analytics', batchAnalyticsData, [{ wch: 25 }, { wch: 15 }, { wch: 30 }]);

    // Score Distribution Chart
    const scoreRanges = {
      '90-100%': completedItems.filter((i) => (i.accuracy || 0) >= 90).length,
      '75-89%': completedItems.filter((i) => (i.accuracy || 0) >= 75 && (i.accuracy || 0) < 90).length,
      '60-74%': completedItems.filter((i) => (i.accuracy || 0) >= 60 && (i.accuracy || 0) < 75).length,
      '50-59%': completedItems.filter((i) => (i.accuracy || 0) >= 50 && (i.accuracy || 0) < 60).length,
      'Below 50%': completedItems.filter((i) => (i.accuracy || 0) < 50).length,
    };

    const scoreDistData = [
      { '': 'Score Distribution', ' ': '', '  ': '', '   ': '' },
      { '': '', ' ': '', '  ': '', '   ': '' },
      { '': 'Range', ' ': 'Count', '  ': 'Percentage', '   ': 'Visual' },
    ];

    Object.entries(scoreRanges).forEach(([range, count]) => {
      const percentage = (count / completedItems.length) * 100;
      scoreDistData.push({
        '': range,
        ' ': String(count),
        '  ': `${percentage.toFixed(1)}%`,
        '   ': '█'.repeat(Math.floor(percentage / 2)),
      });
    });

    formatter.addSheet('Score Distribution', scoreDistData, [
      { wch: 15 },
      { wch: 10 },
      { wch: 12 },
      { wch: 50 },
    ]);
  }

  // Generate filename
  const fileName = `Batch_Results_${new Date().toISOString().split('T')[0]}_${
    completedItems.length
  }students.xlsx`;
  formatter.generateFile(fileName);
  return fileName;
};
