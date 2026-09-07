/* Illustrated districts, shared instanced detail, and ambient life for the Three.js atlas.
   Streets and building plots are procedural, not surveyed footprints. */
const Miniature = (() => {
  let waterTime = { value: 0 }, life = [], frameSamples = [], metrics = {};
  const hash = (a, b = 0) => { const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return n - Math.floor(n); };
  function batch(THREE, parent, geometry, entries, shadow = true) {
    if (!entries.length) return null;
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshLambertMaterial(), entries.length);
    const dummy = new THREE.Object3D();
    entries.forEach((e, i) => {
      dummy.position.set(e.x, e.y, e.z); dummy.rotation.set(e.rx || 0, e.rot || 0, e.rz || 0);
      dummy.scale.set(e.w, e.h, e.d); dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, new THREE.Color(e.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    // r147 does not compute world bounds for instances; groups provide distance culling.
    mesh.frustumCulled = false;
    parent.add(mesh); return mesh;
  }
  function buildDistricts({ THREE, scene, zones, landmarks, ll, heightAt, baseHeight, coastX, riverDist, roads, distSeg }) {
    const districts = [], allPlots = [], occupiedCells = new Map(), streetSegments = [];
    const unit = new THREE.BoxGeometry(1, 1, 1);
    const roof = new THREE.BufferGeometry();
    roof.setAttribute('position', new THREE.Float32BufferAttribute([
      -.5,0,-.5, .5,0,-.5, 0,1,-.5, -.5,0,.5, 0,1,.5, .5,0,.5,
      -.5,0,-.5,0,1,-.5,0,1,.5, -.5,0,-.5,0,1,.5,-.5,0,.5,
      .5,0,-.5,.5,0,.5,0,1,.5, .5,0,-.5,0,1,.5,0,1,-.5
    ], 3));
    roof.setIndex(Array.from({length: roof.attributes.position.count / 3}, (_, i) => [i*3,i*3+2,i*3+1]).flat());
    roof.computeVertexNormals();
    const cellKey = (x,z) => `${Math.floor(x/120)},${Math.floor(z/120)}`;
    const nearbyPlots = (x,z) => {
      const result = [], ix = Math.floor(x/120), iz = Math.floor(z/120);
      for(let a=ix-2;a<=ix+2;a++) for(let b=iz-2;b<=iz+2;b++) result.push(...(occupiedCells.get(`${a},${b}`)||[]));
      return result;
    };
    function overlaps(p,x,z,w,d,angle) {
      const axes=[angle,angle+Math.PI/2,-p.rot,-p.rot+Math.PI/2];
      return axes.every(a=>{
        const nx=Math.cos(a),nz=Math.sin(a);
        const radiusA=Math.abs(Math.cos(a-angle))*w/2+Math.abs(Math.sin(a-angle))*d/2;
        const radiusB=Math.abs(Math.cos(a+p.rot))*p.w/2+Math.abs(Math.sin(a+p.rot))*p.d/2;
        return Math.abs((p.x-x)*nx+(p.z-z)*nz)<radiusA+radiusB+6;
      });
    }
    const reserved = (x,z,r=0) => landmarks.some(l => Math.hypot(l.x-x,l.z-z) < (l.model === 'airport' ? 620 : l.model === 'kadri' ? 310 : Math.min(l.padR*.82,280)) + r);
    const onRoad = (x,z,r=0) => roads.some(s => distSeg(x,z,s.a.x,s.a.z,s.b.x,s.b.z) < s.width/2+r);
    const palette = [0xe2d6bd,0xcbbda6,0xe5dbc7,0xd5c6b7,0xbbc9bd,0xc4ced0];
    // Kadri sets the visual benchmark before the same plot rules fill other districts.
    const orderedZones = [zones[1], zones[0], ...zones.slice(2)];
    orderedZones.forEach((zone, zi) => {
      const center = ll(zone.lng, zone.lat), angle = zi < 2 ? -.24 : (hash(zi,3)-.5)*.7;
      const co=Math.cos(angle), si=Math.sin(angle), spacing=zi<2?200:210;
      const localCenter={x:center.x*co+center.z*si,z:-center.x*si+center.z*co};
      const anchor={x:Math.round(localCenter.x/spacing)*spacing,z:Math.round(localCenter.z/spacing)*spacing};
      const world=(x,z)=>({x:(anchor.x+x)*co-(anchor.z+z)*si,z:(anchor.x+x)*si+(anchor.z+z)*co});
      const group=new THREE.Group(), close=new THREE.Group(); scene.add(group,close);
      const bodies=[],roofs=[],bases=[],windows=[],balconies=[],awnings=[],trunks=[],fronds=[],lamps=[],marks=[];
      const streetVerts=[];
      const roadWidth = 23;
      function roadStrip(a,b,width,colorBuffer) {
        const length=Math.hypot(b.x-a.x,b.z-a.z), n=Math.ceil(length/24), nx=-(b.z-a.z)/length, nz=(b.x-a.x)/length;
        for(let j=0;j<n;j++) {
          const t0=j/n,t1=(j+1)/n;
          const x=a.x+(b.x-a.x)*(t0+t1)/2,z=a.z+(b.z-a.z)*(t0+t1)/2;
          if(baseHeight(x,z)<3 || reserved(x,z,8) || riverDist(x,z)<230 || nearbyPlots(x,z).some(p=>Math.hypot(p.x-x,p.z-z)<p.r+width/2)) continue;
          const vertices=[];
          for(const [t,side] of [[t0,-1],[t0,1],[t1,-1],[t1,1]]) {
            const px=a.x+(b.x-a.x)*t+nx*side*width/2,pz=a.z+(b.z-a.z)*t+nz*side*width/2;
            vertices.push([px,heightAt(px,pz)+2.5,pz]);
          }
          for(const k of [0,2,1,1,2,3]) colorBuffer.push(...vertices[k]);
        }
      }
      const limit=Math.floor(zone.r/spacing);
      for(let gx=-limit;gx<limit;gx++) for(let gz=-limit;gz<limit;gz++) {
        if(Math.hypot((gx+.5)*spacing,(gz+.5)*spacing)>zone.r-100) continue;
        for(const [dx,dz] of [[1,0],[0,1]]) {
          const a=world(gx*spacing,gz*spacing),b=world((gx+dx)*spacing,(gz+dz)*spacing);
          roadStrip(a,b,roadWidth+10,streetVerts);
          streetSegments.push({a,b,width:roadWidth});
        }
      }
      if(streetVerts.length) {
        const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(streetVerts,3));geo.computeVertexNormals();
        const mesh=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:0x777c76,side:THREE.DoubleSide}));mesh.receiveShadow=true;group.add(mesh);
      }
      let placed=0;
      const blocks=[];
      for(let gx=-limit;gx<limit;gx++) for(let gz=-limit;gz<limit;gz++) blocks.push({gx,gz,sort:hash(gx+zi*71,gz)});
      blocks.sort((a,b)=>a.sort-b.sort);
      for(const {gx,gz} of blocks) {
        if(placed>=zone.n) break;
        for(let side=0;side<2;side++) for(let slot=0;slot<3;slot++) {
          const seed=(gx+50)*331+(gz+50)*17+side*7+slot+zi*9001;
          if(hash(seed,7)<.10) continue; // courtyards and gaps between plots
          const ux=gx*spacing+43+slot*57,uz=gz*spacing+(side?spacing-49:49);
          if(Math.hypot(ux,uz)>zone.r-100) continue;
          const {x,z}=world(ux,uz),w=30+hash(seed,1)*13,d=35+hash(seed,2)*16,r=Math.hypot(w,d)/2;
          if(baseHeight(x,z)<4 || x<coastX(z)+100 || riverDist(x,z)<245+r || reserved(x,z,r) || onRoad(x,z,r+8)) continue;
          if(nearbyPlots(x,z).some(p=>overlaps(p,x,z,w,d,angle))) continue;
          const corners=[[-w/2,-d/2],[w/2,-d/2],[-w/2,d/2],[w/2,d/2]].map(([a,b])=>heightAt(x+a*co-b*si,z+a*si+b*co));
          const min=Math.min(...corners),max=Math.max(...corners);
          if(max-min>24) continue;
          const tower=zi<2 && hash(seed,6)>.955, industrial=zi===4;
          const floors=tower?8+Math.floor(hash(seed,4)*7):industrial?2:1+Math.floor(Math.pow(hash(seed,4),1.5)*(zi<2?5:3));
          const h=floors*9+4, y=max+2, rot=-angle;
          const p={x,z,y,w,d,h,rot,r};allPlots.push(p);placed++;
          const key=cellKey(x,z);if(!occupiedCells.has(key))occupiedCells.set(key,[]);occupiedCells.get(key).push(p);
          bases.push({...p,y:(min+y)/2-1,h:y-min+2,w:w+3,d:d+3,color:0x8e8979});
          bodies.push({...p,y:y+h/2,color:palette[Math.floor(hash(seed,9)*palette.length)]});
          const pitched=floors<=3&&!industrial;
          if(pitched) roofs.push({...p,w:w+5,d:d+5,y:y+h-.1,h:8+hash(seed,10)*6,color:[0x984d32,0x804333,0xac603e][seed%3]});
          else balconies.push({...p,y:y+h+1.2,h:2.4,w:w+2,d:d+2,color:0xe1d8c5});
          const detail=(lx,ly,lz,ww,hh,dd,color)=>({x:x+lx*co-lz*si,z:z+lx*si+lz*co,y:y+ly,w:ww,h:hh,d:dd,rot,color});
          for(let floor=0;floor<floors;floor++) {
            for(const sideZ of [-1,1]) {
              for(let col=-1;col<=1;col++) windows.push(detail(col*w*.28,6+floor*9,sideZ*(d/2+.2),w*.16,4,.5,0x385e67));
              if(floors>3) balconies.push(detail(0,3+floor*9,sideZ*(d/2+1),w*.85,1.2,3,0xc4c8bb));
            }
            windows.push(detail(w/2+.2,6+floor*9,0,.5,4,d*.52,0x385e67));
          }
          if(hash(seed,11)>.45) {
            const sign=side?1:-1;
            awnings.push(detail(0,5,sign*(d/2+4),w*.85,1.3,8,[0x4d7662,0xb66340,0xc2a468][seed%3]));
            windows.push(detail(0,2.4,sign*(d/2+.3),5,4.8,.7,0x334b45));
          }
          if(hash(seed,12)>.5) {
            const pt=world(ux+w/2+9,uz),py=heightAt(pt.x,pt.z),ph=27+hash(seed,13)*12;
            trunks.push({...pt,y:py+ph/2,w:2.3,h:ph,d:2.3,rot:0,color:0x776149});
            for(let f=0;f<6;f++) {const a=f*Math.PI/3;fronds.push({x:pt.x+Math.cos(a)*6,z:pt.z+Math.sin(a)*6,y:py+ph,w:17,h:1.2,d:3,rot:-a,color:0x386345});}
          }
          if(slot===1 && side===0) {
            const pt=world(ux,gz*spacing+19),py=heightAt(pt.x,pt.z);
            lamps.push({...pt,y:py+11,w:1,h:22,d:1,color:0x46534d});
            lamps.push({...pt,y:py+22,w:7,h:1,d:2,rot:-angle,color:0xf2d6a2});
            const mid=world(ux,gz*spacing);
            marks.push({...mid,y:heightAt(mid.x,mid.z)+3,w:16,h:.3,d:1.5,rot:-angle,color:0xd7d2b8});
          }
        }
      }
      batch(THREE,group,unit,bases);batch(THREE,group,unit,bodies);batch(THREE,group,roof,roofs);
      batch(THREE,group,unit,trunks);batch(THREE,group,unit,fronds);
      batch(THREE,close,unit,windows,false);batch(THREE,close,unit,balconies);batch(THREE,close,unit,awnings);
      batch(THREE,close,unit,lamps);batch(THREE,close,unit,marks,false);
      districts.push({group,close,center,radius:zone.r,count:placed});
    });
    metrics.buildings=allPlots.length;metrics.districts=districts.length;
    return {
      occupied(x,z,r=0) {return reserved(x,z,r)||onRoad(x,z,r)||nearbyPlots(x,z).some(p=>Math.hypot(p.x-x,p.z-z)<p.r+r)||streetSegments.some(s=>distSeg(x,z,s.a.x,s.a.z,s.b.x,s.b.z)<s.width/2+r);},
      update(camera) { for(const d of districts){const distance=Math.hypot(camera.position.x-d.center.x,camera.position.z-d.center.z);d.group.visible=distance<d.radius+26000;d.close.visible=distance<d.radius+2600 && camera.position.y<3200;} },
      districts
    };
  }
  function createWater({THREE,scene,coastX,baseHeight}) {
    const geo=new THREE.PlaneGeometry(140000,140000,220,220);geo.rotateX(-Math.PI/2);
    const pos=geo.attributes.position,colors=[];
    const deep=new THREE.Color(0x093f64),shallow=new THREE.Color(0x318e94),c=new THREE.Color();
    for(let i=0;i<pos.count;i++) {
      const x=pos.getX(i),z=pos.getZ(i)-7000;pos.setZ(i,z);
      const offshore=Math.max(0,coastX(z)-x);
      c.copy(shallow).lerp(deep,THREE.MathUtils.smoothstep(offshore,80,2400));
      if(x>coastX(z)) c.copy(shallow).lerp(deep,.30);
      if(x>14000 || z < -40500 || z>11500) c.copy(deep);
      colors.push(c.r,c.g,c.b);
    }
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const mat=new THREE.MeshPhongMaterial({vertexColors:true,specular:0x8bacb5,shininess:90,transparent:true,opacity:.96});
    mat.extensions = { derivatives: true };
    mat.onBeforeCompile=shader=>{
      shader.uniforms.uWaterTime=waterTime;
      shader.vertexShader='varying vec3 vOceanPosition;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvOceanPosition = position;');
      shader.fragmentShader='uniform float uWaterTime; varying vec3 vOceanPosition;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
        vec2 wave = vec2(sin(vOceanPosition.x*.023 + vOceanPosition.z*.014 + uWaterTime*.7), cos(vOceanPosition.z*.037 - uWaterTime*.55));
        float attenuation = 1.0 / (1.0 + length(fwidth(vOceanPosition.xz)) * .04);
        normal = normalize(normal + vec3(wave.x*.018, wave.y*.018, 0.0) * attenuation);`);
    };
    mat.customProgramCacheKey=()=> 'atlas-ocean-v1';
    const mesh=new THREE.Mesh(geo,mat);scene.add(mesh);return mesh;
  }
  function detailLandmark(group,l,{THREE,box,cyl,palm}) {
    if(l.model==='kadri') {
      // Stone approach, shaded colonnade, and market stalls outside the sacred court.
      group.add(box(82,1.5,78,0xa89d7e,0,-2,0));
      for(let i=0;i<7;i++) group.add(box(20,1.2,3,0xc9baa0,0,-1+i*.5,30+i*3));
      for(let i=0;i<10;i++) {
        group.add(cyl(.45,.6,5.5,0xb7a58c,-29,0,-23+i*5,6));
        group.add(box(3, .7, 5.3,0x874a33,-29,5.5,-23+i*5));
      }
      for(let i=0;i<4;i++) {
        group.add(box(5,4,4,0xd2b387,34,0,7+i*7),box(6,.6,6,[0xae573a,0xb38a49,0x4e7863][i%3],34,4,8+i*7));
      }
      group.add(palm(-35,-27,12),palm(39,-31,14));
    } else if(l.model==='gopuram') {
      for(let x=-24;x<=24;x+=8) {
        group.add(cyl(.4,.55,6,0xf2e3c3,x,0,-20,6),box(7.8,.8,5,0xb18a48,x,6,-20));
        group.add(box(2,2.2,.7,0xac8446,x*.45,8,8.3));
      }
      group.add(palm(-36,-20,13),palm(36,-20,13));
    } else if(l.model==='watchtower') {
      group.add(box(30,1.4,27,0x8c8475,0,-1.4,0));
      for(let i=0;i<7;i++) group.add(box(4,1,2,0x77766b,0,i*.85,14-i*1.5));
      for(let i=0;i<8;i++) {const a=i*Math.PI/4;const slit=box(1.3,2,.4,0x394744,Math.cos(a)*7.3,4,Math.sin(a)*7.3);slit.rotation.y=-a+Math.PI/2;group.add(slit);}
    } else if(l.model==='aloysius') {
      for(let floor=0;floor<3;floor++) for(let x=-17;x<=17;x+=4.3) {
        group.add(box(2,2.5,.4,0x34585b,x,2.7+floor*4.1,7.1));
        group.add(box(2.5,.35,.6,0xeee4cc,x,5.2+floor*4.1,7.3));
      }
      group.add(box(64,1.3,28,0xb8b196,0,-1.3,6));
      for(let i=0;i<6;i++) group.add(box(18,.8,2,0xcabfa5,0,i*.35,21+i*2));
    } else if(l.model==='port') {
      group.add(box(80,1.5,42,0x92978b,0,-1.5,8));
      const cols=[0x963e34,0x3d6971,0xb5853d,0x517255];
      for(let row=0;row<4;row++) for(let col=0;col<7;col++) {
        const h=(col+row)%3?2.8:5.6;
        group.add(box(5,h,2.8,cols[(row+col)%4],-23+col*7,0,20+row*4));
      }
      for(let i=0;i<3;i++) group.add(cyl(.2,.2,15,0x4e5b5a,-33+i*32,0,27,5),box(3,.6,2,0xe5d0a1,-33+i*32,15,27));
    } else if(l.model==='airport') {
      group.add(box(110,.5,34,0x7b817a,6,-.6,12));
      for(let x=-33;x<48;x+=9) group.add(box(4,.15,.7,0xeee8d7,x,.7,14));
      for(let x of [-34,46]) for(let z=10;z<=18;z+=2) group.add(box(5,.15,.6,0xeee8d7,x,.7,z));
      for(let x=-24;x<=24;x+=6) group.add(box(4,4,.4,0x3b6873,x,2,-1.7));
      for(let x=-32;x<=44;x+=8) group.add(cyl(.15,.15,1,0xf5d690,x,0,21,5));
      group.add(box(24,.3,10,0xb3b7a6,4,0,0));
    }
  }
  function createLife({THREE,scene,landmarks,modelEntries,heightAt,ferry,speedboat,ships}) {
    // Pedestrians remain on modeled plazas, shown only when the camera is nearby.
    for(const entry of modelEntries.filter(e=>['kadri','aloysius','gopuram','watchtower'].includes(e.landmark.model))) {
      const people=new THREE.Group();entry.group.add(people);
      const walkers=[];
      for(let i=0;i<12;i++) {
        const person=new THREE.Group();
        const body=new THREE.Mesh(new THREE.CylinderGeometry(.28,.36,1.2,5),new THREE.MeshLambertMaterial({color:[0x98563e,0xe7cda0,0x47777b,0x5f657f][i%4]}));
        body.position.y=1.1;
        const head=new THREE.Mesh(new THREE.SphereGeometry(.3,6,4),new THREE.MeshLambertMaterial({color:0xa87855}));head.position.y=1.95;
        person.add(body,head);
        const legMaterial=new THREE.MeshLambertMaterial({color:0x3e4946});
        for(const x of [-.15,.15]) { const leg=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.7,4),legMaterial);leg.position.set(x,.35,0);person.add(leg); }
        person.scale.setScalar(1.5);people.add(person);walkers.push(person);
      }
      life.push({type:'people',entry,people,walkers});
    }
    // Feathered wakes are attached to the existing watercraft; no extra navigation loop.
    const textureCanvas=document.createElement('canvas');textureCanvas.width=32;textureCanvas.height=128;
    const ctx=textureCanvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,0,128);
    gradient.addColorStop(0,'rgba(225,245,237,0)');gradient.addColorStop(.65,'rgba(225,245,237,.28)');gradient.addColorStop(1,'rgba(225,245,237,.6)');
    ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(1,0);ctx.lineTo(31,0);ctx.lineTo(18,128);ctx.lineTo(14,128);ctx.closePath();ctx.fill();
    const texture=new THREE.CanvasTexture(textureCanvas);
    for(const [boat,length,width] of [[ferry,130,45],[speedboat,110,35],...ships.map(s=>[s,220,65])]) {
      const wake=new THREE.Mesh(new THREE.PlaneGeometry(width,length),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,opacity:.7,side:THREE.DoubleSide}));
      wake.rotation.x=-Math.PI/2;scene.add(wake);life.push({type:'wake',boat,wake,length});
    }
  }
  function updateLife(t,camera) {
    for(const item of life) {
      if(item.type==='people') {
        const l=item.entry.landmark;
        item.people.visible=camera.position.distanceTo(item.entry.group.position)<2100;
        if(item.people.visible) item.walkers.forEach((p,i)=>{
          const phase=t*.025+i/12, progress=(phase%1)*2, u=progress<=1?progress:2-progress;
          const model=l.model, span=model==='watchtower'?11:18;
          const z=model==='kadri'?32:model==='watchtower'?10:15;
          const ground=(model==='kadri'||model==='gopuram') ? .6 : .1;
          p.position.set(-span+u*span*2,ground,z+(i%3));p.rotation.y=progress<=1?Math.PI/2:-Math.PI/2;
        });
      } else {
        const dx=Math.sin(item.boat.rotation.y),dz=Math.cos(item.boat.rotation.y);
        item.wake.position.set(item.boat.position.x-dx*item.length*.65,.7,item.boat.position.z-dz*item.length*.65);
        item.wake.rotation.z=-item.boat.rotation.y;item.wake.material.opacity=.55+Math.sin(t*.8)*.08;
      }
    }
  }
  function measureFrame(dt,renderer) {
    if(dt>0) frameSamples.push(dt);if(frameSamples.length>180)frameSamples.shift();
    metrics={...metrics,fps:Math.round(frameSamples.length/frameSamples.reduce((a,b)=>a+b,0)),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
    const output=document.getElementById('atlas-performance');
    if(output) output.textContent=`${metrics.fps} fps · ${metrics.drawCalls} draws · ${metrics.buildings} buildings`;
  }
  return {buildDistricts,createWater,detailLandmark,createLife,updateLife,updateWater:t=>{waterTime.value=t;},measureFrame,getMetrics:()=>({...metrics})};
})();
