# 文档解析：Tika 提取、分块与可追溯元数据

纯 Java 完整管线：识别 MIME、提取文本、按 Unicode 码点分块，并输出带租户/版本/稳定 ID 的 JSONL。

## 场景

知识库入库 Worker 接收一份文件，产出可重复导入的片段记录，为 Embedding、索引和引用提供一致契约。

## 运行前提

- JDK 17+、Maven 3.6.3+；项目依赖已固定版本。先在下载项目的根目录执行命令。
- 所有环境变量由运行命令的终端提供，Env.java 不会自动加载 .env 文件。
- 锁定 Apache Tika 3.2.3 core + standard parsers、Jackson 2.18.2；首次 Maven 下载依赖可能较多。升级解析库前重新核验安全公告与解析差异。
- 默认 sample.txt 随项目下载，可直接运行；也可以设置 DOCUMENT_PATH 指向文本型 PDF、DOCX 等本地文件。限制输入20MiB、输出20万字符，超限报错。
- 此示例展示 Tika 基础文本抽取，不承诺扫描 OCR、版面顺序、表格结构或页码精度。复杂文档请按课程使用 MinerU/PaddleOCR 等解析服务并保留结构。

所有命令在本项目根目录执行。Java 示例要求 JDK 17+ 和 Maven 3.6.3+。下面环境变量命令适用于 macOS/Linux 的 bash/zsh；Windows 请用 PowerShell 的 $env:NAME='值'。环境变量示例中的占位值必须替换，勿把实际密钥提交到代码仓库。

```bash
# 默认使用附带样本文本，或填写实际本地文件绝对路径。
export DOCUMENT_PATH='sample.txt'
# 演示租户身份；真实服务由认证上下文提供，不能让上传者自由指定。
export DOCUMENT_TENANT='team-a'
# 稳定逻辑文档标识；不同业务文档必须不同，不使用临时文件路径作主键。
export DOCUMENT_SOURCE='employee-handbook-v1'
# 本例输出路径，会覆盖同路径的演示产物。
export OUTPUT_PATH='target/chunks.jsonl'
```

## 01 基础接入 · 文件与 MIME

读取附带样本或用户指定文件，检查大小并识别 MIME。

- Tika core 负责类型识别
- 文件输入有限制

阅读源码：

- [src/main/java/demo/ConnectDemo.java](src/main/java/demo/ConnectDemo.java)
- [src/main/java/demo/Documents.java](src/main/java/demo/Documents.java)
- [sample.txt](sample.txt)
- [pom.xml](pom.xml)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ConnectDemo
```

预期：

- 打印字节数、SHA-256 和 MIME，sample.txt 通常为 text/plain。

排障：

- 文件不存在检查当前目录和 DOCUMENT_PATH；不是所有 MIME 都有可用解析器。

## 02 核心功能 · 提取与重叠分块

使用 standard parsers 提取文本，以 80 码点窗口/16 码点重叠演示切分。

- UTF-16 代理对不被切断
- 稳定逻辑文档 ID 与内容版本分离
- 码点偏移不是 PDF 页码

阅读源码：

- [src/main/java/demo/CoreDemo.java](src/main/java/demo/CoreDemo.java)
- [src/main/java/demo/Documents.java](src/main/java/demo/Documents.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.CoreDemo
```

预期：

- 打印 documentId、version 和多个 chunk 的区间与文本；相同输入重复运行 ID 不变。

排障：

- 空文本可能是扫描件，不能直接假定文档无内容；WriteLimitReached 表示超过上限，不应索引残缺结果。
- 若出现缺少 SLF4J/Log4j provider 提示，这是日志实现未配置；以退出码和解析产物判断是否成功，实际项目应接入统一日志。

## 03 场景应用 · 生成可追溯入库清单

生成 JSONL 片段，每条包含稳定主键、文档版本、租户、来源、解析器版本与文本。

- 相同输入重复导入可按 chunkId upsert
- 内容变更产生新 version
- 旧版本清理由下游按文档版本策略执行

阅读源码：

- [src/main/java/demo/ScenarioDemo.java](src/main/java/demo/ScenarioDemo.java)
- [src/main/java/demo/Documents.java](src/main/java/demo/Documents.java)

运行：

```bash
mvn -q compile exec:java -Dexec.mainClass=demo.ScenarioDemo
```

预期：

- 打印输出文件路径和 chunk 数；target/chunks.jsonl 可供后续 Embedding Worker 读取。

排障：

- 同一逻辑文档更新后应切换活跃版本/删除旧块，不能只追加；真实生产按标题和表格结构切分，而非只按字符。

## 验证边界

已通过 Maven 编译（JDK 21，--release 17）。本地 TXT → JSONL 场景已运行；PDF/OCR 未验证

编译验证不等同于运行联调或生产故障演练。项目内教学数据、模拟的业务步骤和省略的生产机制，以页面及源码说明为准。

## 官方资料

- [Apache Tika 3.2.3 Maven 与解析组件](https://tika.apache.org/3.2.3/gettingstarted.html)
- [Apache Tika Java 使用示例](https://tika.apache.org/3.2.3/examples.html)
