import { file, java, pom, dep, envFile, run } from './demo-kit.js';

const jackson = dep('com.fasterxml.jackson.core', 'jackson-databind', '2.18.2');
const path = name => `src/main/java/demo/${name}.java`;
const main = (name, imports, body) => java(name, `package demo;\n${imports}\npublic class ${name} {\n  public static void main(String[] args) throws Exception {\n${body}\n  }\n}`);
const stage = (id, title, description, focus, expected, troubleshooting, files) => ({id,title,description,focus,commands:[run(({connect:'ConnectDemo',core:'CoreDemo',scenario:'ScenarioDemo'})[id])],expected,troubleshooting,files});
const http = java('Http', String.raw`
package demo;
import com.fasterxml.jackson.databind.*;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
public final class Http {
  public static final ObjectMapper JSON = new ObjectMapper();
  private static final HttpClient CLIENT = HttpClient.newBuilder()
      .connectTimeout(Duration.ofSeconds(5)).build();
  public static HttpResponse<String> raw(String method, String url, String auth,
      String body, String type) throws Exception {
    var builder = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(40))
        .header("Content-Type", type);
    if (!auth.isBlank()) builder.header("Authorization", auth);
    builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody()
        : HttpRequest.BodyPublishers.ofString(body));
    return CLIENT.send(builder.build(), HttpResponse.BodyHandlers.ofString());
  }
  public static JsonNode json(String method, String url, String auth, Object body) throws Exception {
    var result = raw(method, url, auth, body == null ? null : JSON.writeValueAsString(body), "application/json");
    return checked(result);
  }
  public static JsonNode checked(HttpResponse<String> result) throws Exception {
    if (result.statusCode() / 100 != 2) {
      // 不输出请求头、Key 或完整用户输入。
      String detail = result.body();
      throw new IllegalStateException("HTTP " + result.statusCode() + " "
          + detail.substring(0, Math.min(500, detail.length())));
    }
    return JSON.readTree(result.body());
  }
}`);
const embeddings = java('Embeddings', String.raw`
package demo;
import java.util.*;
public final class Embeddings {
  public static final int DIM = 1024;
  public static String model() { return Env.get("EMBED_MODEL", "text-embedding-v3"); }
  public static List<double[]> encode(List<String> texts, String type) throws Exception {
    if (!Set.of("document", "query").contains(type)) throw new IllegalArgumentException("text_type");
    List<double[]> all = new ArrayList<>();
    // 使用原生 DashScope 契约；v3 每批最多 10 条，示例文本均为短文本。
    for (int start = 0; start < texts.size(); start += 10) {
      var batch = texts.subList(start, Math.min(start + 10, texts.size()));
      var root = Http.json("POST", Env.required("EMBED_URL"),
          "Bearer " + Env.required("DASHSCOPE_API_KEY"), Map.of(
          "model", model(), "input", Map.of("texts", batch),
          "parameters", Map.of("text_type", type, "dimension", DIM, "output_type", "dense")));
      var rows = root.path("output").path("embeddings");
      if (!rows.isArray() || rows.size() != batch.size()) throw new IllegalStateException("向量数量不匹配：" + root.path("code"));
      double[][] ordered = new double[batch.size()][];
      for (var row : rows) {
        int i = row.path("text_index").asInt(-1);
        var vector = row.path("embedding");
        if (i < 0 || i >= ordered.length || ordered[i] != null || vector.size() != DIM)
          throw new IllegalStateException("重复 index / 维度不符 / 缺少向量");
        ordered[i] = new double[DIM];
        for (int d = 0; d < DIM; d++) {
          if (!vector.get(d).isNumber()) throw new IllegalStateException("非数值向量");
          double value = vector.get(d).asDouble();
          if (!Double.isFinite(value)) throw new IllegalStateException("无效浮点数");
          ordered[i][d] = value;
        }
      }
      all.addAll(Arrays.asList(ordered));
      System.out.println("request_id=" + root.path("request_id").asText() + " batch=" + batch.size()
          + " usage=" + root.path("usage"));
    }
    return all;
  }
  public static double cosine(double[] a, double[] b) {
    if (a.length != b.length) throw new IllegalArgumentException("维度不同");
    double dot = 0, aa = 0, bb = 0;
    for (int i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
    if (aa == 0 || bb == 0) throw new IllegalArgumentException("零向量");
    return dot / Math.sqrt(aa * bb);
  }
}`);
const embeddingEnv = [
  {name:'DASHSCOPE_API_KEY',example:'<你所在地域的百炼 API Key>',description:'只通过本地环境变量提供；调用会产生实际模型用量。'},
  {name:'EMBED_URL',example:'https://<业务空间ID>.cn-beijing.maas.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding',description:'完整 DashScope 原生 HTTP 地址；从控制台确认地域/API Host，旧账号可按官方文档填对应入口。不是 /compatible-mode/v1/embeddings。'},
  {name:'EMBED_MODEL',example:'text-embedding-v3',description:'已开通的模型；示例固定 1024 维，切模型需要独立索引和重新入库。'}
];
const embedSource = {label:'阿里云 DashScope 原生 Embedding：text_type / dimension / text_index',url:'https://help.aliyun.com/zh/model-studio/text-embedding-synchronous-api'};
const prerequisites = ['JDK 17+、Maven 3.6.3+；项目依赖已固定版本。先在下载项目的根目录执行命令。','所有环境变量由运行命令的终端提供，Env.java 不会自动加载 .env 文件。'];
const embeddingDemo = {
  id:'embedding',title:'Embedding：真实向量、批处理与知识召回',
  summary:'用 JDK HttpClient 调用 DashScope 原生接口，明确 document/query、批量索引映射和 1024 维契约。',
  scenario:'把企业报销、账号和运维知识向量化，为口语问题选出带文档编号的候选证据。只做召回，不伪造 LLM 回答。',
  prerequisites:[...prerequisites,'已开通百炼 text-embedding-v3 或兼容该原生契约的模型；API Key 与端点地域一致。示例运行会将页面中的演示文本发送到该服务并计费。'],
  environment:embeddingEnv,
  stages:[
    stage('connect','基础接入 · 读取真实向量','发送一条短文本，确认鉴权、模型、向量长度与用量。',['POST 原生接口','检查返回数量与维度'],['打印 request_id、usage、dimensions=1024 和前 5 个数；具体数值由模型决定。'],['401 查 Key 和地域；404 查完整原生路径；模型未开通或配额不足按响应错误处理。'],[path('ConnectDemo'),path('Embeddings'),path('Http'),'pom.xml']),
    stage('core','核心功能 · 分批与文档/查询编码','一次处理 12 条文档，按 10+2 拆分，再编码 query。',['按 text_index 恢复顺序','document 和 query 分开调用','计算余弦而非直接比较数组'],['文档请求显示 batch=10 和 batch=2，另有一个 query 请求；打印 12 个分数。'],['数量或维度异常会直接失败；不要给原生接口使用 dimensions 或 input 字符串数组等兼容协议字段。'],[path('CoreDemo'),path('Embeddings')]),
    stage('scenario','场景应用 · 小型知识助手召回','对固定知识片段生成真实向量，按相似度返回 Top 2 和稳定 ID。',['同一模型编码两端','原文与向量下标一致','这是内存精确检索，不是向量数据库'],['打印 query、排名、docId、score、证据原文；不保证不同模型的分数相同。'],['若相关证据排名不佳，先检查文本与 query 类型，再比较模型；分数不是正确概率。'],[path('ScenarioDemo'),path('Embeddings')])
  ],
  files:[pom('embedding',jackson),envFile,http,embeddings,
    main('ConnectDemo','import java.util.*;',String.raw`    double[] vector = Embeddings.encode(List.of("企业知识库连接验证"), "document").get(0);
    System.out.println("model=" + Embeddings.model() + " dimensions=" + vector.length);
    System.out.println(Arrays.toString(Arrays.copyOf(vector, 5)));`),
    main('CoreDemo','import java.util.*;',String.raw`    List<String> texts = new ArrayList<>();
    for (int i = 1; i <= 12; i++) texts.add("制度条款 " + i + "：报销申请需要提供发票和审批记录。");
    var vectors = Embeddings.encode(texts, "document");
    var query = Embeddings.encode(List.of("报销要准备什么材料？"), "query").get(0);
    for (int i = 0; i < vectors.size(); i++)
      System.out.printf(Locale.ROOT, "row=%d cosine=%.5f%n", i, Embeddings.cosine(query, vectors.get(i)));`),
    main('ScenarioDemo','import java.util.*;\nimport java.util.stream.*;',String.raw`    var ids = List.of("expense-v1#0", "account-v1#0", "ops-v1#0");
    var docs = List.of("差旅报销应在返回后30天内提交，需提供发票和审批记录。",
        "重置账号密码需进入账号中心，验证企业邮箱后设置新密码。",
        "数据库连接超时应检查网络、连接池和数据库负载。");
    String question = Env.get("QUESTION", "出差回来多久内要交报销？");
    var vectors = Embeddings.encode(docs, "document");
    var query = Embeddings.encode(List.of(question), "query").get(0);
    var ranked = IntStream.range(0, docs.size()).boxed()
        .sorted(Comparator.comparingDouble((Integer i) -> Embeddings.cosine(query, vectors.get(i))).reversed()).toList();
    System.out.println("query=" + question);
    for (int i : ranked.subList(0, Math.min(2, ranked.size())))
      System.out.printf(Locale.ROOT, "[%s] score=%.5f %s%n", ids.get(i), Embeddings.cosine(query, vectors.get(i)), docs.get(i));`)
  ],sources:[embedSource]
};

