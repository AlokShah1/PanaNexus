export type VerificationRequest = {
  id: string;
  kind: string;
  status: string;
  reason: string | null;
  payload: Record<string, unknown> | null;
  documentUrls: string[];
  createdAt: string;
  reviewedAt: string | null;
};

export type VerificationMe = {
  verificationStatus: 'VERIFIED' | 'PENDING' | 'REJECTED' | 'SUSPENDED';
  role: string;
  request: VerificationRequest | null;
};
