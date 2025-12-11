/**
 * Infiniax Proxy (流式余额修复版)
 * 1. 修复：当客户端开启流式时，/usage 查询也会以流式格式返回，解决“空回”问题。
 * 2. 功能：支持全模型、多 Key 轮询、Cherry Studio 防粘包。
 */

const UPSTREAM_URL = "https://infiniax.ai/api/chat/stream";
const BALANCE_URL = "https://infiniax.ai/api/usage"; 
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// --- 📜 模型列表 ---
const SUPPORTED_MODELS = [
  "openai/gpt-5-pro", "openai/gpt-5.1", "openai/gpt-5.1-chat", "openai/gpt-5.1-codex-max", 
  "openai/gpt-5", "openai/gpt-5-mini", "openai/gpt-5-nano", "openai/gpt-4o", 
  "openai/gpt-4-turbo", "openai/gpt-3.5-turbo",
  "anthropic/claude-sonnet-4.5", "anthropic/claude-opus-4.5", "anthropic/claude-haiku-4.5", 
  "anthropic/claude-opus-4.1", "anthropic/claude-sonnet-4", "anthropic/claude-3.7-sonnet", 
  "anthropic/claude-3.5-haiku", "anthropic/claude-3-opus",
  "google/gemini-3-pro-preview", "google/gemini-2.5-pro", "google/gemini-2.5-flash", 
  "google/gemini-flash-1.5", "google/gemini-1.5-flash",
  "meta-llama/llama-4-scout", "meta-llama/llama-4-maverick", "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-v3.2-exp", "deepseek/deepseek-v3.1-terminus", "deepseek/deepseek-chat",
  "x-ai/grok-4", "x-ai/grok-4-fast", "x-ai/grok-4.1-fast", "x-ai/grok-code-fast-1",
  "qwen/qwen3-max", "qwen/qwen3-coder-plus", "qwen/qwen-turbo", "z-ai/glm-4.6v",
  "minimax/minimax-m2", "moonshotai/kimi-k2-thinking", "amazon/nova-2-lite-v1:free", 
  "arcee-ai/trinity-mini:free", "microsoft/phi-3-medium-128k-instruct", "cohere/command-r-plus-08-2024"
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. 返回全量模型列表
    if (url.pathname === "/v1/models") {
      return new Response(JSON.stringify({
        object: "list",
        data: SUPPORTED_MODELS.map(id => ({ id, object: "model", created: 1700000000, owned_by: "proxy" }))
      }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }});
    }

    // 2. 处理对话
    if (url.pathname === "/v1/chat/completions" && request.method === "POST") {
      return handleChatCompletion(request);
    }

    // 3. 处理预检
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "*" }
      });
    }
    return new Response("Not Found", { status: 404 });
  }
};

