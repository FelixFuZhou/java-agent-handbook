package demo;
import java.util.*;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    ClickSupport.schema(); String batch = "demo_" + UUID.randomUUID();
    // 固定 usage 模拟模型返回的计数；本项目不调用模型，也不推算实时价格。
    ClickSupport.insert(List.of(
      ClickSupport.event(batch,"demo_alpha","demo_call_1","model-a",300,50,1000),
      ClickSupport.event(batch,"demo_alpha","demo_call_2","model-a",500,100,1600),
      ClickSupport.event(batch,"demo_alpha","demo_call_3","model-b",200,40,700),
      ClickSupport.event(batch,"demo_beta","demo_call_4","model-a",9999,999,1800)));
    String authenticatedTenant = "demo_alpha";
    System.out.println("batch=" + batch);
    System.out.println(ClickSupport.usage(authenticatedTenant,batch));
    System.out.println("任务成功率应关联任务最终状态，不能从本调用表直接推出。");
  }
}
