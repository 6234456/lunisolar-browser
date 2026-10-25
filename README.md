# lunisolar-browser

浏览器端西历与中国历法双向查询，支持多候选、儒略历 / 格里高利历、指定地区改历断档。

**0.7.0 加入《后汉书》帝纪，扩充史料 notes，校订“光和元年”转录错误，并修复无效干支误归月初的问题。** 保留 DILA 历表、Yuk Tung Liu 的 18 套研究历法与多候选查询。现代回推仍可显式选择，范围为公元前 2000 年至公元 3000 年。

公元前 2000 年至公元 3000 年不存在一份可据此保证完整、唯一且符合实际颁历的历史资料。本项目不会用天文回推填补历史资料空白，也不会把未来日期称为实际颁历。

## 历史查询（默认）

下载仓库，直接打开单文件离线示例 `demo.html`。集成代码时：

```html
<script src="data/dila-history.js"></script>
<script src="data/research-history.js"></script>
<script src="data/era-supplement.js"></script>
<script src="data/history-notes.js"></script>
<script src="lunisolar.js"></script>
<script>
const history = Lunisolar.create();

// 公历 1662-02-18：历表记为康熙元年正月初一
const result = history.solarToLunar({ year: 1662, month: 2, day: 18 });
console.log(result);

// 历史反查使用年号纪年，不能拿公历年份代替年号年份
console.log(history.lunarToSolar({
  eraId: 660, eraYear: 1, month: 1, day: 1, isLeap: false
}));

// 查找年号。返回 ID、名称、皇帝、朝代；同名年号可能不止一个。
console.log(history.eras({ search: '康熙' }));

// 未指定具体朝代的同名年号，以及未指定闰月，都可能产生多个日期
console.log(history.lunarToSolar({ eraName: '太和', eraYear: 2, month: 1, day: 1 }));
console.log(history.lunarToSolar({ eraId: 660, eraYear: 3, month: 6, day: 1 }));

// 没有历史记录：undetermined，不自动切回现代天文历
console.log(history.solarToLunar({ year: -1999, month: 1, day: 1 }));
</script>
```

历史输出示意：

```js
{
  status: 'unique', // none / unique / ambiguous / undetermined
  basis: 'historical-sources', // 仅加载 DILA 时为 historical-table
  complete: true, // 本次来源查询没有发现未解决的缺口/冲突，不表示史学上的完备或绝对准确
  source: { /* 数据来源、版本标识、校验和、许可、已知局限 */ },
  issues: [],
  matches: [{
    jdn: 2328142,
    dayIndex: 606716,
    solar: [{ calendar: 'gregorian', year: 1662, month: 2, day: 18 }],
    lunars: [{
      eraId: 660, eraName: '康熙', eraYear: 1,
      dynastyId: 92, dynasty: '清', emperor: '聖祖',
      month: 1, monthName: '正', day: 1, isLeap: false,
      recordId: 40843, sourceStatus: 'S', basis: 'historical-table'
    }]
  }]
}
```

- `matches` 按实际日期 JDN 分组。同一天可能有多种朝代纪年，保留在 `lunars` 数组中；同一天的多种西历写法保留在 `solar` 数组中。
- `unique` / `ambiguous` 表示实际日期数量，不能据此认定历史纪年唯一。
- `none` 表示在指定历法或查询条件下无匹配；历史记录为空不构成对史实的否定证明。
- `undetermined` 表示来源没有记录、输入缺少年号语义，或源数据存在结构冲突。可能带有已找到的候选，但 `complete: false`，不得当作完整结果。
- `isLeap` 省略匹配普通月与闰月；`false` 仅普通月；`true` 仅闰月。
- 第二个参数可以用 `eraId` 或 `dynastyId` 限定历史查询的政权/年号。
- 历史特殊月保留来源编号 `-1`、`-2` 和原始 `monthName`；不强行改成现代的一至十二月。反查可以用 `monthName` 替代 `month`。
- 年号在月中变更时，使用源记录的 `start_from` 计算日号，不把每条记录的第一天误当作初一。
- 缺少 DILA 数据脚本时会报错，不偷偷使用 Intl。补充研究脚本可以不加载；`metadata.reconstructionDataLoaded` 表示它是否可用。

