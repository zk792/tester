
import { GoogleGenAI, Type } from "@google/genai";
import { TestCase, HttpMethod, GeneratedTestPlan, AIConfig, AIProvider } from "../types";

// Helper to clean Markdown code blocks from JSON response
const cleanJson = (text: string): string => {
    if (!text) return "";
    let cleaned = text.trim();
    // Remove ```json ... ``` wrapper if present
    if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(json)?\n?/, "").replace(/\n?```$/, "");
    }
    return cleaned.trim();
};

const SYSTEM_INSTRUCTION_TEXT = `
你是一位资深的 QA 自动化测试工程师。
请深入分析提供的 API 文档，完成以下任务：

1. **提取环境配置**：提取 Base URL 和标准认证方式（如 Authorization Header）。
2. **识别特定参数**：
    - **非常重要**：仔细阅读每个接口的说明。如果某个接口特别要求特定的参数，如 \`app_key\`, \`app_secret\`, \`sign\`, \`timestamp\`, \`nonce\` 或业务 ID，**必须**将这些字段包含在生成的测试用例中。
    - **Header**: 如果接口需要特定的 Header (如 \`X-Channel-ID\`)，请放入 \`headers\` 字段。
    - 对于 GET 请求：将这些参数拼接到 \`endpoint\` 的查询字符串中。
    - 对于 POST/PUT 请求：将这些参数包含在 \`body\` JSON 结构中。
    - 如果文档只给出了字段名但没有值，请生成合理的占位符（例如 "YOUR_APP_KEY"）。

3. **生成测试用例**：
    - 覆盖正常路径 (Happy path) 和关键的错误场景。
    - **语言要求**：所有的 \`title\`（测试用例标题）和 \`description\`（测试意图描述）必须使用 **简体中文**。
    - 'endpoint' 必须是相对路径。
    - 'body' 字段必须是 JSON 字符串。
    - 'headers' 字段必须是 JSON 字符串 (Key-Value)。

返回格式必须是 **纯 JSON**，不要包含 Markdown 格式。
`;

// Schema for Gemini SDK (Used when provider is Gemini)
const GEMINI_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        config: {
            type: Type.OBJECT,
            properties: {
                baseUrl: { type: Type.STRING, description: "基础 URL" },
                authHeader: { type: Type.STRING, description: "标准认证 Header (如 Authorization)" },
                authToken: { type: Type.STRING, description: "Token 示例" }
            }
        },
        cases: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING, description: "测试用例标题（中文）" },
                    description: { type: Type.STRING, description: "测试用例描述（中文）" },
                    method: { type: Type.STRING, enum: ["GET", "POST", "PUT", "DELETE", "PATCH"] },
                    endpoint: { type: Type.STRING, description: "包含特定查询参数的路径" },
                    headers: { type: Type.STRING, description: "特定的请求头 JSON 字符串" },
                    body: { type: Type.STRING, description: "JSON 字符串" },
                    expectedStatus: { type: Type.INTEGER }
                },
                required: ["id", "title", "method", "endpoint", "expectedStatus", "body"]
            }
        }
    }
};

// --- GEMINI HANDLER ---
const callGemini = async (aiConfig: AIConfig, parts: any[]) => {
    const ai = new GoogleGenAI({ apiKey: aiConfig.apiKey });
    const response = await ai.models.generateContent({
        model: aiConfig.modelName || "gemini-2.5-flash",
        contents: { parts: parts },
        config: {
            systemInstruction: SYSTEM_INSTRUCTION_TEXT,
            responseMimeType: "application/json",
            responseSchema: GEMINI_SCHEMA
        }
    });
    return response.text;
};

// --- OPENAI COMPATIBLE HANDLER (DeepSeek, Tongyi) ---
const callOpenAICompatible = async (aiConfig: AIConfig, prompt: string) => {
    // DeepSeek/Tongyi usually don't support Schema Validation strictly like Gemini SDK
    // So we append the schema requirement to the prompt text.
    const strictPrompt = `
    ${SYSTEM_INSTRUCTION_TEXT}
    
    请严格按照以下 JSON 格式返回结果（确保 title 和 description 为简体中文）：
    {
      "config": { "baseUrl": "...", "authHeader": "...", "authToken": "..." },
      "cases": [
         {
           "id": "TC-001",
           "title": "测试用例标题(中文)",
           "description": "测试用例描述(中文)",
           "method": "GET|POST...",
           "endpoint": "/api/...",
           "headers": "{\\"Key\\":\\"Val\\"}",
           "body": "{\\"key\\":\\"val\\"}",
           "expectedStatus": 200
         }
      ]
    }
    `;

    const payload = {
        model: aiConfig.modelName,
        messages: [
            { role: "system", content: strictPrompt },
            { role: "user", content: prompt }
        ],
        stream: false,
        // Some providers support response_format: { type: "json_object" }
        // We try to use it if it's generally supported, otherwise relying on prompt is usually fine for these smart models.
        response_format: { type: "json_object" } 
    };

    const response = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiConfig.apiKey}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI API Request Failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    return content;
};


