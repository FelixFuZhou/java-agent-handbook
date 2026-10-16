package demo;
import com.alibaba.nacos.api.NacosFactory;
import com.alibaba.nacos.api.config.ConfigService;
import java.io.StringReader;
import java.util.Properties;
public final class NacosSupport {
  static final String GROUP = "DEMO_AGENT";
  static final String CORE = "demo-agent-retrieval-core.properties";
  static final String SCENARIO = "demo-agent-retrieval-scenario.properties";
  record Policy(int topK, String version) {}
  private NacosSupport() {}
  static ConfigService connect() throws Exception {
    var properties = new Properties();
    properties.setProperty("serverAddr", Env.get("NACOS_SERVER", "localhost:8848"));
    properties.setProperty("namespace", Env.get("NACOS_NAMESPACE_ID", ""));
    String username = Env.get("NACOS_USER", "");
    if (!username.isBlank()) {
      properties.setProperty("username", username);
      properties.setProperty("password", Env.required("NACOS_PASSWORD"));
    }
    return NacosFactory.createConfigService(properties);
  }
  static String content(int topK, String version) {
    return "topK=" + topK + "\nversion=" + version + "\n";
  }
  static void publish(ConfigService service, String id, String content) throws Exception {
    if (!service.publishConfig(id, GROUP, content))
      throw new IllegalStateException("配置发布未成功: " + id);
  }
  static Policy parse(String content) throws Exception {
    if (content == null) throw new IllegalArgumentException("配置缺失");
    var p = new Properties();
    p.load(new StringReader(content));
    int k = Integer.parseInt(p.getProperty("topK", "0"));
    if (k < 1 || k > 20) throw new IllegalArgumentException("topK 必须在 1..20");
    String version = p.getProperty("version", "");
    if (version.isBlank()) throw new IllegalArgumentException("需要配置版本");
    return new Policy(k, version);
  }
}
