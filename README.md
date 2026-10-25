# lunisolar-browser

浏览器端农历与西历双向查询，支持闰月候选、儒略历 / 格里高利历，以及指定地区的改历断档。运行时无第三方依赖。

> 农历计算依赖浏览器 `Intl` 中国历。默认支持公元前 2000 年至公元 3000 年的双向查询；这不是历代实际颁行农历的还原工具，也不是独立的天文求解器。

## 使用

下载仓库后，直接用浏览器打开 `demo.html`。集成时引入 `lunisolar.js`：

```html
<script src="lunisolar.js"></script>
<script>
const cal = Lunisolar.create();

// 公元前 2000 年 = 天文纪年 -1999；不是 -2000
console.log(cal.solarToLunar({ year: -1999, month: 1, day: 1 }));
console.log(cal.lunarToSolar({ year: -1999, month: 1, day: 1 }));
console.log(cal.solarToLunar({ year: 3000, month: 12, day: 31 }));

// 公历转农历
console.log(cal.solarToLunar({ year: 2024, month: 2, day: 10 }));

// 省略 isLeap，同时查询普通月和闰月
console.log(cal.lunarToSolar({ year: 2023, month: 2, day: 1 }));
// 两个候选：2023-02-20、2023-03-22

// 仅查询闰二月
console.log(cal.lunarToSolar({
  year: 2023, month: 2, day: 1, isLeap: true
}));
</script>
```

## 候选与日期身份

```js
{
  status: "none", // 或 "unique"、"ambiguous"
  matches: []
}
```

每个候选包含 `jdn`、`dayIndex`、`lunar`、`solar`。`jdn` 标识实际日期，`solar` 数组保存同一天的西历写法。同一天有两种写法仍是 `unique`；实际日期有多个才是 `ambiguous`。

- `isLeap` 省略：同时查询普通月和闰月。
- `isLeap: false`：仅普通月。
- `isLeap: true`：仅闰月。
- 合法字段组成的不存在日期返回 `none`；字段错误、范围不足或引擎不支持则抛异常。
- 农历 `year` 使用 `relatedYear`，通常是该农历年春节所在的公历年，不是干支名或黄帝纪年。

## 西历模式

两个查询方法均接受第二个参数：

| calendar | 含义 |
| --- | --- |
| `gregorian` | 默认，回推格里高利历 |
| `julian` | 回推儒略历 |
| `auto` | 显式同时考虑以上两种历法，不推断地区历史 |
| `historical` | 由 `firstGregorian` 指定当地首次使用格里高利历的日期 |

```js
// 在适用此改历日期的地区，1582-10-10 不存在。
// 独立西历层不受农历引擎默认年份范围限制。
Lunisolar.resolveSolar(
  { year: 1582, month: 10, day: 10 },
  { calendar: "historical", firstGregorian: { year: 1582, month: 10, day: 15 } }
);
// { status: "none", matches: [] }
```

历史模式仅建模一次向前跳日的儒略历到格里高利历切换。不包含瑞典 1712-02-30 等特殊日期，也不处理非 1 月 1 日换年的历史纪年规则。1582 年的断档不能作为全球统一规则。

## 纪元、范围与准确性

- 独立西历 API：`toJdn(date, calendar)`、`fromJdn(jdn, calendar)`、`resolveSolar(date, options)`。
- 西历支持天文纪年 -9999—9999：公元前 1 年记为 0，公元前 2 年记为 -1。
- `dayIndex = jdn - 1721426`，回推格里高利历 `0001-01-01` 为第 0 天。
- 避开 JS `Date.UTC` 对 0—99 年的特殊解释；格里高利历不接受 Excel 的虚构日期 1900-02-29。
- 农历使用固定 UTC+08:00 民用日，不依赖用户设备时区。
- API 输入输出统一采用天文纪年：公元前 N 年写作 `1 - N`；不存在传统纪年的公元 0 年。离线示例支持直接选择“公元前”并输入正数年份。
- 默认完整农历 `relatedYear` 范围为 `-2000..3000`。额外包含 `-2000` 是因为公历公元前 2000 年（`-1999`）春节前的日期属于上一农历年，必须能反查。农历 3000 年的部分日期会落在公历 3001 年，同样返回，不截断候选。
- 可显式配置范围，例如 `Lunisolar.create({ minYear: -2000, maxYear: 9998 })`；允许的下界最小为 `-2000`。范围配置和往返检查不构成历史或天文精度保证。
- 依赖 `Intl.DateTimeFormat` 的中国历、`formatToParts`、`relatedYear` 与数字月 / `bis` 闰月标记。初始化进行支持检测；不兼容会报错。
- 浏览器及 ICU 版本可能影响结果。需要严格跨运行时一致性或全历史转换时，应另行固定并审计历法引擎与历史历表。

## 测试

Node.js 22 或更新版本，须具备完整 ICU：

```sh
npm test
# 或 node test-lunisolar.cjs

# 较慢的全范围年份结构检查（5001 个完整农历年）
npm run test:range
```

测试覆盖已知春节、2023 闰二月、2033 闰十一月、公元前 2000 年、公元前 2 年、公元前 1 年、公元 1 / 99 / 2023 / 3000 年全年逐日往返、1900—2100 年完整年份结构、公元零年与负年、闰世纪、1582 / 1752 改历断档。

离线示例另外通过了 Chromium 中的闰月多候选、改历缺日、公元前 / 公元纪年输入，以及纽约 / 东京 / UTC 三种宿主时区各 30 个边界与抽样日期的往返一致性检查。往返与结构检查不等同于独立天文精度认证。

`test:range` 逐年验证农历 `-2000..3000` 的完整年份结构，包含边界补充年；它不使用独立历表验证古代日期的绝对精度。

详见 [接口说明](README.txt)。`demo.html` 内嵌同一份脚本，便于离线单文件使用。
