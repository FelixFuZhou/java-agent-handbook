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
}
