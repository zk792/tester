
export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export enum AIProvider {
  GEMINI = 'gemini',
  DEEPSEEK = 'deepseek',
  TONGYI = 'tongyi',
  OPENAI = 'openai' // Generic support
}

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  baseUrl: string;
  modelName: string;
}

export interface ApiConfig {
  aiConfig: AIConfig; // Added AI Configuration
  baseUrl: string;
  authToken: string;
  authHeader: string; // e.g., 'Authorization' or 'x-api-key'
  globalHeaders: KeyValuePair[];
  globalQueryParams: KeyValuePair[];
  globalBodyParams: KeyValuePair[];
  documentation: string;
  importedFile?: {
    name: string;
    mimeType: string;
    data: string; // Base64 string
  };
}

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
}

export interface TestCase {
  id: string;
  title: string;
  description: string;
  method: HttpMethod;
  endpoint: string;
  headers?: Record<string, string>;
  body?: any;
  expectedStatus: number;
}

export interface GeneratedTestPlan {
  config: {
    baseUrl?: string;
    authHeader?: string;
    authToken?: string;
  };
  cases: TestCase[];
}

export interface TestResult {
  testCaseId: string;
  status: 'PASS' | 'FAIL' | 'ERROR';
  actualStatus: number;
  latencyMs: number;
  responseBody: any;
  errorMessage?: string;
  timestamp: string;
}

export interface TestSuiteStats {
  total: number;
  passed: number;
  failed: number;
  errors: number;
  avgLatency: number;
}
