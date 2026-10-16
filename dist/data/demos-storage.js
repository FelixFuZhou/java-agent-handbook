import { file, java, pom, dep, envFile, run } from './demo-kit.js';

const entry = (name, ...support) => [`src/main/java/demo/${name}.java`, ...support.map(x => `src/main/java/demo/${x}.java`)];
const stage = (id, title, description, focus, expected, troubleshooting, support) => ({
  id, title, description, focus,
  commands: [run({ connect: 'ConnectDemo', core: 'CoreDemo', scenario: 'ScenarioDemo' }[id])],
  expected, troubleshooting,
  files: entry({ connect: 'ConnectDemo', core: 'CoreDemo', scenario: 'ScenarioDemo' }[id], ...support)
});

function jdbcDemo(id, label, driver, url, duplicate) {
  const db = java('Db', `
package demo;
import java.sql.*;

public final class Db {
  private Db() {}
  public static Connection open() throws SQLException {
    DriverManager.setLoginTimeout(5);
    Connection c = DriverManager.getConnection(Env.get("DEMO_JDBC_URL", "${url}"),
      Env.required("DEMO_DB_USER"), Env.required("DEMO_DB_PASSWORD"));
    String catalog = c.getCatalog();
    if (catalog == null || !catalog.startsWith("demo_")) {
      c.close(); throw new IllegalArgumentException("仅允许 demo_ 开头的学习数据库");
    }
    return c;
  }
  public static void schema(Connection c) throws SQLException {
    try (Statement s = c.createStatement()) {
      s.executeUpdate("CREATE TABLE IF NOT EXISTS demo_agent_task (" +
        "tenant_id VARCHAR(80) NOT NULL, request_id VARCHAR(100) NOT NULL, " +
        "status VARCHAR(20) NOT NULL, result VARCHAR(500), " +
        "PRIMARY KEY(tenant_id, request_id))${id === 'mysql' ? ' ENGINE=InnoDB' : ''}");
      s.executeUpdate("CREATE TABLE IF NOT EXISTS demo_outbox (" +
        "event_id VARCHAR(240) PRIMARY KEY, tenant_id VARCHAR(80) NOT NULL, " +
        "payload VARCHAR(500) NOT NULL, published INTEGER NOT NULL DEFAULT 0)${id === 'mysql' ? ' ENGINE=InnoDB' : ''}");
    }
  }
  public static boolean submit(Connection c, String tenant, String request) throws SQLException {
    c.setAutoCommit(false);
    try {
      try (PreparedStatement p = c.prepareStatement(
          "INSERT INTO demo_agent_task(tenant_id,request_id,status) VALUES (?,?,'PENDING')")) {
        p.setString(1, tenant); p.setString(2, request); p.executeUpdate();
      }
      event(c, "demo_created:" + tenant + ":" + request, tenant, "INDEX_REQUESTED " + request);
      c.commit(); return true;
    } catch (SQLException e) {
      c.rollback();
      if (${duplicate}) return false;
      throw e;
    } finally { c.setAutoCommit(true); }
  }
  static void event(Connection c, String id, String tenant, String body) throws SQLException {
    try (PreparedStatement p = c.prepareStatement(
        "INSERT INTO demo_outbox(event_id,tenant_id,payload) VALUES (?,?,?)")) {
      p.setString(1,id); p.setString(2,tenant); p.setString(3,body); p.executeUpdate();
    }
  }
  static boolean claim(Connection c, String tenant, String request) throws SQLException {
    try (PreparedStatement p = c.prepareStatement(
        "UPDATE demo_agent_task SET status='RUNNING' WHERE tenant_id=? AND request_id=? AND status='PENDING'")) {
      p.setString(1,tenant); p.setString(2,request); return p.executeUpdate() == 1;
    }
  }
  static void complete(Connection c, String tenant, String request, String result) throws SQLException {
    c.setAutoCommit(false);
    try {
      try (PreparedStatement p = c.prepareStatement(
          "UPDATE demo_agent_task SET status='SUCCEEDED',result=? " +
          "WHERE tenant_id=? AND request_id=? AND status='RUNNING'")) {
        p.setString(1,result); p.setString(2,tenant); p.setString(3,request);
        if (p.executeUpdate() != 1) throw new SQLException("任务不处于 RUNNING，拒绝覆盖");
      }
      event(c, "demo_completed:" + tenant + ":" + request, tenant, "INDEX_COMPLETED " + request);
      c.commit();
    } catch (SQLException e) { c.rollback(); throw e; }
    finally { c.setAutoCommit(true); }
  }
  static String state(Connection c, String tenant, String request) throws SQLException {
    try (PreparedStatement p = c.prepareStatement(
        "SELECT status FROM demo_agent_task WHERE tenant_id=? AND request_id=?")) {
      p.setString(1,tenant); p.setString(2,request);
      try (ResultSet r = p.executeQuery()) { return r.next() ? r.getString(1) : "ABSENT"; }
    }
  }
}`);
  return {
    id, title: `${label}：事务、幂等与任务状态`,
    summary: '用真实 JDBC 构建 Agent 任务账本，观察重复提交、事务回滚和状态条件更新，再把任务完成记录与 outbox 写入同一事务。',
    scenario: '文档索引任务被重复提交时只建立一次；Worker 只领取 PENDING 任务，完成时原子保存结果与待发布事件。示例不调用模型或 MQ。',
    prerequisites: ['JDK 17+、Maven 3.6.3+；在下载目录中运行命令。', `${label} ${id === 'postgres' ? '16 或 17' : '8.4'} 服务已可访问；由管理员预先创建 demo_agent 数据库，授予学习账号该库内建表、读写权限。`, '只操作 demo_agent_task 与 demo_outbox；数据库名必须以 demo_ 开头。示例保留记录，不自动删除数据。', '本例展示事务边界，不实现生产级租约、超时回收或真实消息发布器；RUNNING 进程崩溃恢复需另加租约与幂等执行策略。'],
    environment: [
      { name: 'DEMO_JDBC_URL', example: url, description: '学习库 JDBC 地址；可按实际认证、TLS和端口调整。' },
      { name: 'DEMO_DB_USER', example: 'demo_user', description: '只拥有学习库权限的数据库账号。' },
      { name: 'DEMO_DB_PASSWORD', example: '<学习账号密码>', description: '通过终端环境变量提供，不写入源码。' }
    ],
    stages: [
      stage('connect', '基础接入 · 验证连接与权限', '连接外部数据库，读取版本并创建两张教学表。', ['JDBC 服务发现与 try-with-resources', '数据库隔离与最小建表权限'], ['输出数据库产品、版本和 demo tables ready。'], ['Connection refused：核对服务端口与容器端口映射。', 'Access denied / authentication failed：检查账号、密码、库授权和 TLS 配置。'], ['Db']),
      stage('core', '核心功能 · 唯一键与回滚', '同一请求提交两次，再主动回滚一个新任务，观察数据库实际状态。', ['唯一约束承担并发幂等', '失败事务整体回滚，包括 outbox'], ['新 UUID 请求输出 created=true, duplicateCreated=false。', '回滚后的任务状态为 ABSENT。'], ['重复提交不是异常丢失：返回 false 表示已存在，应读取原任务。', '非唯一键 SQL 错误会继续抛出，不能当成幂等成功。'], ['Db']),
      stage('scenario', '场景应用 · 任务领取与 outbox', '使用固定请求 demo_doc_v1；首次领取并完成，重跑读取既有结果；列出待发布事件。', ['条件更新避免并发重复领取', '结果与完成事件同事务提交', 'outbox 仍待真正发布，打印不等于发送成功'], ['首次输出 claimed=true，随后 state=SUCCEEDED；重跑 claimed=false。', '只打印当前租户的 INDEX_REQUESTED 与 INDEX_COMPLETED 待发布记录。'], ['RUNNING 卡住：检查 Worker 是否在领取后崩溃，生产需租约与恢复机制。', '待发布事件不会自动清空；后续发布器需成功确认后更新 published，消费者仍需幂等。'], ['Db'])
    ],
    files: [pom(id, driver), envFile, db,
      java('ConnectDemo', `package demo;
public class ConnectDemo {
  public static void main(String[] args) throws Exception {
    try (var c = Db.open()) {
      var m = c.getMetaData();
      System.out.println(m.getDatabaseProductName() + " " + m.getDatabaseProductVersion());
      Db.schema(c);
      System.out.println("demo tables ready");
    }
  }
}`),
      java('CoreDemo', `package demo;
import java.util.UUID;
public class CoreDemo {
  public static void main(String[] args) throws Exception {
    try (var c = Db.open()) {
      Db.schema(c);
      String request = "demo_" + UUID.randomUUID();
      System.out.println("created=" + Db.submit(c,"demo_tenant",request));
      System.out.println("duplicateCreated=" + Db.submit(c,"demo_tenant",request));
      String rollback = "demo_rollback_" + UUID.randomUUID();
      c.setAutoCommit(false);
      try (var p = c.prepareStatement(
          "INSERT INTO demo_agent_task(tenant_id,request_id,status) VALUES (?,?,'PENDING')")) {
        p.setString(1,"demo_tenant"); p.setString(2,rollback); p.executeUpdate();
        c.rollback();
      } finally { c.setAutoCommit(true); }
      System.out.println("after rollback=" + Db.state(c,"demo_tenant",rollback));
    }
  }
}`),
      java('ScenarioDemo', `package demo;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    String tenant = "demo_tenant", request = "demo_doc_v1";
    try (var c = Db.open()) {
      Db.schema(c); Db.submit(c,tenant,request);
      boolean claimed = Db.claim(c,tenant,request);
      System.out.println("claimed=" + claimed);
      // 演示已知结果的持久化；这里没有真正执行解析或模型调用。
      if (claimed) Db.complete(c,tenant,request,"demo_index_reference_v1");
      System.out.println("state=" + Db.state(c,tenant,request));
      try (var p = c.prepareStatement(
          "SELECT event_id,payload FROM demo_outbox WHERE tenant_id=? AND published=0 ORDER BY event_id")) {
        p.setString(1,tenant);
        try (var r = p.executeQuery()) {
          while (r.next()) System.out.println("pending " + r.getString(1) + " -> " + r.getString(2));
        }
      }
    }
  }
}`)],
    sources: id === 'postgres'
      ? [{ label: 'pgJDBC 连接与参数', url: 'https://jdbc.postgresql.org/documentation/use/' }, { label: 'PostgreSQL 事务', url: 'https://www.postgresql.org/docs/current/tutorial-transactions.html' }]
      : [{ label: 'MySQL JDBC DriverManager', url: 'https://dev.mysql.com/doc/connector-j/en/connector-j-usagenotes-connect-drivermanager.html' }, { label: 'MySQL InnoDB 事务', url: 'https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-model.html' }]
  };
}

