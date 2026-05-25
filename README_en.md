# Law Assistant
[![日本語版](https://img.shields.io/badge/Document-日本語-blue)](./README.md)

An intelligent legal consulting assistant powered by LangChain and the Model Context Protocol (MCP). Specialized in answering Japanese legal questions and providing professional guidance.

## 🚀 Live Demo

**[🌐 Try the Online Demo](https://l2533584225-las.hf.space)**

## 🌟 Key Features

- 🤖 **Intelligent Q&A**: Advanced legal reasoning using state-of-the-art LLMs (GPT-4o, Claude 3.5 Sonnet, etc.).
- 🔍 **Legal Document Search**: Deep retrieval across thousands of Japanese laws and cases via `legal-mcp`.
- 🌐 **Real-time Web Search**: Access to current news and recent legal amendments using `webmcp`.
- 📱 **Multi-Interface**: Native support for a modern **Web UI**, **CLI**, and **LINE Bot**.
- 🛠️ **MCP Architecture**: Highly extensible and secure tool execution environment via Model Context Protocol.
- 🔐 **Enterprise Ready**: JWT authentication, session management, and role-based access control.

## 🚀 Quick Start (Docker)

The fastest way to get started is using Docker Compose.
```bash
git clone https://github.com/lijunjie2232/mylawer.git
cd mylawer
git submodule update --init --recursive
cp .env.example .env
```

> Edit .env and set your LLM_API_KEY

```bash
docker-compose -f docker-compose-demo.yaml up -d --build
```

Once running, visit [http://localhost:3000](http://localhost:3000).
- **Default Admin Email**: `admin@example.com`
- **Default Admin Password**: `Admin123!@#`

## 📚 Documentation

For comprehensive guides, please refer to our Starlight-based documentation:

- **English Docs**: [./docs/src/content/docs/en/index.mdx](./docs/src/content/docs/en/index.mdx) (or the deployed site)
- **Getting Started**: [Quick Start Guide](/en/getting-started/quickstart/)
- **Architecture**: [System Overview](/en/concepts/overview/)
- **Configuration**: [Environment Variables](/en/config/environment/)

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, TypeScript
- **AI Orchestration**: LangChain, LangGraph
- **Protocol**: Model Context Protocol (MCP)
- **Frontend**: React, Vite, Tailwind CSS
- **Database**: PostgreSQL, Prisma
- **Deployment**: Docker, supervisord

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

See the [LICENSE](./LICENSE) file for details.

---

⚠️ **Disclaimer**: The information provided by this assistant is for reference only and does not constitute legal advice. Always consult with a qualified attorney before making critical decisions.
