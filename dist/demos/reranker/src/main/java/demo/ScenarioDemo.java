package demo;
import java.util.*;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    Map<String,String> corpus = Map.of("policy#0", "差旅报销应在返回后30天内提交。",
        "policy#1", "报销需提供发票、行程单及审批记录。", "account#0", "忘记密码请联系账号管理员。");
    // 固定排名模拟已经完成租户权限过滤的检索器输出。
    var fused = Rerank.fuse(List.of(List.of("policy#1", "account#0", "policy#0"),
        List.of("policy#0", "policy#1")));
    System.out.println("RRF=" + fused);
    var docs = fused.stream().map(corpus::get).toList();
    var hits = Rerank.rank(Env.get("QUESTION", "报销的截止时间是什么，还要什么材料？"), docs, 2);
    System.out.println("reranked context:");
    for (var hit : hits) System.out.printf(Locale.ROOT, "[%s] score=%.5f %s%n",
        fused.get(hit.index()), hit.score(), hit.text());
  }
}
