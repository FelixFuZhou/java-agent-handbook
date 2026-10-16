package demo;
import java.util.UUID;
public class ConnectDemo {
  public static void main(String[] args) throws Exception {
    var response = Gateway.send(Env.get("AI_MODEL", "qwen-plus"),
      "用一句话解释检索增强生成。", UUID.randomUUID().toString());
    System.out.println(Gateway.answer(response));
  }
}
