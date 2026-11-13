// Vue « Projets » : un habitat paramétrique en plan, coupe et 3D, avec des simulations (lumière, abri, chaleur).
// ATTENTION : modèles JOUETS (voir refonte/PROJETS.md) : les formes des courbes sont justes (géométrie du soleil),
// les valeurs de radiation et de chaleur sont inventées et ne doivent pas être lues comme des données.
// Généré depuis refonte/maquettes/_src/projet.body.html puis maintenu ici.
const HTML = "<div class=\"pj-app\">\n <aside class=\"pj-params\" aria-label=\"Paramètres\">\n  <h2>Projet</h2>\n  <div class=\"pj-lieux\" id=\"lieux\" role=\"group\" aria-label=\"Lieu\">\n    <button data-s=\"lune\" class=\"on\"><i style=\"background:#c8c6be\"></i>Lune</button>\n    <button data-s=\"mars\"><i style=\"background:#8a8a8a\"></i>Mars</button>\n    <button data-s=\"terre\"><i style=\"background:#e9e6dd\"></i>Terre</button>\n  </div>\n  <div class=\"pj-p\"><label for=\"R\">Rayon</label><output id=\"oR\"></output><input type=\"range\" id=\"R\" min=\"3\" max=\"8\" step=\".5\" value=\"4\"></div>\n  <div class=\"pj-p\"><label for=\"H\">Hauteur</label><output id=\"oH\"></output><input type=\"range\" id=\"H\" min=\"2.5\" max=\"6\" step=\".5\" value=\"3\"></div>\n  <div class=\"pj-p\"><label for=\"E\">Régolithe</label><output id=\"oE\"></output><input type=\"range\" id=\"E\" min=\"0\" max=\"3\" step=\".25\" value=\"1\"></div>\n  <div class=\"pj-p\"><label for=\"O\">Orientation</label><output id=\"oO\"></output><input type=\"range\" id=\"O\" min=\"0\" max=\"350\" step=\"10\" value=\"0\"></div>\n  <div class=\"pj-p\"><label for=\"N\">Modules</label><output id=\"oN\"></output><input type=\"range\" id=\"N\" min=\"1\" max=\"4\" step=\"1\" value=\"2\"></div>\n  <button class=\"pj-bouton\" id=\"raz\" type=\"button\">↺ Valeurs de départ</button>\n  <span class=\"pj-ph\">Maquette : modèle jouet. Les formes des courbes sont justes, les valeurs ne sont pas sourcées.</span>\n </aside>\n <div class=\"pj-zone\">\n  <section class=\"pj-vue\" aria-label=\"Vue du projet\">\n    <div class=\"pj-onglets\" id=\"vues\" role=\"group\" aria-label=\"Vue\"><button data-v=\"plan\" class=\"on\">Plan</button><button data-v=\"coupe\">Coupe</button><button data-v=\"3d\">3D</button></div>\n    <svg id=\"vp\" viewBox=\"0 0 800 520\" preserveAspectRatio=\"xMidYMid meet\"></svg>\n  </section>\n  <section class=\"pj-sim\" aria-label=\"Simulations\">\n    <div class=\"pj-haut\">\n      <div class=\"pj-onglets\" id=\"sims\" role=\"group\" aria-label=\"Simulation\"><button data-m=\"lum\" class=\"on\">☀ Lumière</button><button data-m=\"rad\" >☢ Abri</button><button data-m=\"chal\">◐ Chaleur</button></div>\n      <div class=\"pj-cycle\"><button class=\"pj-bouton pj-plein\" id=\"lance\" type=\"button\">▶ Lancer</button><input type=\"range\" id=\"C\" min=\"0\" max=\"1000\" value=\"250\" aria-label=\"Moment du cycle\"><span class=\"pj-mono\" id=\"oC\"></span></div>\n    </div>\n    <svg id=\"ch\" viewBox=\"0 0 800 240\" role=\"img\" aria-label=\"Courbe de simulation\"></svg>\n    <div class=\"pj-jauges\" id=\"jauges\"></div>\n    <span class=\"pj-leg\" id=\"leg\"></span>\n  </section>\n </div>\n</div>";

