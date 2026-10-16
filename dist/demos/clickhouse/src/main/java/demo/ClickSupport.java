package demo;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;

public final class ClickSupport {
  static final ObjectMapper JSON = new ObjectMapper();
  static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
  private ClickSupport() {}
  static String sql(String sql, Map<String,String> params) throws Exception {
    String base = Env.get("DEMO_CLICKHOUSE_URL","http://localhost:8123").replaceAll("/+$","");
    StringBuilder url = new StringBuilder(base).append("/?wait_end_of_query=1");
    for (var e : params.entrySet()) url.append("&param_").append(e.getKey()).append("=")
      .append(URLEncoder.encode(e.getValue(),StandardCharsets.UTF_8));
    var request = HttpRequest.newBuilder(URI.create(url.toString())).timeout(Duration.ofSeconds(20))
      .header("X-ClickHouse-User",Env.get("DEMO_CLICKHOUSE_USER","default"))
      .header("X-ClickHouse-Key",Env.required("DEMO_CLICKHOUSE_PASSWORD"))
      .header("Content-Type","text/plain; charset=utf-8")
      .POST(HttpRequest.BodyPublishers.ofString(sql)).build();
    var response = HTTP.send(request,HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() / 100 != 2) throw new IllegalStateException(
      "ClickHouse HTTP " + response.statusCode() + ": " + response.body().substring(0,Math.min(400,response.body().length())));
    return response.body();
  }
  static void schema() throws Exception {
    sql("CREATE TABLE IF NOT EXISTS default.demo_agent_usage (" +
      "event_id String, batch_id String, tenant_id String, model LowCardinality(String), " +
      "input_tokens UInt32, output_tokens UInt32, duration_ms UInt32, " +
      "event_time DateTime DEFAULT now()) " +
      "ENGINE=MergeTree ORDER BY (tenant_id,event_time,batch_id,event_id)",Map.of());
  }
  static Map<String,Object> event(String batch, String tenant, String id, String model,
                                   int input, int output, int duration) {
    return Map.of("event_id",id,"batch_id",batch,"tenant_id",tenant,"model",model,
      "input_tokens",input,"output_tokens",output,"duration_ms",duration);
  }
  static void insert(List<Map<String,Object>> events) throws Exception {
    StringBuilder body = new StringBuilder("INSERT INTO default.demo_agent_usage FORMAT JSONEachRow\n");
    for (var event : events) body.append(JSON.writeValueAsString(event)).append('\n');
    // 一个 HTTP 请求批量写入；超时结果不确定，本例不会自动重试。
    sql(body.toString(),Map.of());
  }
  static String usage(String tenant, String batch) throws Exception {
    return sql("SELECT model,count() AS calls,sum(input_tokens) AS input_tokens," +
      "sum(output_tokens) AS output_tokens,quantile(0.95)(duration_ms) AS p95_ms " +
      "FROM default.demo_agent_usage WHERE tenant_id={tenant:String} AND batch_id={batch:String} " +
      "GROUP BY model ORDER BY model FORMAT JSONEachRow",Map.of("tenant",tenant,"batch",batch));
  }
}
