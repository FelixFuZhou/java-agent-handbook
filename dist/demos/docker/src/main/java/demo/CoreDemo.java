package demo;
public class CoreDemo {
  public static void main(String[] args) {
    System.out.println("tenant=" + Env.required("WORKER_TENANT"));
    System.out.println("maxHeapMiB=" + Runtime.getRuntime().maxMemory() / 1024 / 1024);
  }
}
