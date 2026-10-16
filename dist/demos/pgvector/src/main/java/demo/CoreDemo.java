package demo;

public class CoreDemo {
  public static void main(String[] args) throws Exception {
    try (var c = PgStore.connect()) {
      PgStore.setup(c, false);
      PgStore.upsert(c, false, "team-a", "toy-1", "请假流程（教学方向1）", "toy-3d", new double[]{1,0,0});
      PgStore.upsert(c, false, "team-a", "toy-2", "报销流程（教学方向2）", "toy-3d", new double[]{0,1,0});
      PgStore.upsert(c, false, "team-b", "toy-3", "另一租户内容", "toy-3d", new double[]{1,0,0});
      PgStore.search(c, false, "team-a", "toy-3d", new double[]{0.9,0.1,0});
    }
  }
}
