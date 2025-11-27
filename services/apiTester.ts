
import { ApiConfig, TestCase, TestResult } from "../types";

export const executeTestCase = async (
  config: ApiConfig,
  testCase: TestCase
): Promise<TestResult> => {
  const startTime = performance.now();
  
  // 1. Construct URL with Base + Endpoint
  const cleanBase = config.baseUrl.replace(/\/$/, "");
  const cleanEndpoint = testCase.endpoint.replace(/^\//, "");
  let urlStr = `${cleanBase}/${cleanEndpoint}`;

  // 2. Append Global Query Params
  // Priority: User's Global Config > AI Generated Query Params (already in endpoint string)
  try {
    const urlObj = new URL(urlStr);
    config.globalQueryParams.forEach(param => {
      if (param.enabled && param.key) {
        // .append allows duplicates, .set overwrites. Using set to prioritize global config over URL param if key exists
        urlObj.searchParams.set(param.key, param.value);
      }
    });
    urlStr = urlObj.toString();
  } catch (e) {
    // If base URL is relative or invalid, we might fail to parse URL object.
    const hasQuery = urlStr.includes('?');
    const queryString = config.globalQueryParams
      .filter(p => p.enabled && p.key)
      .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join('&');
    
    if (queryString) {
      urlStr += (hasQuery ? '&' : '?') + queryString;
    }
  }

  // 3. Construct Headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(testCase.headers || {}),
  };

  // Add Global Headers (Overrides existing)
  config.globalHeaders.forEach(header => {
    if (header.enabled && header.key) {
      headers[header.key] = header.value;
    }
  });

  // Add Auth Token if configured
  if (config.authToken) {
    headers[config.authHeader || 'Authorization'] = config.authToken.startsWith('Bearer ') || config.authHeader !== 'Authorization' 
      ? config.authToken 
      : `Bearer ${config.authToken}`;
  }

  // 4. Construct Body (with Global Body Params logic)
  let requestBody = testCase.body;
  const isBodyMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(testCase.method);
  
  if (isBodyMethod) {
    const globalBodyParams = (config.globalBodyParams || []).filter(p => p.enabled && p.key);
    
    // Even if testCase.body is undefined, if we have global params, we start an object
    if (globalBodyParams.length > 0 || (requestBody && Object.keys(requestBody).length > 0)) {
        // Ensure requestBody is an object
        if (!requestBody || typeof requestBody !== 'object') {
            requestBody = {};
        } else {
            // Shallow copy to avoid mutation
            requestBody = { ...requestBody };
        }
        
        // Merge global params (Overrides AI generated fields if collision occurs)
        globalBodyParams.forEach(param => {
            requestBody[param.key] = param.value;
        });
    }
  }

  try {
    let responseBody = null;
    let status = 'ERROR';
    let actualStatus = 0;
    
    // === PROXY MODE vs DIRECT MODE ===
    if (config.useServerProxy) {
        // Proxy Mode: Send all details to the node middleware (Cloud or Local)
        // Default to /api/proxy (Cloud) if not set
        const proxyEndpoint = config.proxyUrl || '/api/proxy';
        
        const proxyPayload = {
            targetUrl: urlStr,
            method: testCase.method,
            headers: headers,
            body: isBodyMethod ? requestBody : undefined
        };

        const response = await fetch(proxyEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(proxyPayload)
        });
        
        // The middleware returns { status, headers, data } or error structure
        const proxyResult = await response.json();
        
        if (response.status === 502 || response.status === 404) {
             throw new Error(proxyResult.error || `Proxy Error (Are you running the Local Agent?): ${response.statusText}`);
        }

        actualStatus = proxyResult.status;
        responseBody = proxyResult.data;
        status = actualStatus === testCase.expectedStatus ? 'PASS' : 'FAIL';

    } else {
        // Direct Mode: Browser fetch
        const fetchOptions: RequestInit = {
            method: testCase.method,
            headers: headers,
        };

        if (isBodyMethod && requestBody && Object.keys(requestBody).length > 0) {
            fetchOptions.body = JSON.stringify(requestBody);
        }

        const response = await fetch(urlStr, fetchOptions);
        actualStatus = response.status;

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            try {
                responseBody = await response.json();
            } catch {
                responseBody = await response.text();
            }
        } else {
            responseBody = await response.text();
        }

        status = actualStatus === testCase.expectedStatus ? 'PASS' : 'FAIL';
    }

    const latency = Math.round(performance.now() - startTime);

    return {
      testCaseId: testCase.id,
      status: status as 'PASS' | 'FAIL',
      actualStatus,
      latencyMs: latency,
      responseBody,
      timestamp: new Date().toISOString(),
    };

  } catch (error: any) {
    const latency = Math.round(performance.now() - startTime);
    return {
      testCaseId: testCase.id,
      status: 'ERROR',
      actualStatus: 0,
      latencyMs: latency,
      responseBody: null,
      errorMessage: error.message || "网络错误 (可能是 CORS 或 连接问题)",
      timestamp: new Date().toISOString(),
    };
  }
};
