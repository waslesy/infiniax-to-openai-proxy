# Infiniax to OpenAI Proxy

这是一个轻量级的 Cloudflare Worker 脚本，用于将 Infiniax 的 Web 接口转换为标准的 OpenAI 格式 API。

它能在你的本地电脑上启动一个 API 接口，让你在 **Cherry Studio**、**NextChat**、**沉浸式翻译** 等软件中免费使用 Infiniax 的 50+ 个模型（含 GPT-5, Llama 4, Grok 4 等）。

## 📂 项目结构

```text
infiniax-proxy/
├── worker.js        <-- (核心代理脚本)
├── refresh.js       <-- (密钥配置工具，防止填错)
├── .dev.vars        <-- (自动生成的配置文件，存密钥)
└── README.md        <-- (使用说明)
````

## ✨ 功能亮点

  - **🚀 全模型支持**：内置 GPT-5, Claude 3.7, Llama 4, Grok 4 等 50+ 个最新模型 ID。
  - **⚡️ 完美流式**：修复了 Cherry Studio 等客户端的流式传输报错 (防粘包优化)。
  - **🛡️ 极简配置**：提供命令行配置工具，自动处理 Cookie 和 Token 的格式，**杜绝手滑报错**。
  - **🔒 隐私安全**：代码中不硬编码任何密钥，密钥存储在本地环境变量中。

-----

## 🛠️ 快速开始

### 1\. 下载代码

下载本仓库的所有文件到本地任意空文件夹。

### 2\. 安装依赖

确保你的电脑已安装 [Node.js](https://nodejs.org/)。在该文件夹下打开终端 (CMD / PowerShell / Terminal)，运行：

```bash
npm install wrangler --save-dev
```

### 3\. 获取密钥 (关键步骤)

由于 Infiniax 升级了风控，现在我们需要获取 **两个** 关键参数。

1.  登录 [infiniax.ai](https://infiniax.ai)。
2.  按 `F12` 打开开发者工具，切换到 **Network (网络)** 面板。
3.  刷新页面，随便点击一个请求（或者发送一条对话）。
4.  在 **Request Headers (请求头)** 中找到以下两项并复制：
      * **`X-Inference-Token`**: 通常以 `ZDdi...` 开头的一长串字符。
      * **`Cookie`**: 以 `connect.sid=` 开头的完整字符串。

### 4\. 配置密钥 (使用工具)

为了防止复制粘贴出错，请直接运行我们准备好的配置工具：

```bash
node refresh.js
```

  * 按照提示粘贴你的 **Token**，回车。
  * 按照提示粘贴你的 **Cookie**，回车。
  * *工具会自动生成 `.dev.vars` 文件，配置完成！*

### 5\. 启动服务

```bash
npx wrangler dev worker.js
```

*看到绿色的 `Ready on http://localhost:8787` 即代表启动成功！*

-----

## ⚙️ 软件配置指南

保持终端窗口开启，在 **Cherry Studio** 或其他软件中新建提供商：

| 选项 | 内容 | 说明 |
| :--- | :--- | :--- |
| **提供商类型** | `OpenAI` | 必须选 OpenAI 兼容模式 |
| **API URL** | `http://localhost:8787/v1` | **注意**：一定要带 `/v1` |
| **API Key** | `123` | 随便填 (因为密钥已在本地配置好) |
| **模型** | 选择列表中的任意模型 | 如 `openai/gpt-5` |

-----

## ❓ 常见问题

**Q: 用了一段时间突然报错 401？**
A: 说明你的 Token 或 Cookie 过期了。

1.  去网页版 F12 抓取新的 Token 和 Cookie。
2.  运行 `node refresh.js` 重新录入。
3.  重启 `npx wrangler dev worker.js` 即可。

**Q: 为什么移除了余额查询？**
A: 官方接口变动频繁，为了保证核心对话功能的稳定性，我们精简了代码，专注于提供最稳的聊天体验。

-----

## ⚠️ 免责声明

本项目仅供技术研究与学习使用，请遵守当地法律法规。