const assert = require('node:assert/strict');
require('./lunisolar.js');
const cal = Lunisolar.create();
for (let year = -2000; year <= 3000; year++) {
  // Each reverse query builds and validates the complete lunar year, including
  // the extra boundary year needed for Gregorian BCE 2000 January dates.
  assert.equal(cal.lunarToSolar({year,month:1,day:1,isLeap:false}).status,'unique',`year ${year}`);
  if (year % 250 === 0) console.log(`Validated through lunar relatedYear ${year}`);
}
console.log('Passed complete-year structure checks for all 5001 lunar years.');
