# ClientMind AI Agent 技术实施方案 (Technical Specification)

**版本**: v2.2 (Kibana API Integration Update)  
**基于**: ClientMind PRD v1.6 & Elastic Agent Builder Hackathon Resources  
**生成日期**: 2026-01-27

---

## 1. 需求与资源深度分析

### 1.1 项目核心升级点 (v1.6)

- **双路 RAG 架构 (Dual-Path RAG)**: 将检索路径明确拆分为“私有记忆通道”（用户画像/交互）与“公共知识通道”（品牌文档），并行检索后由 LLM 融合。
- **原生数据处理 (Native Pipeline)**: 摒弃外部 ETL，全面采用 **Elastic Ingest Pipeline** 处理 PDF/文档解析与向量化。
- **控制台完整性**: 新增 `Settings` 页面，支持人设配置 (Persona) 和 安全开关 (Auto-Send Toggle)。

### 1.2 主办方资源利用策略

| 资源/技术                    | 用途         | 关键实现                                                                                  |
| :--------------------------- | :----------- | :---------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Elastic Agent Builder**    | **核心大脑** | 托管 Agent 逻辑、系统提示词 (System Prompt)、工具编排。                                   |
| **Elasticsearch Serverless** | **双路存储** | **Path A**: `clientmind_persona` (Profile) <br> **Path B**: `clientmind_knowledge` (Docs) |
| **Ingest Pipelines**         | **文档处理** | 使用 `attachment` 处理器解析 PDF，`inference` 处理器生成向量。                            |
| \*\*ES                       | QL\*\*       | **精准检索**                                                                              | 用于查询结构化数据（如：查询某用户上个月的退货记录）。 |
| **Kibana API**               | **通信链路** | Next.js 前端通过 API 与 Agent Builder 进行对话交互。                                      |

---

## 2. 技术架构设计

### 2.1 系统架构图 (Dual-Path RAG)

```mermaid
graph TD
    User[用户 (邮件/Web)] --> |1. 咨询请求| Frontend[Next.js App (ClientMind Console)]
    Admin[管理员] --> |0. 上传 PDF/MD| Frontend

    subgraph "Frontend Layer (ShipAny Template)"
        Frontend --> |2. 转发请求| Backend[Next.js API Handler]
        Frontend -- 上传 --> Backend
        Frontend -- 配置 --> Backend
    end

    subgraph "Elastic Cloud Serverless (The Brain)"
        %% Native Pipeline Path
        Backend -- PUT Document (Base64) --> Ingest[Ingest Pipeline: clientmind_pdf_processor]
        Ingest --> |Extract Text & Embed| Index_Knowledge[(clientmind_knowledge)]

        %% Agent Execution Path
        Backend --> |3. 调用 Agent API| AgentBuilder[Elastic Agent Builder]

        AgentBuilder --> |4. 意图识别| Router{Intent Router}

        %% Path A: Memory (Private)
        Router -- 用户咨询 --> Tool_Mem[Tool: lookup_history]
        Tool_Mem --> |ES|QL / Vector| Index_Persona[(clientmind_persona)]
        Tool_Mem --> |Vector| Index_Interactions[(clientmind_interactions)]

        %% Path B: Knowledge (Public)
        Router -- 政策/产品 --> Tool_Know[Tool: search_knowledge]
        Tool_Know --> |Vector (ELSER)| Index_Knowledge

        %% Fusion
        Tool_Mem --> Context[Context Window]
        Tool_Know --> Context

        Context --> |5. 融合推理| LLM[推理模型]
        LLM --> |6. 生成回复| Backend
    end

    subgraph "Evolution Loop"
        Backend --> |7. 异步: 提取新偏好| Evolution[Memory Processor]
        Evolution --> |Upsert| Index_Persona
    end
```

### 2.2 模块职责

1.  **ClientMind Console**:
    - **Dashboard** (`/activity/dashboard`): 感知/记忆/行动三面板，作为核心工作台。
    - **Knowledge Base** (`/activity/knowledge`): 文件上传与索引状态监控。
    - **Settings** (`/activity/settings`):
      - **Persona**: 配置 Agent 的 Tone (Friendly/Professional)，此配置将动态注入到 Agent 的 Prompt 中。
      - **Connection Status**: 调用 ES `_cluster/health` API 展示连接状态。
2.  **Elastic Agent Builder**:
    - **System Prompt**: 动态接收 `tone` 参数。
    - **Tools**: 明确区分 `search_memory` 和 `search_knowledge` 两个工具。

---

## 3. 核心功能模块实现方案

### 3.1 知识库原生处理 (Elasticsearch Native Pipeline)

#### A. 定义 Ingest Pipeline

```json
PUT _ingest/pipeline/clientmind_pdf_processor
{
  "description": "Extract text from PDF and generate embeddings using ELSER",
  "processors": [
    {
      "attachment": {
        "field": "data",
        "target_field": "attachment",
        "indexed_chars": -1,
        "properties": ["content", "title"]
      }
    },
    {
      "set": {
        "field": "content",
        "value": "{{attachment.content}}"
      }
    },
    {
      "inference": {
        "model_id": ".elser_model_2_linux-x86_64",
        "target_field": "content_embedding",
        "field_map": {
          "content": "text_field"
        }
      }
    },
    {
      "remove": {
        "field": ["data", "attachment"] // 清理原始 Base64 数据
      }
    }
  ]
}
```

### 3.2 隐私保护与记忆索引

#### 客户画像索引 (`clientmind_persona`)

