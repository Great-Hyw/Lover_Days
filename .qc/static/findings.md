# 后端 Java 代码静态复核报告（复审当前工作区）

- **复核对象**：`D:\DSH_vue\dfg\demo`（当前工作区代码 = `HEAD 495fe61 "0.1.2.4"` + 未提交改动；index 中仍是审计前旧内容，工作区是重构后新内容，`git diff` 即"审计后全部改动"）。
- **审计基准**：`docs/后端代码质量审计报告.md`（45 项：P0×3 / P1×16 / P2×14 / P3×12）。
- **行号口径**：本报告所有 `file:line` 均为**当前工作区真实行号**（用 read/grep -n 重新确认），审计报告中的旧行号已漂移，不可直接引用。
- **方法**：只读静态审查（read/grep/glob + 只读 git 命令），未启动服务、未连数据库、未执行测试、未修改任何源码/配置/env/git 状态。构建产物（`demo/target`、jar）仅做只读检查。
- **唯一一次动态辅助验证**：为判定 P0-3 的关键未知项（`CF_SITEKEY` 里放的到底是公开 site key 还是 secret），向 Cloudflare `siteverify` 发了一次带**假 token** 的只读校验请求（无副作用），结论见 §4.2。其余无法静态判定项已在表中标注。
- **统计口径**：一条审计项只落一个结论；"部分修复"= 原问题的要害子项已修但仍有子项成立。

---

## 1. 统计总览

| 级别 | 条目 | 已修复 | 部分修复 | 仍存在 | 无法静态判定 |
|---|---|---|---|---|---|
| P0 | 3 | 2 | 0 | 1 | 0 |
| P1 | 16 | 2 | 7 | 7 | 0 |
| P2 | 14 | 0 | 1 | 13 | 0 |
| P3 | 12 | 0 | 1 | 11 | 0 |
| **合计** | **45** | **4** | **9** | **32** | **0** |
| **新增问题** | **12** | — | — | — | — |

- 已修复（4）：**P0-1、P0-2、P1-5、P1-6**。
- 部分修复（9）：P1-1、P1-2、P1-4、P1-10、P1-12、P1-14、P1-15、P2-10、P3-2。
- 新增问题 12 条：P0×1、P1×5、P2×3、P3×3（清单见 §5）。

**总体判断**：审计点名的两处最危险问题（纪念日 update 横向越权、密码哈希进响应）确实已修，包名/类名规范化也基本干净。**但当前工作区的运行链路是断的**：
1. **新增 P0（N1）**：JWT 签发与校验对 secret 的派生方式不一致 → 登录能成功，但**此后所有携带 token 的请求都会 401**，等于登录后全站不可用；
2. **P0-3 仍在**：Turnstile 校验链路在失败和成功两条路径上都会 500/NPE（且 `challenge_ts` 类型导致成功响应反序列化失败）；
3. **新增 P1（N2/N3）**：上传写库因 `keyProperty=" id"` 前导空格**必失败**；删图后纪念日背景**永不清空**。

在这些链路问题修好之前，"业务功能正确性"类结论都只能在代码层面成立，实际不可用。

---

## 2. 逐条核对

### 2.1 P0（3 项）

| ID | 结论 | 当前证据（file:line） | 备注与影响 |
|---|---|---|---|
| P0-1 | 已修复 | `demo/src/main/java/com/wei/mapper/AnniversariesMapper.java:33`（update 走 XML）；`demo/src/main/resources/com/wei/mapper/AnniversariesMapper.xml:40-44`（`<where> id=#{id} and user_id=#{userId}</where>`）；`demo/src/main/java/com/wei/service/AnniversariesImpl.java:87`（`update` 从 `CullentUtil.get()` 写入 userId）；`demo/src/main/java/com/wei/mapper/AnniversariesMapper.java:35`（delete 带 userId） | update/delete/GetannID 均以 `user_id` 限定，A 删/改 B 的数据不再可能。属真实修复，已验证 SQL 而非仅看代码。 |
| P0-2 | 已修复 | `demo/src/main/resources/application.yaml:29`（`mapper-locations: classpath:com/wei/mapper/*.xml`，小写）；`demo/src/main/resources/com/wei/mapper/AnniversariesMapper.xml:5`、`PhotoMapper.xml:5`（namespace 均为 `com.wei.mapper.*`）；`demo/target/demo-0.0.1-SNAPSHOT.jar` 内 `BOOT-INF/classes/com/wei/mapper/` 同时含两个 XML，无大写残留 | 源码路径、yaml、namespace、打包产物四层一致，Linux 部署也不会再找不到 Mapper XML。target 下旧大写包目录已无（见 §3.3），此项在源码与打包层均已关闭。 |
| P0-3 | **仍存在**（部分子项经实测重分类） | ① NPE 路径：`demo/src/main/java/com/wei/util/RoobitsUtil.java:26`（`response = null`）、`:38-40`（`return response.getBody()`）、`:41-45`（catch 中 `return response.getBody()`，此时 response 仍为 null → **catch 内再抛 NPE**）；② 无超时：`RoobitsUtil.java:22`（`new RestTemplate()` 无连接/读超时）；③ 空指针调用：`demo/src/main/java/com/wei/controller/RoobitsController.java:29`（`validation.isSuccess()` 无判空）；④ 成功路径反序列化：`demo/src/main/java/com/wei/pojo/TurnstileResponse.java:15`（`challenge_ts` 用 `LocalDateTime`，Cloudflare 返回的是带 `Z` 的 ISO-8601 串，Jackson 3 解析 `LocalDateTime` 会失败）；⑤ 语义混淆：`application.yaml:45`（`Cf.siteKey: ${CF_SITEKEY}`）+ `RoobitsUtil.java:20-21`（字段名叫 `secretKey`，注入的是 `siteKey`） | **实测重分类**：把 `demo/env/dev.env` 的 `CF_SITEKEY` 值当 secret 调 Cloudflare `siteverify`（假 token），返回 `{"error-codes":["invalid-input-response"]}`，而不是 `invalid-input-secret` → **该值当前是合法 secret key**，审计"site key 当 secret 用 → 验证恒失败"的判断**不成立**（是命名/配置键语义混乱，见 §4.2，严重级降为 P2 隐患）。但 NPE + 无超时 + `challenge_ts` 类型错误仍使 `/welcome` 在"校验失败"和"校验成功"两种情况下都可能 500：失败路径 catch 内 NPE；成功路径先反序列化失败（HttpMessageNotReadableException）→ 落到同一个不健全的 catch → NPE。**结论：P0-3 的核心失效仍在，只是根因与审计描述不同。** |

### 2.2 P1（16 项）

