package demo;
import java.util.*;
public class CoreDemo {
  public static void main(String[] args) throws Exception {
    ElasticStore.setup();
    ElasticStore.bulk(List.of(
        Map.of("id", "a1", "tenant", "team-a", "model_id", "lexical-only", "content", "E1042 数据库连接超时，请检查网络与连接池。"),
        Map.of("id", "a2", "tenant", "team-a", "model_id", "lexical-only", "content", "企业账号密码重置流程。"),
        Map.of("id", "b1", "tenant", "team-b", "model_id", "lexical-only", "content", "E1042 另一租户内部资料。")));
    System.out.println(ElasticStore.lexical("E1042", "lexical-only").toPrettyString());
  }
}
