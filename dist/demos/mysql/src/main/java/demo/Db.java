package demo;
import java.sql.*;

public final class Db {
  private Db() {}
  public static Connection open() throws SQLException {
    DriverManager.setLoginTimeout(5);
    Connection c = DriverManager.getConnection(Env.get("DEMO_JDBC_URL", "jdbc:mysql://localhost:3306/demo_agent?connectTimeout=5000&socketTimeout=10000"),
      Env.required("DEMO_DB_USER"), Env.required("DEMO_DB_PASSWORD"));
    String catalog = c.getCatalog();
    if (catalog == null || !catalog.startsWith("demo_")) {
      c.close(); throw new IllegalArgumentException("仅允许 demo_ 开头的学习数据库");
    }
    return c;
  }
  public static void schema(Connection c) throws SQLException {
    try (Statement s = c.createStatement()) {
      s.executeUpdate("CREATE TABLE IF NOT EXISTS demo_agent_task (" +
        "tenant_id VARCHAR(80) NOT NULL, request_id VARCHAR(100) NOT NULL, " +
        "status VARCHAR(20) NOT NULL, result VARCHAR(500), " +
        "PRIMARY KEY(tenant_id, request_id)) ENGINE=InnoDB");
      s.executeUpdate("CREATE TABLE IF NOT EXISTS demo_outbox (" +
        "event_id VARCHAR(240) PRIMARY KEY, tenant_id VARCHAR(80) NOT NULL, " +
        "payload VARCHAR(500) NOT NULL, published INTEGER NOT NULL DEFAULT 0) ENGINE=InnoDB");
    }
  }
  public static boolean submit(Connection c, String tenant, String request) throws SQLException {
    c.setAutoCommit(false);
    try {
      try (PreparedStatement p = c.prepareStatement(
          "INSERT INTO demo_agent_task(tenant_id,request_id,status) VALUES (?,?,'PENDING')")) {
        p.setString(1, tenant); p.setString(2, request); p.executeUpdate();
      }
      event(c, "demo_created:" + tenant + ":" + request, tenant, "INDEX_REQUESTED " + request);
      c.commit(); return true;
    } catch (SQLException e) {
      c.rollback();
      if (e.getErrorCode() == 1062) return false;
      throw e;
    } finally { c.setAutoCommit(true); }
  }
  static void event(Connection c, String id, String tenant, String body) throws SQLException {
    try (PreparedStatement p = c.prepareStatement(
        "INSERT INTO demo_outbox(event_id,tenant_id,payload) VALUES (?,?,?)")) {
      p.setString(1,id); p.setString(2,tenant); p.setString(3,body); p.executeUpdate();
    }
  }
  static boolean claim(Connection c, String tenant, String request) throws SQLException {
    try (PreparedStatement p = c.prepareStatement(
        "UPDATE demo_agent_task SET status='RUNNING' WHERE tenant_id=? AND request_id=? AND status='PENDING'")) {
      p.setString(1,tenant); p.setString(2,request); return p.executeUpdate() == 1;
    }
  }
  static void complete(Connection c, String tenant, String request, String result) throws SQLException {
    c.setAutoCommit(false);
    try {
      try (PreparedStatement p = c.prepareStatement(
          "UPDATE demo_agent_task SET status='SUCCEEDED',result=? " +
          "WHERE tenant_id=? AND request_id=? AND status='RUNNING'")) {
        p.setString(1,result); p.setString(2,tenant); p.setString(3,request);
        if (p.executeUpdate() != 1) throw new SQLException("任务不处于 RUNNING，拒绝覆盖");
      }
      event(c, "demo_completed:" + tenant + ":" + request, tenant, "INDEX_COMPLETED " + request);
      c.commit();
    } catch (SQLException e) { c.rollback(); throw e; }
    finally { c.setAutoCommit(true); }
  }
  static String state(Connection c, String tenant, String request) throws SQLException {
    try (PreparedStatement p = c.prepareStatement(
        "SELECT status FROM demo_agent_task WHERE tenant_id=? AND request_id=?")) {
      p.setString(1,tenant); p.setString(2,request);
      try (ResultSet r = p.executeQuery()) { return r.next() ? r.getString(1) : "ABSENT"; }
    }
  }
}
