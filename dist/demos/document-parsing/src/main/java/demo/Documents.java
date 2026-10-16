package demo;
import org.apache.tika.Tika;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.metadata.TikaCoreProperties;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.sax.BodyContentHandler;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
public final class Documents {
  public record Parsed(String documentId, String version, String tenant, String source,
      String mime, String parserVersion, String text) {}
  public record Chunk(String id, String documentId, String version, String tenant, String source,
      String mime, String parserVersion, int startCodePoint, int endCodePoint, String text) {}
  public static Path input() { return Path.of(Env.get("DOCUMENT_PATH", "sample.txt")); }
  public static byte[] bytes(Path path) throws IOException {
    if (!Files.isRegularFile(path)) throw new IllegalArgumentException("文件不存在：" + path);
    if (Files.size(path) > 20 * 1024 * 1024) throw new IllegalArgumentException("教学限制：文件不得超过20MiB");
    return Files.readAllBytes(path);
  }
  public static String sha(byte[] bytes) throws Exception {
    return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
  }
  public static Parsed parse() throws Exception {
    Path path = input(); byte[] bytes = bytes(path);
    String tenant = Env.get("DOCUMENT_TENANT", "team-a");
    String source = Env.get("DOCUMENT_SOURCE", "employee-handbook-v1");
    String documentId = sha((tenant + "\n" + source).getBytes(StandardCharsets.UTF_8));
    Metadata metadata = new Metadata(); metadata.set(TikaCoreProperties.RESOURCE_NAME_KEY, path.getFileName().toString());
    // 有界输出；超过上限抛错，不静默截断。这里只处理用户选定的本地教学文件。
    BodyContentHandler handler = new BodyContentHandler(200_000);
    try (InputStream in = new ByteArrayInputStream(bytes)) {
      new AutoDetectParser().parse(in, handler, metadata, new ParseContext());
    }
    String text = handler.toString().replace("\r\n", "\n").strip();
    if (text.isBlank()) throw new IllegalStateException("没有抽取到文本；扫描件可能需要独立OCR");
    return new Parsed(documentId, sha(bytes), tenant, source, new Tika().detect(bytes, path.getFileName().toString()),
        "tika-3.2.3", text);
  }
  public static List<Chunk> chunks(Parsed doc, int size, int overlap) {
    if (size <= 0 || overlap < 0 || overlap >= size) throw new IllegalArgumentException("切分参数");
    int[] points = doc.text().codePoints().toArray(); var result = new ArrayList<Chunk>();
    for (int start = 0; start < points.length; start += size - overlap) {
      int end = Math.min(start + size, points.length);
      String id = doc.documentId() + ":" + doc.version() + ":cp" + start;
      result.add(new Chunk(id, doc.documentId(), doc.version(), doc.tenant(), doc.source(), doc.mime(),
          doc.parserVersion(), start, end, new String(points, start, end - start)));
      if (end == points.length) break;
    }
    return result;
  }
}
