# 当前迁移验证记录

日期：2026-11-03。当前项目：`/Users/smzdm/IdeaProjects/ai-explorer`。

## Maven 管理范围

根 `pom.xml` 聚合 `rag` 和 `agent`，共用 Java 21、Spring AI 版本与 Maven 管理的 Node 22.19.0/npm 10.9.3。JavaScript 依赖版本继续由各模块 `package-lock.json` 锁定，Maven 统一安装、测试及代码检查。

## 已验证

- `mvn -pl agent verify` 于 13:37:16（UTC+8）完成，BUILD SUCCESS。
- Agent 的 5 个离线测试全部通过，ESLint 通过。
- 离线测试实际执行计算工具并保存 SQLite 会话，关闭后重新打开，确认同一请求复用结果、未重复调用预设模型。
- 修复了原 Agent 将字符串工具名传入 `pi-durable` 配置的问题；该版本框架要求传入工具注册对象。
- 只读确认现有 Qdrant 混合集合为 `simple_rag_hybrid_text-embedding-v4_1024`，244 个 point，原 `simple-rag-qdrant-data` 为 Docker 命名卷，不是旧项目目录下的绑定目录。
- 新配置继续使用原 Qdrant 端口/集合/数据卷，默认 Java HTTP 端口为 8081。
- 原向量网关密钥已保留到被忽略的 `rag/config/application-local.yml`，主配置和 JAR 不再硬编码该密钥。没有调用真实收费模型。

## 当前尚未通过的验收

- 根目录 `mvn verify` 于 13:37:27（UTC+8）停在 RAG 的文件存在检查：RAG `package.json` 与 `package-lock.json` 尚未完成迁移。
- 原先资料、测试和文档的迁移任务在启动阶段因执行工具错误（`Cursor user message action has no message_id`）失败，没有完成迁移。13:43（UTC+8）重新发起后，13:44 收到同样的启动错误；已停止重复启动这些后台任务。全部原 Java/前端测试、历史说明文档和 4 份已上传全文的迁移状态为待处理，尚未完成最终逐字节核验。
- 尚未验证新 JAR 启动、原文接口逐份读取、根 Maven 全量构建以及可选浏览器验收。
- 旧 `/Users/smzdm/IdeaProjects/simple-rag` 尚未删除。完整迁移、运行验证和资料完整性核验通过前保留旧目录。

历史验证记录在完成迁移后保留到 `docs/legacy/VERIFICATION.md`，它不能代替本次验证。
