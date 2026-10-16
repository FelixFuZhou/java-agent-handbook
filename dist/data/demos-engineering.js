import { file, java, pom, dep, envFile, run } from './demo-kit.js';

const gatewayClient = java('Gateway', `
package demo;
import com.fasterxml.jackson.databind.*;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;

public final class Gateway {
  static final ObjectMapper JSON = new ObjectMapper();
  static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
  static HttpRequest request(String model, String question, String requestId) throws Exception {
    String base = Env.required("AI_GATEWAY_URL").replaceAll("/+$", "");
    String body = JSON.writeValueAsString(Map.of("model", model, "stream", false,
      "max_tokens", 256, "messages", List.of(Map.of("role", "user", "content", question))));
    return HttpRequest.newBuilder(URI.create(base + "/v1/chat/completions"))
      .timeout(Duration.ofSeconds(20)).header("Content-Type", "application/json")
      .header("Authorization", "Bearer " + Env.required("AI_GATEWAY_KEY"))
      .header("X-Request-Id", requestId).POST(HttpRequest.BodyPublishers.ofString(body)).build();
  }
  static HttpResponse<String> send(String model, String question, String id) throws Exception {
    return HTTP.send(request(model, question, id), HttpResponse.BodyHandlers.ofString());
  }
  static String answer(HttpResponse<String> response) throws Exception {
    if (response.statusCode() / 100 != 2)
      throw new IllegalStateException("gateway HTTP " + response.statusCode());
    JsonNode root = JSON.readTree(response.body());
    String answer = root.path("choices").path(0).path("message").path("content").asText();
    if (answer.isBlank()) throw new IllegalStateException("没有文本回答，请检查模型/协议/finish_reason");
    System.out.println("usage=" + root.path("usage"));
    return answer;
  }
}`);

