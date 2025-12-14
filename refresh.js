const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("\n========================================");
console.log("   🔑 Infiniax 密钥配置工具 (自动刷新)   ");
console.log("========================================\n");

// 问题 1: Token
rl.question('1️⃣  请粘贴 X-Inference-Token (ZDdi开头的那串): \n> ', (token) => {
  if (!token.trim()) {
      console.log("❌ 错误: Token 不能为空！");
      rl.close();
      return;
  }

  // 问题 2: Cookie
  rl.question('\n2️⃣  请粘贴完整 Cookie (connect.sid=...): \n> ', (cookie) => {
    if (!cookie.trim()) {
        console.log("❌ 错误: Cookie 不能为空！");
        rl.close();
        return;
    }

    // 自动生成 .dev.vars 文件
    const content = `TOKEN=${token.trim()}\nCOOKIE=${cookie.trim()}`;
    
    try {
        fs.writeFileSync('.dev.vars', content);
        console.log("\n✅ 成功！配置文件 .dev.vars 已自动生成。");
        console.log("🚀 现在请运行: npx wrangler dev worker.js");
    } catch (e) {
        console.log("❌ 写入文件失败: " + e.message);
    }

    rl.close();
  });
});