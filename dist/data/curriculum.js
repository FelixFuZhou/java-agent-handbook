// 教学内容核验日期：2026-10-14。架构建议是本文的工程归纳，API 以链接中的官方版本文档为准。
export const foundations = [
  {
    id: 'agent-basics', title: '先分清 Agent、工作流与 RAG', category: '基础',
    tagline: '从熟悉的 Java 服务，理解模型参与决策后发生了什么。',
    level: '入门', minutes: 12, priority: '核心', kind: 'foundation',
    summary: 'Agent 是围绕目标反复选择行动、调用工具并观察结果的应用。它仍然需要普通后端承担权限、事务、状态和服务稳定性。先理解控制权在哪里，再决定需要哪些中间件。',
    when: ['需求包含自然语言理解、动态选择工具或不固定的执行步骤。', '要向同事解释为什么一个聊天接口还不等于可交付的 Agent。'],
    notFor: ['金额计算、库存扣减等确定性规则应继续交给业务代码。', '只有固定分类或文本摘要时，不必先引入多 Agent。'],
    concepts: [
      { title: 'LLM：提供判断与生成', text: '模型接收上下文，生成文本或结构化工具请求。它不自动拥有数据库连接，也不能把生成的“已提交”当成业务成功。' },
      { title: 'Workflow：代码规定路线', text: '开发者定义节点和分支，模型只在部分节点处理语言任务。比如先查订单，再校验售后规则，最后生成解释。' },
      { title: 'Agent：运行时选择行动', text: '模型可以根据当前结果选择下一步，例如先检索政策，再查询订单，缺少条件时询问用户；应用必须限制步数、权限和预算。' },
      { title: 'RAG：为生成补充证据', text: '检索增强生成把外部资料放入上下文。它既能作为固定流程，也能作为 Agent 的一个检索工具，本身不意味着自主执行。' }
    ],
    flow: ['接收目标与可信身份', '组装指令、历史和证据', '模型输出回答或工具请求', '应用校验并执行工具', '返回结果，继续或终止'],
    sections: [
      { title: '用熟悉的分层理解它', paragraphs: ['Controller 接收请求，应用服务组织模型、检索与工具，领域服务维护业务规则，Repository 负责持久化。Agent 编排位于应用层；“模型建议退款”必须经过领域服务的资格、金额和权限校验。'], bullets: ['把模型输出看作外部不可信输入，先校验再使用。', '事实以业务接口结果为准，引用以实际检索内容为准。'] },
      { title: '一个可以讲清楚的执行循环', paragraphs: ['模型提出行动，程序决定能否执行，再把真实结果交回模型。每一轮都会增加延迟与费用，所以要有明确的完成条件；超出预算时返回已完成部分与未完成原因。'], bullets: [], code: { language: 'text', label: '执行逻辑示意，不对应具体框架 API', value: 'state = 当前任务与已知事实\n重复直到完成或达到预算：\n  action = 模型选择下一步(state)\n  若 action 是回答：校验并结束\n  校验工具、身份、参数与操作范围\n  result = 执行工具(action)\n  state = 保存结果与新状态' } },
      { title: '第一套架构如何控制复杂度', paragraphs: ['从一个模型入口、少量只读工具和关系型数据库开始。只有文档问答才加检索；只有耗时异步工作才加队列；只有必须跨故障继续执行才增加持久化编排。组件数量不能代表 Agent 的能力。'], bullets: ['先画出一次请求的数据流，再选组件。', '模型决定表达和候选行动，业务系统决定事实与权限。'] }
    ],
    decisions: [
      { option: '固定工作流', fit: '路径稳定、规则明确、可审计要求高。', tradeoff: '灵活性有限，但容易定位失败节点。' },
      { option: '受约束的 Agent 循环', fit: '工具选择和步骤取决于中间结果。', tradeoff: '需要处理循环、成本、失败和权限边界。' }
    ],
    pitfalls: ['把模型生成的自然语言当作业务执行回执。', '用多 Agent 分工掩盖尚未定义清楚的业务流程。', '只限制单次输出长度，没有限制整个任务的轮次和耗时。'],
    qa: [
      { q: 'RAG 和 Agent 是什么关系？', a: 'RAG 解决回答依据从哪里来，Agent 解决下一步采取什么行动。知识库问答可以只是检索加生成；复杂业务 Agent 可以把检索、SQL 查询和工单创建组合为工具。两者可以组合，也可以独立使用。' },
      { q: '为什么有了大模型还需要 Java 后端？', a: '模型擅长理解与生成，但鉴权、事务、幂等、审计和数据一致性需要确定性实现。Java 后端把模型的候选动作转换为受控业务调用，才使系统具备可维护的生产行为。' },
      { q: '实战排障：Agent 反复调用同一个工具，应该先查哪里？', a: '按 taskId 查看连续几轮的工具参数、真实结果和下一步决策。先确认结果是否回传模型，再检查错误是否被包装成空结果、工具描述是否含糊、完成条件是否缺失。暂时限制总轮次和同参数重复调用；若业务路径本来固定，可改成显式工作流，不要只提高模型预算。' }
    ],
    sources: [{ label: 'Anthropic：工作流与 Agent 的工程区分', url: 'https://www.anthropic.com/engineering/building-effective-agents' }, { label: 'Spring AI：Tool Calling', url: 'https://docs.spring.io/spring-ai/reference/api/tools.html' }],
    related: ['java-integration', 'rag-pipeline', 'tool-calling', 'reliability']
  },
  {
    id: 'java-integration', title: 'Java 技术栈与框架边界', category: '基础',
    tagline: '先接通一个模型，再理解 Spring AI、Alibaba 与 Graph 的分工。',
    level: '入门', minutes: 14, priority: '核心', kind: 'foundation',
    summary: 'Java 开发 Agent 的核心是把模型能力接入现有 Spring 服务体系。Spring AI 提供常用 AI 集成抽象；Spring AI Alibaba 提供面向 Java 的 Agent 与 Graph 能力。框架与中间件分别解决代码组织和独立运行服务的问题。',
    when: ['已有 Spring Boot 服务，需要接入模型、检索与业务工具。', '需要判断什么时候直接使用 ChatClient，什么时候增加图编排。'],
    notFor: ['不要把某个框架的示例工程当成完整生产架构。', '不要混用不同发布线的依赖和 API 示例。'],
    concepts: [
      { title: 'Spring AI：集成抽象', text: 'ChatClient、模型适配、工具调用、向量存储与 Advisor 让应用代码可以组合 AI 能力；实际供应商能力和配置仍需逐一核验。' },
      { title: 'Spring AI Alibaba：Agent 生态', text: '它基于 Spring AI，提供 Agent Framework、Graph 等组件，并包含国内模型与云原生生态集成；使用范围可以按需求选择。' },
      { title: 'Graph：显式管理状态与路线', text: 'Graph 适合把模型、工具、条件分支和人工介入表示为节点与状态。它不会替业务接口实现幂等，也不等于消息队列。' }
    ],
    flow: ['选择模型与兼容依赖版本', '通过配置注入凭证', '封装应用层模型入口', '接入只读工具或检索', '按需加入状态编排和观测'],
    sections: [
      { title: '从最小模型调用开始', paragraphs: ['先确认模型地址、鉴权、超时和响应能跑通，再增加业务能力。下面只展示 ChatClient 的核心调用；需要在 Spring Boot 项目中安装匹配版本的模型 Starter，并提供模型连接配置。'], bullets: ['密钥放在服务端环境或凭据系统，避免进入前端和 Git。'], code: { language: 'java', label: 'Spring AI 官方 ChatClient 调用形态；省略项目与模型配置', value: 'import org.springframework.ai.chat.client.ChatClient;\n\n// builder 由已配置模型的 Spring 容器注入\nChatClient client = builder.build();\nString answer = client.prompt()\n    .user("解释 Redis 在 Agent 中的作用")\n    .call()\n    .content();' } },
      { title: '沿应用边界封装', paragraphs: ['在应用服务里封装模型调用，让 Controller 不直接依赖复杂 Prompt。工具适配已有领域服务；检索服务返回带文档来源的证据；模型服务返回内容和调用元数据。后续更换模型时可以定位哪些行为需要重新验证。'], bullets: ['统一记录模型、Prompt 版本、耗时与错误类型。', '结构化输出仍需 Bean Validation 与业务校验。'] },
      { title: '什么时候引入 Graph', paragraphs: ['只有“问一次、答一次”的能力可以先用 ChatClient。出现条件分支、循环、多步状态和等待人工处理后，再考虑 Graph。长时间跨服务业务还要单独评估工作流恢复、事件投递和事务补偿责任。'], bullets: ['构建时锁定兼容版本，跟随同一发布线文档。', '理解执行状态如何落盘，再讨论重启后继续。'] }
    ],
    decisions: [
      { option: 'Spring AI + 应用服务编排', fit: '调用路线短，已有服务能够承担状态管理。', tradeoff: '简单直接，复杂分支增多后代码需要重新组织。' },
      { option: 'Spring AI Alibaba Graph', fit: '需要明确节点、状态、分支和恢复点。', tradeoff: '增加编排概念和状态维护成本，需要学习运行时语义。' }
    ],
    pitfalls: ['复制最新文档代码，却使用旧版依赖。', '把所有业务逻辑写进一个巨大 Prompt 或 Controller。', '认为使用 Graph 后业务写入就自动具备恰好一次效果。'],
    qa: [
      { q: 'Spring AI 和 Spring AI Alibaba 是互斥选择吗？', a: '不是。Alibaba 基于 Spring AI 构建，并增加 Agent、Graph 与相关生态能力。先确定需要的抽象层次，再选择匹配的版本组合；不要仅因为连接国内模型就默认需要完整图编排。' },
      { q: 'Java 开发者需要先学 Python 才能做 Agent 吗？', a: '不需要。模型通常以 API 提供，Java 可以完成调用、检索、工具和流程编排。OCR、模型推理等组件可能采用 Python 实现，你可以通过 HTTP 或队列集成，学习其接口、部署与故障边界即可。' },
      { q: '实战排障：直接请求模型成功，Spring Boot 接入却失败，怎么定位？', a: '在同一运行环境对比请求地址、模型名、认证方式、代理与超时，查看真实 HTTP 状态和脱敏错误体。401 优先查凭据，404 查端点与模型，429 查配额。再核对 Starter 与 BOM 兼容性、配置是否被当前 Profile 覆盖，以及请求是否带入模型不支持的工具或参数。' }
    ],
    sources: [{ label: 'Spring AI：ChatClient', url: 'https://docs.spring.io/spring-ai/reference/api/chatclient.html' }, { label: 'Spring AI Alibaba：Graph 工作流编排', url: 'https://java2ai.com/docs/frameworks/graph-core/quick-start/' }],
    related: ['agent-basics', 'tool-calling', 'context-memory', 'ai-gateway', 'nacos']
  },
  {
    id: 'rag-pipeline', title: 'RAG：从文档到可追溯的回答', category: '基础',
    tagline: '把“搜得到”拆成解析、召回、排序、权限与证据组织。',
    level: '入门', minutes: 16, priority: '核心', kind: 'foundation',
    summary: 'RAG 包含离线构建知识索引与在线检索生成两条链路。向量数据库只负责其中的相似检索；文档质量、分块、权限过滤、索引更新和引用决定整个系统是否可用。',
    when: ['需要根据内部制度、产品文档或不断更新的资料回答。', '回答必须能够解释依据来自哪个文档、哪个版本。'],
    notFor: ['精确余额、实时库存等事实优先调用业务 API。', '不能把向量相似度当成事实可信度或回答置信度。'],
    concepts: [
      { title: 'Embedding 与向量召回', text: 'Embedding 把内容映射到向量空间，相似检索寻找语义接近的片段。文档和查询必须使用兼容的模型与向量维度。' },
      { title: '关键词、融合与重排', text: '关键词擅长编号、错误码和专有词；向量擅长同义表达。融合召回扩充候选，Reranker 再比较查询和候选的相关性。' },
      { title: 'ACL 与知识版本', text: '每个片段应携带文档、租户、访问范围与版本信息。服务端根据可信身份构建过滤条件，权限检查发生在内容进入模型之前。' }
    ],
    flow: ['文档落对象存储', '解析、分块并附上 ACL', '向量化与构建索引', '带权限检索候选', '融合重排并选择证据', '生成回答与可追溯引用'],
    sections: [
      { title: '离线链路负责知识可用', paragraphs: ['保留原文件和解析产物，便于定位表格丢失或段落混乱。按标题与语义分块，保存页码、章节和文档版本。更新时构建新版本再切换，删除时同时处理原文、索引与缓存，避免旧制度继续被引用。'], bullets: ['分块长度需要结合文档结构与召回效果调整。', 'Embedding 模型变更通常需要重新构建对应向量。'] },
      { title: '在线链路负责找到可信证据', paragraphs: ['先识别租户和访问范围，再检索。编号类问题保留关键词通道；长问题可以改写，但不能改变用户意图。重排后只放入足够且相关的证据，证据不足就说明缺失，不让模型补出不存在的规定。'], bullets: [], code: { language: 'text', label: '检索服务流程示意，不是框架 API', value: 'scope = 服务端计算当前用户可访问范围\ncandidates = 检索(query, scope, 已发布版本)\nallowed = 再次检查候选的文档权限\nevidence = 重排、去重、控制上下文长度(allowed)\nanswer = 根据 evidence 生成并附上来源' } },
      { title: '排查时沿链路定位', paragraphs: ['先看原文能否被正确解析，再看正确片段是否进入候选，然后检查重排与上下文裁剪，最后检查生成。直接更换大模型可能掩盖解析和检索缺陷，也无法恢复从未召回的证据。'], bullets: ['缓存键纳入租户、权限范围与知识版本。', '日志保留片段标识与排序信息，并对敏感正文做访问控制。'] }
    ],
    decisions: [
      { option: 'PostgreSQL + pgvector 起步', fit: '已有 PostgreSQL，规模与延迟要求可通过实测满足。', tradeoff: '减少服务数量，但业务负载和检索负载需隔离评估。' },
      { option: '独立向量库 + 混合检索', fit: '检索规模、复杂过滤或服务隔离有明确需求。', tradeoff: '增加索引同步、运维和一致性管理。' }
    ],
    pitfalls: ['先检索所有租户内容，生成以后才过滤答案。', '只增大 topK，把更多不相关片段塞入上下文。', '更新文档没有删除或屏蔽旧版本片段。'],
    qa: [
      { q: '为什么向量检索找不到订单号和错误码？', a: '这些字段强调精确匹配，语义接近并不代表值相同。可以先做结构化过滤或关键词查询，再与向量召回融合；不要为了统一架构而丢掉更合适的检索方式。' },
      { q: '有 RAG 就能避免幻觉吗？', a: '不能。错误解析、漏召回、过期知识和生成时错误引用都会造成不可靠回答。需要分阶段观察证据、维护版本与权限，并允许系统在证据不足时明确说明，而不是强制回答。' },
      { q: '实战排障：用户拿到了其他部门的知识片段，怎样定位 ACL 漏洞？', a: '先阻断受影响路径，再沿请求核对可信身份、服务端计算的权限范围、实际检索过滤条件和返回片段 ACL。检查过滤是否在查询改写或多路召回时丢失，以及答案缓存、聊天记忆和引用下载是否绕过权限。修复后用授权与未授权身份重放同一问题，确保内容在进入模型前已隔离。' }
    ],
    sources: [{ label: 'Spring AI：模块化 RAG', url: 'https://docs.spring.io/spring-ai/reference/api/retrieval-augmented-generation.html' }, { label: 'Spring AI：向量存储过滤与检索', url: 'https://docs.spring.io/spring-ai/reference/api/vectordbs.html' }],
    related: ['document-parsing', 'embedding', 'reranker', 'pgvector', 'milvus', 'elasticsearch', 'knowledge-assistant']
  },
  {
    id: 'tool-calling', title: '工具调用、MCP 与业务鉴权', category: '基础',
    tagline: '模型负责提出行动，业务服务负责确认能否执行。',
    level: '进阶', minutes: 15, priority: '核心', kind: 'foundation',
    summary: '工具调用让模型通过结构化参数请求应用执行操作。MCP 统一客户端与工具服务的交互方式，但不会自动完成用户授权、业务规则检查、幂等或执行审批。',
    when: ['需要查询实时订单、创建工单或操作其他业务系统。', '多个 Agent 应用需要复用一组工具服务。'],
    notFor: ['不要直接向模型暴露任意 SQL、任意 URL 请求或生产 Shell。', '不能用工具描述中的“只允许本人查询”替代代码鉴权。'],
    concepts: [
      { title: '工具契约', text: '工具名称、用途、参数结构和返回值需要清晰稳定。参数尽量贴近业务意图，如查询订单状态，而不是暴露宽泛的数据访问能力。' },
      { title: '可信执行上下文', text: '租户、用户和权限来自登录态或服务端委托上下文。模型可以提供订单号，但不能通过自己填写 userId 获得他人权限。' },
      { title: 'MCP 的边界', text: 'MCP 规定 Host、Client、Server 如何发现与调用能力。协议对接完成后，业务工具仍需执行访问控制、参数检查、超时和审计。' }
    ],
    flow: ['向模型提供必要的工具定义', '模型返回工具名与参数', '应用检查工具范围和参数', '业务服务鉴权与执行', '记录结果并回传模型', '根据真实执行结果回答'],
    sections: [
      { title: '先做小而明确的只读工具', paragraphs: ['例如查询订单状态，只返回理解当前问题所需的字段。找不到订单、无权限和上游超时要有可区分的错误类型；对外展示可以统一处理，但内部不能把它们都变成空字符串。'], bullets: ['工具返回业务数据与状态，避免夹带命令式文本。', '限制返回行数和文本长度，避免拖垮上下文。'] },
      { title: '把鉴权放进每次执行', paragraphs: ['入口鉴权解决谁在使用应用；工具鉴权解决这个人是否能操作这个对象。两者都需要。下面的关键是 actor 来自服务端，写操作还应检查授权范围、业务状态和是否需要确认。'], bullets: [], code: { language: 'text', label: '工具执行安全边界示意', value: 'actor = 读取可信登录上下文\nargs = 校验模型生成的工具参数\norder = 按订单号读取业务对象\n检查 actor 所属租户与订单访问权限\n检查订单当前状态是否允许操作\n带幂等键调用领域服务，并保存回执' } },
      { title: '写操作与外部副作用', paragraphs: ['退款、发消息、改地址等操作应区分预览与提交。用户已经明确授权的范围可直接执行；含糊请求先补齐对象和参数。模型重试、网络超时和重复消息都可能触发重复调用，需要业务幂等键与执行记录。'], bullets: ['远程 MCP 服务应验证来源和凭据使用范围。', '工具结果中的网页或文档内容不能升级为系统指令。'] }
    ],
    decisions: [
      { option: '应用内 Java 工具', fit: '工具较少，与现有服务同进程，调用边界清晰。', tradeoff: '实现简单，但跨应用共享需要额外封装。' },
      { option: 'MCP Server', fit: '多个客户端需要通过统一协议发现与调用工具。', tradeoff: '增加连接、认证和版本兼容管理，仍要实现业务鉴权。' }
    ],
    pitfalls: ['信任模型填写的租户或用户标识。', '把工具可发现等同于工具可执行。', '工具执行失败，最终回答却声称操作成功。'],
    qa: [
      { q: 'Function Calling 和 MCP 有什么区别？', a: '工具调用是模型输出结构化行动请求的能力；MCP 是应用连接外部能力的一套协议。模型选择工具后，应用可以调用本地 Java 方法、HTTP 接口或 MCP Server，具体执行路径由应用控制。' },
      { q: '如何避免模型重复下单？', a: '在业务层生成稳定的操作标识，对同一次意图的重试沿用幂等键，并对已成功操作返回原回执。超时后先查询执行状态，不能仅靠 Prompt 告诉模型不要重复，也不能每重试一次都生成新订单号。' },
      { q: '实战排障：退款工具超时后发生两次退款，该查哪些记录？', a: '先暂停该任务的自动重试，按订单和 operationId 对照工具调用、网关重试、消息投递与退款流水。检查每次尝试是否沿用同一幂等键，以及下游是否原子地保存去重标识和业务结果。若第一次已提交却丢失响应，应查询并复用原回执；已发生的重复退款按正式业务补偿流程处理。' }
    ],
    sources: [{ label: 'Spring AI：Tool Calling', url: 'https://docs.spring.io/spring-ai/reference/api/tools.html' }, { label: 'MCP：架构与参与角色', url: 'https://modelcontextprotocol.io/docs/learn/architecture' }],
    related: ['java-integration', 'reliability', 'business-agent', 'ai-gateway', 'sandbox']
  },
  {
    id: 'context-memory', title: '上下文、会话记忆与检查点', category: '基础',
    tagline: '把“说过什么”“记住什么”“执行到哪”分开管理。',
    level: '进阶', minutes: 14, priority: '核心', kind: 'foundation',
    summary: '上下文是本次模型调用真正看到的内容，聊天历史是完整记录，长期记忆是跨会话提炼的信息，检查点是任务执行状态。四者可以使用相同数据库，但数据模型、生命周期和访问规则不同。',
    when: ['多轮对话需要理解“上一笔订单”“继续刚才的任务”。', '任务需要人工介入、失败恢复或跨会话使用用户偏好。'],
    notFor: ['不要把全部历史无限追加给模型。', '不要把模型推断出的偏好直接当成永久事实。'],
    concepts: [
      { title: '上下文预算', text: '系统指令、对话、证据、工具结果和预留输出共同消耗上下文。应选择相关内容并保留关键事实，而不是仅依赖更长的窗口。' },
      { title: '长期记忆', text: '偏好、事实和经验需要来源、作用范围、更新时间与删除机制。记忆是可修正的数据，不应替代订单等业务系统的事实源。' },
      { title: 'Checkpoint', text: '检查点保存任务节点、状态和恢复所需信息。它用于继续执行，不等于聊天摘要，也不保证已经发生的外部副作用不会被重复执行。' }
    ],
    flow: ['按租户和会话读取历史', '选取最近消息与有效摘要', '检索相关证据和允许使用的记忆', '组装本次上下文', '执行后保存消息与任务检查点', '按策略更新或删除长期记忆'],
    sections: [
      { title: '从 Java 数据模型看差别', paragraphs: ['conversation_message 记录对话；user_memory 保存有来源的偏好；task_run 与 checkpoint 保存任务推进信息。可以都落 PostgreSQL，但主键和查询范围应包含租户、用户或任务身份，避免不同用户共用一个会话键。'], bullets: ['Redis 可以缓存近期状态，是否作为唯一持久层要看丢失后的影响。'] },
      { title: '上下文需要取舍', paragraphs: ['保留当前目标、用户限制、最近消息及必要工具结果；较早对话可以摘要。摘要会丢细节，因此关键业务参数单独结构化保存，并在执行前回查可信来源。引用原文、历史陈述和模型推断应有明确区分。'], bullets: [], code: { language: 'text', label: '上下文装配示意', value: '本次上下文 =\n  固定系统规则\n  + 当前任务目标与约束\n  + 有界的近期消息\n  + 经授权检索的证据\n  + 本次相关且未过期的记忆\n  + 最新工具执行结果' } },
      { title: '恢复不能只恢复文字', paragraphs: ['支付接口已成功、进程却在写检查点前崩溃，此时重放可能再次支付。恢复时必须结合操作流水和幂等回执判断外部动作是否完成。检查点负责推进状态，业务系统负责确保写操作效果正确。'], bullets: ['记忆修改或权限收回后，同时失效相关缓存。', '删除聊天记录和删除长期记忆是两种独立的数据操作。'] }
    ],
    decisions: [
      { option: '近期窗口 + 持久化聊天历史', fit: '常见多轮问答，跨会话个性化需求不强。', tradeoff: '易于控制，较早上下文需要摘要或查询。' },
      { option: '长期记忆 + 任务检查点', fit: '个性化服务或可恢复的长任务。', tradeoff: '需要生命周期、权限和恢复语义设计。' }
    ],
    pitfalls: ['conversationId 不校验归属，导致读取他人历史。', '摘要替代原始业务数据，执行时不再核验。', '认为有 checkpoint 就可以安全重试任何写操作。'],
    qa: [
      { q: '把聊天记录存在 Redis 就叫长期记忆吗？', a: '存在哪里不决定记忆类型。完整消息属于历史记录，模型本次读取的部分属于上下文，跨会话提炼的可维护事实才属于长期记忆。应先定义信息用途和保留规则，再选择存储。' },
      { q: 'Checkpoint 和工作流有什么关系？', a: 'Checkpoint 是持久化执行状态的一种机制，工作流负责状态如何推进与恢复。恢复是否可靠还取决于状态落盘时机、节点重放语义和外部动作幂等；仅保存最后一段聊天不足以恢复业务任务。' },
      { q: '实战排障：重启后能看到聊天记录，却无法继续任务，为什么？', a: '聊天持久化不等于执行状态持久化。先查 taskId 是否关联正确检查点，再确认保存后端是否仍为内存实现、容器数据卷是否存在、事务是否提交，以及新版本是否兼容旧状态。恢复前核对已执行工具的操作流水；不能凭聊天中的“已完成”判断副作用，也不要直接重跑整个任务。' }
    ],
    sources: [{ label: 'Spring AI：Chat Memory 与 Chat History', url: 'https://docs.spring.io/spring-ai/reference/api/chat-memory.html' }, { label: 'LangGraph：持久化、检查点与 Store', url: 'https://docs.langchain.com/oss/python/langgraph/persistence' }],
    related: ['postgres', 'redis', 'mongodb', 'temporal', 'reliability']
  },
  {
    id: 'reliability', title: '超时、重试、幂等与失败恢复', category: '基础',
    tagline: '把模型的不确定性放进可观察、可恢复的工程边界。',
    level: '进阶', minutes: 17, priority: '核心', kind: 'foundation',
    summary: '生产 Agent 的失败不只来自模型：检索、网络、工具、队列和状态持久化都可能出错。可靠性设计要回答何时停止、哪些动作能重试、失败后从哪里继续，以及如何向用户呈现真实状态。',
    when: ['一次任务跨越多个服务，或者可能执行外部写操作。', '模型调用有长尾延迟、限流和费用上限要求。'],
    notFor: ['不要对权限失败、无效参数或业务规则拒绝做盲目重试。', '流式返回部分文本不代表任务已经成功。'],
    concepts: [
      { title: '分层预算', text: '区分连接超时、单次调用超时、流式空闲超时和整个任务截止时间，同时限制并发、轮次、输出和累计费用。' },
      { title: '可重试与状态未知', text: '暂时限流可以退避重试；写接口超时可能已经提交。先查询业务回执，才能决定重试、补偿或人工处理。' },
      { title: '端到端可观测', text: '同一 taskId 串联模型、检索、工具与异步工作。每步记录开始、结束、结果类型、版本与耗时，使失败能落到具体边界。' }
    ],
    flow: ['创建任务和总预算', '调用模型或工具并记录步骤', '分类正常、可重试、拒绝、状态未知', '退避重试或查询回执', '保存可恢复状态', '完成、部分完成或等待处理'],
    sections: [
      { title: '重试前先判断语义', paragraphs: ['查询文档与提交退款的风险不同。只读请求可以在预算内重试；写操作必须使用业务幂等键。重试沿用同一逻辑操作标识，重试次数记录为 attempt，不能把新 attempt 当成新业务操作。'], bullets: ['指数退避加入随机抖动，避免大量请求同时重试。', '重试消耗总预算，不能让每一层各自无限重试。'] },
      { title: '明确任务状态', paragraphs: ['使用 QUEUED、RUNNING、WAITING、SUCCEEDED、FAILED 等状态表达生命周期；写操作响应丢失可用 UNKNOWN 表达待核实，避免误报失败后重复执行。状态变更与业务事件发送可结合事务 Outbox，消费者仍要幂等。'], bullets: [], code: { language: 'text', label: '失败恢复决策示意', value: '参数或权限错误 → 终止并解释\n暂时限流/网络失败 + 只读 → 预算内退避重试\n写接口超时 → 查询同一操作的业务回执\n已成功 → 返回原结果\n未执行 → 使用原幂等键重试\n无法确认 → 标记待核实，停止后续依赖动作' } },
      { title: '运行可靠还要结果可靠', paragraphs: ['HTTP 200 只说明调用成功，不能证明引用正确或工具选对。保留少量真实业务样例观察变更前后表现，检查证据与执行结果；这是研发质量控制，不是学习者考试。生产监控同时关注任务完成率、失败类型、延迟和每任务成本。'], bullets: ['切换备用模型前验证工具协议与输出能力是否兼容。', '中止任务后检查已启动工作是否需要取消或收尾。'] }
    ],
    decisions: [
      { option: '数据库任务表 + 有界重试', fit: '任务较短、状态少，团队能够维护恢复逻辑。', tradeoff: '起步轻，复杂等待与恢复会增加自研负担。' },
      { option: 'Temporal 等持久化工作流', fit: '长任务、定时等待、跨服务恢复要求明确。', tradeoff: '需要理解执行与重试语义，业务副作用仍需幂等。' }
    ],
    pitfalls: ['接口超时后直接重新提交写操作。', '多层重试叠加导致流量与费用成倍放大。', '只看模型延迟，忽略队列等待与工具耗时。'],
    qa: [
      { q: '消息队列保证不丢消息，为什么还要幂等？', a: '不丢与不重复是不同问题。消费者提交业务后、确认消息前崩溃，会收到重复投递；应用重试也会重复调用。需要业务唯一约束、操作流水或幂等键保证重复执行不会产生第二次效果。' },
      { q: '模型超时能直接切换另一个模型吗？', a: '纯生成任务可以在剩余预算内降级，但要考虑已输出部分内容和能力兼容。若已经触发业务工具，先恢复已完成状态并核实副作用，不能把整段历史无条件重跑一遍。' },
      { q: '实战排障：入口有 Trace，Worker 和工具调用却串不起来，怎么查？', a: '先用 taskId 找到各段日志，检查 HTTP 请求和队列消息是否传递追踪上下文，消费者是否正确提取并建立 Span。Java 异步线程切换后不能假定 ThreadLocal 自动继承；检查实际执行器与客户端的观测接入。长任务可以建立新 Trace 并关联原 Trace，同时持续记录 taskId、stepId 和 attempt。' }
    ],
    sources: [{ label: 'Temporal：重试策略', url: 'https://docs.temporal.io/encyclopedia/retry-policies' }, { label: 'OpenTelemetry：Trace 与 Span', url: 'https://opentelemetry.io/docs/concepts/signals/traces/' }],
    related: ['temporal', 'rocketmq', 'rabbitmq', 'observability', 'evaluation', 'context-memory']
  }
];