| ID | 结论 | 当前证据（file:line） | 备注与影响 |
|---|---|---|---|
| P1-1 | 部分修复 | 已修：`AnniversariesImpl.java:110`（`GetannID` 带 userId 查归属）、`AnniversariesMapper.java:35`（delete 带 user_id）、`PhotoMapper.java:25-26`（`deleteBgImage` 带 user_id）；未修：`AnniversariesImpl.java:121`（`ANN.selectBgimage(b)` 传的 `b` 只有 id+userId，`bgImage` 为 null → SQL `AnniversariesMapper.java:45` 的 `where bg_image=#{bgImage}` 恒不成立 → `list.isEmpty()` 恒真）、`AnniversariesImpl.java:119`（`Photo po = p.selectKey(c)` 无判空）、`:125`（`po.getKey()` 直接解引用）；`AnniversariesMapper.java:45-46`（`selectBgimage` 的 SQL 连 `user_id` 都没有） | 跨用户删数据已堵住；但"图片是否仍被其他纪念日引用"的检查恒为"无引用"，于是**只要有背景图就必然清空纪念日背景并删 OSS 对象**——若同一图片被多条纪念日引用，其余记录会变裂图；若 photo 行不存在 → `po` 为 null → NPE。 |
| P1-2 | 部分修复 | 未修：`AnniversariesImpl.java:104-147` 整个 delete 无 `@Transactional`（全仓库仅 `LoginImpl.java:47` 一处事务），内部 `ANN.delete`→`selectKey`→`deleteBgImage`→`ossUtil.delete` 多步无原子性；已修：`:138-144` 不再吞异常（`log.info` 后 `throw new RuntimeException(e)`） | 失败时仍会留下"DB 已删、OSS 未删"或"OSS 已删、DB 未删"的中间态；且仍是运行时异常直接冒泡到全局处理器（code 500）。另外 `PhotoImpl.delete` 仍是吞异常（见 P1-3）。 |
| P1-3 | **仍存在** | `demo/src/main/java/com/wei/service/PhotoImpl.java:59`（`Anniversaries A = photoMapper.select(p)`）、**`:60`（`A.setId(CullentUtil.get())` —— 应为 `setUserId`）**、`:62`（先删 photo 行）、`:65`（`a.updateann(A, null)`）、`AnniversariesMapper.java:39-40`（SQL `where user_id=#{photo.userId} and bg_image=#{photo.bgImage}`，而 `A.userId` 恒为 null → `user_id = NULL` 恒不成立 → **0 行受影响**）、`:67`（`OssUtil.delete(A.getIkey())`）、`:71-76`（catch 后 `return 0` 吞异常） | 删图流程：photo 行删除成功 → 尝试把纪念日 `bg_image` 置空但 SQL 永远匹配不到（user_id=NULL）→ 纪念日仍指向已被删的 OSS 对象 → 前端背景图 404；同时 OSS 对象被删、DB 背景字段残留，数据不一致。异常被吞成 `返回 0`，前端只看到"删除错误"而实际已删一半。**这是本轮最直接的"新根因"（N3）。** |
| P1-4 | 部分修复 | 已修：`PhotoImpl.java:40-49`（写库失败时 `OssUtil.delete(arg[1])` 补偿并 rethrow）、upload 不再改纪念日 `bgImage`（符合接口规范 3.5.6）；未修/新伤：`PhotoImpl.java:32`（仍是先传 OSS 后写库）、`:30`（`Integer id` 参数完全未使用）、**`PhotoMapper.java:14`（`@Options(useGeneratedKeys = true, keyProperty = " id")` —— 属性名带前导空格 → MyBatis 写库后回填 id 时找不到 setter，抛 ReflectionException → 上传必失败，见 N2）** | 补偿逻辑方向正确；但 keyProperty 的笔误使整条上传链路不可用，补偿逻辑反而变成"每次上传都先传 OSS 再删掉"。 |
| P1-5 | 已修复 | `demo/src/main/java/com/wei/pojo/User.java:19`（`@JsonProperty(access = WRITE_ONLY)` 修饰 password，附注释说明不用 `@JsonIgnore` 的原因）、`:28-38`（toString 已删 password/token）；`demo/src/main/java/com/wei/mapper/LoginMapper.java:16-17`（profile 查询改为 `select id, user_name, nick_name, avatar`，不再查 password）；`demo/src/test/java/com/wei/UserJsonTest.java:21-42`（序列化/反序列化契约测试） | 登录、注册、profile 三处响应经同一 `User` 类型，WRITE_ONLY 统一生效；日志侧也一并干净（见 P1-6）。修复真实有效。 |
| P1-6 | 已修复 | `LoginController.java:22`（`use.toString()`）、`:38`（`user.toString()`）；`User.java:28-38`（toString 无 password）；`LoginImpl.java:28`（日志已不含 user 对象）；`LoginImpl.java:39`（JWT 只 log id/username，无 token 明文） | 全仓库未再发现 password/哈希/token 进日志。 |
| P1-7 | **仍存在** | `LoginController.java:36-45`（register 只 `Result.success(i)`，**不签发 token**）；`LoginImpl.java:64`（`loginMapper.register(user)` 返回 void）、`:66`（`return user`，未 setToken）；`LoginMapper.java:13-14`（`@Insert ... void register(User)`，无 `@Options(useGeneratedKeys)` → **id 仍为 null**） | 与接口规范 3.2（register 成功返回 token，且 201）不符；前端若按规范只取注册响应里的 token 会拿到 null。 |
| P1-8 | **仍存在** | `demo/src/main/java/com/wei/controller/BirthdayController.java:13`（无 `@RequestMapping`）、`:19`（`getbirthdays` **无任何 `@XxxMapping`** → 不注册路由）、`:24`（直接 `return Result.success()`）；`BirthdayImpl.java`（14 行空 `@Service`）、`BirthdayService.java`（4 行空接口）、`BirthdayMapper.java`（8 行空 `@Mapper`）、`Birthday.java`（无 userId，`birthday` 为 String，时间用 LocalDateTime） | 生日模块仍是空壳，接口规范 869-875 的 3 个接口（列表/新建/删除）全部缺失；这些空文件本轮是**新增（git status `AM`）**，即"建了壳未实现"。 |
| P1-9 | **仍存在** | `RoobitsUtil.java:22`（RestTemplate 无超时）、`:41-45`（失败路径 NPE）；`RoobitsController.java:29`（无判空）；`TurnstileResponse.java:15`（`challenge_ts` 用 LocalDateTime，无法解析 Cloudflare 的 `...Z` 串） | 同 P0-3：失败链路不可用。真实网络超时下 `postForEntity` 抛异常 → catch → `response.getBody()` NPE → 500。 |
| P1-10 | 部分修复 | 已修：`HanderEx.java:17-21`（Exception → code 500）、`:22-26`（NoResourceFoundException/NoHandlerFoundException → code 404）；未修：两个 handler 都返回 `Result` 而非 `ResponseEntity`/`@ResponseStatus` → **HTTP 状态码仍恒 200**；405 `MethodNotAllowedException` 未单独处理 → 落到 Exception 分支被当成 500；无参数校验/413/415/401 分支；无 traceId；`HanderEx.java:3-5` 还残留一段"修复建议"注释块 | 前端只能靠 `body.code` 判断；任何非 200 语义都表现为 HTTP 200，网关/监控/浏览器 DevTools 全部失真。404 分支的提示语还是"服务端有异常"（语义错）。 |
| P1-11 | **仍存在** | `demo/pom.xml` 无 `spring-boot-starter-validation`（grep 全文件 0 命中）；全源码 `@Valid/@NotNull/@NotBlank/@Size/@Pattern` 0 命中；`LoginImpl.java:56`（`encoder.encode(user.getPassword())` 直接调用，password=null → IllegalArgumentException → code 500） | 请求体字段缺失/为空没有任何校验与友好提示，只能 NPE/500。 |
| P1-12 | 部分修复 | 已修：`AnniversariesController.java:73-75`（不存在纪念日返回 `Result.error("纪念日不存在",404)`，不再用 401 触发前端登出）；未修：`:49-55`（GET 单个不存在 → `Result.success(null)`，code 0）、`:59-66`（PUT 不存在 → `Result.success(null)`，code 0）、`PhotoController.java:57-66`（图片不存在 → 只说"删除错误"，无 404） | 删除纪念日不再误导前端为"登录失效"；但"查询/更新不存在资源"仍伪装成功，前端拿到 `data:null` 不易区分。 |
| P1-13 | **仍存在** | `PhotoMapper.xml:7-16`（`... order by id desc limit 3;` —— **每页仍 3 条**，规范 3.6 要求 20）；`PhotoController.java:46-51`（字段名 **`hashMore`**，规范/前端要 `hasMore`）；`:42-44`（空列表返回 `Result.success("目前还没图片")`，`data` 是字符串不是 `{list,hasMore}`）；`Photo.java:19`（内部游标 `lastId` 随实体一起序列化进响应） | **功能性后果**：`src/api/upload.js:132` 用 `hasMore: !!res?.hasMore`，后端发的是 `hashMore` ⇒ `hasMore` 恒 false ⇒ 前端永远不会"加载更多"，云相册最多显示 3 张。这已不只是规范问题，是可见功能缺陷。 |
| P1-14 | 部分修复 | 已修：`OssUtil.java:54-63`（Content-Type 白名单 + 大小上限）、`:75-78`（文件名 null/blank 校验）、删除改为按 DB 查出的 key 删除（`PhotoImpl.java:59,67`，不再用请求体里的任意 key）；未修：`OssUtil.java:116`（`substring(lastIndexOf("."))` 无 `-1` 防护，无扩展名文件 → `StringIndexOutOfBoundsException`）、`:117`（文件名前缀硬编码 `anniversary/u-001/`）、`:72`、`:128`（每次调用新建 OSSClient）、`:132-143`（catch 中 7 处 `System.out.println`）、`:120`（方法 `throws Exception`）；无文件魔数校验 | 任意 key 删他人对象的漏洞已堵；但仍有越界、硬编码前缀、打印日志、连接不复用问题。 |
| P1-15 | 部分修复 | 已修：三环境 secret 已分离（`demo/env/dev.env|test.env|prod.env` 的 `JWT_SECRET` sha256 互不相同，均 88 字符 base64）；未修：`JwtUtil.java:48`（`secret.getBytes()` **未指定 UTF-8**、无启动校验）、`:31-44` 与 `:46-56` 方法名仍拼错（`CreatToken`/`praseToken`）、无 `@PostConstruct` 校验密钥长度/解码合法性；**新增更严重问题**：`:33` 用 `Decoders.BASE64URL.decode(secret)` 派生密钥、`:48` 用 `secret.getBytes()` 派生，**两者字节不同 → 签发的 token 永远校验不过（N1，P0）** | "三环境共用 secret"确已修；但 `getBytes()` + 派生不一致使 JWT 功能当前完全不可用。 |
| P1-16 | **仍存在（且未轮换，风险放大）** | 只读 git 复核（口令以「历史串 A/B」代称，本报告不复述明文）：`git log --all -S "<历史串 A>"` → `44509df`、`14b1b7d`；`-S "<历史串 B>"` → `14b1b7d`、`c225532`；旧 JWT secret（base64 串）→ `44509df`、`c225532`；`git grep HEAD` 已无明文（当前文件确实改成 `${...}` 占位符）；**但当前 env 里的口令仍是这些历史串**（sha256 比对：dev/test 口令 = 历史串 A、prod 口令 = 历史串 B，见 §4.3） | 历史提交仍可检出明文凭据；更关键的是"轮换"只做了 JWT secret（旧 secret hash 与现值不同），**数据库口令没换**，泄漏依然有效。详见 N5。 |

