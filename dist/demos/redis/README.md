# Redis：租户缓存与 Lua 限流

真实调用 Redis 验证字符串、TTL 和 Lua 原子计数，再为知识助手构建租户隔离缓存和有限请求预算。

## 场景

不同企业的报销制度不能共用答案缓存；模型调用前按租户限流，缓存失效后重新读取业务事实。

## 运行前提

- JDK 17+、Maven 3.6.3+；锁定 Jedis 5.2.0。
- 已运行 Redis 7.2+；账号需允许 demo_agent:* 键的 GET、SET/SETEX、TTL、DEL、INCR、EXPIRE、EVAL，以及 PING。
- 示例限流是单 key 固定窗口，Redis Lua 原子执行；不等同于滑动窗口或分布式并发信号量。没有使用 FLUSHDB。

所有命令在本项目根目录执行。Java 示例要求 JDK 17+ 和 Maven 3.6.3+。下面环境变量命令适用于 macOS/Linux 的 bash/zsh；Windows 请用 PowerShell 的 $env:NAME='值'。环境变量示例中的占位值必须替换，勿把实际密钥提交到代码仓库。

```bash
# 支持 redis://用户名:密码@主机:端口/库；TLS 使用 rediss://；避免把带密码的 URI 写进日志。
export DEMO_REDIS_URI='redis://localhost:6379/0'
```

## 01 基础接入 · PING 与连接关闭

通过真实连接确认 Redis 就绪，不依赖框架自动装配。

- 连接超时
- 凭据 URI 与资源关闭

阅读源码：

- [src/main/java/demo/ConnectDemo.java](src/main/java/demo/ConnectDemo.java)
- [src/main/java/demo/RedisSupport.java](src/main/java/demo/RedisSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ConnectDemo
```

预期：

- 打印 PONG。

排障：

- NOAUTH/WRONGPASS：核对 ACL 用户与密码。
- Connection refused：确认宿主机访问的是映射端口，而非容器内部地址。

## 02 核心功能 · TTL 与原子限流

写入一个专用演示缓存，并在同一个窗口连续调用四次 Lua。

- 缓存键有租户与版本
- INCR 和首次 EXPIRE 在一个脚本内
- 最多允许三次，第四次拒绝

阅读源码：

- [src/main/java/demo/CoreDemo.java](src/main/java/demo/CoreDemo.java)
- [src/main/java/demo/RedisSupport.java](src/main/java/demo/RedisSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.CoreDemo
```

预期：

- 读取值 demo answer，TTL 为 1–60 秒。
- allowed 依次为 true、true、true、false；不同运行使用不同演示窗口键。

排障：

- NOPERM：EVAL 和脚本使用的命令都需要授权。
- TTL=-1 表示未设置过期，TTL=-2 表示键不存在或刚过期。

## 03 场景应用 · 知识助手缓存边界

清理本项目两枚固定缓存键，分别查询两租户并观察第二次查询命中。

- 权限身份由应用注入
- 版本变化形成新缓存键
- Redis 故障不能宣称任务已成功

阅读源码：

- [src/main/java/demo/ScenarioDemo.java](src/main/java/demo/ScenarioDemo.java)
- [src/main/java/demo/RedisSupport.java](src/main/java/demo/RedisSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ScenarioDemo
```

预期：

- demo_alpha 返回30天，demo_beta 返回15天。
- 每租户先 miss 后 hit；超过限额时输出限流提示。

排障：

- 两个租户内容相同：检查 key 中租户与版本是否完整。
- 生产回源需做并发合并和降级预算；本例固定数据源仅用于理解缓存边界。

## 验证边界

已通过 Maven 编译（JDK 21，--release 17）。外部服务待按前提联调

编译验证不等同于运行联调或生产故障演练。项目内教学数据、模拟的业务步骤和省略的生产机制，以页面及源码说明为准。

## 官方资料

- [Jedis 官方接入指南](https://redis.io/docs/latest/develop/clients/jedis/)
- [Redis EVAL](https://redis.io/docs/latest/commands/eval/)