## 年号与君主纪年

原有 **928** 项 DILA 年号／纪年继续保留，新增 **47** 组周、鲁、秦君主纪年，共 **975** 项。补充资料生成 **12,688** 条对应月段，可用同一个 `eras()`、`solarToLunar()`、`lunarToSolar()` 接口查询。数据来自固定版本 ChineseCalendar 的 [`eras.js`](vendor/ytliu/eras.js) 和[纪年说明](vendor/ytliu/era_names.html)，该研究项目列明万国鼎《中国历史纪年表》等参考资料；早期君主纪年的原始文献依据另列于结果的 `primarySources`。

早期君主纪年标记为 `kind:'regnal-year'`、`basis:'regnal-reconstruction'`，不把“鲁隐公”称作汉武帝以后意义上的年号。补充方案仅给出年界，未据此编造即位、退位的精确日界；同名君主、纪年异说及同年多个称号均不能靠名称消除歧义。例如两位“鲁文公”有不同 ID；上游“周平王”采用前 772 年纪元，与常见前 770 年方案不同，已在条目 `limitation` 中明示。

```js
const history = Lunisolar.create();
const lu = history.eras({search:'鲁隐公'})[0]; // 简繁别名
history.lunarToSolar(
  {eraId:lu.id, eraYear:1, month:1, day:1},
  {calendar:'julian'}
); // 春秋历研究方案：儒略历前722年1月16日

history.eras({search:'宏光'}); // 返回弘光，保留异名与别名出处
history.lunarToSolar({eraName:'宏光',eraYear:1,month:1,day:1});
```

为现有 DILA 条目补充十五组有出处的异名规则，如征和／延和、元寿／元受、建武中元／中元、弘光／宏光。本版补充新朝天凤／始建国天凤、地皇／始建国地皇，以及辽重熙／重和／崇熙、大康／太康、寿昌／寿隆／盛昌、乾统／乾通。异名只扩大检索与反查，不覆盖原名，也不合并不同政权的同名年号。`includeReconstructions:false` 同时关闭新增君主纪年；原有 DILA 数据不会被改写。

## 每日 notes：史记、汉书、后汉书、资治通鉴

现有 **15,212** 条古文纪事摘录，比 0.6.0 新增 **1,783** 条，已有摘录 ID 全部保留：

| 史书 | 本次提取范围 | 备注数 |
| --- | --- | ---: |
| 《资治通鉴》 | 扫描全部 294 卷，按保守日期规则提取 | 12,675 |
| 《史记》 | 选定本纪的明确纪年及其上下文中的日期条目 | 119 |
| 《汉书》 | 选定帝纪的明确纪年及其上下文中的日期条目 | 696 |
| 《后汉书》 | 卷一上、一下至卷九，10 篇帝纪中的明确纪年区间 | 1,722 |

其中 **14,485** 条有日期候选，**727** 条存在原文干支问题或不能匹配所用历表，保留 `resolution:'unresolved'`，不挂到某一天。按来源日期精度分为记日 **11,066** 条、仅记月 **3,499** 条、仅记年 **647** 条。每条摘录都可追溯到固定版本、书名、卷次和段号。