### 2.3 P2（14 项）

| ID | 结论 | 当前证据（file:line） | 备注 |
|---|---|---|---|
| P2-1 | 仍存在 | `LoginImpl.java:50`（先 `loginMapper.login` 查重）→ `:64`（再 insert）；`:56`（`encoder.encode(user.getPassword())` 无 null 校验）；`LoginMapper.java:13-14`（register 无 useGeneratedKeys） | 查-插非原子，并发同名注册可双写；DB 无唯一索引兜底（P2-9）。 |
| P2-2 | 仍存在 | `AnniversariesController.java:66`（update 返回 `Result.success(b)`，`b` 可为 null）；`:55`（GET 单个可为 null 仍 success） | 不存在/越权时返回成功空数据，前端难区分"不存在"与"成功"。 |
| P2-3 | 仍存在 | `AnniversariesController.java:26-27`（`if (i < 1) return Result.error("title重复")`） | 任何插入失败（DB 异常、字段超长、连接断）都被报成"title 重复"。 |
| P2-4 | 仍存在 | `demo/src/main/java/com/wei/config/WebConfig.java:24-26`（`excludePathPatterns("/auth/login","/auth/register","/welcome")`，**无 `/actuator/**`、无 `/error`**）；`pom.xml:106-109` 引入了 actuator | 健康检查/就绪探针会被拦截器 401，K8s/监控用不了；`/error` 也被拦，错误转发链路异常。 |
| P2-5 | 仍存在 | `demo/src/main/java/com/wei/interceptor/LoginInterceptor.java:33-37`、`:39-42`、`:44-53`（均 `response.setStatus(401)` 后直接 return false，**不写响应体**） | 前端/客户端拿到空 401，只能靠猜；接口规范"旧后端问题"#4/#5 指的就是这个。 |
| P2-6 | 仍存在 | `application.yaml:28`（`log-impl: org.apache.ibatis.logging.stdout.StdOutImpl`） | 每条 SQL + 参数全部打到 stdout，生产既无结构也无级别控制。 |
| P2-7 | 仍存在 | 全源码 `@CrossOrigin|addCorsMappings|CorsFilter` **0 命中**；`LoginInterceptor.java:29-31` 只是放行 OPTIONS，不写 `Access-Control-Allow-*` 头 | 开发期靠 Vite 代理同源；一旦前后端分域部署，浏览器预检直接失败。 |
| P2-8 | 仍存在 | `application.yaml:12-13`（`optional:file:env/${spring.profiles.active:dev}.env[.properties]`，相对路径）、`:9`（注释已说明"相对于启动时的工作目录解析，请在 demo/ 目录下启动"） | 机制未变，仅在 CWD=demo 时正确；systemd/docker/IDE 启动目录不同即静默不加载（optional），随后因占位符无值启动失败。加注释属缓解不是修复。 |
| P2-9 | 仍存在（DB 侧无法静态判定） | 仓库无任何 SQL/迁移脚本（`find` 全仓 *.sql 仅 `.qc/runtime/` 的探测脚本，非项目文件）；无 Flyway/Liquibase 依赖；无唯一索引/DDL 定义 | 代码库层面确实没有 schema 管理；`tb_use.user_name` 是否真有唯一索引必须连库才可判定。 |
| P2-10 | 部分修复 | `DemoApplicationTests.java:7-8`（`@SpringBootTest @ActiveProfiles("test")`，`contextLoads` 仍依赖 `demo/env/test.env`，而 `demo/env/*.env` 被 `.gitignore:17` 忽略，干净 clone/CI 必因 `${DB_IP}` 等占位符无值而失败）；**新增** `UserJsonTest.java`（纯单元测试，不启 Spring 上下文，有效覆盖 P1-5 的 JSON 契约，但不覆盖 HTTP 三接口） | 测试从"0 有效测试"变成"1 个有效的单元测试 + 1 个跑不起来的上下文测试"；仍无 Mapper/Controller 集成测试。 |
| P2-11 | 仍存在 | 无登录失败计数/限流/验证码；JWT 无 `jti`、无黑名单/撤销；`JwtUtil.java:31-44` 只签不撤 | 密码可无限撞库；登出只能前端删 token，服务端无法失效已签发 token。 |
| P2-12 | 仍存在 | `demo/src/main/resources/` 仅 `application.yaml` + 2 个 mapper XML，无 `logback-spring.xml`；无 MDC/traceId 注入 | 请求链路无法串联，异常日志只有 `e.toString()`（`HanderEx.java:19`）。 |
| P2-13 | 仍存在 | `application.yaml:14-19` 只指定 `type: com.alibaba.druid.pool.DruidDataSource`，无 `initial-size/max-active/min-idle/max-wait/validation-query/test-while-idle` 等 | 全用 Druid 默认值，生产连接数/超时不可控。 |
| P2-14 | 仍存在 | 混用：`Anniversaries.java:26-27`（LocalDate）、`User.java:24-25`（LocalDateTime）、`Birthday.java`（LocalDateTime；`birthday` 字段为 String）；`AnniversariesMapper.xml` 的 `updated_at` 与 `created_at` 口径不一致；字段拼写 `creatTime`（`User.java:24`、`LoginMapper.java:13`） | 时间类型与命名口径不统一，跨端序列化格式（`yyyy-MM-dd` vs ISO datetime）也不同。 |

