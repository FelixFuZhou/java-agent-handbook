package demo;
public class ScenarioDemo {
  public static void main(String[] args) {
    String authenticatedTenant = "demo_alpha";
    try (var driver = GraphSupport.open(); var session = GraphSupport.session(driver)) {
      GraphSupport.schema(session); GraphSupport.seed(session);
      var rows = GraphSupport.dependencies(session,authenticatedTenant,"demo_orders");
      rows.forEach(System.out::println);
      if (rows.size() != 2 || rows.stream().anyMatch(r -> "demo_private".equals(r.get("id"))))
        throw new IllegalStateException("权限或演示图结构不符合预期");
      System.out.println("允许进入 Agent 上下文的依赖数量=" + rows.size());
    }
  }
}
