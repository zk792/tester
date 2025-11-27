
import React, { useRef, useState } from 'react';
import { ApiConfig, KeyValuePair, AIProvider } from '../types';
import { Settings, Play, FileText, Key, Globe, Shield, Upload, Trash2, FileType, Plus, X, ToggleLeft, ToggleRight, List, Sliders, Bot, RefreshCw } from 'lucide-react';

// Declare mammoth globally as it's loaded via script tag
declare const mammoth: any;

interface SetupPanelProps {
  config: ApiConfig;
  setConfig: React.Dispatch<React.SetStateAction<ApiConfig>>;
  onGenerate: () => void;
  isGenerating: boolean;
}

const SetupPanel: React.FC<SetupPanelProps> = ({ config, setConfig, onGenerate, isGenerating }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'ai' | 'basic' | 'advanced' | 'docs'>('ai');
  
  const handleChange = (field: keyof ApiConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleAIChange = (field: keyof typeof config.aiConfig, value: any) => {
      setConfig(prev => ({
          ...prev,
          aiConfig: {
              ...prev.aiConfig,
              [field]: value
          }
      }));
  };

  const handleProviderChange = (provider: AIProvider) => {
      let defaultBaseUrl = '';
      let defaultModel = '';

      switch (provider) {
          case AIProvider.GEMINI:
              defaultBaseUrl = ''; // SDK handles it
              defaultModel = 'gemini-2.5-flash';
              break;
          case AIProvider.DEEPSEEK:
              defaultBaseUrl = 'https://api.deepseek.com';
              defaultModel = 'deepseek-chat';
              break;
          case AIProvider.TONGYI:
              defaultBaseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
              defaultModel = 'qwen-plus';
              break;
      }

      setConfig(prev => ({
          ...prev,
          aiConfig: {
              ...prev.aiConfig,
              provider,
              baseUrl: defaultBaseUrl,
              modelName: defaultModel
          }
      }));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();

    // Reset imported file state initially
    handleChange('importedFile', undefined);

    if (fileName.endsWith('.pdf')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            const base64Data = result.split(',')[1];
            handleChange('importedFile', {
                name: file.name,
                mimeType: 'application/pdf',
                data: base64Data
            });
        };
        reader.readAsDataURL(file);
    } 
    else if (fileName.endsWith('.docx')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            if (typeof mammoth !== 'undefined') {
                mammoth.extractRawText({ arrayBuffer: arrayBuffer })
                    .then((result: any) => {
                         handleChange('documentation', result.value);
                    })
                    .catch((err: any) => {
                        console.error("DOCX parsing failed", err);
                        alert("解析 DOCX 文件失败，请尝试转换为 PDF 或 TXT 上传。");
                    });
            }
        };
        reader.readAsArrayBuffer(file);
    }
    else {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            if (content) {
                handleChange('documentation', content);
            }
        };
        reader.readAsText(file);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearDocumentation = () => handleChange('documentation', '');
  const removeImportedFile = () => handleChange('importedFile', undefined);

  // --- Key-Value List Helper ---
  const updateKeyValuePair = (
      type: 'globalHeaders' | 'globalQueryParams' | 'globalBodyParams', 
      id: string, 
      field: keyof KeyValuePair, 
      value: any
  ) => {
      setConfig(prev => ({
          ...prev,
          [type]: prev[type].map(item => item.id === id ? { ...item, [field]: value } : item)
      }));
  };

  const addKeyValuePair = (type: 'globalHeaders' | 'globalQueryParams' | 'globalBodyParams') => {
      setConfig(prev => ({
          ...prev,
          [type]: [...prev[type], { id: Math.random().toString(36).substr(2, 9), key: '', value: '', enabled: true }]
      }));
  };

  const removeKeyValuePair = (type: 'globalHeaders' | 'globalQueryParams' | 'globalBodyParams', id: string) => {
      setConfig(prev => ({
          ...prev,
          [type]: prev[type].filter(item => item.id !== id)
      }));
  };

  const renderKeyValueEditor = (
      title: string, 
      type: 'globalHeaders' | 'globalQueryParams' | 'globalBodyParams', 
      items: KeyValuePair[],
      placeholderKey: string
  ) => (
      <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-400">{title}</label>
              <button 
                onClick={() => addKeyValuePair(type)}
                className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
              >
                  <Plus size={14} /> 添加
              </button>
          </div>
          <div className="space-y-2">
              {items.length === 0 && (
                  <div className="text-xs text-gray-600 italic text-center py-2 border border-gray-700 border-dashed rounded">
                      暂无配置
                  </div>
              )}
              {items.map(item => (
                  <div key={item.id} className="flex items-center gap-2">
                      <button 
                        onClick={() => updateKeyValuePair(type, item.id, 'enabled', !item.enabled)}
                        className={`flex-shrink-0 ${item.enabled ? 'text-green-400' : 'text-gray-600'}`}
                      >
                          {item.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                      <input 
                          type="text" 
                          placeholder={placeholderKey}
                          value={item.key}
                          onChange={(e) => updateKeyValuePair(type, item.id, 'key', e.target.value)}
                          className={`w-1/3 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-indigo-500 ${!item.enabled && 'opacity-50'}`}
                      />
                      <input 
                          type="text" 
                          placeholder="值"
                          value={item.value}
                          onChange={(e) => updateKeyValuePair(type, item.id, 'value', e.target.value)}
                          className={`flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-indigo-500 ${!item.enabled && 'opacity-50'}`}
                      />
                      <button 
                          onClick={() => removeKeyValuePair(type, item.id)}
                          className="text-gray-500 hover:text-red-400 transition-colors"
                      >
                          <X size={16} />
                      </button>
                  </div>
              ))}
          </div>
      </div>
  );

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
         <div className="flex items-center gap-2 text-indigo-400">
            <Settings size={20} />
            <h2 className="text-lg font-bold text-white">配置面板</h2>
         </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('ai')}
            className={`flex-1 min-w-[80px] py-3 text-xs md:text-sm font-medium flex items-center justify-center gap-1 md:gap-2 border-b-2 transition-colors ${activeTab === 'ai' ? 'border-indigo-500 text-indigo-400 bg-gray-700/50' : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'}`}
          >
              <Bot size={14} /> AI 设置
          </button>
          <button 
            onClick={() => setActiveTab('docs')}
            className={`flex-1 min-w-[80px] py-3 text-xs md:text-sm font-medium flex items-center justify-center gap-1 md:gap-2 border-b-2 transition-colors ${activeTab === 'docs' ? 'border-indigo-500 text-indigo-400 bg-gray-700/50' : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'}`}
          >
              <FileText size={14} /> 文档
          </button>
          <button 
            onClick={() => setActiveTab('basic')}
            className={`flex-1 min-w-[80px] py-3 text-xs md:text-sm font-medium flex items-center justify-center gap-1 md:gap-2 border-b-2 transition-colors ${activeTab === 'basic' ? 'border-indigo-500 text-indigo-400 bg-gray-700/50' : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'}`}
          >
              <Sliders size={14} /> 基础
          </button>
          <button 
            onClick={() => setActiveTab('advanced')}
            className={`flex-1 min-w-[80px] py-3 text-xs md:text-sm font-medium flex items-center justify-center gap-1 md:gap-2 border-b-2 transition-colors ${activeTab === 'advanced' ? 'border-indigo-500 text-indigo-400 bg-gray-700/50' : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'}`}
          >
              <List size={14} /> 全局
          </button>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        
        {/* TAB 0: AI SETTINGS */}
        {activeTab === 'ai' && (
            <div className="space-y-5 animate-fadeIn">
                <div className="bg-indigo-900/20 border border-indigo-500/20 p-3 rounded text-xs text-indigo-200 mb-4">
                    在此处配置生成测试用例的 AI 模型。支持 Gemini、DeepSeek、通义千问等。
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">选择模型提供商</label>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { id: AIProvider.GEMINI, name: 'Gemini' },
                            { id: AIProvider.DEEPSEEK, name: 'DeepSeek' },
                            { id: AIProvider.TONGYI, name: '通义千问' }
                        ].map(p => (
                            <button
                                key={p.id}
                                onClick={() => handleProviderChange(p.id)}
                                className={`py-2 px-3 rounded text-sm font-medium border transition-all ${
                                    config.aiConfig.provider === p.id 
                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' 
                                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800'
                                }`}
                            >
                                {p.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1 flex items-center gap-1">
                        <Key size={14} /> API Key
                    </label>
                    <input
                        type="password"
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder={`请输入 ${config.aiConfig.provider} API Key`}
                        value={config.aiConfig.apiKey}
                        onChange={(e) => handleAIChange('apiKey', e.target.value)}
                    />
                    <p className="text-xs text-gray-600 mt-1">Key 仅存储在本地浏览器内存中，刷新页面后需重新输入。</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">模型名称 (Model Name)</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                                value={config.aiConfig.modelName}
                                onChange={(e) => handleAIChange('modelName', e.target.value)}
                            />
                            <button 
                                onClick={() => handleProviderChange(config.aiConfig.provider)}
                                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300"
                                title="重置为默认值"
                            >
                                <RefreshCw size={16} />
                            </button>
                        </div>
                    </div>

                    {config.aiConfig.provider !== AIProvider.GEMINI && (
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">API Base URL</label>
                            <input
                                type="text"
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                                value={config.aiConfig.baseUrl}
                                onChange={(e) => handleAIChange('baseUrl', e.target.value)}
                            />
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* TAB 1: DOCUMENTATION */}
        {activeTab === 'docs' && (
            <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-400">上传或粘贴 API 文档</label>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs bg-gray-700 hover:bg-gray-600 text-indigo-300 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                        >
                            <Upload size={12} /> 导入文件
                        </button>
                        {config.documentation && !config.importedFile && (
                            <button 
                                onClick={clearDocumentation}
                                className="text-xs bg-gray-700 hover:bg-red-900/50 text-red-400 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                            >
                                <Trash2 size={12} /> 清空
                            </button>
                        )}
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".json,.txt,.md,.yaml,.yml,.pdf,.docx" />
                </div>
                
                {config.importedFile && (
                    <div className="space-y-2">
                        <div className="p-3 bg-indigo-900/30 border border-indigo-500/30 rounded-lg flex items-center justify-between group">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <FileType className="text-indigo-400 flex-shrink-0" size={20} />
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-sm text-indigo-200 truncate font-medium">{config.importedFile.name}</span>
                                    <span className="text-xs text-indigo-400/70">MIME: {config.importedFile.mimeType}</span>
                                </div>
                            </div>
                            <button onClick={removeImportedFile} className="p-1 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded">
                                <Trash2 size={16} />
                            </button>
                        </div>
                        {config.aiConfig.provider !== AIProvider.GEMINI && config.importedFile.mimeType === 'application/pdf' && (
                            <div className="text-xs text-amber-400 bg-amber-900/20 p-2 rounded flex items-start gap-1">
                                <span className="font-bold">⚠️ 注意:</span> 
                                <span>您当前选择的 {config.aiConfig.provider} 可能不支持直接解析 PDF。建议将 PDF 内容转换为文本粘贴到下方。</span>
                            </div>
                        )}
                    </div>
                )}

                <textarea
                    className={`w-full h-64 bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm font-mono text-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none resize-none placeholder-gray-600 ${config.importedFile ? 'h-32' : ''}`}
                    placeholder={config.importedFile ? "文件已就绪。在此处添加额外提示..." : "支持粘贴 Swagger JSON, YAML, Markdown 文本，或直接上传 PDF/DOCX。"}
                    value={config.documentation}
                    onChange={(e) => handleChange('documentation', e.target.value)}
                />
            </div>
        )}

        {/* TAB 2: BASIC CONFIG */}
        {activeTab === 'basic' && (
            <div className="space-y-4 animate-fadeIn">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1 flex items-center gap-1">
                        <Globe size={14} /> 基础 URL (Base URL)
                    </label>
                    <input
                        type="text"
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="https://api.example.com/v1"
                        value={config.baseUrl}
                        onChange={(e) => handleChange('baseUrl', e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1 flex items-center gap-1">
                            <Shield size={14} /> 认证 Header 名
                        </label>
                        <input
                            type="text"
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Authorization"
                            value={config.authHeader}
                            onChange={(e) => handleChange('authHeader', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1 flex items-center gap-1">
                            <Key size={14} /> 认证 Token
                        </label>
                        <textarea
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-24"
                            placeholder="eyJhbGciOiJIUz..."
                            value={config.authToken}
                            onChange={(e) => handleChange('authToken', e.target.value)}
                        />
                    </div>
                </div>
            </div>
        )}

        {/* TAB 3: ADVANCED (GLOBAL PARAMS) */}
        {activeTab === 'advanced' && (
            <div className="space-y-6 animate-fadeIn">
                <div className="bg-indigo-900/20 border border-indigo-500/20 p-3 rounded text-xs text-gray-300">
                    <p className="font-semibold mb-1 text-indigo-400">参数覆盖规则：</p>
                    <p>AI 生成的测试用例可能已包含文档中提及的参数（如 app_key 占位符）。</p>
                    <p className="mt-1 text-gray-400">在此处填写的参数将拥有<b>最高优先级</b>，可用于：</p>
                    <ul className="list-disc pl-4 mt-1 space-y-1 text-gray-500">
                        <li>覆盖 AI 生成的占位符（填入真实值）</li>
                        <li>为所有请求强制注入 Cookie、TraceId 等</li>
                    </ul>
                </div>
                
                {renderKeyValueEditor("全局 Headers", "globalHeaders", config.globalHeaders, "Header Name (e.g. X-Env)")}
                <div className="border-t border-gray-700 my-4"></div>
                {renderKeyValueEditor("全局 Query 参数", "globalQueryParams", config.globalQueryParams, "Query Key (e.g. debug)")}
                <div className="border-t border-gray-700 my-4"></div>
                {renderKeyValueEditor("全局 Body 参数", "globalBodyParams", config.globalBodyParams || [], "Key (e.g. app_secret)")}
            </div>
        )}

      </div>

      {/* Footer Action */}
      <div className="p-4 border-t border-gray-700 bg-gray-800/50 rounded-b-xl">
        <button
          onClick={onGenerate}
          disabled={isGenerating || (!config.documentation && !config.importedFile) || !config.aiConfig.apiKey}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-all ${
            isGenerating || (!config.documentation && !config.importedFile) || !config.aiConfig.apiKey
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
          }`}
          title={!config.aiConfig.apiKey ? "请先配置 AI API Key" : ""}
        >
          {isGenerating ? (
            <>
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
              正在生成...
            </>
          ) : (
            <>
              <Play size={18} /> 生成测试用例
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default SetupPanel;
