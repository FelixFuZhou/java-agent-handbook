package demo;
import java.time.Duration;
import com.fasterxml.jackson.databind.ObjectMapper;
public class ScenarioDemo {
  public static void main(String[] args) throws Exception {
    String csv = "item,amount\nhotel,300\ntrain,250\nmeal,100\n";
    String code = "import csv,sys,json; from decimal import Decimal; rows=list(csv.DictReader(sys.stdin)); "
      + "print(json.dumps({'rows':len(rows),'total':str(sum((Decimal(r['amount']) for r in rows),Decimal(0)))}))";
    var result = ContainerRunner.python(code, csv, Duration.ofSeconds(10));
    if (result.exitCode() != 0) throw new IllegalStateException("计算失败：" + result.output());
    var json = new ObjectMapper().readTree(result.output());
    if (json.path("rows").asInt(-1) != 3 || !json.hasNonNull("total"))
      throw new IllegalStateException("工具响应不符合约定");
    System.out.println(json);
    System.out.println("研究 Agent 可引用该汇总结果；此计算结果不代表来源数据已被核实。");
  }
}