### 2.4 P3（12 项）

| ID | 结论 | 当前证据（file:line） | 备注 |
|---|---|---|---|
| P3-1 | 仍存在 | `CullentUtil`（`util/CullentUtil.java`，应 Current）、`HanderEx`（`exceptionhander/HanderEx.java`）、`handerExpection`（`HanderEx.java:18` 方法名）、`CreatToken`/`praseToken`（`JwtUtil.java:31,46`）、`GetannID`（`AnniversariesMapper.java:30`）、`GetP`（`PhotoController.java:36`）、`Rupload`（`PhotoController.java:23`）、`hashMore`（`PhotoController.java:47,50`）、`anneriversaries`（表名，`AnniversariesMapper.java:39`） | 注意 `WebCongin.java → WebConfig.java` 类名拼写已修（本轮 rename），但多数命名拼写仍在。 |
| P3-2 | 部分修复 | 已修：目录 `interceptor/`（`LoginInterceptor.java:1 package com.wei.interceptor`）、`WebConfig.java:3` import 小写；未修：`pojo/roobit.java`（类名全小写）、`getbirthdays`（`BirthdayController.java:19`）、`Register`/`GetUser` 方法名大写开头 | 包目录统一小写已完成，类/方法命名规范未完成。 |
| P3-3 | 仍存在（含审计误判修正） | `ServletInitializer.java`（13 行，jar 打包下无用）；`Result.java:8`（`@Slf4j` 未使用）；`LoginController.java:23`（`if (use == null)` 位于 `@RequestBody` 之后，永远为假）；`pom.xml:24-34` 的 `httpclient` 版本管理——**审计把它判为"未使用依赖"不准确**：源码确实不直接用，但 `aliyun-sdk-oss:3.18.5` 依赖 httpclient4，这是必要的传递依赖版本管理，删掉反而会漂版本 | ServletInitializer 建议保留（若未来打 war）或删；`if(use==null)` 属死分支应删；httpclient 项应改判为"有意为之"。另有新死代码见 N10。 |
| P3-4 | 仍存在 | 字段注入遍布：`WebConfig.java:18-19`、`LoginController.java:17-18`、`AnniversariesController.java:18-19`、`PhotoController.java:19-20`、`BirthdayController.java:16-17`、`RoobitsController.java:20-23`、`AnniversariesImpl`/`PhotoImpl`/`LoginImpl` 各私有字段、`LoginInterceptor.java:19-20` | 建议构造器注入；字段注入还导致单测必须启 Spring。 |
| P3-5 | 仍存在 | `JwtUtil.java:35`（`chaim` 拼写）、`AnniversariesController.java:24`（`Integer i`）、`AnniversariesImpl.java:104`（`public Object delete` 返回类型过宽，成功返回 1 或实体，语义不一） | 返回类型不一致是 P1-1 处理分支混乱的土壤。 |
| P3-6 | 仍存在 | 魔法值：`LoginImpl.java:23`（cost=12）、`LoginInterceptor.java:35`（`"Bearer "` 长度 7 与 `substring(7)`）、401/404/500 字面量散落、`application.yaml:32`（8080）、`application.yaml:22-23` 与 `OssUtil.java:22`（8MB 重复定义）、`PhotoMapper.xml` `limit 3` | 建议常量化 + `@ConfigurationProperties`。 |
| P3-7 | 仍存在 | `PhotoController.java:30`（注释"返回201状态码"，实际 `Result.success` → HTTP 200）；`AnniversariesImpl.java:79`（注释"先删在添加"与 update 实现不符/错别字） | 注释与实现不一致会误导后续维护。 |
| P3-8 | 仍存在 | `pom.xml:95`（`spring-security-crypto:6.2.0` 独立旧版，仅用 BCrypt，应由 Boot BOM 或升级到 7.x）；`pom.xml:69-82`（jjwt 0.12.6，`jjwt-jackson` 依赖 Jackson **2**，而 Boot 4 用 Jackson **3**，`target` jar 内确实同时存在 jackson-core/databind 2.21.5 与 3.1.5）；`pom.xml:63`（druid-spring-boot-starter 1.2.26，主要面向 Boot 2/3，Boot 4 自动配置兼容性未验证） | 双 Jackson 共存增加排障难度；Druid 是运行时风险点（若 Boot 4 自动配置不生效，连接池静默退化）。 |
| P3-9 | 仍存在 | `pom.xml:148-149`（`<source>${java.version}</source><target>${java.version}</target>`，非 `<release>`；无 maven-toolchains） | 本机 JDK 25.0.2，pom `java.version=21`；`target/classes`/`target/test-classes` 有产物说明能编译，但用 `source/target 21` 编译会告警，且不会阻止误用 JDK 22+ API。 |
| P3-10 | 仍存在 | 无 `.github/`、`.gitlab-ci.yml`、`Jenkinsfile`；pom 无 checkstyle/spotbugs/pmd 插件（grep 0） | 无 CI 与静态检查，回归只能靠人工。 |
| P3-11 | 仍存在 | `pom.xml` 无 springdoc/springfox（grep 0） | 无在线接口文档，契约（`docs/接口规范.md`）与实际代码已出现偏差（见 §5 N9）。 |
| P3-12 | 仍存在 | 日志字符串拼接：`LoginController.java:22,30,38`、`PhotoImpl.java:29,73`、`AnniversariesImpl.java:140`、`OssUtil.java:48`、`HanderEx.java:19`（`e.toString()` 丢失堆栈） | 建议 `log.info("... {}", x)` + 异常对象作最后一个参数。 |

---

## 3. 重构回归专节（包名/类名规范化 27 个 rename）

### 3.1 包名与目录大小写一致性 —— 一致，无冲突

- 实际目录（`demo/src/main/java/com/wei/`）：`config/ controller/ exceptionhander/ interceptor/ mapper/ pojo/ result/ service/ util/`，全部小写。
- Java `package` 声明与目录一致（抽查 `controller/*`、`service/*`、`mapper/*`、`util/*`、`result/Result.java`、`exceptionhander/HanderEx.java`、`config/WebConfig.java`、`interceptor/LoginInterceptor.java`）。
- 引用一致：`WebConfig.java:3` 是 `import com.wei.interceptor.LoginInterceptor`（小写），`LoginInterceptor.java:1` 是 `package com.wei.interceptor`；其它 import 均指向新包名。
- Mapper XML namespace 与接口全名一致：`AnniversariesMapper.xml:5` = `com.wei.mapper.AnniversariesMapper`（接口 `com.wei.mapper.AnniversariesMapper`）、`PhotoMapper.xml:5` = `com.wei.mapper.PhotoMapper`。
- `git status` 里 27 条 `RM` 均为"旧路径 → 新路径"的 rename（`Controller→controller`、`Service→service`、`UTIL→util`、`Mapper→mapper`、`ExceptionHander→exceptionhander`、`Interceptor→interceptor`、`Result→result`，以及 `WebCongin.java→WebConfig.java` 等类名修正），**未出现仅大小写不同的并存文件**（Git 在 Windows 上仍能记录为 rename，说明旧路径已从 index 删除）。
- 注意：这些 rename 目前停在 index（`RM` = index 已 rename、worktree 还有修改），**尚未提交**；提交前需再 `git status` 确认一次，避免大小写变更在 Linux checkout 时产生歧义。

### 3.2 `application.yaml` mapper-locations 与 resources 实际路径 —— 一致