export function initProjets(root) {
  root.innerHTML = HTML;
  (function () {
(function(){
  var NS='http://www.w3.org/2000/svg',$=function(i){return root.querySelector('#'+i)};
  var SITES={
    lune:{cycle:'mois lunaire',jours:29.5,elev:function(p){return 2+2*Math.cos(2*Math.PI*p)},az:function(p){return 360*p},lib:function(p){return 'jour '+Math.round(p*29.5)}},
    mars:{cycle:'sol',elev:function(p){return 55*Math.sin(Math.PI*p)},az:function(p){return 90+180*p},lib:function(p){return Math.round(p*24.6)+' h'}},
    terre:{cycle:'jour',elev:function(p){return 75*Math.sin(Math.PI*p)},az:function(p){return 90+180*p},lib:function(p){return Math.round(p*24)+' h'}}
  };
  var S={site:'lune',R:4,H:3,E:1,O:0,N:2,C:.25,vue:'plan',sim:'lum'},DEF=JSON.parse(JSON.stringify(S));
  var LAMBDA=.8, DELTA=.9;                          // longueurs d'atténuation JOUET (à sourcer)
  function el(t,a,p){var e=document.createElementNS(NS,t);for(var k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e}
  function rad(d){return d*Math.PI/180}
  function elev(p){return SITES[S.site].elev(p)}
  function ombreLong(ht,e){return e<0.4?0:ht/Math.tan(rad(e))}
  function hull(pts){pts=pts.slice().sort(function(a,b){return a[0]-b[0]||a[1]-b[1]});var c=function(o,a,b){return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])},lo=[],up=[],i;
    for(i=0;i<pts.length;i++){while(lo.length>1&&c(lo[lo.length-2],lo[lo.length-1],pts[i])<=0)lo.pop();lo.push(pts[i])}
    for(i=pts.length-1;i>=0;i--){while(up.length>1&&c(up[up.length-2],up[up.length-1],pts[i])<=0)up.pop();up.push(pts[i])}
    lo.pop();up.pop();return lo.concat(up)}
  function poly(pts,a,p){return el('polygon',Object.assign({points:pts.map(function(q){return q[0].toFixed(1)+','+q[1].toFixed(1)}).join(' ')},a),p)}
  function cercle(cx,cy,r,z,f,n){var o=[];for(var i=0;i<(n||40);i++){var a=i*2*Math.PI/(n||40);o.push([cx+r*Math.cos(a),cy+r*Math.sin(a)])}return o}
  var Ro=function(){return S.R+1.5*S.E}, Ht=function(){return S.H+S.E};
  function centres(){var out=[],pas=2*Ro()+2;for(var k=0;k<S.N;k++){var d=(k-(S.N-1)/2)*pas;out.push([d*Math.cos(rad(S.O)),d*Math.sin(rad(S.O))])}return out}

  /* ---------- PLAN ---------- */
  function plan(svg){
    var p=S.C,e=elev(p),A=SITES[S.site].az(p),ext=S.N*2*Ro()+(S.N-1)*2+10,s=Math.min(18,700/ext,430/(2*Ro()+10)),cx=400,cy=275;
    var T=function(x,y){return [cx+x*s,cy-y*s]};
    // grille
    var g=el('g',{},svg);for(var i=-30;i<=30;i+=5){el('line',{x1:T(i,-30)[0],y1:T(i,-30)[1],x2:T(i,30)[0],y2:T(i,30)[1],stroke:'#2b2b2b','stroke-width':1},g);el('line',{x1:T(-30,i)[0],y1:T(-30,i)[1],x2:T(30,i)[0],y2:T(30,i)[1],stroke:'#2b2b2b','stroke-width':1},g)}
    var cs=centres(),L=Math.min(ombreLong(Ht(),e),(e<.4?0:40)),dir=[Math.sin(rad(A+180)),Math.cos(rad(A+180))];
    if(L>0){var pts=[];cs.forEach(function(c){cercle(c[0],c[1],Ro(),0).forEach(function(q){pts.push([q[0],q[1]]);pts.push([q[0]+dir[0]*L,q[1]+dir[1]*L])})});poly(hull(pts).map(function(q){return T(q[0],q[1])}),{fill:'#000',opacity:.5},svg)}
    cs.forEach(function(c,k){
      var t=T(c[0],c[1]);
      el('circle',{cx:t[0],cy:t[1],r:Ro()*s,fill:'#3a3a3a',opacity:.55,stroke:'#777777','stroke-dasharray':'3 5'},svg);
      el('circle',{cx:t[0],cy:t[1],r:S.R*s,fill:'#161616',stroke:'#f2ede4','stroke-width':3},svg);
      el('line',{x1:t[0]-S.R*s,y1:t[1],x2:t[0]+S.R*s,y2:t[1],stroke:'#777777','stroke-width':1.5},svg);
      el('line',{x1:t[0],y1:t[1]-S.R*s,x2:t[0],y2:t[1],stroke:'#777777','stroke-width':1.5},svg);
      if(k===0){var l1=el('text',{x:t[0]-S.R*s*.5,y:t[1]-S.R*s*.45,class:'pj-tt','text-anchor':'middle'},svg);l1.textContent='Vie';var l2=el('text',{x:t[0]+S.R*s*.5,y:t[1]-S.R*s*.45,class:'pj-tt','text-anchor':'middle'},svg);l2.textContent='Labo';var l3=el('text',{x:t[0],y:t[1]+S.R*s*.6,class:'pj-tt','text-anchor':'middle'},svg);l3.textContent='Sas'}
      if(k<S.N-1){var n=T(c[0]+(Ro()+1)*Math.cos(rad(S.O)),c[1]+(Ro()+1)*Math.sin(rad(S.O)));var m=T(c[0]+(Ro()+1)*Math.cos(rad(S.O)),c[1]+(Ro()+1)*Math.sin(rad(S.O)));el('rect',{x:m[0]-3,y:m[1]-3,width:6,height:6,fill:'#f2ede4'},svg)}
    });
    // échelle 5 m
    el('rect',{x:30,y:478,width:5*s,height:6,fill:'#f2ede4'},svg);var tx=el('text',{x:30,y:470,class:'pj-tt'},svg);tx.textContent='5 m';
    // boussole + soleil
    var bx=730,by=100;el('circle',{cx:bx,cy:by,r:46,fill:'none',stroke:'#3a3a3a','stroke-width':2},svg);
    var n2=el('text',{x:bx,y:by-52,class:'pj-tt','text-anchor':'middle'},svg);n2.textContent='N';
    if(e>=.4){el('circle',{cx:bx+46*Math.sin(rad(A)),cy:by-46*Math.cos(rad(A)),r:9,fill:'#e4572e'},svg);}
    else{var nt=el('text',{x:bx,y:by+6,class:'pj-tt','text-anchor':'middle'},svg);nt.textContent='nuit'}
  }

  /* ---------- COUPE ---------- */
  function coupe(svg){
    var p=S.C,e=elev(p),R=S.R,H=S.H,E=S.E,ro=Ro(),ht=Ht(),s=Math.min(40,640/(2*ro+6),330/(ht+2)),x0=400,y0=430;
    var X=function(x){return x0+x*s},Y=function(z){return y0-z*s};
    el('rect',{x:0,y:y0,width:800,height:120,fill:'#313131'},svg);el('line',{x1:0,y1:y0,x2:800,y2:y0,stroke:'#777777','stroke-width':2},svg);
    // ombre au sol
    var L=Math.min(ombreLong(ht,e),30);if(L>0)el('rect',{x:X(ro),y:y0-3,width:Math.min(L*s,800-X(ro)),height:7,fill:'#000',opacity:.6},svg);
    // monticule
    poly([[X(-ro),Y(0)],[X(-R),Y(ht)],[X(R),Y(ht)],[X(ro),Y(0)]],{fill:'#b9b7ae',stroke:'#f2ede4','stroke-width':2},svg);
    // module
    el('rect',{x:X(-R+.3),y:Y(H),width:(2*R-.6)*s,height:H*s,fill:'#161616',stroke:'#f2ede4','stroke-width':3},svg);
    el('line',{x1:X(-R+.3),y1:Y(.35),x2:X(R-.3),y2:Y(.35),stroke:'#777777','stroke-width':2},svg);
    // personne 1,75 m
    var px=X(-R*.4),py=Y(.35);el('circle',{cx:px,cy:py-1.62*s,r:.13*s,fill:'#f2ede4'},svg);el('line',{x1:px,y1:py-1.5*s,x2:px,y2:py-.8*s,stroke:'#f2ede4','stroke-width':4,'stroke-linecap':'round'},svg);el('line',{x1:px,y1:py-.8*s,x2:px-.15*s,y2:py,stroke:'#f2ede4','stroke-width':3},svg);el('line',{x1:px,y1:py-.8*s,x2:px+.15*s,y2:py,stroke:'#f2ede4','stroke-width':3},svg);
    // rayonnement : flèches qui traversent le régolithe
    var tr=Math.exp(-E/LAMBDA);
    for(var i=0;i<5;i++){var ax=X(-R+(i+.5)*(2*R)/5);
      el('line',{x1:ax,y1:Y(ht)-70,x2:ax,y2:Y(ht),stroke:'#e4572e','stroke-width':3,'stroke-linecap':'round'},svg);
      el('line',{x1:ax,y1:Y(ht),x2:ax,y2:Y(H*.55),stroke:'#e4572e','stroke-width':3,'stroke-dasharray':'2 7','stroke-linecap':'round',opacity:Math.max(.08,tr)},svg)}
    // soleil rasant
    if(e>=.4){var dx=Math.cos(rad(e)),dz=Math.sin(rad(e));for(var j=0;j<3;j++){var sx=X(-ro)-40-j*0,sy=Y(ht*(.4+j*.5));el('line',{x1:sx-dx*120,y1:sy-dz*120,x2:sx,y2:sy,stroke:'#f2ede4','stroke-width':3,'stroke-linecap':'round'},svg)}}
    // cotes
    var t1=el('text',{x:X(R)+8,y:Y(H/2),class:'pj-tm'},svg);t1.textContent='H '+H+' m';
    var t2=el('text',{x:X(0),y:Y(0)+30,class:'pj-tm','text-anchor':'middle'},svg);t2.textContent='Ø '+(2*R)+' m';
    if(E>0){var t3=el('text',{x:X(0),y:Y(ht)-8,class:'pj-tm','text-anchor':'middle'},svg);t3.textContent='régolithe '+E+' m'}
  }

  /* ---------- 3D ---------- */
  function vue3d(svg){
    var p=S.C,e=elev(p),A=SITES[S.site].az(p),ro=Ro(),ht=Ht(),ext=S.N*2*ro+(S.N-1)*2+8,s=Math.min(22,300/ext*1.3,420/(ht+ro*2+14)),ox=400,oy=330,c30=.866;
    var P=function(x,y,z){return [ox+(x-y)*c30*s,oy+(x+y)*.5*s-z*s]};
    // sol
    var D=24;poly([P(-D,-D,0),P(D,-D,0),P(D,D,0),P(-D,D,0)],{fill:'#292929',stroke:'#3a3a3a','stroke-width':1.5},svg);
    for(var i=-D+6;i<D;i+=6){var a=P(i,-D,0),b=P(i,D,0),c=P(-D,i,0),d=P(D,i,0);el('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:'#373737'},svg);el('line',{x1:c[0],y1:c[1],x2:d[0],y2:d[1],stroke:'#373737'},svg)}
    var cs=centres(),L=Math.min(ombreLong(ht,e),30),dir=[Math.sin(rad(A+180)),Math.cos(rad(A+180))];
    if(L>0){var pts=[];cs.forEach(function(c){cercle(c[0],c[1],ro,0).forEach(function(q){pts.push(q);pts.push([q[0]+dir[0]*L,q[1]+dir[1]*L])})});poly(hull(pts).map(function(q){return P(q[0],q[1],0)}),{fill:'#000',opacity:.5},svg)}
    // modules, du fond vers l'avant
    cs.map(function(c,k){return {c:c,k:k}}).sort(function(a,b){return (a.c[0]+a.c[1])-(b.c[0]+b.c[1])}).forEach(function(o){
      var c=o.c,pb=cercle(c[0],c[1],ro,0).map(function(q){return P(q[0],q[1],0)}),pt=cercle(c[0],c[1],S.R,0).map(function(q){return P(q[0],q[1],ht)});
      poly(hull(pb.concat(pt)),{fill:'#b9b7ae',stroke:'#f2ede4','stroke-width':1.5,'stroke-linejoin':'round'},svg);
      poly(pt,{fill:'#d9d6cc',stroke:'#f2ede4','stroke-width':1.5},svg);
      // sas : petit volume sombre côté avant
      var d=P(c[0]+ro*.7,c[1]+ro*.7,.9);el('rect',{x:d[0]-10,y:d[1]-14,width:20,height:16,rx:3,fill:'#161616',stroke:'#f2ede4','stroke-width':2},svg)});
    // mât solaire (la leçon de l'étude : des mâts, pas des toits)
    var m0=P(ro+4,-ro-3,0),m1=P(ro+4,-ro-3,7);el('line',{x1:m0[0],y1:m0[1],x2:m1[0],y2:m1[1],stroke:'#f2ede4','stroke-width':3,'stroke-linecap':'round'},svg);
    poly([P(ro+4,-ro-4.6,7),P(ro+4,-ro-1.4,7),P(ro+4,-ro-1.4,3.5),P(ro+4,-ro-4.6,3.5)],{fill:'#8d8d8d',stroke:'#f2ede4','stroke-width':1.5},svg);
    var tm=el('text',{x:m1[0]+14,y:m1[1]-6,class:'pj-tt'},svg);tm.textContent='mât solaire';
    // ici
    var ic=P(cs[0][0],cs[0][1],ht);el('circle',{cx:ic[0],cy:ic[1],r:7,fill:'#e4572e'},svg);
    if(e>=.4){var sx=730,sy=90;el('circle',{cx:sx,cy:sy,r:46,fill:'none',stroke:'#3a3a3a','stroke-width':2},svg);el('circle',{cx:sx+46*Math.sin(rad(A))*.9,cy:sy-46*Math.cos(rad(A))*.9,r:9,fill:'#f2ede4'},svg)}
  }

  /* ---------- COURBES ---------- */
  function courbe(f,xs){var o=[];for(var i=0;i<=xs;i++){var p=i/xs;o.push(f(p))}return o}
  function lum(p){var e=elev(p);return e<.4?{roof:0,mat:0}:{roof:Math.sin(rad(e)),mat:Math.cos(rad(e))}}
  // max et moyenne ne dépendent que du lieu : mis en cache (avant, recalculés pour chaque point : ~600 000 calculs par image)
  var MX={},MOY={};
  function surf(p){var m=SITES[S.site],mx=MX[S.site]||(MX[S.site]=Math.max.apply(null,courbe(function(q){return m.elev(q)},60)));var v=Math.max(0,m.elev(p))/mx;return 10+80*Math.pow(v,.8)}
  function interieur(p){var xs=60,mean=MOY[S.site];if(mean===undefined){mean=0;for(var i=0;i<xs;i++)mean+=surf(i/xs);mean/=xs;MOY[S.site]=mean}var lag=Math.min(.3,.08*S.E);var q=(p-lag+1)%1;return mean+(surf(q)-mean)*Math.exp(-S.E/DELTA)}
  function abri(e){return 1-Math.exp(-e/LAMBDA)}
  function graphe(){
    var svg=$('ch');svg.innerHTML='';var W=800,Hh=240,m={l:20,r:20,t:24,b:34},w=W-m.l-m.r,h=Hh-m.t-m.b;
    var X=function(p){return m.l+p*w},Y=function(v){return m.t+(1-v)*h};
    var legs={lum:['toit','mât vertical'],rad:[],chal:['dehors','dedans']};
    el('line',{x1:m.l,y1:Y(0),x2:W-m.r,y2:Y(0),stroke:'#777777','stroke-width':2},svg);
    function ligne(f,col,ep,dash){var pts=courbe(f,160).map(function(v,i){return X(i/160).toFixed(1)+','+Y(Math.max(0,Math.min(1,v))).toFixed(1)}).join(' ');el('polyline',{points:pts,fill:'none',stroke:col,'stroke-width':ep||4,'stroke-linejoin':'round','stroke-linecap':'round','stroke-dasharray':dash||''},svg)}
    function etiquette(txt,x,y,col){var t=el('text',{x:x,y:y,class:'pj-tt',fill:col,style:'fill:'+col},svg);t.textContent=txt}
    var cur=S.C,jau=[],leg='';
    if(S.sim==='lum'){
      ligne(function(p){return lum(p).roof},'#a8a8a8',4);ligne(function(p){return lum(p).mat},'#f2ede4',5);
      etiquette('toit',W-80,Y(.08)-8,'#a8a8a8');etiquette('mât',W-80,Y(.97)+22,'#f2ede4');
      var l=lum(cur);jau=[['Mât',l.mat],['Toit',l.roof],['Ombre',Math.min(1,ombreLong(Ht(),elev(cur))/40)]];
      leg='Géométrie du soleil : un mât vertical reçoit plus qu’un toit quand le soleil est bas.';
    }else if(S.sim==='rad'){
      var sw=function(p){return abri(p*3)};
      ligne(sw,'#e9e6dd',5);
      // cible 90 %
      el('line',{x1:m.l,y1:Y(.9),x2:W-m.r,y2:Y(.9),stroke:'#777777','stroke-dasharray':'4 6','stroke-width':2},svg);etiquette('cible',m.l+6,Y(.9)-8,'#a8a8a8');
      el('circle',{cx:X(S.E/3),cy:Y(abri(S.E)),r:9,fill:'#e4572e'},svg);
      etiquette('0 m',m.l,Hh-8,'#a8a8a8');etiquette('3 m de régolithe',W-170,Hh-8,'#a8a8a8');
      var a=abri(S.E);jau=[['Abri',a],['Reçu',1-a],['Cible',a>=.9?1:a/.9]];leg='Courbe jouet (atténuation exponentielle). Axe : épaisseur de régolithe.';
      el('line',{x1:0,y1:0,x2:0,y2:0},svg);
    }else{
      ligne(function(p){return surf(p)/100},'#8a8a8a',4,'');ligne(function(p){return interieur(p)/100},'#e9e6dd',5);
      var b=el('rect',{x:m.l,y:Y(.65),width:w,height:Y(.35)-Y(.65),fill:'#e9e6dd',opacity:.12},svg);
      etiquette('confort',m.l+6,Y(.35)-6,'#a8a8a8');etiquette('dehors',W-90,Y(.9),'#8a8a8a');etiquette('dedans',W-90,Y(.5)+0,'#e9e6dd');
      var iv=interieur(cur)/100,conf=Math.max(0,1-Math.abs(iv-.5)/.5);jau=[['Dehors',surf(cur)/100],['Dedans',iv],['Confort',conf]];leg='Indices 0–100, pas de degrés : modèle jouet (amortissement par le régolithe).';
    }
    if(S.sim!=='rad'){el('line',{x1:X(cur),y1:m.t-6,x2:X(cur),y2:Y(0),stroke:'#e4572e','stroke-width':3},svg);el('circle',{cx:X(cur),cy:Y(0),r:7,fill:'#e4572e'},svg);etiquette(SITES[S.site].cycle,m.l,Hh-8,'#a8a8a8')}
    // jauges
    var J=$('jauges');J.innerHTML='';
    jau.forEach(function(j,i){var v=Math.max(0,Math.min(1,j[1])),r=34,c=2*Math.PI*r;
      var d=document.createElement('div');d.className='pj-jauge';
      d.innerHTML='<svg viewBox="0 0 90 90"><circle cx="45" cy="45" r="'+r+'" fill="none" stroke="#222222" stroke-width="10"/><circle cx="45" cy="45" r="'+r+'" fill="none" stroke="'+['#f2ede4','#a8a8a8','#e9e6dd'][i]+'" stroke-width="10" stroke-linecap="round" stroke-dasharray="'+(c*v).toFixed(1)+' '+c.toFixed(1)+'" transform="rotate(-90 45 45)"/><text x="45" y="53" text-anchor="middle" style="font-size:22px">'+Math.round(v*100)+'</text></svg><span>'+j[0]+'</span>';
      J.appendChild(d)});
    $('leg').textContent=leg;
  }

  /* ---------- rendu ---------- */
  function rendre(){
    var svg=$('vp');svg.innerHTML='';
    ({plan:plan,coupe:coupe,'3d':vue3d})[S.vue](svg);
    $('oR').innerHTML=S.R+'<small>m</small>';$('oH').innerHTML=S.H+'<small>m</small>';$('oE').innerHTML=S.E+'<small>m</small>';$('oO').innerHTML=S.O+'<small>°</small>';$('oN').textContent=S.N;
    $('oC').textContent=SITES[S.site].lib(S.C);
    graphe();
  }
  ['R','H','E','O','N'].forEach(function(k){$(k).addEventListener('input',function(){S[k]=+this.value;rendre()})});
  $('C').addEventListener('input',function(){S.C=this.value/1000;rendre()});
  [].forEach.call(root.querySelectorAll('#vues button'),function(b){b.onclick=function(){S.vue=b.dataset.v;[].forEach.call(root.querySelectorAll('#vues button'),function(x){x.classList.toggle('on',x===b)});rendre()}});
  [].forEach.call(root.querySelectorAll('#sims button'),function(b){b.onclick=function(){S.sim=b.dataset.m;[].forEach.call(root.querySelectorAll('#sims button'),function(x){x.classList.toggle('on',x===b)});rendre()}});
  [].forEach.call(root.querySelectorAll('#lieux button'),function(b){b.onclick=function(){S.site=b.dataset.s;[].forEach.call(root.querySelectorAll('#lieux button'),function(x){x.classList.toggle('on',x===b)});rendre()}});
  $('raz').onclick=function(){Object.assign(S,DEF);['R','H','E','O','N'].forEach(function(k){$(k).value=S[k]});$('C').value=S.C*1000;
    [].forEach.call(root.querySelectorAll('#lieux button'),function(x){x.classList.toggle('on',x.dataset.s===S.site)});rendre()};
  var run=false,last=0;
  function boucle(ts){if(!run)return;if(root.offsetParent!==null){var d=Math.min(ts-last,60);S.C=(S.C+d/14000)%1;$('C').value=S.C*1000;rendre()}last=ts;requestAnimationFrame(boucle)}
  $('lance').onclick=function(){run=!run;this.textContent=run?'❚❚ Pause':'▶ Lancer';if(run){last=performance.now();requestAnimationFrame(boucle)}};
  var q=location.search.match(/[?&](\w+)=([\w.]+)/g)||[];q.forEach(function(x){var m=/[?&](\w+)=([\w.]+)/.exec(x);if(m[1]==='v'){S.vue=m[2]}if(m[1]==='m'){S.sim=m[2]}if(m[1]==='c'){S.C=+m[2];$('C').value=S.C*1000}if(m[1]==='s'){S.site=m[2]}if(m[1]==='e'){S.E=+m[2];$('E').value=S.E}});
  [].forEach.call(root.querySelectorAll('#vues button'),function(x){x.classList.toggle('on',x.dataset.v===S.vue)});
  [].forEach.call(root.querySelectorAll('#sims button'),function(x){x.classList.toggle('on',x.dataset.m===S.sim)});
  [].forEach.call(root.querySelectorAll('#lieux button'),function(x){x.classList.toggle('on',x.dataset.s===S.site)});
  rendre();
})();
  })();
}
