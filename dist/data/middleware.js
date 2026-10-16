// 面向 Java 开发者的中间件学习内容；示例是有明确前提的教学片段。
// 官方资料核对日期：2026-10-14。SDK、托管服务能力与兼容版本请以链接文档为准。
export const middlewares = [
  {
    id: 'postgres', title: 'PostgreSQL', category: '存储', tagline: '把任务、权限和执行结果变成可恢复的事实',
    level: '入门', minutes: 18, priority: '核心', kind: 'middleware',
    summary: 'Agent 会生成不确定的推理过程，但订单是否创建、任务是否完成、谁能看某份资料，必须有确定的记录。PostgreSQL 适合保存用户、租户、会话元数据、任务状态、工具调用记录和知识文档元数据。把它理解为业务事实的主账本，再用向量索引和缓存提供不同的访问方式。已有稳定 MySQL 体系时，也不必为了 Agent 强行更换关系库。',
    when: ['需要任务重启后恢复、历史审计或多租户数据隔离。', '需要用事务同时更新业务状态与待发布事件。', '希望在同一数据库中组合 SQL、JSONB 和 pgvector，减少初期运维组件。'],
    notFor: ['把所有 PDF、音视频二进制都塞进数据库。', '在数据库事务中等待几十秒的模型生成或人工审批。'],
    concepts: [
      { title: '事务是业务边界', text: '一个事务让一组数据库变更一起成功或一起回滚。例如完成任务时，同时写结果记录和待发送通知事件。它不会自动把远程模型 API、对象存储、支付接口也纳入同一个原子操作。跨系统需要幂等、补偿或事件驱动设计。' },
      { title: '状态机与并发控制', text: '用 PENDING、RUNNING、SUCCEEDED、FAILED 表达任务生命周期，并限制合法迁移。通过版本号条件更新或行锁避免两个 Worker 同时完成同一任务。更新影响行数为零时，应该视为竞争或状态变化，而不是继续执行。' },
      { title: 'JSONB 与结构化列', text: '租户、状态、创建时间等稳定且经常过滤的字段适合独立列；变化较多的工具输出可放 JSONB。灵活存储不意味着无约束，仍应限制大小、记录工具版本，并为实际查询建立索引。' }
    ],
    flow: ['请求生成稳定 request_id', '事务创建任务与 outbox 事件', 'Worker 领取任务并调用工具', '短事务提交结果与状态', '读取结果或按事件继续下一步'],
    sections: [
      { title: '在 Java 服务中放在哪一层', paragraphs: ['Controller 负责认证与参数校验，应用服务决定状态迁移，Repository 用 JDBC、MyBatis 或 JPA 持久化。模型返回“执行成功”不等于任务成功，应用必须拿到工具接口的真实结果后再提交业务状态。', '对高风险业务保留 tool_call_id、request_id、参数摘要、结果和版本。敏感原始参数不应无差别写入日志，必要时保存脱敏摘要和受控引用。'], bullets: ['长时间模型调用放在事务外。', '租户条件由服务端身份注入，不能让模型自由指定。'] },
      { title: '最小使用示例：建立任务账本', paragraphs: ['前提：已运行 PostgreSQL，并用 psql 或数据库客户端连接到学习数据库。以下 SQL 可以独立执行一次；再次执行建表前应使用新数据库或清理同名教学表。三维向量不是本节内容，先把任务状态建模清楚。'], bullets: ['实际 Java 项目用 Spring JDBC / MyBatis 绑定参数；不要拼接模型生成的 SQL。', '对 UPDATE 检查影响行数，并在确实完成工作后提交。'], code: { language: 'sql', label: 'PostgreSQL · 任务表与条件更新', value: `CREATE TABLE agent_task (
  id bigserial PRIMARY KEY,
  tenant_id bigint NOT NULL,
  request_id varchar(100) NOT NULL,
  status varchar(20) NOT NULL,
  version integer NOT NULL DEFAULT 0,
  result jsonb,
  UNIQUE (tenant_id, request_id)
);
INSERT INTO agent_task (tenant_id, request_id, status)
VALUES (1, 'req-demo-001', 'PENDING');

UPDATE agent_task
SET status = 'RUNNING', version = version + 1
WHERE tenant_id = 1 AND request_id = 'req-demo-001'
  AND status = 'PENDING' AND version = 0;` } },
      { title: '先学哪些能力', paragraphs: ['先掌握唯一约束、复合索引、事务隔离、乐观锁、连接池和执行计划。Agent 场景新增的重点是幂等请求与执行记录，而不是另一套数据库理论。', '数据库写入成功但消息发送失败是典型双写问题。可以在同一事务写业务表和 outbox 表，再由独立发布器重试发送；消费者仍需去重。备份必须配合恢复演练，不能把“有备份文件”当成能够恢复。'], bullets: ['先按 tenant_id + status + created_at 等真实访问路径设计索引。', '索引、连接池和慢查询问题有观测证据后再调参。'] }
    ],
    decisions: [
      { option: 'PostgreSQL + pgvector', fit: '希望快速交付具有业务数据与知识检索的单体服务。', tradeoff: '减少组件，但分析或向量负载可能与事务负载争抢资源。' },
      { option: '沿用 MySQL', fit: '团队已有成熟备份、监控、运维与 SQL 经验。', tradeoff: '向量检索通常另接专用引擎或合适的托管能力。' }
    ],
    pitfalls: ['在 @Transactional 方法里等待模型网络请求，导致连接和锁长时间占用。', '只存对话文本，不存工具执行事实；事后无法区分“模型说做了”和“系统确实做了”。', '把 Redis 中的任务状态当唯一记录，缓存淘汰后无法恢复。'],
    qa: [
      { q: 'Agent 已经有 Memory，为什么还需要关系型数据库？', a: 'Memory 通常解决上下文与历史信息如何被模型使用，关系库解决业务状态如何可靠保存和约束。一个退款 Agent 可以忘记上轮闲聊，但不能忘记退款是否执行。应把任务、幂等键、权限和执行结果存为事实，再按需要选取事实生成上下文，不能反过来靠聊天记录推断真实业务状态。' },
      { q: '数据库事务能保证工具调用只执行一次吗？', a: '不能。远程接口成功后，服务可能在本地提交前崩溃；恢复后再调用就会产生重复副作用。应给业务动作生成稳定幂等键，让下游保存并返回已有结果；本地用唯一约束记录动作，并补充查询、对账与补偿流程。事务保证数据库内部的原子性，端到端效果需要跨系统协议配合。' }
    ],
    sources: [{ label: 'PostgreSQL：事务', url: 'https://www.postgresql.org/docs/current/tutorial-transactions.html' }, { label: 'PostgreSQL：JSON 类型', url: 'https://www.postgresql.org/docs/current/datatype-json.html' }],
    related: ['mysql', 'pgvector', 'redis', 'reliability', 'business-agent']
  },
  {
    id: 'mysql', title: 'MySQL', category: '存储', tagline: '沿用 Java 业务系统的事务底座',
    level: '入门', minutes: 16, priority: '核心', kind: 'middleware',
    summary: '如果团队的订单、审批和用户体系已经建立在 MySQL 上，Agent 通常应该通过现有业务服务使用这些数据。MySQL 保存的是业务事实与约束；Agent 提供的是新的交互和决策入口。学习重点是如何把不确定的自然语言请求转换为有权限、可校验、可幂等的业务命令，而不是让模型直接拿数据库超级账户执行任意 SQL。',
    when: ['现有 Java 业务系统已经使用 MySQL、MyBatis 或 JPA。', '工具调用需要更新订单、审批单、任务和审计记录。', '知识内容来自业务数据库，需要通过增量同步更新检索索引。'],
    notFor: ['用大量 LIKE 查询代替专业语义检索。', '让 Agent 绕过业务服务直接修改生产数据。'],
    concepts: [
      { title: 'InnoDB 与事务', text: 'InnoDB 提供事务、行级锁和多版本并发控制。事务边界应与业务命令一致，例如创建审批记录和更新申请状态。隔离级别解决并发读写可见性，但不会替代唯一约束、明确的状态条件和失败处理。' },
      { title: '唯一键是幂等的一道防线', text: '为租户与请求编号建立唯一约束，重复提交时返回已有任务。不要只在 Java 中先查询再插入：两个并发请求可能同时查到不存在。最终并发约束需要数据库参与，服务再把唯一键冲突转换成业务语义。' },
      { title: 'CDC 与检索副本', text: 'CDC 从数据库变更中构建下游索引，适合频繁变化的商品、政策和业务知识。检索系统是可重建的读模型，需要记录业务主键、版本、删除标记和同步延迟，不能把检索命中误认为最新业务状态。' }
    ],
    flow: ['自然语言转换为明确业务意图', '服务端鉴权与规则校验', '事务修改 MySQL 业务记录', 'CDC 或 outbox 发布变更', '检索索引更新并记录版本'],
    sections: [
      { title: '让工具成为业务入口', paragraphs: ['优先暴露 getOrder、createApproval 等具名工具，参数由 JSON Schema 描述，服务端再做约束校验。模型只能建议调用；金额范围、租户、审批人和状态迁移都由业务代码决定。', '查询型 Agent 若必须生成 SQL，应限定只读数据源、允许的表与字段、查询时间和返回行数。权限要落到数据库与服务层，不能仅靠提示词要求模型自律。'], bullets: ['业务工具复用现有 Java 服务，保留原有权限检查。', '回答中的订单状态应来自最新业务查询，而不是旧向量片段。'] },
      { title: '最小使用示例：幂等请求记录', paragraphs: ['前提：MySQL 8.x 学习数据库，使用 InnoDB。以下 SQL 展示唯一键约束；真实请求使用 PreparedStatement、JdbcTemplate 或 MyBatis 参数绑定。重复插入会触发唯一约束，应用捕获后按 tenant_id 和 request_id 查询原任务。'], bullets: ['不要用 INSERT IGNORE 忽略所有异常后直接宣称业务成功。', '这只是本地重复请求控制，远程工具也需要相同的业务幂等标识。'], code: { language: 'sql', label: 'MySQL · 请求表', value: `CREATE TABLE agent_request (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id BIGINT NOT NULL,
  request_id VARCHAR(100) NOT NULL,
  state VARCHAR(20) NOT NULL,
  result JSON,
  UNIQUE KEY uk_tenant_request (tenant_id, request_id)
) ENGINE = InnoDB;

INSERT INTO agent_request (tenant_id, request_id, state)
VALUES (1, 'create-approval-001', 'PENDING');

SELECT id, state, result FROM agent_request
WHERE tenant_id = 1 AND request_id = 'create-approval-001';` } },
      { title: '如何判断要不要再引入 PostgreSQL', paragraphs: ['先看团队现有资产和目标负载。业务记录已经在 MySQL，且有独立检索引擎时，新增 PostgreSQL 可能只是增加备份、监控和运维成本。只有希望复用特定扩展能力，或建立新的独立业务边界时，再比较迁移与新增成本。', 'Java 开发者可沿着“幂等接口—事务状态机—outbox／CDC—索引更新”学习，这条路径在 Agent 系统和普通分布式业务系统中都适用。'], bullets: ['关注慢查询、连接池饱和和死锁重试。', 'CDC 延迟、索引版本与删除同步应可观测。'] }
    ],
    decisions: [{ option: 'MySQL + 独立检索', fit: '已有 MySQL 业务系统，知识检索需要独立扩展。', tradeoff: '需处理双系统同步和最终一致性。' }, { option: 'PostgreSQL + pgvector', fit: '新项目希望把业务与初期向量检索放在一个系统。', tradeoff: '要引入新的运维经验，并关注资源竞争。' }],
    pitfalls: ['用模型生成的 tenant_id 作为可信租户条件，造成越权查询。', '文档已撤销但向量索引没有同步删除，Agent 继续引用旧规则。'],
    qa: [
      { q: '有了向量数据库，为什么还保留 MySQL？', a: '向量检索擅长从语义相近的内容中找候选，MySQL 擅长保存准确的业务状态并实施约束。商品介绍可以向量检索，库存和订单状态应实时查询业务服务。让检索库代替交易主库，会把索引延迟和近似匹配带进业务判断，无法承担库存扣减、唯一请求和审计这类确定性要求。' },
      { q: 'Agent 能直接把用户问题转成 SQL 吗？', a: '可以作为受控查询能力，但不能等同于任意数据库访问。应先限定数据集和只读权限，再验证语句类型、字段权限、扫描成本与结果数量。涉及写操作时更适合调用具名业务接口。提示词有助于约束意图，服务端验证与数据库权限才是实际边界，查询还需要记录审计信息。' }
    ],
    sources: [{ label: 'MySQL：InnoDB 事务模型', url: 'https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-model.html' }, { label: 'MySQL：唯一索引', url: 'https://dev.mysql.com/doc/refman/8.4/en/create-index.html' }],
    related: ['postgres', 'business-agent', 'tool-calling', 'reliability', 'elasticsearch']
  },
  {
    id: 'redis', title: 'Redis', category: '存储', tagline: '为热点读取、限流和短期状态提速',
    level: '入门', minutes: 16, priority: '核心', kind: 'middleware',
    summary: 'Redis 在 Agent 中最常见的角色是加速与协调：缓存工具查询结果、记录短期会话摘要、按用户限流，以及临时去重。它提供低延迟数据访问，但缓存可能过期、被淘汰或在故障切换时丢失部分写入。支付结果、任务完成记录和审批状态仍应保存在有明确持久化与恢复保障的业务系统里。',
    when: ['相同权限范围内的工具查询经常重复，且结果允许短时间陈旧。', '模型供应商有并发或配额限制，需要统一限流。', '希望快速读取短期状态，且能够从主存储重建。'],
    notFor: ['把缓存中的任务状态作为唯一事实源。', '直接按问题文本缓存所有用户的回答，忽略权限与知识版本。'],
    concepts: [
      { title: 'TTL 与失效策略', text: 'TTL 是缓存可接受陈旧程度的表达，不是随便选一个时间。商品价格、企业制度和公开常识的更新频率不同。缓存键要包含租户、权限范围、模型或知识版本，必要时通过事件主动失效。' },
      { title: '内存淘汰与持久化', text: 'RDB 保存某时刻快照，AOF 记录写操作；两者改善恢复能力，但具体丢失窗口受配置和故障类型影响。内存淘汰则可能按策略删除键。关键业务不能因“开启 AOF”就省略幂等记录和可靠状态存储。' },
      { title: '原子操作不等于完整业务原子性', text: 'SET NX、INCR、Lua 脚本可以实现单个 Redis 操作范围内的协调。若一次操作还要调用模型和写数据库，Redis 原子性不会覆盖这些外部步骤。分布式锁也需要唯一持有者标识、超时与安全释放。' }
    ],
    flow: ['基于租户与知识版本构造缓存键', '命中则返回允许复用的结果', '未命中调用可靠数据源', '写入带 TTL 的缓存', '业务变更时主动失效或等待短期过期'],
    sections: [
      { title: '先缓存确定性工具结果', paragraphs: ['例如“查询门店营业时间”比“帮我处理投诉”更适合缓存。前者是明确查询，后者可能执行业务动作，复用回答会掩盖实际执行情况。语义缓存还可能把相似但不同的用户意图混在一起，应在准确匹配缓存稳定后再评估。', '为热点 key 设置合适过期时间与随机抖动，必要时合并并发请求，避免大量请求同时穿透到数据库或模型服务。缓存不可用时是否允许回源，要结合下游承载能力决定。'], bullets: ['缓存键是数据访问边界的一部分。', '缓存命中率之外，还要观察陈旧结果与错误复用。'] },
      { title: '最小使用示例：带期限的查询缓存', paragraphs: ['前提：Spring Boot 项目已加入 spring-boot-starter-data-redis，配置可连接的 Redis，并通过构造器注入 StringRedisTemplate。以下是服务方法片段；resultJson 来自已完成鉴权的业务查询。'], bullets: ['正式缓存键应包含业务主键、租户与数据版本。', '获取到 null 时回源；不能把缓存缺失解释为业务记录不存在。'], code: { language: 'java', label: 'Spring Data Redis · 方法片段', value: `// 依赖：org.springframework.boot:spring-boot-starter-data-redis
// 字段：private final StringRedisTemplate redis;
String key = "agent:tool:tenant:1:policy:v3:leave";
String cached = redis.opsForValue().get(key);
if (cached != null) {
    return cached;
}
String resultJson = policyService.queryForCurrentUser();
redis.opsForValue().set(key, resultJson, Duration.ofMinutes(5));
return resultJson;` } },
      { title: '限流与短期去重', paragraphs: ['限流的目的是保护模型配额、工具接口和费用预算，可以按租户、用户、模型分别计数。固定窗口简单但边界可能突发，滑动窗口与令牌桶更平滑。不要只限制每秒请求数，还要控制正在运行的长请求数量。', '临时去重适合抑制重复点击，最终幂等仍依赖数据库唯一键和下游业务幂等。若 Redis 键过期后同一动作再次到达，系统仍必须能够识别已完成动作。'], bullets: ['缓存、限流、锁最好规划不同 key 前缀与容量预算。', '必要时隔离缓存实例与协调实例，避免淘汰策略互相影响。'] }
    ],
    decisions: [{ option: '先不加 Redis', fit: '本地单用户学习站或低并发服务，数据库已满足延迟要求。', tradeoff: '组件少，但重复模型与工具查询可能增加成本。' }, { option: 'Redis 缓存与限流', fit: '出现热点查询、共享配额和并发控制需求。', tradeoff: '新增失效、容量、故障降级与权限隔离设计。' }],
    pitfalls: ['只用问题文本作为缓存键，跨租户返回其他人的检索内容。', '用 SETNX 标记成功后才真正执行任务，进程崩溃导致任务被永久跳过。', '把锁过期视为工作必然结束，旧 Worker 仍可能继续执行外部动作。'],
    qa: [
      { q: 'Redis 很快，为什么不把 Agent 所有数据都存进去？', a: '速度只是一个维度。任务历史、业务约束、复杂查询、审计与恢复需要更完整的数据模型；缓存还可能因为 TTL 或容量策略消失。可以用 Redis 提供快速视图，但必须说明丢失后如何重建。对于无法重建的业务事实，先选择有明确持久化、事务和备份策略的主存储，再决定是否增加缓存。' },
      { q: 'Agent 回答能不能直接做缓存？', a: '能，但要限定可复用边界。答案可能依赖用户身份、权限、历史对话、知识版本、实时业务数据和模型参数。缓存键缺少任一重要条件，都可能返回过时或越权内容。建议先缓存确定性工具查询与公开知识结果，再根据命中质量评估答案缓存；有副作用的动作不能靠缓存回答替代真实执行。' }
    ],
    sources: [{ label: 'Redis：持久化', url: 'https://redis.io/docs/latest/management/persistence/' }, { label: 'Spring Data Redis：文档', url: 'https://docs.spring.io/spring-data/redis/reference/' }],
    related: ['postgres', 'context-memory', 'ai-gateway', 'reliability']
  },
  {
    id: 'object-storage', title: '对象存储 · OSS / COS / S3', category: '存储', tagline: '原始文件与生成产物的长期归档层',
    level: '入门', minutes: 14, priority: '核心', kind: 'middleware',
    summary: '企业知识助手需要保留 PDF 原件、解析后的 Markdown、图片、音频和生成的报告。这些文件适合放在对象存储，由数据库保存对象键、版本、校验值和权限。国内项目可评估 OSS、COS、OBS；自建可评估具备 S3 兼容接口的存储。它解决文件的保存与访问，文档解析、语义检索和访问权限仍由上层流程实现。',
    when: ['知识库需要保存原件和解析产物，并支持重新解析。', 'Agent 生成报告、截图或压缩包供用户下载。', '文件规模与业务数据库不同，希望独立管理容量与生命周期。'],
    notFor: ['把对象桶当成可执行 SQL 的数据库。', '为了方便预览而将企业资料全部设置为公开访问。'],
    concepts: [
      { title: 'Bucket 与 Object Key', text: 'Bucket 是对象容器，Key 是对象标识。看似目录的路径通常是键名的一部分。建议采用 tenant/document/version/artifact 的命名方式，但路径中出现租户编号不等于实现了权限隔离，服务端仍要验证访问者。' },
      { title: '预签名访问', text: '服务端鉴权后生成短时有效的上传或下载 URL，让浏览器直接传输文件，减少 Java 服务中转流量。URL 在有效期内通常属于持有者即可使用的凭据，应控制期限、方法、对象范围，并避免写入公开日志。' },
      { title: '原件、版本与可重建索引', text: '原件是重新解析与审计的基础，解析结果与向量索引则是派生数据。记录内容摘要、解析器版本、分块规则与向量模型版本，才能在规则升级时重建，并确认当前答案引用的究竟是哪一版文档。' }
    ],
    flow: ['鉴权后上传原件', '数据库记录对象键和版本', '异步任务读取并解析', '保存 Markdown 与图片等产物', '分块入索引并关联原件页码', '鉴权后生成短时下载链接'],
    sections: [
      { title: '把文件生命周期设计完整', paragraphs: ['一次上传完成不代表知识已经可用。数据库可记录 UPLOADED、PARSING、INDEXING、READY、FAILED，前端据此显示处理进度。文件重传、解析失败和索引失败都应可重试，且使用稳定文档版本避免重复片段。', '删除也应贯穿全链路：原件、解析产物、全文索引、向量索引和缓存分别处理。保留策略、审计需求与用户可见删除要在产品规则中说清楚。'], bullets: ['大文件采用 SDK 支持的分片上传与断点策略。', '先记录内容校验值，避免同一文件被无意义地重复解析。'] },
      { title: '最小使用示例：上传到 S3 兼容存储', paragraphs: ['前提：已安装 AWS SDK for Java 2.x 的 software.amazon.awssdk:s3，已有可写 Bucket、本地 guide.pdf 和提供 S3 兼容接口的服务。S3_ENDPOINT、S3_REGION 与凭据通过环境变量配置；该片段适合兼容服务，OSS／COS 专用 SDK 的签名和配置请使用各自文档。'], bullets: ['连接参数、证书与凭据必须匹配实际服务，示例不包含服务部署。', '上传成功后再把 bucket、key、版本与业务权限存到关系库。'], code: { language: 'java', label: 'AWS SDK v2 · 教学方法片段', value: `// imports：software.amazon.awssdk.services.s3.S3Client
// software.amazon.awssdk.regions.Region
// software.amazon.awssdk.core.sync.RequestBody
// java.net.URI；java.nio.file.Path
try (S3Client s3 = S3Client.builder()
        .endpointOverride(URI.create(System.getenv("S3_ENDPOINT")))
        .region(Region.of(System.getenv("S3_REGION")))
        .forcePathStyle(true)
        .build()) {
    s3.putObject(r -> r.bucket("agent-learning")
            .key("tenant-1/docs/guide/v1/original.pdf")
            .contentType("application/pdf"),
        RequestBody.fromFile(Path.of("guide.pdf")));
}` } },
      { title: '选型看访问模式与运维来源', paragraphs: ['重点比较国内访问延迟、出网费用、对象版本、生命周期规则、权限能力和备份恢复。兼容 S3 API 不代表每项功能完全一致，实际要验证预签名、分片上传与错误重试。', 'MinIO 社区仓库已于 2026 年 4 月 25 日归档；存量部署仍需明确维护与更新来源，新项目不要只因旧教程常用就直接选定。'], bullets: ['数据库保存对象引用，避免把长期凭据交给模型。', '用户下载产物前再次鉴权，不能只依赖难猜的文件名。'] }
    ],
    decisions: [{ option: '国内云对象存储', fit: '已有云资源，希望减少存储集群运维。', tradeoff: '关注出网、请求费用以及供应商接口差异。' }, { option: '自建 S3 兼容存储', fit: '有私有化或离线部署要求及专门运维能力。', tradeoff: '自行承担容量规划、冗余、升级、备份和恢复。' }],
    pitfalls: ['只保存向量而删除原件，后续无法核对引用或重建索引。', '文件数据库状态先写 READY，实际上传或索引还未成功。', '把永久公开 URL 当作企业知识文件的默认交付方式。'],
    qa: [
      { q: '文件已经放到对象存储，为什么还要数据库和向量库？', a: '三者解决不同访问问题。对象存储按键取文件；关系库按业务条件管理状态、版本和权限；向量索引按相似度找到相关片段。完整查询通常先确认身份和可访问范围，再召回片段，最后用对象键定位原文。只上传文件既没有解析内容，也没有建立语义索引，所以不能自动成为知识库。' },
      { q: '为什么要保留解析产物与文档版本？', a: '解析器升级、分块规则调整或 Embedding 模型更换都会改变检索效果。保留原件和带版本的派生结果，可以比较差异、回滚并重建索引。答案引用也需要定位到文档版本与页码，否则文档更新后用户打开原件，可能找不到当时支持答案的段落，审计与问题定位都会变得困难。' }
    ],
    sources: [{ label: 'AWS SDK for Java 2.x：S3Client API', url: 'https://sdk.amazonaws.com/java/api/latest/software/amazon/awssdk/services/s3/S3Client.html' }, { label: 'MinIO：仓库维护状态', url: 'https://github.com/minio/minio' }],
    related: ['document-parsing', 'rag-pipeline', 'postgres', 'knowledge-assistant']
  },
  {
    id: 'pgvector', title: 'pgvector', category: '检索', tagline: '从熟悉的 SQL 开始理解向量检索',
    level: '入门', minutes: 20, priority: '核心', kind: 'middleware',
    summary: 'pgvector 是 PostgreSQL 扩展，让数据库能够保存向量并按距离检索。对 Java 开发者，它提供一条很直接的学习路线：保留 SQL、事务和 JDBC，在知识片段表里增加 embedding 列。它不负责自动理解 PDF，也不自动构成知识库；解析、分块、向量化、权限过滤、重排和答案引用仍需要应用组织。',
    when: ['学习 RAG，或已有 PostgreSQL 的项目需要加入语义检索。', '需要把向量结果与文档版本、租户权限等 SQL 条件结合。', '当前负载可由一套数据库承担，希望减少初期基础设施。'],
    notFor: ['认为存入任意数字数组就获得了有意义的语义搜索。', '在没有评估数据量、过滤选择性与延迟前直接承诺规模上限。'],
    concepts: [
      { title: '向量与距离', text: 'Embedding 模型把内容映射为固定维度的数值表示，距离越近通常意味着模型空间中更相似。相同模型、版本和预处理规则应贯穿文档与查询两端。余弦距离、内积和 L2 各有对应算子，不能只替换 SQL 名称而不核对模型要求。' },
      { title: '精确搜索与近似索引', text: '精确搜索计算候选向量距离，是质量基线。HNSW、IVFFlat 等近似索引用一定召回损失换取速度与规模能力。应比较召回率、查询延迟、内存与更新成本，不是“建了索引结果就一定更好”。' },
      { title: '过滤与召回数量', text: '多租户检索必须带上可信租户条件。近似索引与过滤组合可能使最终结果不足，具体行为取决于索引和版本能力。需要在真实权限过滤分布下评估召回，而不只在全库无过滤数据上测试。' }
    ],
    flow: ['解析文档并保留来源', '分块并附加租户和版本', '同一模型生成文档向量', '查询用同一模型生成向量', 'SQL 过滤并按距离取候选', '重排后带引用生成答案'],
    sections: [
      { title: '为什么先学 pgvector', paragraphs: ['它让向量搜索成为熟悉的数据访问问题：建表、插入、过滤、排序和查看执行计划。学习时先用很少的向量理解相似度，再接真实 Embedding API，避免把“数据库会返回结果”和“检索质量正确”混为一谈。', 'Java 可用 JDBC 参数绑定配合 pgvector-java，或使用适配的框架 VectorStore。即使框架自动建表，也应知道它如何保存文本、元数据、维度和索引，便于排查升级与权限问题。'], bullets: ['记录 embedding_model、document_version 和 chunk_id。', '先保存稳定片段主键，方便重复写入与删除。'] },
      { title: '最小使用示例：三维向量只是理解算子', paragraphs: ['前提：PostgreSQL 服务已安装 pgvector 扩展包，当前数据库有启用扩展的权限。以下可在 SQL 客户端执行；三维数字为教学数据，不代表真实中文语义。真实模型维度必须与 vector(N) 一致，查询参数用绑定变量传入。'], bullets: ['<=> 是余弦距离，ORDER BY 升序取最近邻。', '先用精确搜索理解结果，再为真实向量数据评估近似索引。'], code: { language: 'sql', label: 'pgvector · 可执行概念示例', value: `CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE kb_chunk (
  id bigint PRIMARY KEY,
  tenant_id bigint NOT NULL,
  content text NOT NULL,
  embedding vector(3) NOT NULL
);
INSERT INTO kb_chunk VALUES
  (1, 1, '请假审批流程', '[1,0,0]'),
  (2, 1, '报销材料说明', '[0,1,0]');
SELECT id, content, embedding <=> '[0.9,0.1,0]' AS distance
FROM kb_chunk WHERE tenant_id = 1
ORDER BY embedding <=> '[0.9,0.1,0]' LIMIT 2;` } },
      { title: '从能查到到查得准', paragraphs: ['当问题是错误码、产品型号或精确名称时，向量搜索可能不够稳定，可以组合全文检索和重排。先检查原文解析、分块和查询表达，再考虑换向量数据库；底层存储往往不是答案不准确的唯一原因。', '更换 Embedding 模型通常需要为全量文档重新计算向量。使用新表或新集合构建、验证后切换，再清理旧版本，比直接混写新旧向量更可控。'], bullets: ['用带标准相关片段的小型数据集比较召回变化。', '学习用 EXPLAIN 分析索引是否生效，但不要只盯 SQL 耗时。'] }
    ],
    decisions: [{ option: 'pgvector', fit: 'PostgreSQL 现有体系、SQL 过滤、组件数量优先。', tradeoff: '需管理事务与向量负载竞争，并评估索引参数。' }, { option: 'Milvus 等独立检索服务', fit: '向量检索需要独立扩缩容或专门运维。', tradeoff: '增加同步、备份、鉴权与系统一致性工作。' }],
    pitfalls: ['文档用模型 A、查询用模型 B，维度相同也不代表空间兼容。', '只按向量 Top-K 查询，再在应用中删除越权片段，导致候选不足或数据暴露。', '直接比较不同模型或不同距离度量的分数，套统一阈值。'],
    qa: [
      { q: '向量数据库和知识库有什么区别？', a: '向量数据库是检索组件，知识库是一整套内容管理与问答流程。后者还包括上传、解析、分块、权限、更新、召回、重排和引用。向量库里即使有数百万条记录，原文解析错了、版本过时或权限条件缺失，系统仍然可能回答错误。评价知识库需要看端到端任务，而不能只看向量查询是否成功。' },
      { q: 'pgvector 和 Milvus 怎么选？', a: '先从现有系统和可测负载出发。已用 PostgreSQL、查询需要关系过滤且规模可承载时，pgvector 可以减少组件；检索需要独立资源与扩展时，可评估 Milvus。比较应包含召回、P95 延迟、索引构建、更新删除、过滤效果和团队运维成本，不用一个固定向量条数作为所有项目的分界线。' }
    ],
    sources: [{ label: 'pgvector：官方使用与索引说明', url: 'https://github.com/pgvector/pgvector' }, { label: 'pgvector-java：JDBC 接入', url: 'https://github.com/pgvector/pgvector-java' }],
    related: ['postgres', 'milvus', 'embedding', 'rag-pipeline', 'reranker']
  },
  {
    id: 'milvus', title: 'Milvus', category: '检索', tagline: '把向量与混合召回作为独立服务运营',
    level: '进阶', minutes: 20, priority: '按需', kind: 'middleware',
    summary: 'Milvus 是面向向量相似度检索的数据库，适合把知识召回从交易数据库中独立出来。它支持标量过滤，也提供 BM25 全文检索与混合检索能力，因此不能简单理解为“只能做向量”。它的价值需要通过召回质量、延迟、容量与运维成本验证；不是每个 Agent 项目都要从第一天部署独立向量集群。',
    when: ['知识检索需要独立扩缩容，避免影响业务数据库。', '有较多向量或持续更新需求，需要专门评估索引与检索资源。', '需要组合稠密向量、关键词召回和元数据过滤。'],
    notFor: ['只有少量文档的学习项目，却希望用复杂集群证明架构先进。', '需要事务处理订单和任务状态，打算用向量库取代关系库。'],
    concepts: [
      { title: 'Collection 与 Schema', text: 'Collection 存放一组实体，每个实体有主键、向量和标量字段。租户、文档版本、片段编号应成为明确字段，用来过滤、更新和删除。维度和距离度量由 Embedding 模型决定，不能随意混用不同向量空间。' },
      { title: '索引、加载与资源', text: '索引用于加速近似搜索，加载使所需数据能够被查询服务访问。不同部署模式和索引类型的资源消耗不同。学习时把“数据已写入”“索引已就绪”“查询可见”区分开，及时检查状态与一致性要求。' },
      { title: 'BM25 与混合检索', text: 'Milvus 的 BM25 功能通过文本分析和稀疏表示提供关键词召回，可以与稠密向量联合使用。两路结果需要融合或重排，不能把原始分数直接相加。中文分析器、精确术语和权限过滤仍需结合业务验证。' }
    ],
    flow: ['创建带元数据字段的集合', '分块并生成稠密向量', '按稳定主键写入数据', '建立索引并确认可查询', '过滤租户后执行向量或混合召回', '重排并回到原文生成答案'],
    sections: [
      { title: 'Java 应用的职责边界', paragraphs: ['Java 服务通常负责身份、文档版本、Embedding 调用和检索策略；Milvus 负责索引与召回。原件保存在对象存储，主文档与任务状态保存在关系库，Milvus 中保存可重建片段和来源标识。', '文档更新时采用稳定 chunk_id 与版本管理，避免反复插入产生重复候选。先构建新版本并验证，再切换查询条件，可以降低更新中途出现半新半旧知识的风险。'], bullets: ['查询过滤由服务端根据身份构造，不能由用户自由输入完整表达式。', '记录检索耗时、候选数量与来源版本，帮助判断召回质量。'] },
      { title: '最小使用示例：创建教学集合', paragraphs: ['前提：已启动与客户端兼容的 Milvus 服务，项目加入 io.milvus:milvus-sdk-java 并使用 v2 API。下例演示默认 Schema 的快速创建，dimension(3) 只是教学维度；真实集合应显式设计主键、文本、租户和版本字段。URI 与认证请按实际部署设置。'], bullets: ['创建成功不代表已有知识；下一步还要调用 insert、构建或确认索引并执行 search。', 'v1 与 v2 SDK 的类名、请求对象不同，不要混抄教程。'], code: { language: 'java', label: 'Milvus Java SDK v2 · 建集合', value: `import io.milvus.v2.client.ConnectConfig;
import io.milvus.v2.client.MilvusClientV2;
import io.milvus.v2.service.collection.request.CreateCollectionReq;

MilvusClientV2 client = new MilvusClientV2(
    ConnectConfig.builder()
        .uri(System.getenv("MILVUS_URI"))
        .build());
try {
    client.createCollection(CreateCollectionReq.builder()
        .collectionName("agent_chunks_demo")
        .dimension(3)
        .build());
} finally {
    client.close();
}` } },
      { title: '评估独立检索服务的收益', paragraphs: ['使用代表性文档和查询测量召回率、P95 延迟、内存、索引构建时间及更新删除成本。过滤场景尤其重要：无过滤下表现良好，不代表一个小租户或复杂权限条件下也同样好。', '从 pgvector 迁移时要评估数据同步、备份、监控、故障降级和索引重建，而不只比较一条查询速度。若 Milvus 已满足 BM25、过滤和混合召回需求，不一定再部署 Elasticsearch。'], bullets: ['先区分检索质量问题与模型回答问题。', '为不可用状态设计明确提示，不要让模型凭空补答案。'] }
    ],
    decisions: [{ option: 'Milvus 单独承担混合召回', fit: '向量与 BM25 需求能被当前版本满足。', tradeoff: '需要验证中文分析、过滤和结果融合效果。' }, { option: 'Milvus + Elasticsearch', fit: '已有复杂全文检索能力，向量负载另行扩展。', tradeoff: '维护两套索引和同步链路，复杂度明显上升。' }],
    pitfalls: ['看到写入成功就立即假设任意一致性设置下都能读到新数据。', '集合里没有租户和版本字段，后续权限过滤与删除极难补救。', '以为换向量库能修复解析错误和错误分块。'],
    qa: [
      { q: '用了 Milvus 还需要 Elasticsearch 吗？', a: '不一定。Milvus 已有 BM25 和混合检索能力，能否满足要求应看中文分析、复杂过滤、聚合和现有搜索资产。如果业务已有成熟 Elasticsearch 查询与运营能力，可以保留并做多路召回；如果只是为关键词检索再建一套系统，应先验证 Milvus 的现有能力，避免承担重复索引和同步成本。' },
      { q: '独立向量数据库最重要的收益是什么？', a: '是检索能力与资源可以独立管理，而不是某个固定数据量之后一定更快。团队能独立调整索引、扩容和观察检索性能，同时避免挤占事务数据库。代价是多一个系统，需要处理写入同步、可见性、备份和恢复。因此选型必须用实际过滤条件和更新模式评估，不能只看无过滤的基准数字。' }
    ],
    sources: [{ label: 'Milvus：BM25 全文检索', url: 'https://milvus.io/docs/full-text-search.md' }, { label: 'Milvus：Java v2 创建集合', url: 'https://milvus.io/api-reference/java/v2.4.x/v2/Collections/createCollection.md' }],
    related: ['pgvector', 'elasticsearch', 'embedding', 'reranker', 'rag-pipeline']
  },
  {
    id: 'elasticsearch', title: 'Elasticsearch', category: '检索', tagline: '精确术语、全文搜索与混合召回',
    level: '入门', minutes: 20, priority: '按需', kind: 'middleware',
    summary: '企业问题里经常包含错误码、型号、合同编号和专有名词，这些信息需要关键词检索准确命中。Elasticsearch 通过倒排索引、分析器和相关性评分提供全文搜索，也有向量与混合检索能力。在 Agent 中，它通常提供候选证据与过滤能力；最终答案还需要重排、上下文组织和来源引用。',
    when: ['知识中有大量精确术语、代码、产品型号和编号。', '既需要全文搜索，也需要复杂过滤、聚合或已有搜索能力。', '想把关键词召回和向量召回结合，降低单一路径的漏检。'],
    notFor: ['直接作为订单等关键业务的唯一事务数据库。', '仅因做 RAG 就无条件部署，同时又完全不用全文能力。'],
    concepts: [
      { title: '倒排索引与分析器', text: '倒排索引把词项关联到文档，分析器决定文本如何被切成可检索词项。中文分词、同义词与型号保留方式会直接影响召回。查询与索引的分析规则需要协调，先看实际分词结果再调相关性。' },
      { title: 'text 与 keyword', text: 'text 字段通常经过分析用于全文匹配；keyword 保留整体值，适合租户、文档编号、过滤和聚合。同一个业务字段有时需要两种视图。把租户字段建成全文 text 再用模糊匹配授权，是错误的数据建模。' },
      { title: '混合召回与分数融合', text: 'BM25 衡量词项相关性，向量分数来自语义空间，二者尺度不同。RRF 等基于排名的融合可以组合多路候选，再由 Reranker 判断问题与片段相关性。选择融合策略后，还应检查引用质量与重复片段。' }
    ],
    flow: ['解析并分块', '建立文本与 keyword 映射', '写入片段及来源版本', '用可信租户条件过滤', '关键词与向量召回合并', '重排并选出可引用证据'],
    sections: [
      { title: '关键词检索解决什么问题', paragraphs: ['用户问“E1042 错误怎么处理”，E1042 本身比“系统故障”更重要。向量可能召回语义相似但编号不同的说明，关键词路径可以补齐精确命中。相反，用户用口语转述政策时，纯关键词又可能漏掉同义表述，因此两者常能互补。', '源数据更新后，Elasticsearch 中的文档通常通过 CDC、消息或索引任务更新。需要处理删除、重复事件和版本覆盖，不能让旧事件把新文档覆盖回旧版本。'], bullets: ['全文引擎是可重建的检索视图。', '先检查分析器与字段映射，再调整召回策略。'] },
      { title: '最小使用示例：字段映射与带权限过滤的查询', paragraphs: ['前提：可用的 Elasticsearch 与 Kibana Dev Tools。以下是 Console 请求格式，可直接逐段执行；使用标准分析器做概念学习，真实中文业务应评估适合的分析器并确认版本兼容。Java 服务可通过官方 Java API Client 发送相同语义的请求。'], bullets: ['tenant_id 必须来自服务端登录身份。', '示例聚焦关键词检索，混合检索需另加向量字段和融合配置。'], code: { language: 'json', label: 'Elasticsearch Console · 建索引与查询', value: `PUT agent_chunks_demo
{
  "mappings": {"properties": {
    "tenant_id": {"type": "keyword"},
    "content": {"type": "text"},
    "document_id": {"type": "keyword"}
  }}
}
PUT agent_chunks_demo/_doc/1?refresh=wait_for
{"tenant_id":"1","document_id":"manual-v1","content":"E1042 表示连接超时"}
GET agent_chunks_demo/_search
{
  "size": 5,
  "query": {"bool": {
    "filter": [{"term": {"tenant_id": "1"}}],
    "must": [{"match": {"content": "E1042"}}]
  }}
}` } },
      { title: '可见性、索引版本与运维', paragraphs: ['搜索索引具有刷新周期，写入成功不总等于下一条搜索立即可见。示例的 refresh=wait_for 方便理解，但生产中不能无评估地给每次写入增加等待。批量导入时应按吞吐需求设计刷新与批次。', '映射变更、分析器升级常需要重新索引。可用新索引承载新结构，验证后切换别名，并保留回滚窗口。资源方面关注分片数量、堆内存、磁盘水位和查询延迟，避免过度分片。'], bullets: ['学习阶段先用单一索引和少量分片。', '模型生成的查询 DSL 也需要字段、成本与权限约束。'] }
    ],
    decisions: [{ option: 'Elasticsearch 统一全文与向量', fit: '已有搜索系统和运维能力，希望复用过滤与检索。', tradeoff: '向量能力、授权范围与部署版本需要逐项确认。' }, { option: '专用向量库 + 全文引擎', fit: '两种负载均有明确独立扩展需求。', tradeoff: '增加候选融合与双索引一致性成本。' }],
    pitfalls: ['直接相加 BM25 和向量原始分数，没有校准也没有评估。', '把 keyword 字段用于长文本语义检索，或用 text 字段做精确权限判断。', '只更新新增文档，忘记同步撤销、删除与版本替换。'],
    qa: [
      { q: '既然向量可以理解语义，为什么还需要关键词检索？', a: '语义相似不等于标识相同。错误码、订单号、型号和专有名词常常需要精确命中，而向量可能把不同编号的相似描述放在一起。关键词召回负责词面证据，向量召回补充口语和同义表达，两路候选融合后再重排。是否更好要用真实问题验证，不能假设每个问题都同时查询越多越好。' },
      { q: '搜索有结果但 Agent 仍答错，应该排查哪里？', a: '先看命中的片段是否真的回答问题，以及权限、版本和原文解析是否正确；再看正确片段是否排在足够靠前的位置，是否被截断或混入冲突版本。最后才看提示词和生成模型。检索链路需要记录候选与最终上下文，只有答案文本无法判断错误发生在召回、重排还是生成阶段。' }
    ],
    sources: [{ label: 'Elasticsearch：混合搜索', url: 'https://www.elastic.co/docs/solutions/search/hybrid-search' }, { label: 'Elasticsearch：Mapping', url: 'https://www.elastic.co/docs/manage-data/data-store/mapping' }],
    related: ['milvus', 'pgvector', 'rag-pipeline', 'reranker', 'knowledge-assistant']
  },
  {
    id: 'mongodb', title: 'MongoDB', category: '存储', tagline: '承载变化较多的文档型数据',
    level: '进阶', minutes: 15, priority: '按需', kind: 'middleware',
    summary: 'Agent 工具返回的字段可能随工具与版本变化，抓取结果、解析元数据和外部 API 响应也常是嵌套结构。MongoDB 用文档模型保存这类数据，适合按聚合对象读取。它不是“没有 Schema 就不用设计”，也不是 Agent 必需组件；已有 PostgreSQL JSONB 或对象存储能够满足需求时，复用现有底座往往更简单。',
    when: ['工具与外部接口返回的数据结构变化较多，并需要按部分字段查询。', '一个业务聚合适合嵌套保存，读取时常一起获取。', '团队已有 MongoDB 运维与建模经验。'],
    notFor: ['因不愿设计字段与索引而选择所谓无模式数据库。', '把无限增长的完整聊天历史塞进同一文档。'],
    concepts: [
      { title: '文档与聚合边界', text: '相关信息可以嵌套在一个 BSON 文档内，减少拆表与连接。嵌套适合一起读取、一起更新且大小有边界的数据。会无限增长或有独立生命周期的消息、事件通常应单独建集合，以免产生大文档与热点。' },
      { title: '灵活 Schema 仍需版本', text: '不同工具的 payload 可以不同，但 tenant_id、tool_name、schema_version、created_at 等公共字段应稳定。校验规则和应用 DTO 帮助控制结构漂移。版本升级时要明确老文档如何读取与迁移。' },
      { title: '索引与原子范围', text: '单文档写操作具有原子性，多文档事务需满足部署与驱动要求。索引应围绕租户、工具和时间等访问路径设计。支持事务不意味着应把文档库当关系库的无成本替代，建模仍应符合实际查询方式。' }
    ],
    flow: ['工具执行获得原始结果', '校验并清理敏感字段', '写入公共元数据与版本', '按租户和工具查询文档', '按保留策略清理或转存大对象'],
    sections: [
      { title: '适合放什么、不适合放什么', paragraphs: ['适合保存结构差异较大的工具执行详情、抓取后的页面元数据和中等大小的解析结构。原始视频、大型 PDF 与大量二进制产物通常仍放对象存储，MongoDB 记录引用。', '交易型主记录如果已经在 MySQL 中，不必再复制一份作为同等权威的主数据。可以让文档库保存辅助详情，关系库保留状态与幂等约束，明确谁是事实源。'], bullets: ['payload 与公共索引字段分开。', '结构灵活的同时保留 schema_version 和工具版本。'] },
      { title: '最小使用示例：保存工具结果', paragraphs: ['前提：项目加入 org.mongodb:mongodb-driver-sync，MONGODB_URI 指向可用实例。下例是 Java 方法片段，使用驱动默认连接配置；真实应用通常复用单例 MongoClient，并配置认证、超时与连接池。示例 ID 固定，重复运行会得到重复主键错误，这是可观察的唯一性边界。'], bullets: ['以稳定调用编号作为幂等标识时，重复请求应读取既有结果。', '不要把所有工具返回内容不加限制地保存，先做大小和敏感字段处理。'], code: { language: 'java', label: 'MongoDB Java Sync Driver · 文档插入', value: `import com.mongodb.client.MongoClients;
import org.bson.Document;

try (var client = MongoClients.create(System.getenv("MONGODB_URI"))) {
    var calls = client.getDatabase("agent_learning")
        .getCollection("tool_calls");
    calls.insertOne(new Document("_id", "tenant-1-call-001")
        .append("tenant_id", 1)
        .append("tool_name", "query_policy")
        .append("schema_version", 1)
        .append("payload", new Document("policy_id", "leave-v3")
            .append("days", 5)));
}` } },
      { title: '与 JSONB 如何比较', paragraphs: ['如果文档详情只是业务表的少量附加信息，PostgreSQL JSONB 能减少系统数量。如果文档型访问成为主要负载，并需要独立生命周期、吞吐与团队已有工具，则再评估 MongoDB。', '无论选择哪个系统，都要列出最常用查询，检查索引命中、分页方式与保留策略。不能把数据“可以存进去”当作建模已经完成。'], bullets: ['避免深分页和无边界返回工具历史。', '日志保留应以任务定位需求与隐私要求确定。'] }
    ],
    decisions: [{ option: '现有关系库 JSON 列', fit: '非结构化详情量不大，与业务状态强关联。', tradeoff: '大文档与高写入可能挤占事务资源。' }, { option: 'MongoDB', fit: '文档型数据成为独立业务聚合与访问负载。', tradeoff: '新增运维系统、索引设计与跨库同步边界。' }],
    pitfalls: ['每个版本随意改字段名，应用最终只能靠猜读取历史记录。', '把整段聊天追加到一个文档，形成无界增长和并发更新热点。'],
    qa: [
      { q: 'Agent 输出是 JSON，所以一定适合 MongoDB 吗？', a: '不一定。JSON 只是数据表达形式，选型要看查询、关系、事务和生命周期。少量工具详情可以放关系库 JSON 列，大型原始响应可以压缩到对象存储并保存引用。只有文档型读写是主要需求且现有方案不足时，MongoDB 的独立价值才明显，不能由模型输出格式直接决定数据库。' },
      { q: '文档数据库为什么还要 Schema？', a: '数据库允许结构变化，不代表应用能够处理任何结构。工具升级后字段类型和含义可能改变，必须用版本、校验规则和兼容读取控制变化。公共索引字段保持稳定，payload 在边界内灵活扩展。否则查询与报表会因结构漂移失效，排查问题时也无法解释同名字段在不同时间代表什么。' }
    ],
    sources: [{ label: 'MongoDB：Java 插入文档', url: 'https://www.mongodb.com/docs/drivers/java/sync/current/crud/insert/' }, { label: 'MongoDB：数据建模', url: 'https://www.mongodb.com/docs/manual/data-modeling/' }],
    related: ['postgres', 'object-storage', 'tool-calling', 'observability']
  },
  {
    id: 'neo4j', title: 'Neo4j', category: '检索', tagline: '回答依赖关系与多跳连接问题',
    level: '进阶', minutes: 18, priority: '按需', kind: 'middleware',
    summary: '当问题需要沿实体关系追踪，例如“这次组件升级会影响哪些服务和负责人”，图数据库比单纯相似度搜索更贴近问题。Neo4j 用节点、关系和属性建模，Cypher 用图模式表达查询。它可以参与 GraphRAG，但图数据库本身不自动生成准确知识图谱；实体消歧、关系来源、时效与权限需要单独治理。',
    when: ['问题天然涉及多跳关系、路径、依赖或关联解释。', '已有可信结构化关系，如服务调用、组织关系、产品部件。', '需要给出“为什么相关”的关系路径和来源证据。'],
    notFor: ['普通文档问答仅需要找几个相关段落。', '没有可靠关系来源，却希望模型抽出的图自动成为事实。'],
    concepts: [
      { title: '节点、关系与属性', text: '节点表示服务、人员、制度等实体，关系表示依赖、负责、引用等有方向的连接。属性保存标识、版本和来源。建模应围绕要回答的问题，不能只把文本中的每个名词都变成节点。' },
      { title: '多跳查询', text: '图查询可以从服务出发沿 DEPENDS_ON 找上游依赖，再沿 OWNED_BY 找负责人。跳数与边类型必须受控，否则路径数量会快速膨胀。查询时还要过滤租户、有效时间和可信关系。' },
      { title: 'GraphRAG 的证据责任', text: '图可用于定位相关实体、扩展上下文和汇总关系，但每条边最好能够追溯到文档或系统记录。模型抽取的关系是待验证信息，不应在没有来源和置信度管理时直接影响高风险业务动作。' }
    ],
    flow: ['确定业务实体与问题类型', '从可信数据建立节点和关系', '消歧并记录来源版本', '用受控图查询找路径', '按路径回取原文证据', '组织带来源的解释'],
    sections: [
      { title: '从关系问题反推图模型', paragraphs: ['以服务影响分析为例：Service 节点用 service_id 唯一标识，DEPENDS_ON 关系说明调用或依赖，Team 节点说明维护归属。回答“升级 Redis 会影响谁”时，先沿依赖图找服务，再查询负责人，而不是让模型从一堆相似文档猜。', '图结构适合关系检索，详细说明仍可在对象存储和全文索引中。图和向量并非互相替代：一个帮助找关系，一个帮助找语义相关的文字。'], bullets: ['为业务 ID 建立唯一约束。', '关系边记录来源、采集时间和有效范围。'] },
      { title: '最小使用示例：查询服务依赖', paragraphs: ['前提：项目加入 org.neo4j.driver:neo4j-java-driver，采用支持 executableQuery 的驱动版本；Neo4j 中已存在 Service 节点和 DEPENDS_ON 关系。下例只读查询，环境变量提供连接和凭据。查询不返回记录也可能是图尚未导入，不代表驱动失败。'], bullets: ['使用参数绑定，限制最多两跳，避免任意路径爆炸。', '本例图已按租户隔离；多租户共享图时还必须补充可信租户条件。'], code: { language: 'java', label: 'Neo4j Java Driver · 参数化查询', value: `import org.neo4j.driver.AuthTokens;
import org.neo4j.driver.GraphDatabase;
import java.util.Map;

try (var driver = GraphDatabase.driver(
        System.getenv("NEO4J_URI"),
        AuthTokens.basic(System.getenv("NEO4J_USER"),
                         System.getenv("NEO4J_PASSWORD")))) {
    var result = driver.executableQuery(
        "MATCH (s:Service {id: $id})-[:DEPENDS_ON*1..2]->(d) " +
        "RETURN DISTINCT d.id AS dependency LIMIT 20")
        .withParameters(Map.of("id", "order-service"))
        .execute();
    result.records().forEach(System.out::println);
}` } },
      { title: '不要先做一张无限大的知识图谱', paragraphs: ['先限定一个有收益的问题，例如依赖影响或政策适用关系，确认图查询能比关键词检索给出更可靠答案。之后再逐步扩展实体类型，建立冲突处理、更新和删除机制。', '如果关系来自大模型抽取，保留原文片段、抽取器版本和复核状态。遇到矛盾关系时，回答应展示分歧或按有效期选择，而不是静默合并成一条确定事实。'], bullets: ['维护实体别名和同名实体消歧规则。', '观察查询耗时、展开节点数与无结果比例。'] }
    ],
    decisions: [{ option: '关系表 + SQL', fit: '关系简单、跳数固定、已有关系库。', tradeoff: '多跳与复杂路径表达可能逐渐繁琐。' }, { option: 'Neo4j', fit: '关系路径是核心查询且持续变化。', tradeoff: '增加图建模、数据同步和关系质量治理。' }],
    pitfalls: ['把模型抽取的边都视为事实，没有来源和更新时间。', '放开无限跳数或任意 Cypher，导致高成本查询或越权。', '为了 GraphRAG 建图，但用户问题其实只需精确段落检索。'],
    qa: [
      { q: 'GraphRAG 一定比普通 RAG 更好吗？', a: '取决于问题。关系路径、跨实体汇总和依赖分析可以受益于图；单篇制度中的具体条款，普通检索往往更直接。图还增加抽取、消歧和维护成本。应先挑选关系型问题，比较证据完整性与回答准确性，再决定是否扩展，不能把更复杂的表示形式当作质量保证。' },
      { q: '图数据库和向量数据库有什么分工？', a: '向量检索找语义相似的内容，图查询沿明确关系找关联实体。一个问题可以先用向量定位“差旅制度”，再用图找适用部门和关联审批流程，最后回到原文确认条款。两者都只是证据获取方式，最终仍需检查来源、有效时间和权限，图中的连接也不能自动证明因果关系。' }
    ],
    sources: [{ label: 'Neo4j：Java 参数化查询', url: 'https://neo4j.com/docs/java-manual/current/query-simple/' }, { label: 'Neo4j：Cypher 图模式', url: 'https://neo4j.com/docs/cypher-manual/current/patterns/' }],
    related: ['rag-pipeline', 'pgvector', 'research-agent', 'production-architecture']
  },
  {
    id: 'clickhouse', title: 'ClickHouse', category: '存储', tagline: '分析 Agent 调用、成本与任务表现',
    level: '进阶', minutes: 17, priority: '按需', kind: 'middleware',
    summary: '当模型调用和工具执行事件增长后，常需要按租户、模型、版本和时间分析延迟、Token 用量、成本与失败率。ClickHouse 的列式存储与分析查询适合这类追加型数据。它服务于“系统表现如何”的分析问题，不应取代任务状态与交易事实的主数据库。学习时先把指标含义和事件粒度定义清楚，再谈查询速度。',
    when: ['大量调用事件需要按多维度聚合和长期分析。', '希望比较不同模型、Prompt 或检索版本的延迟与成本。', '现有业务数据库已被分析查询影响，需隔离负载。'],
    notFor: ['小规模学习项目只有几十条记录。', '需要频繁单行事务更新或把分析结果当即时业务状态。'],
    concepts: [
      { title: '列式与批量分析', text: '分析查询常读取少量列并聚合大量行，列式布局适合压缩与扫描。写入通常应批量化，过多小批次会增加数据片段与合并压力。业务实时界面和离线趋势分析可以采用不同查询存储。' },
      { title: 'MergeTree 排序键', text: 'MergeTree 家族依靠数据组织与稀疏索引加速查询。ORDER BY 应与常用过滤路径匹配，例如租户与时间。它不是关系库的唯一约束，重复事件不会因为排序键相同自动被拒绝。' },
      { title: '事件粒度与重复', text: '一次用户任务可能包含多次模型调用、多次重试和多个工具调用。必须区分 task_id、call_id、attempt_id。按调用统计成本与按任务统计成功率是不同口径，重试事件还要防止重复采集造成重复计费分析。' }
    ],
    flow: ['应用产生结构化调用事件', '异步批量进入分析存储', '按事件 ID 和尝试区分记录', '聚合模型延迟与资源消耗', '关联任务最终状态', '定位高成本或低成功率版本'],
    sections: [
      { title: '先确定你要回答的问题', paragraphs: ['一个可用的 Agent 运营视图至少区分调用成功和任务成功：模型 HTTP 200 只表示接口完成，不能证明用户问题解决。成本可以按模型调用累加，任务完成率则需要应用明确的结束状态或人工反馈。', '记录模型名、版本、租户、Token、耗时与错误类型即可支持大量分析，不一定保存全部敏感 Prompt。确需保留内容时，应设置访问权限、脱敏和保留期限。'], bullets: ['把供应商 Token 计数和内部估算区分开。', '失败、重试与被取消任务也纳入事件模型。'] },
      { title: '最小使用示例：查询模型延迟', paragraphs: ['前提：可用的 ClickHouse 与 SQL 客户端。以下示例创建追加事件表，写入两条教学数据，再计算近一天的 P95 延迟。真实采集通常由 Java SDK、HTTP 或消息管道批量写入；价格变化应在计费模型中按有效期管理。'], bullets: ['ORDER BY 不保证 event_id 唯一，采集端仍需定义去重策略。', 'quantile 是近似聚合，报告必须明确数据时间窗与口径。'], code: { language: 'sql', label: 'ClickHouse · 调用事件分析', value: `CREATE TABLE agent_call_demo (
  event_id String,
  tenant_id UInt64,
  model LowCardinality(String),
  duration_ms UInt32,
  input_tokens UInt32,
  output_tokens UInt32,
  event_time DateTime
) ENGINE = MergeTree
ORDER BY (tenant_id, event_time, event_id);

INSERT INTO agent_call_demo VALUES
('e1', 1, 'model-a', 1200, 500, 100, now()),
('e2', 1, 'model-a', 1800, 600, 150, now());
SELECT model, count() AS calls,
       quantile(0.95)(duration_ms) AS p95_ms
FROM agent_call_demo
WHERE tenant_id = 1 AND event_time >= now() - INTERVAL 1 DAY
GROUP BY model;` } },
      { title: '什么时候才需要独立分析库', paragraphs: ['初期可直接使用观测平台或关系库汇总。当事件量、保留期和分析维度明显增长，或分析查询影响业务请求时，再引入 ClickHouse。切换前先确认事件 Schema 与指标口径稳定，否则只是更快地计算错误指标。', '资源与生命周期上重点关注写入批次、排序键、分区策略、TTL 与查询时间窗。过度分区和每条事件单独提交都可能带来额外管理成本。'], bullets: ['固定仪表盘应尽量限定时间范围。', '事件重放和回填要有明确重复处理规则。'] }
    ],
    decisions: [{ option: '观测平台自带统计', fit: '主要关心模型调用链和基础成本，无复杂联合分析。', tradeoff: '自定义指标与长期多源分析可能受限。' }, { option: 'ClickHouse', fit: '需要大规模事件聚合与业务维度联合分析。', tradeoff: '需要维护事件管道、指标口径与数据质量。' }],
    pitfalls: ['把一次工具重试算成多个用户任务，成功率和费用口径失真。', '误认为 MergeTree 的排序键会阻止重复事件。', '只统计成功请求，隐藏超时与取消导致的真实体验问题。'],
    qa: [
      { q: 'Langfuse 已经能看调用，为什么还需要 ClickHouse？', a: '不一定需要。观测平台更适合定位具体调用链、Prompt 与检索过程；独立分析库适合把大量事件和租户、产品、收入等业务维度关联，形成自定义报表。如果平台已有能力满足问题，就可以继续使用。引入分析库的理由应是具体查询与保留需求，而不是重复搭建已有报表。' },
      { q: 'Agent 的成功率该怎么算？', a: '先定义任务和完成标准，不能直接用模型接口成功率代替。一个任务可能经历多次失败调用后最终完成，也可能所有 HTTP 请求成功却输出错误结果。建议分别记录接口成功率、工具执行成功率和业务任务完成率，并按模型、Prompt 与数据版本比较，说明取消、重试和未知结果如何计入。' }
    ],
    sources: [{ label: 'ClickHouse：MergeTree', url: 'https://clickhouse.com/docs/engines/table-engines/mergetree-family/mergetree' }, { label: 'ClickHouse：quantile 聚合', url: 'https://clickhouse.com/docs/sql-reference/aggregate-functions/reference/quantile' }],
    related: ['observability', 'evaluation', 'kafka', 'production-architecture']
  },
  {
    id: 'kafka', title: 'Kafka', category: '执行', tagline: '用可回放的事件流连接知识更新与分析链路',
    level: '进阶', minutes: 22, priority: '按需', kind: 'middleware',
    summary: 'Kafka 适合持续事件流、多下游订阅和可回放处理，例如文档变更同时驱动索引、审计和分析。它让请求与耗时处理解耦，但不会自动保证外部业务只执行一次。Agent 系统需要明确定义事件、消费进度和副作用：消息写入成功、消费者读到、索引真正完成，是三个不同的状态。',
    when: ['大量文档或业务变更需要驱动多个独立下游。', '需要保留事件并重放，重建索引或修正分析数据。', '已有 Kafka 与流处理平台，希望复用基础设施。'],
    notFor: ['只有少量后台任务，数据库任务表就能满足需求。', '期待消息队列自动实现多步骤人工审批或长任务恢复。'],
    concepts: [
      { title: 'Topic、Partition 与 Key', text: 'Topic 按 Partition 组织日志，顺序通常在单分区内成立。用 document_id 作为 Key 能把同一文档的事件路由到同一分区，但调整分区或跨系统重发后仍需版本检查。全局有序与高并行往往存在取舍。' },
      { title: 'Consumer Group 与 Offset', text: '传统消费组中，一个分区同时由组内一个消费者处理，不同组可独立读取相同事件。Offset 记录读取位置，提交时机影响故障后是否重放。完成业务后再提交可以避免提前跳过，但崩溃窗口仍可能导致重复处理。' },
      { title: '至少一次与幂等边界', text: '常见可靠消费流程按至少一次设计：失败后可能再次收到同一事件。Kafka 的幂等生产与事务有明确适用范围，不能直接保证远程 HTTP、向量库或支付接口恰好一次。消费者应使用稳定事件键和版本化写入。' }
    ],
    flow: ['事务提交文档与 outbox', '发布器发送带事件 ID 的消息', '消费者读取并校验版本', '幂等写入检索或分析存储', '业务处理完成后提交 offset', '失败重试或进入人工可处理的失败通道'],
    sections: [
      { title: '把事件定义为已经发生的事实', paragraphs: ['例如 DocumentPublished 说明文档版本已经发布，包含 event_id、tenant_id、document_id、version 和对象引用。消息不要携带巨大的 PDF 或完整 Prompt，可让消费者根据受控引用读取。', '业务数据与消息直接双写会出现一边成功另一边失败，推荐先理解 outbox。消费者按事件 ID 去重、按文档版本拒绝旧更新，并保留可重试的失败原因。'], bullets: ['一个文档版本对应稳定的索引构建标识。', '不同下游使用不同消费组，避免互相抢走业务事件。'] },
      { title: '最小使用示例：配置 Spring Kafka 消费语义', paragraphs: ['前提：Spring Boot 项目已加入 org.springframework.kafka:spring-kafka，Kafka 可通过 localhost:9092 访问，并已创建 agent-document-events Topic。以下只配置客户端；还需实现同步 @KafkaListener，确保方法正常返回前已完成幂等业务提交，失败必须抛出异常。'], bullets: ['RECORD 适用于记录监听器：监听方法成功返回后提交该记录对应进度。', 'auto-offset-reset 仅在没有有效提交位置时生效，不是每次启动都会从头消费。', '生产环境另配认证、TLS、错误处理器、退避和失败 Topic。'], code: { language: 'yaml', label: 'application.yml · Spring Kafka', value: `spring:
  kafka:
    bootstrap-servers: localhost:9092
    consumer:
      group-id: agent-document-indexer
      enable-auto-commit: false
      auto-offset-reset: earliest
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.apache.kafka.common.serialization.StringDeserializer
    listener:
      ack-mode: record
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.apache.kafka.common.serialization.StringSerializer
      acks: all
      properties:
        enable.idempotence: true` } },
      { title: '积压与重复的排查顺序', paragraphs: ['先判断生产速率是否持续超过消费能力，再看单条处理耗时、分区倾斜、下游限流与重试。增加消费者数量不一定提高吞吐：传统消费组并行度受分区数量限制，单一热点 Key 也可能把压力集中在一个分区。', '文档解析或模型调用可能耗时很久，应避免超过消费轮询相关超时导致重平衡。可以拆小任务或使用专门任务执行层，同时明确何时算业务完成。不要把消息交给内存线程池后就提交 offset。'], bullets: ['同时观察 consumer lag、处理耗时和下游错误率。', '重放之前确认幂等与版本防倒退机制有效。'] }
    ],
    decisions: [{ option: 'Kafka', fit: '持续事件流、多订阅方、需要回放与流处理。', tradeoff: '需理解分区、消费组、保留策略与重平衡。' }, { option: 'RabbitMQ / 任务表', fit: '主要是工作任务分发，事件回放需求较少。', tradeoff: '各方案的历史保留与广播模型需要另行设计。' }],
    pitfalls: ['消费方法开启异步工作后立即返回，offset 已提交但业务还没完成。', '把 enable.idempotence=true 理解成外部工具只执行一次。', '失败无限快速重试，造成模型调用费用持续增长。'],
    qa: [
      { q: '消息重复消费导致重复索引或重复执行，怎么设计？', a: '使用业务生成的稳定 event_id 或 document_id + version 作为幂等键，索引写入按固定主键 upsert，并拒绝旧版本覆盖新版本。若外部动作有副作用，把同一个幂等键传给下游。业务完成后再提交 offset，数据库中的处理记录与相关变更尽量同事务提交；不能用进程内集合承担持久去重。' },
      { q: '消费者加倍后仍然积压，先检查什么？', a: '先看分区数量与热点 Key，再看每条消息是否卡在模型限流、文件解析或数据库连接池。传统组内消费者多于分区时会出现空闲实例。还要检查重复失败和重平衡是否浪费大量时间。按阶段拆分耗时任务、设置合理并发和退避，通常比盲目扩消费者更有效，扩容需配合下游容量。' }
    ],
    sources: [{ label: 'Kafka：设计与消费语义', url: 'https://kafka.apache.org/41/design/design/' }, { label: 'Spring Kafka：使用文档', url: 'https://docs.spring.io/spring-kafka/reference/kafka.html' }],
    related: ['rocketmq', 'rabbitmq', 'temporal', 'reliability', 'clickhouse']
  },
  {
    id: 'rocketmq', title: 'RocketMQ', category: '执行', tagline: '连接 Java 业务事件与异步 Agent 任务',
    level: '进阶', minutes: 20, priority: '按需', kind: 'middleware',
    summary: 'RocketMQ 可用于文档索引、报告生成、业务通知和跨服务事件处理，提供普通、顺序、定时／延时和事务等消息能力。对已有 RocketMQ 的 Java 团队，复用它通常比为 Agent 新增另一套队列更务实。可靠性仍依赖生产确认、消费处理、重试和业务幂等，不能把消息服务的能力直接等同于端到端业务保证。',
    when: ['企业已有 RocketMQ 运维与 Spring 接入经验。', '业务事件需要驱动索引、报告、通知等异步任务。', '需要顺序、延迟或本地事务关联消息，并愿意理解对应语义。'],
    notFor: ['试图用事务消息代替任意跨服务数据库事务。', '只为调用一次模型就引入消息集群。'],
    concepts: [
      { title: 'Topic、Tag 与消费组', text: 'Topic 表达事件类别，Tag 可用于细分过滤，消费组表达具有相同消费逻辑的实例集合。不同业务下游应独立建组。分组与订阅不一致会导致难以理解的消费行为，命名与订阅配置需要统一管理。' },
      { title: '业务 Key 与重复投递', text: '消息业务 Key 便于追踪，但设置 Key 不等于 Broker 自动为业务去重。网络超时、重发和消费重试都可能让同一业务事件被再次处理。以业务事件 ID 去重比单纯依赖可能变化的消息 ID 更稳妥。' },
      { title: '事务消息的范围', text: '事务消息通过半消息与本地事务检查协调本地业务状态和消息发布，适合“本地提交后下游应收到事件”。它不让下游业务与上游同时原子提交，也不替代下游幂等、补偿与最终一致性处理。' }
    ],
    flow: ['业务提交并确定事件 ID', '生产者发送且检查确认', '消费组领取事件', '执行幂等索引或业务处理', '成功后确认，失败按策略重试', '超过重试预算进入失败处理与告警'],
    sections: [
      { title: '从现有业务系统接入 Agent', paragraphs: ['例如订单状态变化后，由消费者触发售后建议生成；消费者读取最新订单与权限，只生成建议或调用受控业务工具。不要把过时消息体当成当前业务事实，尤其涉及库存、金额和审批状态时。', '接口可先返回 task_id，前端查询任务状态。消息只传事件和引用，任务事实仍在关系库；消费成功意味着完成了定义的工作，而不是仅仅把工作放进本地线程池。'], bullets: ['同一业务对象需要顺序时明确消息分组与版本检查。', '对模型调用配置超时、并发和费用预算。'] },
      { title: '最小使用示例：发送一个文档版本事件', paragraphs: ['前提：项目加入 org.apache.rocketmq:rocketmq-client，使用兼容的传统 Remoting API；NameServer 与 Broker 已部署，并创建 agent-document-events Topic。以下是可放入 throws Exception 方法的片段，生产客户端通常应单例复用。RocketMQ 5.x 新客户端与代理接入方式不同，请按所选 SDK 文档配置，不要混用端点。'], bullets: ['send 返回结果后仍需检查状态；异常与超时需保留可重试事件。', '业务 Key 用于关联追踪，消费者必须自行实现幂等。'], code: { language: 'java', label: 'RocketMQ 传统 Java API · 发送片段', value: `import org.apache.rocketmq.client.producer.DefaultMQProducer;
import org.apache.rocketmq.client.producer.SendStatus;
import org.apache.rocketmq.common.message.Message;
import java.nio.charset.StandardCharsets;

var producer = new DefaultMQProducer("agent-publisher");
producer.setNamesrvAddr(System.getenv("ROCKETMQ_NAMESRV"));
producer.start();
try {
    var message = new Message("agent-document-events", "published",
        "doc-1:v2".getBytes(StandardCharsets.UTF_8));
    message.setKeys("tenant-1-doc-1-v2");
    var result = producer.send(message);
    if (result.getSendStatus() != SendStatus.SEND_OK) {
        throw new IllegalStateException(result.toString());
    }
} finally {
    producer.shutdown();
}` } },
      { title: '重试不是修复业务错误', paragraphs: ['网络抖动和短时限流可以退避重试；文件损坏、权限不足、参数错误通常需要修复输入或人工处理。将所有异常无限重试会造成积压，也会重复消耗模型费用。应区分可重试与不可重试错误，记录最后一次原因。', '消息进入失败队列后仍需有责任人和恢复入口。修复后重放时保持原事件 ID，确认处理结果不会倒退版本，也不会重复触发外部动作。'], bullets: ['告警应关联任务、事件和工具调用编号。', '业务状态对账可以发现“已提交却未发布”的边缘情况。'] }
    ],
    decisions: [{ option: '复用 RocketMQ', fit: 'Java 业务已标准化使用，事件与延时任务需求明确。', tradeoff: '核对 SDK 代际、消息类型和部署能力。' }, { option: '引入持久化工作流', fit: '任务有多步骤依赖、等待人工事件和跨天恢复。', tradeoff: '新增工作流建模和 Worker 运维，但流程状态更集中。' }],
    pitfalls: ['把 setKeys 当作自动去重开关。', '事务消息本地回查逻辑不可靠，无法判断业务是否真正提交。', '消费异常被 catch 后吞掉，系统确认成功但业务实际失败。'],
    qa: [
      { q: '生产者发送超时后可以直接重发吗？', a: '可以按重试策略处理，但要把结果视为不确定：Broker 可能已经接收，只是确认未到达。重发应复用稳定业务事件 ID，消费者据此幂等。重要事件可以先进入本地 outbox，再由发布器持久重试并检查发送结果，不能仅依赖一次内存调用，否则进程退出后就失去后续补发依据。' },
      { q: '事务消息能保证 Agent 操作业务系统只执行一次吗？', a: '不能。它主要协调本地事务与消息发布，下游可能重复消费，远程工具也可能成功后丢失响应。必须在消费端和业务接口使用幂等键，并保存真实执行结果。涉及多步骤操作时还需要状态机、补偿或工作流；事务消息只是可靠事件链的一环，不是跨系统恰好一次的通用保证。' }
    ],
    sources: [{ label: 'RocketMQ：最佳实践与消费幂等', url: 'https://rocketmq.apache.org/docs/bestPractice/01bestpractice/' }, { label: 'RocketMQ：Spring 官方集成', url: 'https://github.com/apache/rocketmq-spring' }],
    related: ['kafka', 'rabbitmq', 'temporal', 'reliability', 'business-agent']
  },
  {
    id: 'rabbitmq', title: 'RabbitMQ', category: '执行', tagline: '用路由、确认与背压管理后台工作',
    level: '进阶', minutes: 19, priority: '按需', kind: 'middleware',
    summary: 'RabbitMQ 适合需要明确路由和工作队列的场景，例如把 PDF 解析、图片 OCR 和报告生成分发给不同 Worker。理解它的关键是生产者确认与消费者确认的区别：前者关注消息是否被 Broker 接受，后者关注消费者是否完成处理。两种确认都重要，但仍不能省略幂等、失败队列和任务状态记录。',
    when: ['任务类别清晰，需要按路由分发到不同能力的 Worker。', '需要控制每个消费者同时持有的未确认任务数量。', '团队已有 RabbitMQ，后台任务和事件路由是主要需求。'],
    notFor: ['把普通队列当长期保留、任意回放的事件日志。', '处理结束前自动确认，认为消息可靠性由队列单方面保证。'],
    concepts: [
      { title: 'Exchange、Queue 与 Binding', text: '生产者把消息发给 Exchange，由绑定与路由键决定进入哪些 Queue。消费者从 Queue 获取工作。发出消息不代表路由成功，应为不可路由消息建立返回或替代处理，生产端也需要确认与错误记录。' },
      { title: 'Publisher Confirm 与 Consumer Ack', text: '生产确认说明 Broker 处理了发布，消费确认说明客户端声明处理完成，它们相互独立。消费者处理成功但确认丢失会再次收到消息，因此即使启用两种确认，也需要用业务幂等键防止重复副作用。' },
      { title: 'Prefetch 与失败路由', text: 'Prefetch 限制消费者持有的未确认消息数量，能帮助控制耗时任务并发。失败可以拒绝、重新入队或进入死信路由，但立即重新入队可能形成高速循环。可恢复错误要有退避，不可恢复错误要进入可追踪的失败处理。' }
    ],
    flow: ['任务事件发布到 Exchange', '绑定路由到工作 Queue', 'Worker 按 prefetch 领取消息', '幂等完成解析或生成任务', '成功 Ack，失败进入受控重试或死信', '数据库记录最终任务状态'],
    sections: [
      { title: '队列配置和业务完成条件一起设计', paragraphs: ['文档解析可以分成 CPU 密集和外部 OCR 两类队列，各自设置并发，避免外部服务限流拖垮所有工作。队列持久化、消息持久化、复制方式与确认策略应一起评估，单独勾选 durable 不等于所有故障都不会丢消息。', '任务耗时长时关注消费者确认超时和连接生命周期。完成一个业务步骤后再确认，若需要跨多个长步骤，持久化任务状态或工作流通常更清楚。'], bullets: ['输入用任务 ID 与对象引用，避免巨大消息体。', '前端查询任务表，不要只看队列长度推断任务完成。'] },
      { title: '最小使用示例：手动确认的监听方法', paragraphs: ['前提：Spring Boot 加入 spring-boot-starter-amqp，已配置连接、agent-index 队列和死信交换机／队列。以下是已有 Spring Bean 的方法片段，indexingService 是你实现的幂等服务，方法返回前必须完成持久化提交；示例失败直接进入死信流程，不包含延迟重试。'], bullets: ['basicAck 在业务提交后执行。', 'basicNack 的 requeue=false 只有配置死信路由时才会进入死信队列，否则消息会被丢弃。', 'Ack 网络失败也可能触发重投，幂等服务是必要前提。'], code: { language: 'java', label: 'Spring AMQP · 手动确认片段', value: `// imports：RabbitListener、org.springframework.amqp.core.Message
// com.rabbitmq.client.Channel；java.nio.charset.StandardCharsets
@RabbitListener(queues = "agent-index", ackMode = "MANUAL")
public void onMessage(Message message, Channel channel)
        throws java.io.IOException {
    long tag = message.getMessageProperties().getDeliveryTag();
    String event = new String(message.getBody(), StandardCharsets.UTF_8);
    try {
        indexingService.indexIdempotently(event); // 自己实现并提交业务事务
    } catch (RuntimeException ex) {
        channel.basicNack(tag, false, false); // 前提：已配置死信路由
        return;
    }
    channel.basicAck(tag, false);
}` } },
      { title: '定位积压与消息丢失感知', paragraphs: ['消息积压时区分 ready 和 unacked：前者表示等待领取，后者表示已交给消费者但未确认。大量 unacked 常见于处理慢、阻塞或确认逻辑遗漏；ready 增长则可能是没有可用消费者、路由错误或生产速度超过处理能力。', '业务说“消息丢了”时按发布确认、路由、消费确认、死信与业务记录逐段查。不要仅凭生产端方法返回判断全链路完成，也不要直接清空队列掩盖问题。'], bullets: ['为每条任务传播 event_id 和 task_id。', '建立死信查看、修复和重放入口，并保留原幂等标识。'] }
    ],
    decisions: [{ option: 'RabbitMQ 工作队列', fit: '路由与任务分发为主，消费者处理时长可控。', tradeoff: '需设计确认、重试与失败处理，普通队列回放能力有限。' }, { option: 'Kafka 事件流', fit: '多个下游独立消费并需要历史重放。', tradeoff: '需要理解分区、offset 和事件保留。' }],
    pitfalls: ['处理异常后立即 requeue=true，坏消息形成高速重试风暴。', '配置 prefetch 很大，长任务都压在少数消费者内存中。', '没有死信绑定就使用 requeue=false，消息无法进入期望的失败队列。'],
    qa: [
      { q: '为什么业务已经执行成功，消息还会再来？', a: '业务完成和 Ack 到达 Broker 之间存在故障窗口。连接断开或进程退出时，Broker 无法知道业务已经完成，会把未确认消息重新投递。因此消费者必须根据稳定业务键返回已有结果或安全 upsert。不能通过提前 Ack 解决重复，因为那会把问题变成工作未完成却再也不投递。' },
      { q: '队列积压时如何判断是 Worker 慢还是确认有问题？', a: '同时看 ready、unacked、消费者数和单任务耗时。unacked 长时间高且业务日志已结束，重点检查 Ack 分支和通道错误；若业务还在等待模型或 OCR，则检查超时与下游限流。ready 高而消费者少或为空，先查订阅、权限与实例状态。调 prefetch 只能改变分配方式，不能提升下游真实容量。' }
    ],
    sources: [{ label: 'RabbitMQ：生产与消费确认', url: 'https://www.rabbitmq.com/docs/confirms' }, { label: 'RabbitMQ：死信交换机', url: 'https://www.rabbitmq.com/docs/dlx' }],
    related: ['kafka', 'rocketmq', 'temporal', 'document-parsing', 'reliability']
  },
  {
    id: 'temporal', title: 'Temporal', category: '执行', tagline: '让跨步骤、跨时间的任务能够恢复',
    level: '进阶', minutes: 24, priority: '按需', kind: 'middleware',
    summary: '一个研究 Agent 可能先搜索，再下载、解析、总结，等待人工确认后继续生成报告。流程会持续很久，也可能遇到进程重启。Temporal 通过持久化工作流历史帮助恢复执行进度，让等待、超时和重试成为流程的一部分。它解决流程可靠推进问题，不保证每次外部调用只发生一次；Activity 的副作用仍需要幂等。',
    when: ['任务跨多个步骤、持续数分钟至数天，需要等待外部事件。', '进程重启后必须继续已有流程，而不是从头重跑。', '需要明确的重试、超时、取消和人工确认恢复。'],
    notFor: ['简单单次同步问答或只有一项短后台任务。', '期待工作流框架替代工具鉴权、业务幂等和结果校验。'],
    concepts: [
      { title: 'Workflow 与 Activity', text: 'Workflow 描述流程控制，Activity 执行网络、数据库和模型调用等外部工作。Workflow 通过历史重放恢复，因此代码需要遵守确定性约束；随机数、系统时间和直接网络 I/O 不能随意放入流程逻辑。' },
      { title: '持久化历史与 Worker', text: '服务保存事件历史，Worker 执行具体代码。Worker 暂停或重启后，流程可根据历史恢复，但下游服务是否成功仍由 Activity 与业务协议判断。工作流代码升级需要考虑历史兼容，不能任意改变旧实例的执行顺序。' },
      { title: '重试与副作用幂等', text: 'Activity 可能执行成功却在确认返回前失联，系统随后重试。发送邮件、创建订单、扣款等动作应使用稳定操作键或可查询结果，而不是每次重试生成新请求 ID。超时也不必然意味着远程动作未发生。' }
    ],
    flow: ['客户端以稳定 Workflow ID 启动', 'Workflow 调度外部 Activity', 'Activity 执行业务并保存幂等结果', '历史记录步骤结果', '等待事件或重试失败步骤', '完成后记录最终产物与业务状态'],
    sections: [
      { title: '为什么消息队列还不够', paragraphs: ['消息队列把工作交给消费者，但多步骤依赖、人工等待、超时与恢复常要自行维护状态机。Temporal 将这些流程能力集中表达。若只是“上传后解析一次”，数据库任务表加队列可能足够；若流程有多次等待和分支，工作流更易解释。', '模型决定下一步时，也应把工具范围、预算、最大步骤和停止条件写成受控规则。流程可靠运行并不代表推理一定正确，业务结果仍需独立验证。'], bullets: ['Workflow 存流程控制，Activity 承担 I/O。', '外部审批与通知事件可通过适合的工作流消息机制推进。'] },
      { title: '最小使用示例：给 Activity 设定超时与重试', paragraphs: ['前提：Java 项目加入 io.temporal:temporal-sdk，已有 Temporal 服务与 Worker。需另行定义带 @WorkflowInterface／@WorkflowMethod 的 IndexWorkflow，以及带 @ActivityInterface 的 IndexActivities，其中 index(String documentVersion) 返回 String，并把实现注册到同一个 Task Queue。下例仅是工作流实现类，不能单独启动服务。'], bullets: ['index 实现调用外部系统，并以文档版本作为幂等标识。', '两分钟与三次重试只是教学值，实际按任务时长、费用和故障模式设计。'], code: { language: 'java', label: 'Temporal Java SDK · Workflow 实现片段', value: `import io.temporal.workflow.Workflow;
import io.temporal.activity.ActivityOptions;
import io.temporal.common.RetryOptions;
import java.time.Duration;

public class IndexWorkflowImpl implements IndexWorkflow {
    private final IndexActivities activities = Workflow.newActivityStub(
        IndexActivities.class,
        ActivityOptions.newBuilder()
            .setStartToCloseTimeout(Duration.ofMinutes(2))
            .setRetryOptions(RetryOptions.newBuilder()
                .setMaximumAttempts(3).build())
            .build());

    @Override
    public String run(String documentVersion) {
        return activities.index(documentVersion);
    }
}` } },
      { title: '失败排查先看流程在哪个边界', paragraphs: ['流程卡住时先区分任务无人领取、Activity 执行过慢、下游不可用、等待外部信号和历史重放不兼容。查看 Workflow 历史与 Worker 日志，用 Workflow ID、Activity ID 和业务请求编号关联，不要仅盯 Java 进程是否存活。', '长 Activity 可根据需要报告心跳，帮助发现失联与恢复；取消需要 Activity 和下游配合。工作流取消不一定能撤销已经发送的邮件或已创建订单，业务补偿仍要显式实现。'], bullets: ['升级流程代码前考虑存量执行的兼容策略。', '流程历史避免直接保存巨大文件和无必要的敏感内容。'] }
    ],
    decisions: [{ option: '数据库状态机 + 队列', fit: '流程简单，团队能清楚维护少量状态与重试。', tradeoff: '流程变复杂后容易分散在表、定时器和消费者里。' }, { option: 'Temporal', fit: '长任务、等待人工、复杂恢复是核心需求。', tradeoff: '需学习确定性、历史兼容与 Workflow/Activity 边界。' }],
    pitfalls: ['在 Workflow 中直接调用模型 HTTP 接口，破坏重放模型。', 'Activity 重试时生成新幂等键，导致重复创建业务对象。', '把超时或取消误解为远程系统绝对没有执行动作。'],
    qa: [
      { q: 'Temporal 已经持久化执行，为什么 Activity 还要幂等？', a: '因为外部动作与完成结果写入工作流历史之间仍有故障窗口。订单已经创建，但 Worker 在报告成功前崩溃，Activity 会重试。应把稳定业务操作键传给订单服务，重试时读取或返回已有结果。持久化历史让流程可恢复，幂等协议让恢复不会重复产生副作用，两者承担不同责任。' },
      { q: 'Workflow 一直运行却不前进，如何排查？', a: '先看历史中最后一个事件：若任务已调度却无人执行，检查 Worker、Task Queue 和连接；若 Activity 一直超时，检查下游、执行线程与超时设置；若等待 Signal，确认外部事件的 Workflow ID 是否正确；若重放失败，检查代码升级兼容。不要用反复重新启动新流程掩盖问题，否则可能重复执行已有动作。' }
    ],
    sources: [{ label: 'Temporal：Java SDK 指南', url: 'https://docs.temporal.io/develop/java' }, { label: 'Temporal：Activity 与幂等', url: 'https://docs.temporal.io/activity-definition' }],
    related: ['kafka', 'rocketmq', 'rabbitmq', 'reliability', 'business-agent']
  },
  {
    id: 'nacos', title: 'Nacos', category: '治理', tagline: '在多服务环境集中管理配置与发现',
    level: '进阶', minutes: 17, priority: '按需', kind: 'middleware',
    summary: '当 Agent 服务、检索服务和工具服务变多，模型地址、超时、召回参数与功能开关可能散落各处。Nacos 提供配置管理与服务发现能力，适合已有 Spring Cloud Alibaba 体系或需要集中治理的团队。它不是 Agent 必需组件：本地单体学习项目用环境变量和配置文件通常更清楚，先理解配置生效路径，再决定是否引入配置中心。',
    when: ['多个服务与环境需要集中配置、发布和订阅变化。', '已有 Nacos 服务发现体系，需要复用现有运维能力。', '模型路由、检索参数等配置需要可审计地调整。'],
    notFor: ['单个 Docker 服务，少量固定配置就能满足需求。', '把长期密钥直接散落在所有开发者都可读的配置里。'],
    concepts: [
      { title: 'Namespace、Group 与 Data ID', text: '它们共同表达配置的隔离与定位。常见做法按环境或租户管理 Namespace，再按应用和用途组织 Group 与 Data ID。必须区分 Namespace 的显示名称与实际 ID，客户端配置错位会读到空值或错误环境配置。' },
      { title: '配置获取不等于动态生效', text: '读取配置、收到变更通知、解析校验、替换应用内对象是不同步骤。Java SDK getConfig 只是获取内容；是否刷新连接池、模型客户端或检索参数取决于应用实现与框架集成。敏感开关应先验证再原子切换。' },
      { title: '服务发现与能力治理', text: '服务发现让调用方知道实例地址和健康情况，但不自动判断工具是否有权被某个 Agent 调用。工具认证、参数校验、权限、审计与限流仍由网关和业务服务负责。发现了服务不等于获得了授权。' }
    ],
    flow: ['按环境定义配置位置', '应用启动读取并校验配置', '构建模型和工具客户端', '订阅后续配置变更', '校验新值并安全替换', '记录生效版本与回滚路径'],
    sections: [
      { title: '先区分配置、密钥与业务数据', paragraphs: ['模型地址、连接超时、召回数量和功能开关属于配置；API Key 属于凭据；用户会话、任务状态和文档记录属于业务数据。不要为了集中管理把三者全部塞进同一配置文件。密钥优先走受控的凭据服务或环境注入，并限制读取权限。', 'Prompt 虽然可以作为文本配置发布，但仍需要版本、评测和回滚记录。只知道当前值，无法解释昨天某次 Agent 为什么采用不同策略。'], bullets: ['为每次调用记录实际生效的策略版本。', '召回数量和并发参数应设置服务端允许范围。'] },
      { title: '最小使用示例：读取一份配置', paragraphs: ['前提：项目加入 com.alibaba.nacos:nacos-client，服务端与 SDK 版本兼容，并已创建 agent-retrieval.yaml；环境变量提供可访问的地址、Namespace ID 和账号。以下是可放入抛出 NacosException 的方法片段，示例只获取文本，不包含 YAML 解析和动态刷新。'], bullets: ['生产服务通常复用 ConfigService 并注册 Listener，不要每个请求新建连接。', '读取后先校验 topK、timeout 等边界，再更新运行时配置。'], code: { language: 'java', label: 'Nacos Java SDK · 配置快照', value: `import com.alibaba.nacos.api.NacosFactory;
import java.util.Properties;

Properties props = new Properties();
props.setProperty("serverAddr", System.getenv("NACOS_SERVER"));
props.setProperty("namespace", System.getenv("NACOS_NAMESPACE_ID"));
props.setProperty("username", System.getenv("NACOS_USER"));
props.setProperty("password", System.getenv("NACOS_PASSWORD"));
var configService = NacosFactory.createConfigService(props);
try {
    String content = configService.getConfig(
        "agent-retrieval.yaml", "AGENT", 3000);
    if (content == null) {
        throw new IllegalStateException("配置不存在，请检查环境与 Data ID");
    }
    // 此处解析、校验并生成不可变的运行时配置对象。
} finally {
    configService.shutDown();
}` } },
      { title: '配置改了不生效怎么排查', paragraphs: ['依次确认客户端连接的服务端、Namespace ID、Group、Data ID 是否一致，再看权限、网络和订阅日志。读取到新内容但运行行为未变化，通常需要检查属性绑定、Listener、对象重建与覆盖优先级，而不是继续重复发布。', '配置中心不可用时，启动失败、使用缓存或采用安全默认值应按配置重要性决定。检索 Top-K 可以有保守默认值，权限控制和目标环境地址不应悄悄使用不确定默认值。'], bullets: ['集中发布不代表同时生效，观察各实例当前版本。', '大范围变更先小流量验证，保留上一个可用版本。'] }
    ],
    decisions: [{ option: '环境变量 + 配置文件', fit: '单体、本地 Docker 和较少运行参数。', tradeoff: '动态修改通常需要重启，跨服务管理需自行规范。' }, { option: 'Nacos', fit: '已有体系或多服务动态配置与发现需求明确。', tradeoff: '新增高可用、访问控制、版本兼容与生效追踪工作。' }],
    pitfalls: ['把 Namespace 显示名称当 ID，应用读取不到目标配置。', '配置中心内容已更新，却没有重新构建使用旧参数的模型客户端。', '把工具服务注册成功当作已经完成调用权限治理。'],
    qa: [
      { q: 'Nacos 上修改了模型地址，为什么请求仍然到旧地址？', a: '先确认应用读到的是同一环境、Group 和 Data ID，再检查是否实际收到变更。即使配置文本更新，已有模型客户端可能在启动时固定了地址，属性刷新也不会自动重建对象。应用需要校验新配置、创建新客户端并安全切换，记录实际生效版本；同时排查本地环境变量或配置文件是否覆盖远端值。' },
      { q: '本地学习 Agent 要不要安装 Nacos？', a: '通常不需要。先用环境变量和 application.yml 理解模型、数据库和检索接入，能减少初期变量。等出现多个服务、多个环境或频繁动态调整的真实需求，再引入 Nacos，并学习配置隔离、发布、监听和回滚。架构选择应由问题驱动，组件数量多并不会让学习效果或系统可靠性自动提高。' }
    ],
    sources: [{ label: 'Nacos：Java SDK 用法', url: 'https://nacos.io/en/docs/latest/manual/user/java-sdk/usage/' }, { label: 'Nacos：配置管理', url: 'https://nacos.io/en/docs/latest/manual/user/configuration-management/' }],
    related: ['ai-gateway', 'java-integration', 'production-architecture', 'docker']
  },
];
