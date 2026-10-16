package demo;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.TimeUnit;

public final class ContainerRunner {
  public record Result(int exitCode, String output) {}
  public static Result python(String code, String input, Duration timeout) throws Exception {
    // 不允许模型提供镜像、挂载或 docker 参数；使用参数数组，避免 host shell 拼接。
    String name = "demo-sandbox-" + UUID.randomUUID();
    List<String> command = new ArrayList<>(List.of("docker", "run", "--rm", "-i", "--pull=never",
      "--name", name, "--network=none", "--read-only", "--cap-drop=ALL",
      "--security-opt=no-new-privileges", "--pids-limit=64", "--memory=128m",
      "--memory-swap=128m", "--cpus=0.5", "--user=65534:65534",
      "--tmpfs=/tmp:rw,noexec,nosuid,size=16m", Env.get("SANDBOX_IMAGE", "python:3.12-slim"),
      "python", "-c", code));
    Process process = new ProcessBuilder(command).redirectErrorStream(true).start();
    ByteArrayOutputStream capture = new ByteArrayOutputStream();
    Thread reader = new Thread(() -> {
      try (InputStream stream = process.getInputStream()) {
        byte[] buffer = new byte[4096]; int n;
        while ((n = stream.read(buffer)) != -1) {
          int remaining = 65536 - capture.size();
          if (remaining > 0) capture.write(buffer, 0, Math.min(n, remaining));
          // 超出 64 KiB 继续排空，但不继续占用内存。
        }
      } catch (IOException ignored) { }
    }, "sandbox-output");
    reader.setDaemon(true); reader.start();
    try {
      try (var stdin = process.getOutputStream()) { stdin.write(input.getBytes(StandardCharsets.UTF_8)); }
      if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS))
        throw new IllegalStateException("任务超时，回收容器 " + name);
      reader.join(2000);
      return new Result(process.exitValue(), capture.toString(StandardCharsets.UTF_8));
    } finally {
      // 销毁客户端进程并不能保证容器已结束，因此按唯一名称显式回收。
      Process cleanup = new ProcessBuilder("docker", "rm", "-f", name)
        .redirectOutput(ProcessBuilder.Redirect.DISCARD).redirectError(ProcessBuilder.Redirect.DISCARD).start();
      if (!cleanup.waitFor(5, TimeUnit.SECONDS)) cleanup.destroyForcibly();
      if (process.isAlive()) process.destroyForcibly();
      reader.join(2000);
    }
  }
}