- `application.yaml:29`：`classpath:com/wei/mapper/*.xml`。
- 实际文件：`demo/src/main/resources/com/wei/mapper/AnniversariesMapper.xml`、`PhotoMapper.xml`。
- 打包验证：`demo/target/demo-0.0.1-SNAPSHOT.jar` 内 `BOOT-INF/classes/com/wei/mapper/` 同时包含两个 XML，`target/classes` 同样就位 → 运行期可加载。

### 3.3 `demo/target/classes` 旧大写包目录残留 —— 已无残留

- `demo/target/classes/com/wei/` 下只有小写目录（config/controller/exceptionhander/interceptor/mapper/pojo/result/service/util），**未发现 `Controller/`、`Service/`、`UTIL/` 等旧大写目录**。
- `demo/target/test-classes/com/wei/` 有 `DemoApplicationTests.class`、`UserJsonTest.class`（说明新测试已编译通过过）。
- `demo/target/` 被 `.gitignore:14` 忽略，不会影响仓库；无需 clean。但若后续用 IDE 增量构建，仍需留意 Windows 大小写不敏感可能产生的陈旧 class（当前无证据）。

### 3.4 未使用 import / 死代码 / 空壳 / 重复类

- **未使用 import（确认）**：`JwtUtil.java:5`（`io.jsonwebtoken.io.Decoder`）、`JwtUtil.java:9`（`org.bouncycastle.util.encoders.Base64Encoder`）。其中 BouncyCastle 并未在 pom 显式声明，是 `aliyun-sdk-oss` 的传递依赖（jar 内有 `bcprov-jdk18on-1.79`）——**依赖脆弱**，一旦 OSS SDK 换实现该 import 就编译失败（见 N10）。
- 其余文件抽查未发现未使用 import（`PhotoImpl.java:9` 的 `Anniversaries` 在 `:59` 使用、`:25` 的 `AnniversariesMapper` 在 `:65` 使用，**不是死字段**；审计报告此处若曾判"死代码"需修正）。
- **死代码**：`ServletInitializer.java`（jar 打包下无意义）、`Result.java:8` `@Slf4j`、`LoginController.java:23` 永假分支、`PhotoImpl.upload` 的未使用参数 `Integer id`（`PhotoImpl.java:30`）。
- **空壳类/接口**：生日模块 4 个文件（`BirthdayController`/`BirthdayImpl`/`BirthdayService`/`BirthdayMapper`）——本轮新增但未实现任何接口（P1-8）。
- **重复类判定修正**：`pojo/roobit.java`（请求体 `{token}`）与 `pojo/TurnstileResponse.java`（siteverify 响应）**用途不同，不是重复类**；审计报告中"重复类"的判断不成立，但 `roobit` 类名不合规（P3-2）成立。

### 3.5 Lombok 与 JDK 25 兼容性

- 本机 `java -version` = **Temurin 25.0.2 LTS**；`pom.xml:20` 为 `java.version=21`，compiler 插件用 `source/target=21`（非 release）。
- Lombok 版本由 Spring Boot BOM（4.0.8）管理，pom 未固定版本（`pom.xml:86-89`，`optional=true`），打包时被 `spring-boot-maven-plugin` 排除（jar 内无 lombok）。
- 证据：`target/classes` 与 `target/test-classes` 都有最新编译产物（含新增 `UserJsonTest.class`），说明**本机 JDK 25 + 当前 Lombok 版本可正常编译**，暂无硬性不兼容。
- 残留风险：`source/target` 模式在 JDK 25 上会告警"bootstrap classpath 未与 -source 21 一起设置"，且无法阻止误用 JDK 22+ API（P3-9）；建议改成 `<release>21</release>` 并加 toolchain 锁定。

### 3.6 pom 可疑依赖版本（Spring Boot 4.0.8 / Druid 1.2.26 / spring-security-crypto 6.2.0 / MyBatis 4.0.1）

| 依赖 | 现状 | 风险评估 |
|---|---|---|
| Spring Boot 4.0.8（`pom.xml:8`） | 4.x 最新，要求 Java 17+，默认 Jackson 3 | 本身合理；但与下列"面向 Boot 3 生态"的库存在兼容缝隙 |
| MyBatis starter 4.0.1（`pom.xml:51`） | 官方 Boot 4 适配线 | 与 Boot 4 匹配，风险低 |
| Druid starter 1.2.26（`pom.xml:63`） | Druid 的 Boot starter 主要面向 Boot 2/3；1.2.26 未声明 Boot 4 适配 | **运行时风险**：若自动配置不生效，Druid 不生效且无显式 DataSource 配置，连接池行为可能退化/启动失败。需以启动日志确认 Druid 是否真正接管 |
| spring-security-crypto 6.2.0（`pom.xml:95`） | 独立引入旧主版本，仅用 `BCryptPasswordEncoder` | 功能可用（`LoginImpl.java:23`），但版本与 Boot 4 的 Security 7 生态脱节；建议改由 BOM 管理或升到 7.x；无 `spring-security-web` 是全仓库，CORS/CSRF 等能力均未启用 |
| jjwt 0.12.6（`pom.xml:69-82`） | `jjwt-jackson` 依赖 Jackson 2；Boot 4 用 Jackson 3 | `target` jar 内同时有 jackson-annotations 2.21 / core+databind 2.21.5 与 3.1.5 → **双 Jackson**，体积与冲突排查成本上升；当前 JWT 只用 HS256 签名/校验，不依赖 Jackson 反序列化的话可移除 `jjwt-jackson` 改 `jjwt-gson`/仅 api+impl |
| httpclient 4.5.13（`pom.xml:24-34`） | 仅 dependencyManagement，未被源码直接使用 | 是 `aliyun-sdk-oss` 的传递依赖版本管理，**不是死配置**（修正审计 P3-3 的一处误判） |

### 3.7 测试

- `DemoApplicationTests.java:7-8`：`@SpringBootTest @ActiveProfiles("test")` + `contextLoads`。**依赖 `demo/env/test.env`**（被 `.gitignore:17` 忽略、未入包）：干净 clone/CI 上 `application.yaml:17-19` 的 `${DB_IP}` 等占位符无值 → 上下文启动失败。此问题**仍在**（P2-10 部分）。
- `UserJsonTest.java`（新增，`package com.wei`）：
  - 用 Jackson 3（`tools.jackson.databind.json.JsonMapper`，与 Boot 4 HTTP 层一致）构造 `User`，断言序列化 JSON **不含 `password` 与哈希**、含 `userName`（`:21-33`）；
  - 断言请求 JSON 反序列化后 `password` 可读（`:35-42`），保证登录不被 `@JsonIgnore` 误伤。
  - **有效性判断**：对 P1-5 的"序列化契约"是**有效覆盖**，且用 Jackson 3 而非 Jackson 2，证据力强；但覆盖边界有限——没走 Spring MVC 的 HTTP 消息转换器（不含全局 ObjectMapper 定制）、没覆盖 `GET /auth/profile` 的 SQL 侧（该侧另行修复见 LoginMapper:16-17）、没覆盖登录/注册响应实际 HTTP 报文。作为回归护栏合格，不能替代 Controller 集成测试。
  - 注意该测试**不启动 Spring 上下文**，所以即使 `test.env` 缺失它也能跑；真正依赖 env 的是 `DemoApplicationTests`。

---

## 4. 配置与密钥专节

### 4.1 占位符 vs 模板键：`demo/env/example.env` 已与 `application.yaml` 脱节（新增 P1，N4）

