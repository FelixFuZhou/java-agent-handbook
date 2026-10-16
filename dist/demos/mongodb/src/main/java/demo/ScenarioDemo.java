package demo;
import java.time.Instant;
public class ScenarioDemo {
  public static void main(String[] args) {
    try (var client = MongoSupport.open()) {
      MongoSupport.schema(client); Instant now = Instant.now();
      String session = "demo_knowledge_001";
      MongoSupport.put(client,"demo_alpha",session,"1","user","报销何时提交？",now,now.plusSeconds(600));
      MongoSupport.put(client,"demo_alpha",session,"2","assistant","根据制度v1，30天内提交。",now.plusMillis(1),now.plusSeconds(600));
      MongoSupport.put(client,"demo_beta",session,"1","user","beta内部预算信息",now,now.plusSeconds(600));
      MongoSupport.put(client,"demo_alpha",session,"expired","user","expired旧上下文",now.minusSeconds(60),now.minusSeconds(1));
      var history = MongoSupport.history(client,"demo_alpha",session);
      MongoSupport.print(history);
      if (history.size() != 2) throw new IllegalStateException("预期当前租户有效消息为2条");
      System.out.println("这只是会话上下文，退款等业务结果仍写入事务账本。");
    }
  }
}
