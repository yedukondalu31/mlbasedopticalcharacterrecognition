

## Problem: "Export All to Excel" fails due to invalid sheet name characters

### Root Cause
The `handleExportAllResults` function in `ResultsDashboard.tsx` creates per-subject Excel worksheets using the `subject_code` as the sheet name (line 177). One of the evaluations in the database has `subject_code: "B2011/2/3/1/2"`, which contains `/` characters. Excel sheet names cannot contain `/ \ ? * [ ]` characters, causing ExcelJS to throw an error silently caught by the try/catch, showing "Export failed".

### Fix
1. **`src/lib/excelFormatter.ts`** — In the `addSheet` method, sanitize the sheet name by replacing invalid Excel characters (`/ \ ? * [ ]`) with safe alternatives (e.g., `_` or `-`). This ensures any subject code or sheet name with special characters won't crash the export.

2. **`src/components/ResultsDashboard.tsx`** — Apply the same sanitization when passing subject codes as sheet names at line 177, as a secondary safeguard.

### Implementation Detail
Add a helper method in `ExcelFormatter`:
```typescript
private sanitizeSheetName(name: string): string {
  return name.replace(/[\/\\?*\[\]]/g, '_').substring(0, 31);
}
```
Use it in `addSheet()` to clean the name before calling `this.wb.addWorksheet()`.