| 运行时需要的占位符 | 来源（yaml） | example.env 提供的键 | 是否匹配 |
|---|---|---|---|
| `${DB_IP}` | `application.yaml:17` | `DB_URL`（`example.env:12`，整条 JDBC URL） | ❌ 不匹配 |
| `${SPRING_DATASOURCE_USERNAME}` | `application.yaml:18` | `DB_USERNAME`（`example.env:13`） | ❌ 不匹配 |
| `${SPRING_DATASOURCE_PASSWORD}` | `application.yaml:19` | `DB_PASSWORD`（`example.env:14`） | ❌ 不匹配 |
| `${JWT_SECRET}` | `application.yaml:35` | `JWT_SECRET`（`example.env:30`，占位值可接受） | ✓ 键名匹配 |
| `${CF_SITEKEY}` | `application.yaml:45` | **模板中完全没有该键** | ❌ 缺失 |
| `${SERVER_PORT}`（并未被引用） | `application.yaml:32` 硬编码 8080 | `SERVER_PORT`（`example.env:9`） | ❌ 模板键实际不生效 |
| OSS 凭证 | `OssUtil.java:69,123` 走 **SDK 环境变量** `OSS_ACCESS_KEY_ID`/`OSS_ACCESS_KEY_SECRET` | `ALIYUN_OSS_ACCESS_KEY_ID/SECRET`（`example.env:24-25`） | ❌ 键名不同，且 `.env` 只会成为 Spring properties，**不会变成系统环境变量** |

- 结论：**照 `example.env` 配置会启动失败**（`${DB_IP}` 无法解析）；`SERVER_PORT` 是死键；OSS 凭证根本不会从 `.env` 读取（见 N6）。
- 历史对照：`git diff` 显示旧版 example.env 的键本来与 yaml 匹配（`DB_IP/SPRING_DATASOURCE_*`），是本轮重写引入的回归。
- 严重级建议：**P1**（新环境/CI/交接必踩，且当前 dev/test/prod.env 只在本机存在，一旦换机即无法启动）。

### 4.2 Cloudflare Turnstile：密钥语义与失败路径

- **现状**：`application.yaml:45` `Cf.siteKey: ${CF_SITEKEY}` → `RoobitsUtil.java:20-21` 注入到名为 `secretKey` 的字段 → `:30` 作为 siteverify 的 `secret` 参数发出。前端 site key 在 `src/components/roobits.vue:38`（`0x4AAAAAAGDZF-Gcr5tEQO2n`，公开值）。
- **实测结论（辅助动态验证）**：三环境 `CF_SITEKEY` 完全相同（sha256 前 16 = `b61067a3…`，35 字符），用该值调 `POST /turnstile/v0/siteverify`（假 token）返回 `error-codes: ["invalid-input-response"]` —— 这是"secret 合法、响应 token 无效"的结果；若是把 site key 当 secret，会返回 `invalid-input-secret`。**因此当前值确为合法 secret key，审计 P0-3 的"site key 当 secret → 验证恒失败"不成立**。
- **真正的问题（仍在）**：
  1. 命名三层自相矛盾（配置键 `siteKey`、变量名 `secretKey`、实际存 secret）→ 后来者极易把公开 site key 填进去，**一改配置就会变成 P0 故障**；建议改名 `Cf.secret-key` / `CF_SECRET_KEY`，并在 example.env 明确注释"这是 secret 不是 site key"。
  2. 三环境共用同一 secret（Turnstile 层面可用，但轮换/隔离不便；建议分环境）。
  3. 失败路径 NPE（`RoobitsUtil.java:41-45`）、无超时（`:22`）、Controller 无判空（`RoobitsController.java:29`）。
  4. `TurnstileResponse.java:15` 的 `challenge_ts: LocalDateTime` 无法解析 Cloudflare 的 `"2026-...T...Z"` → **即使校验成功也可能 500**；建议改 `OffsetDateTime` 或 `String`，并配 `@JsonIgnoreProperties(ignoreUnknown = true)`（Cloudflare 响应还含 `cdata/metadata` 等字段）。
- 建议：Turnstile 秘密值迁移到独立键并轮换一次（旧值已出现在未跟踪审计文档中，见 N8）。

### 4.3 JWT

| 检查项 | 现状 | 结论 |
|---|---|---|
| secret 字节长度 | env 中 `JWT_SECRET` 为 88 字符 base64；签发时 `Decoders.BASE64URL.decode` → 66 字节，校验时 `getBytes()` → 88 字节 | **派生不一致 → 永远验签失败（N1，P0）** |
| 是否显式 UTF-8 | `JwtUtil.java:48` 未指定 charset | ❌ 仍未修 |
| 启动校验 | 无 `@PostConstruct`；secret 太短/非法 base64 只在首次使用时暴露（`Keys.hmacShaKeyFor` 抛 WeakKeyException / DecodingException） | ❌ 仍未修 |
| 三环境是否共用 secret | dev/test/prod 的 `JWT_SECRET` sha256 互不相同（`7a157baf…` / `b3d3a41c…` / `61938881…`），均 88 字符 | ✓ 已修（审计此项成立） |
| secret 是否已轮换 | 旧 git 历史 secret hash `b53d2c06…` 与三个现值均不同 | ✓ 已轮换（但历史仍可检出） |
| 算法/声明 | HS256（`JwtUtil.java:38`），claims 只有 username/userId；无 issuer/audience/jti | 无吊销能力（P2-11） |
| 并发安全 | `JwtUtil.java:28` `private SecretKey key` 为单例共享可变态，`CreatToken`/`praseToken` 都写它且无同步（N7） | 并发下互相覆盖，加剧 N1 |

### 4.4 `@Transactional` 覆盖范围

- 全仓库仅 1 处：`LoginImpl.java:47`（register，`rollbackFor=Exception.class`）。
- **缺失事务的多步写操作**：
  - 删纪念日：`AnniversariesImpl.java:104-147`（删纪念日 + 查 photo + 删 photo 行 + 删 OSS 对象）；
  - 删图片：`PhotoImpl.java:53-80`（删 photo 行 + 更新纪念日背景 + 删 OSS）；
  - 上传：`PhotoImpl.java:30-51`（OSS 上传 + DB 插入，已有手工补偿但 OSS 删除也可能失败）。
- 建议：DB 部分加 `@Transactional`，OSS 操作放事务外并用补偿/重试（或 outbox），避免"事务回滚但对象已删"。

### 4.5 参数校验

- `pom.xml` 无 `spring-boot-starter-validation`；源码无 `@Valid`/约束注解（grep 0）。
- 现状后果：`LoginController.java:21-33` 的 `@RequestBody User use` 为空对象时 `loginMapper.login` 正常返回 null → 报"密码或用户名错误"（尚可）；但 `LoginImpl.java:56` 在 password=null 时 `IllegalArgumentException` → 500；`PhotoController.java:23` 依赖 `@RequestParam` 的 required 默认值（缺参数 → 400 但被 Exception handler 转成 code 500，HTTP 200）。
- multipart 限制只在 `application.yaml:22-23`（8MB），超限异常没有专门处理（应为 413 提示）。

### 4.6 CORS / 拦截器白名单

- 无任何 CORS 配置（P2-7）；`LoginInterceptor.java:29-31` 只放行 OPTIONS，不输出 CORS 头。
- `WebConfig.java:26` 白名单只有 `/auth/login`、`/auth/register`、`/welcome`：
  - 缺 `/actuator/**` → 健康检查 401（P2-4）；
  - 缺 `/error` → 错误转发也被拦；
  - 注意 `/auth/profile` **不在白名单**（正确，它需要 token）。

### 4.7 全局异常处理器

- `HanderEx.java:17-21`：`Exception` → code 500，只 `log.error(e.toString())`（无堆栈、无 traceId）；
- `HanderEx.java:22-26`：两类 404 异常 → code 404，但文案是"服务端有异常"；
- 两者都返回 `Result` 对象 → **HTTP 状态码恒 200**（P1-10 部分修复）；
- 405（MethodNotAllowed）未单独处理 → 归 500；无 `MethodArgumentNotValidException`/`MaxUploadSizeExceededException`/认证异常分支；
- `HanderEx.java:3-5` 残留一段"修复建议"注释（含未实现的 `BizException`/traceId 设计），像把设计稿误粘进源码，应清理（N12）。