const rerankClient = java('Rerank', String.raw`
package demo;
import java.util.*;
public final class Rerank {
  public record Hit(int index, double score, String text) {}
  public static List<Hit> rank(String query, List<String> docs, int topN) throws Exception {
    if (docs.isEmpty() || topN < 1 || topN > docs.size()) throw new IllegalArgumentException("候选与 topN");
    var result = Http.json("POST", Env.required("RERANK_URL"),
        "Bearer " + Env.required("DASHSCOPE_API_KEY"), Map.of(
        "model", Env.get("RERANK_MODEL", "gte-rerank-v2"),
        "input", Map.of("query", query, "documents", docs),
        "parameters", Map.of("top_n", topN, "return_documents", true)));
    var rows = result.path("output").path("results");
    if (!rows.isArray() || rows.size() != topN) throw new IllegalStateException("重排结果异常：" + result.path("code"));
    var hits = new ArrayList<Hit>(); var seen = new HashSet<Integer>();
    for (var row : rows) {
      int i = row.path("index").asInt(-1);
      double score = row.path("relevance_score").asDouble(Double.NaN);
      if (i < 0 || i >= docs.size() || !seen.add(i) || !Double.isFinite(score))
        throw new IllegalStateException("无效重排 index / score");
      // 使用原始 index 关联本地候选，不能拿排序后的下标当文档编号。
      hits.add(new Hit(i, score, docs.get(i)));
    }
    System.out.println("request_id=" + result.path("request_id").asText() + " usage=" + result.path("usage"));
    hits.sort(Comparator.comparingDouble(Hit::score).reversed());
    return hits;
  }
  public static List<String> fuse(List<List<String>> rankings) {
    Map<String, Double> scores = new HashMap<>();
    for (var ranking : rankings) {
      Set<String> seen = new HashSet<>();
      for (int i = 0; i < ranking.size(); i++)
        if (seen.add(ranking.get(i))) scores.merge(ranking.get(i), 1.0 / (60 + i + 1), Double::sum);
    }
    return scores.entrySet().stream()
        .sorted(Map.Entry.<String,Double>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
        .map(Map.Entry::getKey).toList();
  }
}`);
const rerankerDemo = {
  id:'reranker',title:'Reranker：候选重排、TopN 与引用对齐',summary:'真实调用 DashScope gte-rerank-v2；把服务返回的 index 映射回文档 ID，并与本地 RRF 融合清楚区分。',
  scenario:'知识助手先融合关键词和向量两路候选，再用真实模型选择最相关的 2 条证据，保留引用。',
  prerequisites:[...prerequisites,'已开通 gte-rerank-v2，准备相同地域的 Key 与原生 Rerank URL。API 调用会产生实际用量；示例只有固定短文本。'],
  environment:[embeddingEnv[0],{name:'RERANK_URL',example:'https://<业务空间ID>.cn-beijing.maas.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank',description:'从百炼控制台确认完整原生地址与地域。'},{name:'RERANK_MODEL',example:'gte-rerank-v2',description:'示例按照该模型的 query/documents/top_n 契约编写。'}],
  stages:[
    stage('connect','基础接入 · 获得真实相关性分数','用两条候选验证原生 API。',['input 和 parameters 分层','错误状态不当成空结果'],['输出 request_id、usage 和 2 个 Hit；分数不是固定常量。'],['401/403 查地域和模型权限；404 查 endpoint；400 查模型和参数组合。'],[path('ConnectDemo'),path('Rerank'),path('Http'),'pom.xml']),
    stage('core','核心功能 · TopN 与 index 映射','3 个文档只返回 2 个结果，通过原始 index 找回稳定文档 ID。',['返回下标指向输入列表','排序分数不表示事实正确概率'],['打印 2 行 docId、score 与文本，文档编号始终跟随原文。'],['候选原文/引用错位通常是将结果顺序误当输入顺序；不要跨模型复用分数阈值。'],[path('CoreDemo'),path('Rerank')]),
    stage('scenario','场景应用 · RRF 后做模型重排','用固定排名模拟两路检索，Java 做 RRF，再真实调用重排服务。',['固定召回用于展示融合，不伪装真实检索','融合与模型重排分阶段','输出带来源的上下文'],['先打印 RRF 的候选 ID，再打印 reranked context 的 2 条证据。'],['未进入候选的证据无法靠重排找回；本示例没有调用生成模型。'],[path('ScenarioDemo'),path('Rerank')])
  ],files:[pom('reranker',jackson),envFile,http,rerankClient,
    main('ConnectDemo','import java.util.*;',String.raw`    var hits = Rerank.rank("报销需要什么材料？", List.of("报销需提供发票和审批记录。", "账号密码可在账号中心重置。"), 2);
    hits.forEach(System.out::println);`),
    main('CoreDemo','import java.util.*;',String.raw`    var ids = List.of("account#0", "expense#0", "ops#0");
    var docs = List.of("账号登录需要企业邮箱。", "差旅报销需提交发票与审批单。", "连接池过小时请求会排队。");
    for (var hit : Rerank.rank("出差报销需要哪些附件？", docs, 2))
      System.out.printf(Locale.ROOT, "[%s] score=%.5f %s%n", ids.get(hit.index()), hit.score(), hit.text());`),
    main('ScenarioDemo','import java.util.*;',String.raw`    Map<String,String> corpus = Map.of("policy#0", "差旅报销应在返回后30天内提交。",
        "policy#1", "报销需提供发票、行程单及审批记录。", "account#0", "忘记密码请联系账号管理员。");
    // 固定排名模拟已经完成租户权限过滤的检索器输出。
    var fused = Rerank.fuse(List.of(List.of("policy#1", "account#0", "policy#0"),
        List.of("policy#0", "policy#1")));
    System.out.println("RRF=" + fused);
    var docs = fused.stream().map(corpus::get).toList();
    var hits = Rerank.rank(Env.get("QUESTION", "报销的截止时间是什么，还要什么材料？"), docs, 2);
    System.out.println("reranked context:");
    for (var hit : hits) System.out.printf(Locale.ROOT, "[%s] score=%.5f %s%n",
        fused.get(hit.index()), hit.score(), hit.text());`)
  ],sources:[{label:'DashScope Rerank 原生 API',url:'https://help.aliyun.com/zh/model-studio/text-rerank-api'},{label:'RRF 融合公式',url:'https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion'}]
};

