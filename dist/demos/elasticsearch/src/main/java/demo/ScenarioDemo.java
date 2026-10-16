package demo;
import java.util.*;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    var texts = List.of("E1042 表示数据库连接超时，应检查网络、数据库负载与连接池。",
        "当请求等待连接过久时，观察连接池活跃数量和等待队列，避免盲目扩容。", "另一租户的 E1042 处理记录。");
    var ids = List.of("a1", "a2", "b1");
    var vectors = Embeddings.encode(texts, "document");
    String question = Env.get("QUESTION", "E1042，应用连不上数据库怎么排查？");
    var query = Embeddings.encode(List.of(question), "query").get(0);
    ElasticStore.setup(); var docs = new ArrayList<Map<String,Object>>();
    for (int i = 0; i < texts.size(); i++) docs.add(Map.of("id", ids.get(i), "tenant", i == 2 ? "team-b" : "team-a",
        "model_id", Embeddings.model(), "content", texts.get(i), "vector", vectors.get(i)));
    ElasticStore.bulk(docs);
    var bm25 = ElasticStore.lexical(question, Embeddings.model());
    var semantic = ElasticStore.semantic(query, Embeddings.model());
    System.out.println("BM25=" + bm25); System.out.println("vector=" + semantic);
    ElasticStore.fuse(bm25, semantic);
  }
}
