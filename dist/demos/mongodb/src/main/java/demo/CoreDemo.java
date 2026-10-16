package demo;
import java.time.Instant;
public class CoreDemo {
  public static void main(String[] args) {
    try (var client = MongoSupport.open()) {
      MongoSupport.schema(client);
      Instant now = Instant.now();
      for (int i=0;i<2;i++) MongoSupport.put(client,"demo_core","demo_session","turn_1",
        "user","解释一下向量检索",now,now.plusSeconds(600));
      var rows = MongoSupport.history(client,"demo_core","demo_session");
      System.out.println("history size=" + rows.size()); MongoSupport.print(rows);
      for (var index : MongoSupport.messages(client).listIndexes()) System.out.println(index.toJson());
    }
  }
}