const pgStore = java('PgStore', String.raw`
package demo;
import java.sql.*;
import java.util.*;
public final class PgStore {
  public static Connection connect() throws SQLException {
    return DriverManager.getConnection(Env.get("PG_URL", "jdbc:postgresql://localhost:5432/agent_demo"),
        Env.required("PG_USER"), Env.required("PG_PASSWORD"));
  }
  private static String table(boolean real) { return real ? "lesson_chunks_real" : "lesson_chunks_toy"; }
  public static void setup(Connection c, boolean real) throws SQLException {
    String table = table(real); int dim = real ? Embeddings.DIM : 3;
    try (var s = c.createStatement()) {
      s.execute("CREATE EXTENSION IF NOT EXISTS vector");
      s.execute("CREATE TABLE IF NOT EXISTS " + table + " (tenant text NOT NULL, id text NOT NULL, "
          + "content text NOT NULL, model_id text NOT NULL, embedding vector(" + dim + ") NOT NULL, PRIMARY KEY(tenant,id))");
      s.execute("CREATE INDEX IF NOT EXISTS " + table + "_hnsw ON " + table + " USING hnsw (embedding vector_cosine_ops)");
    }
  }
  public static void upsert(Connection c, boolean real, String tenant, String id,
      String text, String model, double[] vector) throws SQLException {
    if (vector.length != (real ? Embeddings.DIM : 3)) throw new IllegalArgumentException("维度不符");
    try (var p = c.prepareStatement("INSERT INTO " + table(real)
        + " (tenant,id,content,model_id,embedding) VALUES (?,?,?,?,?::vector) "
        + "ON CONFLICT(tenant,id) DO UPDATE SET content=EXCLUDED.content, model_id=EXCLUDED.model_id, embedding=EXCLUDED.embedding")) {
      p.setString(1, tenant); p.setString(2, id); p.setString(3, text); p.setString(4, model);
      p.setString(5, Arrays.toString(vector)); p.executeUpdate();
    }
  }
  public static void search(Connection c, boolean real, String tenant, String model, double[] query) throws SQLException {
    String sql = "SELECT id,tenant,content,embedding <=> ?::vector AS distance FROM " + table(real)
        + " WHERE tenant=? AND model_id=? ORDER BY embedding <=> ?::vector LIMIT ?";
    try (var p = c.prepareStatement(sql)) {
      p.setString(1, Arrays.toString(query)); p.setString(2, tenant); p.setString(3, model);
      p.setString(4, Arrays.toString(query)); p.setInt(5, 2);
      try (var rows = p.executeQuery()) {
        while (rows.next()) System.out.printf(Locale.ROOT, "[%s] tenant=%s distance=%.5f %s%n",
            rows.getString("id"), rows.getString("tenant"), rows.getDouble("distance"), rows.getString("content"));
      }
    }
  }
}`);
const pgvectorDemo = {
  id:'pgvector',title:'pgvector：JDBC 入库、HNSW 与租户 TopK',summary:'从三维教学数据理解余弦距离，再接真实 1024 维模型完成知识片段召回；不依赖额外向量 SDK。',
  scenario:'知识助手以服务端已确认的租户身份查询报销资料，确保候选阶段就带 tenant 和 model_id 过滤。',
  prerequisites:[...prerequisites,'已有 PostgreSQL 15+，服务器安装 pgvector 0.8.x。PG_USER 对教学数据库有 CREATE EXTENSION、建表和索引权限；正式环境由 DBA 预置扩展。','依赖 PostgreSQL JDBC 42.7.5、Jackson 2.18.2。前两阶段不调用云模型；场景阶段需要百炼 Embedding。运行会创建/更新 lesson_chunks_toy 和 lesson_chunks_real 教学表，不自动删除。'],
  environment:[{name:'PG_URL',example:'jdbc:postgresql://localhost:5432/agent_demo',description:'已有教学数据库 JDBC URL，可按需要加 sslmode。'},{name:'PG_USER',example:'learner',description:'仅用于教学库的数据库账号。'},{name:'PG_PASSWORD',example:'<数据库密码>',description:'通过环境变量传入。'},...embeddingEnv],
  stages:[
    stage('connect','基础接入 · JDBC 与扩展检查','连接数据库并读取 PostgreSQL 版本、已安装 vector 扩展版本。',['连接与结果集关闭','不输出数据库密码'],['打印 PostgreSQL 版本；若扩展尚未启用，显示 vector not enabled，下一阶段尝试启用。'],['connection refused 查端口/网络；extension not available 表示服务器缺少扩展包，不能靠 Maven 修复。'],[path('ConnectDemo'),path('PgStore'),'pom.xml']),
    stage('core','核心功能 · 教学向量入库与索引','创建 vector(3)、HNSW 与带租户过滤的 SQL TopK。数字向量只是距离演示，没有真实语义。',['SQL 参数绑定','ON CONFLICT 幂等写入','过滤先于返回候选'],['只打印 tenant=team-a 的 2 条记录；team-b 的相同方向向量不会出现。'],['vector dimensions 不匹配检查表结构；小表优化器可能选择顺序扫描，这不表示索引失效。'],[path('CoreDemo'),path('PgStore')]),
    stage('scenario','场景应用 · 真实 Embedding + 权限过滤','用 document 编码入库，用 query 编码问题并查询同一模型和租户。',['不同维度使用独立表','模型标识随向量持久化','输出证据 ID，供后续生成引用'],['打印真实模型用量和 team-a 的候选证据；不调用生成模型。'],['模型切换后要重建全量索引；ANN 加过滤返回不足时比较精确搜索、迭代扫描和索引参数，不在应用里去掉权限条件。'],[path('ScenarioDemo'),path('Embeddings'),path('PgStore')])
  ],files:[pom('pgvector',jackson+dep('org.postgresql','postgresql','42.7.5')),envFile,http,embeddings,pgStore,
    main('ConnectDemo','',String.raw`    try (var c = PgStore.connect(); var s = c.createStatement()) {
      try (var r = s.executeQuery("SELECT version()")) { r.next(); System.out.println(r.getString(1)); }
      try (var r = s.executeQuery("SELECT extversion FROM pg_extension WHERE extname='vector'")) {
        System.out.println(r.next() ? "vector=" + r.getString(1) : "vector not enabled");
      }
    }`),
    main('CoreDemo','',String.raw`    try (var c = PgStore.connect()) {
      PgStore.setup(c, false);
      PgStore.upsert(c, false, "team-a", "toy-1", "请假流程（教学方向1）", "toy-3d", new double[]{1,0,0});
      PgStore.upsert(c, false, "team-a", "toy-2", "报销流程（教学方向2）", "toy-3d", new double[]{0,1,0});
      PgStore.upsert(c, false, "team-b", "toy-3", "另一租户内容", "toy-3d", new double[]{1,0,0});
      PgStore.search(c, false, "team-a", "toy-3d", new double[]{0.9,0.1,0});
    }`),
    main('ScenarioDemo','import java.util.*;',String.raw`    var docs = List.of("差旅报销应在返回后30天内提交。", "企业账号可以通过邮箱验证重置密码。", "另一租户报销额度只供其内部使用。");
    var vectors = Embeddings.encode(docs, "document");
    String question = Env.get("QUESTION", "出差回来多久提交报销？");
    var query = Embeddings.encode(List.of(question), "query").get(0);
    try (var c = PgStore.connect()) {
      PgStore.setup(c, true);
      for (int i = 0; i < docs.size(); i++) PgStore.upsert(c, true,
          i == 2 ? "team-b" : "team-a", "policy-v1#" + i, docs.get(i), Embeddings.model(), vectors.get(i));
      // 身份在业务服务中验证；不从用户问题中解析 tenant。
      PgStore.search(c, true, "team-a", Embeddings.model(), query);
    }`)
  ],sources:[{label:'pgvector 官方 SQL、HNSW 与过滤',url:'https://github.com/pgvector/pgvector'},embedSource]
};