export const patterns = [
  {
    id: 'knowledge-assistant', title: '场景：企业知识库助手', category: '场景',
    tagline: '从“这项报销需要哪些材料”走完一条有权限、有引用的链路。',
    level: '入门', minutes: 13, priority: '核心', kind: 'pattern',
    summary: '需求是员工根据最新制度提问，系统返回可追溯的解释，并且每个人只能看到有权限的资料。第一版可以由 Spring Boot、PostgreSQL + pgvector、对象存储和模型 API 组成。',
    when: ['制度、产品手册、运维文档等文本知识是主要信息源。', '资料经常更新，需要按版本追溯答案来源。'],
    notFor: ['实时个人报销进度应查询业务系统。', '没有权限元数据的文档集合不宜直接作为多租户知识库。'],
    concepts: [
      { title: '原文与索引分工', text: '对象存储保留文件；关系库管理文档、权限与版本；向量索引提供语义候选。索引是派生数据，应能从受控源重建。' },
      { title: '入库与问答分工', text: '解析、分块和向量化在后台进行；用户问答只访问已发布版本，避免将文档处理耗时放进在线请求。' },
      { title: '引用也是产品能力', text: '回答显示文档标题、章节、版本与对应片段；查看原文时仍要鉴权，不能用公开文件地址绕过访问控制。' }
    ],
    flow: ['员工登录并提出问题', '服务端生成可访问文档范围', '关键词或向量召回已发布片段', '重排与证据去重', '模型根据证据回答', '展示引用并记录检索链路'],
    sections: [
      { title: '具体需求如何映射组件', paragraphs: ['“解释报销材料”由模型组织语言；“从哪里找到规定”由检索完成；“规定是否最新”由文档发布流程保证；“谁能看”由服务端 ACL 控制。这个分工能避免把所有问题都归因于模型能力。'], bullets: ['Spring Boot：登录上下文、请求编排与文件授权。', 'pgvector：语义检索；对象存储：原件和解析结果。'] },
      { title: '一次请求的关键节点', paragraphs: ['员工问“差旅发票抬头错了怎么办”。系统先读取其组织和权限，再召回对应制度。若存在旧新两版，优先使用已生效版本。没有找到明确条款时返回已找到的范围和缺失信息，不根据常识编造公司政策。'], bullets: [], code: { language: 'text', label: '知识片段元数据示例', value: 'documentId: travel-policy\nversion: 2026-10\nstatus: published\ntenantId: corp-a\naccessGroups: [employees]\nsection: 发票异常处理\nsourcePage: 8' } },
      { title: '什么情况下扩展架构', paragraphs: ['文档导入积压时增加独立解析 Worker 和队列；编号类检索较弱时增加关键词与混合检索；候选相关性不足时加入重排。只有实测证明共享数据库难以满足负载或隔离要求，才评估独立向量服务。'], bullets: ['缓存答案必须考虑权限、知识版本与问题范围。', '优先修复解析和索引更新，再扩大模型或检索集群。'] }
    ],
    decisions: [
      { option: '固定 RAG 流程', fit: '一次检索即可获得主要证据的知识问答。', tradeoff: '简单可观察，多来源复杂问题覆盖有限。' },
      { option: '带检索工具的 Agent', fit: '需要多轮查资料、比较政策或结合业务查询。', tradeoff: '需要限制检索轮次、总耗时和可用工具。' }
    ],
    pitfalls: ['为了演示方便，把所有文档都标为公开。', '文件删除后向量索引和答案缓存仍保留内容。', '索引更新一半即开放查询，造成版本混合。'],
    qa: [
      { q: '为什么第一版推荐少量组件？', a: '先用熟悉的 PostgreSQL 管理业务与向量数据，可以验证解析、权限、引用和更新链路。架构是否扩展取决于真实负载和查询需求，而不是先为每种能力部署一个独立集群。' },
      { q: '问答结果差，应该先换模型吗？', a: '先检查正确文档是否被解析、正确片段是否召回、权限和版本是否过滤正确、证据是否被裁剪。若输入证据正确但生成仍然误读或遗漏，再评估 Prompt 与模型；这样才能定位投入真正生效的位置。' },
      { q: '实战排障：文档权限已经撤销，助手为什么还能引用旧内容？', a: '先确定内容来自本次召回、答案缓存还是旧会话。检查源权限是否同步到片段索引，缓存键是否包含权限版本，原文链接是否仍可访问。对敏感知识，恢复旧会话时也要重新确认引用权限；及时失效相关缓存和不可再用的上下文，并验证未授权用户无法继续取得原文。' }
    ],
    sources: [{ label: 'Spring AI：RAG 组件与处理阶段', url: 'https://docs.spring.io/spring-ai/reference/api/retrieval-augmented-generation.html' }, { label: 'pgvector：向量与 PostgreSQL 集成', url: 'https://github.com/pgvector/pgvector' }],
    related: ['rag-pipeline', 'postgres', 'object-storage', 'pgvector', 'document-parsing', 'embedding', 'reranker']
  },
  {
    id: 'business-agent', title: '场景：能够办事的业务 Agent', category: '场景',
    tagline: '用“修改订单收货地址”理解工具、权限、确认和幂等。',
    level: '进阶', minutes: 15, priority: '核心', kind: 'pattern',
    summary: '业务 Agent 把自然语言转换为业务意图，再调用已有领域服务完成操作。核心难点是把对象、权限、状态与副作用核验清楚，最终回答必须来自真实业务回执。',
    when: ['需要查订单、建工单、修改配置或提交业务申请。', '现有 Java 服务已经具有稳定的领域规则和接口。'],
    notFor: ['不要让模型绕过服务层直接修改生产数据库。', '不要把一次含糊的讨论当作所有后续写操作的授权。'],
    concepts: [
      { title: '意图与命令分离', text: '用户表达目标，模型提取候选参数，应用补齐对象与限制。只有经过校验的命令才可以进入领域服务。' },
      { title: '业务状态决定可执行性', text: '是否可改地址取决于订单归属、发货状态和物流限制。模型负责解释规则结果，不能自主放宽业务条件。' },
      { title: '回执与幂等', text: '同一逻辑操作具有稳定 operationId；重试查询原回执或沿用幂等键。成功答案包含真实结果，避免“说成功”却没有提交。' }
    ],
    flow: ['识别修改地址意图', '查找本人订单并补齐目标', '校验新地址与订单状态', '在需要时展示具体变更并取得确认', '携带幂等键提交领域服务', '查询回执并返回真实结果'],
    sections: [
      { title: '组件分别承担什么责任', paragraphs: ['Spring Boot 读取可信身份并编排；模型理解“把还没发货的那一单寄到公司”；订单服务查询和校验；关系库保存操作状态与回执。Redis 可以限流或缓存只读数据，但不能替代订单库判断操作最终结果。'], bullets: ['模型可见的工具只包含当前场景必要能力。', '请求中的 userId 不作为鉴权依据。'] },
      { title: '从自然语言走到业务提交', paragraphs: ['如果查到两笔待发货订单，需要明确目标；若地址缺少必要字段，需要补齐。确认展示具体订单和完整地址。提交前重新检查订单状态，防止用户确认期间已经发货；执行失败时说明原因并保留可继续的上下文。'], bullets: [], code: { language: 'text', label: '业务操作记录示例', value: 'operationId: op-20261014-001\ntype: CHANGE_ORDER_ADDRESS\nactorId: 服务端登录用户\norderId: 已确认的订单\nstatus: PENDING / SUCCEEDED / UNKNOWN / FAILED\nidempotencyKey: 同一意图重试时保持不变\nreceipt: 业务接口真实回执' } },
      { title: '什么时候增加其他中间件', paragraphs: ['业务执行只需短请求时，现有服务和数据库即可。涉及人工审批、等待物流回调或持续数小时的任务时增加持久化工作流；后续通知、索引更新等异步动作可以用队列。消息与业务提交需要设计一致性和重复消费处理。'], bullets: ['工具越来越多时再评估 MCP 网关与统一审计。', '失败补偿由业务语义决定，不能简单把接口反向调用一次。'] }
    ],
    decisions: [
      { option: '受约束的单 Agent + 领域服务', fit: '少量工具完成一个业务目标。', tradeoff: '路径短且容易约束，但需认真定义每个工具契约。' },
      { option: '明确状态的工作流', fit: '审批、回调、补偿和跨服务推进较多。', tradeoff: '更易审计，开发者需要维护状态与版本。' }
    ],
    pitfalls: ['重复生成幂等键，使每次重试都成为新操作。', '把业务接口超时解释为业务未执行。', '用户确认后不再核验对象状态，出现并发变更漏洞。'],
    qa: [
      { q: '为什么业务规则不写在 Prompt 里？', a: 'Prompt 可以帮助模型理解限制，但不能保证严格执行，也不适合处理并发状态。核心规则必须由领域服务校验，这样来自网页、App、Agent 的所有入口都遵守同一规则。' },
      { q: '提交后超时，应该怎样回复？', a: '先用 operationId 查询业务状态。确认成功则返回真实回执；确认未执行才可沿原幂等键重试；仍无法确认时明确说明处理中或待核实，并停止依赖该结果的后续动作。' },
      { q: '实战排障：Agent 说地址已修改，订单实际没变，怎样定位？', a: '按 operationId 从工具请求追到业务事务和回执，确认模型是否真的调用工具、领域服务是否拒绝、提交是否回滚，以及工具是否误把异常包装成成功。若写入已成功，再排查查询读副本或缓存延迟。最终答复必须由持久化回执决定，未确认成功时不能使用“已完成”模板。' }
    ],
    sources: [{ label: 'Spring AI：工具执行机制', url: 'https://docs.spring.io/spring-ai/reference/api/tools.html' }, { label: 'Temporal：活动重试策略', url: 'https://docs.temporal.io/encyclopedia/retry-policies' }],
    related: ['tool-calling', 'reliability', 'mysql', 'postgres', 'temporal', 'rocketmq', 'ai-gateway']
  },
  {
    id: 'research-agent', title: '场景：资料研究与报告生成', category: '场景',
    tagline: '用“比较三种向量方案”理解长任务、来源、文件和沙箱。',
    level: '进阶', minutes: 14, priority: '按需', kind: 'pattern',
    summary: '研究型 Agent 接收问题、检索多份资料、提取证据并生成报告。它通常比在线问答更耗时，需要任务状态、来源记录、预算和文件交付，而不是一直占用一次同步 HTTP 请求。',
    when: ['问题需要查多个来源、比较差异并输出报告。', '需要生成图表、处理文件或执行受控的数据分析。'],
    notFor: ['不要把搜索结果摘要直接当成完整原文证据。', '没有代码执行需求时，不必额外部署沙箱。'],
    concepts: [
      { title: '任务树与证据表', text: '将总问题拆成有限的子问题，每条结论关联来源、时间与相关段落。执行步骤可以变化，但交付范围和预算必须明确。' },
      { title: '异步状态', text: '接口先创建 taskId，Worker 执行检索与生成，前端查询或订阅进展。断开浏览器连接不应让任务状态无从查证。' },
      { title: '受控执行与产物', text: '计算或文件转换可放入隔离环境，限制网络、CPU、内存和时间。生成的文件写入对象存储，元数据和访问权限保存在业务库。' }
    ],
    flow: ['明确范围和交付格式', '创建任务与子问题', '检索并读取可信来源', '保存事实与证据链接', '按需执行分析与文件生成', '汇总差异并附引用交付'],
    sections: [
      { title: '用具体问题定义边界', paragraphs: ['“比较 pgvector、Milvus 与 Elasticsearch”仍然太宽。先确定文档规模、过滤要求、已有设施与延迟目标，再收集对应能力。报告区分官方能力、实测数据和架构判断；没有测试过的性能不能写成确定结论。'], bullets: ['来源同时记录访问日期和适用版本。', '同一事实避免只依赖相互转载的网页。'] },
      { title: '任务如何推进与恢复', paragraphs: ['一个研究步骤完成后保存子问题、证据和产物路径，下一步只接收必要摘要与引用。抓取失败可以有限重试；资料冲突要保留差异。进程恢复后从未完成步骤继续，避免重复下载和重新生成所有文件。'], bullets: [], code: { language: 'text', label: '任务与证据组织示意', value: 'task: 三种检索方案对比\nconstraints: 截止时间 / 来源数量 / 模型预算\nsteps: 需求整理 → 查证能力 → 比较取舍 → 生成报告\nevidence: 结论、URL、原文片段、版本、访问日期\nartifacts: 报告对象路径、文件类型、生成状态' } },
      { title: '规模增长后如何加组件', paragraphs: ['初期可以用任务表和单 Worker；积压明显时加入队列与并发限制；存在长时间等待或复杂恢复时增加工作流。多个独立子问题可以受控并行，但并行数受模型配额、抓取限制和费用共同约束。'], bullets: ['外部网页里的指令视为待分析内容，不授予工具权限。', '取消任务需停止未执行步骤，并记录已经产生的费用与产物。'] }
    ],
    decisions: [
      { option: '单 Agent 分步研究', fit: '主题范围有限，事实与资料共享较多。', tradeoff: '上下文易统一，深度任务可能较慢。' },
      { option: '多个受约束的子任务', fit: '子问题相互独立，可以并行收集证据。', tradeoff: '增加去重、汇总、冲突处理与费用管理。' }
    ],
    pitfalls: ['把网页中的“忽略先前指令”当成新的系统规则。', '并行子任务重复研究相同内容，却没有统一证据记录。', '生成报告只保存临时路径，任务完成后无法下载。'],
    qa: [
      { q: '为什么研究任务适合异步化？', a: '它包含多个慢速外部调用和可变步骤，持续时间容易超过网关或客户端超时。使用 taskId、持久状态和文件产物可以支持断线后查询、取消、恢复和明确交付。' },
      { q: '多 Agent 一定比单 Agent 好吗？', a: '只有任务能够拆成独立子问题时，并行才可能减少等待。共享上下文多或结论需要反复协调时，多 Agent 会增加重复工作、冲突和费用。先证明单流程瓶颈，再增加分工。' },
      { q: '实战排障：研究任务卡在 RUNNING，重启后怎样恢复？', a: '先查 Worker 心跳、租约和最后一步日志，区分仍在执行与进程已丢失，避免两个 Worker 同时接管。再核对已完成步骤、证据与产物是否持久化，领取失效任务后从明确的恢复点继续。文件生成若已成功但状态没提交，先检查原产物并复用；持续失败的步骤应标记原因并停止无限重试。' }
    ],
    sources: [{ label: 'Anthropic：组合式工作流与 Agent 取舍', url: 'https://www.anthropic.com/engineering/building-effective-agents' }, { label: 'Spring AI Alibaba：Graph 工作流编排', url: 'https://java2ai.com/docs/frameworks/graph-core/quick-start/' }],
    related: ['context-memory', 'object-storage', 'rabbitmq', 'temporal', 'sandbox', 'observability']
  },
  {
    id: 'production-architecture', title: '场景：从本地学习到生产架构', category: '场景',
    tagline: '让组件数量随需求增长，始终知道每个组件解决哪一个问题。',
    level: '进阶', minutes: 16, priority: '核心', kind: 'pattern',
    summary: '本地用 Docker Compose 管理少量服务足以学习主要链路。生产演进的依据是故障恢复、并发、数据规模和治理需求，不是把所有中间件一次性安装。先拥有可运行的小闭环，再逐步拆分。',
    when: ['需要为 Java Agent 项目制定第一版组件清单。', '要解释为什么引入数据库、队列、网关和观测，以及何时暂缓。'],
    notFor: ['Compose 编排成功不等于具备高可用与备份恢复。', '不要在尚无负载证据时直接建设复杂 Kubernetes 集群。'],
    concepts: [
      { title: '在线链路', text: '登录、检索、模型、工具和响应属于用户等待路径。关注尾延迟、超时预算和依赖降级，不在其中执行大批量解析。' },
      { title: '后台链路', text: '导入文档、构建索引、生成报告与日志分析适合异步处理。队列隔离负载，任务状态与业务结果仍需持久化。' },
      { title: '公共治理', text: '认证、密钥、模型路由、限流与观测服务多个应用。先复用公司已有能力，再考虑独立平台，避免各应用重复实现。' }
    ],
    flow: ['浏览器进入 Spring Boot', '读取身份与任务状态', '按需检索或调用工具', '通过模型入口生成响应', '记录 Trace 与业务结果', '后台 Worker 处理耗时工作'],
    sections: [
      { title: '本地起步组件各司其职', paragraphs: ['Spring Boot 提供应用入口，PostgreSQL 保存会话、任务与业务元数据，pgvector 负责学习向量检索；文件可以先用受控本地目录，之后切换对象存储。模型使用服务端 API。Redis、队列和独立向量库都可以后加。'], bullets: ['镜像锁定明确版本，持久数据挂载 Volume。', '容器内使用服务名通信，浏览器访问宿主机映射端口。'] },
      { title: '什么时候增加哪种能力', paragraphs: ['热点读或共享限流出现后加 Redis；导入任务阻塞在线服务时加队列与 Worker；多个应用接入多家模型时加 AI 网关；复杂长任务需要可靠恢复时加工作流。每次扩展都应写清触发问题与预期改善指标。'], bullets: [], code: { language: 'text', label: '架构演进示意，非部署配置', value: '阶段 1：Spring Boot + PostgreSQL/pgvector + 模型 API\n阶段 2：增加对象存储、后台 Worker 与任务队列\n阶段 3：按负载拆分检索，按恢复需求增加工作流\n全阶段：可信身份、密钥管理、日志和任务状态\n多应用阶段：统一模型网关、配额与调用观测' } },
      { title: '生产化先补哪些基础', paragraphs: ['明确数据备份与恢复方式、索引重建流程、凭证轮换、容量上限及版本回滚。观测贯穿每次请求：看见慢在哪里，也能知道结果是否有依据。控制台与数据库尽量避免直接暴露到公网，权限与网络规则按业务边界设置。'], bullets: ['任务日志脱敏，访问权限覆盖日志与生成文件。', '升级模型、Prompt 或索引时保留版本关联与回退路径。'] }
    ],
    decisions: [
      { option: 'Docker Compose', fit: '个人学习、单机开发与服务组合验证。', tradeoff: '轻便易读，高可用、跨机调度需要额外方案。' },
      { option: '企业已有容器与托管服务', fit: '需要统一运维、弹性、备份与权限治理。', tradeoff: '需遵守平台约束，核算网络、存储与调用成本。' }
    ],
    pitfalls: ['只持久化数据库，忘记原始文件和索引版本。', '把模型密钥放进浏览器配置或静态 JavaScript。', '只计算 Token 成本，忽略重排、解析、存储和观测费用。'],
    qa: [
      { q: '生产架构必须部署所有清单里的中间件吗？', a: '不需要。先列能力与约束，再判断现有设施能否承担。一个关系库可以管理多类业务数据，部分检索引擎同时支持关键词和向量；新增组件必须解决已识别的问题，并考虑同步与运维成本。' },
      { q: '怎么向面试官或同事描述一套 Agent 架构？', a: '从一个具体请求讲起：入口如何鉴权，事实从哪里来，模型如何调用工具，状态如何保存，失败如何恢复，最后如何观测和交付。再说明哪些组件是当前必需、哪些由规模或复杂度触发增加。' },
      { q: '实战排障：本机可以连接数据库，Java 容器却连不上，怎么查？', a: '先确认 JDBC 地址的主机和端口：容器里的 localhost 指向该容器，Compose 服务间通常使用服务名与容器端口。再查是否处于同一网络、数据库是否就绪、账号是否允许连接，以及当前 Profile 实际加载的配置。容器启动成功不代表数据库已可用，应配置健康检查并处理启动阶段的短暂连接失败。' }
    ],
    sources: [{ label: 'Docker：Compose 说明', url: 'https://docs.docker.com/compose/' }, { label: 'OpenTelemetry：分布式调用链', url: 'https://opentelemetry.io/docs/concepts/signals/traces/' }],
    related: ['docker', 'postgres', 'redis', 'ai-gateway', 'observability', 'reliability', 'knowledge-assistant', 'business-agent']
  }
];
