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
}