const postgres = jdbcDemo('postgres', 'PostgreSQL', dep('org.postgresql','postgresql','42.7.5'),
  'jdbc:postgresql://localhost:5432/demo_agent?connectTimeout=5&socketTimeout=10', '"23505".equals(e.getSQLState())');
const mysql = jdbcDemo('mysql', 'MySQL', dep('com.mysql','mysql-connector-j','8.4.0'),
  'jdbc:mysql://localhost:3306/demo_agent?connectTimeout=5000&socketTimeout=10000', 'e.getErrorCode() == 1062');

const redisSupport = java('RedisSupport', `
package demo;
import redis.clients.jedis.Jedis;
import java.net.URI;
import java.util.List;

public final class RedisSupport {
  private RedisSupport() {}
  static Jedis open() {
    return new Jedis(URI.create(Env.get("DEMO_REDIS_URI", "redis://localhost:6379/0")), 5000);
  }
  static String key(String tenant, String suffix) {
    if (!tenant.matches("[a-zA-Z0-9_-]+")) throw new IllegalArgumentException("非法演示租户");
    return "demo_agent:{" + tenant + "}:" + suffix;
  }
  static boolean allow(Jedis jedis, String tenant, String action, int limit, int seconds) {
    if (limit < 1 || seconds < 1) throw new IllegalArgumentException("限额与窗口须为正数");
    String lua = "local n=redis.call('INCR',KEYS[1]); " +
      "if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[2]); end; " +
      "if n<=tonumber(ARGV[1]) then return 1 else return 0 end";
    Object result = jedis.eval(lua, List.of(key(tenant,"limit:" + action)),
      List.of(Integer.toString(limit),Integer.toString(seconds)));
    return ((Number) result).longValue() == 1;
  }
  static String cachedPolicy(Jedis jedis, String tenant, String version) {
    String key = key(tenant,"cache:policy:" + version);
    String cached = jedis.get(key);
    if (cached != null) {
      System.out.println("cache hit tenant=" + tenant); return cached;
    }
    // 固定数据模拟已鉴权的数据源，生产替换成真实业务查询。
    String policy = tenant.equals("demo_alpha") ? "报销期限30天" : "报销期限15天";
    jedis.setex(key,60,policy);
    System.out.println("cache miss tenant=" + tenant);
    return policy;
  }
}`);

