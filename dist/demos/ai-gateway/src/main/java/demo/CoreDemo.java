package demo;
import java.util.UUID;
public class CoreDemo {
  public static void main(String[] args) throws Exception {
    var response = Gateway.send(Env.get("AI_MODEL", "qwen-plus"), "只回答：连接成功", UUID.randomUUID().toString());
    System.out.println("status=" + response.statusCode());
    System.out.println("retry-after=" + response.headers().firstValue("retry-after").orElse("none"));
    System.out.println("upstream-request-id=" + response.headers().firstValue("x-request-id").orElse("not exposed"));
    if (response.statusCode() == 429) System.out.println("达到配额，向用户返回稍后重试，不启动无限重试。");
    else if (response.statusCode() == 401 || response.statusCode() == 403)
      throw new IllegalStateException("检查入口凭据/应用权限，重试不能修复鉴权错误。");
    else System.out.println(Gateway.answer(response));
  }
}
