package demo;
import java.util.*;
public final class Embeddings {
  public static final int DIM = 1024;
  public static String model() { return Env.get("EMBED_MODEL", "text-embedding-v3"); }
  public static List<double[]> encode(List<String> texts, String type) throws Exception {
    if (!Set.of("document", "query").contains(type)) throw new IllegalArgumentException("text_type");
    List<double[]> all = new ArrayList<>();
    // 使用原生 DashScope 契约；v3 每批最多 10 条，示例文本均为短文本。
    for (int start = 0; start < texts.size(); start += 10) {
      var batch = texts.subList(start, Math.min(start + 10, texts.size()));
      var root = Http.json("POST", Env.required("EMBED_URL"),
          "Bearer " + Env.required("DASHSCOPE_API_KEY"), Map.of(
          "model", model(), "input", Map.of("texts", batch),
          "parameters", Map.of("text_type", type, "dimension", DIM, "output_type", "dense")));
      var rows = root.path("output").path("embeddings");
      if (!rows.isArray() || rows.size() != batch.size()) throw new IllegalStateException("向量数量不匹配：" + root.path("code"));
      double[][] ordered = new double[batch.size()][];
      for (var row : rows) {
        int i = row.path("text_index").asInt(-1);
        var vector = row.path("embedding");
        if (i < 0 || i >= ordered.length || ordered[i] != null || vector.size() != DIM)
          throw new IllegalStateException("重复 index / 维度不符 / 缺少向量");
        ordered[i] = new double[DIM];
        for (int d = 0; d < DIM; d++) {
          if (!vector.get(d).isNumber()) throw new IllegalStateException("非数值向量");
          double value = vector.get(d).asDouble();
          if (!Double.isFinite(value)) throw new IllegalStateException("无效浮点数");
          ordered[i][d] = value;
        }
      }
      all.addAll(Arrays.asList(ordered));
      System.out.println("request_id=" + root.path("request_id").asText() + " batch=" + batch.size()
          + " usage=" + root.path("usage"));
    }
    return all;
  }
  public static double cosine(double[] a, double[] b) {
    if (a.length != b.length) throw new IllegalArgumentException("维度不同");
    double dot = 0, aa = 0, bb = 0;
    for (int i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
    if (aa == 0 || bb == 0) throw new IllegalArgumentException("零向量");
    return dot / Math.sqrt(aa * bb);
  }
}
