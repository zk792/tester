import React, { useState, useRef, useEffect } from 'react';
import { TestCase, TestResult, HttpMethod, ApiConfig } from '../types';
import { PlayCircle, CheckCircle, XCircle, AlertTriangle, Clock, Code, ChevronDown, ChevronUp, Download, FileJson, FileText, Archive } from 'lucide-react';

// Declare external libraries
declare const JSZip: any;

interface TestRunnerProps {
  testCases: TestCase[];
  results: Record<string, TestResult>;
  runAllTests: () => void;
  isRunning: boolean;
  config: ApiConfig;
}

const MethodBadge: React.FC<{ method: HttpMethod }> = ({ method }) => {
  const colors = {
    GET: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    POST: 'bg-green-500/20 text-green-400 border-green-500/30',
    PUT: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
    PATCH: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${colors[method] || 'bg-gray-700 text-gray-300'}`}>
      {method}
    </span>
  );
};

// Helper to compute effective body
const getEffectiveBody = (testCase: TestCase, config: ApiConfig): any => {
    const isBodyMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(testCase.method);
    if (!isBodyMethod) return undefined;

    let requestBody = testCase.body;
    const globalBodyParams = (config.globalBodyParams || []).filter(p => p.enabled && p.key);

    if (globalBodyParams.length > 0 || (requestBody && Object.keys(requestBody).length > 0)) {
        if (!requestBody || typeof requestBody !== 'object') {
            requestBody = {};
        } else {
            requestBody = { ...requestBody };
        }
        
        globalBodyParams.forEach(param => {
            requestBody[param.key] = param.value;
        });
        
        return Object.keys(requestBody).length > 0 ? requestBody : undefined;
    }
    return undefined;
};

// Helper to compute effective headers
const getEffectiveHeaders = (testCase: TestCase, config: ApiConfig): Record<string, string> => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(testCase.headers || {})
    };

    config.globalHeaders.forEach(h => {
        if(h.enabled && h.key) headers[h.key] = h.value;
    });

    if (config.authToken) {
        const key = config.authHeader || 'Authorization';
        const val = config.authToken.startsWith('Bearer ') || key !== 'Authorization'
            ? config.authToken
            : `Bearer ${config.authToken}`;
        headers[key] = val;
    }
    return headers;
};

const TestRow: React.FC<{ testCase: TestCase; result?: TestResult; config: ApiConfig }> = ({ testCase, result, config }) => {
    const [expanded, setExpanded] = React.useState(false);

    const effectiveHeaders = getEffectiveHeaders(testCase, config);
    const effectiveBody = getEffectiveBody(testCase, config);

    // Detect potential CORS error
    const isCorsError = result?.status === 'ERROR' && 
        (result.errorMessage?.includes('Failed to fetch') || result.errorMessage?.includes('Network Error'));

    return (
        <div className="border border-gray-700 rounded-lg overflow-hidden bg-gray-900/50 hover:bg-gray-900 transition-colors">
            <div 
                className="flex items-center justify-between p-3 cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-4 flex-1 overflow-hidden">
                    <div className="w-6 flex justify-center">
                        {!result && <div className="w-2 h-2 rounded-full bg-gray-600" />}
                        {result?.status === 'PASS' && <CheckCircle size={18} className="text-green-500" />}
                        {result?.status === 'FAIL' && <XCircle size={18} className="text-red-500" />}
                        {result?.status === 'ERROR' && <AlertTriangle size={18} className="text-amber-500" />}
                    </div>
                    <MethodBadge method={testCase.method} />
                    <div className="flex flex-col truncate">
                        <span className="font-medium text-sm text-gray-200 truncate">{testCase.title}</span>
                        <span className="text-xs text-gray-500 font-mono truncate">{testCase.endpoint}</span>
                    </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-400">
                    {result && (
                        <>
                            <div className="flex items-center gap-1">
                                <Code size={12} />
                                <span className={result.status === 'PASS' ? 'text-green-400' : 'text-red-400'}>
                                    {result.actualStatus}
                                </span>
                                <span className="text-gray-600">/</span>
                                <span>{testCase.expectedStatus}</span>
                            </div>
                            <div className="flex items-center gap-1 w-16 justify-end">
                                <Clock size={12} />
                                {result.latencyMs}ms
                            </div>
                        </>
                    )}
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </div>

            {expanded && (
                <div className="p-4 bg-gray-950/50 border-t border-gray-800 text-sm space-y-3">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">请求详情 (Request)</h4>
                            <div className="space-y-3">
                                <div>
                                    <div className="text-[10px] text-gray-500 mb-1">URL & Method</div>
                                    <div className="bg-gray-900 p-2 rounded border border-gray-800 font-mono text-xs break-all">
                                        <span className="text-indigo-400 font-bold">{testCase.method}</span> {testCase.endpoint}
                                    </div>
                                </div>

                                <div>
                                    <div className="text-[10px] text-gray-500 mb-1">Headers (含全局 & Token)</div>
                                    <pre className="bg-gray-900 p-2 rounded border border-gray-800 text-xs text-gray-400 overflow-x-auto">
                                        {JSON.stringify(effectiveHeaders, null, 2)}
                                    </pre>
                                </div>

                                <div>
                                    <div className="text-[10px] text-gray-500 mb-1">Body (含全局参数)</div>
                                    {effectiveBody ? (
                                        <pre className="bg-gray-900 p-2 rounded border border-gray-800 text-xs text-gray-400 overflow-x-auto">
                                            {JSON.stringify(effectiveBody, null, 2)}
                                        </pre>
                                    ) : (
                                        <div className="text-gray-600 italic text-xs border border-gray-800/50 p-2 rounded">无请求体内容</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">响应结果 (Response)</h4>
                            {result ? (
                                <div className="space-y-2">
                                    {result.errorMessage ? (
                                        <div className="text-red-400 bg-red-900/20 border border-red-900/50 p-2 rounded">
                                            <div className="font-bold mb-1">Error: {result.errorMessage}</div>
                                            {isCorsError && (
                                                <div className="mt-2 text-xs text-amber-300 border-t border-red-900/50 pt-2">
                                                    <p className="font-bold">💡 可能是跨域 (CORS) 问题</p>
                                                    <p>浏览器拦截了对第三方 API 的直接请求。</p>
                                                    <p className="mt-1">解决方案：</p>
                                                    <ul className="list-disc pl-4">
                                                        <li>请检查 Nginx 是否配置了 <code>/api/proxy/</code> 转发</li>
                                                        <li>将 Base URL 设置为 <code>{window.location.origin}/api/proxy</code></li>
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <pre className="bg-gray-900 p-2 rounded border border-gray-800 text-xs text-green-300 overflow-x-auto max-h-[300px]">
                                            {typeof result.responseBody === 'object' 
                                                ? JSON.stringify(result.responseBody, null, 2) 
                                                : String(result.responseBody)
                                            }
                                        </pre>
                                    )}
                                </div>
                            ) : (
                                <div className="text-gray-600 italic text-xs">测试尚未运行</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const TestRunner: React.FC<TestRunnerProps> = ({ testCases, results, runAllTests, isRunning, config }) => {
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const resultValues = Object.values(results) as TestResult[];
  const passed = resultValues.filter(r => r.status === 'PASS').length;
  const failed = resultValues.filter(r => r.status === 'FAIL').length;
  const errors = resultValues.filter(r => r.status === 'ERROR').length;
  const total = testCases.length;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            setIsExportMenuOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const generateMarkdownContent = () => {
      const timestamp = new Date().toLocaleString('zh-CN');
      let report = `# 自动化 API 测试报告\n\n`;
      report += `**生成时间**: ${timestamp}\n\n`;
      
      report += `## 测试概览\n`;
      report += `| 总计 | 通过 | 失败 | 错误 | 通过率 |\n`;
      report += `| :-: | :-: | :-: | :-: | :-: |\n`;
      report += `| ${total} | ${passed} | ${failed} | ${errors} | ${total > 0 ? Math.round((passed / total) * 100) : 0}% |\n\n`;
      
      report += `## 测试详情\n\n`;
      
      testCases.forEach((tc, index) => {
          const res = results[tc.id];
          const statusIcon = res?.status === 'PASS' ? '✅' : res?.status === 'FAIL' ? '❌' : res?.status === 'ERROR' ? '⚠️' : '⚪';
          const effectiveBody = getEffectiveBody(tc, config);
          const effectiveHeaders = getEffectiveHeaders(tc, config);
          
          report += `### ${index + 1}. ${statusIcon} ${tc.title} (${tc.id})\n\n`;
          report += `- **接口**: \`${tc.method} ${tc.endpoint}\`\n`;
          report += `- **描述**: ${tc.description}\n`;
          
          if (effectiveHeaders && Object.keys(effectiveHeaders).length > 0) {
              report += `- **请求头 (Headers)**:\n\`\`\`json\n${JSON.stringify(effectiveHeaders, null, 2)}\n\`\`\`\n`;
          }
  
          if (effectiveBody) {
               report += `- **请求参数 (Body)**:\n\`\`\`json\n${JSON.stringify(effectiveBody, null, 2)}\n\`\`\`\n`;
          } else {
               report += `- **请求参数 (Body)**: 无\n`;
          }
  
          if (res) {
              report += `- **测试结果**: **${res.status}**\n`;
              report += `- **HTTP 状态码**: 预期 \`${tc.expectedStatus}\` / 实际 \`${res.actualStatus}\`\n`;
              report += `- **耗时**: ${res.latencyMs} ms\n`;
              
              if (res.errorMessage) {
                  report += `- **错误信息**: \`${res.errorMessage}\`\n`;
              }
              
              if (res.responseBody) {
                  report += `- **响应内容**:\n`;
                  report += "```json\n";
                  try {
                      const bodyStr = typeof res.responseBody === 'string' ? res.responseBody : JSON.stringify(res.responseBody, null, 2);
                      report += bodyStr.length > 3000 ? bodyStr.substring(0, 3000) + '\n... (内容过长已截断)' : bodyStr;
                  } catch {
                       report += String(res.responseBody);
                  }
                  report += "\n```\n";
              }
          } else {
              report += `- **状态**: 未执行\n`;
          }
          report += `\n---\n\n`;
      });
      return report;
  };

  const generateFullJsonData = () => {
    return {
        metadata: {
            generatedAt: new Date().toISOString(),
            stats: { total, passed, failed, errors }
        },
        config: {
            baseUrl: config.baseUrl,
            authHeader: config.authHeader
        },
        results: testCases.map(tc => ({
            case: tc,
            result: results[tc.id],
            effectiveRequest: {
                headers: getEffectiveHeaders(tc, config),
                body: getEffectiveBody(tc, config)
            }
        }))
    };
  };

  const downloadFile = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = () => {
    const report = generateMarkdownContent();
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    downloadFile(blob, `API_Report_${new Date().toISOString().slice(0,10)}.md`);
    setIsExportMenuOpen(false);
  };

  const handleExportZip = async () => {
    if (typeof JSZip === 'undefined') {
        alert("正在加载压缩库，请稍后重试...");
        return;
    }

    const zip = new JSZip();
    const dateStr = new Date().toISOString().slice(0,10);
    const folderName = `api-test-report-${dateStr}`;
    const folder = zip.folder(folderName);

    // Add Markdown Report
    folder.file(`report.md`, generateMarkdownContent());

    // Add JSON Data
    folder.file(`data.json`, JSON.stringify(generateFullJsonData(), null, 2));

    try {
        const content = await zip.generateAsync({ type: "blob" });
        downloadFile(content, `${folderName}.zip`);
    } catch (e) {
        console.error("Failed to generate zip", e);
        alert("打包失败");
    }
    setIsExportMenuOpen(false);
  };

  if (total === 0) return null;

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 flex flex-col h-full">
      <div className="p-6 border-b border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <PlayCircle className="text-indigo-400" /> 测试执行
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {Object.keys(results).length} / {total} 个测试已执行
            </p>
          </div>

          <div className="flex items-center gap-3 relative">
             <div className="hidden sm:flex gap-1 text-sm font-medium mr-2">
                <span className="text-green-400 bg-green-900/30 px-2 py-1 rounded">{passed} 通过</span>
                <span className="text-red-400 bg-red-900/30 px-2 py-1 rounded">{failed} 失败</span>
                <span className="text-amber-400 bg-amber-900/30 px-2 py-1 rounded">{errors} 错误</span>
             </div>
             
             {/* Export Dropdown */}
             <div className="relative" ref={menuRef}>
                 <button
                    onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                    disabled={Object.keys(results).length === 0}
                    className={`px-3 py-2 rounded-lg font-semibold text-white transition-all flex items-center gap-2 ${
                      Object.keys(results).length === 0
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20'
                    }`}
                 >
                    <Download size={18} />
                    <span className="hidden lg:inline">导出</span>
                    <ChevronDown size={14} className={`transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
                 </button>

                 {isExportMenuOpen && (
                     <div className="absolute right-0 top-full mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden animate-fadeIn">
                         <button 
                            onClick={handleExportMarkdown}
                            className="w-full text-left px-4 py-3 hover:bg-gray-700 flex items-center gap-2 text-sm text-gray-200"
                         >
                             <FileText size={16} className="text-indigo-400" /> 导出 Markdown
                         </button>
                         <button 
                            onClick={handleExportZip}
                            className="w-full text-left px-4 py-3 hover:bg-gray-700 flex items-center gap-2 text-sm text-gray-200"
                         >
                             <Archive size={16} className="text-amber-400" /> 导出 ZIP 数据包
                         </button>
                     </div>
                 )}
             </div>

             <button
                onClick={runAllTests}
                disabled={isRunning}
                className={`px-4 py-2 rounded-lg font-semibold text-white transition-all ${
                  isRunning
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-500 shadow-lg shadow-green-500/20'
                }`}
              >
                {isRunning ? '运行中...' : '运行所有测试'}
              </button>
          </div>
        </div>
      </div>

      <div className="p-4 overflow-y-auto flex-1 space-y-2 bg-gray-900/30 min-h-[400px]">
        {testCases.map((tc) => (
            <TestRow key={tc.id} testCase={tc} result={results[tc.id]} config={config} />
        ))}
      </div>
      
      <div className="p-3 bg-amber-900/20 border-t border-amber-900/30 text-amber-200 text-xs text-center">
         注意：浏览器端的请求受 CORS 限制。请确保您的 API 允许 CORS，或者使用配置好的 /api/proxy/ 进行转发。
      </div>
    </div>
  );
};

export default TestRunner;