const redis = {
  id:'redis', title:'Redis：租户缓存与 Lua 限流',
  summary:'真实调用 Redis 验证字符串、TTL 和 Lua 原子计数，再为知识助手构建租户隔离缓存和有限请求预算。',
  scenario:'不同企业的报销制度不能共用答案缓存；模型调用前按租户限流，缓存失效后重新读取业务事实。',
  prerequisites:['JDK 17+、Maven 3.6.3+；锁定 Jedis 5.2.0。','已运行 Redis 7.2+；账号需允许 demo_agent:* 键的 GET、SET/SETEX、TTL、DEL、INCR、EXPIRE、EVAL，以及 PING。','示例限流是单 key 固定窗口，Redis Lua 原子执行；不等同于滑动窗口或分布式并发信号量。没有使用 FLUSHDB。'],
  environment:[{name:'DEMO_REDIS_URI',example:'redis://localhost:6379/0',description:'支持 redis://用户名:密码@主机:端口/库；TLS 使用 rediss://；避免把带密码的 URI 写进日志。'}],
  stages:[
    stage('connect','基础接入 · PING 与连接关闭','通过真实连接确认 Redis 就绪，不依赖框架自动装配。',['连接超时','凭据 URI 与资源关闭'],['打印 PONG。'],['NOAUTH/WRONGPASS：核对 ACL 用户与密码。','Connection refused：确认宿主机访问的是映射端口，而非容器内部地址。'],['RedisSupport']),
    stage('core','核心功能 · TTL 与原子限流','写入一个专用演示缓存，并在同一个窗口连续调用四次 Lua。',['缓存键有租户与版本','INCR 和首次 EXPIRE 在一个脚本内','最多允许三次，第四次拒绝'],['读取值 demo answer，TTL 为 1–60 秒。','allowed 依次为 true、true、true、false；不同运行使用不同演示窗口键。'],['NOPERM：EVAL 和脚本使用的命令都需要授权。','TTL=-1 表示未设置过期，TTL=-2 表示键不存在或刚过期。'],['RedisSupport']),
    stage('scenario','场景应用 · 知识助手缓存边界','清理本项目两枚固定缓存键，分别查询两租户并观察第二次查询命中。',['权限身份由应用注入','版本变化形成新缓存键','Redis 故障不能宣称任务已成功'],['demo_alpha 返回30天，demo_beta 返回15天。','每租户先 miss 后 hit；超过限额时输出限流提示。'],['两个租户内容相同：检查 key 中租户与版本是否完整。','生产回源需做并发合并和降级预算；本例固定数据源仅用于理解缓存边界。'],['RedisSupport'])
  ],
  files:[pom('redis',dep('redis.clients','jedis','5.2.0')),envFile,redisSupport,
    java('ConnectDemo',`package demo;
public class ConnectDemo {
  public static void main(String[] args) {
    try (var jedis = RedisSupport.open()) {
      System.out.println(jedis.ping());
    }
  }
}`),
    java('CoreDemo',`package demo;
import java.util.UUID;
public class CoreDemo {
  public static void main(String[] args) {
    try (var jedis = RedisSupport.open()) {
      String cache = RedisSupport.key("demo_alpha","core:" + UUID.randomUUID());
      jedis.setex(cache,60,"demo answer");
      System.out.println("value=" + jedis.get(cache) + " ttl=" + jedis.ttl(cache));
      String action = "core_" + UUID.randomUUID();
      for (int i=1;i<=4;i++) {
        boolean allowed = RedisSupport.allow(jedis,"demo_alpha",action,3,60);
        System.out.println("request " + i + " allowed=" + allowed);
      }
      // 只清理本次缓存；计数键由 TTL 自动清理。
      jedis.del(cache);
    }
  }
}`),
    java('ScenarioDemo',`package demo;
import java.util.List;
import java.util.UUID;
public class ScenarioDemo {
  public static void main(String[] args) {
    try (var jedis = RedisSupport.open()) {
      String version = "demo_policy_v1";
      String action = "ask_" + UUID.randomUUID();
      for (String tenant : List.of("demo_alpha","demo_beta")) {
        jedis.del(RedisSupport.key(tenant,"cache:policy:" + version));
        for (int i=0;i<3;i++) {
          if (!RedisSupport.allow(jedis,tenant,action,2,60)) {
            System.out.println("tenant=" + tenant + " 已限流，不调用下游"); continue;
          }
          System.out.println(tenant + " -> " + RedisSupport.cachedPolicy(jedis,tenant,version));
        }
      }
      System.out.println("缓存只加速读取；任务结果仍需持久化到账本。");
    }
  }
}`)],
  sources:[{label:'Jedis 官方接入指南',url:'https://redis.io/docs/latest/develop/clients/jedis/'},{label:'Redis EVAL',url:'https://redis.io/docs/latest/commands/eval/'}]
};

const s3Support = java('S3Support', `
package demo;
import software.amazon.awssdk.auth.credentials.*;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.core.sync.RequestBody;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

public final class S3Support {
  private S3Support() {}
  static String bucket() {
    String b = Env.get("DEMO_S3_BUCKET","demo-agent-learning");
    // S3 bucket 名不允许下划线；使用 demo- 桶，所有 Object Key 使用 demo_ 前缀。
    if (!b.startsWith("demo-")) throw new IllegalArgumentException("桶名须以 demo- 开头");
    return b;
  }
  static StaticCredentialsProvider credentials() {
    return StaticCredentialsProvider.create(AwsBasicCredentials.create(
      Env.required("DEMO_S3_ACCESS_KEY"),Env.required("DEMO_S3_SECRET_KEY")));
  }
  static S3Client client() {
    return S3Client.builder().endpointOverride(URI.create(Env.required("DEMO_S3_ENDPOINT")))
      .region(Region.of(Env.get("DEMO_S3_REGION","us-east-1")))
      .credentialsProvider(credentials()).forcePathStyle(true).build();
  }
  static S3Presigner presigner() {
    return S3Presigner.builder().endpointOverride(URI.create(Env.required("DEMO_S3_ENDPOINT")))
      .region(Region.of(Env.get("DEMO_S3_REGION","us-east-1")))
      .credentialsProvider(credentials())
      .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build()).build();
  }
  static String key(String tenant, String name) {
    if (!tenant.matches("[a-zA-Z0-9_-]+") || !name.matches("[a-zA-Z0-9_.-]+"))
      throw new IllegalArgumentException("非法演示对象名称");
    return "demo_agent/" + tenant + "/" + name;
  }
  static String authorizedKey(String authenticatedTenant, String requestedTenant, String name) {
    if (!authenticatedTenant.equals(requestedTenant)) throw new SecurityException("拒绝跨租户下载");
    return key(authenticatedTenant,name);
  }
  static String put(S3Client s3, String key, String text) throws Exception {
    if (!key.startsWith("demo_agent/")) throw new IllegalArgumentException("仅写 demo_agent 前缀");
    byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
    String sha = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    s3.putObject(r -> r.bucket(bucket()).key(key).contentType("text/markdown; charset=utf-8")
      .metadata(java.util.Map.of("sha256",sha)),RequestBody.fromBytes(bytes));
    return sha;
  }
}`);