const gateway = {
  id:'ai-gateway',title:'AI 网关：统一调用、错误分类与降级',
  summary:'用 JDK HttpClient 接入已配置好的 Higress 路由，观察模型代理的响应，再给知识助手增加有限的降级策略。',
  scenario:'知识助手调用主模型失败时，按明确的错误类型切换备用路由，记录同一个请求标识。',
  prerequisites:['JDK 17+、Maven 3.6.3+；依赖 Jackson 2.18.2。','准备已有 Higress AI 网关及可用模型供应商凭据。在控制台“AI 服务提供者”配置凭据，再在“AI 路由”映射主模型和备用模型。','为网关入口配置认证，AI_GATEWAY_KEY 填入口调用凭据，供应商 Key 留在网关；URL 指向网关，不是本站。例子使用非流式文本生成。'],
  environment:[{name:'AI_GATEWAY_URL',example:'http://localhost:9080',description:'网关地址，不包含 /v1；按实际监听端口修改。'},{name:'AI_GATEWAY_KEY',example:'<网关颁发的调用凭据>',description:'经认证的应用凭据；不用供应商 Key 代替。'},{name:'AI_MODEL',example:'qwen-plus',description:'已在网关配置的主模型名或别名。'},{name:'AI_FALLBACK_MODEL',example:'deepseek-chat',description:'已配置的备用模型路由，输出与成本可能不同。'}],
  stages:[
    {id:'connect',title:'基础接入 · 发起一次模型请求',description:'入口 URL 和模型名都可配置；解析 choices 和 usage，先确认网关实际转发成功。',focus:['模型名必须与网关路由匹配','设置连接/请求超时，检查 HTTP 状态'],commands:[run('ConnectDemo')],expected:['打印 token usage 和模型回答；内容由远端模型决定。'],troubleshooting:['401/403 先查网关入口认证和应用权限；404 查路由前缀及模型映射。'],files:['src/main/java/demo/ConnectDemo.java','src/main/java/demo/Gateway.java','pom.xml']},
    {id:'core',title:'核心功能 · 观察限流与响应标识',description:'分类 429、鉴权错误与服务端错误。网关负责共享配额；Java 调用方把错误变成可操作的信息。',focus:['读取 Retry-After，不把 429 当成功','不记录 Key 和完整用户提示词'],commands:[run('CoreDemo')],expected:['打印 HTTP 状态、Retry-After（未限流时通常为空）和网关响应标识。','可在控制台给演示应用设置很小的请求配额后重跑，观察 429；代码本身不会制造流量洪峰。'],troubleshooting:['没有 429 不代表配额已配置，核对插件作用域；不同网关的请求标识头可能不同。'],files:['src/main/java/demo/CoreDemo.java','src/main/java/demo/Gateway.java']},
    {id:'scenario',title:'场景应用 · 知识助手有限降级',description:'仅遇到明确的 502/503/504 HTTP 响应时切备用路由一次。超时和连接中断结果不确定，向上层暴露，不盲目重放。',focus:['同一 requestId 串起两次模型调用','最多一次备用调用；网关若已做 fallback，应用层应关闭重复策略','模型降级不重做检索、不执行退款等业务副作用'],commands:[run('ScenarioDemo')],expected:['正常情况下打印主模型回答；主路由返回 502/503/504 时打印 fallback，再调用备用路由。'],troubleshooting:['两个模型必须都配置可访问；429 应按配额策略处理，此处不会绕过限流。','这是代理调用示例，输入知识片段是固定演示数据；真实知识助手从有权限的检索结果构造上下文。'],files:['src/main/java/demo/ScenarioDemo.java','src/main/java/demo/Gateway.java']}
  ],
  files:[pom('ai-gateway',dep('com.fasterxml.jackson.core','jackson-databind','2.18.2')),envFile,gatewayClient,
    java('ConnectDemo',`package demo;
import java.util.UUID;
public class ConnectDemo {
  public static void main(String[] args) throws Exception {
    var response = Gateway.send(Env.get("AI_MODEL", "qwen-plus"),
      "用一句话解释检索增强生成。", UUID.randomUUID().toString());
    System.out.println(Gateway.answer(response));
  }
}`),
    java('CoreDemo',`package demo;
import java.util.UUID;
public class CoreDemo {
  public static void main(String[] args) throws Exception {
    var response = Gateway.send(Env.get("AI_MODEL", "qwen-plus"), "只回答：连接成功", UUID.randomUUID().toString());
    System.out.println("status=" + response.statusCode());
    System.out.println("retry-after=" + response.headers().firstValue("retry-after").orElse("none"));
    System.out.println("upstream-request-id=" + response.headers().firstValue("x-request-id").orElse("not exposed"));
    if (response.statusCode() == 429) System.out.println("达到配额，向用户返回稍后重试，不启动无限重试。");
    else if (response.statusCode() == 401 || response.statusCode() == 403)
      throw new IllegalStateException("检查入口凭据/应用权限，重试不能修复鉴权错误。");
    else System.out.println(Gateway.answer(response));
  }
}`),
    java('ScenarioDemo',`package demo;
import java.util.Set;
import java.util.UUID;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    String id = UUID.randomUUID().toString();
    // 此处固定片段模拟已完成权限过滤的检索结果；不是从模型猜测企业制度。
    String prompt = "仅根据以下资料回答并引用文档编号。资料：[policy-01] 差旅报销需在返回后30天内提交。问题：什么时候提交报销？";
    String model = Env.get("AI_MODEL", "qwen-plus");
    var response = Gateway.send(model, prompt, id);
    if (Set.of(502, 503, 504).contains(response.statusCode())) {
      model = Env.required("AI_FALLBACK_MODEL");
      System.out.println("requestId=" + id + " fallback=" + model);
      response = Gateway.send(model, prompt, id);
    }
    System.out.println("requestId=" + id + " model=" + model);
    System.out.println(Gateway.answer(response));
  }
}`)],
  sources:[{label:'Higress 多模型代理与路由配置',url:'https://higress.io/docs/ai/scene-guide/multi-proxy/'},{label:'JDK HttpClient',url:'https://docs.oracle.com/en/java/javase/17/docs/api/java.net.http/java/net/http/HttpClient.html'}]
};