async function handleChatCompletion(request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return new Response('{"error":"No Key"}', { status: 401 });
    
    // --- Key 处理 ---
    let apiKey = authHeader.split(" ")[1].replace(/，/g, ",");
    if (apiKey.includes(",")) {
        const keys = apiKey.split(",").map(k => k.trim()).filter(k => k);
        apiKey = keys[Math.floor(Math.random() * keys.length)];
    }

    const body = await request.json();
    const isStreaming = body.stream === true; // 检测客户端是否要求流式
    
    // --- 💰 指令拦截: /usage ---
    const lastMsg = body.messages[body.messages.length - 1].content.trim().toLowerCase();
    if (["/usage", "/balance", "查询余额", "查余额"].includes(lastMsg)) {
        // 关键修复：把 isStreaming 参数传进去
        return await handleBalanceQuery(apiKey, body.model, isStreaming);
    }

    // --- 正常转发 ---
    const response = await fetch(UPSTREAM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `connect.sid=${apiKey}`,
        "User-Agent": USER_AGENT,
        "Origin": "https://infiniax.ai",
        "Referer": "https://infiniax.ai/"
      },
      body: JSON.stringify({ modelID: body.model, messages: body.messages })
    });

    if (!response.ok) {
      if (response.status === 401) return new Response(JSON.stringify({ error: "Cookie 已失效" }), { status: 401 });
      return new Response(await response.text(), { status: response.status });
    }

    // === 模式 A: 流式 (Stream) ===
    if (isStreaming) {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      (async () => {
        const reader = response.body.getReader();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop(); 
            for (const line of lines) {
              if (!line.trim().startsWith("data: ")) continue;
              const jsonStr = line.trim().slice(6);
              if (jsonStr === "[DONE]") { await writer.write(encoder.encode("data: [DONE]\n\n")); continue; }
              try {
                const data = JSON.parse(jsonStr);
                if (data.chunk) {
                  const chunk = { id: "chatcmpl-"+Date.now(), object: "chat.completion.chunk", created: Date.now()/1000, model: body.model, choices: [{index:0, delta:{content:data.chunk}, finish_reason:null}] };
                  await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                  await new Promise(r => setTimeout(r, 5)); // 防粘包
                }
              } catch(e){}
            }
          }
        } catch(e) { await writer.write(encoder.encode(`data: {"error":"${e.message}"}\n\n`)); } 
        finally { await writer.close(); }
      })();
      return new Response(readable, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" }});
    } 
    
    // === 模式 B: 非流式 (Non-Stream) ===
    else {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");
        for (const line of lines) {
            if (line.trim().startsWith("data: ") && line.trim() !== "data: [DONE]") {
                try {
                    const data = JSON.parse(line.trim().slice(6));
                    if (data.chunk) fullContent += data.chunk;
                } catch(e){}
            }
        }
      }
      return new Response(JSON.stringify({
        id: "chatcmpl-" + Date.now(), object: "chat.completion", created: Math.floor(Date.now() / 1000), model: body.model,
        choices: [{ index: 0, message: { role: "assistant", content: fullContent }, finish_reason: "stop" }]
      }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }});
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

// --- 💰 余额查询 (支持流式伪装) ---
async function handleBalanceQuery(apiKey, model, isStreaming) {
    try {
        const res = await fetch(BALANCE_URL, {
            method: "GET",
            headers: { "Cookie": `connect.sid=${apiKey}`, "User-Agent": USER_AGENT }
        });
        
        let content = "";
        if (!res.ok) {
            content = `❌ 查询失败 (HTTP ${res.status})`;
        } else {
            const data = await res.json();
            const daily = data.dailyUsagePercent ?? "未知";
            const weekly = data.weeklyUsagePercent ?? "未知";
            const msg = data.message || "无提示信息";
            
            content = `💳 **Infiniax 用量统计**\n` +
                      `━━━━━━━━━━━━━━━━\n` +
                      `📊 **今日用量**: ${daily}%\n` + 
                      `📅 **本周用量**: ${weekly}%\n` + 
                      `📢 **提示**: ${msg}`;
        }

        // === 分支 1：如果是流式，必须返回 Stream 格式 ===
        if (isStreaming) {
            const encoder = new TextEncoder();
            const { readable, writable } = new TransformStream();
            const writer = writable.getWriter();

            (async () => {
                // 伪造一个流式数据包
                const chunk = {
                    id: "chatcmpl-balance-" + Date.now(),
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: model,
                    choices: [{ index: 0, delta: { content: content }, finish_reason: null }]
                };
                // 发送数据
                await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                // 发送结束信号
                await writer.write(encoder.encode("data: [DONE]\n\n"));
                await writer.close();
            })();

            return new Response(readable, {
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    "Access-Control-Allow-Origin": "*"
                }
            });
        }

        // === 分支 2：非流式，返回 JSON ===
        return new Response(JSON.stringify({
            id: "chatcmpl-balance",
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{ index: 0, message: { role: "assistant", content: content }, finish_reason: "stop" }]
        }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }});

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}