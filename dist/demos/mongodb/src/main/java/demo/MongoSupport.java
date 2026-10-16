package demo;
import com.mongodb.client.*;
import com.mongodb.client.model.*;
import org.bson.Document;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;
import static com.mongodb.client.model.Filters.*;

public final class MongoSupport {
  private MongoSupport() {}
  static MongoClient open() {
    return MongoClients.create(Env.get("DEMO_MONGO_URI",
      "mongodb://localhost:27017/?serverSelectionTimeoutMS=5000&connectTimeoutMS=5000"));
  }
  static MongoCollection<Document> messages(MongoClient client) {
    return client.getDatabase("demo_agent").getCollection("demo_messages");
  }
  static void schema(MongoClient client) {
    var c = messages(client);
    c.createIndex(Indexes.compoundIndex(Indexes.ascending("tenant_id"),
      Indexes.ascending("session_id"),Indexes.ascending("created_at")));
    c.createIndex(Indexes.ascending("expire_at"),
      new IndexOptions().name("demo_expire_at_ttl").expireAfter(0L,TimeUnit.SECONDS));
  }
  static void put(MongoClient client, String tenant, String session, String turn,
                  String role, String content, Instant created, Instant expire) {
    if (!tenant.startsWith("demo_") || !session.startsWith("demo_"))
      throw new IllegalArgumentException("仅允许演示租户和会话");
    if (!Set.of("user","assistant").contains(role)) throw new IllegalArgumentException("非法角色");
    String id = tenant + ":" + session + ":" + turn;
    var doc = new Document("_id",id).append("tenant_id",tenant)
      .append("session_id",session).append("turn_id",turn).append("role",role)
      .append("content",content).append("created_at",Date.from(created))
      .append("expire_at",Date.from(expire)).append("schema_version",1);
    messages(client).replaceOne(and(eq("_id",id),eq("tenant_id",tenant)),doc,new ReplaceOptions().upsert(true));
  }
  static List<Document> history(MongoClient client, String tenant, String session) {
    // TTL 清理异步；逻辑查询也排除已过期文档。
    return messages(client).find(and(eq("tenant_id",tenant),eq("session_id",session),
        gt("expire_at",new Date())))
      .sort(Sorts.ascending("created_at","_id")).limit(20).into(new ArrayList<>());
  }
  static void print(List<Document> history) {
    for (var d : history) System.out.println(d.getString("role") + ": " + d.getString("content"));
  }
}