const containerRunner = java('ContainerRunner',`
package demo;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.TimeUnit;

public final class ContainerRunner {
  public record Result(int exitCode, String output) {}
  public static Result python(String code, String input, Duration timeout) throws Exception {
    // 不允许模型提供镜像、挂载或 docker 参数；使用参数数组，避免 host shell 拼接。
    String name = "demo-sandbox-" + UUID.randomUUID();
    List<String> command = new ArrayList<>(List.of("docker", "run", "--rm", "-i", "--pull=never",
      "--name", name, "--network=none", "--read-only", "--cap-drop=ALL",
      "--security-opt=no-new-privileges", "--pids-limit=64", "--memory=128m",
      "--memory-swap=128m", "--cpus=0.5", "--user=65534:65534",
      "--tmpfs=/tmp:rw,noexec,nosuid,size=16m", Env.get("SANDBOX_IMAGE", "python:3.12-slim"),
      "python", "-c", code));
    Process process = new ProcessBuilder(command).redirectErrorStream(true).start();
    ByteArrayOutputStream capture = new ByteArrayOutputStream();
    Thread reader = new Thread(() -> {
      try (InputStream stream = process.getInputStream()) {
        byte[] buffer = new byte[4096]; int n;
        while ((n = stream.read(buffer)) != -1) {
          int remaining = 65536 - capture.size();
          if (remaining > 0) capture.write(buffer, 0, Math.min(n, remaining));
          // 超出 64 KiB 继续排空，但不继续占用内存。
        }
      } catch (IOException ignored) { }
    }, "sandbox-output");
    reader.setDaemon(true); reader.start();
    try {
      try (var stdin = process.getOutputStream()) { stdin.write(input.getBytes(StandardCharsets.UTF_8)); }
      if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS))
        throw new IllegalStateException("任务超时，回收容器 " + name);
      reader.join(2000);
      return new Result(process.exitValue(), capture.toString(StandardCharsets.UTF_8));
    } finally {
      // 销毁客户端进程并不能保证容器已结束，因此按唯一名称显式回收。
      Process cleanup = new ProcessBuilder("docker", "rm", "-f", name)
        .redirectOutput(ProcessBuilder.Redirect.DISCARD).redirectError(ProcessBuilder.Redirect.DISCARD).start();
      if (!cleanup.waitFor(5, TimeUnit.SECONDS)) cleanup.destroyForcibly();
      if (process.isAlive()) process.destroyForcibly();
      reader.join(2000);
    }
  }
}`);
const sandbox={
  id:'sandbox',title:'执行沙箱：受限容器、超时与结果回收',summary:'以本地 Docker 作为隔离入门后端，Java 控制进程、资源、超时和输出。代码只执行本页的固定演示程序。',scenario:'研究 Agent 把一小份 CSV 交给独立进程汇总，拿到 JSON 结果后继续生成报告。',
  prerequisites:['JDK 17+、Maven 3.6.3+；Docker Engine 或 Desktop 已启动，当前用户有 CLI 使用权限。','先运行 docker pull python:3.12-slim，示例使用 --pull=never 防止任务中途下载镜像；生产固定镜像 digest。','这是单机隔离机制教学。Docker 共享宿主机内核，不足以直接承载敌对多租户代码；实际开放执行应选择专门沙箱服务并增加访问策略。'],
  environment:[{name:'SANDBOX_IMAGE',example:'python:3.12-slim',description:'管理员预置的 Python 镜像；不能让模型任意修改此配置。'}],
  stages:[
    {id:'connect',title:'基础接入 · Java 启动并回收容器',description:'读取 stdout 和退出码，并在 finally 回收唯一名称的任务容器。',focus:['ProcessBuilder 参数数组','stdout 与退出码都是执行结果的一部分'],commands:['docker pull python:3.12-slim',run('ConnectDemo')],expected:['exit=0，输出 sandbox ready。'],troubleshooting:['Cannot connect to Docker daemon：启动 Docker；镜像不存在：先 pull；当前用户无权限：检查 Docker CLI 的运行身份。'],files:['src/main/java/demo/ConnectDemo.java','src/main/java/demo/ContainerRunner.java','pom.xml']},
    {id:'core',title:'核心功能 · 隔离限制与硬超时',description:'尝试写只读根目录，再执行一个超时任务，观察失败被限制在容器内。',focus:['只读根目录、非 root、禁网与资源配额','超时后 rm -f，不只关闭 Java 侧进程','输出最多保留 64 KiB'],commands:[run('CoreDemo')],expected:['写 /blocked.txt 失败，exit 非 0；休眠任务约 2 秒后抛出超时并被回收。'],troubleshooting:['两次非成功是预期演示；若容器仍存在，运行 docker ps -a 检查对应 demo-sandbox 名称和 daemon 日志。'],files:['src/main/java/demo/CoreDemo.java','src/main/java/demo/ContainerRunner.java']},
    {id:'scenario',title:'场景应用 · CSV 分析工具',description:'通过 stdin 传 CSV，受限 Python 只计算总额，Java 对 JSON schema 和业务结果进行校验。',focus:['不挂载宿主机目录和 Docker socket','不用 shell 拼接业务数据','先校验 exitCode，再解析工具输出'],commands:[run('ScenarioDemo')],expected:['输出 {rows:3,total:650}，并打印“研究 Agent 可引用该汇总结果”。'],troubleshooting:['不解析 stderr/异常信息为成功结果；输入过大时应提前限流、限制字节数，示例仅使用固定小样本。'],files:['src/main/java/demo/ScenarioDemo.java','src/main/java/demo/ContainerRunner.java']}
  ],files:[pom('sandbox',dep('com.fasterxml.jackson.core','jackson-databind','2.18.2')),envFile,containerRunner,
    java('ConnectDemo',`package demo;
import java.time.Duration;
public class ConnectDemo {
  public static void main(String[] args) throws Exception {
    var result = ContainerRunner.python("print('sandbox ready')", "", Duration.ofSeconds(10));
    System.out.println("exit=" + result.exitCode() + " output=" + result.output());
    if (result.exitCode() != 0) throw new IllegalStateException("沙箱未成功启动");
  }
}`),
    java('CoreDemo',`package demo;
import java.time.Duration;
public class CoreDemo {
  public static void main(String[] args) throws Exception {
    var denied = ContainerRunner.python("open('/blocked.txt', 'w').write('x')", "", Duration.ofSeconds(10));
    System.out.println("只读文件系统演示 exit=" + denied.exitCode());
    System.out.println(denied.output());
    if (denied.exitCode() == 0) throw new IllegalStateException("未观察到预期的文件系统隔离");
    try {
      ContainerRunner.python("import time; time.sleep(30)", "", Duration.ofSeconds(2));
      throw new AssertionError("超时未触发");
    } catch (IllegalStateException expected) { System.out.println(expected.getMessage()); }
  }
}`),
    java('ScenarioDemo',`package demo;
import java.time.Duration;
import com.fasterxml.jackson.databind.ObjectMapper;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    String csv = "item,amount\\nhotel,300\\ntrain,250\\nmeal,100\\n";
    String code = "import csv,sys,json; from decimal import Decimal; rows=list(csv.DictReader(sys.stdin)); "
      + "print(json.dumps({'rows':len(rows),'total':str(sum((Decimal(r['amount']) for r in rows),Decimal(0)))}))";
    var result = ContainerRunner.python(code, csv, Duration.ofSeconds(10));
    if (result.exitCode() != 0) throw new IllegalStateException("计算失败：" + result.output());
    var json = new ObjectMapper().readTree(result.output());
    if (json.path("rows").asInt(-1) != 3 || !json.hasNonNull("total"))
      throw new IllegalStateException("工具响应不符合约定");
    System.out.println(json);
    System.out.println("研究 Agent 可引用该汇总结果；此计算结果不代表来源数据已被核实。");
  }
}`)],sources:[{label:'Docker 执行参数与限制',url:'https://docs.docker.com/engine/containers/run/'},{label:'Docker 安全边界',url:'https://docs.docker.com/engine/security/'},{label:'Java Process API',url:'https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/lang/Process.html'}]
};

