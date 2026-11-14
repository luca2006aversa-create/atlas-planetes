// Vue « Projets » : un habitat paramétrique en plan, coupe et 3D, avec des simulations (lumière, abri, chaleur).
// ATTENTION : modèles JOUETS (voir refonte/PROJETS.md) : les formes des courbes sont justes (géométrie du soleil),
// les valeurs de radiation et de chaleur sont inventées et ne doivent pas être lues comme des données.
// Généré depuis refonte/maquettes/_src/projet.body.html puis maintenu ici.
const HTML = "<div class=\"pj-app\">\n <aside class=\"pj-params\" aria-label=\"Paramètres\">\n  <h2>Projet</h2>\n  <div class=\"pj-fiche\"><span class=\"pj-ph\">Fiche du projet : la même pour la 3D, le plan, la coupe, le jouet et les contrôles</span>\n  <div class=\"pj-lieux\" id=\"fiches\" role=\"group\" aria-label=\"Fiche\"><button data-f=\"pole-sud-esquisse.json\" class=\"on\">Fenêtre directe</button><button data-f=\"pole-sud-fenetre-protegee.json\">Périscope</button></div>\n  <div id=\"fcurs\" class=\"pj-fcurs\"></div>\n  <div class=\"pj-2b\"><button class=\"pj-bouton\" id=\"fsauve\" type=\"button\" title=\"Télécharger la fiche modifiée (JSON)\">⤓ Enregistrer</button><button class=\"pj-bouton\" id=\"forig\" type=\"button\">↺ Fiche d'origine</button></div></div>\n </aside>\n <div class=\"pj-zone\">\n  <section class=\"pj-vue\" aria-label=\"Vue du projet\">\n    <div class=\"pj-onglets\" id=\"vues\" role=\"group\" aria-label=\"Vue\"><button data-v=\"plan\" class=\"on\">Plan</button><button data-v=\"coupe\">Coupe</button><button data-v=\"3d\">Jouet 3D</button></div>\n    <svg id=\"vp\" viewBox=\"0 0 800 520\" preserveAspectRatio=\"xMidYMid meet\"></svg>\n    <button class=\"pj-agrandir\" id=\"grand\" type=\"button\" title=\"Grand écran (Échap pour revenir)\">⤢ Grand écran</button>\n    <iframe id=\"site3d\" title=\"Site en 3D (relief LOLA, ciel, habitat de la fiche)\" hidden></iframe>\n  </section>\n  <section class=\"pj-sim\" aria-label=\"Simulations\">\n    <div class=\"pj-haut\">\n      <div class=\"pj-onglets\" id=\"sims\" role=\"group\" aria-label=\"Simulation\"><button data-m=\"ctl\">✓ Contrôle</button><button data-m=\"lum\" class=\"on\">☀ Lumière</button><button data-m=\"rad\">☢ Abri</button><button data-m=\"chal\">◐ Chaleur</button></div>\n      <div class=\"pj-cycle\"><button class=\"pj-bouton pj-plein\" id=\"lance\" type=\"button\">▶ Lancer</button><input type=\"range\" id=\"C\" min=\"0\" max=\"1000\" value=\"250\" aria-label=\"Moment du cycle\"><span class=\"pj-mono\" id=\"oC\"></span></div>\n    </div>\n    <svg id=\"ch\" viewBox=\"0 0 800 240\" role=\"img\" aria-label=\"Courbe de simulation\"></svg>\n    <div id=\"ctl\" class=\"pj-ctl\" hidden></div>\n    <div class=\"pj-jauges\" id=\"jauges\"></div>\n    <span class=\"pj-leg\" id=\"leg\"></span>\n  </section>\n </div>\n</div>";

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
  var S={site:'lune',R:4,H:3,E:1,O:0,N:2,C:.25,vue:'plan',sim:'lum',fiche:'pole-sud-esquisse.json'},DEF=JSON.parse(JSON.stringify(S));
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

  /* ---------- GÉOMÉTRIE DE LA FICHE : la même que la 3D (fiche assemblée, curseurs compris) ---------- */
  // Modules : cylindres posés au sol (axe horizontal selon rotation_deg, ou vertical). Butte : couverture au-dessus du plus
  // haut module, talus jusqu'au sol. Le plan, la coupe et le jouet ne lisent que ça : ils suivent la fiche comme la 3D.
  function geom(){
    var F=S.F;if(!F)return null;var mods=[],B=null;
    F.elements.forEach(function(e){var f=e.forme||{};
      if(f.type==='cylindre'&&e.position_m){var D=vv(f.diametre_m),L=vv(f.longueur_m),r=rad(e.rotation_deg||0),vert=f.axe==='vertical';
        mods.push({id:e.id,sas:e.type==='sas',x:e.position_m[0],y:e.position_m[1],D:D,L:L,ux:Math.cos(r),uy:Math.sin(r),vert:vert,h:vert?L:D})}
      if(f.type==='butte')B={C:vv(f.couverture_m)||0,T:vv(f.talus_deg)||35}});
    var M=mods.filter(function(m){return !m.sas});if(!M.length)return null;
    var bb=[1e9,1e9,-1e9,-1e9];
    M.forEach(function(m){coins(m).forEach(function(c){bb[0]=Math.min(bb[0],c[0]);bb[1]=Math.min(bb[1],c[1]);bb[2]=Math.max(bb[2],c[0]);bb[3]=Math.max(bb[3],c[1])})});
    var hm=Math.max.apply(null,M.map(function(m){return m.h})),C=B?B.C:0,T=B?B.T:90,Ht=hm+C,run=B?Ht/Math.tan(rad(T)):0;
    var top=[bb[0]-C,bb[1]-C,bb[2]+C,bb[3]+C],base=[top[0]-run,top[1]-run,top[2]+run,top[3]+run];
    return {mods:mods,M:M,C:C,T:T,Ht:Ht,hm:hm,butte:!!B,top:top,base:base,azY:vv(F.site&&F.site.azimut_y_deg)||0}}
  function coins(m){var hx=m.vert?m.D/2:m.L/2,hy=m.D/2,ux=m.ux,uy=m.uy;
    return [[-1,-1],[1,-1],[1,1],[-1,1]].map(function(k){return [m.x+k[0]*hx*ux-k[1]*hy*uy,m.y+k[0]*hx*uy+k[1]*hy*ux]})}
  function rect4(b){return [[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]]}
  function attente(svg){var t=el('text',{x:400,y:260,class:'pj-tt','text-anchor':'middle'},svg);t.textContent='Lecture de la fiche…'}
  function nomZone(id){var f=(S.F.programme.fonctions||[]).find(function(x){return x.element===id});return f?f.nom.split(/[ ,]/)[0]:''}
  // soleil dans le repère du projet : azimut compté depuis +y (sens horaire)
  function soleil(G){var p=S.C;return {e:elev(p),a:SITES[S.site].az(p)-G.azY}}
  function boussole(svg,G,sol){var bx=730,by=100;el('circle',{cx:bx,cy:by,r:46,fill:'none',stroke:'#3a3a3a','stroke-width':2},svg);
    var t=rad(-G.azY),tx=bx+46*Math.sin(t),ty=by-46*Math.cos(t);el('line',{x1:bx,y1:by,x2:tx,y2:ty,stroke:'#777777','stroke-width':2},svg);
    var tt=el('text',{x:bx+60*Math.sin(t),y:by-60*Math.cos(t)+4,class:'pj-tt','text-anchor':'middle'},svg);tt.textContent='Terre';
    if(sol.e>=.4)el('circle',{cx:bx+46*Math.sin(rad(sol.a)),cy:by-46*Math.cos(rad(sol.a)),r:9,fill:'#e4572e'},svg);
    else{var nt=el('text',{x:bx,y:by+6,class:'pj-tt','text-anchor':'middle'},svg);nt.textContent='nuit'}}
  function ombre(G,sol,proj,svg){
    var L=Math.min(ombreLong(G.Ht,sol.e),40);if(!(L>0))return;var d=[-Math.sin(rad(sol.a))*L,-Math.cos(rad(sol.a))*L],pts=rect4(G.base);
    rect4(G.top).forEach(function(q){pts.push([q[0]+d[0],q[1]+d[1]])});poly(hull(pts).map(function(q){return proj(q[0],q[1],0)}),{fill:'#000',opacity:.5},svg)}

  /* ---------- PLAN ---------- */
  function plan(svg){
    var G=geom();if(!G)return attente(svg);var sol=soleil(G),b=G.base,s=Math.min(700/(b[2]-b[0]+6),400/(b[3]-b[1]+6)),mx=(b[0]+b[2])/2,my=(b[1]+b[3])/2;
    var T=function(x,y){return [400+(x-mx)*s,270-(y-my)*s]},P=function(x,y){return T(x,y)};
    var g=el('g',{},svg);for(var i=-60;i<=60;i+=5){var a=T(mx+i,my-60),c=T(mx+i,my+60),d=T(mx-60,my+i),e=T(mx+60,my+i);el('line',{x1:a[0],y1:a[1],x2:c[0],y2:c[1],stroke:'#2b2b2b'},g);el('line',{x1:d[0],y1:d[1],x2:e[0],y2:e[1],stroke:'#2b2b2b'},g)}
    ombre(G,sol,P,svg);
    if(G.butte){poly(rect4(G.base).map(function(q){return T(q[0],q[1])}),{fill:'#3a3a3a',opacity:.55,stroke:'#777777','stroke-dasharray':'3 5'},svg);
      poly(rect4(G.top).map(function(q){return T(q[0],q[1])}),{fill:'#b9b7ae',opacity:.22,stroke:'#b9b7ae'},svg)}
    G.mods.forEach(function(m){var c=coins(m).map(function(q){return T(q[0],q[1])});
      if(m.vert){var t=T(m.x,m.y);el('circle',{cx:t[0],cy:t[1],r:m.D/2*s,fill:'#161616',stroke:'#f2ede4','stroke-width':m.sas?1.5:3},svg)}
      else poly(c,{fill:'#161616',stroke:'#f2ede4','stroke-width':m.sas?1.5:3},svg);
      var t2=T(m.x,m.y),l=el('text',{x:t2[0],y:t2[1]+4,class:'pj-tt','text-anchor':'middle'},svg);l.textContent=m.sas?m.id:(m.id+' '+nomZone(m.id))});
    el('rect',{x:30,y:478,width:5*s,height:6,fill:'#f2ede4'},svg);var tx=el('text',{x:30,y:470,class:'pj-tt'},svg);tx.textContent='5 m';
    if(G.butte){var tb=el('text',{x:T(b[0],b[1])[0],y:T(b[0],b[1])[1]+18,class:'pj-tm'},svg);tb.textContent='butte : '+G.C+' m de régolithe, talus '+G.T+'°'}
    boussole(svg,G,sol);
  }

  /* ---------- COUPE (en travers des modules, au milieu) ---------- */
  function coupe(svg){
    var G=geom();if(!G)return attente(svg);var sol=soleil(G),b=G.base,t=G.top;
    var mx=(t[0]+t[2])/2,m0=G.M.slice().sort(function(a,c){return Math.abs(a.x-mx)-Math.abs(c.x-mx)})[0];
    var W=b[3]-b[1],s=Math.min(40,700/(W+6),330/(G.Ht+3)),y0=430,cy=(b[1]+b[3])/2,X=function(y){return 400+(y-cy)*s},Y=function(z){return y0-z*s};
    el('rect',{x:0,y:y0,width:800,height:120,fill:'#313131'},svg);el('line',{x1:0,y1:y0,x2:800,y2:y0,stroke:'#777777','stroke-width':2},svg);
    var L=Math.min(ombreLong(G.Ht,sol.e),30);if(L>0)el('rect',{x:X(b[3]),y:y0-3,width:Math.max(0,Math.min(L*s,800-X(b[3]))),height:7,fill:'#000',opacity:.6},svg);
    if(G.butte)poly([[X(b[1]),Y(0)],[X(t[1]),Y(G.Ht)],[X(t[3]),Y(G.Ht)],[X(b[3]),Y(0)]],{fill:'#b9b7ae',stroke:'#f2ede4','stroke-width':2},svg);
    var D=m0.D,yc=m0.y;
    if(m0.vert)el('rect',{x:X(yc-D/2),y:Y(m0.h),width:D*s,height:m0.h*s,fill:'#161616',stroke:'#f2ede4','stroke-width':3},svg);
    else el('circle',{cx:X(yc),cy:Y(D/2),r:D/2*s,fill:'#161616',stroke:'#f2ede4','stroke-width':3},svg);
    var pl=Math.min(1.2,D*.2);el('line',{x1:X(yc-Math.sqrt(D*D/4-(D/2-pl)*(D/2-pl))),y1:Y(pl),x2:X(yc+Math.sqrt(D*D/4-(D/2-pl)*(D/2-pl))),y2:Y(pl),stroke:'#777777','stroke-width':2},svg);
    var px=X(yc-D*.15),py=Y(pl);el('circle',{cx:px,cy:py-1.62*s,r:.13*s,fill:'#f2ede4'},svg);el('line',{x1:px,y1:py-1.5*s,x2:px,y2:py-.8*s,stroke:'#f2ede4','stroke-width':4,'stroke-linecap':'round'},svg);el('line',{x1:px,y1:py-.8*s,x2:px-.15*s,y2:py,stroke:'#f2ede4','stroke-width':3},svg);el('line',{x1:px,y1:py-.8*s,x2:px+.15*s,y2:py,stroke:'#f2ede4','stroke-width':3},svg);
    var tr=Math.exp(-G.C/LAMBDA);
    for(var i=0;i<5;i++){var ax=X(yc-D/2+(i+.5)*D/5);el('line',{x1:ax,y1:Y(G.Ht)-60,x2:ax,y2:Y(G.Ht),stroke:'#e4572e','stroke-width':3,'stroke-linecap':'round'},svg);
      el('line',{x1:ax,y1:Y(G.Ht),x2:ax,y2:Y(D*.55),stroke:'#e4572e','stroke-width':3,'stroke-dasharray':'2 7','stroke-linecap':'round',opacity:Math.max(.08,tr)},svg)}
    if(sol.e>=.4){var dx=Math.cos(rad(sol.e)),dz=Math.sin(rad(sol.e));for(var j=0;j<3;j++){var sx=X(b[1])-30,sy=Y(G.Ht*(.3+j*.4));el('line',{x1:sx-dx*120,y1:sy-dz*120,x2:sx,y2:sy,stroke:'#f2ede4','stroke-width':3,'stroke-linecap':'round'},svg)}}
    var t1=el('text',{x:X(yc+D/2)+8,y:Y(D/2),class:'pj-tm'},svg);t1.textContent=m0.id+' · Ø '+D+' m';
    if(G.butte){var t3=el('text',{x:X(yc),y:Y(G.Ht)-8,class:'pj-tm','text-anchor':'middle'},svg);t3.textContent='régolithe '+G.C+' m';
      var t4=el('text',{x:X(b[3])-6,y:Y(0)-8,class:'pj-tm','text-anchor':'end'},svg);t4.textContent='talus '+G.T+'°'}
  }

  /* ---------- JOUET 3D (vue axonométrique de la fiche) ---------- */
  function vue3d(svg){
    var G=geom();if(!G)return attente(svg);var sol=soleil(G),b=G.base,mx=(b[0]+b[2])/2,my=(b[1]+b[3])/2,ext=(b[2]-b[0])+(b[3]-b[1])+8,c30=.866;
    var s=Math.min(22,700/(ext*c30),380/(ext/2+G.Ht)),P=function(x,y,z){return [400+((x-mx)-(y-my))*c30*s,300+((x-mx)+(y-my))*.5*s-z*s]};
    var gd=[b[0]-6,b[1]-6,b[2]+6,b[3]+6];poly(rect4(gd).map(function(q){return P(q[0],q[1],0)}),{fill:'#292929',stroke:'#3a3a3a','stroke-width':1.5},svg);
    ombre(G,sol,P,svg);
    // modules, du fond vers l'avant ; la butte par-dessus, à demi transparente
    G.mods.slice().sort(function(a,c){return (a.x+a.y)-(c.x+c.y)}).forEach(function(m){
      var anneau=function(k){var o=[];for(var i=0;i<24;i++){var a=i*Math.PI/12,ca=Math.cos(a)*m.D/2,sa=Math.sin(a)*m.D/2;
        if(m.vert)o.push(P(m.x+ca,m.y+sa,k?m.L:0));else{var cx=m.x+(k?1:-1)*m.ux*m.L/2,cy=m.y+(k?1:-1)*m.uy*m.L/2;o.push(P(cx-m.uy*ca,cy+m.ux*ca,m.D/2+sa))}}return o};
      var a0=anneau(0),a1=anneau(1);poly(hull(a0.concat(a1)),{fill:'#161616',stroke:'#f2ede4','stroke-width':m.sas?1:1.5,'stroke-linejoin':'round'},svg);
      poly(m.vert?a1:((m.ux+m.uy)>=0?a1:a0),{fill:'#262626',stroke:'#f2ede4','stroke-width':1},svg)});
    if(G.butte){var t=G.top,H=G.Ht,st={fill:'#b9b7ae',opacity:.5,stroke:'#f2ede4','stroke-width':1.2,'stroke-linejoin':'round'};
      poly([P(b[0],b[3],0),P(b[2],b[3],0),P(t[2],t[3],H),P(t[0],t[3],H)],st,svg);
      poly([P(b[2],b[1],0),P(b[2],b[3],0),P(t[2],t[3],H),P(t[2],t[1],H)],st,svg);
      poly(rect4(t).map(function(q){return P(q[0],q[1],H)}),{fill:'#d9d6cc',opacity:.45,stroke:'#f2ede4','stroke-width':1.2},svg)}
    var tl=el('text',{x:30,y:500,class:'pj-tm'},svg);tl.textContent=S.F.nom;
    boussole(svg,G,sol);
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
  /* ---------- FICHE RÉELLE : curseurs → fiche → 3D, contrôle, abri (dossier projets/) ---------- */
  var vv=function(q){return q&&typeof q==='object'&&'v' in q?q.v:q};
  var setv=function(o,k,x){if(o[k]&&typeof o[k]==='object'&&'v' in o[k])o[k].v=x;else o[k]=x};
  var jsn=function(r){if(!r.ok)throw new Error(r.url+' : '+r.status);return r.json()};
  var BASE={},LIBS=null,ver=0,pretF=null,calc=null,calcVer=-1,minuteur=null;
  // curseurs de la fiche : id, nom, unité, min, max, pas
  var CUR=[['fD','Ø modules','m',4,10,.5],['fL','Longueur modules','m',6,20,1],['fC','Couverture butte','m',0,6,.25],['fT','Talus','°',20,60,5],['fN','Équipage','pers.',1,12,1],['fJ','Durée','j',10,1000,10]];
  function libs(){return LIBS||(LIBS=Promise.all([import('./projets/rayons.js'),import('./projets/controle.js'),import('./projets/assemblage.js'),
    fetch('projets/regles.json').then(jsn),fetch('etude/donnees/habitat.json').then(jsn)]).then(function(x){return {Rz:x[0],Ct:x[1],As:x[2],R:x[3],hz:x[4].horizon.h}}))}
  // mémoire du navigateur : la fiche modifiée (atelier ou curseurs) est la même pour l'atelier, le Fichier et la 3D
  function memLire(nom){try{return (JSON.parse(localStorage.getItem('kibsu-fiches'))||{})[nom]||null}catch(e){return null}}
  function memEcrire(nom,F){try{var m=JSON.parse(localStorage.getItem('kibsu-fiches'))||{};m[nom]=F;localStorage.setItem('kibsu-fiches',JSON.stringify(m));localStorage.setItem('kibsu-fiche',nom)}catch(e){}}
  function memOublier(nom){try{var m=JSON.parse(localStorage.getItem('kibsu-fiches'))||{};delete m[nom];localStorage.setItem('kibsu-fiches',JSON.stringify(m))}catch(e){}}
  function base(nom){var M=memLire(nom);return BASE[nom]||(BASE[nom]=M?Promise.resolve(M):fetch('projets/'+nom).then(jsn))}
  function lireBase(F){var m=F.elements.find(function(e){return e.pressurise&&e.forme&&e.forme.type==='cylindre'})||{forme:{}},B=F.elements.find(function(e){return e.forme&&e.forme.type==='butte'})||{forme:{}};
    return {fD:vv(m.forme.diametre_m),fL:vv(m.forme.longueur_m),fC:vv(B.forme.couverture_m),fT:vv(B.forme.talus_deg),fN:vv(F.programme.equipage),fJ:vv(F.programme.duree_jours)}}
  function valeurs(){var o={};CUR.forEach(function(c){o[c[0]]=+$(c[0]).value});return o}
  function afficherCurs(){CUR.forEach(function(c){$('o'+c[0]).innerHTML=$(c[0]).value+'<small>'+c[2]+'</small>'})}
  // fiche de base + valeurs des curseurs → nouvelle fiche (les modules se replacent par leurs ports : assemblage.js)
  function ficheModifiee(B,v,As){
    var F=structuredClone(B),b=lireBase(B),dD=v.fD-b.fD;
    F.elements.forEach(function(e){
      var f=e.forme||{};
      if(e.pressurise&&f.type==='cylindre'&&(v.fD!==b.fD||v.fL!==b.fL)){if(v.fD!==b.fD)setv(f,'diametre_m',v.fD);if(v.fL!==b.fL)setv(f,'longueur_m',v.fL);if(e.arrivee&&e.arrivee.dimensions_vol_m)e.arrivee.dimensions_vol_m=[vv(f.diametre_m),vv(f.longueur_m)]}
      if(f.type==='butte'){if(v.fC!==b.fC)setv(f,'couverture_m',v.fC);if(v.fT!==b.fT)setv(f,'talus_deg',v.fT)}
      // ouvertures : la fente directe suit la paroi du module ; le périscope (puits, chambre, fente haute) suit son plafond
      var p=f.centre_m||f.oeil_m;
      if(dD&&p&&p.length===3){if(f.type==='fente'&&e.dans==='M2')p[1]+=dD/2;else p[2]+=dD}
    });
    if(F.protection&&v.fC!==b.fC)setv(F.protection,'epaisseur_m',v.fC);                 // une seule épaisseur : celle de la butte
    if(v.fN!==b.fN)setv(F.programme,'equipage',v.fN);if(v.fJ!==b.fJ)setv(F.programme,'duree_jours',v.fJ);
    var G=F;try{G=As.ficheAssemblee(F)}catch(e){}
    if(JSON.stringify(v)!==JSON.stringify(b))G.nom=/ · modifiée$/.test(B.nom)?B.nom:B.nom+' · modifiée';
    return G}
  function majFiche(vite){
    afficherCurs();var nom=S.fiche;
    pretF=Promise.all([libs(),base(nom)]).then(function(x){if(S.fiche!==nom)return;S.F=ficheModifiee(x[1],valeurs(),x[0].As);ver++;envoyer3d();accorder()});
    pretF.then(function(){clearTimeout(minuteur);minuteur=setTimeout(function(){if(S.sim==='ctl'||S.sim==='rad')rendre()},vite?0:250)})
      .catch(function(e){$('ctl').innerHTML='<p class="pj-ph">Fiche illisible : '+e.message+'</p>'});
  }
  // le jouet suit la fiche : ses valeurs viennent des modules et de la butte ; la page 3D reçoit la même fiche (sessionStorage)
  function accorder(){var G=geom();if(G){S.R=G.hm/2;S.H=G.hm;S.E=G.C;S.N=G.M.length;S.O=0}if(S.F.site&&SITES[S.F.site.corps])S.site=S.F.site.corps;
    memEcrire(S.fiche,S.F);rendre()}
  function nouvelleFiche(){var nom=S.fiche;base(nom).then(function(B){if(S.fiche!==nom)return;var b=lireBase(B);CUR.forEach(function(c){$(c[0]).value=b[c[0]]});majFiche(true)})}
  // un seul calcul par version de la fiche : zones (rayons.js) puis règles (controle.js, avec la dose des zones)
  function calculer(){
    if(calc&&calcVer===ver)return calc;
    calcVer=ver;
    calc=Promise.all([libs(),pretF]).then(function(x){var L=x[0];return new Promise(function(ok,ko){setTimeout(function(){try{
      var F=S.F,R=L.R,G=L.Rz.geometrie(F,vv(R.hypotheses.masse_volumique_regolithe)),D=L.Rz.directions(1500);
      var pts=R.hypotheses.dose_gcr.pts,seuil=vv(R.hypotheses.abri_eruption_g_cm2);
      var zones=(F.programme.fonctions||[]).map(function(fn){var P=L.Rz.pointEspace(F,fn);if(!P)return {id:fn.id,nom:fn.nom,element:fn.element,erreur:true};
        var b=L.Rz.bilan(G,P,D,L.hz),d=L.Rz.dosePoint(b.vals,pts),ab=b.min!=null&&b.min>=seuil;
        return {id:fn.id,nom:fn.nom,element:fn.element,P:P,min:b.min,min_g_cm2:b.min,faible:b.part.faible,mSv_j:d.mSv_j,mSv_h:d.mSv_j/24,abri:ab,abri_eruption:ab}});
      ok({F:F,zones:zones,res:L.Ct.controler(F,R,{fiche:S.fiche,rayons:{zones:zones}}),seuil:seuil,dose:R.hypotheses.dose_gcr})}catch(e){ko(e)}},20)})});
    return calc}
  function envoyer3d(){var f=$('site3d');if(f.dataset.pret&&S.F)f.contentWindow.postMessage({type:'kibsu-fiche',F:S.F},location.origin)}
  function site3d(){var f=$('site3d');if(!f.getAttribute('src'))f.setAttribute('src','projets/site3d.html?embed=1&fiche='+S.fiche)}   // chargé une fois, au premier affichage
  function controle(){
    var box=$('ctl'),J=$('jauges');if(!box.firstChild)box.innerHTML='<p class="pj-ph">Calcul…</p>';
    calculer().then(function(o){
      if(S.sim!=='ctl')return;
      var n={ok:0,non:0,'?':0},SYM={ok:'✓',non:'✗','?':'?',info:'i'};
      o.res.forEach(function(r){if(r.etat in n)n[r.etat]++});
      box.innerHTML='<p class="pj-ctl-nom">'+o.F.nom+'</p>'+o.res.map(function(r){
        var v=r.valeur!=null&&r.seuil!=null?' <span class="pj-mono">'+r.valeur+' / '+r.seuil+(r.unite?' '+r.unite:'')+'</span>':'';
        return '<div class="pj-ctl-l pj-'+(r.etat==='?'?'inc':r.etat)+'"><b>'+SYM[r.etat]+'</b><span>'+r.nom+v+'<small>'+(r.statut||'')+' '+(r.detail||'')+'</small></span></div>'}).join('')+
        '<p class="pj-ph">● lu dans la source · ◇ calculé · ▨ hypothèse. Détail : <a href="projets/controle.html?fiche='+S.fiche+'">page Contrôle</a> (fiche d\'origine)</p>';
      J.innerHTML=[['✓',n.ok,'inherit'],['✗',n.non,'#e4572e'],['?',n['?'],'inherit;opacity:.6']].map(function(k){return '<div class="pj-jauge pj-compte"><b style="color:'+k[2]+'">'+k[1]+'</b><span>'+k[0]+'</span></div>'}).join('');
    }).catch(function(e){box.innerHTML='<p class="pj-ph">Contrôle indisponible : '+e.message+'</p>'});
  }
  function abri(){
    var box=$('ctl'),J=$('jauges');if(!box.firstChild)box.innerHTML='<p class="pj-ph">Calcul des rayons…</p>';
    calculer().then(function(o){
      if(S.sim!=='rad')return;
      var MAX=600,pc=function(v){return Math.min(100,100*v/MAX).toFixed(1)+'%'};
      box.innerHTML='<p class="pj-ctl-nom">'+o.F.nom+'</p>'+o.zones.map(function(z){
        if(z.erreur)return '<div class="pj-abri-l"><span>'+z.nom+'</span><span class="pj-ph">pas de position</span></div>';
        return '<div class="pj-abri-l"><span>'+(z.abri?'✓ ':'✗ ')+z.nom+'<small>'+z.element+' · '+z.mSv_j.toFixed(2)+' mSv/j ◇</small></span>'+
          '<span><span class="pj-barre" title="épaisseur minimale traversée"><i class="'+(z.min<30?'pj-faible':'')+'" style="width:'+pc(z.min||0)+'"></i><b style="left:'+pc(o.seuil)+'"></b><b style="left:'+pc(300)+'"></b></span>'+
          '<small>min '+z.min+' g/cm² · '+z.faible+' % du ciel sous 30 g/cm²</small></span></div>'}).join('')+
        '<p class="pj-ph">Barre : épaisseur minimale de régolithe vue depuis l\'espace (0 à '+MAX+' g/cm²), traits à '+o.seuil+' (abri éruption ●) et 300 g/cm². Dose : rayons cosmiques, '+o.dose.s+' MATTHIA2024, par secteurs ◇. 1 500 directions par point. <a href="projets/rayons.html">page Radiations</a></p>';
      var ok=o.zones.filter(function(z){return z.abri}).length,pire=Math.max.apply(null,o.zones.map(function(z){return z.faible||0})),dmax=Math.max.apply(null,o.zones.map(function(z){return z.mSv_j||0}));
      J.innerHTML=[[ok+'/'+o.zones.length,'sous abri'],[pire+' %','pire ciel ouvert'],[dmax.toFixed(2),'mSv/j max']].map(function(k){return '<div class="pj-jauge pj-compte"><b>'+k[0]+'</b><span>'+k[1]+'</span></div>'}).join('');
    }).catch(function(e){box.innerHTML='<p class="pj-ph">Abri indisponible : '+e.message+'</p>'});
  }

  function rendre(){
    var svg=$('vp');svg.innerHTML='';
    var reel=S.vue==='site';svg.style.display=reel?'none':'';$('site3d').hidden=!reel;
    if(reel)site3d();else ({plan:plan,coupe:coupe,'3d':vue3d})[S.vue](svg);
    
    $('oC').textContent=SITES[S.site].lib(S.C);
    var c=S.sim==='ctl'||S.sim==='rad';$('ch').style.display=c?'none':'';$('ctl').hidden=!c;root.querySelector('.pj-cycle').style.visibility=c?'hidden':'';
    if(S.sim==='ctl'){$('leg').textContent='Règles NASA / ESA / BVAD appliquées à la fiche choisie (pas aux curseurs).';controle()}
    else if(S.sim==='rad'){$('leg').textContent='Radiations : rayons.js sur la fiche choisie (pas aux curseurs). Épaisseurs, pas des doses mesurées.';abri()}
    else graphe();
  }

  $('C').addEventListener('input',function(){S.C=this.value/1000;rendre()});
  [].forEach.call(root.querySelectorAll('#vues button'),function(b){b.onclick=function(){S.vue=b.dataset.v;[].forEach.call(root.querySelectorAll('#vues button'),function(x){x.classList.toggle('on',x===b)});rendre()}});
  [].forEach.call(root.querySelectorAll('#sims button'),function(b){b.onclick=function(){S.sim=b.dataset.m;[].forEach.call(root.querySelectorAll('#sims button'),function(x){x.classList.toggle('on',x===b)});rendre()}});
  [].forEach.call(root.querySelectorAll('#fiches button'),function(b){b.onclick=function(){S.fiche=b.dataset.f;[].forEach.call(root.querySelectorAll('#fiches button'),function(x){x.classList.toggle('on',x===b)});nouvelleFiche()}});
  var run=false,last=0;
  function boucle(ts){if(!run)return;if(root.offsetParent!==null){var d=Math.min(ts-last,60);S.C=(S.C+d/14000)%1;$('C').value=S.C*1000;rendre()}last=ts;requestAnimationFrame(boucle)}
  // curseurs de la fiche (générés), enregistrer, revenir, 3D prête
  $('fcurs').innerHTML=CUR.map(function(c){return '<div class="pj-p"><label for="'+c[0]+'">'+c[1]+'</label><output id="o'+c[0]+'"></output><input type="range" id="'+c[0]+'" min="'+c[3]+'" max="'+c[4]+'" step="'+c[5]+'"></div>'}).join('');
  CUR.forEach(function(c){$(c[0]).addEventListener('input',function(){majFiche(false)})});
  $('fsauve').onclick=function(){if(!S.F)return;var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(S.F,null,1)],{type:'application/json'}));a.download=S.fiche.replace('.json','')+'-modifiee.json';a.click();setTimeout(function(){URL.revokeObjectURL(a.href)},2000)};
  $('forig').onclick=function(){memOublier(S.fiche);delete BASE[S.fiche];nouvelleFiche()};
  addEventListener('message',function(e){if(e.origin===location.origin&&e.data==='kibsu-pret'){$('site3d').dataset.pret='1';envoyer3d()}});
  try{var fa=localStorage.getItem('kibsu-fiche');if(fa&&root.querySelector('#fiches button[data-f="'+fa+'"]'))S.fiche=fa}catch(e){}
  [].forEach.call(root.querySelectorAll('#fiches button'),function(x){x.classList.toggle('on',x.dataset.f===S.fiche)});
  nouvelleFiche();
  $('grand').onclick=function(){var a=root.querySelector('.pj-app'),g=a.classList.toggle('pj-grand');this.textContent=g?'⤡ Réduire':'⤢ Grand écran'};
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&root.querySelector('.pj-app.pj-grand'))$('grand').click()});
  addEventListener('message',function(e){if(e.origin===location.origin&&e.data==='kibsu-echap'&&root.querySelector('.pj-app.pj-grand'))$('grand').click()});
  $('lance').onclick=function(){run=!run;this.textContent=run?'❚❚ Pause':'▶ Lancer';if(run){last=performance.now();requestAnimationFrame(boucle)}};
  var q=location.search.match(/[?&](\w+)=([\w.]+)/g)||[];q.forEach(function(x){var m=/[?&](\w+)=([\w.]+)/.exec(x);if(m[1]==='v'){S.vue=m[2]}if(m[1]==='m'){S.sim=m[2]}if(m[1]==='c'){S.C=+m[2];$('C').value=S.C*1000}});
  [].forEach.call(root.querySelectorAll('#vues button'),function(x){x.classList.toggle('on',x.dataset.v===S.vue)});
  [].forEach.call(root.querySelectorAll('#sims button'),function(x){x.classList.toggle('on',x.dataset.m===S.sim)});
  rendre();
})();
  })();
}
