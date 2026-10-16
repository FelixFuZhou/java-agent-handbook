package demo;
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
}