```json
PUT clientmind_persona
{
  "mappings": {
    "properties": {
      "email": { "type": "keyword" },
      "privacy_level": { "type": "keyword" }, // public, internal, sensitive
      "preferences": {
        "properties": {
          "style": { "type": "text" },
          "allergies": { "type": "keyword" } // 关键警告
        }
      }
    }
  }
}
```

### 3.3 Agent Builder 集成与 API 规范

**API 接入点**:
Agent Builder 位于 Kibana 服务下。根据环境不同（Self-managed vs Cloud Serverless），API Base URL 有所区别。

- **Cloud Serverless**: `https://${KIBANA_URL}/api/agent_builder`
- **Space 支持**: 若在非 `default` Space 下开发，需添加 `/s/{space_id}` 前缀。
  - Example: `https://${KIBANA_URL}/s/my-hackathon-space/api/agent_builder/converse`

**关键 API 交互流程 (Next.js Backend)**:

1.  **Start Conversation (POST /converse)**:

    ```typescript
    const response = await fetch(
      `${KIBANA_URL}/s/${SPACE_ID}/api/agent_builder/converse`,
      {
        method: 'POST',
        headers: {
          Authorization: `ApiKey ${ELASTIC_API_KEY}`,
          'Content-Type': 'application/json',
          'kbn-xsrf': 'true', // 必须字段，防止 CSRF
        },
        body: JSON.stringify({
          agent_id: process.env.ELASTIC_AGENT_ID,
          input: userMessage, // 用户输入
          parameters: {
            // 动态注入到 System Prompt 的变量
            tone: 'Friendly',
            user_email: 'john@example.com',
          },
        }),
      }
    );
    ```

2.  **Tool Execution**:
    Agent Builder 会自动执行绑定的 ES|QL 和 Vector Search 工具，无需在 Next.js 端手动代理这些请求。Next.js 仅负责与 Agent 的高层对话交互。

3.  **Authentication**:
    必须使用具有 Kibana 访问权限的 API Key。
    - **Scope**: 需包含 `kibana:agent_builder` 相关权限。

### 3.4 MCP 服务接入 (新增)

为了满足黑客松对“外部 Agent 互联”的要求，并支持在 IDE (Trae/VSCode) 中直接调用 Agent Builder 工具进行调试，本项目配置了标准的 MCP Server 接口。

**接入配置:**

1.  **API Key 生成**:
    - 复制 `scripts/setup_mcp_api_key.txt` 中的 DSL。
    - 在 Kibana Dev Tools 中执行以生成专用 Key。
    - 权限范围：`read`, `view_index_metadata` (Indices), `feature_agent_builder.read` (Kibana)。

2.  **客户端配置**:
    - 复制 `mcp-config.template.json` 到本地 IDE 的 MCP 配置文件中 (如 `~/Library/Application Support/Code/User/globalStorage/mcp-servers.json` 或 Trae 对应位置)。
    - 填入 `ELASTIC_CLOUD_ID` 和步骤 1 生成的 `ELASTIC_API_KEY`。
    - 重启 IDE 即可在侧边栏看到 Elastic Agent 提供的工具。

**用途**:

- 允许开发者在 IDE 侧边栏直接测试 `lookup_customer_history` 等工具。
- 作为“Connect disconnected systems”赛道的有力佐证。

### 3.5 环境准备清单 (新增)

为确保项目顺利启动，开发前需完成以下配置：

1.  **Elasticsearch 实例**:
    - Provider: AWS (推荐)
    - Region: US East (N. Virginia)
    - 获取 `Cloud ID` 或 `Endpoint URL` 以及 `API Key`。

2.  **本地环境变量**:
    - 复制 `.env.example` 到 `.env.local`。
    - 填入 `ELASTIC_CLOUD_URL` 和 `ELASTIC_API_KEY`。

3.  **依赖安装**:
    - 运行 `pnpm install` 确保所有依赖就绪。
    - 确保 `@elastic/elasticsearch` 客户端库已安装。

---

## 4. 开发实施计划 (Sprint Plan)

### Phase 1: 原生 Pipeline 与数据层 (Day 1)

- [ ] 部署 ELSER 模型。
- [ ] 创建 `clientmind_pdf_processor` Pipeline。
- [ ] 创建三个核心索引：`persona`, `interactions`, `knowledge`。
- [ ] 编写 `seed_knowledge.js` 验证向量生成。

### Phase 2: 双路 Agent 构建 (Day 2)

- [ ] 在 Agent Builder 中配置 System Prompt (支持 `{{tone}}` 变量)。
- [ ] 绑定 `lookup_customer_history` 和 `search_knowledge_base`。

### Phase 3: 全栈开发 (Day 3-4)

- [ ] **Tab 2: 知识库 (`/activity/knowledge`)**: 实现文件拖拽上传 -> 转 Base64 -> POST ES Index。
- [ ] **Tab 3: Settings (`/activity/settings`)**:
  - 实现 Tone 选择器 (存储在 LocalStorage 或 DB)。
  - 实现 ES 连接状态检查 (API Route: `/api/status`).
- [ ] **Tab 1: Dashboard (`/activity/dashboard`)**: 集成所有组件。

---

## 5. 关键代码片段 (Next.js Upload Logic)

```typescript
// src/app/api/knowledge/upload/route.ts
import { Client } from '@elastic/elasticsearch';

const client = new Client({
  node: process.env.ELASTIC_CLOUD_URL,
  auth: { apiKey: process.env.ELASTIC_API_KEY },
});

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64Data = buffer.toString('base64');

  await client.index({
    index: 'clientmind_knowledge',
    pipeline: 'clientmind_pdf_processor',
    document: {
      filename: file.name,
      data: base64Data,
      category: 'policy',
      created_at: new Date(),
    },
  });

  return Response.json({ success: true });
}
```
