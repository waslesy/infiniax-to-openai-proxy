/**
 * Infiniax Proxy (极简稳定版)
 * 只做一件事：读取环境变量并转发对话。
 * 移除了查余额等易报错功能。
 */

// 📜 全模型支持
const SUPPORTED_MODELS = [
  "openai/gpt-5-pro", "openai/gpt-5", "openai/gpt-4o", "openai/gpt-4-turbo",
  "anthropic/claude-3.7-sonnet", "anthropic/claude-3.5-haiku",
  "meta-llama/llama-4-maverick", "meta-llama/llama-4-scout",
  "x-ai/grok-4", "deepseek/deepseek-v3.2-exp"
];

const UPSTREAM_URL = "https://infiniax.ai/api/chat/stream";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. 预检请求
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "*", "Access-Control-Allow-Headers": "*" }});
    }

    // 2. 模型列表
    if (url.pathname === "/v1/models") {
      return new Response(JSON.stringify({
        object: "list",
        data: SUPPORTED_MODELS.map(id => ({ id, object: "model", created: 1700000000, owned_by: "proxy" }))
      }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }

    // 3. 对话请求
    if (url.pathname.endsWith("/chat/completions") && request.method === "POST") {
      // 优先读环境变量，其次读客户端 Key
      let cookie = env.COOKIE;
      let token = env.TOKEN;
      
      const auth = request.headers.get("Authorization");
      if ((!cookie || !token) && auth && auth.includes("#####")) {
          const parts = auth.replace("Bearer ", "").trim().split("#####");
          token = parts[0]; cookie = parts[1];
      }

      if (!cookie || !token) {
          return new Response('{"error": "请先运行 node refresh.js 更新密钥！"}', { status: 401, headers: {"Content-Type": "application/json"} });
      }

      return handleChat(request, cookie, token, await request.json());
    }

    return new Response("Not Found", { status: 404 });
  }
};

async function handleChat(request, cookie, token, body) {
  try {
    const response = await fetch(UPSTREAM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": cookie,
        "X-Inference-Token": token,
        "User-Agent": USER_AGENT,
        "Origin": "https://infiniax.ai",
        "Referer": "https://infiniax.ai/",
        "sec-ch-ua": '"Microsoft Edge";v="143", "Not=A?Brand";v="8", "Chromium";v="143"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"'
      },
      body: JSON.stringify({ modelID: body.model, messages: body.messages })
    });

    if (!response.ok) return new Response(await response.text(), { status: response.status });

    // 流式转发 (Cherry Studio 专用格式修正)
    if (body.stream) {
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
              if (line.trim().startsWith("data: ")) {
                const jsonStr = line.replace("data: ", "").trim();
                if (jsonStr === "[DONE]") continue;
                try {
                  const data = JSON.parse(jsonStr);
                  if (data.chunk) {
                    const chunk = { id: "chat", object: "chat.completion.chunk", created: Date.now()/1000, model: body.model, choices: [{index:0, delta:{content:data.chunk}, finish_reason:null}] };
                    await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                  }
                } catch (e) {}
              }
            }
          }
          await writer.write(encoder.encode("data: [DONE]\n\n"));
        } catch (e) {} finally { await writer.close(); }
      })();
      return new Response(readable, { headers: { "Content-Type": "text/event-stream", "Access-Control-Allow-Origin": "*" } });
    }
    
    // 非流式转发
    const text = await response.text();
    let content = "";
    text.split("\n").forEach(line => {
        if(line.startsWith("data: ")) {
            try { content += JSON.parse(line.slice(6)).chunk || ""; } catch(e){}
        }
    });
    return new Response(JSON.stringify({
        id: "chat", object: "chat.completion", created: Date.now()/1000, model: body.model,
        choices: [{index:0, message:{role:"assistant", content}, finish_reason:"stop"}]
    }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });

  } catch (e) { return new Response(JSON.stringify({error: e.message}), {status: 500}); }
}