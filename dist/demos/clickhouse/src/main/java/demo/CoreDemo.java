package demo;
import java.util.*;
public class CoreDemo {
  public static void main(String[] args) throws Exception {
    ClickSupport.schema(); String batch = "demo_" + UUID.randomUUID();
    ClickSupport.insert(List.of(
      ClickSupport.event(batch,"demo_core","demo_e1","model-a",100,30,800),
      ClickSupport.event(batch,"demo_core","demo_e2","model-a",200,40,1200)));
    System.out.println("batch=" + batch);
    System.out.println(ClickSupport.usage("demo_core",batch));
  }
}
