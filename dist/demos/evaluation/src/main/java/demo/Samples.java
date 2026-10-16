package demo;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Collectors;
public final class Samples {
  static Set<String> set(String value) { return Arrays.stream(value.split("[|]")).collect(Collectors.toSet()); }
  static List<Metrics.Sample> load() throws Exception {
    List<String> lines = Files.readAllLines(Path.of(Env.get("EVAL_FILE", "data/retrieval.csv")));
    if (lines.isEmpty() || !lines.get(0).equals("id,relevant,retrieved,allowed")) throw new IllegalArgumentException("CSV 表头错误");
    List<Metrics.Sample> result = new ArrayList<>(); Set<String> ids = new HashSet<>();
    for (String line : lines.subList(1, lines.size())) {
      String[] parts = line.split(",", -1);
      if (parts.length != 4 || Arrays.stream(parts).anyMatch(String::isBlank) || !ids.add(parts[0]))
        throw new IllegalArgumentException("样本缺列/空值/ID重复：" + line);
      Set<String> relevant = set(parts[1]), allowed = set(parts[3]);
      if (!allowed.containsAll(relevant)) throw new IllegalArgumentException("相关性标注含用户无权读取的文档");
      result.add(new Metrics.Sample(parts[0], relevant, Arrays.asList(parts[2].split("[|]")), allowed));
    }
    if (result.isEmpty()) throw new IllegalArgumentException("样本为空");
    return result;
  }
}