const objectStorage = {
  id:'object-storage',title:'对象存储：上传、校验与私有下载',
  summary:'使用锁定版本的 AWS SDK v2 访问已有 S3 兼容存储，保存文档和校验摘要，并在鉴权后生成短时下载地址。',
  scenario:'知识助手保留原始文档版本，Java 服务校验租户后向用户交付私有产物；对象 URL 不作为永久公开链接。',
  prerequisites:['JDK 17+、Maven 3.6.3+；AWS SDK for Java 2.30.31。','准备可访问的 S3 兼容服务（例如已有 Ceph RGW）或 S3，预先创建私有 demo-agent-learning 桶；不使用公开读策略。该项目不创建桶、不启动存储服务。','凭据仅需演示桶的 HeadBucket/ListBucket 及 demo_agent/* 的 PutObject、GetObject 权限。下载签名和上传必须使用相同 endpoint 与 region。','所有 Object Key 限定 demo_agent/；S3 桶不能含下划线，故桶名前缀使用 demo-。不删除用户对象；演示文本大小仅几十字节。'],
  environment:[
    {name:'DEMO_S3_ENDPOINT',example:'http://localhost:9000',description:'已有服务的可访问 S3 端点；使用真实 TLS 服务时填 https://，不关闭证书验证。'},
    {name:'DEMO_S3_REGION',example:'us-east-1',description:'必须匹配提供方的签名区域。'},
    {name:'DEMO_S3_BUCKET',example:'demo-agent-learning',description:'已存在的私有学习桶，代码要求 demo- 前缀。'},
    {name:'DEMO_S3_ACCESS_KEY',example:'<学习凭据 Access Key>',description:'仅访问教学桶和前缀。'},
    {name:'DEMO_S3_SECRET_KEY',example:'<学习凭据 Secret Key>',description:'环境注入，程序不打印密钥与签名 URL。'}
  ],
  stages:[
    stage('connect','基础接入 · 确认私有桶可访问','真实调用 HeadBucket，先区分连接、凭据、桶名称与区域错误。',['S3 兼容不代表所有扩展行为一致','凭据与 endpoint 都在环境变量中'],['打印 private demo bucket reachable。'],['403：检查桶权限和签名区域；404：确认桶已经创建。','SignatureDoesNotMatch：检查 region、endpoint、时钟偏移和代理重写，勿靠公开桶绕过。'],['S3Support']),
    stage('core','核心功能 · 上传与读取校验','上传固定教学 Markdown，再读取对象内容和用户元数据，计算 SHA-256 并比对。',['保存原件与内容摘要','ETag 不一定是文件 MD5','读取内容而不只检查 HTTP 成功'],['输出 sha256=... 与 metadataMatch=true、contentMatch=true。'],['兼容服务返回校验和相关错误：核对服务支持的 SDK 请求能力和服务版本。','同名 Key 重跑会覆盖教学对象；生产版本通过明确版本路径或存储版本功能管理。'],['S3Support']),
    stage('scenario','场景应用 · 鉴权后私有下载','上传两个租户的教学资料；先拒绝跨租户请求，再签名当前租户对象并通过 HTTP 下载。',['身份在服务端确定，不能由模型声明','签名有效60秒，不打印 URL','短时链接在有效期内仍应按凭据保护'],['打印跨租户拒绝信息，随后 signed download status=200 与当前租户文档内容。'],['签名地址使用容器内部主机名时，外部客户端可能不可达；endpoint 必须对下载方可访问。','403 也可能是桶策略或签名过期；不要缓存签名地址超过其有效期。'],['S3Support'])
  ],
  files:[pom('object-storage',dep('software.amazon.awssdk','s3','2.30.31')),envFile,s3Support,
    java('ConnectDemo',`package demo;
public class ConnectDemo {
  public static void main(String[] args) {
    try (var s3 = S3Support.client()) {
      s3.headBucket(r -> r.bucket(S3Support.bucket()));
      System.out.println("private demo bucket reachable");
      // HeadBucket 证明访问成功；是否私有必须由桶策略配置保证。
    }
  }
}`),
    java('CoreDemo',`package demo;
public class CoreDemo {
  public static void main(String[] args) throws Exception {
    try (var s3 = S3Support.client()) {
      String key = S3Support.key("demo_alpha","demo_policy_v1.md");
      String content = "# 报销制度 v1\\n差旅返回后30天内提交材料。";
      String sha = S3Support.put(s3,key,content);
      var loaded = s3.getObjectAsBytes(r -> r.bucket(S3Support.bucket()).key(key));
      System.out.println("sha256=" + sha);
      System.out.println("metadataMatch=" + sha.equals(loaded.response().metadata().get("sha256")));
      System.out.println("contentMatch=" + content.equals(loaded.asUtf8String()));
      if (!content.equals(loaded.asUtf8String())) throw new IllegalStateException("内容不匹配");
    }
  }
}`),
    java('ScenarioDemo',`package demo;
import java.net.http.*;
import java.time.Duration;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    String authenticatedTenant = "demo_alpha"; // 真实系统来自登录身份。
    try (var s3 = S3Support.client(); var signer = S3Support.presigner()) {
      S3Support.put(s3,S3Support.key("demo_alpha","demo_report_v1.md"),"alpha：可报销30天内差旅。");
      S3Support.put(s3,S3Support.key("demo_beta","demo_report_v1.md"),"beta：可报销15天内差旅。");
      try {
        S3Support.authorizedKey(authenticatedTenant,"demo_beta","demo_report_v1.md");
        throw new IllegalStateException("权限检查应当拒绝");
      } catch (SecurityException expected) { System.out.println(expected.getMessage()); }
      String key = S3Support.authorizedKey(authenticatedTenant,"demo_alpha","demo_report_v1.md");
      var signed = signer.presignGetObject(r -> r.signatureDuration(Duration.ofSeconds(60))
        .getObjectRequest(g -> g.bucket(S3Support.bucket()).key(key)));
      var http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
      var request = HttpRequest.newBuilder(signed.url().toURI()).timeout(Duration.ofSeconds(10)).GET().build();
      var response = http.send(request,HttpResponse.BodyHandlers.ofString());
      System.out.println("signed download status=" + response.statusCode());
      if (response.statusCode() != 200) throw new IllegalStateException("私有下载失败，请检查权限与签名");
      System.out.println(response.body());
    }
  }
}`)],
  sources:[{label:'AWS SDK Java：预签名 URL',url:'https://docs.aws.amazon.com/sdk-for-java/latest/developer-guide/examples-s3-presign.html'},{label:'AWS S3Client API',url:'https://sdk.amazonaws.com/java/api/latest/software/amazon/awssdk/services/s3/S3Client.html'}]
};

