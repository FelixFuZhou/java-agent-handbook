package demo;
import java.sql.*;
import java.util.*;
public final class PgStore {
  public static Connection connect() throws SQLException {
    return DriverManager.getConnection(Env.get("PG_URL", "jdbc:postgresql://localhost:5432/agent_demo"),
        Env.required("PG_USER"), Env.required("PG_PASSWORD"));
  }
  private static String table(boolean real) { return real ? "lesson_chunks_real" : "lesson_chunks_toy"; }
  public static void setup(Connection c, boolean real) throws SQLException {
    String table = table(real); int dim = real ? Embeddings.DIM : 3;
    try (var s = c.createStatement()) {
      s.execute("CREATE EXTENSION IF NOT EXISTS vector");
      s.execute("CREATE TABLE IF NOT EXISTS " + table + " (tenant text NOT NULL, id text NOT NULL, "
          + "content text NOT NULL, model_id text NOT NULL, embedding vector(" + dim + ") NOT NULL, PRIMARY KEY(tenant,id))");
      s.execute("CREATE INDEX IF NOT EXISTS " + table + "_hnsw ON " + table + " USING hnsw (embedding vector_cosine_ops)");
    }
  }
  public static void upsert(Connection c, boolean real, String tenant, String id,
      String text, String model, double[] vector) throws SQLException {
    if (vector.length != (real ? Embeddings.DIM : 3)) throw new IllegalArgumentException("维度不符");
    try (var p = c.prepareStatement("INSERT INTO " + table(real)
        + " (tenant,id,content,model_id,embedding) VALUES (?,?,?,?,?::vector) "
        + "ON CONFLICT(tenant,id) DO UPDATE SET content=EXCLUDED.content, model_id=EXCLUDED.model_id, embedding=EXCLUDED.embedding")) {
      p.setString(1, tenant); p.setString(2, id); p.setString(3, text); p.setString(4, model);
      p.setString(5, Arrays.toString(vector)); p.executeUpdate();
    }
  }
  public static void search(Connection c, boolean real, String tenant, String model, double[] query) throws SQLException {
    String sql = "SELECT id,tenant,content,embedding <=> ?::vector AS distance FROM " + table(real)
        + " WHERE tenant=? AND model_id=? ORDER BY embedding <=> ?::vector LIMIT ?";
    try (var p = c.prepareStatement(sql)) {
      p.setString(1, Arrays.toString(query)); p.setString(2, tenant); p.setString(3, model);
      p.setString(4, Arrays.toString(query)); p.setInt(5, 2);
      try (var rows = p.executeQuery()) {
        while (rows.next()) System.out.printf(Locale.ROOT, "[%s] tenant=%s distance=%.5f %s%n",
            rows.getString("id"), rows.getString("tenant"), rows.getDouble("distance"), rows.getString("content"));
      }
    }
  }
}
