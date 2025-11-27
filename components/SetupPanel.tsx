
import React, { useRef, useState, useEffect } from 'react';
import { ApiConfig, KeyValuePair, AIProvider } from '../types';
import { Settings, FileText, Key, Upload, Trash2, FileType, Plus, X, ToggleLeft, ToggleRight, List, Sliders, Bot, RefreshCw, Zap, Download, Monitor, Cloud, Laptop, Globe, ExternalLink, Play } from 'lucide-react';

// Declare mammoth globally as it's loaded via script tag
declare const mammoth: any;

interface SetupPanelProps {
  config: ApiConfig;
  setConfig: React.Dispatch<React.SetStateAction<ApiConfig>>;
  onGenerate: () => void;
  isGenerating: boolean;
}

type ConnectionMode = 'cloud' | 'local' | 'direct';

const SetupPanel: React.FC<SetupPanelProps> = ({ config, setConfig, onGenerate, isGenerating }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'ai' | 'basic' | 'advanced' | 'docs'>('ai');
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('direct');

  // Initialize connection mode state from config
  useEffect(() => {
    if (!config.useServerProxy) {
        setConnectionMode('direct');
    } else if (config.proxyUrl && (config.proxyUrl.includes('localhost') || config.proxyUrl.includes('127.0.0.1'))) {
        setConnectionMode('local');
    } else {
        setConnectionMode('cloud');
    }
  }, []);

  // Update config when mode changes
  const handleModeChange = (mode: ConnectionMode) => {
      setConnectionMode(mode);
      if (mode === 'direct') {
          setConfig(prev => ({ ...prev, useServerProxy: false }));
      } else if (mode === 'local') {
          setConfig(prev => ({ 
              ...prev, 
              useServerProxy: true,
              proxyUrl: 'http://localhost:3001/proxy'
          }));
      } else {
          // Cloud
          setConfig(prev => ({ 
              ...prev, 
              useServerProxy: true,
              proxyUrl: '/api/proxy'
          }));
      }
  };

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
          case AIProvider.OPENAI:
              defaultBaseUrl = 'https://api.openai.com/v1';
              defaultModel = 'gpt-4o';
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

  // Local Agent Script Content
  const localAgentScript = `
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3001;

// 允许所有跨域请求
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

app.post('/proxy', async (req, res) => {
    const { targetUrl, method, headers, body } = req.body;
    console.log(\`[Proxy] \${method} -> \${targetUrl}\`);

    try {
        const response = await axios({
            url: targetUrl, method, headers, data: body,
            validateStatus: () => true 
        });
        res.json({
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data
        });
    } catch (error) {
        console.error('[Error]', error.message);
        res.status(502).json({
            status: 0, error: error.message,
            data: error.response?.data || null
        });
    }
});

app.listen(PORT, () => {
    console.log(\`✅ 本地代理已启动: http://localhost:\${PORT}/proxy\`);
    console.log(\`   请在网页端将代理地址设置为上方 URL\`);
});
`.trim();

  const downloadLocalAgent = () => {
      const blob = new Blob([localAgentScript], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'local-agent.js';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                            { id: AIProvider.GEMINI, name: 'Gemini' },
                            { id: AIProvider.DEEPSEEK, name: 'DeepSeek' },
                            { id: AIProvider.TONGYI, name: '通义千问' },
                            { id: AIProvider.OPENAI, name: 'OpenAI' }
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
            <div className="space-y-6 animate-fadeIn">
                
                {/* Connection Mode Selection */}
                <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-400 block">网络连接模式 (Connection Mode)</label>
                    <div className="grid grid-cols-1 gap-3">
                        {/* Mode 1: Cloud Proxy */}
                        <div 
                            onClick={() => handleModeChange('cloud')}
                            className={`cursor-pointer p-3 rounded-lg border flex items-center justify-between transition-all ${connectionMode === 'cloud' ? 'bg-indigo-900/30 border-indigo-500' : 'bg-gray-900 border-gray-700 hover:bg-gray-800'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${connectionMode === 'cloud' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
                                    <Cloud size={18} />
                                </div>
                                <div>
                                    <h4 className={`text-sm font-bold ${connectionMode === 'cloud' ? 'text-indigo-300' : 'text-gray-300'}`}>☁️ 云端代理 (推荐)</h4>
                                    <p className="text-xs text-gray-500">通过部署的服务器转发请求，解决 CORS 问题。适用于测试公网接口。</p>
                                </div>
                            </div>
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${connectionMode === 'cloud' ? 'border-indigo-500 bg-indigo-500' : 'border-gray-600'}`}>
                                {connectionMode === 'cloud' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </div>
                        </div>

                        {/* Mode 2: Local Proxy */}
                        <div 
                            onClick={() => handleModeChange('local')}
                            className={`cursor-pointer p-3 rounded-lg border flex flex-col gap-2 transition-all ${connectionMode === 'local' ? 'bg-indigo-900/30 border-indigo-500' : 'bg-gray-900 border-gray-700 hover:bg-gray-800'}`}
                        >
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${connectionMode === 'local' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
                                        <Laptop size={18} />
                                    </div>
                                    <div>
                                        <h4 className={`text-sm font-bold ${connectionMode === 'local' ? 'text-indigo-300' : 'text-gray-300'}`}>💻 本地代理 (测内网)</h4>
                                        <p className="text-xs text-gray-500">在本地运行脚本，穿透内网。适用于测试 Localhost 或 局域网 API。</p>
                                    </div>
                                </div>
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${connectionMode === 'local' ? 'border-indigo-500 bg-indigo-500' : 'border-gray-600'}`}>
                                    {connectionMode === 'local' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                </div>
                            </div>
                            
                            {connectionMode === 'local' && (
                                <div className="ml-11 mt-1 p-3 bg-gray-950/50 rounded text-xs text-gray-400 border border-gray-800 animate-fadeIn">
                                    <p className="mb-2">1. 下载代理脚本 <code className="bg-gray-800 px-1 rounded text-gray-300">local-agent.js</code></p>
                                    <p className="mb-2">2. 确保已安装 Node.js，在终端运行: <br/><code className="text-green-400 block mt-1">node local-agent.js</code></p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); downloadLocalAgent(); }}
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors"
                                        >
                                            <Download size={12} /> 下载脚本
                                        </button>
                                        <span className="text-gray-600 text-[10px]">或将其打包为 .exe 免环境运行</span>
                                    </div>
                                </div>
                            )}
                        </div>

                         {/* Mode 3: Direct */}
                         <div 
                            onClick={() => handleModeChange('direct')}
                            className={`cursor-pointer p-3 rounded-lg border flex flex-col gap-2 transition-all ${connectionMode === 'direct' ? 'bg-indigo-900/30 border-indigo-500' : 'bg-gray-900 border-gray-700 hover:bg-gray-800'}`}
                        >
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${connectionMode === 'direct' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
                                        <Globe size={18} />
                                    </div>
                                    <div>
                                        <h4 className={`text-sm font-bold ${connectionMode === 'direct' ? 'text-indigo-300' : 'text-gray-300'}`}>🌐 浏览器直连</h4>
                                        <p className="text-xs text-gray-500">浏览器直接发起请求。需安装插件解决 CORS 问题。</p>
                                    </div>
                                </div>
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${connectionMode === 'direct' ? 'border-indigo-500 bg-indigo-500' : 'border-gray-600'}`}>
                                    {connectionMode === 'direct' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                </div>
                            </div>
                            {connectionMode === 'direct' && (
                                <div className="ml-11 mt-1 p-2 bg-yellow-900/20 border border-yellow-700/30 rounded text-xs text-yellow-500 animate-fadeIn flex items-start gap-2">
                                    <ExternalLink size={14} className="mt-0.5 flex-shrink-0" />
                                    <div>
                                        推荐安装 "Allow CORS" 浏览器插件，否则大多数接口会因跨域失败。
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Base URL Input */}
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Base URL</label>
                    <input
                        type="text"
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none placeholder-gray-600"
                        placeholder="e.g. https://api.example.com/v1"
                        value={config.baseUrl}
                        onChange={(e) => handleChange('baseUrl', e.target.value)}
                    />
                    {connectionMode === 'cloud' && (config.baseUrl.includes('localhost') || config.baseUrl.includes('192.168.') || config.baseUrl.includes('127.0.0.1')) && (
                        <div className="mt-2 text-xs text-amber-500 bg-amber-900/20 border border-amber-900/50 p-2 rounded flex items-center gap-2">
                            <Zap size={14} />
                            <span>云端代理无法访问本地地址 ({config.baseUrl})。请切换为 **本地代理** 或 **直连** 模式。</span>
                        </div>
                    )}
                </div>

                 {/* Custom Proxy URL (Only if using proxy) */}
                 {config.useServerProxy && (
                    <div>
                         <label className="block text-sm font-medium text-gray-400 mb-1">代理服务地址 (Proxy Server URL)</label>
                         <input
                            type="text"
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono text-gray-400"
                            value={config.proxyUrl}
                            onChange={(e) => handleChange('proxyUrl', e.target.value)}
                         />
                    </div>
                 )}

                {/* Auth */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Auth Header</label>
                        <input
                            type="text"
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Authorization"
                            value={config.authHeader}
                            onChange={(e) => handleChange('authHeader', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Auth Token</label>
                        <input
                            type="text"
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Bearer eyJhb..."
                            value={config.authToken}
                            onChange={(e) => handleChange('authToken', e.target.value)}
                        />
                    </div>
                </div>
            </div>
        )}

        {/* TAB 3: ADVANCED CONFIG */}
        {activeTab === 'advanced' && (
            <div className="space-y-6 animate-fadeIn">
                <div className="bg-indigo-900/20 border border-indigo-500/20 p-3 rounded text-xs text-indigo-200 mb-4">
                    在此配置的参数将自动合并到所有请求中。用于设置全局的 API Key、签名 (Sign) 或公共 Header。
                </div>
                
                {renderKeyValueEditor("全局 Header (Global Headers)", 'globalHeaders', config.globalHeaders, "Header Name (e.g. X-Channel)")}
                
                {renderKeyValueEditor("全局 URL 参数 (Global Query Params)", 'globalQueryParams', config.globalQueryParams, "Param Key (e.g. api_key)")}
                
                {renderKeyValueEditor("全局 Body 参数 (Global Body Params)", 'globalBodyParams', config.globalBodyParams, "Body Key (e.g. app_secret)")}
                
                <p className="text-xs text-gray-500 mt-2">
                    * 全局 Body 参数仅对 POST/PUT/PATCH 请求生效。
                </p>
            </div>
        )}

      </div>
      
      {/* Footer Action */}
      <div className="p-4 border-t border-gray-700 bg-gray-800/50">
        <button
          onClick={onGenerate}
          disabled={isGenerating || !config.aiConfig.apiKey}
          className={`w-full py-3 rounded-lg font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
            isGenerating || !config.aiConfig.apiKey
              ? 'bg-gray-600 cursor-not-allowed text-gray-400'
              : 'bg-indigo-600 hover:bg-indigo-500 hover:shadow-indigo-500/25'
          }`}
        >
          {isGenerating ? (
              <>
                <RefreshCw className="animate-spin" size={20} />
                正在解析文档...
              </>
          ) : (
              <>
                <Bot size={20} />
                生成测试用例
              </>
          )}
        </button>
        {!config.aiConfig.apiKey && (
            <p className="text-xs text-red-400 text-center mt-2">请先在 "AI 设置" 中输入 API Key</p>
        )}
      </div>
    </div>
  );
};

export default SetupPanel;
