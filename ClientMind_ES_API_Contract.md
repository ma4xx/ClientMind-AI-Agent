# ClientMind ES API 契约定义（面向 n8n 调用）

## 1. 文档目标

为项目内 API 统一封装 Elasticsearch 操作提供稳定契约，确保 n8n 工作流仅依赖 API 进行调用，并能完整实现“检索-草稿-写回”闭环。

## 2. 范围与边界

- 覆盖 ES 索引契约、管道契约、API 契约、状态字段与注意事项
- 不涉及 n8n 节点配置细节
- 不涉及 UI 设计与前端实现

## 3. Elasticsearch 索引契约

### 3.1 Knowledge 索引

- 索引名: clientmind_knowledge

字段

```json
{
  "chunk_id": "keyword",
  "source": "keyword",
  "chunk_text": "text",
  "content_embedding": "rank_features",
  "metadata": {
    "doc_type": "keyword",
    "uploaded_at": "date",
    "uploaded_by": "keyword",
    "doc_version": "keyword",
    "file_size": "long"
  }
}
```

### 3.2 Persona 索引

- 索引名: clientmind_persona

字段

```json
{
  "customer_email": "keyword",
  "tags": [
    {
      "label": "keyword",
      "type": "keyword",
      "source": "text",
      "date": "date",
      "confidence": "float"
    }
  ],
  "interaction_history": [
    {
      "summary": "text",
      "date": "date",
      "source_id": "keyword"
    }
  ]
}
```

### 3.3 Drafts 索引

- 索引名: clientmind_drafts

字段

```json
{
  "draft_id": "keyword",
  "email_id": "keyword",
  "customer_email": "keyword",
  "subject": "text",
  "original_body": "text",
  "draft_content": "text",
  "status": "keyword",
  "created_at": "date",
  "reasoning": "text"
}
```

## 4. Ingest Pipeline 契约

- Pipeline 名称: clientmind_pdf_processor
- 输入: Base64 文件流
- 输出字段: chunk_text, content_embedding, source, metadata
- 文本切分在 API 层完成，pipeline 仅负责抽取与向量化

## 5. API 契约定义

### 5.1 Knowledge Upload

- 路径: POST /api/knowledge/upload
- 入参

```json
{
  "file": "binary",
  "metadata": {
    "doc_type": "pdf",
    "doc_version": "2024-Q2",
    "uploaded_by": "user_id"
  }
}
```

- 出参

```json
{
  "document_id": "string",
  "status": "indexed"
}
```

### 5.2 Knowledge Search

- 路径: POST /api/knowledge/search
- 入参

```json
{
  "query_text": "string",
  "top_k": 3
}
```

- 出参

```json
{
  "hits": [
    {
      "chunk_id": "string",
      "source": "string",
      "chunk_text": "string",
      "score": 0.92,
      "metadata": {}
    }
  ]
}
```

### 5.3 Persona Get

- 路径: POST /api/persona/get
- 入参

```json
{
  "customer_email": "string"
}
```

- 出参

```json
{
  "tags": [],
  "interaction_history": []
}
```

### 5.4 Persona Upsert

- 路径: POST /api/persona/upsert
- 入参

```json
{
  "customer_email": "string",
  "tags": [
    {
      "label": "string",
      "type": "warning",
      "source": "string",
      "date": "2024-05-20",
      "confidence": 0.95
    }
  ],
  "interaction_history": [
    {
      "summary": "string",
      "date": "2024-05-20",
      "source_id": "email_id"
    }
  ]
}
```

- 出参

```json
{
  "updated": true,
  "version": "string"
}
```

### 5.5 Dual-RAG 聚合检索

- 路径: POST /api/rag/dual
- 入参

```json
{
  "customer_email": "string",
  "query_text": "string",
  "top_k": 3
}
```

- 出参

```json
{
  "memory": {
    "tags": [],
    "interaction_history": []
  },
  "knowledge": {
    "hits": []
  }
}
```

### 5.6 Draft Generate

- 路径: POST /api/draft/generate
- 入参

```json
{
  "email": {
    "email_id": "string",
    "subject": "string",
    "body": "string",
    "from": "string"
  },
  "memory": {},
  "knowledge": {},
  "persona_config": {
    "tone": "friendly",
    "agent_name": "Jessica"
  }
}
```

- 出参

```json
{
  "correlation_id": "string",
  "draft": "string",
  "reasoning": "string",
  "draft_id": "string"
}
```

### 5.7 Draft Approve + Send（当前流程未使用）

- 路径: POST /api/draft/approve
- 入参

```json
{
  "draft_id": "string",
  "approved_by": "user_id"
}
```

- 出参

```json
{
  "sent": true,
  "message_id": "string"
}
```

## 6. 状态字段与一致性要求

- 所有 API 返回统一 correlation_id 便于 n8n 与后台追踪
- persona 更新必须执行去重与合并策略
- Draft Generate 调用会自动落库 drafts 索引，并基于 new_memories 写回 persona

## 7. 注意事项与落地检查

- 检查现有索引 mapping 是否包含 content_embedding 且类型为 rank_features
- 检查 pipeline 名称是否与 API 使用一致
- 检查 ELSER 模型与 pipeline 输出字段一致
- persona tags 必须是嵌套结构避免覆盖
- 索引升级必须使用 alias 迁移，避免 n8n 配置失效

## 8. n8n 调用顺序建议

1. n8n 入站邮件 -> 调用 /api/classify
2. 命中咨询 -> 调用 /api/rag/dual
3. 调用 /api/draft/generate
4. 结束（draft 已自动存入 ES 且 persona 自动更新）
