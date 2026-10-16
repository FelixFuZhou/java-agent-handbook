package demo;
import java.util.Map;
public class CoreDemo {
  public static void main(String[] args) {
    try (var driver = GraphSupport.open(); var session = GraphSupport.session(driver)) {
      GraphSupport.schema(session);
      for (int i=0;i<2;i++) GraphSupport.upsert(session,"demo_core","demo_search","知识检索服务");
      long count = session.executeRead(tx -> tx.run(
        "MATCH (s:demo_Service {tenant_id:$tenant,id:$id}) RETURN count(s) AS n",
        Map.of("tenant","demo_core","id","demo_search")).single().get("n").asLong());
      System.out.println("count=" + count);
      if (count != 1) throw new IllegalStateException("业务主键应唯一");
    }
  }
}