const mongoSupport = java('MongoSupport', `
package demo;
import com.mongodb.client.*;
import com.mongodb.client.model.*;
import org.bson.Document;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;
import static com.mongodb.client.model.Filters.*;

public final class MongoSupport {
  private MongoSupport() {}
  static MongoClient open() {
    return MongoClients.create(Env.get("DEMO_MONGO_URI",
      "mongodb://localhost:27017/?serverSelectionTimeoutMS=5000&connectTimeoutMS=5000"));
  }
  static MongoCollection<Document> messages(MongoClient client) {
    return client.getDatabase("demo_agent").getCollection("demo_messages");
  }
  static void schema(MongoClient client) {
    var c = messages(client);
    c.createIndex(Indexes.compoundIndex(Indexes.ascending("tenant_id"),
      Indexes.ascending("session_id"),Indexes.ascending("created_at")));
    c.createIndex(Indexes.ascending("expire_at"),
      new IndexOptions().name("demo_expire_at_ttl").expireAfter(0L,TimeUnit.SECONDS));
  }
  static void put(MongoClient client, String tenant, String session, String turn,
                  String role, String content, Instant created, Instant expire) {
    if (!tenant.startsWith("demo_") || !session.startsWith("demo_"))
      throw new IllegalArgumentException("仅允许演示租户和会话");
    if (!Set.of("user","assistant").contains(role)) throw new IllegalArgumentException("非法角色");
    String id = tenant + ":" + session + ":" + turn;
    var doc = new Document("_id",id).append("tenant_id",tenant)
      .append("session_id",session).append("turn_id",turn).append("role",role)
      .append("content",content).append("created_at",Date.from(created))
      .append("expire_at",Date.from(expire)).append("schema_version",1);
    messages(client).replaceOne(and(eq("_id",id),eq("tenant_id",tenant)),doc,new ReplaceOptions().upsert(true));
  }
  static List<Document> history(MongoClient client, String tenant, String session) {
    // TTL 清理异步；逻辑查询也排除已过期文档。
    return messages(client).find(and(eq("tenant_id",tenant),eq("session_id",session),
        gt("expire_at",new Date())))
      .sort(Sorts.ascending("created_at","_id")).limit(20).into(new ArrayList<>());
  }
  static void print(List<Document> history) {
    for (var d : history) System.out.println(d.getString("role") + ": " + d.getString("content"));
  }
}`);

const mongodb = {
  id:'mongodb',title:'MongoDB：会话查询、版本与 TTL',
  summary:'真实写入独立消息文档，按租户与会话检索，创建 TTL 索引并在读取时立即排除已过期数据。',
  scenario:'知识助手保留短期会话历史；同名 session_id 不能跨租户混读，过期上下文即使尚未物理删除也不能进入模型。',
  prerequisites:['JDK 17+、Maven 3.6.3+；MongoDB Java Sync Driver 5.3.1。','MongoDB 7.0 或 8.0 已可访问；账号拥有 demo_agent 数据库的读写与创建索引权限。示例仅操作 demo_messages 集合。','TTL 后台清理是异步的，不承诺到点立即删除。此例没有跨文档事务，因此单机 MongoDB 也可学习。'],
  environment:[{name:'DEMO_MONGO_URI',example:'mongodb://localhost:27017/?serverSelectionTimeoutMS=5000&connectTimeoutMS=5000',description:'有认证时配置用户、密码和正确 authSource；不把 URI 输出到日志。数据库固定为 demo_agent。'}],
  stages:[
    stage('connect','基础接入 · Ping 与集合准备','运行 ping 并建立复合索引和 TTL 索引。',['MongoClient 生命周期','集合仅限 demo_agent.demo_messages'],['输出 {ok:1} 与 demo indexes ready。'],['Server selection timeout：检查地址、端口和副本集对外公布的主机名。','Authentication failed：核对 authSource 与学习账号授权。'],['MongoSupport']),
    stage('core','核心功能 · Upsert 与 TTL','对相同消息 ID 重复写入，再读取指定会话；打印 TTL 索引定义。',['稳定 _id 实现重复写入覆盖','Date 类型 expire_at','TTL 单字段索引'],['同一消息重复写后 history size=1。','索引定义包含 expireAfterSeconds:0。'],['IndexOptionsConflict：学习集合已有同名但不同 TTL 的索引；核对后由管理员修正教学索引。','expire_at 是字符串时不会按预期过期，必须存 BSON Date。'],['MongoSupport']),
    stage('scenario','场景应用 · 隔离上下文与过期过滤','写入两个租户的同名会话和一条过期消息；只读取当前租户有效历史。',['登录租户来自应用','排除过期消息不等待后台删除','聊天记忆不是任务账本'],['输出 demo_alpha 的 user 和 assistant 两条消息。','不出现 demo_beta 的内部内容，也不出现 expired 内容。'],['看到别的租户内容：检查所有读取路径的 tenant_id 条件。','消息数异常：检查 created_at/expire_at 时钟与旧运行数据；示例固定主键会替换对应教学记录。'],['MongoSupport'])
  ],
  files:[pom('mongodb',dep('org.mongodb','mongodb-driver-sync','5.3.1')),envFile,mongoSupport,
    java('ConnectDemo',`package demo;
import org.bson.Document;
public class ConnectDemo {
  public static void main(String[] args) {
    try (var client = MongoSupport.open()) {
      System.out.println(client.getDatabase("demo_agent").runCommand(new Document("ping",1)).toJson());
      MongoSupport.schema(client);
      System.out.println("demo indexes ready");
    }
  }
}`),
    java('CoreDemo',`package demo;
import java.time.Instant;
public class CoreDemo {
  public static void main(String[] args) {
    try (var client = MongoSupport.open()) {
      MongoSupport.schema(client);
      Instant now = Instant.now();
      for (int i=0;i<2;i++) MongoSupport.put(client,"demo_core","demo_session","turn_1",
        "user","解释一下向量检索",now,now.plusSeconds(600));
      var rows = MongoSupport.history(client,"demo_core","demo_session");
      System.out.println("history size=" + rows.size()); MongoSupport.print(rows);
      for (var index : MongoSupport.messages(client).listIndexes()) System.out.println(index.toJson());
    }
  }
}`),
    java('ScenarioDemo',`package demo;
import java.time.Instant;
public class ScenarioDemo {
  public static void main(String[] args) {
    try (var client = MongoSupport.open()) {
      MongoSupport.schema(client); Instant now = Instant.now();
      String session = "demo_knowledge_001";
      MongoSupport.put(client,"demo_alpha",session,"1","user","报销何时提交？",now,now.plusSeconds(600));
      MongoSupport.put(client,"demo_alpha",session,"2","assistant","根据制度v1，30天内提交。",now.plusMillis(1),now.plusSeconds(600));
      MongoSupport.put(client,"demo_beta",session,"1","user","beta内部预算信息",now,now.plusSeconds(600));
      MongoSupport.put(client,"demo_alpha",session,"expired","user","expired旧上下文",now.minusSeconds(60),now.minusSeconds(1));
      var history = MongoSupport.history(client,"demo_alpha",session);
      MongoSupport.print(history);
      if (history.size() != 2) throw new IllegalStateException("预期当前租户有效消息为2条");
      System.out.println("这只是会话上下文，退款等业务结果仍写入事务账本。");
    }
  }
}`)],
  sources:[{label:'MongoDB Java Sync Driver',url:'https://www.mongodb.com/docs/drivers/java/sync/current/'},{label:'MongoDB TTL 索引',url:'https://www.mongodb.com/docs/manual/core/index-ttl/'}]
};

