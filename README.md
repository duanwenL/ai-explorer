# AI Explorer

AI 探索实验室，所有模块统一由根目录 `pom.xml` 管理。

- `rag`：Java 21 / Spring Boot 文档上传、混合检索及完整提取文本阅读，默认地址 http://127.0.0.1:8081/。
- `agent`：Node.js 工具调用与 SQLite 会话示例。Maven 管理 Node/npm 安装、依赖安装、测试、代码检查及演示启动；业务语言仍为 JavaScript。初次阅读从 [Agent 入门说明](agent/README.md) 开始。

## Maven 入口

IDEA 打开本目录根 `pom.xml`，Project SDK 和 Maven Runner JRE 选择 Java 21。

```bash
cd /Users/smzdm/IdeaProjects/ai-explorer
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH="$JAVA_HOME/bin:$PATH"
mvn verify
```

`mvn verify` 在同一个 Maven 构建中完成：Java 测试与 JAR 打包、RAG 页面测试/ESLint、Agent 离线测试/ESLint。首次执行会下载项目私有 Node 22.19.0/npm 10.9.3，并按照各模块 `package-lock.json` 安装 JavaScript 依赖，不修改系统 Java 或 Node。npm 锁文件仍是 JavaScript 依赖版本来源，Maven 是统一执行入口。

```bash
# 只验证指定模块。
mvn -pl rag verify
mvn -pl agent verify
# 启动文档检索服务，默认复用原有 Qdrant 集合。
mvn -pl rag spring-boot:run
# 执行不联网、不收费的 Agent 演示。
mvn -pl agent -Pdemo verify
```

真实聊天需要单独配置 `agent/.env` 中的 `CHAT_BASE_URL`、`CHAT_API_KEY`、`CHAT_MODEL`，支持工具调用的聊天模型可能产生费用；不会复用向量密钥。由用户明确执行：

```bash
mvn -pl agent -Pchat -Dchat.question="请用工具计算 18 × 7" verify
```

## 迁移和资料

旧项目说明与历史测试记录完整保留在 [rag/docs/legacy](rag/docs/legacy/README.md)，当前模块说明见 [rag/README.md](rag/README.md)。历史文档中的旧目录与旧 JAR 名称仅用于追溯；当前入口以本文件为准。

资料全文保存于 `rag/data/documents/<集合名>/<文档 ID>.json`。已迁移的本机配置为 `rag/config/application-local.yml`，可从模块或根目录启动时加载；环境变量优先。它包含私有配置，已被忽略，不随源码或 JAR 交付。分享和备份时区分源码与私有资料。

项目改名保留原 `simple_rag_hybrid_text-embedding-v4_1024` 集合、文档 ID、6333 端口和 Docker 命名卷 `simple-rag-qdrant-data`。已有 `simple-rag-qdrant` 容器直接复用，无需重传文档或执行 Compose。原先纯向量集合也保留，未自动改写。

备份资料需同时保留 `rag/data`、`rag/config/application-local.yml` 和 Qdrant 数据卷。构建输出、依赖缓存和 IDEA 缓存可以重新生成。

## 可选验收

真实 Qdrant 验收仅创建并清理临时集合，不写用户资料、不调用收费模型：

```bash
mvn -pl rag -Drag.qdrant-test=true -Dtest=QdrantLocalIntegrationTest test
```

浏览器/Python 对照测试默认关闭，历史说明中有运行方法；新迁移的实际验证结果见 [rag/VERIFICATION.md](rag/VERIFICATION.md)。
