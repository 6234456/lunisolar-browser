Browser 农历双向查询

文件
  lunisolar.js       浏览器经典脚本，通过 globalThis.Lunisolar 暴露 API。
  demo.html         可直接用浏览器打开的离线示例（嵌入同一份脚本）。
  test-lunisolar.cjs Node 回归检查，运行 node test-lunisolar.cjs。

使用
  <script src="lunisolar.js"></script>
  const cal = Lunisolar.create();
  cal.solarToLunar({year:2024, month:2, day:10});
  cal.lunarToSolar({year:2023, month:2, day:1});
  cal.lunarToSolar({year:2023, month:2, day:1, isLeap:true});

结果
  {status:'none'|'unique'|'ambiguous', matches:[...]}
  每个 match 对应一个实际日期，以 jdn 标识，带 dayIndex、lunar、solar。
  solar 是同一天在不同西历下的写法数组，不会把多种写法算成多个实际日期。
  isLeap 省略：同时匹配普通月、闰月；false：仅普通月；true：仅闰月。
  已知历法中不存在的日期，以及不存在的闰月/月日，返回 none。
  字段格式错误、超出计算范围、缺失历史改历参数、Intl 不兼容会抛异常。
  范围不足时不返回部分候选，以免把有歧义的输入误报为唯一。
  year 是 relatedYear，通常等于该农历年春节所在的公历年；不是干支名或黄帝纪年。

西历选项（两个查询方法共用第二个参数）
  {calendar:'gregorian'} 默认，回推格里高利历。
  {calendar:'julian'} 回推儒略历。
  {calendar:'auto'} 显式同时考虑上述两种历法，不是自动推断地区历史。
  {calendar:'historical', firstGregorian:{year:1582,month:10,day:15}}
    指定某地区的第一个格里高利历日期；前一天使用儒略历。
    英国本土可设置 1752-09-14。不能套用于其他地区或殖民地。
    此模型只支持一次向前跳日的改历；不包含瑞典 1712-02-30 等特例，
    也不包含某些历史地区非 1 月 1 日换年的纪年习惯。

独立西历层
  Lunisolar.toJdn(date, 'gregorian'|'julian')
  Lunisolar.fromJdn(jdn, 'gregorian'|'julian')
  Lunisolar.resolveSolar(date, options)
  支持天文纪年 -9999..9999，公元前 1 年 = 0、公元前 2 年 = -1。
  dayIndex = JDN - 1721426，回推格里高利历 0001-01-01 为第 0 天。
  JDN 是对应日期正午的整数编号；此处用于日期对齐，不代表输入某个具体时刻。
  resolveSolar 可在农历范围之外独立处理历史断档。
  不使用 Date.UTC(year,...) 或日期字符串解析，不触发 JS 0..99 年映射到 1900..1999。
  使用 Math.floor 实现负数向下取整。Excel 的虚构 1900-02-29 不被接受为格里高利历日期。

范围与准确性
  默认支持公元前 2000 年至公元 3000 年的双向查询，依赖当前浏览器的 Intl/ICU 中国历数据和算法。
  支持浏览器：必须具备 Intl 中国历、formatToParts、relatedYear 和数字月份 bis 闰月标记。
  脚本会检测支持情况，并以 2023 闰二月初一进行启动自检；不兼容会报错。
  使用固定 UTC+08:00 民用日；不依赖用户时区，也不使用 Asia/Shanghai 的历史时区变化。
  所有输入输出年份为天文纪年：公元前 N 年 = 1-N，公元前 2000 年 = -1999。
  默认完整农历 relatedYear 范围 -2000..3000，额外前一年支持下界春节前的日期反查。
  农历 3000 年延伸到公历 3001 年的日期正常返回，不截断候选。
  可显式扩大：Lunisolar.create({minYear:-2000,maxYear:9998})，minYear 最小为 -2000。
  扩大范围只是允许调用浏览器的回推结果，不是准确性承诺；年结构检查失败会中止。
  本实现不是自研朔/中气天文求解器，不能保证跨浏览器版本结果完全一致，
  支持公元前农历的回推查询，但不能据此还原历代实际颁行的中国历法。
  西历连续计日可以从纪元起算；农历没有在此实现从古代纪元累计的历史历法算法。
  要实现可靠的全历史查询，必须另提供分时期的历表/历法引擎及年代依据。
  跨运行时一致性或高精度天文需求应固定并审计计算引擎，不能把 Intl 当标准历书。

性能
  反查首次查询某年时枚举两个公历年，只保留目标 relatedYear，避免凭平均月长推算。
  缓存最近插入的 8 个年份；正查直接调用 Intl。
  批量跨年查询可将相同脚本放进 Web Worker，避免阻塞浏览器 UI。

验证范围
  已知春节、闰月、2033 闰十一月案例；天文纪年 -1999/-1/0/1/99/2023/3000 全年每日往返；
  1900..2100 年份结构检查；1582/1752 改历断档；公元零年、负年、闰世纪。
  npm run test:range 对完整农历年 -2000..3000 逐年检查结构，含边界补充年，共 5001 年。
  往返与结构检查用于检测程序错误，不等于独立天文精度认证。

  另已通过 Chromium 实机验证：闰月多候选、改历缺日，以及纽约/东京/UTC 三种宿主时区下结果一致。