const graphSupport = java('GraphSupport', `
package demo;
import org.neo4j.driver.*;
import java.util.*;
import java.util.concurrent.TimeUnit;

public final class GraphSupport {
  private GraphSupport() {}
  static Driver open() {
    return GraphDatabase.driver(Env.get("DEMO_NEO4J_URI","bolt://localhost:7687"),
      AuthTokens.basic(Env.required("DEMO_NEO4J_USER"),Env.required("DEMO_NEO4J_PASSWORD")),
      Config.builder().withConnectionTimeout(5,TimeUnit.SECONDS).build());
  }
  static Session session(Driver driver) {
    return driver.session(SessionConfig.builder().withDatabase(Env.get("DEMO_NEO4J_DATABASE","neo4j")).build());
  }
  static void schema(Session s) {
    s.run("CREATE CONSTRAINT demo_service_unique IF NOT EXISTS " +
      "FOR (s:demo_Service) REQUIRE (s.tenant_id,s.id) IS UNIQUE").consume();
  }
  static void upsert(Session s, String tenant, String id, String name) {
    if (!tenant.startsWith("demo_") || !id.startsWith("demo_"))
      throw new IllegalArgumentException("只允许 demo_ 节点");
    s.executeWrite(tx -> {
      tx.run("MERGE (s:demo_Service {tenant_id:$tenant,id:$id}) SET s.name=$name",
        Map.of("tenant",tenant,"id",id,"name",name)).consume(); return null;
    });
  }
  static void seed(Session s) {
    upsert(s,"demo_alpha","demo_orders","订单服务");
    upsert(s,"demo_alpha","demo_cache","共享缓存");
    upsert(s,"demo_alpha","demo_billing","账单服务");
    upsert(s,"demo_beta","demo_private","另一租户内部服务");
    var edges = List.of(
      Map.of("from","demo_orders","to","demo_cache","toTenant","demo_alpha"),
      Map.of("from","demo_orders","to","demo_billing","toTenant","demo_alpha"),
      Map.of("from","demo_billing","to","demo_private","toTenant","demo_beta"));
    // 故意种一条跨租户演示边，用于证明路径中每个节点都需要权限过滤。
    s.executeWrite(tx -> {
      tx.run("UNWIND $edges AS e " +
        "MATCH (a:demo_Service {tenant_id:$tenant,id:e.from}) " +
        "MATCH (b:demo_Service {tenant_id:e.toTenant,id:e.to}) " +
        "MERGE (a)-[r:demo_DEPENDS_ON]->(b) " +
        "SET r.tenant_id=$tenant,r.active=true,r.source='demo_cmdb_v1'",
        Map.of("tenant","demo_alpha","edges",edges)).consume(); return null;
    });
  }
  static List<Map<String,Object>> dependencies(Session s, String tenant, String id) {
    return s.executeRead(tx -> tx.run(
      "MATCH p=(s:demo_Service {tenant_id:$tenant,id:$id})-[:demo_DEPENDS_ON*1..2]->(d:demo_Service) " +
      "WHERE all(n IN nodes(p) WHERE n.tenant_id=$tenant) " +
      "AND all(r IN relationships(p) WHERE r.tenant_id=$tenant AND r.active=true) " +
      "RETURN DISTINCT d.id AS id,d.name AS name,length(p) AS hops ORDER BY hops,id LIMIT 20",
      Map.of("tenant",tenant,"id",id)).list(record -> record.asMap()));
  }
}`);