const milvusStore = java('MilvusStore', String.raw`
package demo;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;
public final class MilvusStore {
  public static JsonNode call(String operation, Object body) throws Exception {
    String base = Env.get("MILVUS_URL", "http://localhost:19530").replaceAll("/+$", "");
    String token = Env.get("MILVUS_TOKEN", "");
    var root = Http.json("POST", base + "/v2/vectordb/" + operation,
        token.isBlank() ? "" : "Bearer " + token, body);
    if (root.path("code").asInt(-1) != 0) throw new IllegalStateException("Milvus " + root);
    return root.path("data");
  }
  public static String collection(boolean real) { return real ? "lesson_real_1024" : "lesson_toy_3"; }
  public static void setup(boolean real) throws Exception {
    String name = collection(real);
    if (!call("collections/has", Map.of("collectionName", name)).path("has").asBoolean()) {
      var fields = List.of(
          Map.of("fieldName", "id", "dataType", "Int64", "isPrimary", true),
          Map.of("fieldName", "tenant", "dataType", "VarChar", "elementTypeParams", Map.of("max_length", "64")),
          Map.of("fieldName", "content", "dataType", "VarChar", "elementTypeParams", Map.of("max_length", "4096")),
          Map.of("fieldName", "model_id", "dataType", "VarChar", "elementTypeParams", Map.of("max_length", "128")),
          Map.of("fieldName", "vector", "dataType", "FloatVector", "elementTypeParams", Map.of("dim", real ? "1024" : "3")));
      call("collections/create", Map.of("collectionName", name,
          "schema", Map.of("autoID", false, "fields", fields),
          "indexParams", List.of(Map.of("fieldName", "vector", "indexName", "vector_idx", "metricType", "COSINE", "params", Map.of("index_type", "AUTOINDEX"))),
          "params", Map.of("consistencyLevel", "Strong")));
    }
    call("collections/load", Map.of("collectionName", name));
    for (int i = 0; i < 30; i++) {
      var data = call("collections/get_load_state", Map.of("collectionName", name));
      if (data.path("loadState").asText().equals("LoadStateLoaded")) return;
      Thread.sleep(500);
    }
    throw new IllegalStateException("集合15秒内未加载，请检查索引和服务资源");
  }
  public static Map<String,Object> row(long id, String tenant, String content, String model, double[] vector) {
    return Map.of("id", id, "tenant", tenant, "content", content, "model_id", model, "vector", vector);
  }
  public static void upsert(boolean real, List<Map<String,Object>> rows) throws Exception {
    System.out.println("upsert=" + call("entities/upsert", Map.of("collectionName", collection(real), "data", rows)));
  }
  public static void search(boolean real, double[] query, String model) throws Exception {
    // JSON 字符串编码用于构造字符串字面量；租户固定来自已验证的服务端身份。
    String filter = "tenant == \"team-a\" and model_id == " + Http.JSON.writeValueAsString(model);
    var hits = call("entities/search", Map.of("collectionName", collection(real), "data", List.of(query),
        "annsField", "vector", "filter", filter, "limit", 2,
        "outputFields", List.of("id", "tenant", "content", "model_id"), "consistencyLevel", "Strong"));
    System.out.println(hits.toPrettyString());
  }
}`);
const milvusDemo = {
  id:'milvus',title:'Milvus：REST Collection、Upsert 与过滤搜索',summary:'通过 Milvus 2.6 REST v2 创建显式 Schema，等待集合加载，按稳定主键 Upsert 并执行 Strong 读。',
  scenario:'独立向量服务承载知识助手候选索引，Java 负责模型、租户、文档 ID 与引用内容。',
  prerequisites:[...prerequisites,'已有可访问的 Milvus 2.6.x，开放 REST v2；不在本例启动服务。示例在默认数据库创建 lesson_toy_3、lesson_real_1024 集合，持久化保留供观察。','前两阶段使用三维教学向量；场景阶段调用百炼真实 Embedding。依赖仅 Jackson 2.18.2，无 Milvus SDK 版本绑定。'],
  environment:[{name:'MILVUS_URL',example:'http://localhost:19530',description:'已有 Milvus REST 基础地址，不包含 /v2/vectordb。'},{name:'MILVUS_TOKEN',example:'<username:password 或服务 token>',description:'开启认证时填写；仅本机明确未开启认证的服务可以留空。'},...embeddingEnv],
  stages:[
    stage('connect','基础接入 · 列出已有集合','验证 HTTP 状态与 JSON 业务 code，不把 HTTP 200 自动当成成功。',['REST v2 路径','默认数据库的权限'],['打印 data 中集合名称列表，空列表也是正常结果。'],['404 查服务版本/反向代理；code 非0读取 message；19530 必须可从运行 Java 的位置访问。'],[path('ConnectDemo'),path('MilvusStore'),path('Http'),'pom.xml']),
    stage('core','核心功能 · Schema、索引、Upsert 与 TopK','创建显式 tenant/content/model_id 字段，使用三维数字演示过滤。',['区分写入成功与集合已加载','Stable id + upsert','Strong 读用于观察立即可见性'],['upsert 显示写入数量；搜索仅返回 team-a，team-b 不会进入候选。'],['集合同名但 Schema 不同需换教学集合名或人工处理；加载超时检查 Milvus 资源与索引状态，勿无限重试。'],[path('CoreDemo'),path('MilvusStore')]),
    stage('scenario','场景应用 · 真实语义召回','真实模型编码文档与问题，用独立 1024 维集合执行租户过滤检索。',['模型元数据随实体保存','输出证据与 ID','不会连接生成模型'],['打印模型 request_id、upsert 结果与带 content 的 2 条候选。'],['维度错误检查 Embedding 和集合；结果不足先看 filter、租户分布和可见性，再改 topK。'],[path('ScenarioDemo'),path('Embeddings'),path('MilvusStore')])
  ],files:[pom('milvus',jackson),envFile,http,embeddings,milvusStore,
    main('ConnectDemo','import java.util.*;',String.raw`    System.out.println(MilvusStore.call("collections/list", Map.of()));`),
    main('CoreDemo','import java.util.*;',String.raw`    MilvusStore.setup(false);
    MilvusStore.upsert(false, List.of(
        MilvusStore.row(1, "team-a", "教学方向1", "toy-3d", new double[]{1,0,0}),
        MilvusStore.row(2, "team-a", "教学方向2", "toy-3d", new double[]{0,1,0}),
        MilvusStore.row(3, "team-b", "不应返回的另一租户", "toy-3d", new double[]{1,0,0})));
    MilvusStore.search(false, new double[]{0.9,0.1,0}, "toy-3d");`),
    main('ScenarioDemo','import java.util.*;',String.raw`    var docs = List.of("差旅报销应在返回后30天内提交。", "密码重置需要验证企业邮箱。", "另一租户报销上限信息。");
    var vectors = Embeddings.encode(docs, "document");
    var query = Embeddings.encode(List.of(Env.get("QUESTION", "出差后什么时候报销？")), "query").get(0);
    MilvusStore.setup(true);
    var rows = new ArrayList<Map<String,Object>>();
    for (int i = 0; i < docs.size(); i++) rows.add(MilvusStore.row(i + 1,
        i == 2 ? "team-b" : "team-a", docs.get(i), Embeddings.model(), vectors.get(i)));
    MilvusStore.upsert(true, rows);
    MilvusStore.search(true, query, Embeddings.model());`)
  ],sources:[{label:'Milvus REST v2 创建集合',url:'https://milvus.io/api-reference/restful/v2.6.x/v2/Collection%20(v2)/Create.md'},{label:'Milvus REST v2 Upsert',url:'https://milvus.io/api-reference/restful/v2.6.x/v2/Vector%20(v2)/Upsert.md'},{label:'Milvus REST v2 Search',url:'https://milvus.io/api-reference/restful/v2.6.x/v2/Vector%20(v2)/Search.md'},embedSource]
};

