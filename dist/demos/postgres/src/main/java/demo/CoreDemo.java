package demo;
import java.util.UUID;
public class CoreDemo {
  public static void main(String[] args) throws Exception {
    try (var c = Db.open()) {
      Db.schema(c);
      String request = "demo_" + UUID.randomUUID();
      System.out.println("created=" + Db.submit(c,"demo_tenant",request));
      System.out.println("duplicateCreated=" + Db.submit(c,"demo_tenant",request));
      String rollback = "demo_rollback_" + UUID.randomUUID();
      c.setAutoCommit(false);
      try (var p = c.prepareStatement(
          "INSERT INTO demo_agent_task(tenant_id,request_id,status) VALUES (?,?,'PENDING')")) {
        p.setString(1,"demo_tenant"); p.setString(2,rollback); p.executeUpdate();
        c.rollback();
      } finally { c.setAutoCommit(true); }
      System.out.println("after rollback=" + Db.state(c,"demo_tenant",rollback));
    }
  }
}
