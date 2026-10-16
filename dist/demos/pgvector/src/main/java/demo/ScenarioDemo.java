package demo;
import java.util.*;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    var docs = List.of("差旅报销应在返回后30天内提交。", "企业账号可以通过邮箱验证重置密码。", "另一租户报销额度只供其内部使用。");
    var vectors = Embeddings.encode(docs, "document");
    String question = Env.get("QUESTION", "出差回来多久提交报销？");
    var query = Embeddings.encode(List.of(question), "query").get(0);
    try (var c = PgStore.connect()) {
      PgStore.setup(c, true);
      for (int i = 0; i < docs.size(); i++) PgStore.upsert(c, true,
          i == 2 ? "team-b" : "team-a", "policy-v1#" + i, docs.get(i), Embeddings.model(), vectors.get(i));
      // 身份在业务服务中验证；不从用户问题中解析 tenant。
      PgStore.search(c, true, "team-a", Embeddings.model(), query);
    }
  }
}