const elasticStore = java('ElasticStore', String.raw`
package demo;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;
public final class ElasticStore {
  public static final String INDEX = "lesson_agent_chunks_v1";
  static String url(String path) { return Env.get("ES_URL", "http://localhost:9200").replaceAll("/+$", "") + path; }
  static String auth() { String key = Env.get("ES_API_KEY", ""); return key.isBlank() ? "" : "ApiKey " + key; }
  static JsonNode call(String method, String path, Object body) throws Exception {
    return Http.json(method, url(path), auth(), body);
  }
  public static void setup() throws Exception {
    var head = Http.raw("HEAD", url("/" + INDEX), auth(), null, "application/json");
    if (head.statusCode() == 200) return;
    if (head.statusCode() != 404) throw new IllegalStateException("索引探测 HTTP " + head.statusCode());
    call("PUT", "/" + INDEX, Map.of("mappings", Map.of("properties", Map.of(
        "tenant", Map.of("type", "keyword"), "model_id", Map.of("type", "keyword"),
        "content", Map.of("type", "text", "analyzer", "standard"),
        "vector", Map.of("type", "dense_vector", "dims", 1024, "index", false)))));
  }
  public static void bulk(List<Map<String,Object>> docs) throws Exception {
    StringBuilder ndjson = new StringBuilder();
    for (var doc : docs) {
      Map<String,Object> source = new HashMap<>(doc); Object id = source.remove("id");
      ndjson.append(Http.JSON.writeValueAsString(Map.of("index", Map.of("_index", INDEX, "_id", id)))).append('\n');
      ndjson.append(Http.JSON.writeValueAsString(source)).append('\n');
    }
    var result = Http.checked(Http.raw("POST", url("/_bulk?refresh=wait_for"), auth(), ndjson.toString(), "application/x-ndjson"));
    if (result.path("errors").asBoolean()) throw new IllegalStateException("bulk 部分失败：" + result.path("items"));
    System.out.println("indexed=" + docs.size());
  }
  private static List<Object> filters(String model) {
    return new ArrayList<>(List.of(Map.of("term", Map.of("tenant", "team-a")),
        Map.of("term", Map.of("model_id", model))));
  }
  public static JsonNode lexical(String query, String model) throws Exception {
    return call("POST", "/" + INDEX + "/_search", Map.of("size", 5,
        "_source", List.of("content", "tenant", "model_id"),
        "query", Map.of("bool", Map.of("filter", filters(model), "must", Map.of("match", Map.of("content", query))))))
        .path("hits").path("hits");
  }
  public static JsonNode semantic(double[] vector, String model) throws Exception {
    var filters = filters(model); filters.add(Map.of("exists", Map.of("field", "vector")));
    // 教学用精确扫描；大数据需评估 ANN。+1 保证 score 非负。
    return call("POST", "/" + INDEX + "/_search", Map.of("size", 5,
        "_source", List.of("content", "tenant", "model_id"),
        "query", Map.of("script_score", Map.of("query", Map.of("bool", Map.of("filter", filters)),
        "script", Map.of("source", "cosineSimilarity(params.q, 'vector') + 1.0", "params", Map.of("q", vector))))))
        .path("hits").path("hits");
  }
  public static void fuse(JsonNode bm25, JsonNode vector) {
    Map<String,Double> scores = new HashMap<>(); Map<String,JsonNode> sources = new HashMap<>();
    for (var ranking : List.of(bm25, vector)) {
      for (int i = 0; i < ranking.size(); i++) {
        var hit = ranking.get(i); String id = hit.path("_id").asText();
        scores.merge(id, 1.0 / (60 + i + 1), Double::sum); sources.put(id, hit.path("_source"));
      }
    }
    scores.entrySet().stream().sorted(Map.Entry.<String,Double>comparingByValue().reversed()
        .thenComparing(Map.Entry.comparingByKey())).limit(2).forEach(e ->
        System.out.println("[" + e.getKey() + "] rrf=" + e.getValue() + " " + sources.get(e.getKey()).path("content").asText()));
  }
}`);
const elasticDemo = {
  id:'elasticsearch',title:'Elasticsearch：BM25、真实向量与 Java RRF',summary:'创建 text/keyword/dense_vector Mapping，检查 Bulk 子结果，再将 BM25 和精确向量搜索在 Java 中融合。',
  scenario:'运维知识助手同时理解“E1042”错误码与“连不上数据库”的口语描述，返回有租户过滤的证据。',
  prerequisites:[...prerequisites,'已有 Elasticsearch 8.15+ 或 9.x，账号可创建 lesson_agent_chunks_v1 索引和执行读写；按部署许可确认基础搜索/向量脚本可用。示例不使用 Elasticsearch 服务端 RRF retriever，不依赖其订阅能力。','向量使用 index:false + script_score 精确扫描，适合教学小数据，不宣称大规模性能。核心阶段不调用云模型；场景阶段需要真实 Embedding。','开启 HTTPS 时配置 JVM 信任的 CA，不关闭证书校验；ES_API_KEY 填创建 API Key 时返回的 encoded 值。'],
  environment:[{name:'ES_URL',example:'https://localhost:9200',description:'已有 Elasticsearch 地址；无认证的本机教学实例可使用 http。'},{name:'ES_API_KEY',example:'<encoded API Key>',description:'有认证时必填；无认证本机实例留空。'},...embeddingEnv],
  stages:[
    stage('connect','基础接入 · 版本与权限','调用根端点，验证 TLS、API Key 和 HTTP 通路。',['鉴权与证书','依赖仅 JDK HttpClient/Jackson'],['打印 cluster_name 与 version.number。'],['PKIX 错误导入可信 CA；401 检查 encoded Key；403 检查集群监控/根端点访问权限。'],[path('ConnectDemo'),path('ElasticStore'),path('Http'),'pom.xml']),
    stage('core','核心功能 · Mapping、Bulk 与 BM25','建立明确映射，批量写入三条教学知识，用 E1042 搜索。',['Bulk HTTP 200 仍要检查 errors','keyword 负责租户过滤','refresh=wait_for 仅便于本例立即观察'],['indexed=3；BM25 只返回 team-a 的 E1042 知识，team-b 被排除。'],['已有同名不兼容 Mapping 不能原地改类型；请换新的教学索引名，勿直接删除业务索引。中文实际分词需用 _analyze 检查。'],[path('CoreDemo'),path('ElasticStore')]),
    stage('scenario','场景应用 · 关键词与语义融合','真实 document/query 向量 + BM25 各搜一路，Java 按排名做 RRF。',['两路都带相同租户/模型过滤','不直接加原始分数','应用 RRF 不使用服务端付费 retriever'],['打印 indexed=3、两路 hits 与融合后 Top 2 证据；分数由索引/模型计算。'],['script_score 被禁用时检查 search.allow_expensive_queries；大数据请改 ANN 方案并验证版本许可；本例不会自动放宽集群配置。'],[path('ScenarioDemo'),path('Embeddings'),path('ElasticStore')])
  ],files:[pom('elasticsearch',jackson),envFile,http,embeddings,elasticStore,
    main('ConnectDemo','',String.raw`    var info = ElasticStore.call("GET", "/", null);
    System.out.println("cluster=" + info.path("cluster_name").asText() + " version=" + info.path("version").path("number").asText());`),
    main('CoreDemo','import java.util.*;',String.raw`    ElasticStore.setup();
    ElasticStore.bulk(List.of(
        Map.of("id", "a1", "tenant", "team-a", "model_id", "lexical-only", "content", "E1042 数据库连接超时，请检查网络与连接池。"),
        Map.of("id", "a2", "tenant", "team-a", "model_id", "lexical-only", "content", "企业账号密码重置流程。"),
        Map.of("id", "b1", "tenant", "team-b", "model_id", "lexical-only", "content", "E1042 另一租户内部资料。")));
    System.out.println(ElasticStore.lexical("E1042", "lexical-only").toPrettyString());`),
    main('ScenarioDemo','import java.util.*;',String.raw`    var texts = List.of("E1042 表示数据库连接超时，应检查网络、数据库负载与连接池。",
        "当请求等待连接过久时，观察连接池活跃数量和等待队列，避免盲目扩容。", "另一租户的 E1042 处理记录。");
    var ids = List.of("a1", "a2", "b1");
    var vectors = Embeddings.encode(texts, "document");
    String question = Env.get("QUESTION", "E1042，应用连不上数据库怎么排查？");
    var query = Embeddings.encode(List.of(question), "query").get(0);
    ElasticStore.setup(); var docs = new ArrayList<Map<String,Object>>();
    for (int i = 0; i < texts.size(); i++) docs.add(Map.of("id", ids.get(i), "tenant", i == 2 ? "team-b" : "team-a",
        "model_id", Embeddings.model(), "content", texts.get(i), "vector", vectors.get(i)));
    ElasticStore.bulk(docs);
    var bm25 = ElasticStore.lexical(question, Embeddings.model());
    var semantic = ElasticStore.semantic(query, Embeddings.model());
    System.out.println("BM25=" + bm25); System.out.println("vector=" + semantic);
    ElasticStore.fuse(bm25, semantic);`)
  ],sources:[{label:'Elasticsearch Bulk API',url:'https://www.elastic.co/docs/api/doc/elasticsearch/operation/operation-bulk'},{label:'script_score 向量函数与精确搜索',url:'https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-script-score-query'},{label:'RRF 公式及服务端功能说明',url:'https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion'},embedSource]
};

