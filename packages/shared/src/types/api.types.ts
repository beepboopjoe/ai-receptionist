// ============================================================
// API Request / Response shapes shared between API and Dashboard
// ============================================================

// Generic paginated response wrapper
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// Generic API error shape
export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
}

// Auth
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    tenantId: string;
  };
}

// Onboarding
export interface OnboardingStatus {
  currentStep: number;
  steps: {
    step: number;
    label: string;
    completed: boolean;
  }[];
  isActive: boolean;
}

// Dashboard stats
export interface DashboardStats {
  today: {
    callsTotal: number;
    callsHandledByAi: number;
    callsEscalated: number;
    callsMissed: number;
    appointmentsBooked: number;
    appointmentsCancelled: number;
    appointmentsRescheduled: number;
  };
  upcoming7Days: number;
  openEscalations: number;
  urgentEscalations: number;
}

// CSV Import
export interface CsvImportStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total: number;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
}
