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
}
