package demo;
import redis.clients.jedis.Jedis;
import java.net.URI;
import java.util.List;

public final class RedisSupport {
  private RedisSupport() {}
  static Jedis open() {
    return new Jedis(URI.create(Env.get("DEMO_REDIS_URI", "redis://localhost:6379/0")), 5000);
  }
  static String key(String tenant, String suffix) {
    if (!tenant.matches("[a-zA-Z0-9_-]+")) throw new IllegalArgumentException("非法演示租户");
    return "demo_agent:{" + tenant + "}:" + suffix;
  }
  static boolean allow(Jedis jedis, String tenant, String action, int limit, int seconds) {
    if (limit < 1 || seconds < 1) throw new IllegalArgumentException("限额与窗口须为正数");
    String lua = "local n=redis.call('INCR',KEYS[1]); " +
      "if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[2]); end; " +
      "if n<=tonumber(ARGV[1]) then return 1 else return 0 end";
    Object result = jedis.eval(lua, List.of(key(tenant,"limit:" + action)),
      List.of(Integer.toString(limit),Integer.toString(seconds)));
    return ((Number) result).longValue() == 1;
  }
  static String cachedPolicy(Jedis jedis, String tenant, String version) {
    String key = key(tenant,"cache:policy:" + version);
    String cached = jedis.get(key);
    if (cached != null) {
      System.out.println("cache hit tenant=" + tenant); return cached;
    }
    // 固定数据模拟已鉴权的数据源，生产替换成真实业务查询。
    String policy = tenant.equals("demo_alpha") ? "报销期限30天" : "报销期限15天";
    jedis.setex(key,60,policy);
    System.out.println("cache miss tenant=" + tenant);
    return policy;
  }
}
