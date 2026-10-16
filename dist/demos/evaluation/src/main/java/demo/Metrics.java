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
}