export const generateTestCases = async (
    documentation: string,
    importedFile: { mimeType: string; data: string } | undefined,
    aiConfig: AIConfig
): Promise<GeneratedTestPlan> => {
  try {
    if (!aiConfig.apiKey) {
        throw new Error("请在设置面板中配置 AI API Key");
    }

    let rawText = "";

    // 1. GEMINI PROVIDER (Supports Native Multimodal)
    if (aiConfig.provider === AIProvider.GEMINI) {
        const parts = [];
        let textPrompt = "请分析文档并生成详细的测试计划（请使用中文）。";
        if (documentation) {
            textPrompt += `\n\n补充文档/说明:\n${documentation}`;
        }
        parts.push({ text: textPrompt });

        if (importedFile) {
            parts.push({
                inlineData: {
                    mimeType: importedFile.mimeType,
                    data: importedFile.data
                }
            });
        }
        rawText = await callGemini(aiConfig, parts) || "";
    } 
    // 2. OTHER PROVIDERS (Text Only mostly)
    else {
        let fullPrompt = "请分析文档并生成详细的测试计划（请使用中文）。";
        if (documentation) {
            fullPrompt += `\n\n文档内容:\n${documentation}`;
        }
        
        // If file exists (e.g. PDF) but provider is not Gemini, we can't send binary easily via standard chat/completions text endpoint
        // Unless we use a vision model endpoint, but keeping it simple for now.
        if (importedFile && importedFile.mimeType === 'application/pdf') {
             fullPrompt += `\n\n[注意: 用户上传了一个 PDF 文件，但当前选用的模型可能无法直接读取二进制 PDF。请主要依据上述粘贴的文本内容。如果上方没有文本，请提示用户将 PDF 内容转换为文本粘贴。]`;
        }

        rawText = await callOpenAICompatible(aiConfig, fullPrompt) || "";
    }

    if (!rawText) {
        throw new Error("模型未返回任何内容");
    }
    
    // Clean potential markdown formatting
    const jsonStr = cleanJson(rawText);
    
    let parsedData;
    try {
        parsedData = JSON.parse(jsonStr);
    } catch (e) {
        console.error("JSON parse error:", e, rawText);
        throw new Error("模型返回的数据不是有效的 JSON 格式。请尝试重试。");
    }

    // Process cases: Parse 'body' and 'headers' string back to object
    const cases: TestCase[] = (parsedData.cases || []).map((item: any) => {
        let bodyObj = undefined;
        try {
            if (item.body) {
                // If AI returns object directly (DeepSeek sometimes does despite prompt), handle it
                bodyObj = typeof item.body === 'string' ? JSON.parse(item.body) : item.body;
                
                if (bodyObj && Object.keys(bodyObj).length === 0) {
                    bodyObj = undefined;
                }
            }
        } catch (e) {
            console.warn(`Failed to parse body JSON for case ${item.id}`, item.body);
        }

        let headersObj = undefined;
        try {
            if (item.headers) {
                 headersObj = typeof item.headers === 'string' ? JSON.parse(item.headers) : item.headers;
            }
        } catch (e) {
             console.warn(`Failed to parse headers JSON for case ${item.id}`, item.headers);
        }

        return {
            id: item.id || `TC-${Math.random().toString(36).substr(2, 9)}`,
            title: item.title,
            description: item.description,
            method: item.method as HttpMethod,
            endpoint: item.endpoint,
            headers: headersObj,
            body: bodyObj,
            expectedStatus: item.expectedStatus
        };
    });

    return {
        config: parsedData.config || {},
        cases: cases
    };

  } catch (error: any) {
    console.error("Failed to generate test cases:", error);
    throw new Error(error.message || "生成测试用例失败，请检查 API Key 或重试。");
  }
};