const neo4j = {
  id:'neo4j',title:'Neo4j：受控图遍历与来源边界',
  summary:'通过真实 Neo4j Java Driver 建立教学服务依赖图，使用参数化 Cypher 查询两跳依赖，并过滤路径中的全部节点和关系。',
  scenario:'运维 Agent 回答订单服务依赖哪些组件，只能访问当前租户的服务图，不能因中间节点连接而泄漏其他租户信息。',
  prerequisites:['JDK 17+、Maven 3.6.3+；Neo4j Java Driver 5.26.0，建议已有 Neo4j 5.26 LTS 学习实例。','账号需在选定数据库创建 demo_Service 节点、demo_DEPENDS_ON 关系和 demo_service_unique 约束，并具备读取权限。只使用这些教学标签、关系和约束。','先运行 connect/core 或让 scenario 自动建约束；代码不删除任何现有节点。图的演示租户来自固定可信变量，实际应用必须从登录身份注入。'],
  environment:[
    {name:'DEMO_NEO4J_URI',example:'bolt://localhost:7687',description:'学习实例 Bolt 地址；集群按实际路由与 TLS 要求配置 neo4j(s)://。'},
    {name:'DEMO_NEO4J_USER',example:'demo_user',description:'教学账号；只授予所需数据库权限。'},
    {name:'DEMO_NEO4J_PASSWORD',example:'<学习账号密码>',description:'环境注入，不写入 URI 或日志。'},
    {name:'DEMO_NEO4J_DATABASE',example:'neo4j',description:'实例中已存在的数据库；所有变更仍限定 demo_ 标签。'}
  ],
  stages:[
    stage('connect','基础接入 · 驱动与约束','验证连接，创建复合唯一约束，查询服务器是否可以执行 Cypher。',['Driver 长期复用、Session 短期使用','参数化查询与复合业务 ID'],['输出 connected=true 与 ping=1。'],['Unauthorized：检查用户与密码；DatabaseNotFound：检查数据库名称。','创建约束被拒绝：请管理员只为教学标签建立相同约束，再使用最小权限账号。'],['GraphSupport']),
    stage('core','核心功能 · MERGE 与租户业务键','同一租户、同一服务 ID 写两次，查询并确认只有一个节点。',['MERGE 的标识要有唯一约束','写事务函数可能重试，内部只做幂等数据库操作'],['输出 count=1。'],['ConstraintValidationFailed：已有教学节点重复，需要管理员核对重复数据，不能绕过约束继续。','不要在 executeWrite 回调里发邮件或调用支付；驱动可能重试回调。'],['GraphSupport']),
    stage('scenario','场景应用 · 两跳依赖与权限','种入教学图及一条跨租户边，查询时对整条路径过滤，避免只检查起点。',['限制关系类型与最大跳数','所有节点与边都进行租户过滤','图关系来自教学 CMDB，不代表模型抽取事实'],['仅返回 demo_cache 和 demo_billing，依赖数量为2。','不输出 demo_private；跨租户边不能进入答案上下文。'],['结果意外扩大：检查是否遗漏中间节点或关系权限、是否放开了跳数。','无结果：核对边方向、tenant_id 和 active 字段，不要先换模型。'],['GraphSupport'])
  ],
  files:[pom('neo4j',dep('org.neo4j.driver','neo4j-java-driver','5.26.0')),envFile,graphSupport,
    java('ConnectDemo',`package demo;
public class ConnectDemo {
  public static void main(String[] args) {
    try (var driver = GraphSupport.open()) {
      driver.verifyConnectivity(); System.out.println("connected=true");
      try (var session = GraphSupport.session(driver)) {
        GraphSupport.schema(session);
        System.out.println("ping=" + session.run("RETURN 1 AS ping").single().get("ping").asInt());
      }
    }
  }
}`),
    java('CoreDemo',`package demo;
import java.util.Map;
public class CoreDemo {
  public static void main(String[] args) {
    try (var driver = GraphSupport.open(); var session = GraphSupport.session(driver)) {
      GraphSupport.schema(session);
      for (int i=0;i<2;i++) GraphSupport.upsert(session,"demo_core","demo_search","知识检索服务");
      long count = session.executeRead(tx -> tx.run(
        "MATCH (s:demo_Service {tenant_id:$tenant,id:$id}) RETURN count(s) AS n",
        Map.of("tenant","demo_core","id","demo_search")).single().get("n").asLong());
      System.out.println("count=" + count);
      if (count != 1) throw new IllegalStateException("业务主键应唯一");
    }
  }
}`),
    java('ScenarioDemo',`package demo;
public class ScenarioDemo {
  public static void main(String[] args) {
    String authenticatedTenant = "demo_alpha";
    try (var driver = GraphSupport.open(); var session = GraphSupport.session(driver)) {
      GraphSupport.schema(session); GraphSupport.seed(session);
      var rows = GraphSupport.dependencies(session,authenticatedTenant,"demo_orders");
      rows.forEach(System.out::println);
      if (rows.size() != 2 || rows.stream().anyMatch(r -> "demo_private".equals(r.get("id"))))
        throw new IllegalStateException("权限或演示图结构不符合预期");
      System.out.println("允许进入 Agent 上下文的依赖数量=" + rows.size());
    }
  }
}`)],
  sources:[{label:'Neo4j Java 事务函数',url:'https://neo4j.com/docs/java-manual/current/transactions/'},{label:'Neo4j Cypher 变长路径',url:'https://neo4j.com/docs/cypher-manual/current/patterns/variable-length-patterns/'}]
};

const clickSupport = java('ClickSupport', `
package demo;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;

public final class ClickSupport {
  static final ObjectMapper JSON = new ObjectMapper();
  static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
  private ClickSupport() {}
  static String sql(String sql, Map<String,String> params) throws Exception {
    String base = Env.get("DEMO_CLICKHOUSE_URL","http://localhost:8123").replaceAll("/+$","");
    StringBuilder url = new StringBuilder(base).append("/?wait_end_of_query=1");
    for (var e : params.entrySet()) url.append("&param_").append(e.getKey()).append("=")
      .append(URLEncoder.encode(e.getValue(),StandardCharsets.UTF_8));
    var request = HttpRequest.newBuilder(URI.create(url.toString())).timeout(Duration.ofSeconds(20))
      .header("X-ClickHouse-User",Env.get("DEMO_CLICKHOUSE_USER","default"))
      .header("X-ClickHouse-Key",Env.required("DEMO_CLICKHOUSE_PASSWORD"))
      .header("Content-Type","text/plain; charset=utf-8")
      .POST(HttpRequest.BodyPublishers.ofString(sql)).build();
    var response = HTTP.send(request,HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() / 100 != 2) throw new IllegalStateException(
      "ClickHouse HTTP " + response.statusCode() + ": " + response.body().substring(0,Math.min(400,response.body().length())));
    return response.body();
  }
  static void schema() throws Exception {
    sql("CREATE TABLE IF NOT EXISTS default.demo_agent_usage (" +
      "event_id String, batch_id String, tenant_id String, model LowCardinality(String), " +
      "input_tokens UInt32, output_tokens UInt32, duration_ms UInt32, " +
      "event_time DateTime DEFAULT now()) " +
      "ENGINE=MergeTree ORDER BY (tenant_id,event_time,batch_id,event_id)",Map.of());
  }
  static Map<String,Object> event(String batch, String tenant, String id, String model,
                                   int input, int output, int duration) {
    return Map.of("event_id",id,"batch_id",batch,"tenant_id",tenant,"model",model,
      "input_tokens",input,"output_tokens",output,"duration_ms",duration);
  }
  static void insert(List<Map<String,Object>> events) throws Exception {
    StringBuilder body = new StringBuilder("INSERT INTO default.demo_agent_usage FORMAT JSONEachRow\\n");
    for (var event : events) body.append(JSON.writeValueAsString(event)).append('\\n');
    // 一个 HTTP 请求批量写入；超时结果不确定，本例不会自动重试。
    sql(body.toString(),Map.of());
  }
  static String usage(String tenant, String batch) throws Exception {
    return sql("SELECT model,count() AS calls,sum(input_tokens) AS input_tokens," +
      "sum(output_tokens) AS output_tokens,quantile(0.95)(duration_ms) AS p95_ms " +
      "FROM default.demo_agent_usage WHERE tenant_id={tenant:String} AND batch_id={batch:String} " +
      "GROUP BY model ORDER BY model FORMAT JSONEachRow",Map.of("tenant",tenant,"batch",batch));
  }
}`);