const metrics = java('Metrics',`
package demo;
import java.util.*;
public final class Metrics {
  public record Sample(String id, Set<String> relevant, List<String> retrieved, Set<String> allowed) {}
  public record Score(double recall, double reciprocalRank, int denied) {}
  public static Score score(Sample sample, int k) {
    if (k <= 0 || sample.relevant().isEmpty()) throw new IllegalArgumentException("k>0 且标注集非空");
    // 先按文档去重，防止一个文档的重复 chunk 抬高命中数。
    var top = sample.retrieved().stream().distinct().limit(k).toList();
    long hits = top.stream().filter(sample.relevant()::contains).count();
    double rr = 0;
    for (int i = 0; i < top.size(); i++) if (sample.relevant().contains(top.get(i))) { rr = 1.0 / (i + 1); break; }
    int denied = (int) top.stream().filter(id -> !sample.allowed().contains(id)).count();
    return new Score((double) hits / sample.relevant().size(), rr, denied);
  }
  public static void report(String version, List<Sample> samples) {
    if (samples.isEmpty()) throw new IllegalArgumentException("不能用空数据集评估");
    double recall = 0, mrr = 0; int denied = 0;
    for (Sample sample : samples) {
      Score score = score(sample, 3); recall += score.recall(); mrr += score.reciprocalRank(); denied += score.denied();
      System.out.println(sample.id() + " " + score);
    }
    System.out.printf(Locale.ROOT, "%s Recall@3=%.3f MRR@3=%.3f denied=%d%n",
      version, recall / samples.size(), mrr / samples.size(), denied);
  }
}`);
const evaluation={
 id:'evaluation',title:'效果评测：检索指标与版本回归',summary:'无外部依赖的 Java 离线评测小项目，读入标注与真实检索结果的相同结构，计算 Recall@K、MRR 和权限泄漏数。',scenario:'知识库更换分块、Embedding 或检索参数之前，在同一份固定样本上比较版本，并拦截越权文档。',
 prerequisites:['JDK 17+、Maven 3.6.3+；不需要模型 Key 和中间件。','项目自带三行 CSV，内容是教学样本，不代表任何模型/供应商的真实效果。实际使用时替换为脱敏请求、人工标注和真实检索日志。','这是软件效果回归示例，不是学习者考试。指标只评价检索排序与 ACL，不能替代回答事实性、工具安全和成本评估。'],
 environment:[{name:'EVAL_FILE',example:'data/retrieval.csv',description:'UTF-8 CSV；此简化格式不支持字段含逗号/引号；多值用 | 分隔。'}],
 stages:[
   {id:'connect',title:'基础接入 · 载入检索样本',description:'定义最小数据契约：问题 ID、相关文档、检索顺序、当前用户可读文档。先拒绝缺列或空标注。',focus:['同一问题与文档版本的稳定 ID','标注集合与权限集合分开存放'],commands:[run('ConnectDemo')],expected:['loaded=3，并打印每条样本。'],troubleshooting:['在项目根目录执行；改了样本格式时同时更新 Reader，不能静默把坏行计为正确。'],files:['src/main/java/demo/ConnectDemo.java','src/main/java/demo/Samples.java','data/retrieval.csv','pom.xml']},
   {id:'core',title:'核心功能 · 排序质量与 ACL 指标',description:'Recall 衡量找回多少相关文档；MRR 只关心第一个相关结果的位置；ACL 检查与相关性独立。',focus:['文档去重后取 TopK','无相关标注不强行设为 100%','越权结果即使相关也要计入 denied'],commands:[run('CoreDemo')],expected:['baseline Recall@3=1.000 MRR@3=0.833 denied=0。'],troubleshooting:['如果评估 chunk 级指标，需要改用 chunk 标注，不能混用文档 ID；TopK 外结果不参与此处 ACL 计数。'],files:['src/main/java/demo/CoreDemo.java','src/main/java/demo/Metrics.java','data/retrieval.csv']},
   {id:'scenario',title:'场景应用 · 检索变更的发布门槛',description:'固定基线，构造含泄漏和漏召回的候选版本，输出每个问题的差异，并明确拒绝该候选。',focus:['比较同一组样本，不更换分母','质量阈值由业务决定；ACL 泄漏单独否决','即使同一文档命中，返回正文前仍需实时鉴权'],commands:[run('ScenarioDemo')],expected:['候选版 Recall@3=0.833、MRR@3=0.833、denied=1，打印 RELEASE_BLOCKED。这是故意准备的坏候选。'],troubleshooting:['小样本通过不能证明生产有效；扩大长尾、空结果、权限撤销样本，并单独观察延迟和 token 成本。'],files:['src/main/java/demo/ScenarioDemo.java','src/main/java/demo/Metrics.java','src/main/java/demo/Samples.java']}
 ],files:[pom('evaluation'),envFile,metrics,
 file('data/retrieval.csv','csv',`id,relevant,retrieved,allowed
q1,d1|d2,d1|d2|d3,d1|d2|d3
q2,d4,d5|d4,d4|d5
q3,d6,d6,d6`),
 java('Samples',`package demo;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Collectors;
public final class Samples {
  static Set<String> set(String value) { return Arrays.stream(value.split("[|]")).collect(Collectors.toSet()); }
  static List<Metrics.Sample> load() throws Exception {
    List<String> lines = Files.readAllLines(Path.of(Env.get("EVAL_FILE", "data/retrieval.csv")));
    if (lines.isEmpty() || !lines.get(0).equals("id,relevant,retrieved,allowed")) throw new IllegalArgumentException("CSV 表头错误");
    List<Metrics.Sample> result = new ArrayList<>(); Set<String> ids = new HashSet<>();
    for (String line : lines.subList(1, lines.size())) {
      String[] parts = line.split(",", -1);
      if (parts.length != 4 || Arrays.stream(parts).anyMatch(String::isBlank) || !ids.add(parts[0]))
        throw new IllegalArgumentException("样本缺列/空值/ID重复：" + line);
      Set<String> relevant = set(parts[1]), allowed = set(parts[3]);
      if (!allowed.containsAll(relevant)) throw new IllegalArgumentException("相关性标注含用户无权读取的文档");
      result.add(new Metrics.Sample(parts[0], relevant, Arrays.asList(parts[2].split("[|]")), allowed));
    }
    if (result.isEmpty()) throw new IllegalArgumentException("样本为空");
    return result;
  }
}`),
 java('ConnectDemo',`package demo;
public class ConnectDemo {
  public static void main(String[] args) throws Exception {
    var samples = Samples.load(); System.out.println("loaded=" + samples.size()); samples.forEach(System.out::println);
  }
}`),
 java('CoreDemo',`package demo;
public class CoreDemo {
  public static void main(String[] args) throws Exception { Metrics.report("baseline", Samples.load()); }
}`),
 java('ScenarioDemo',`package demo;
import java.util.*;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    var baseline = Samples.load(); Metrics.report("baseline", baseline);
    // 模拟新索引的实际输出；真实工程应替换为新版本检索 API 返回的有序 documentId。
    var candidate = new ArrayList<>(baseline);
    var first = candidate.get(0);
    candidate.set(0, new Metrics.Sample(first.id(), first.relevant(), List.of("d1", "secret-other-tenant", "d3"), first.allowed()));
    Metrics.report("candidate", candidate);
    double before = baseline.stream().mapToDouble(s -> Metrics.score(s, 3).recall()).average().orElseThrow();
    double after = candidate.stream().mapToDouble(s -> Metrics.score(s, 3).recall()).average().orElseThrow();
    boolean leaked = candidate.stream().anyMatch(s -> Metrics.score(s, 3).denied() > 0);
    System.out.println(leaked || after < before - 0.02 ? "RELEASE_BLOCKED：检查 ACL/漏召回样本" : "READY_FOR_NEXT_REVIEW");
  }
}`)],sources:[{label:'Stanford IR：检索效果度量',url:'https://nlp.stanford.edu/IR-book/html/htmledition/evaluation-of-ranked-retrieval-results-1.html'},{label:'BEIR：可复用检索评测基准',url:'https://github.com/beir-cellar/beir'}]
};

