package demo;
import io.temporal.api.workflowservice.v1.GetSystemInfoRequest;
public class ConnectDemo {
  public static void main(String[] args) {
    try (var support = new TemporalSupport()) {
      System.out.println(support.service.blockingStub()
        .getSystemInfo(GetSystemInfoRequest.newBuilder().build()));
    }
  }
}
