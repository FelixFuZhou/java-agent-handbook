package demo;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    var document = Documents.parse(); var chunks = Documents.chunks(document, 160, 24);
    Path out = Path.of(Env.get("OUTPUT_PATH", "target/chunks.jsonl"));
    Path parent = out.toAbsolutePath().getParent(); Files.createDirectories(parent);
    ObjectMapper json = new ObjectMapper();
    try (var writer = Files.newBufferedWriter(out, StandardCharsets.UTF_8)) {
      for (var chunk : chunks) { writer.write(json.writeValueAsString(chunk)); writer.newLine(); }
    }
    System.out.println("output=" + out.toAbsolutePath() + " chunks=" + chunks.size());
    System.out.println("相同源文档重复运行可按chunkId幂等导入；版本切换由下游入库任务管理。");
  }
}
