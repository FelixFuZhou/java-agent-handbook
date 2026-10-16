package demo;
import java.util.*;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    var baseline = Samples.load(); Metrics.report("baseline", baseline);
    // 模拟新索引的实际输出；真实工程应替换为新版本检索 API 返回的有序 documentId。
    var candidate = new ArrayList<>(baseline);
    var first = candidate.get(0);
    candidate.set(0, new Metrics.Sample(first.id(), first.relevant(), List.of("d1", "secret-other-tenant", "d3"), first.allowed()));
    Metrics.report("candidate", candidate);
    double before = baseline.stream().mapToDouble(s -> Metrics.score(s, 3).recall()).average().orElseThrow();
    double after = candidate.stream().mapToDouble(s -> Metrics.score(s, 3).recall()).average().orElseThrow();
    boolean leaked = candidate.stream().anyMatch(s -> Metrics.score(s, 3).denied() > 0);
    System.out.println(leaked || after < before - 0.02 ? "RELEASE_BLOCKED：检查 ACL/漏召回样本" : "READY_FOR_NEXT_REVIEW");
  }
}
