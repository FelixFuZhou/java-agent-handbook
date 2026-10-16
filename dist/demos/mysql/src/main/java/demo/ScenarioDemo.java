package demo;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    String tenant = "demo_tenant", request = "demo_doc_v1";
    try (var c = Db.open()) {
      Db.schema(c); Db.submit(c,tenant,request);
      boolean claimed = Db.claim(c,tenant,request);
      System.out.println("claimed=" + claimed);
      // 演示已知结果的持久化；这里没有真正执行解析或模型调用。
      if (claimed) Db.complete(c,tenant,request,"demo_index_reference_v1");
      System.out.println("state=" + Db.state(c,tenant,request));
      try (var p = c.prepareStatement(
          "SELECT event_id,payload FROM demo_outbox WHERE tenant_id=? AND published=0 ORDER BY event_id")) {
        p.setString(1,tenant);
        try (var r = p.executeQuery()) {
          while (r.next()) System.out.println("pending " + r.getString(1) + " -> " + r.getString(2));
        }
      }
    }
  }
}
