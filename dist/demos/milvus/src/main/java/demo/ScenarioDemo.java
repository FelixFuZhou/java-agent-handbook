package demo;
import java.util.*;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    var docs = List.of("差旅报销应在返回后30天内提交。", "密码重置需要验证企业邮箱。", "另一租户报销上限信息。");
    var vectors = Embeddings.encode(docs, "document");
    var query = Embeddings.encode(List.of(Env.get("QUESTION", "出差后什么时候报销？")), "query").get(0);
    MilvusStore.setup(true);
    var rows = new ArrayList<Map<String,Object>>();
    for (int i = 0; i < docs.size(); i++) rows.add(MilvusStore.row(i + 1,
        i == 2 ? "team-b" : "team-a", docs.get(i), Embeddings.model(), vectors.get(i)));
    MilvusStore.upsert(true, rows);
    MilvusStore.search(true, query, Embeddings.model());
  }
}
