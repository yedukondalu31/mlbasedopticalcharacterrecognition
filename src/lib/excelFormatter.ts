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
    const formattedData = this.addHeaderInfo(data, sheetName);
    const ws = this.wb.addWorksheet(sheetName.substring(0, 31));

    if (formattedData.length === 0) return;

    // Get headers from first data row
    const headers = Object.keys(formattedData[0]);
    
    // Add header row
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
    formattedData.forEach((row) => {
      const values = headers.map((header) => row[header]);
      ws.addRow(values);
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
      
      // Merge footer cells
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
    const answerKeyData: any[] = [];
    const keyRow: any = { Info: 'Answer Key Used' };
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

    const scoreDistData: any[] = [];

    Object.entries(scoreRanges).forEach(([range, count]) => {
      const percentage = (count / completedItems.length) * 100;
      scoreDistData.push({
        Range: range,
        Count: count,
        Percentage: `${percentage.toFixed(1)}%`,
        Visual: '█'.repeat(Math.floor(percentage / 2)),
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
  await formatter.generateFile(fileName);
  return fileName;
};