---

## 5. 新增问题（审计后新引入 / 新暴露）

> 编号 N1–N12；"新增"指当前工作区存在、审计报告未列出（或已改变根因）的问题。

| 编号 | 严重级建议 | 问题 | 证据（file:line） | 影响 |
|---|---|---|---|---|
| N1 | **P0（阻断）** | JWT 签发与校验对 secret 的派生方式不一致：签发 `Decoders.BASE64URL.decode(secret)`（66 字节），校验 `secret.getBytes()`（88 字节）→ 两边密钥不同 | `demo/src/main/java/com/wei/util/JwtUtil.java:33` vs `:48` | 登录成功返回 token，但**后续所有带 token 的请求验签失败 → 401 空体**（`LoginInterceptor.java:44-53`）。等于登录后全站不可用；且 `CullentUtil` 永不被赋值，所有 `user_id` 相关查询会因 null 失真。**必修**，建议统一为 `Decoders.BASE64URL.decode(secret)` 并抽成 `@PostConstruct` 初始化一次的不可变 `SecretKey`。 |
| N2 | **P1（功能阻断）** | `@Options(useGeneratedKeys = true, keyProperty = " id")` 的 keyProperty 值带前导空格 | `demo/src/main/java/com/wei/mapper/PhotoMapper.java:14` | MyBatis 插入成功后回填主键时按属性名 `" id"` 找不到 setter → 抛 `ReflectionException` → `PhotoImpl.java:40-49` 补偿删 OSS 后 rethrow → **上传必失败**（HanderEx 返回 code 500）。静态高置信；建议运行期用一次真实上传确认。 |
| N3 | **P1** | 删图时把用户 ID 误写到 `id` 字段 | `demo/src/main/java/com/wei/service/PhotoImpl.java:60`（`A.setId(CullentUtil.get())` 应为 `A.setUserId(...)`），配合 `AnniversariesMapper.java:39-40` 的 `where user_id=#{photo.userId}` | `A.userId` 为 null → `user_id = NULL` 恒不成立 → **0 行更新，纪念日 bg_image 永不清空**；而 OSS 对象已被删 → 前端背景 404、DB 残留失效 URL。修复 P1-3 的关键一行。 |
| N4 | **P1（运维阻断）** | `example.env` 模板键与 `application.yaml` 实际占位符不匹配（`DB_URL/DB_USERNAME/DB_PASSWORD` vs `${DB_IP}/${SPRING_DATASOURCE_*}`；缺 `${CF_SITEKEY}`；`SERVER_PORT` 无引用） | `demo/env/example.env:9,12-14,23-26,30` vs `application.yaml:17-19,32,35,45` | 新机器/CI 照模板配置 → `${DB_IP}` 无法解析 → 启动失败；`SERVER_PORT` 改了不生效。§4.1 表格已逐键比对。 |
| N5 | **P1（安全）** | 历史泄漏的数据库口令**未轮换**：当前 env 口令与 git 历史明文一致（sha256 比对一致） | `demo/env/dev.env`、`test.env`、`prod.env` 的 `SPRING_DATASOURCE_PASSWORD`；历史提交 `14b1b7d`、`c225532`、`44509df`（`git log -S` 只读复核，不在报告中复述明文） | 审计建议"必须轮换"，实际只轮换了 JWT secret（旧 secret hash 与现值不同），**DB 账号口令仍是泄漏值**；dev/test 与 prod 各用一套（dev/test=历史串 A，prod=历史串 B，prod 账号 = `photo`）。只要仓库历史曾外泄，数据库仍可被登录。**必须轮换并同步 env，再考虑 filter-repo 清历史**。 |
| N6 | **P1（功能/配置）** | OSS 凭证来源断裂：代码用 SDK 的 `EnvironmentVariableCredentialsProvider`，实际读取的是**系统环境变量** `OSS_ACCESS_KEY_ID`/`OSS_ACCESS_KEY_SECRET`（3.18.5 jar 内类常量可证）；而 `example.env:24-25` 提供的是 `ALIYUN_OSS_ACCESS_KEY_ID/SECRET`，且 `config.import` 只会导入为 Spring properties，**不会成为系统环境变量** | `demo/src/main/java/com/wei/util/OssUtil.java:69,123`；`demo/env/example.env:24-25`；`application.yaml:12-13` | 按现有配置上传必抛 ClientException（无凭证）→ code 500。即使修好 N2 上传仍不可用。建议改为 `@Value` 从配置注入 AK/SK（或显式 `DefaultCredentialProvider`），并在模板中给出正确的键名，或明确文档化"必须设置 OS 环境变量"。 |
| N7 | P2 | `JwtUtil` 的 `key` 是单例共享可变字段，`CreatToken`/`praseToken` 都直接赋值且无同步；叠加 N1 的两种派生方式，多线程下互相覆盖 | `demo/src/main/java/com/wei/util/JwtUtil.java:28,33,48` | 并发时 A 线程签发用 B 线程设置的密钥 → 间歇性验签失败/难以复现的 401。建议启动时算一次 `final SecretKey`，不在方法里改字段。 |
| N8 | P2（安全/流程） | **审计报告文档本身含明文敏感串**：未跟踪的 `docs/*.md` 里直接写了数据库口令、旧 JWT secret 的 base64 串与 `git log -S` 命令 | `docs/后端代码质量审计报告.md:389-391,591-597`；`docs/代码质量审计报告.md:165`（`git status` 显示这两个文档为 `??` 未跟踪） | 目前未入库，但一旦误提交/外发 → 二次泄漏。**提交前必须脱敏（用占位符/哈希引用）**；同时这些文档也应纳入"不得写真实密钥"的规则。 |
| N9 | P2（契约+安全小项） | 登录/注册用 `@RequestMapping`（不限 HTTP 方法），接口规范要求 POST | `demo/src/main/java/com/wei/controller/LoginController.java:20,37` | `GET /auth/login?userName=...&password=...` 会把**明文口令放进 URL**（网关/浏览器历史/访问日志）；与 `docs/接口规范.md` 3.1/3.2 不一致。改 `@PostMapping` 即可（只影响内部路由，前端本来就 POST）。 |
| N10 | P3 | `JwtUtil` 两个未使用 import，其中 `Base64Encoder` 来自未显式声明的传递依赖 | `demo/src/main/java/com/wei/util/JwtUtil.java:5,9` | 现在能编译靠 `aliyun-sdk-oss` 传递的 `bcprov-jdk18on`；依赖树一变就编译失败。删除这两个 import 即可。 |
| N11 | P3 | `example.env` 的 JWT 注释写"HS512 / 解码后至少 64 字节（HS512 要求 512 bit）"，代码实际是 HS256 | `demo/env/example.env:28` vs `JwtUtil.java:38` | 会引导运维生成过/错规格的 secret；注释应改为 HS256 口径或代码升 HS512（当前 66 字节 ≥64，HS512 也够，但需统一）。 |
| N12 | P3 | `HanderEx` 首部残留"修复建议"注释块（未实现的 BizException/traceId 设计）；404 处理方法与异常类同名；404 文案"服务端有异常" | `demo/src/main/java/com/wei/exceptionhander/HanderEx.java:3-5,22-26` | 可读性/维护隐患，易被误认为已实现；建议清理注释并把 404 文案改为"接口不存在"。 |

### 5.1 契约偏差汇总（与 `docs/接口规范.md` 对照，多数已被上述条目覆盖，不重复计数）

