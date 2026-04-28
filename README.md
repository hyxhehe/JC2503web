# 🎮 JC2503 Web 多人方块对战游戏

一个基于 Node.js + Express + WebSocket 的实时多人在线游戏项目，支持多玩家同时在线、回合制对战、自动超时移除与实时分数统计。

---

## 📌 项目简介
本项目是 JC2503 Web 应用开发课程的期末作业，实现了一个多人在线回合制方块放置游戏：
- 玩家进入房间后自动加入回合队列
- 按回合轮流在 4×4 棋盘上放置方块
- 超时玩家会被自动移除，回合自动流转
- 实时广播游戏事件（玩家加入/离开、回合提示、超时通知）
- 支持多用户同时在线，状态实时同步

---

## 🛠️ 技术栈
- **后端**：Node.js + Express
- **实时通信**：WebSocket (`ws` 库)
- **前端渲染**：EJS 模板引擎
- **样式**：原生 CSS
- **版本控制**：Git + GitHub

---

## 🚀 快速启动

### 1. 安装依赖
```bash
npm install

2. 启动服务器
node server.js


3. 访问游戏
打开浏览器，访问：
http://localhost:3000

🎯 核心功能
✅ 多玩家同时在线
✅ 回合制对战系统
✅ 玩家超时自动移除（60 秒）
✅ 实时游戏事件通知（Game Messages）
✅ 玩家分数与回合顺序展示
✅ 主动 / 被动退出处理
✅ 响应式游戏界面


📁 项目结构
game_project/
├── public/
│   ├── css/
│   │   └── style.css       # 游戏界面样式
│   └── js/
│       └── game.js         # 前端游戏逻辑与WebSocket通信
├── views/
│   ├── index.ejs           # 首页
│   ├── game.ejs            # 游戏主界面
│   └── about.ejs           # 项目说明页
├── server.js               # 后端服务器与WebSocket核心逻辑
├── package.json            # 项目依赖配置
└── README.md               # 项目说明文档

📝 作业说明
本项目严格遵循 JC2503 课程作业要求，实现了所有指定功能：
实时多人游戏逻辑
玩家状态同步
游戏事件通知
超时与退出处理
界面交互与用户体验优化

👨‍💻 开发者
hyxhehe

---

### 使用说明
1.  在项目根目录新建一个文件，命名为 `README.md`
2.  把上面的内容完整复制进去
3.  保存后，执行这两条命令同步到 GitHub：
    ```bash
    git add README.md
    git commit -m "add README"
    git push