const clickhouse = {
  id:'clickhouse',title:'ClickHouse：批量调用事件与用量分析',
  summary:'使用 Java 17 HttpClient 和参数化 HTTP 查询接入 ClickHouse，将模型调用事件批量写入 MergeTree，再按租户和批次聚合 Token 与延迟。',
  scenario:'分析知识助手的模型使用量，严格区分调用事件与任务成功。用独立演示批次避免历史运行影响本次结果。',
  prerequisites:['JDK 17+、Maven 3.6.3+；仅依赖 Jackson 2.18.2，HTTP 客户端来自 JDK。','准备 ClickHouse 24.8+ 学习实例的 HTTP 端口（通常8123，TLS可为8443）；账号能在 default 库创建、写入和读取 demo_agent_usage。','只操作 default.demo_agent_usage。学习账号必须设置密码，项目不使用空密码自动登录；HTTPS 远端服务保持正常证书验证。','MergeTree 排序键不保证唯一，本例不自动重试未知结果的 INSERT；每次场景使用新 batch_id，并只查询本批数据。真实重复事件需另建去重与对账策略。'],
  environment:[
    {name:'DEMO_CLICKHOUSE_URL',example:'http://localhost:8123',description:'HTTP 服务入口，不是原生 TCP 9000端口；不包含查询参数。'},
    {name:'DEMO_CLICKHOUSE_USER',example:'demo_user',description:'仅有教学表所需权限的账号。'},
    {name:'DEMO_CLICKHOUSE_PASSWORD',example:'<学习账号密码>',description:'通过请求头传递，不放在 URL 中。'}
  ],
  stages:[
    stage('connect','基础接入 · HTTP 与版本查询','发送 SELECT version()，确认 HTTP 入口与认证，再建教学 MergeTree 表。',['HTTP端口与原生协议端口不同','检查非2xx响应','只使用固定教学表名'],['输出 ClickHouse 版本和 demo table ready。'],['连接9000报错：改用 HTTP 8123或配置的TLS端口。','401/403/516：检查学习账号与密码；表权限不足需管理员授权。'],['ClickSupport']),
    stage('core','核心功能 · JSONEachRow 批量写入','一次请求插入两条调用事件，按 UUID 批次统计。',['批量写入降低小数据片段开销','参数化查询避免拼接租户值','ORDER BY不等于唯一约束'],['当前批次 calls=2，input_tokens=300，output_tokens=70。'],['UNKNOWN_TABLE：先运行 connect或检查 default库权限；代码也会自动建表。','写入超时不能直接判断未写入，先按 batch_id核对再决定如何补发。'],['ClickSupport']),
    stage('scenario','场景应用 · 多租户用量隔离','批量写入两个租户的模拟模型调用，只聚合当前租户本次批次，按模型显示调用量、Token与P95。',['供应商usage与本地估算应区分','调用成功不等于业务任务成功','tenant与batch均参数绑定'],['demo_alpha 的 model-a 有2次调用、input=800、output=150。','model-b 有1次调用、input=200、output=40；另一租户9999 Token不会计入。'],['成本偏高：先查重复采集、重试和口径，不能把调用数量直接当用户任务数。','P95为近似聚合，三条教学数据仅用于理解SQL，不代表稳定性能结论。'],['ClickSupport'])
  ],
  files:[pom('clickhouse',dep('com.fasterxml.jackson.core','jackson-databind','2.18.2')),envFile,clickSupport,
    java('ConnectDemo',`package demo;
import java.util.Map;
public class ConnectDemo {
  public static void main(String[] args) throws Exception {
    System.out.println(ClickSupport.sql("SELECT version() FORMAT TabSeparated",Map.of()));
    ClickSupport.schema();
    System.out.println("demo table ready");
  }
}`),
    java('CoreDemo',`package demo;
import java.util.*;
public class CoreDemo {
  public static void main(String[] args) throws Exception {
    ClickSupport.schema(); String batch = "demo_" + UUID.randomUUID();
    ClickSupport.insert(List.of(
      ClickSupport.event(batch,"demo_core","demo_e1","model-a",100,30,800),
      ClickSupport.event(batch,"demo_core","demo_e2","model-a",200,40,1200)));
    System.out.println("batch=" + batch);
    System.out.println(ClickSupport.usage("demo_core",batch));
  }
}`),
    java('ScenarioDemo',`package demo;
import java.util.*;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    ClickSupport.schema(); String batch = "demo_" + UUID.randomUUID();
    // 固定 usage 模拟模型返回的计数；本项目不调用模型，也不推算实时价格。
    ClickSupport.insert(List.of(
      ClickSupport.event(batch,"demo_alpha","demo_call_1","model-a",300,50,1000),
      ClickSupport.event(batch,"demo_alpha","demo_call_2","model-a",500,100,1600),
      ClickSupport.event(batch,"demo_alpha","demo_call_3","model-b",200,40,700),
      ClickSupport.event(batch,"demo_beta","demo_call_4","model-a",9999,999,1800)));
    String authenticatedTenant = "demo_alpha";
    System.out.println("batch=" + batch);
    System.out.println(ClickSupport.usage(authenticatedTenant,batch));
    System.out.println("任务成功率应关联任务最终状态，不能从本调用表直接推出。");
  }
}`)],
  sources:[{label:'ClickHouse HTTP接口与参数化查询',url:'https://clickhouse.com/docs/interfaces/http'},{label:'ClickHouse MergeTree',url:'https://clickhouse.com/docs/engines/table-engines/mergetree-family/mergetree'}]
};

export const storageDemos = [postgres, mysql, redis, objectStorage, mongodb, neo4j, clickhouse];
