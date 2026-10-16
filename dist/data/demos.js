import { storageDemos } from './demos-storage.js';
import { retrievalDemos } from './demos-retrieval.js';
import { executionDemos } from './demos-execution.js';
import { engineeringDemos } from './demos-engineering.js';

export const demos = [...storageDemos, ...retrievalDemos, ...executionDemos, ...engineeringDemos];
export const demoById = Object.fromEntries(demos.map(d => [d.id, d]));

// 场景页直接引用对应项目的真实源码，避免另写一套不一致的伪 SDK。
export const scenarioRecipes = {
  'knowledge-assistant': {
    goal:'企业知识助手：让文档成为可追溯、可授权的回答证据。',
    boundary:'下面沿调用顺序展开各组件的场景核心代码。每份代码可以在自己的 Demo 项目中运行；它们是接入模块，不是一个已经装配好的端到端服务。整合时统一 tenantId、documentId、文档版本、Embedding 模型与向量维度。',
    steps:[
      {id:'document-parsing',role:'01 · 文档 → 文本与分块',join:'上传后保留对象键和内容哈希，解析器输出 chunkId、正文、来源位置。解析失败留在失败队列，不把空内容当入库成功。'},
      {id:'embedding',role:'02 · 分块 → 向量',join:'对分块批量调用 Embedding，检查返回顺序与维度。查询必须使用相同的模型版本；缓存键包含模型与预处理版本。'},
      {id:'pgvector',role:'03 · 向量 → 有权限的候选',join:'写入 chunkId、tenantId、向量、文档版本。用查询向量做 TopK，租户条件在检索 SQL 内；确保查询向量和入库向量使用相同的模型版本与维度。'},
      {id:'reranker',role:'04 · 候选 → 排序后的证据',join:'将候选正文交给重排模型，按返回 index 映射回原始 chunkId。保留引用与 ACL 元数据，重排不改变权限。'},
      {id:'ai-gateway',role:'05 · 证据 → 带引用的回答',join:'将已授权证据组织成上下文，请求模型时附 requestId。没有可靠证据时说明未找到，别让网关降级掩盖召回失败。'}
    ]
  },
  'business-agent': {
    goal:'业务操作 Agent：把模型提出的动作变成可授权、可幂等、可恢复的业务任务。',
    boundary:'模型只产出候选动作。应用在服务端确定用户/租户，校验参数、权限与必要的用户确认后，才进入下列模块。Demo 使用教学任务，不会调用真实支付或退款。',
    steps:[
      {id:'redis',role:'01 · 限流与短期协调',join:'进入工具执行前按可信身份限流。Redis 键过期或丢失不应解除业务幂等；最终唯一约束在数据库。'},
      {id:'postgres',role:'02 · 事务状态与 Outbox',join:'以业务幂等键创建任务，在同一事务写任务与待发布事件。冲突时返回已有任务，不能再扣款或再创建外部订单。'},
      {id:'rocketmq',role:'03 · 发布与异步消费',join:'Outbox 扫描器发送 eventId；Broker 确认后更新发布状态。崩溃窗口仍可能重复，所以消费者要用 eventId/业务键去重。'},
      {id:'temporal',role:'04 · 长流程与失败恢复',join:'需要跨天等待或多步编排时，用稳定 workflowId 启动流程。Activity 中的外部调用仍需业务幂等；消息队列和工作流按实际边界组合，不必同时引入。'}
    ]
  },
  'research-agent': {
    goal:'研究 Agent：检索资料、保留来源、运行受限计算，并汇总可复查的结论。',
    boundary:'下列示例覆盖检索、状态、计算和文件四个关键步骤。搜索结果是外部数据，不能成为工具权限指令；完成状态需建立在证据与工具返回校验之后。',
    steps:[
      {id:'elasticsearch',role:'01 · 检索相关资料',join:'先按租户和资料范围过滤，再召回资料。保存原始 documentId、版本和引用，不只保留模型生成的摘要。'},
      {id:'mongodb',role:'02 · 保存研究会话',join:'保留步骤结果与来源，按会话和租户恢复状态。TTL 可清理临时记忆；长期审计与正式交付物另行持久化。'},
      {id:'sandbox',role:'03 · 受限计算工具',join:'把固定小样本交给隔离进程，设置超时与输出上限。Java 检查退出码与 JSON 契约后才把结果写入会话。'},
      {id:'object-storage',role:'04 · 存储并授权下载报告',join:'报告先存私有桶，数据库记录对象键与所属租户。下载前实时鉴权，再签发短期 URL；URL 本身不是长期权限证明。'}
    ]
  },
  'production-architecture': {
    goal:'生产架构：把接入、配置、观测、成本与质量回归串起来。',
    boundary:'这些能力横跨一次请求的全链路。示例展示各组件的接入位置；采样率、指标标签、保留期限、配额与发布阈值要根据实际业务定义，不能直接照搬教学值。',
    steps:[
      {id:'nacos',role:'01 · 版本化配置',join:'启动时加载配置并监听更新；先校验新值再替换。模型别名与检索配置应记录版本，不把密钥作为普通可读配置。'},
      {id:'ai-gateway',role:'02 · 统一模型入口',join:'应用使用受控入口凭据，供应商凭据由网关管理。失败只在一层做有限重试，避免客户端、网关与 SDK 叠乘。'},
      {id:'observability',role:'03 · 定位慢请求与失败',join:'用 requestId/traceId 关联检索、重排、模型与工具 Span。跨队列传播上下文；不把提示词和密钥默认写进日志。'},
      {id:'clickhouse',role:'04 · 汇总用量与延迟',join:'异步写入用量事件，按租户、模型与时间窗口分析。区分请求次数、重试次数和计费 Token，避免重复事件导致费用虚高。'},
      {id:'evaluation',role:'05 · 变更前的效果回归',join:'用同一份脱敏样本比较新旧版本。检索质量、权限泄漏、工具正确性和成本分别检查；效果回归不能替代线上监控。'}
    ]
  }
};
