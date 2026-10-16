package demo;
import org.neo4j.driver.*;
import java.util.*;
import java.util.concurrent.TimeUnit;

public final class GraphSupport {
  private GraphSupport() {}
  static Driver open() {
    return GraphDatabase.driver(Env.get("DEMO_NEO4J_URI","bolt://localhost:7687"),
      AuthTokens.basic(Env.required("DEMO_NEO4J_USER"),Env.required("DEMO_NEO4J_PASSWORD")),
      Config.builder().withConnectionTimeout(5,TimeUnit.SECONDS).build());
  }
  static Session session(Driver driver) {
    return driver.session(SessionConfig.builder().withDatabase(Env.get("DEMO_NEO4J_DATABASE","neo4j")).build());
  }
  static void schema(Session s) {
    s.run("CREATE CONSTRAINT demo_service_unique IF NOT EXISTS " +
      "FOR (s:demo_Service) REQUIRE (s.tenant_id,s.id) IS UNIQUE").consume();
  }
  static void upsert(Session s, String tenant, String id, String name) {
    if (!tenant.startsWith("demo_") || !id.startsWith("demo_"))
      throw new IllegalArgumentException("只允许 demo_ 节点");
    s.executeWrite(tx -> {
      tx.run("MERGE (s:demo_Service {tenant_id:$tenant,id:$id}) SET s.name=$name",
        Map.of("tenant",tenant,"id",id,"name",name)).consume(); return null;
    });
  }
  static void seed(Session s) {
    upsert(s,"demo_alpha","demo_orders","订单服务");
    upsert(s,"demo_alpha","demo_cache","共享缓存");
    upsert(s,"demo_alpha","demo_billing","账单服务");
    upsert(s,"demo_beta","demo_private","另一租户内部服务");
    var edges = List.of(
      Map.of("from","demo_orders","to","demo_cache","toTenant","demo_alpha"),
      Map.of("from","demo_orders","to","demo_billing","toTenant","demo_alpha"),
      Map.of("from","demo_billing","to","demo_private","toTenant","demo_beta"));
    // 故意种一条跨租户演示边，用于证明路径中每个节点都需要权限过滤。
    s.executeWrite(tx -> {
      tx.run("UNWIND $edges AS e " +
        "MATCH (a:demo_Service {tenant_id:$tenant,id:e.from}) " +
        "MATCH (b:demo_Service {tenant_id:e.toTenant,id:e.to}) " +
        "MERGE (a)-[r:demo_DEPENDS_ON]->(b) " +
        "SET r.tenant_id=$tenant,r.active=true,r.source='demo_cmdb_v1'",
        Map.of("tenant","demo_alpha","edges",edges)).consume(); return null;
    });
  }
  static List<Map<String,Object>> dependencies(Session s, String tenant, String id) {
    return s.executeRead(tx -> tx.run(
      "MATCH p=(s:demo_Service {tenant_id:$tenant,id:$id})-[:demo_DEPENDS_ON*1..2]->(d:demo_Service) " +
      "WHERE all(n IN nodes(p) WHERE n.tenant_id=$tenant) " +
      "AND all(r IN relationships(p) WHERE r.tenant_id=$tenant AND r.active=true) " +
      "RETURN DISTINCT d.id AS id,d.name AS name,length(p) AS hops ORDER BY hops,id LIMIT 20",
      Map.of("tenant",tenant,"id",id)).list(record -> record.asMap()));
  }
}
