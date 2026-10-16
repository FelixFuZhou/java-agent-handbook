package demo;
import java.util.*;
public class CoreDemo {
  public static void main(String[] args) throws Exception {
    var ids = List.of("account#0", "expense#0", "ops#0");
    var docs = List.of("账号登录需要企业邮箱。", "差旅报销需提交发票与审批单。", "连接池过小时请求会排队。");
    for (var hit : Rerank.rank("出差报销需要哪些附件？", docs, 2))
      System.out.printf(Locale.ROOT, "[%s] score=%.5f %s%n", ids.get(hit.index()), hit.score(), hit.text());
  }
}
