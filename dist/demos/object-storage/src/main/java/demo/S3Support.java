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
}
