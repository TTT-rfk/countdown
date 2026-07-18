(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SZCore=api;})(typeof self!=='undefined'?self:this,function(){
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function angleDelta(a,b){let d=a-b;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return d}
function segmentCircle(x1,y1,x2,y2,cx,cy,r){const vx=x2-x1,vy=y2-y1,l=vx*vx+vy*vy;const t=l?clamp(((cx-x1)*vx+(cy-y1)*vy)/l,0,1):0;const dx=x1+vx*t-cx,dy=y1+vy*t-cy;return dx*dx+dy*dy<=r*r}
function damageAtRange(base,distance,falloffStart,maxRange,minMultiplier){if(distance<=falloffStart)return base;const t=clamp((distance-falloffStart)/(maxRange-falloffStart),0,1);return base*(1-t*(1-minMultiplier))}
function absorbDamage(damage,armor,ratio){const absorbed=Math.min(armor,Math.ceil(damage*ratio));return{armor:armor-absorbed,hpDamage:damage-absorbed,absorbed}}
const waveTarget=w=>6+w*2;
return{clamp,angleDelta,segmentCircle,damageAtRange,absorbDamage,waveTarget};});