const docker={
 id:'docker',title:'容器工程：Java Worker 的构建、限制与配置',summary:'这里的 Docker 用于学习如何运行 Agent Worker。学习网站本身仍是纯静态文件，无需 Docker。',scenario:'把知识入库 Worker 的运行环境固定下来，通过环境变量和只读任务文件传参，观察退出码与日志。',
 prerequisites:['JDK 17+、Maven 3.6.3+；Docker Engine 或 Desktop 已启动。','项目使用 eclipse-temurin:17-jre，首次构建需可访问镜像仓库；生产应固定经过验证的镜像 digest。','Worker 只读 JSON 任务文件并演示处理边界，不包含完整 Embedding 或消息消费；对应调用见检索和队列 Demo。'],
 environment:[{name:'WORKER_TENANT',example:'demo-tenant-a',description:'容器内通过 -e 设置；真实租户身份应来自已经鉴权的任务记录。'},{name:'JOB_FILE',example:'/data/job.json',description:'容器内只读挂载文件路径。'}],
 stages:[
   {id:'connect',title:'基础接入 · 打包并运行 Java 镜像',description:'Maven 编译产物复制进 JRE 镜像，显式指定非 root 用户与默认入口。',focus:['构建上下文只包含这个 Demo','编译 JDK 与运行 JRE 的版本相容'],commands:['mvn -q compile','docker build -t demo-agent-worker:1 .','docker run --rm demo-agent-worker:1'],expected:['打印 runtime=17… 和 worker ready。'],troubleshooting:['class file version 不匹配：检查编译 release 与镜像 JRE；镜像拉取失败先处理 registry 网络。'],files:['Dockerfile','.dockerignore','src/main/java/demo/ConnectDemo.java','pom.xml']},
   {id:'core',title:'核心功能 · 资源、环境变量与退出状态',description:'使用同一镜像运行另一入口类；展示容器中能看到的内存上限和配置，不把 JVM 默认值误当宿主机全部内存。',focus:['--memory 限制进程，MaxRAMPercentage 控制堆比例','-e 注入非机密配置；日志输出到 stdout'],commands:['docker run --rm --memory=256m --cpus=1 --read-only --tmpfs=/tmp:rw,size=16m -e WORKER_TENANT=demo-tenant-a --entrypoint java demo-agent-worker:1 -XX:MaxRAMPercentage=60 -cp /app/classes demo.CoreDemo'],expected:['打印 tenant 和 maxHeapMiB；堆应小于 256 MiB，具体值随 JDK 变动。'],troubleshooting:['exit 137 可能是 OOM 或 SIGKILL，需结合 docker inspect / daemon 事件判断，不能只看数字。'],files:['src/main/java/demo/CoreDemo.java','Dockerfile']},
   {id:'scenario',title:'场景应用 · 只读任务文件的 Worker',description:'挂载单个小任务文件，用健康的退出码向调度方反馈执行状态；容器失败后的重试/幂等应由任务系统管理。',focus:['容器内路径和宿主机路径不同','只读挂载输入；不把凭据写入镜像','真实外部副作用成功后才能 ack 消息'],commands:['docker run --rm --memory=256m --cpus=1 --read-only --network=none --cap-drop=ALL --security-opt=no-new-privileges --tmpfs=/tmp:rw,size=16m -e WORKER_TENANT=demo-tenant-a -e JOB_FILE=/data/job.json --mount "type=bind,src=$PWD/data/job.json,dst=/data/job.json,readonly" --entrypoint java demo-agent-worker:1 -cp /app/classes demo.ScenarioDemo'],expected:['打印任务内容、租户与“输入已读取”；此示例不进行真实入库，不能把它当成 ingestion 成功。'],troubleshooting:['在项目根目录执行，确保 data/job.json 可被容器用户读取；Docker Desktop 可能需要允许共享项目目录。'],files:['src/main/java/demo/ScenarioDemo.java','data/job.json','Dockerfile']}
 ],files:[pom('docker'),envFile,
 file('Dockerfile','dockerfile',`FROM eclipse-temurin:17-jre
WORKDIR /app
COPY target/classes/ /app/classes/
USER 10001:10001
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=60", "-cp", "/app/classes", "demo.ConnectDemo"]`),
 file('.dockerignore','text',`*
!Dockerfile
!target/
target/*
!target/classes/
!target/classes/**`),
 file('data/job.json','json','{"jobId":"demo-job-001","tenant":"demo-tenant-a","documentId":"policy-01","version":1}'),
 java('ConnectDemo',`package demo;
public class ConnectDemo {
  public static void main(String[] args) { System.out.println("runtime=" + System.getProperty("java.version") + " worker ready"); }
}`),
 java('CoreDemo',`package demo;
public class CoreDemo {
  public static void main(String[] args) {
    System.out.println("tenant=" + Env.required("WORKER_TENANT"));
    System.out.println("maxHeapMiB=" + Runtime.getRuntime().maxMemory() / 1024 / 1024);
  }
}`),
 java('ScenarioDemo',`package demo;
import java.nio.file.*;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    Path input = Path.of(Env.required("JOB_FILE"));
    if (Files.size(input) > 65536) throw new IllegalArgumentException("示例任务文件不能超过 64 KiB");
    String tenant = Env.required("WORKER_TENANT");
    String job = Files.readString(input);
    System.out.println("tenant=" + tenant + " job=" + job);
    System.out.println("输入已读取；此示例仅验证容器配置与挂载，没有执行真实文档入库。");
    // 真正 Worker 在这里解析/校验任务、检查幂等记录、执行入库，提交状态后再确认队列消息。
  }
}`)],sources:[{label:'Dockerfile COPY / USER / ENTRYPOINT',url:'https://docs.docker.com/reference/dockerfile/'},{label:'Docker bind mounts',url:'https://docs.docker.com/engine/storage/bind-mounts/'},{label:'Docker 资源限制',url:'https://docs.docker.com/engine/containers/resource_constraints/'}]
};

export const engineeringDemos=[gateway,sandbox,evaluation,docker];
