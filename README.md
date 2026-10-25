# lunisolar-browser

浏览器端西历与中国历法双向查询，支持多候选、儒略历 / 格里高利历、指定地区改历断档。

**0.3.0 修正了历史查询的计算依据。默认使用有来源的 DILA 历表，不再把 Intl 的现代回推结果当作历史日期。** 现代回推仍可显式选择，范围为公元前 2000 年至公元 3000 年。

公元前 2000 年至公元 3000 年不存在一份可据此保证完整、唯一且符合实际颁历的历史资料。本项目不会用天文回推填补历史资料空白，也不会把未来日期称为实际颁历。

## 历史查询（默认）

下载仓库，直接打开单文件离线示例 `demo.html`。集成代码时：

```html
<script src="data/dila-history.js"></script>
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
  basis: 'historical-table',
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
- 缺少历史数据脚本时会报错，不偷偷使用 Intl。

## 来源、覆盖与质量

来源：[DILA Time Authority Open Content](https://authority.dila.edu.tw/docs/open_content/download.php) 的 `authority_time_chinese.2012-02.zip`。原始压缩包、许可和结构说明保存在 [`vendor/dila`](vendor/dila)，转换脚本为 [`scripts/build-history.py`](scripts/build-history.py)。

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

DDBC / DILA（法鼓佛教学院 / 法鼓文理学院）提供原始数据。按下载包中 `README.txt` 和 `COPYING.txt` 声明，原始及本项目派生的历表数据以 **CC BY-SA 3.0 Unported** 分发。派生内容只做结构转换、排序和选取字段；原始记录区间不作猜测性修补。数据脚本和离线示例中的内嵌数据同样适用此许可。完整条款见 [`vendor/dila/COPYING.txt`](vendor/dila/COPYING.txt)。

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
npm test                 # 现代回归 + 历史记录测试（Node.js 22+，完整 ICU）
npm run test:range      # 较慢，仅验证现代回推模式 5001 个农历年的结构
npm run build:history  # 从固定原始包重新生成历史数据，需要 Python 3
npm run build:demo     # 重新生成单文件离线示例
```

历史测试验证 103,995 个有效 standard 月段边界的双向查询，覆盖同日多朝代、同名年号、多闰月候选、特殊月名、月中改元、资料缺失、外推标记与源数据冲突。1662-02-18 是防止历史查询误走 Intl 的差异回归案例。

这些检查验证转换实现及来源的一致性，不是对源历表历史正确性的独立证明。

## 从 0.2.0 迁移

- 需要原有现代回推行为：把 `Lunisolar.create()` 改为 `Lunisolar.create({mode:'modern'})`。
- 需要历史查询：加载数据脚本，使用默认模式，并按年号纪年反查。
- 历史输出读取 `matches[].lunars`；现代输出仍读取 `matches[].lunar`。
- 调用方必须处理 `undetermined`，不能把资料缺失当作不存在的日期或自动使用回推值。
