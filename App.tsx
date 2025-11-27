
import React, { useState } from 'react';
import SetupPanel from './components/SetupPanel';
import TestRunner from './components/TestRunner';
import { ApiConfig, TestCase, TestResult, AIProvider } from './types';
import { generateTestCases } from './services/geminiService';
import { executeTestCase } from './services/apiTester';
import { Activity, Terminal } from 'lucide-react';

const App: React.FC = () => {
  const [apiConfig, setApiConfig] = useState<ApiConfig>({
    aiConfig: {
        provider: AIProvider.GEMINI,
        apiKey: process.env.API_KEY || '', // Fallback for dev environment convenience
        baseUrl: '',
        modelName: 'gemini-2.5-flash'
    },
    baseUrl: '',
    authToken: '',
    authHeader: 'Authorization',
    globalHeaders: [],
    globalQueryParams: [],
    globalBodyParams: [],
    documentation: '',
  });

  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setSuccessMessage(null);
    setTestCases([]);
    setTestResults({});
    
    try {
      const { config: extractedConfig, cases } = await generateTestCases(
          apiConfig.documentation, 
          apiConfig.importedFile,
          apiConfig.aiConfig // Pass AI Config
      );
      
      if (cases.length === 0) {
          setError("未能生成测试用例。请检查文档内容是否清晰。");
      } else {
          setTestCases(cases);
          
          // Auto-fill logic
          let updatedFields = [];
          if (!apiConfig.baseUrl && extractedConfig.baseUrl) {
             setApiConfig(prev => ({ ...prev, baseUrl: extractedConfig.baseUrl! }));
             updatedFields.push("Base URL");
          }
          if (!apiConfig.authToken && extractedConfig.authToken) {
             setApiConfig(prev => ({ ...prev, authToken: extractedConfig.authToken! }));
             updatedFields.push("Token");
          }
          if (extractedConfig.authHeader && extractedConfig.authHeader !== 'Authorization') {
             setApiConfig(prev => ({ ...prev, authHeader: extractedConfig.authHeader! }));
          }

          if (updatedFields.length > 0) {
              setSuccessMessage(`已生成 ${cases.length} 个测试用例，并自动提取了 ${updatedFields.join(', ')}。`);
          } else {
              setSuccessMessage(`已成功生成 ${cases.length} 个测试用例。`);
          }
      }
    } catch (err: any) {
      setError(err.message || "生成测试用例失败。");
    } finally {
      setIsGenerating(false);
    }
  };

  const runAllTests = async () => {
    if (!apiConfig.baseUrl) {
      setError("在运行测试之前，请先提供基础 URL。");
      return;
    }

    setIsRunning(true);
    setTestResults({}); // Clear previous results

    // Run sequentially to be nicer to the API and clearer in UI update
    for (const testCase of testCases) {
      const result = await executeTestCase(apiConfig, testCase);
      setTestResults(prev => ({
        ...prev,
        [testCase.id]: result
      }));
      // Small delay for UI update visibility
      await new Promise(r => setTimeout(r, 100)); 
    }
    
    setIsRunning(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex items-center justify-between pb-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/30">
              <Activity size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                AutoAPI Tester
              </h1>
              <p className="text-gray-400 text-sm">AI 驱动的自动化接口验证工具</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-gray-500 text-sm">
             <Terminal size={16} />
             <span>v1.2.0 (Multi-Model Support)</span>
          </div>
        </header>

        {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2 animate-pulse">
                <span className="font-bold">错误:</span> {error}
            </div>
        )}

        {successMessage && (
            <div className="bg-green-500/10 border border-green-500/50 text-green-200 px-4 py-3 rounded-lg flex items-center gap-2">
                <span className="font-bold">成功:</span> {successMessage}
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Panel: Configuration */}
          <div className="lg:col-span-4 space-y-6 h-[calc(100vh-160px)] flex flex-col">
            <SetupPanel 
              config={apiConfig}
              setConfig={setApiConfig}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
            />
          </div>

          {/* Right Panel: Execution & Results */}
          <div className="lg:col-span-8 h-[calc(100vh-160px)] min-h-[600px] flex flex-col">
            {testCases.length > 0 ? (
                <TestRunner 
                    testCases={testCases}
                    results={testResults}
                    runAllTests={runAllTests}
                    isRunning={isRunning}
                    config={apiConfig}
                />
            ) : (
                <div className="h-full bg-gray-800 rounded-xl border border-gray-700 border-dashed flex flex-col items-center justify-center text-gray-500 space-y-4">
                    <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center">
                        <Terminal size={32} />
                    </div>
                    <p className="text-lg font-medium">尚未生成测试用例</p>
                    <p className="text-sm max-w-xs text-center">请在左侧配置 AI 模型并导入 API 文档以开启测试。</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
