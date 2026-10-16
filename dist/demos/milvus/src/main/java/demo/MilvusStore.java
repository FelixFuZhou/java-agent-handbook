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
}
