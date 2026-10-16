package demo;
import java.util.Set;
import java.util.UUID;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    String id = UUID.randomUUID().toString();
    // 此处固定片段模拟已完成权限过滤的检索结果；不是从模型猜测企业制度。
    String prompt = "仅根据以下资料回答并引用文档编号。资料：[policy-01] 差旅报销需在返回后30天内提交。问题：什么时候提交报销？";
    String model = Env.get("AI_MODEL", "qwen-plus");
    var response = Gateway.send(model, prompt, id);
    if (Set.of(502, 503, 504).contains(response.statusCode())) {
      model = Env.required("AI_FALLBACK_MODEL");
      System.out.println("requestId=" + id + " fallback=" + model);
      response = Gateway.send(model, prompt, id);
    }
    System.out.println("requestId=" + id + " model=" + model);
    System.out.println(Gateway.answer(response));
  }
}
