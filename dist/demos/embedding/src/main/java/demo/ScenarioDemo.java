package demo;
import java.util.*;
import java.util.stream.*;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    var ids = List.of("expense-v1#0", "account-v1#0", "ops-v1#0");
    var docs = List.of("差旅报销应在返回后30天内提交，需提供发票和审批记录。",
        "重置账号密码需进入账号中心，验证企业邮箱后设置新密码。",
        "数据库连接超时应检查网络、连接池和数据库负载。");
    String question = Env.get("QUESTION", "出差回来多久内要交报销？");
    var vectors = Embeddings.encode(docs, "document");
    var query = Embeddings.encode(List.of(question), "query").get(0);
    var ranked = IntStream.range(0, docs.size()).boxed()
        .sorted(Comparator.comparingDouble((Integer i) -> Embeddings.cosine(query, vectors.get(i))).reversed()).toList();
    System.out.println("query=" + question);
    for (int i : ranked.subList(0, Math.min(2, ranked.size())))
      System.out.printf(Locale.ROOT, "[%s] score=%.5f %s%n", ids.get(i), Embeddings.cosine(query, vectors.get(i)), docs.get(i));
  }
}
