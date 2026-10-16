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
}
