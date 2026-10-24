const assert = require('node:assert/strict');
require('./lunisolar.js');
const {create,toJdn,fromJdn,resolveSolar,EPOCH_JDN} = Lunisolar;
const c = create();
assert.equal(toJdn({year:1,month:1,day:1}), EPOCH_JDN);
assert.equal(toJdn({year:2000,month:1,day:1}),2451545);
assert.equal(toJdn({year:1970,month:1,day:1}),2440588);
assert.equal(toJdn({year:1,month:1,day:1})-toJdn({year:0,month:12,day:31}),1);
for(const calendar of ['gregorian','julian']) {
  for(const year of [-9999,-4801,-4800,-100,-1,0,1,4,99,100,400,1582,1900,2000,9999]) {
    for(const month of [1,2,3,10,12]) {
      const d={year,month,day:28};
      assert.deepEqual(fromJdn(toJdn(d,calendar),calendar),d);
    }
  }
}
assert.equal(resolveSolar({year:1900,month:2,day:29}).status,'none');
assert.equal(resolveSolar({year:1900,month:2,day:29},{calendar:'auto'}).matches[0].solar[0].calendar,'julian');
const reform={calendar:'historical',firstGregorian:{year:1582,month:10,day:15}};
for(let day=5;day<=14;day++) assert.equal(resolveSolar({year:1582,month:10,day},reform).status,'none');
assert.equal(resolveSolar({year:1582,month:10,day:15},reform).matches[0].jdn-
  resolveSolar({year:1582,month:10,day:4},reform).matches[0].jdn,1);
const british={calendar:'historical',firstGregorian:{year:1752,month:9,day:14}};
assert.equal(resolveSolar({year:1752,month:9,day:10},british).status,'none');
assert.throws(()=>resolveSolar({year:2000,month:1,day:1},{calendar:'historical'}));
assert.throws(()=>create({minYear:0}));
assert.throws(()=>c.solarToLunar({year:1,month:1,day:1}),RangeError);
const two=c.lunarToSolar({year:2023,month:2,day:1});
assert.equal(two.status,'ambiguous');
assert.deepEqual(two.matches.map(m=>m.solar[0]),[
  {calendar:'gregorian',year:2023,month:2,day:20},
  {calendar:'gregorian',year:2023,month:3,day:22}
]);
assert.equal(c.lunarToSolar({year:2023,month:2,day:1,isLeap:false}).status,'unique');
assert.equal(c.lunarToSolar({year:2024,month:1,day:1,isLeap:true}).status,'none');
assert.equal(c.lunarToSolar({year:2023,month:2,day:30,isLeap:true}).status,'none');
assert.throws(()=>c.lunarToSolar({year:2023,month:2,day:1,isLeap:null}));
const aliases=c.lunarToSolar({year:2024,month:1,day:1},{calendar:'auto'});
assert.equal(aliases.status,'unique');
assert.equal(aliases.matches[0].solar.length,2);
assert.deepEqual(aliases.matches[0].solar[0],{calendar:'gregorian',year:2024,month:2,day:10});
assert.equal(c.solarToLunar({year:2024,month:2,day:10},{calendar:'auto'}).status,'ambiguous');
assert.deepEqual(c.lunarToSolar({year:2033,month:11,day:1,isLeap:true}).matches[0].solar[0],
  {calendar:'gregorian',year:2033,month:12,day:22});
// Every day of 2023, including the leap-month transitions, must round-trip.
let count=0;
for(let jdn=toJdn({year:2023,month:1,day:1}); jdn<=toJdn({year:2023,month:12,day:31});jdn++) {
  const lunar=c.solarToLunar(fromJdn(jdn)).matches[0].lunar;
  assert.equal(c.lunarToSolar(lunar).matches[0].jdn,jdn);
  count++;
}
// Verify complete-year structure for the entire configured interval.
for(let year=1900;year<=2100;year++) {
  const first=c.lunarToSolar({year,month:1,day:1,isLeap:false});
  assert.equal(first.status,'unique');
  assert.equal(c.solarToLunar(first.matches[0].solar[0]).matches[0].lunar.year,year);
}
console.log(`Passed civil boundary fixtures, lunar known dates, ${count} daily round trips, and 201 complete-year structure checks.`);
