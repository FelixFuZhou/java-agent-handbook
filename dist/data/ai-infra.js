export const aiInfra = [
  {
    id: 'document-parsing', title: '文档解析 · MinerU / PaddleOCR', category: '检索',
    tagline: '先读对文档，再谈向量检索', level: '入门', minutes: 18, priority: '核心', kind: 'middleware',
    summary: '文档解析把人能阅读的 PDF、扫描图片和 Office 文件转成可切分、可索引、可引用的结构化内容。对 Java 研发来说，它更像一个异步数据加工服务：Java 管任务与业务状态，解析进程负责 OCR、版面和表格，结果写入对象存储和知识索引。解析错误会一路传递到检索和回答，换更大的模型通常不能修复丢失的原文。',
    when: ['企业制度、产品手册、技术文档需要进入知识库。', '扫描件、双栏 PDF、跨页表格直接抽取后顺序混乱。', '回答需要展示来源页码、原文片段或表格位置。'],
    notFor: ['已有结构化数据库记录时，优先直接同步字段，不必先转 PDF 再解析。', '只需读取干净的纯文本或 Markdown，可以直接进入清洗与切分。'],
    concepts: [
      { title: 'OCR 与结构解析', text: 'OCR 解决图片中的字符是什么；结构解析还要判断标题、段落、表格、图片和阅读顺序。扫描识别正确但左右两栏交错，仍然会产生不可用的知识片段。PaddleOCR 提供 OCR 与文档理解相关能力；MinerU 提供面向文档转换的工作流。具体能力应按所选版本和模型验证。' },
      { title: '结构保真与切分', text: '切分前保留标题层级、表头、页码和段落边界。表格中的“金额”必须和币种、时间、行列标题一起保存。章节标题可以作为每个子片段的上下文；重复页眉页脚则要清理。分块长度是参数，保持语义完整才是目的。' },
      { title: '可追溯的数据契约', text: '建议给每个内容块保存 documentId、version、page、blockId、text、sourceUri、tenantId 和解析器版本。检索命中的是块，但用户最终需要定位原文件。原文件与解析产物分开保存，才能重跑解析、排查问题和重建索引。' }
    ],
    flow: ['上传原文件并计算摘要', '创建解析任务并返回任务 ID', '提取正文、表格与位置', '清洗并按结构切分', '向量化与索引', '回答携带引用位置'],
    sections: [
      { title: '把解析接在 Java 系统的什么位置', paragraphs: ['上传接口先将文件写入对象存储，再向任务表和队列写入解析请求。Worker 下载文件后调用解析服务，成功时保存结构化结果，失败时记录可重试错误。不要让 Servlet 请求线程等待一份数百页文件全部处理完成。', '任务应以文件摘要、解析器版本和解析参数生成幂等标识。同一文件被重复上传时可以复用产物；升级解析器后也能有计划地重新加工。上线前挑选真实扫描件、表格和复杂排版逐页对照，观察丢字、顺序和表头是否正确。'], bullets: ['CPU、GPU、模型下载和格式支持取决于部署方式，先用样本文档测吞吐。', '失败任务单独隔离，避免一份损坏文件拖住整条知识更新流水线。'] },
      { title: '最小使用：把一份 PDF 转成 Markdown', paragraphs: ['前提：本机已安装 Python、uv，并按官方安装指南准备 MinerU 4.x 及所需模型；工作目录有 sample.pdf。以下是该版本官方 CLI 的最小调用，首次运行可能下载模型。它是解析服务的手动验证步骤，不是本站启动命令。', '运行后先读出 sample.md 与原文对照。Java 生产接入建议通过服务接口或独立 Worker 调度，不要在主业务进程中为每个 HTTP 请求安装依赖、下载模型或启动一次 Python 环境。'], bullets: ['实际部署固定包版本和模型版本；如果使用 3.x，命令与配置应查对应版本文档。'], code: { language: 'bash', label: 'MinerU 4.x CLI · 已有运行环境', value: 'mineru-kit parse sample.pdf -o sample.md --tier standard' } },
      { title: '怎样解释解析和 RAG 质量的关系', paragraphs: ['假设用户问“差旅报销上限是多少”，原表格包含城市级别、员工级别、金额和生效日期。如果解析只剩几个数字，Embedding 不知道数字对应谁，Reranker 也无法重建表头。合理做法是保留表格结构，必要时将每行展开成带完整表头的文本，并让引用跳回原始页。', '先定位问题发生在解析、切分、召回还是生成，再选择改动。扫描件 OCR 识别错了数字，应该修复解析和质量检查；正文完整却召回不到，才进一步检查分块、关键词检索和向量模型。'], bullets: ['解析完成不等于可用：空页率、异常短文本、表格缺列都是值得记录的信号。', '敏感文件是否允许发送云解析服务，必须沿用企业的数据访问和出域规则。'] }
    ],
    decisions: [
      { option: 'MinerU', fit: '复杂 PDF、需要结构化转换和文档结果定位', tradeoff: '需要管理模型与运行环境，按真实文档评估速度和结构质量' },
      { option: 'PaddleOCR', fit: '图片文字识别、扫描件和需要定制的 OCR 流水线', tradeoff: '具体组合的检测、识别、版面与表格能力需要配置和验证' },
      { option: '现有文本提取工具', fit: '格式简单、已有可用文本层的文件', tradeoff: '轻量但不能假定能正确处理扫描、双栏和复杂表格' }
    ],
    pitfalls: ['只保存拼接后的全文，丢掉页码与块位置，最后无法生成可信引用。', '把页眉、页脚和重复目录全部向量化，检索结果充满噪声。', '解析时没有保留租户与权限元数据，后续检索无法可靠执行访问过滤。'],
    qa: [
      { q: '有大模型了，为什么还需要专门的文档解析？', a: '因为稳定的知识服务需要可重用、可追踪的文本结构。视觉模型可以辅助理解页面，但每次问答都重新发送整份文件通常会增加延迟和成本，也不容易维护更新与权限。先解析成带位置的结构化内容，再检索相关块，是一种便于版本管理、定位错误和重复使用的工程方案。小文件的临时问答可以直接使用模型文件能力，应按场景选择。' },
      { q: 'PDF 已入库，回答却总把表格中的金额对应错人，怎么排查？', a: '先用回答引用的 documentId、page 和 blockId 找回解析产物，与原页对照表头、行列和阅读顺序。若解析已把员工级别与金额拆开，应修复结构提取或分块，把必要表头随每个片段保存，再重新生成向量。若解析完整，再检查召回和最终上下文是否缺了关联片段。Java 侧保留解析器版本和文件摘要，才能有范围地重跑受影响文档。' }
    ],
    sources: [{ label: 'MinerU 官方项目与 CLI', url: 'https://github.com/opendatalab/MinerU' }, { label: 'PaddleOCR 官方项目', url: 'https://github.com/PaddlePaddle/PaddleOCR' }],
    related: ['rag-pipeline', 'object-storage', 'embedding', 'knowledge-assistant']
  },
  {
    id: 'embedding', title: 'Embedding · BGE / Qwen', category: '检索',
    tagline: '把语言变成可比较的向量', level: '入门', minutes: 20, priority: '核心', kind: 'middleware',
    summary: 'Embedding 模型将文本映射为一组数字，使语义接近的内容可以通过向量距离被召回。它是模型服务，向量数据库则负责保存与检索这些结果。Java 开发者需要掌握调用、批处理、版本一致性和索引迁移；不需要先推导模型训练过程。数据库能接受一串数字，并不代表这串数字与现有数据处在同一个语义空间。',
    when: ['用户用口语提问，而知识文档采用正式术语。', '需要检索相似问题、历史案例、代码片段或跨语言内容。', '与关键词检索组合，改善同义表达的覆盖。'],
    notFor: ['订单号、合同编号等精确值应优先使用精确过滤或关键词检索。', '余额、库存等实时事实应查询业务系统，不能依赖向量近似匹配。'],
    concepts: [
      { title: '维度与模型版本', text: '维度是向量长度。官方模型卡中 BGE-M3 的稠密向量为 1024 维；Qwen3-Embedding-0.6B 最大 1024 维，支持 32 至 1024 的自定义输出维度。维度相同不代表模型兼容：不同权重版本或输入处理方式生成的向量不应直接混用。具体服务还可能不开放自定义维度参数。' },
      { title: '双编码与相似度', text: '文档可提前计算向量，问题在请求时计算，再用余弦相似度、内积或距离检索。归一化、距离度量和索引配置需要匹配。相似度表示模型空间中的接近程度，不是答案正确概率；不同模型之间的分数也不能直接比较。' },
      { title: '输入处理是模型契约', text: '查询指令、分词器、长度截断、归一化都会影响结果。Qwen 系列模型卡提供查询指令的使用方式，BGE-M3 的查询处理约定又不同。文档和查询应遵循同一模型的推荐流程，不能随意套用其他模型的前缀模板。' }
    ],
    flow: ['文本清洗与结构切分', '按模型约定处理输入', '批量生成文档向量', '保存向量和版本元数据', '问题向量化', '权限过滤与相似度召回'],
    sections: [
      { title: 'Java 服务应管理什么', paragraphs: ['为 Embedding 定义一个独立端口，输入文本列表，输出按相同顺序对应的向量和模型信息。数据库记录 modelId、revision、dimension、chunkVersion，防止切换配置后悄悄污染索引。批请求按 Token 总量和服务限制拆分，不仅按文本条数拆分。', '离线入库吞吐与在线查询延迟是两个不同目标。大批量文档导入不应占满在线服务容量，可以分队列、限并发或使用独立配额。缓存键至少包含文本摘要与模型版本；缓存结果不能跨版本复用。'], bullets: ['索引中的向量长度必须与建表或集合定义一致。', '同一片段更新时，同步更新原文、向量、版本与权限信息。'] },
      { title: '最小使用：调用兼容的向量服务', paragraphs: ['前提：已部署提供 /v1/embeddings 的兼容服务，端口为 8000，并把所需模型注册为 lesson-embedding；服务已按该模型要求完成查询预处理。该别名是教学占位，需要替换为实际部署名称。下面展示通用 HTTP 契约，不宣称 BGE 或 Qwen 模型文件本身带有 HTTP 接口。', '返回体通常含 data 数组及每条记录的 embedding。生产 Java 调用要设置超时、校验状态码、检查维度和输入输出数量；JSON 序列化可使用项目现有 Jackson，避免手工拼接用户文本。'], bullets: ['模型部署由推理引擎提供；如兼容接口不支持所需参数，应由适配层处理。'], code: { language: 'bash', label: 'HTTP 调用示例 · 需已有兼容服务', value: 'curl --fail-with-body http://localhost:8000/v1/embeddings \\\n  -H "Content-Type: application/json" \\\n  -d \'{"model":"lesson-embedding","input":["如何重置企业账号密码？"]}\'' } },
      { title: '更换模型为什么常常需要重建索引', paragraphs: ['向量坐标的含义由模型决定。即使新旧模型都是 1024 维，将新查询向量直接搜索旧文档向量也可能得到无意义排名。通常创建新索引，对全量文档重新计算；在相同业务样本上比较召回质量和耗时，验证后切换索引别名，并保留回退窗口。', '缩小支持可变维度模型的输出可以降低存储和计算成本，但维度选择仍要通过实际内容验证。某个中文公开榜单得分高，不能自动证明它更适合公司的术语、长文档、表格或代码。先比较正确证据是否进入候选，再考虑硬件与维护成本。'], bullets: ['索引迁移期间的新文档需要双写或补齐增量，避免切换后遗漏。', '知识库权限过滤应进入检索流程，不能只在最终答案中遮盖。'] }
    ],
    decisions: [
      { option: '托管 Embedding API', fit: '希望快速接入、暂不维护推理硬件', tradeoff: '需考虑调用成本、服务地域、限额与文档数据处理要求' },
      { option: '自部署 BGE / Qwen', fit: '私有环境、稳定的大批量入库或需要控制模型版本', tradeoff: '需要承担推理资源、模型分发、服务容量与升级迁移' }
    ],
    pitfalls: ['把 1024 维当成模型身份，允许来自不同模型的向量混在一个索引。', '入库端增加查询指令、查询端却未遵守模型约定，造成不一致输入。', '截断过长文档后不记录，正确证据实际从未进入向量化内容。'],
    qa: [
      { q: 'Embedding 模型和 Milvus 有什么区别？', a: 'Embedding 负责计算文本的向量表示，Milvus 负责向量和相关字段的存储与检索。可以将两者理解为“特征计算服务”和“特征索引服务”。部分平台将这两步封装在一起，但概念上仍要区分，才能独立定位模型效果、接口延迟、索引参数和数据更新的问题。' },
      { q: '模型升级后检索明显变差，接口和维度都正常，怎么排查？', a: '先确认查询和文档是否由相同权重版本生成，再检查查询指令、分词器、截断与归一化有没有变化。维度相同只保证数据形状能被接收，不保证语义空间兼容。拿固定问题和已知证据对比旧索引与新索引；若新查询正在搜旧文档向量，应恢复原版本或完成全量重算与增量补齐后再切换。最后再分析新模型本身的领域效果。' }
    ],
    sources: [{ label: 'BGE-M3 官方模型卡', url: 'https://huggingface.co/BAAI/bge-m3' }, { label: 'Qwen3-Embedding-0.6B 官方模型卡', url: 'https://huggingface.co/Qwen/Qwen3-Embedding-0.6B' }],
    related: ['rag-pipeline', 'pgvector', 'milvus', 'reranker', 'document-parsing']
  },
  {
    id: 'reranker', title: 'Reranker · 重排与 RRF', category: '检索',
    tagline: '先找得全，再排得准', level: '进阶', minutes: 18, priority: '核心', kind: 'middleware',
    summary: '检索通常分成召回与排序两段。Embedding 和关键词检索先找出候选，RRF 可以融合多路排名，Reranker 再联合阅读问题与候选内容，判断哪些证据最相关。重排需要模型计算，因此常用于几十条候选，而不是直接遍历整个知识库。应先弄清错误是“没召回”还是“排错了”，再决定是否引入。',
    when: ['正确证据已进入候选，但前几条经常被相似又无关的内容占据。', '关键词与向量混合召回后，需要挑出少量高质量上下文。', '问题包含多个条件、否定或细粒度语义，需要更细致的相关性判断。'],
    notFor: ['文档没入库、权限过滤错误或解析丢字时，重排无法恢复不存在的证据。', '唯一 ID 精确查询通常不需要再做模型重排。'],
    concepts: [
      { title: 'RRF：合并排名', text: 'Reciprocal Rank Fusion 根据候选在各路结果中的名次计算分数，常见形式是累加 1 / (k + rank)，名次从 1 开始。它不阅读原文，也不需要向量分数与 BM25 分数同量纲。k 控制不同名次之间的差距；RRF 是融合算法，不是语言模型。' },
      { title: '模型重排：联合判断', text: 'BGE Reranker 等模型对“问题、片段”配对评分，可以观察两个文本之间更细的关系。它通常比单独编码向量再计算距离更贵，所以先召回后重排。评分经过 sigmoid 变到 0 至 1，也不代表已校准的事实正确概率。' },
      { title: '候选预算与上下文预算', text: '候选数量决定重排成本和遗漏风险；最终上下文数量决定生成成本和噪声。两者不应相等。可以从多路各取几十条、去重融合、重排后取少量片段开始，再按业务质量和 P95 延迟调整，而不是照搬固定数字。' }
    ],
    flow: ['关键词召回 + 向量召回', '统一 chunkId 并去重', 'RRF 融合排名', '问题与候选交给重排模型', '选择满足预算的证据', '生成带引用的答案'],
    sections: [
      { title: '先判断是哪一层出了错', paragraphs: ['给一个失败问题记录各路候选、融合结果、重排结果和最终上下文。如果正确片段根本不在候选集合里，增加重排能力没有帮助，应检查知识更新、切分、过滤与召回。如果正确片段排名第 20、最终只取 5 条，重排才可能直接改善。', '对企业知识库，产品编号与错误码常适合关键词召回，口语和同义表达适合向量召回。两路合并后，要按稳定的 chunkId 去重；如果同一事实被拆成大量重叠片段，还应控制同一文档占据全部上下文的问题。'], bullets: ['RRF 可以单独使用，也可以作为模型重排之前的候选融合步骤。', '检索权限过滤应在发送候选给重排和生成模型之前完成。'] },
      { title: '最小使用：用 Java 看清 RRF 的计算', paragraphs: ['前提：JDK 21。下面是可在类方法内运行的核心片段；bm25 与 vector 是两路已经排序且每路无重复的 chunkId。示例不依赖模型 SDK，用来理解融合公式，不冒充 Reranker 调用。最终得到的候选仍可交给独立重排服务。'], bullets: ['模型重排服务的请求通常包含 query 与 documents，但具体路径和字段要以所部署服务为准。'], code: { language: 'java', label: 'Java 核心片段 · RRF 排名融合', value: 'var bm25 = java.util.List.of("c1", "c2", "c3");\nvar vector = java.util.List.of("c3", "c1", "c4");\nvar scores = new java.util.HashMap<String, Double>();\nint k = 60;\nfor (var ranking : java.util.List.of(bm25, vector)) {\n    for (int i = 0; i < ranking.size(); i++) {\n        scores.merge(ranking.get(i), 1.0 / (k + i + 1), Double::sum);\n    }\n}\nvar fused = scores.entrySet().stream()\n    .sorted(java.util.Map.Entry.<String, Double>comparingByValue().reversed())\n    .map(java.util.Map.Entry::getKey).toList();\nSystem.out.println(fused);' } },
      { title: '如何把重排服务接入 Java', paragraphs: ['将重排接口抽象为 rerank(question, candidates)，保留每个候选的原始 ID 和来源，收到分数后按 ID 关联，避免服务排序后原文与引用错位。输入长度、批大小、超时和候选上限应显式配置。示例模型可选择 BGE Reranker，部署方式决定 HTTP 契约。', '重排失败时可以回退到融合结果，但要记录降级与质量影响。不能把一次超时无限重试，把用户等待时间扩大到不可控。也不要将阈值从另一个模型直接复制过来：分数分布、领域和输入长度改变后，阈值的含义都会变化。'], bullets: ['保留重排前后排名，才能说明这个组件到底改善了哪些问题。', '没有足够相关证据时，选择说明未找到依据，而不是强制塞满 topK。'] }
    ],
    decisions: [
      { option: '只做 RRF', fit: '多路召回需要融合，延迟和资源预算较紧', tradeoff: '只利用排名信号，无法重新理解问题与文档的细节关系' },
      { option: 'RRF + 模型重排', fit: '候选较多、精度要求高、能承担额外推理延迟', tradeoff: '增加服务依赖和计算成本，需要验证真实收益' }
    ],
    pitfalls: ['直接相加余弦相似度和 BM25 分数，忽略两个分数的尺度差异。', '认为 Reranker 能找回未被召回的文档，结果只增加延迟。', '重排后根据数组下标拼引用，导致正文和来源 ID 错配。'],
    qa: [
      { q: 'RRF 和 Reranker 是不是同一种重排？', a: '都可能改变顺序，但机制不同。RRF 利用多个检索器给出的名次融合结果，不看原始文本；模型 Reranker 接收问题与候选，重新计算相关性。工程中可以先用 RRF 取融合候选，再用模型挑选最终上下文。描述架构时说清输入、计算方法和成本，比把两者统称为“重排”更准确。' },
      { q: '加了重排仍然答错，还比以前慢，应该怎么定位？', a: '沿链路查看正确证据是否进入初始候选、融合后是否保留、重排后排第几、最终上下文是否包含它。初始候选没有证据应改召回；重排丢掉证据要检查模型适配、输入截断和分数阈值；上下文已有正确证据则看生成与引用组织。延迟方面记录候选数、文本长度与推理排队，适当减小候选预算或在无收益场景跳过重排，并以真实样本验证变化。' }
    ],
    sources: [{ label: 'Elasticsearch RRF 官方说明', url: 'https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion' }, { label: 'BGE Reranker 官方模型卡', url: 'https://huggingface.co/BAAI/bge-reranker-v2-m3' }],
    related: ['embedding', 'elasticsearch', 'milvus', 'rag-pipeline', 'evaluation']
  },
  {
    id: 'ai-gateway', title: 'AI 网关 · Higress / LiteLLM', category: '治理',
    tagline: '把多模型接入变成可管理的服务入口', level: '进阶', minutes: 18, priority: '按需', kind: 'middleware',
    summary: 'AI 网关位于 Java 应用与模型供应商之间，集中处理认证、路由、限流、配额、协议适配和调用记录。它可以减少各业务系统重复管理模型密钥和厂商差异的工作。单个学习项目可先直连；当多个应用、多种模型或统一成本治理出现时，再引入独立网关更有价值。',
    when: ['多个 Java 应用共享模型，需要按应用、租户和模型控制配额。', '云模型与自部署模型并存，需要统一入口和故障切换策略。', '团队需要集中管理供应商密钥、调用审计和成本归属。'],
    notFor: ['网关不会替你完成企业工具的业务授权，也不负责保证答案正确。', '单应用单模型的学习起点不必增加网关和额外数据库依赖。'],
    concepts: [
      { title: '逻辑模型名与物理部署', text: '应用请求 knowledge-chat 这样的逻辑模型名，网关把它路由到实际供应商和部署。这样可以集中切换，但切换必须保持业务所需的能力契约，例如工具调用、结构化输出、上下文长度和流式响应，不能只检查接口是否返回 200。' },
      { title: '限流、预算与故障切换', text: 'RPM、并发数、Token 用量与金额预算分别控制不同资源。429、超时和 5xx 的处理也不应相同。回退模型可能具有不同效果和限制，应配置允许的替代关系、最大尝试次数与总超时。网关通常看不到完整业务操作，业务层仍要负责幂等。' },
      { title: 'AI 网关与 MCP 网关', text: 'AI 网关治理模型请求；MCP 网关治理工具与资源的协议入口。Higress 提供相关网关能力，LiteLLM 提供模型代理与路由等能力。两类入口可以在一个产品中出现，但模型调用权限与业务工具执行权限仍是独立边界。' }
    ],
    flow: ['Java 应用携带应用凭证', '网关认证与配额检查', '按逻辑模型选择后端', '调用模型并转发流式结果', '记录耗时与用量', '按策略处理可重试错误'],
    sections: [
      { title: 'Java 接入需要关注的契约', paragraphs: ['Java 客户端可以通过配置 base URL 接入兼容网关，但兼容协议并不等于所有能力一致。上线前确认工具调用参数、JSON 输出、Embedding、图像输入和 SSE 流式响应是否符合所用模型的实际支持范围。厂商特有参数最好在适配层集中处理。', '为每个调用方使用可撤销的应用凭证，供应商密钥留在受控服务端。日志应记录 requestId、模型别名、物理模型、耗时和 Token，而不是默认保存所有提示词与用户数据。企业已有网关和身份系统时，优先复用认证与审计链路。'], bullets: ['请求总超时需要包含排队、重试和模型生成时间。', '流式响应已向用户发送内容后，自动换模型重试可能产生重复或不连续输出。'] },
      { title: '最小使用：配置 LiteLLM 模型别名', paragraphs: ['前提：已安装固定版本的 LiteLLM Proxy；本机 8000 端口已有兼容 /v1 接口的推理服务，实际注册模型名为 your-deployed-model。把下面保存为独立的 gateway.yaml，设置 MODEL_SERVICE_KEY 和 GATEWAY_KEY 后运行 litellm --config gateway.yaml --port 4000。此文件是教学示例，不是本站部署配置。', '客户端请求网关时传模型名 knowledge-chat，使用网关凭证。这里的 openai/ 前缀用于声明后端协议兼容，不表示模型来自某一供应商。生产按版本文档配置应用密钥、预算和持久化存储。'], bullets: ['容器中的 localhost 指向容器自己；容器部署时应改成同一网络中的服务名。'], code: { language: 'yaml', label: 'LiteLLM 配置 · 替换模型和环境变量', value: 'model_list:\n  - model_name: knowledge-chat\n    litellm_params:\n      model: openai/your-deployed-model\n      api_base: http://localhost:8000/v1\n      api_key: os.environ/MODEL_SERVICE_KEY\ngeneral_settings:\n  master_key: os.environ/GATEWAY_KEY' } },
      { title: 'Higress 与 LiteLLM 怎么选', paragraphs: ['如果团队已经运行 Kubernetes、Ingress 和统一流量治理，希望将模型与工具入口纳入同一运维体系，可以考察 Higress。若主要目标是快速连接多个模型提供方、使用模型别名并管理调用，可以先考察 LiteLLM Proxy。二者都有较广功能范围，选型要以实际版本、部署方式和团队运维能力为准。', '不要把网关变成单点：生产需要健康检查、配置发布与回滚、容量监控和凭证轮换。故障演练应覆盖上游限流、错误密钥和部分流式断开。对于会触发业务写操作的 Agent，模型重试与工具重试必须分开设计，避免重新生成一次就重复下单。'], bullets: ['先明确需要治理的是模型流量、MCP 工具流量还是所有 API。', '自动降级的模型也要进入同一套业务质量验证。'] }
    ],
    decisions: [
      { option: '应用直接调用', fit: '单个项目、少量模型、先验证业务价值', tradeoff: '接入简单，但模型配置与治理逻辑容易散落在应用中' },
      { option: 'Higress', fit: '已有网关体系，关注模型和工具入口的统一流量治理', tradeoff: '需要评估插件配置、部署和升级的运维复杂度' },
      { option: 'LiteLLM Proxy', fit: '多模型兼容接入、路由与调用管理', tradeoff: '需确认所用供应商能力映射及版本对应的治理依赖' }
    ],
    pitfalls: ['把 fallback 配置成任何模型都可互换，忽略工具调用与结构化输出能力差异。', '应用、网关、SDK 各自重试三次，放大为大量请求和超时。', '把主密钥直接放到浏览器或提交进 Git，让所有客户端拥有过大权限。'],
    qa: [
      { q: 'Spring AI 已经能切换模型，为什么还要网关？', a: '框架解决应用内部如何调用模型；网关解决多个应用如何共享和治理模型服务。当团队需要集中配额、凭证、路由与审计时，网关能把跨应用能力抽出来。两者可以一起使用。若只有单应用，框架配置已经满足需求，就没有必要为了架构完整而额外部署网关。' },
      { q: '直连模型正常，接入网关后经常超时或重复输出，怎么排查？', a: '先对照应用、网关和上游的 requestId 与耗时，确认时间消耗在排队、模型处理还是代理转发。检查 SDK、网关和业务层是否叠加重试，SSE 是否被缓冲，以及首字超时和总超时是否配置混淆。已经向客户端输出内容的请求，不应随意从头自动重放。再检查路由是否实际切到性能或能力不同的后端，并把降级模型纳入验证。' }
    ],
    sources: [{ label: 'Higress 官方概览', url: 'https://higress.cn/en/docs/latest/overview/what-is-higress/' }, { label: 'LiteLLM Proxy 配置文档', url: 'https://docs.litellm.ai/docs/proxy/configs' }],
    related: ['java-integration', 'tool-calling', 'reliability', 'observability', 'production-architecture']
  },
  {
    id: 'observability', title: '可观测性 · Langfuse / OpenTelemetry', category: '治理',
    tagline: '沿着一次任务，找到慢在哪里、错在哪里', level: '进阶', minutes: 20, priority: '核心', kind: 'middleware',
    summary: '普通服务监控告诉你接口是否可用，Agent 观测还需要解释它检索了什么、调用了什么工具、用了哪个 Prompt 和模型，以及为什么产生这个答案。OpenTelemetry 提供跨服务链路标准，Langfuse 提供面向 LLM 调用的观测与管理视角。Java 可以使用 OpenTelemetry 接入，不需要假定存在某个未核验的 Langfuse Java SDK。',
    when: ['回答偶尔错误，但仅靠最后一条模型输出无法定位原因。', '需要拆分检索、重排、生成和工具调用的延迟。', '需要比较 Prompt 或模型版本，核算任务成本与失败类型。'],
    notFor: ['链路记录不能替代业务效果评测，接口 200 也可能答案错误。', '不要把所有原始文档、凭证和用户敏感内容默认写入观测平台。'],
    concepts: [
      { title: 'Trace 与 Span', text: '一次用户任务可作为 Trace，检索、模型生成和工具执行分别是 Span。Span 之间有父子关系和开始结束时间，因此可以看到关键路径。多轮任务还可以关联 sessionId、taskId，但会话、任务和单次调用不是同一个概念。' },
      { title: 'OpenTelemetry 与 Langfuse', text: 'OpenTelemetry 负责采集、上下文传播与导出；Langfuse 接收并展示适合 LLM 的观察数据。官方提供 OTLP HTTP 接入，Java 可通过 OTel SDK、自动探针或 Collector 发送数据。普通 HTTP span 不会自动包含 Prompt 版本、检索块 ID 和工具业务结果，这些要补充埋点。' },
      { title: '技术成功与业务成功', text: 'HTTP 200 只表示请求完成。空召回、证据不足、工具参数被拒绝、模型答非所问，需要单独标记业务结果。延迟、错误率、Token、成本和任务完成率应一起观察；统计成本时要说明来源、币种和价格版本。' }
    ],
    flow: ['请求生成或接续 trace context', '检索与模型创建子 Span', '工具调用传播上下文', '记录版本、用量与结果状态', '经 OTLP 导出到平台', '按 Trace 复盘并形成改进样本'],
    sections: [
      { title: '从 Java 已有监控体系接入', paragraphs: ['已有 OpenTelemetry 或 Micrometer 体系时，先确认框架当前提供哪些观测能力，再补充 Agent 语义。给 retrieval、rerank、generation 和 tool 等步骤命名，记录候选数量、模型 ID、Prompt 版本、工具名称和错误分类。与业务日志用 traceId 关联，避免每一层重新生成不同的请求号。', '通过 Langfuse 的 OTLP HTTP 端点接入时，需要配置对应服务地址、项目凭证和属性映射；直接导出与通过 Collector 转发都可行。具体端点及导入版本以所部署版本文档为准。Collector 适合集中批量发送、脱敏、路由与采样，应用不要因观测系统故障阻塞核心请求。'], bullets: ['异步线程、消息队列与虚拟线程边界要正确传播上下文，避免出现孤立 Span。', '服务停机时应正常 flush；开发时先确认根 Span 和子 Span 都能收到。'] },
      { title: '最小使用：Java 手动记录一个业务步骤', paragraphs: ['前提：项目使用 JDK 21，并通过 OpenTelemetry BOM 管理相容版本，已引入 opentelemetry-api；Tracer 由已配置的 SDK、自动探针或框架提供，且 OTLP 导出链路已经建立。下面是可嵌入业务类的代码片段，不是完整独立应用。这里只依赖标准 OTel API，没有构造虚构的 Langfuse 客户端。', '在初始化阶段配置 HTTP/protobuf 导出或将 Span 发给本地 Collector，再由 Collector 接入 Langfuse。只引入 API 而不配置实际 SDK/exporter，通常不会产生可查看的遥测。模型 Token 和输入输出字段还需按实际集成映射。'], bullets: [], code: { language: 'java', label: 'Java · 标准 OpenTelemetry 埋点片段', value: 'import io.opentelemetry.api.trace.Tracer;\nimport io.opentelemetry.api.trace.Span;\nimport io.opentelemetry.api.trace.StatusCode;\nimport io.opentelemetry.context.Scope;\n\n// tracer 由应用配置注入；action 是已有检索或工具逻辑。\nvoid observe(Tracer tracer, Runnable action) {\n    Span span = tracer.spanBuilder("knowledge.retrieve").startSpan();\n    try (Scope scope = span.makeCurrent()) {\n        span.setAttribute("app.prompt.version", "knowledge-v3");\n        action.run();\n    } catch (RuntimeException ex) {\n        span.recordException(ex);\n        span.setStatus(StatusCode.ERROR);\n        throw ex;\n    } finally {\n        span.end();\n    }\n}' } },
      { title: '用一次失败回答完成排查', paragraphs: ['假设回答用了过期政策。先查看命中的 chunkId 和文档版本，确认是否索引未更新；再看重排是否把新政策排到了后面；最后检查 Prompt 是否要求按生效时间选择证据。只有最终输出日志时，这三个原因看起来都像“模型不够聪明”。', '记录内容要经过分级。默认优先保存版本、ID、长度和统计值；需要正文定位时采用脱敏、受控采样和保留期限。租户 ID 等字段可以用于筛选，但高基数 ID 不适合直接成为 Prometheus 指标标签。观测系统本身也需要访问控制。'], bullets: ['P95 比平均延迟更能暴露慢任务，但仍需区分不同任务类型。', '错误 Trace 与普通样本可采用不同采样策略，并保留完整父子关系。'] }
    ],
    decisions: [
      { option: '现有 APM + 自定义 Agent 埋点', fit: '团队已有统一观测，先补齐检索和模型步骤', tradeoff: 'Prompt、评测与 LLM 专用视图可能需要自行建设' },
      { option: 'Langfuse + OpenTelemetry', fit: '希望集中查看 LLM 调用、版本与效果关联', tradeoff: '需配置导出、属性映射、访问权限及存储保留策略' }
    ],
    pitfalls: ['只记录总请求耗时，无法区分向量检索慢、模型排队还是工具超时。', '错误后没有 end Span 或异步上下文丢失，使链路结构不完整。', '把 API Key、全量提示词和客户文件直接打到可被多人访问的日志中。'],
    qa: [
      { q: '已有 SkyWalking 或 Grafana，还需要 Langfuse 吗？', a: '先看缺少什么。现有 APM 很适合服务健康、HTTP、数据库和分布式调用；Agent 还需要 Prompt 版本、模型用量、检索证据和工具执行细节。如果现有平台能承载这些信息，可以继续扩展；如果希望使用专门的 LLM 视图与版本关联，再引入 Langfuse。两者可以通过统一 traceId 协同。' },
      { q: 'Java 已经写了 Span，Langfuse 里却没有链路，怎么排查？', a: '首先确认没有只引入 API 而使用无操作实现，再用本地调试导出确认 Span 结束且被采样。随后检查 OTLP 使用 HTTP 而非未支持的 gRPC、端点和项目凭证是否正确、Collector 是否转发以及导出是否报错。应用退出前应 flush，根 Span 也要发送。链路存在但缺少模型或 Token 信息时，继续检查属性映射；无需为此寻找未经核验的专用 Java SDK。' }
    ],
    sources: [{ label: 'Langfuse OpenTelemetry 接入', url: 'https://langfuse.com/docs/opentelemetry/get-started' }, { label: 'OpenTelemetry Java 插桩', url: 'https://opentelemetry.io/docs/languages/java/instrumentation/' }],
    related: ['evaluation', 'reliability', 'ai-gateway', 'production-architecture', 'clickhouse']
  },
  {
    id: 'sandbox', title: '执行沙箱 · OpenSandbox', category: '执行',
    tagline: '让 Agent 能运行代码，也能收住执行边界', level: '进阶', minutes: 18, priority: '按需', kind: 'middleware',
    summary: '当 Agent 需要运行生成的 Python、Shell、浏览器或文件转换程序时，执行环境就成为独立的基础设施。OpenSandbox 提供沙箱生命周期、命令和文件等能力，可从本地 Docker 环境起步。Java 服务应请求创建受控环境、提交任务、读取结果并释放资源，而不是将模型生成的命令直接交给业务宿主机执行。',
    when: ['数据分析 Agent 需要生成并运行代码，输出图表和文件。', '代码 Agent 或浏览器 Agent 需要独立的工作目录与运行环境。', '多用户任务需要隔离资源、网络访问和执行时长。'],
    notFor: ['只调用经过设计的业务 API 时，通常直接使用受控工具服务即可。', '沙箱不等于绝对安全，需要与身份、资源限制、网络和凭证策略共同使用。'],
    concepts: [
      { title: '控制面与执行面', text: 'Java 业务服务属于控制面：验证用户、创建任务、指定允许的镜像和资源。模型生成代码在执行面运行，不能直接接触控制面凭证。沙箱 API 也需要访问控制，不能因为执行环境可销毁，就把管理接口暴露给所有用户。' },
      { title: '隔离的多个维度', text: '文件系统隔离防止访问宿主目录；网络策略限制访问内网和外部地址；CPU、内存、进程数、磁盘与超时限制控制资源消耗。容器共享宿主内核，具体隔离强度取决于运行时与配置，高风险多租户场景可能需要更强隔离机制。' },
      { title: '生命周期与产物', text: '创建、运行、收集 stdout/stderr、保存产物、销毁构成完整生命周期。临时环境可以消失，但任务状态和用户需要的文件要先存到持久化系统。设置 TTL 和兜底回收，避免异常分支泄漏环境；超时也需要终止实际工作负载。' }
    ],
    flow: ['验证任务与允许的执行能力', '创建隔离环境并配置资源', '写入必要输入文件', '执行并收集日志', '保存结果到对象存储', '销毁环境并更新任务状态'],
    sections: [
      { title: '在 Java Agent 中怎样划定职责', paragraphs: ['Java 侧可以把“运行分析脚本”封装为一个受控工具，接受结构化输入、超时和产物目录，而不是给模型一个无限制宿主机终端。每个任务绑定用户和 taskId；执行命令、退出码、耗时和产物引用写入任务记录，便于重试与审计。', 'OpenSandbox 官方提供 Java/Kotlin SDK 与其他语言 SDK，但具体依赖版本和调用方法需要匹配服务端。架构上应在 Java 中设置独立适配层，避免所有业务代码依赖沙箱厂商的对象模型。模型可以建议代码，工具执行器负责验证权限和预算。'], bullets: ['不要挂载 Docker socket、宿主用户目录或生产凭证到不受信任的执行环境。', '业务写操作仍要通过授权工具服务，不能把全部数据库访问权限塞进沙箱。'] },
      { title: '最小使用：通过官方 CLI 执行一个表达式', paragraphs: ['前提：Docker 可用，OpenSandbox 服务端已按官方指南配置并在 localhost:8080 运行；已安装 opensandbox-cli，且 osb 的连接、协议与 API Key 配置完成。下面先创建环境，再把返回的实际 ID 填入第二条命令。命令示例采用官方 CLI 形式，Python 镜像用于学习，生产需要固定版本或摘要。', '执行后查看输出应为 2。创建时设置 5 分钟超时用于学习环境的兜底回收；实际应用仍应在 finally 等清理路径主动释放环境。仅执行这两条命令并不代表已配置完善的生产网络和资源策略。'], bullets: ['首次运行可能需要拉取镜像；国内网络环境应选择团队认可的镜像仓库。'], code: { language: 'bash', label: 'OpenSandbox CLI · 已有服务端与认证配置', value: 'osb sandbox create --image python:3.12 --timeout 5m -o json\n# 将下面的 sandbox-id 替换为上一步返回的真实 ID\nosb command run sandbox-id -o raw -- python -c "print(1 + 1)"' } },
      { title: '从能执行到可生产运行', paragraphs: ['限制工具可使用的镜像、工作目录和联网目标。对需要下载依赖的任务，可提供预构建镜像或受控代理，减少每次执行的启动时间与供应链变化。对长任务，将进度写入持久化存储；连接断开时要能查到真实任务状态，不能简单认为客户端超时意味着执行已停止。', '代码执行通常存在副作用。重试前判断上次是否已经产生输出文件或调用外部服务，并使用任务 ID 做幂等。记录退出码与截断后的日志，给产物设置大小限制和清理策略；外部输入和输出都应作为数据处理，不能让返回日志变成新的高权限指令。'], bullets: ['沙箱复用可以降低启动成本，但必须评估跨任务残留状态与数据泄漏。', '按任务风险选择容器、更强隔离运行时或虚拟机，并验证实际部署边界。'] }
    ],
    decisions: [
      { option: '受控业务工具 API', fit: '查询订单、生成固定报表等已知能力', tradeoff: '自由度较小，但权限和输入输出更容易约束' },
      { option: 'OpenSandbox 执行环境', fit: '动态代码、文件处理、浏览器和较开放的执行任务', tradeoff: '增加运行时、资源、网络、回收和产物管理责任' }
    ],
    pitfalls: ['直接在 Spring Boot 宿主机运行模型生成的 ProcessBuilder 命令。', '把容器隔离等同于绝对安全，仍挂载高权限目录和管理 socket。', '客户端超时后不终止任务，后台持续消耗资源并产生重复副作用。'],
    qa: [
      { q: '为什么 Docker 容器还不等于完整沙箱方案？', a: '容器提供一部分隔离机制，完整方案还要管理身份、允许的镜像、资源上限、出网策略、凭证、超时与回收。默认容器配置、特权模式或危险挂载可能破坏预期边界。OpenSandbox 等平台帮助组织执行生命周期，但最终安全属性仍由运行时与部署配置决定。' },
      { q: 'Java 请求超时后再次执行，为什么生成了两份结果？', a: '客户端超时只说明没有及时收到响应，不证明执行面已经停止。先按 taskId 查询沙箱中的命令状态与产物，再决定继续等待、取消还是重试。业务端持久化任务与执行 ID，输出使用幂等命名或版本标识；取消时要终止实际工作负载并更新状态。即使脚本只生成文件，也应避免重试把同名文件覆盖成半成品，外部业务写入更需要独立幂等控制。' }
    ],
    sources: [{ label: 'OpenSandbox 官方项目、SDK 与 CLI', url: 'https://github.com/opensandbox-group/OpenSandbox' }, { label: 'Docker Engine 安全说明', url: 'https://docs.docker.com/engine/security/' }],
    related: ['tool-calling', 'docker', 'object-storage', 'research-agent', 'reliability']
  },
  {
    id: 'evaluation', title: '效果评测 · 工程质量保障', category: '工程',
    tagline: '知道一次改动到底让 Agent 变好还是变差', level: '进阶', minutes: 18, priority: '核心', kind: 'middleware',
    summary: '这一页讲开发者如何保障 Agent 产品质量，不是给学习者设置考试。Agent 输出具有变化性，单次演示成功不足以说明可以稳定交付。评测把真实业务问题、期望行为和可观察结果固定下来，用来比较 Prompt、模型、检索策略与工具配置的改动。本站只提供说明与示例，不要求你答题、打分或闯关。',
    when: ['更换模型、Embedding、Prompt 或检索参数，需要判断效果是否退化。', 'Agent 从只读问答扩展到工具调用，必须检查参数和业务结果。', '线上出现失败案例，需要把问题变成下一次发布可重复检查的样本。'],
    notFor: ['少量人工挑选的成功演示不能替代业务样本覆盖。', '一个模型裁判的分数不能自动成为唯一上线依据。'],
    concepts: [
      { title: '分层评价', text: '检索层看正确证据是否被召回、排在什么位置；回答层看是否基于证据、是否回答问题；执行层看工具选择、参数、权限与最终业务状态。把不同层混成一个总分，会掩盖问题位置。延迟和成本也属于交付约束。' },
      { title: '确定性检查与模型裁判', text: 'JSON 结构、必填字段、工具名称、允许参数与数据库状态适合程序检查。语义相关性、依据充分性可以结合人工审阅或模型裁判。模型裁判也有偏差和波动，需要明确标准并用人工样本校准，不是“再问一次大模型是否正确”就足够。' },
      { title: '回归样本与版本', text: '样本保存问题、可用知识版本、期望证据或行为、禁止动作和场景标签。一次评测还要记录模型、Prompt、切分和索引版本，才能比较。评测数据与开发调参样本应尽量分开，避免只针对已知题目优化。' }
    ],
    flow: ['收集真实任务与失败案例', '定义期望行为和证据', '固定环境与配置版本', '批量运行并记录完整链路', '分层分析质量、延迟和成本', '修复后比较回归结果'],
    sections: [
      { title: 'Java 团队怎样开始', paragraphs: ['先从几十条覆盖真实业务边界的样本开始：常见问题、没有答案的问题、权限不足、过期文档、多义词、工具超时和重复请求。样本应来自业务理解与历史案例，避免只用模型批量生成看起来整齐的问题。每条写清什么行为算正确、哪些动作绝对不应发生。', 'Java 应用可以暴露专用测试环境的 Agent 接口，由脚本或评测平台发起请求并读取结构化结果。涉及写操作时使用隔离业务环境或可控工具替身；最终还要验证真实业务状态，而不是只检查模型说了“操作成功”。'], bullets: ['Promptfoo 可用于组织提示词、提供方与断言；Ragas 提供 RAG 等场景的评测能力。', '工具可以用非 Java 语言运行，不影响被测 Agent 由 Java 实现。'] },
      { title: '最小使用：设计一条可检查的场景记录', paragraphs: ['前提：已有自己的评测运行器或准备实现一个读取 JSON 的脚本。下面是本站自定义的场景数据示意，不是 Promptfoo 或 Ragas 的官方配置格式。它用清晰字段说明业务期望；运行器负责映射到实际 HTTP 请求并检查响应和工具事件。', '同一条样本至少检查回答应说明权限不足、没有发起写操作、没有泄漏合同金额。若只用字符串包含“权限”作为通过条件，仍可能漏掉前面已经泄漏内容的回答，所以需要组合规则与人工检查。'], bullets: ['评测配置里的期望行为是开发说明，页面不向学习者展示考试入口。'], code: { language: 'json', label: '自定义场景契约示意 · 需配套运行器', value: '{\n  "caseId": "contract-access-denied",\n  "input": "查询其他部门合同的金额",\n  "actor": { "department": "engineering" },\n  "expected": {\n    "resultType": "access_denied",\n    "forbiddenToolNames": ["contract.update"],\n    "mustNotExposeFields": ["contract.amount"]\n  },\n  "tags": ["permission", "business-agent"]\n}' } },
      { title: '如何读懂评测结果', paragraphs: ['不要只报告平均分。把样本按任务类型、文档类型和失败原因分组，观察新版本是否牺牲了某一类能力。对高风险工具，错误执行一次的影响可能大于几十条普通问答的轻微措辞改善。对需要快速反馈的问答，同时比较首字延迟、总延迟和模型用量。', '随机性明显的任务可以重复运行，报告波动和失败比例。模型裁判应与被测输出隔离，不能照单全收输出中的“请给满分”等指令。生产还需要持续采集经过脱敏的失败案例，把离线结果与实际反馈连接起来；离线评测通过不代表永远不会出错。'], bullets: ['比较版本时尽量固定知识快照、工具行为和运行参数。', '保留逐条差异和 Trace 链接，便于解释分数为何变化。'] }
    ],
    decisions: [
      { option: '自建业务样本 + 程序检查', fit: '工具调用、结构化输出、权限和状态变更', tradeoff: '语义质量还需要人工或模型辅助判断' },
      { option: 'Promptfoo / Ragas', fit: '需要批量比较配置、管理评价规则与质量指标', tradeoff: '指标要匹配业务，不能把框架默认分数直接等同于上线标准' }
    ],
    pitfalls: ['只对回答文本评分，遗漏工具已经执行了错误操作。', '用同一批样本反复调 Prompt，再把该样本成绩当成泛化效果。', '知识、模型和 Prompt 同时变化，却将结果改善全部归因于其中一个组件。'],
    qa: [
      { q: '用户说不需要考试，为什么还有评测这一章？', a: '这里的评测对象是你开发的 Agent 软件，不是学习者。网站没有测验、考试或成绩要求。Java 工程师仍需要理解如何判断程序的改动是否可靠，正如学习数据库时会了解慢查询与一致性验证一样。本章让你能说明工程团队如何做质量保障。' },
      { q: '换模型后平均分升了，业务投诉却增加，如何定位？', a: '按真实任务类型查看逐条差异，确认是否普通问答提升掩盖了少数高风险工具场景退化。检查样本是否覆盖线上分布、知识版本是否一致、裁判是否偏好更长回答，以及评测有没有验证工具实际执行状态。把投诉中的失败案例脱敏后纳入回归集，比较质量、延迟和成本，不要只调一个平均分。若问题发生在业务写操作，先控制受影响能力范围再继续验证。' }
    ],
    sources: [{ label: 'Promptfoo 官方入门', url: 'https://www.promptfoo.dev/docs/getting-started/' }, { label: 'Ragas 官方文档', url: 'https://docs.ragas.io/en/stable/' }],
    related: ['observability', 'rag-pipeline', 'reliability', 'tool-calling', 'production-architecture']
  },
  {
    id: 'docker', title: '容器与编排 · Docker / Kubernetes', category: '工程',
    tagline: '先在本机跑清楚依赖，再决定如何扩展', level: '入门', minutes: 18, priority: '核心', kind: 'middleware',
    summary: 'Docker 负责把服务和运行环境包装成可运行的镜像，Compose 适合在一台机器上描述一组依赖。对于 Java Agent 学习，先用 Compose 启动数据库、缓存等需要的中间件，能够更快理解真实连接与生命周期。Kubernetes 适合进一步解决多机器部署、调度和服务管理，不是学习 Agent 的前置条件。',
    when: ['需要可重复启动 PostgreSQL、Redis、网关或观测服务。', '希望学习环境与应用运行环境相对独立，减少本机依赖冲突。', '多个服务需要明确网络、健康检查、持久化和配置。'],
    notFor: ['单个静态学习网站不需要为了形式完整部署 Kubernetes。', '容器启动成功不代表数据库已就绪，也不代表数据已被备份。'],
    concepts: [
      { title: '镜像、容器与卷', text: '镜像是程序与环境的模板，容器是运行实例，卷保存容器之外的持久化数据。重建容器不应让知识库和任务记录消失。镜像版本或摘要用于复现环境，数据库卷则还需要独立备份与恢复流程，卷不是备份。' },
      { title: '网络与服务名', text: 'Compose 网络中的容器通过服务名互访，例如 Java 容器连接 db:5432；本机 IDE 中的 Java 进程通过映射端口连接 localhost。容器内的 localhost 是该容器自身。理解这个差别，能解决大量“数据库已启动但连接不上”的问题。' },
      { title: '健康与就绪', text: '进程存在、端口打开、应用可接受业务请求是不同状态。健康检查用于发现异常，启动依赖可等待服务就绪，但 Java 客户端仍应处理连接失败和短暂重启。数据库迁移、模型加载与首次索引构建常需要更长启动时间。' }
    ],
    flow: ['选择当前阶段所需中间件', '固定镜像与配置', '声明网络与持久化卷', '启动并等待健康状态', 'Java 连接服务并检查日志', '备份、升级与恢复'],
    sections: [
      { title: '学习阶段的最小部署原则', paragraphs: ['先搭一个真正用得到的组合，例如 Java 服务加 PostgreSQL；需要缓存时再加 Redis，需要向量检索时再选择 pgvector 或 Milvus。一次启动所有候选中间件只会增加内存压力和排查难度，不会让你更快理解它们。', '生产和学习配置要区分。示例密码只用于本机，端口尽量绑定回环地址。真实部署用受控配置与凭证系统，限制网络入口，固定版本并记录升级步骤。数据库、观测系统和推理服务的内存消耗差别很大，应先看实际监控再扩容。'], bullets: ['仅把需要从宿主机访问的端口发布出来。', '每次增加组件都说清它解决的问题、持久化位置和故障影响。'] },
      { title: '最小使用：启动一个教学数据库', paragraphs: ['前提：本机已安装并启动 Docker Engine 或 Docker Desktop，提供 docker compose 命令。把下面保存为独立目录中的 lesson-db.compose.yaml，执行 docker compose -f lesson-db.compose.yaml up -d，然后用 docker compose -f lesson-db.compose.yaml ps 查看健康状态。这是中间件教学文件，与本站启动文件无关。', '本机 Java JDBC 地址为 jdbc:postgresql://localhost:15432/agent_demo，用户名为 learner，密码为 local-demo-only。如果 Java 也位于同一 Compose 网络，地址应改成 db:5432。这里用 PostgreSQL 17 系列镜像演示；正式环境应评估并固定具体版本或摘要。'], bullets: ['停止环境可用 docker compose -f lesson-db.compose.yaml down；追加 -v 会删除声明的数据卷，可能丢失数据。'], code: { language: 'yaml', label: 'lesson-db.compose.yaml · 仅本机教学', value: 'services:\n  db:\n    image: postgres:17\n    environment:\n      POSTGRES_DB: agent_demo\n      POSTGRES_USER: learner\n      POSTGRES_PASSWORD: local-demo-only\n    ports:\n      - "127.0.0.1:15432:5432"\n    volumes:\n      - lesson_db:/var/lib/postgresql/data\n    healthcheck:\n      test: ["CMD-SHELL", "pg_isready -U learner -d agent_demo"]\n      interval: 5s\n      timeout: 3s\n      retries: 10\nvolumes:\n  lesson_db:' } },
      { title: '什么时候考虑 Kubernetes', paragraphs: ['当服务要跨多台机器运行、需要滚动发布、资源调度、伸缩和统一服务管理时，Kubernetes 才开始体现价值。团队已经有成熟集群和平台支持，也可以直接复用。对个人学习或少量稳定服务，Compose 往往能以更少概念覆盖主要需求。', 'Kubernetes 不会自动解决所有状态问题。数据库仍需要备份、恢复、一致性和升级方案；Agent 长任务需要外部持久化状态，Pod 被重建后才能继续。模型服务还涉及显存、模型加载和冷启动；仅根据 HTTP 请求数扩容，可能无法反映真实 Token 和队列负载。'], bullets: ['先掌握服务网络、持久化、资源限制和健康检查，再学习集群对象。', '把应用配置与业务状态移出容器临时文件系统，才能支持重建和多副本。'] }
    ],
    decisions: [
      { option: 'Docker Compose', fit: '本地学习、演示、单机服务组合', tradeoff: '简单直观，但不提供完整的跨主机调度与高可用能力' },
      { option: 'Kubernetes', fit: '多机器、多团队、持续发布与资源调度需求', tradeoff: '引入网络、存储、权限和平台运维的学习成本' },
      { option: '托管中间件 + 本地 Java', fit: '希望把精力集中在 Agent 业务逻辑', tradeoff: '需要网络连接、调用费用和云资源配置' }
    ],
    pitfalls: ['在 Java 容器中连接 localhost:5432，却以为它指向另一个数据库容器。', '把数据库数据写入容器临时层，重建之后才发现记录丢失。', '使用浮动镜像随时升级生产环境，没有验证兼容性和恢复路径。'],
    qa: [
      { q: '学习 Agent 是否需要先学 Kubernetes？', a: '不需要。先理解 Java 调用模型、工具、数据库和检索服务，再用 Docker Compose 跑清楚依赖，就能完成许多真实项目的学习。出现多主机调度、伸缩或团队平台接入需求后再补 Kubernetes。关键能力是知道服务如何连接、状态放在哪里、失败后怎样恢复，而不是先背所有资源对象。' },
      { q: '都用了 Docker，为什么换机器还是跑不起来？', a: '镜像只解决部分环境一致性。CPU 架构、显卡驱动、宿主资源、网络、端口、外部密钥和数据卷仍会影响运行。应检查镜像是否支持目标架构、配置是否完整、依赖是否健康，以及数据是否迁移。对 GPU 推理和复杂 OCR，运行时要求尤其要按官方部署说明验证。' }
    ],
    sources: [{ label: 'Docker Compose 官方入门', url: 'https://docs.docker.com/compose/gettingstarted/' }, { label: 'Kubernetes 官方概览', url: 'https://kubernetes.io/docs/concepts/overview/' }],
    related: ['postgres', 'redis', 'sandbox', 'observability', 'production-architecture']
  }
];
