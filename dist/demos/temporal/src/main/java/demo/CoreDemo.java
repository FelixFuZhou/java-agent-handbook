package demo;
import io.temporal.worker.WorkerFactory;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
public class CoreDemo {
  public static void main(String[] args) throws Exception {
    if (args.length != 1) throw new IllegalArgumentException("参数：worker 或 start");
    try (var support = new TemporalSupport()) {
      if (args[0].equals("worker")) {
        var factory = WorkerFactory.newInstance(support.client);
        var worker = factory.newWorker(TemporalSupport.queue());
        worker.registerWorkflowImplementationTypes(DemoWorkflowImpl.class);
        worker.registerActivitiesImplementations(new ToyActivities());
        Runtime.getRuntime().addShutdownHook(new Thread(factory::shutdown));
        factory.start();
        System.out.println("READY queue=" + TemporalSupport.queue());
        try { new CountDownLatch(1).await(); }
        finally { factory.shutdown(); }
      } else if (args[0].equals("start")) {
        String id = "demo-core-" + UUID.randomUUID();
        System.out.println(support.newRun(id).run(id));
      } else throw new IllegalArgumentException("参数：worker 或 start");
    }
  }
}