| 规范要求 | 当前实现 | 偏差 |
|---|---|---|
| 3.1 登录返回 user 扁平实体，**必须含 id** | `LoginController.java:31` 返回 DB 查出的 user（含 id） | ✓ 符合 |
| 3.2 注册成功 **201 + 返回 token** | `LoginController.java:44` 返回 `Result.success(i)`，无 token、id=null、HTTP 200 | ❌（P1-7） |
| 3.4.5 删除纪念日不存在 → **404** | `AnniversariesController.java:73-75` body.code=404，**HTTP 200** | 部分（P1-10/P1-12） |
| 3.5 上传：file 必填、**anniversaryId 可选**、**不得改纪念日 bgImage**、成功 201/200、data 不含 id | `PhotoController.java:23` anniversaryId 为 **required**；`PhotoImpl.java:30-51` 已不改 bgImage；返回 200 但 data 含 `id`(null)/`userId`/`lastId` | 部分（P1-4/P1-13/N2） |
| 3.6 相册：**每页 20、字段 hasMore、data={list,hasMore}** | `PhotoMapper.xml` limit 3；`hashMore`；空列表返回字符串 | ❌（P1-13，且导致前端"加载更多"失效） |
| 3.7 删图片：返回 `data.affectedIds`，不存在 → 404 | `PhotoController.java:57-66` 返回 `Result.success()` 无 data；不存在只说"删除错误" | 部分（P1-12/P1-13） |
| 生日模块 3 个接口 | 全部缺失（`BirthdayController` 无路由） | ❌（P1-8） |
| 1.5 HTTP 状态码建议与 code 一致 | 全部 HTTP 200 | ❌（P1-10） |

---

## 6. 建议下一步优先级

### 必须修（阻断运行 / 安全，修完才谈功能）

1. **N1（P0）JWT 密钥派生统一**：`JwtUtil.java` 用同一个 `Keys.hmacShaKeyFor(Decoders.BASE64URL.decode(secret))`（并显式 UTF-8/启动校验），把 `key` 改为 `@PostConstruct` 初始化的 `final` 字段（顺带修 N7）。*验证：登录拿 token → 调 `/auth/profile` 应 200。*
2. **P0-3 / P1-9 Turnstile 链路**：catch 分支返回构造好的 `TurnstileResponse(success=false)` 而非 `response.getBody()`；RestTemplate 设连接/读超时；`RoobitsController.java:29` 判空；`challenge_ts` 改 `OffsetDateTime`（或 String）+ `@JsonIgnoreProperties(ignoreUnknown=true)`。*验证：/welcome 传无效 token 应返回 code 4xx 而不是 500。*
3. **N2（P1）`PhotoMapper.java:14` keyProperty 去掉空格**（`"id"`），运行期做一次真实上传回归。
4. **N3（P1）`PhotoImpl.java:60` 改 `A.setUserId(...)`**，并给 `photoMapper.select` 结果加判空；`AnniversariesImpl.java:121` 传 `c` 而不是 `b`（P1-1），`AnniversariesMapper.java:45` 的 `selectBgimage` 补 `user_id`。
5. **N5（P1）轮换数据库口令**（三套环境各换一次并更新 env），再评估 `git filter-repo` 清历史；**同时 N8 文档脱敏**。
6. **N4（P1）重写 example.env**：键改为 `DB_IP/SPRING_DATASOURCE_USERNAME/SPRING_DATASOURCE_PASSWORD/JWT_SECRET/CF_SECRET_KEY`（或把 yaml 占位符改回 `DB_USERNAME` 等标准名，二选一，保持唯一口径），删掉无效的 `SERVER_PORT` 或让 yaml 引用它；`CF_*` 注明是 secret 不是 site key。
7. **N6（P1）OSS 凭证注入方式**：改为配置注入，或明确要求 OS 环境变量并在 README/模板写清 `OSS_ACCESS_KEY_ID/OSS_ACCESS_KEY_SECRET`。

### 应该修（规范/契约/可运维，工作量小、收益大）

8. P1-7/P1-8：注册签发 token + `useGeneratedKeys` 回填 id（201）；生日模块要么实现 3 接口，要么从前端/路由摘除避免误解。
9. P1-13/N9 + 契约：`/photos` 改 `hasMore`、每页 20、空列表返回 `{list:[],hasMore:false}`、`Photo.lastId` 加 `@JsonIgnore`；登录/注册改 `@PostMapping`。
10. P1-10/P1-11/P2-4/P2-5：异常处理器改返回 `ResponseEntity`（code 同步 HTTP 状态）、补 405/413/参数校验分支；引入 `spring-boot-starter-validation` + `@Valid`；拦截器 401 写 body；白名单补 `/actuator/**`、`/error`。
11. P1-14/P1-15 剩余：`OssUtil` 的 `substring(-1)` 防护、去 `u-001` 硬编码、OSSClient 复用、删 `System.out.println`；JWT 方法名/`getBytes` 字符集/启动校验。
12. P2 批量（可一个 PR 收掉）：StdOutImpl→slf4j、Druid 池参数、logback+traceId、CORS 配置、`config.import` 改绝对路径/显式 CWD、时间类型统一、DB 唯一索引迁移脚本（Flyway/Liquibase）。
13. P3 批量：死代码清理（ServletInitializer/`@Slf4j`/`if(use==null)`/未用 import/`id` 参数）、命名拼写、日志占位符、`maven.compiler.release` + toolchain、加 CI（编译+测试+spotbugs/checkstyle）与 springdoc。

### 可以接受/暂缓（记录在案）

- `pom.xml:24-34` 的 httpclient 版本管理：**保留**（aliyun-sdk-oss 传递依赖需要），审计该项结论应修正。
- `pojo/roobit` 与 `TurnstileResponse` 不是重复类：无需合并；只需改 `roobit` 类名。
- `example.env` 的 `REDIS_*` 键：项目当前没有引入 Redis 依赖，属模板冗余，可删可留（但不要让人以为要配 Redis）。
- 双 Jackson 共存（jjwt-jackson）：功能上无碍，可在升级 jjwt 时顺手换成不依赖 Jackson 的序列化器。
- P2-9 的数据库唯一索引：代码侧补迁移脚本前，先连库确认 `tb_use.user_name` 现状（本报告无法静态判定）。

---

## 附录 A：本轮已完成的只读证据操作

- 源码/配置/测试：`read` 全量 + `grep -n` 逐条定位；行号均来自当前工作区。
- 只读 git：`git log -1`、`git log --all -S <敏感串>`、`git show 14b1b7d:...application.yaml`、`git grep`、`git status --porcelain`、`git diff`（未 checkout/reset/filter/commit）。
- 构建产物：`unzip -l`/`jar` 内容与 `target/classes`、`target/test-classes` 目录检查；未执行 mvn/启动服务。
- env：只读取键名与 sha256 前 16 位做比对，**报告中不出现任何完整密钥/口令**；三环境 `JWT_SECRET`/`CF_SITEKEY`/`DB_*` 仅以哈希前缀描述。
- 辅助动态验证（唯一一次）：Cloudflare `siteverify` 假 token 请求，用于判定 `CF_SITEKEY` 值类型（见 §4.2）；未调用本服务、未使用真实 token。

## 附录 B：无法静态判定 / 需运行期或连库确认的点

1. Druid 1.2.26 在 Spring Boot 4 下自动配置是否真正生效（看启动日志/连接池指标）。
2. `tb_use.user_name` 是否有唯一索引、`user.photo`/`user.anneriversaries` 的实际 DDL 与索引（需连库）。
3. N2 上传失败的具体异常类型（静态高置信，建议运行期一次真实上传确认）。
4. 前端 site key 与后端 secret 是否属于同一个 Turnstile widget（当前值不同，功能上需前端实测通过一次人机验证）。
5. `demo/env/test.env` 在目标机器的存在性/内容（本机存在，CI 不存在）。