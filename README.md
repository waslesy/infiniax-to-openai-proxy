# Infiniax to OpenAI Proxy

这是一个轻量级的 Cloudflare Worker 脚本，用于将 Infiniax 的 Web 接口转换为标准的 OpenAI 格式 API。

它是**纯本地运行**的，无需服务器，直接在你的电脑上启动一个 API 接口，供 Cherry Studio、NextChat、沉浸式翻译等软件调用。

## 📂 项目结构
```text
infiniax-proxy/
├── worker.js        <-- (核心运行代码)
├── README.md        <-- (使用说明书)
└── .gitignore       <-- (配置文件)
````

## ✨ 功能亮点

  - **🚀 全模型支持**：内置 GPT-5, Claude 3.7, Llama 4, Grok 4 等 50+ 个最新模型 ID。
  - **⚡️ 完美兼容**：修复了 Cherry Studio 等客户端的流式传输报错 (防粘包优化)。
  - **💳 余额查询**：在对话框发送 `/usage` 或 `查询余额` 即可查看 Infiniax 实时用量。
  - **🔒 隐私安全**：代码不保存任何 Key，所有鉴权通过本地透传，安全无忧。
  - **🔄 多账号轮询**：支持填入多个 Cookie (逗号分隔)，脚本会自动随机切换，实现负载均衡。

## 🛠️ 快速开始

### 1\. 下载代码

下载本仓库的 `worker.js` 文件到本地任意空文件夹。

### 2\. 安装依赖

确保你的电脑已安装 [Node.js](https://nodejs.org/)。在该文件夹下打开终端 (CMD / PowerShell / Terminal)，运行：

```bash
npm install wrangler --save-dev
```

### 3\. 获取 API Key (connect.sid)

1.  登录 [infiniax.ai](https://infiniax.ai)。
2.  按 `F12` 打开开发者工具，切换到 **Network (网络)** 面板。
3.  刷新页面，随便点击一个请求。
4.  在 **Request Headers** 中找到 `Cookie`。
5.  复制 `connect.sid=` 后面的那串字符（**不含分号**）。
    > *示例*: `s%3AHz7...` (这串字符就是你的 API Key)

### 4\. 启动服务

在终端运行：

```bash
npx wrangler dev worker.js
```

*首次运行时如果询问是否发送统计，输入 `n` 即可。*
*看到绿色的 `Ready on http://localhost:8787` 即代表启动成功！*

-----

## ⚙️ 软件配置指南

保持终端窗口开启，在 **Cherry Studio** 或其他软件中新建提供商：

| 选项 | 内容 | 说明 |
| :--- | :--- | :--- |
| **提供商类型** | `OpenAI` | 必须选 OpenAI 兼容模式 |
| **API URL** | `http://localhost:8787` | Cherry Studio 会自动补全后面的 /v1/... |
| **API Key** | `connect.sid` 的值 | 刚才抓取的那串字符 |
| **模型** | 选择列表中的任意模型 | 如 `openai/gpt-5` |

-----

## 💡 高级用法

### 💰 查看余额

在聊天窗口直接发送以下任一指令，即可收到漂亮的用量统计卡片：

  - `/usage`
  - `查询余额`

### 🔄 多账号轮询

如果你有多个账号，可以在 API Key 栏中填入多个 Cookie，使用**中文或英文逗号**分隔：

```text
Key1, Key2, Key3
```

*脚本会在每次对话时随机选择一个账号使用。*

-----

## ⚠️ 免责声明
本项目仅供技术研究与学习使用，请遵守当地法律法规。
