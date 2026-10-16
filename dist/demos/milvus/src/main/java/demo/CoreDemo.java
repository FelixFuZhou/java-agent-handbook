package demo;
import java.util.*;
public class CoreDemo {
  public static void main(String[] args) throws Exception {
    MilvusStore.setup(false);
    MilvusStore.upsert(false, List.of(
        MilvusStore.row(1, "team-a", "教学方向1", "toy-3d", new double[]{1,0,0}),
        MilvusStore.row(2, "team-a", "教学方向2", "toy-3d", new double[]{0,1,0}),
        MilvusStore.row(3, "team-b", "不应返回的另一租户", "toy-3d", new double[]{1,0,0})));
    MilvusStore.search(false, new double[]{0.9,0.1,0}, "toy-3d");
  }
}
