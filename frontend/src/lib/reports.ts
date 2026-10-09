import { apiDelete, apiGet, apiUpload } from '@/lib/api';

export type ReportCategory =
  | 'MEDICAL_REPORT'
  | 'LAB_RESULT'
  | 'PRESCRIPTION'
  | 'IMAGING'
  | 'DISCHARGE_SUMMARY'
  | 'OTHER';

export type ReportFile = {
  id: string;
  patientId: string;
  recordId: string | null;
  uploadedById: string;
  category: ReportCategory;
  title: string | null;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  isDemo: boolean;
  createdAt: string;
};

export type ReportDownload = {
  url: string;
  expiresInSeconds: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

export const REPORT_CATEGORIES: { value: ReportCategory; label: string }[] = [
  { value: 'MEDICAL_REPORT', label: 'Medical report' },
  { value: 'LAB_RESULT', label: 'Lab result' },
  { value: 'PRESCRIPTION', label: 'Prescription' },
  { value: 'IMAGING', label: 'Imaging' },
  { value: 'DISCHARGE_SUMMARY', label: 'Discharge summary' },
  { value: 'OTHER', label: 'Other' },
];

export const REPORT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp';

export function reportCategoryLabel(category: string): string {
  return REPORT_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  const digits = i === 0 ? 0 : value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[i]}`;
}

export function listReports(patientId?: string) {
  const qs = patientId ? `?patientId=${encodeURIComponent(patientId)}` : '';
  return apiGet<{ items: ReportFile[] }>(`/reports${qs}`);
}

export function getReportDownload(id: string) {
  return apiGet<ReportDownload>(`/reports/${id}/download`);
}

export function deleteReport(id: string) {
  return apiDelete<{ deleted: boolean; id: string }>(`/reports/${id}`);
}

export function uploadReport(input: {
  patientId: string;
  file: File;
  category: ReportCategory;
  title?: string;
  recordId?: string;
}) {
  const form = new FormData();
  form.append('patientId', input.patientId);
  form.append('file', input.file);
  form.append('category', input.category);
  if (input.title) form.append('title', input.title);
  if (input.recordId) form.append('recordId', input.recordId);
  return apiUpload<ReportFile>('/reports', form);
}
