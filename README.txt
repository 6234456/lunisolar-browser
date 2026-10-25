浏览器历法双向查询 0.3.0

本版修正历史日期的计算依据。完整接口、迁移说明和数据许可见 README.md。

历史模式（默认）
  先加载 data/dila-history.js，再加载 lunisolar.js。
  const history = Lunisolar.create();
  history.solarToLunar({year:1662,month:2,day:18});
  history.lunarToSolar({eraId:660,eraYear:1,month:1,day:1});
  history.eras({search:'康熙'});

  结果按 JDN 分组，matches[].lunars 保留同日的多个历史纪年。
  无资料或源数据冲突返回 undetermined；不会自动调用 Intl。
  年号同名、政权并行、闰月省略都可能产生多个候选。
  默认排除来源 P（外推）记录；includeProleptic:true 可显式包含，但保留外推标记。

现代回推 / 预测
  const modern = Lunisolar.create({mode:'modern'});
  modern.solarToLunar({year:-1999,month:1,day:1});
  modern.lunarToSolar({year:-1999,month:1,day:1});
  支持公元前 2000 年至公元 3000 年的现代规则回推 / 预测，仍使用 Intl。
  结果 basis 为 modern-projection，不代表古代实际颁历。
  该模式保留 matches[].lunar 格式。

资料来源
  DDBC / DILA authority_time_chinese.2012-02.zip，56,327 条月段、928 个年号。
  来源记录边界 JDN 1641025..2419450，不保证内部历史信息完备。
  不能据此保证公元前 2000 年起的完整实际官历；未覆盖的日期返回无法确定。
  来源说明年号起讫状态尚未完整标注；两条异常记录 23237/29472 报告数据冲突。
  原始包、README、SCHEMA、CC BY-SA 3.0 完整许可保存在 vendor/dila。
  派生历表数据及离线示例中的内嵌数据同样依 CC BY-SA 3.0 分发。

西历与纪年
  公元前 N 年使用天文纪年 1-N。公元前 2000 年 = -1999，公元前 1 年 = 0。
  独立西历层支持 -9999..9999，dayIndex 以回推公历 0001-01-01 为第 0 天。
  gregorian / julian / auto / historical 模式、当地改历断点与源资料日编号独立处理。

npm test 验证现代回归及历史月段往返；npm run test:range 仅验证现代模式的年份结构。
验证转换一致性不等同于证明源数据的历史准确性。
