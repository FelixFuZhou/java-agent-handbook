package demo;
import java.util.*;
public class CoreDemo {
  public static void main(String[] args) throws Exception {
    List<String> texts = new ArrayList<>();
    for (int i = 1; i <= 12; i++) texts.add("制度条款 " + i + "：报销申请需要提供发票和审批记录。");
    var vectors = Embeddings.encode(texts, "document");
    var query = Embeddings.encode(List.of("报销要准备什么材料？"), "query").get(0);
    for (int i = 0; i < vectors.size(); i++)
      System.out.printf(Locale.ROOT, "row=%d cosine=%.5f%n", i, Embeddings.cosine(query, vectors.get(i)));
  }
}