《史记》《汉书》《后汉书》是正史，《资治通鉴》是官修编年通史；本项目采用的**电子转录本不是官方校勘定本**。摘录来自[固定版本古文转录](https://github.com/hanzhaodeng/chinese-ancient-text/tree/01a1183cd9bbc243bb156967043c32b6685c0d2f)，快照、作者、校验和及已知问题保存在 [`vendor/chronicles`](vendor/chronicles)。这些是有来源的规则提取结果，不声称已经逐条完成史学校勘。

### 归档规则

- 原文明记月日或干支日：在对应历表中核对日期；有“朔／晦”时同时核对月首／月末。多个历法候选全部保留。
- **只记月份：放在该历法该月初一**，`precision:'month'`、`placement:'month-start'`、`isDisplayAnchor:true`。
- **只记年份：放在该历法该年首日**，`precision:'year'`、`placement:'year-start'`、`isDisplayAnchor:true`。秦汉年首可能为十月，不能一律放在正月初一或公历 1 月 1 日。
- 月首、年首是显示位置，不是推定的发生日期。没有收录备注时返回 `notes:[]`，不表示当天没有历史事件。
- 仅有季节、干支日缺少可靠月份上下文、数字转录冲突等，不自动补齐。“闰月”未给月号时只匹配该年的闰月，保留多候选；不会沿用前一普通月。未挂入日历的提取问题与仍待核的一个冲突年标题见 [`extraction-report.json`](data/chronicles/extraction-report.json)。

提取范围：取段首明示日期后的首句，并扩展到句号、分号后且位于引语之外的明确日期分句；遇到追叙或新的纪年停止扩展。《资治通鉴》还取明确编年标题后的第一条无细日期纪事。《史记》《汉书》《后汉书》在选定本纪、帝纪中沿用已经识别的纪年上下文，记录 `sourceYearParagraph` 供核对。不会从演说、追叙中任意抓取日期，也不会将整段跨日叙事当成同日事件。未支持句式或缺少上下文的原文仍需人工整理，本版不是四部书的完整事件数据库。

0.6.0 对照固定版本文本，将卷 111 的“隆安三年”归档年由误录 339 校为 399、卷 188 的“武德三年”由误录 920 校为 620。原文不改写，51 条受影响备注带 `corrections` 及对照原文链接；证据见 [`corrections.json`](data/chronicles/corrections.json)。卷 214 的 740 年标题干支冲突仍隔离。修复闰月解析等问题后，原来待核的 36 条获得日期候选，原来有候选的 8 条退回待核，共 52 条旧备注的日期候选变化，详见可复现的[0.6.0 逐条对比报告](data/chronicles/progress-0.6-report.json)。

0.7.0 补充《后汉书》帝纪 1,722 条，并扩展三部原有史书中的明确日期分句、《史记》汉文帝后元纪事。新增帝纪区间及纪元依据保存在 [`annal-periods.json`](data/chronicles/annal-periods.json)，以 DILA 的对应年号元年和研究历年标签交叉检查；不会把年号第一条记录所在的公历年份直接当作纪元。原书按年追述使用的年号仅作为 `sourceRegnalLabel` 纪年上下文，不据此断言该年每一天已使用这个年号。

《后汉书》卷八转录本第 111 段的“光和五年”与四库全书本固定版本的“光和元年”不符，已将 15 条受影响摘录的归档年校为 178，原文保留，`corrections` 附证据。另一处真正的光和五年仍归入 182 年。连同上一版的两处校订，当前共有 3 处校订、66 条带校订说明的备注。

本版还撤回三条旧备注不可靠的月初候选：原文的“甲戊”“辛己”“壬戊”是无效干支，不能当作只记月份。条目与 ID 均保留，改为 `precision:'day'`、`resolution:'unresolved'`，不挂入日历。变化明细见 [0.7.0 对比报告](data/chronicles/progress-report.json)。待核原因由 `issue` 给出，页面同步显示：

| `issue` | 含义 | 当前条数 |
| --- | --- | ---: |
| `INVALID_SEXAGENARY_DAY` | 原文干支不合法 | 7 |
| `DAY_BOUNDARY_CONFLICT` | 干支与“朔／晦”不合 | 28 |
| `DAY_NOT_IN_RECORDED_MONTH` | 所记日号／干支不在对应月份内 | 682 |
| `NO_MATCHING_LEAP_MONTH` | 所选历表无匹配闰月 | 8 |
| `NO_MATCHING_MONTH` | 所选历表无匹配月份 | 2 |

若所选历表没有该年资料，则使用 `NO_CALENDAR_YEAR`。这些是所用历表下的诊断，不自动证明史料本身有误。引语识别同时支持中文引号与直引号，避免把诏书或引述中的日期另立为当年事件。

232 条摘录标有 `tags:['era-change']`，表示文字含“改元”等记载，便于检索；这不等于已证明该条就是年号生效日，也不会自动改写年号边界。

### 查询接口

加载 `data/history-notes.js` 后，历史与现代两种模式的换算结果均增加 `matches[].notes`；备注始终按绝对日 JDN 关联，**不使用 Intl 回推结果给史料定日**。

```js
const history = Lunisolar.create();

// 当天备注；该接口也能查没有农历记录的西历日期。
history.notes({year:626,month:7,day:2}, {calendar:'julian'});
// 《资治通鉴》卷191：庚申，世民帅长孙无忌等入，伏兵于玄武门。

// 每一天都返回一项，包括 notes:[] 的日子；区间包含两端，最多366天。
history.notesRange(
  {year:626,month:7,day:1},
  {year:626,month:7,day:31},
  {calendar:'julian'}
);

// 检索与分页；precision 为 day / month / year。
history.searchNotes({search:'阳陵',bookId:'shiji',precision:'month',offset:0,limit:20});
history.searchNotes({resolution:'unresolved'}); // 待核日期条目
history.searchNotes({corrected:true}); // 使用有来源的校订年份
history.searchNotes({tag:'era-change'}); // 含改元等记载
history.searchNotes({bookId:'houhanshu',search:'黄巾'}); // 新增帝纪
history.searchNotes({year:626}); // 史料编年对应的天文纪年标签
history.note('shiji:11:5:0'); // 稳定摘录 ID；找不到时返回 null
```

单条备注包含：`id`、`text`（原文摘录）、`bookId`、`book`、`volume`、`paragraph`（从 0 起）、`precision`、`recordedDate`、`placement`、`isDisplayAnchor`、`resolution`、`dateCandidates`、`sourceUrl` 和 `review`。汉书和后汉书上、下卷另有 `sourceArticle`、`sourceArticleTitle` 定位。新增分句 ID 附加原文字符偏移，汉书上、下卷新增冲突 ID 附加篇章标识；0.5.0、0.6.0 已公布的 ID 保持不变。`sourceUrl` 指向实际使用的固定版本；`readingUrl` 只是另一个阅读入口，不保证其文字与快照相同。

`dateCandidates` 分别标明 JDN、研究历法 ID 和月日；同一绝对日的多份历法解释保留在同一备注中，不重复列成多条事件。同书不同条、不同史书的记载不做臆测性合并。前秦史事没有唯一历法依据时保留多个研究方案的归档候选。

备注数据可选加载。`metadata.notes.loaded` / `notesDataLoaded` 表示是否加载；每一天的 `notesStatus` 区分 `not-loaded`、`no-indexed-notes` 和 `indexed-notes`。`notesCoverage:'partial'` 明确表示事件收录不完备。`complete` 仍只指日期转换是否有已知缺口／冲突，不表示史料收录完备。`includeReconstructions:false` 影响历法候选和补充纪年，不禁用独立的史料备注索引；不需要备注时可不加载该脚本。

离线示例新增：年号搜索、当日备注、整公历月逐日展开、按史书／精度／日期状态／校订或改元主题检索、候选日期跳转及原文链接。单文件约 2.8 MiB，在页面内压缩保存数据，打开时使用浏览器的 `DecompressionStream` 解压，全程无需联网。较旧浏览器可运行 `npm run build:demo -- --uncompressed` 生成 `demo-uncompressed.html`（约 20.9 MiB）。普通 JS 库及可选数据脚本仍同步加载，不要求解压 API。

## 0.4.0 补充覆盖

补充来源：[Yuk Tung Liu / ChineseCalendar](https://github.com/ytliu0/ChineseCalendar)，固定提交 `719e02ff011ab122aad5fb29084e3f6ee8b65390`。保留上游源码、研究说明、许可及 SHA-256 清单于 [`vendor/ytliu`](vendor/ytliu)，以本地脚本可复现地生成 [`data/research-history.js`](data/research-history.js)。这部分查询不依赖 Intl。

新增 **68,546 条月段、18 套研究历法**：

| 研究方案 | N_y 年标签范围（天文纪年） |
| --- | --- |
| 春秋历（鲁历重建） | -721—-480 |
| 周历、殷历 | -721—-221 |
| 夏历两种历元 | -721—-480 / -479—-221 |
| 鲁历、黄帝历、颛顼历（古六历） | -479—-221 |
| 秦及汉初颛顼历 | -220—-105 |
| 历代主历表研究序列 | -104—2026 |
| 蜀汉、孙吴 | 221—263 / 222—280 |
| 后秦、北凉 | 384—417 / 412—439 |
| 北魏—西魏—北周—隋、东魏—北齐 | 398—590 / 534—577 |
| 辽—金—元、南明及明郑 | 947—1279 / 1645—1683 |

研究序列的年份是上游历年的标识，不是精确政权存续区间。历年可能始于上一公历年或结束于下一公历年。补充数据截断于 **2026-10-25**，不会将此后的预测冒充历史记录。

合并来源后，至少存在一个候选的日期增加 **225,586 天**，原 DILA 标准有效记录之间的 **7 段内部空档**全部有补充来源可查。来源并集从回推格里高利历 `-722-12-08` 连续至 `2026-10-25`；最早区间属于 N_-721（公元前 722 年）的研究历年。**并集无空档只表示每天有来源候选，不表示每天都已查实，也不表示各政权资料完备。** 计算明细见 [`data/coverage.json`](data/coverage.json)。

### 研究历法查询

```js
const history = Lunisolar.create();
history.calendars(); // 名称、范围、研究假设、说明链接

// 春秋历 N_-721 的正月初一；来源给出的儒略历日期为前722年1月16日
history.lunarToSolar(
  { calendarId: 'ytliu/chunqiu', year: -721, month: 1, day: 1 },
  { calendar: 'julian' }
);

// 同一西历日保留所有方案；可指定 calendarId 筛选
history.solarToLunar(
  { year: -721, month: 1, day: 16 },
  { calendar: 'julian', calendarId: 'ytliu/chunqiu' }
);

// 239 年出现两个普通十二月：即使明确 isLeap:false，仍有两个日期
history.lunarToSolar({
  calendarId: 'ytliu/main', year: 239, month: 12, day: 1, isLeap: false
});

// 仅使用原 DILA 历表
const dilaOnly = Lunisolar.create({ includeReconstructions: false });
```

研究候选同样保存在 `matches[].lunars`，字段为 `calendarId`、`calendarName`、`year`、`month`、`monthName`、`day`、`isLeap`、`sourceId` 和 `recordId`；`basis` 明确为 `historical-reconstruction`。可将该候选直接传回 `lunarToSolar`。上游历法数据无本项目的年号 ID，不编造年号映射。

每条候选标明 `sourceId`，整体结果的 `sources` 提供来源清单。不同来源不被互相覆盖，也不自动判定哪一个更正确。旧 `source` 字段保留 DILA 信息以兼容 0.3.0；判断候选依据应读取 `sourceId`。

古六历中的“黄帝历”“夏历”是研究方案名称，不能据此声称重建了黄帝或夏代的完整实用历。春秋和古六历采用上游的年终置闰方案，这是一项需要保留的假设。通用年终闰月用 `month:13, monthName:'閏月', isLeap:true` 编码，13 是该方案的序号，不表示现代“闰十三月”；颛顼历保留“後九月”。特定历法改革的 28 天月份和重复普通月均原样保留。

更早的公元前 2000 年等日期仍返回 `undetermined`。需要现代规则推算时必须显式选择现代模式，不能把它作为史料补全。

## 来源、覆盖与质量

原有来源：[DILA Time Authority Open Content](https://authority.dila.edu.tw/docs/open_content/download.php) 的 `authority_time_chinese.2012-02.zip`。原始压缩包、许可和结构说明保存在 [`vendor/dila`](vendor/dila)，转换脚本为 [`scripts/build-history.py`](scripts/build-history.py)。

导入 56,327 条月/拆分月记录，关联 928 个年号。原始记录边界为 JDN 1641025—2419450，对应回推格里高利历天文纪年 `-220-11-14` 至 `1912-02-17`。这只是来源记录的外边界，不代表每个朝代、每个日期都有可靠记录。不能将其覆盖扩展为公元前 2000 年的确定历史历法。

原始包 SHA-256：`53937ef60dbe8061a2e56aa8ef2feaaa08a1fa4d1a62a117a4b9932046f55530`。

来源含 `S`（standard）和 `P`（proleptic）状态。默认排除 `P`。确需查询文献中的外推纪年时，可以显式使用：

```js
const history = Lunisolar.create({ mode: 'historical', includeProleptic: true });
```

这类候选的 `basis` 为 `source-proleptic`，不能当作实际颁历。

来源自身说明年号起讫状态的标注尚未完成，部分边缘政权缺失。因此 `S` 不等于独立验证过的历史事实。本项目保留数据来源和记录 ID，不承诺历史绝对准确性。详见 [来源的局限说明](https://authority.dila.edu.tw/docs/open_content/notes.php) 及随包 README。

当前检测到两条日号超出三十的来源记录：`23237`、`29472`。不猜测修补日期；涉及这些记录的查询报告 `SOURCE_DATA_CONFLICT`，无效候选不进入结果。一个年号缺少名称时保留其 ID，不杜撰名称。

### 数据许可

DDBC / DILA（法鼓佛教学院 / 法鼓文理学院）提供原始数据。按下载包中 `README.txt` 和 `COPYING.txt` 声明，原始及本项目派生的历表数据以 **CC BY-SA 3.0 Unported** 分发。派生内容只做结构转换、排序和选取字段；原始记录区间不作猜测性修补。DILA 数据脚本和离线示例中的内嵌 DILA 数据同样适用此许可。完整条款见 [`vendor/dila/COPYING.txt`](vendor/dila/COPYING.txt)。

项目程序代码、Yuk Tung Liu 上游研究源码和派生研究历表按 **GPL-3.0-only** 分发，保留作者署名和对应源文件；见 [LICENSE](LICENSE) 与 [`vendor/ytliu/LICENSE`](vendor/ytliu/LICENSE)。DILA 数据作为独立资料保留其 CC BY-SA 3.0 许可，不被改成 GPL。离线示例内嵌数据分别遵循各自许可。

## 现代回推 / 预测（显式选择）

```js
const modern = Lunisolar.create({ mode: 'modern' });
modern.solarToLunar({ year: -1999, month: 1, day: 1 }); // 公元前 2000 年
modern.lunarToSolar({ year: -1999, month: 1, day: 1 });
modern.solarToLunar({ year: 3000, month: 12, day: 31 });
```

该模式使用浏览器 `Intl/chinese`，结果明确带 `basis: 'modern-projection'`；**它不能还原古代实际颁历**。同样，未来结果是预测，不是已经颁行的历史记录。

此模式的候选保留原有 `lunar: {year, month, day, isLeap}` 格式，`year` 是天文纪年的 `relatedYear`。默认完整农历年范围 `-2000..3000`，包含公元前 2000 年春节前日期所需的前一农历年。农历 3000 年延伸到公历 3001 年的日期不截断。`minYear` / `maxYear` 仅用于本模式；允许下界最小 -2000、上界最大 9998，但扩大配置不构成精度保证。

依赖支持中国历、`formatToParts`、`relatedYear`、数字月 / `bis` 闰月标记的浏览器。不同 ICU 版本可能影响结果。现代模式使用固定 UTC+08:00 民用日，不受设备时区影响。

## 西历与纪元

两种模式均接受第二个参数：

| calendar | 含义 |
| --- | --- |
| `gregorian` | 默认，回推格里高利历 |
| `julian` | 回推儒略历 |
| `auto` | 同时考虑上述两种历法，不推断地区历史 |
| `historical` | 用 `firstGregorian` 指定当地首次采用格里高利历的日期 |

```js
Lunisolar.resolveSolar(
  {year:1582,month:10,day:10},
  {calendar:'historical',firstGregorian:{year:1582,month:10,day:15}}
); // none：仅对采用此改历断点的地区成立
```

西历的 `calendar:'historical'` 控制儒略历/格里高利历切换；农历的 `mode:'historical'` 控制中国历史历表，二者独立。

独立西历 API 为 `toJdn`、`fromJdn`、`resolveSolar`，支持天文纪年 -9999—9999。公元前 N 年 = `1-N`，公元前 1 年 = 0。`dayIndex = JDN - 1721426`，回推格里高利历 `0001-01-01` 为第 0 天。避免 JS 0—99 年的特殊解释，不接受 Excel 虚构的格里高利历 1900-02-29。

西历历史模式只建模一次向前跳日的改历，不包括瑞典 1712-02-30 或非一月换年的地方纪年习惯。

## 构建与验证

```sh
npm test                 # 现代回归 + DILA + 补充研究历表测试（Node.js 22+，完整 ICU）
npm run test:range      # 较慢，仅验证现代回推模式 5001 个农历年的结构
npm run build:history  # 从固定原始包重新生成历史数据，需要 Python 3
npm run build:research # 从固定研究源码生成补充历表和覆盖报告
npm run build:notes    # 生成君主纪年、史料摘录、日期候选和提取报告
npm run build:demo     # 重新生成单文件离线示例
```

历史测试验证 103,995 个有效 standard 月段边界的双向查询，覆盖同日多朝代、同名年号、多闰月候选、特殊月名、月中改元、资料缺失、外推标记与源数据冲突。1662-02-18 是防止历史查询误走 Intl 的差异回归案例。

补充研究历表还验证了 **137,092** 个新增月段边界的双向查询，以及春秋历锚点、239 年重复十二月、秦汉改历衔接、研究数据开关、资料截止日和原 7 段空档。

0.7.0 测试逐条核对 **15,212** 段摘录确实包含于固定原文，检查 **15,408** 个归档候选的干支／朔晦／月首／年首规则，并验证 **25,376** 次补充君主纪年月界往返。独立日期案例为玄武门之变（儒略历 626-07-02），另检查引语及追叙不会产生新日期分句、后续日期分别归档、闰月与纪年上下文、东汉纪元交叉检查、无效干支隔离、校订证据、旧 ID 保留、改历缺日、异名、待核条目、数据未加载及返回对象隔离。

这些检查验证转换实现及来源的一致性，不是对源历表历史正确性的独立证明。

## 从 0.2.0 迁移

- 需要原有现代回推行为：把 `Lunisolar.create()` 改为 `Lunisolar.create({mode:'modern'})`。
- 需要历史查询：加载数据脚本，使用默认模式，并按年号纪年反查。
- 历史输出读取 `matches[].lunars`；现代输出仍读取 `matches[].lunar`。
- 调用方必须处理 `undetermined`，不能把资料缺失当作不存在的日期或自动使用回推值。
