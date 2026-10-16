package demo;
import java.util.*;
public class ConnectDemo {
  public static void main(String[] args) throws Exception {
    var hits = Rerank.rank("报销需要什么材料？", List.of("报销需提供发票和审批记录。", "账号密码可在账号中心重置。"), 2);
    hits.forEach(System.out::println);
  }
}