const parser = java('Documents', String.raw`
package demo;
import org.apache.tika.Tika;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.metadata.TikaCoreProperties;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.sax.BodyContentHandler;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
public final class Documents {
  public record Parsed(String documentId, String version, String tenant, String source,
      String mime, String parserVersion, String text) {}
  public record Chunk(String id, String documentId, String version, String tenant, String source,
      String mime, String parserVersion, int startCodePoint, int endCodePoint, String text) {}
  public static Path input() { return Path.of(Env.get("DOCUMENT_PATH", "sample.txt")); }
  public static byte[] bytes(Path path) throws IOException {
    if (!Files.isRegularFile(path)) throw new IllegalArgumentException("文件不存在：" + path);
    if (Files.size(path) > 20 * 1024 * 1024) throw new IllegalArgumentException("教学限制：文件不得超过20MiB");
    return Files.readAllBytes(path);
  }
  public static String sha(byte[] bytes) throws Exception {
    return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
  }
  public static Parsed parse() throws Exception {
    Path path = input(); byte[] bytes = bytes(path);
    String tenant = Env.get("DOCUMENT_TENANT", "team-a");
    String source = Env.get("DOCUMENT_SOURCE", "employee-handbook-v1");
    String documentId = sha((tenant + "\n" + source).getBytes(StandardCharsets.UTF_8));
    Metadata metadata = new Metadata(); metadata.set(TikaCoreProperties.RESOURCE_NAME_KEY, path.getFileName().toString());
    // 有界输出；超过上限抛错，不静默截断。这里只处理用户选定的本地教学文件。
    BodyContentHandler handler = new BodyContentHandler(200_000);
    try (InputStream in = new ByteArrayInputStream(bytes)) {
      new AutoDetectParser().parse(in, handler, metadata, new ParseContext());
    }
    String text = handler.toString().replace("\r\n", "\n").strip();
    if (text.isBlank()) throw new IllegalStateException("没有抽取到文本；扫描件可能需要独立OCR");
    return new Parsed(documentId, sha(bytes), tenant, source, new Tika().detect(bytes, path.getFileName().toString()),
        "tika-3.2.3", text);
  }
  public static List<Chunk> chunks(Parsed doc, int size, int overlap) {
    if (size <= 0 || overlap < 0 || overlap >= size) throw new IllegalArgumentException("切分参数");
    int[] points = doc.text().codePoints().toArray(); var result = new ArrayList<Chunk>();
    for (int start = 0; start < points.length; start += size - overlap) {
      int end = Math.min(start + size, points.length);
      String id = doc.documentId() + ":" + doc.version() + ":cp" + start;
      result.add(new Chunk(id, doc.documentId(), doc.version(), doc.tenant(), doc.source(), doc.mime(),
          doc.parserVersion(), start, end, new String(points, start, end - start)));
      if (end == points.length) break;
    }
    return result;
  }
}`);
const parsingDemo = {
  id:'document-parsing',title:'文档解析：Tika 提取、分块与可追溯元数据',summary:'纯 Java 完整管线：识别 MIME、提取文本、按 Unicode 码点分块，并输出带租户/版本/稳定 ID 的 JSONL。',
  scenario:'知识库入库 Worker 接收一份文件，产出可重复导入的片段记录，为 Embedding、索引和引用提供一致契约。',
  prerequisites:[...prerequisites,'锁定 Apache Tika 3.2.3 core + standard parsers、Jackson 2.18.2；首次 Maven 下载依赖可能较多。升级解析库前重新核验安全公告与解析差异。','默认 sample.txt 随项目下载，可直接运行；也可以设置 DOCUMENT_PATH 指向文本型 PDF、DOCX 等本地文件。限制输入20MiB、输出20万字符，超限报错。','此示例展示 Tika 基础文本抽取，不承诺扫描 OCR、版面顺序、表格结构或页码精度。复杂文档请按课程使用 MinerU/PaddleOCR 等解析服务并保留结构。'],
  environment:[{name:'DOCUMENT_PATH',example:'sample.txt',description:'默认使用附带样本文本，或填写实际本地文件绝对路径。'},{name:'DOCUMENT_TENANT',example:'team-a',description:'演示租户身份；真实服务由认证上下文提供，不能让上传者自由指定。'},{name:'DOCUMENT_SOURCE',example:'employee-handbook-v1',description:'稳定逻辑文档标识；不同业务文档必须不同，不使用临时文件路径作主键。'},{name:'OUTPUT_PATH',example:'target/chunks.jsonl',description:'本例输出路径，会覆盖同路径的演示产物。'}],
  stages:[
    stage('connect','基础接入 · 文件与 MIME','读取附带样本或用户指定文件，检查大小并识别 MIME。',['Tika core 负责类型识别','文件输入有限制'],['打印字节数、SHA-256 和 MIME，sample.txt 通常为 text/plain。'],['文件不存在检查当前目录和 DOCUMENT_PATH；不是所有 MIME 都有可用解析器。'],[path('ConnectDemo'),path('Documents'),'sample.txt','pom.xml']),
    stage('core','核心功能 · 提取与重叠分块','使用 standard parsers 提取文本，以 80 码点窗口/16 码点重叠演示切分。',['UTF-16 代理对不被切断','稳定逻辑文档 ID 与内容版本分离','码点偏移不是 PDF 页码'],['打印 documentId、version 和多个 chunk 的区间与文本；相同输入重复运行 ID 不变。'],['空文本可能是扫描件，不能直接假定文档无内容；WriteLimitReached 表示超过上限，不应索引残缺结果。','若出现缺少 SLF4J/Log4j provider 提示，这是日志实现未配置；以退出码和解析产物判断是否成功，实际项目应接入统一日志。'],[path('CoreDemo'),path('Documents')]),
    stage('scenario','场景应用 · 生成可追溯入库清单','生成 JSONL 片段，每条包含稳定主键、文档版本、租户、来源、解析器版本与文本。',['相同输入重复导入可按 chunkId upsert','内容变更产生新 version','旧版本清理由下游按文档版本策略执行'],['打印输出文件路径和 chunk 数；target/chunks.jsonl 可供后续 Embedding Worker 读取。'],['同一逻辑文档更新后应切换活跃版本/删除旧块，不能只追加；真实生产按标题和表格结构切分，而非只按字符。'],[path('ScenarioDemo'),path('Documents')])
  ],files:[pom('document-parsing',jackson+dep('org.apache.tika','tika-core','3.2.3')+dep('org.apache.tika','tika-parsers-standard-package','3.2.3')),envFile,parser,
    file('sample.txt','text',`员工知识手册\n\n差旅报销\n员工应在出差返回后三十天内提交报销申请。申请需要提供发票、行程单和主管审批记录。资料不完整时，财务会退回补充。审批状态以业务系统中的记录为准。\n\n账号管理\n员工忘记密码时，应通过企业邮箱完成身份验证。无法接收邮件时联系账号管理员。不要把验证码告诉任何人。\n\n数据库运维\nE1042 表示数据库连接超时。先检查网络连通性，再观察连接池等待数量、数据库负载和慢查询。不要直接扩大连接池而忽略数据库承载能力。`),
    main('ConnectDemo','import org.apache.tika.Tika;',String.raw`    var path = Documents.input(); var bytes = Documents.bytes(path);
    System.out.println("bytes=" + bytes.length + " sha256=" + Documents.sha(bytes));
    System.out.println("mime=" + new Tika().detect(bytes, path.getFileName().toString()));`),
    main('CoreDemo','',String.raw`    var document = Documents.parse();
    System.out.println("documentId=" + document.documentId() + " version=" + document.version());
    for (var chunk : Documents.chunks(document, 80, 16))
      System.out.println("[" + chunk.startCodePoint() + "," + chunk.endCodePoint() + ") " + chunk.text());`),
    main('ScenarioDemo','import com.fasterxml.jackson.databind.ObjectMapper;\nimport java.nio.file.*;\nimport java.nio.charset.StandardCharsets;',String.raw`    var document = Documents.parse(); var chunks = Documents.chunks(document, 160, 24);
    Path out = Path.of(Env.get("OUTPUT_PATH", "target/chunks.jsonl"));
    Path parent = out.toAbsolutePath().getParent(); Files.createDirectories(parent);
    ObjectMapper json = new ObjectMapper();
    try (var writer = Files.newBufferedWriter(out, StandardCharsets.UTF_8)) {
      for (var chunk : chunks) { writer.write(json.writeValueAsString(chunk)); writer.newLine(); }
    }
    System.out.println("output=" + out.toAbsolutePath() + " chunks=" + chunks.size());
    System.out.println("相同源文档重复运行可按chunkId幂等导入；版本切换由下游入库任务管理。");`)
  ],sources:[{label:'Apache Tika 3.2.3 Maven 与解析组件',url:'https://tika.apache.org/3.2.3/gettingstarted.html'},{label:'Apache Tika Java 使用示例',url:'https://tika.apache.org/3.2.3/examples.html'}]
};

export const retrievalDemos = [pgvectorDemo, milvusDemo, elasticDemo, embeddingDemo, rerankerDemo, parsingDemo];
