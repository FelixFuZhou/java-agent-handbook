# MongoDB：会话查询、版本与 TTL

真实写入独立消息文档，按租户与会话检索，创建 TTL 索引并在读取时立即排除已过期数据。

## 场景

知识助手保留短期会话历史；同名 session_id 不能跨租户混读，过期上下文即使尚未物理删除也不能进入模型。

## 运行前提

- JDK 17+、Maven 3.6.3+；MongoDB Java Sync Driver 5.3.1。
- MongoDB 7.0 或 8.0 已可访问；账号拥有 demo_agent 数据库的读写与创建索引权限。示例仅操作 demo_messages 集合。
- TTL 后台清理是异步的，不承诺到点立即删除。此例没有跨文档事务，因此单机 MongoDB 也可学习。

所有命令在本项目根目录执行。Java 示例要求 JDK 17+ 和 Maven 3.6.3+。下面环境变量命令适用于 macOS/Linux 的 bash/zsh；Windows 请用 PowerShell 的 $env:NAME='值'。环境变量示例中的占位值必须替换，勿把实际密钥提交到代码仓库。

```bash
# 有认证时配置用户、密码和正确 authSource；不把 URI 输出到日志。数据库固定为 demo_agent。
export DEMO_MONGO_URI='mongodb://localhost:27017/?serverSelectionTimeoutMS=5000&connectTimeoutMS=5000'
```

## 01 基础接入 · Ping 与集合准备

运行 ping 并建立复合索引和 TTL 索引。

- MongoClient 生命周期
- 集合仅限 demo_agent.demo_messages

阅读源码：

- [src/main/java/demo/ConnectDemo.java](src/main/java/demo/ConnectDemo.java)
- [src/main/java/demo/MongoSupport.java](src/main/java/demo/MongoSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ConnectDemo
```

预期：

- 输出 {ok:1} 与 demo indexes ready。

排障：

- Server selection timeout：检查地址、端口和副本集对外公布的主机名。
- Authentication failed：核对 authSource 与学习账号授权。

## 02 核心功能 · Upsert 与 TTL

对相同消息 ID 重复写入，再读取指定会话；打印 TTL 索引定义。

- 稳定 _id 实现重复写入覆盖
- Date 类型 expire_at
- TTL 单字段索引

阅读源码：

- [src/main/java/demo/CoreDemo.java](src/main/java/demo/CoreDemo.java)
- [src/main/java/demo/MongoSupport.java](src/main/java/demo/MongoSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.CoreDemo
```

预期：

- 同一消息重复写后 history size=1。
- 索引定义包含 expireAfterSeconds:0。

排障：

- IndexOptionsConflict：学习集合已有同名但不同 TTL 的索引；核对后由管理员修正教学索引。
- expire_at 是字符串时不会按预期过期，必须存 BSON Date。

## 03 场景应用 · 隔离上下文与过期过滤

写入两个租户的同名会话和一条过期消息；只读取当前租户有效历史。

- 登录租户来自应用
- 排除过期消息不等待后台删除
- 聊天记忆不是任务账本

阅读源码：

- [src/main/java/demo/ScenarioDemo.java](src/main/java/demo/ScenarioDemo.java)
- [src/main/java/demo/MongoSupport.java](src/main/java/demo/MongoSupport.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ScenarioDemo
```

预期：

- 输出 demo_alpha 的 user 和 assistant 两条消息。
- 不出现 demo_beta 的内部内容，也不出现 expired 内容。

排障：

- 看到别的租户内容：检查所有读取路径的 tenant_id 条件。
- 消息数异常：检查 created_at/expire_at 时钟与旧运行数据；示例固定主键会替换对应教学记录。

## 验证边界

已通过 Maven 编译（JDK 21，--release 17）。外部服务待按前提联调

编译验证不等同于运行联调或生产故障演练。项目内教学数据、模拟的业务步骤和省略的生产机制，以页面及源码说明为准。

## 官方资料

- [MongoDB Java Sync Driver](https://www.mongodb.com/docs/drivers/java/sync/current/)
- [MongoDB TTL 索引](https://www.mongodb.com/docs/manual/core/index-ttl/)
