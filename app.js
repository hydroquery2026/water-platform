
let DATA = null;
let state = {
  authed: false,
  user: null,
  view: "dashboard"
};

function $(sel){ return document.querySelector(sel); }
function $all(sel){ return [...document.querySelectorAll(sel)]; }

async function loadData(){
  const res = await fetch("./data.json");
  DATA = await res.json();
}

function setActiveNav(){
  $all(".navitem").forEach(el=>{
    el.classList.toggle("active", el.dataset.view === state.view);
  });
}

function showView(view){
  state.view = view;
  setActiveNav();
  render();
}

function fmt(n){
  if (typeof n === "number") return n.toFixed(1);
  return n ?? "";
}

function inRange(timeStr, start, end){
  if(!start && !end) return true;
  const t = new Date(timeStr.replace(" ","T"));
  if(start){
    const s = new Date(start+"T00:00:00");
    if(t < s) return false;
  }
  if(end){
    const e = new Date(end+"T23:59:59");
    if(t > e) return false;
  }
  return true;
}

function uniqueStations(){
  const set = new Set(DATA.water.map(x=>x.station));
  return [...set];
}

function buildLineChart(points){
  // simple SVG polyline chart
  const W = 760, H = 260, pad = 34;
  const xs = points.map((_,i)=>i);
  const ys = points.map(p=>p.water);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const scaleX = (i)=> pad + (W-2*pad) * (i/(xs.length-1 || 1));
  const scaleY = (v)=> H-pad - (H-2*pad) * ((v-minY)/(maxY-minY || 1));
  const pts = points.map((p,i)=>`${scaleX(i)},${scaleY(p.water)}`).join(" ");
  const grid = [];
  for(let i=0;i<5;i++){
    const y = pad + (H-2*pad)*i/4;
    grid.push(`<line x1="${pad}" y1="${y}" x2="${W-pad}" y2="${y}" stroke="#e5e7eb" />`);
  }
  const yLabels = [];
  for(let i=0;i<5;i++){
    const v = maxY - (maxY-minY)*i/4;
    const y = pad + (H-2*pad)*i/4;
    yLabels.push(`<text x="6" y="${y+4}" font-size="12" fill="#6b7280">${v.toFixed(1)}</text>`);
  }
  return `
  <svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    ${grid.join("")}
    ${yLabels.join("")}
    <polyline points="${pts}" fill="none" stroke="#3b6ea5" stroke-width="3" />
    ${points.map((p,i)=>`<circle cx="${scaleX(i)}" cy="${scaleY(p.water)}" r="4" fill="#3b6ea5"/>`).join("")}
  </svg>`;
}

function buildBarChart(points){
  const W = 760, H = 260, pad = 34;
  const ys = points.map(p=>p.rain);
  const maxY = Math.max(1, ...ys);
  const barW = (W-2*pad) / (ys.length || 1) * 0.7;
  const gap = (W-2*pad) / (ys.length || 1) * 0.3;
  const rects = points.map((p,i)=>{
    const h = (H-2*pad) * (p.rain/maxY);
    const x = pad + i*(barW+gap) + gap/2;
    const y = H-pad - h;
    return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="#3b6ea5" opacity="0.85"></rect>`;
  });
  const recalls = [];
  for(let i=0;i<5;i++){
    const y = pad + (H-2*pad)*i/4;
    recalls.push(`<line x1="${pad}" y1="${y}" x2="${W-pad}" y2="${y}" stroke="#e5e7eb" />`);
    const v = (maxY - maxY*i/4);
    recalls.push(`<text x="6" y="${y+4}" font-size="12" fill="#6b7280">${v.toFixed(1)}</text>`);
  }
  return `
  <svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    ${recalls.join("")}
    ${rects.join("")}
  </svg>`;
}

function renderDashboard(){
  const stations = uniqueStations();
  const latest = DATA.water.slice(-3);
  const avgWater = DATA.water.reduce((a,b)=>a+b.water,0)/DATA.water.length;
  const sumRain = DATA.water.reduce((a,b)=>a+b.rain,0);
  return `
    <div class="grid two">
      <div class="card">
        <h3>水位趋势图（示例）</h3>
        <div class="svgwrap">${buildLineChart(latest)}</div>
        <div class="small">提示：此为演示数据，可用于论文截图与答辩展示。</div>
      </div>
      <div class="card">
        <h3>关键指标</h3>
        <div class="kpi">
          <div class="box">
            <div class="small">测站数量</div>
            <div class="num">${stations.length}</div>
          </div>
          <div class="box">
            <div class="small">平均水位</div>
            <div class="num">${avgWater.toFixed(1)} m</div>
          </div>
          <div class="box">
            <div class="small">累计雨量</div>
            <div class="num">${sumRain.toFixed(1)} mm</div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid two2" style="margin-top:14px;">
      <div class="card">
        <h3>雨量分布（示例）</h3>
        <div class="svgwrap">${buildBarChart(latest)}</div>
      </div>
      <div class="card">
        <h3>最新水情数据</h3>
        <table class="table">
          <thead><tr><th>测站</th><th>水位(m)</th><th>雨量(mm)</th><th>采集时间</th></tr></thead>
          <tbody>
            ${latest.map(x=>`<tr><td>${x.station}</td><td>${fmt(x.water)}</td><td>${fmt(x.rain)}</td><td>${x.time}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderWater(){
  const station = $("#stationFilter")?.value || "";
  const start = $("#startDate")?.value || "";
  const end = $("#endDate")?.value || "";
  const filtered = DATA.water
    .filter(x => (!station || x.station === station))
    .filter(x => inRange(x.time, start, end));

  const chartPoints = filtered.slice(-6);
  return `
    <div class="card">
      <h3>水情管理</h3>
      <div class="toolbar">
        <select id="stationFilter" class="select">
          <option value="">全部测站</option>
          ${uniqueStations().map(s=>`<option value="${s}" ${s===station?"selected":""}>${s}</option>`).join("")}
        </select>
        <input id="startDate" class="input" type="date" value="${start}">
        <input id="endDate" class="input" type="date" value="${end}">
        <button class="btn" id="btnQuery">查询</button>
        <button class="btn ghost" id="btnAddWater">新增</button>
        <button class="btn ghost" id="btnEditWater">修改</button>
        <button class="btn ghost" id="btnDelWater">删除</button>
      </div>

      <div class="grid two2">
        <div class="card">
          <h3 style="margin-top:0;">水位趋势（折线图）</h3>
          <div class="svgwrap">${buildLineChart(chartPoints.map(x=>({water:x.water, rain:x.rain})).map((p,i)=>({...p})) )}</div>
        </div>
        <div class="card">
          <h3 style="margin-top:0;">雨量分布（柱状图）</h3>
          <div class="svgwrap">${buildBarChart(chartPoints.map(x=>({water:x.water, rain:x.rain})).map((p,i)=>({...p})) )}</div>
        </div>
      </div>

      <div style="margin-top:12px;">
        <table class="table">
          <thead><tr><th>测站名称</th><th>水位(m)</th><th>雨量(mm)</th><th>采集时间</th><th>操作</th></tr></thead>
          <tbody>
            ${filtered.map((x,i)=>`
              <tr>
                <td>${x.station}</td><td>${fmt(x.water)}</td><td>${fmt(x.rain)}</td><td>${x.time}</td>
                <td><span class="pill">编辑</span> <span class="pill">删除</span></td>
              </tr>`).join("")}
            ${filtered.length===0?`<tr><td colspan="5" class="small">无匹配数据</td></tr>`:""}
          </tbody>
        </table>
      </div>
      <div class="notice">说明：新增/修改/删除按钮为演示交互（便于截图与答辩展示）。</div>
    </div>
  `;
}

function renderProjects(){
  return `
    <div class="card">
      <h3>工程管理</h3>
      <div class="toolbar">
        <input class="input" id="projKw" placeholder="输入工程名称关键字">
        <button class="btn" id="btnProjQuery">查询</button>
        <button class="btn ghost" id="btnProjAdd">新增</button>
        <button class="btn ghost" id="btnProjEdit">修改</button>
        <button class="btn ghost" id="btnProjDel">删除</button>
      </div>
      <table class="table">
        <thead>
          <tr><th>工程名称</th><th>工程类型</th><th>工程位置</th><th>工程描述</th><th>运行状态</th><th>操作</th></tr>
        </thead>
        <tbody id="projBody">
          ${DATA.projects.map(p=>`
            <tr>
              <td>${p.name}</td><td>${p.type}</td><td>${p.location}</td><td>${p.desc}</td>
              <td>${p.status==="正常"?`<span class="pill ok">正常</span>`:`<span class="pill warn">维护</span>`}</td>
              <td><span class="pill">编辑</span> <span class="pill">删除</span></td>
            </tr>`).join("")}
        </tbody>
      </table>
      <div class="notice">说明：此页面用于展示工程信息的新增/修改/删除/查询流程，满足论文功能实现截图需求。</div>
    </div>
  `;
}

function renderInspections(){
  return `
    <div class="card">
      <h3>巡检信息管理</h3>
      <div class="toolbar">
        <select id="inspProj" class="select">
          <option value="">全部工程</option>
          ${DATA.projects.map(p=>`<option value="${p.name}">${p.name}</option>`).join("")}
        </select>
        <button class="btn" id="btnInspQuery">查询</button>
        <button class="btn ghost" id="btnInspAdd">新增</button>
        <button class="btn ghost" id="btnInspEdit">修改</button>
        <button class="btn ghost" id="btnInspDel">删除</button>
      </div>
      <table class="table">
        <thead>
          <tr><th>工程名称</th><th>巡检人员</th><th>巡检内容</th><th>巡检结果</th><th>巡检时间</th><th>附件</th><th>操作</th></tr>
        </thead>
        <tbody id="inspBody">
          ${DATA.inspections.map(x=>`
            <tr>
              <td>${x.project}</td><td>${x.inspector}</td><td>${x.content}</td>
              <td>${x.result==="正常"?`<span class="pill ok">正常</span>`:`<span class="pill warn">需维护</span>`}</td>
              <td>${x.time}</td><td>${x.file}</td>
              <td><span class="pill">编辑</span> <span class="pill">删除</span></td>
            </tr>`).join("")}
        </tbody>
      </table>
      <div class="notice">说明：支持工程筛选与巡检记录维护，附件字段用于对应“文件上传功能”。</div>
    </div>
  `;
}

function renderUpload(){
  return `
    <div class="card">
      <h3>文件上传</h3>
      <div class="small">用于上传巡检附件（现场照片、检测报告等），并与巡检记录关联保存（演示版）。</div>
      <div class="toolbar" style="margin-top:10px;">
        <select class="select" id="uploadProj">
          ${DATA.projects.map(p=>`<option value="${p.name}">${p.name}</option>`).join("")}
        </select>
        <input class="input" id="uploadInspector" placeholder="巡检人员（如：张三）">
      </div>
      <div class="card" style="border-style:dashed;">
        <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
          <input type="file" id="fileInput" class="input" style="padding-top:6px;">
          <button class="btn" id="btnUpload">上传</button>
          <span class="small" id="uploadHint">请选择文件后点击上传</span>
        </div>
      </div>
      <div style="margin-top:12px;">
        <h3 style="margin:0 0 8px 0;">上传记录</h3>
        <table class="table">
          <thead><tr><th>工程</th><th>巡检人员</th><th>文件名</th><th>时间</th></tr></thead>
          <tbody id="uploadLog">
            <tr><td>东风闸</td><td>李四</td><td>润滑记录.pdf</td><td>2025-04-10 10:05</td></tr>
          </tbody>
        </table>
      </div>
      <div class="notice">说明：本地 file:// 演示模式下不写入服务器，仅用于展示上传流程与截图。</div>
    </div>
  `;
}

function render(){
  const authed = state.authed;
  $("#userBadge").textContent = authed ? `当前用户：${state.user.name}（${state.user.role}）` : "未登录（演示）";
  let html = "";
  if(!authed){
    html = renderDashboard();
    $("#content").innerHTML = html;
    $("#loginBackdrop").style.display = "flex";
    return;
  }
  if(state.view === "dashboard") html = renderDashboard();
  if(state.view === "water") html = renderWater();
  if(state.view === "projects") html = renderProjects();
  if(state.view === "inspections") html = renderInspections();
  if(state.view === "upload") html = renderUpload();
  $("#content").innerHTML = html;

  // bind
  if(state.view === "water"){
    $("#btnQuery").onclick = ()=>render();
    $("#stationFilter").onchange = ()=>render();
    $("#startDate").onchange = ()=>render();
    $("#endDate").onchange = ()=>render();
  }
  if(state.view === "projects"){
    $("#btnProjQuery").onclick = ()=>{
      const kw = ($("#projKw").value||"").trim();
      const body = DATA.projects.filter(p=>!kw || p.name.includes(kw))
        .map(p=>`
          <tr>
            <td>${p.name}</td><td>${p.type}</td><td>${p.location}</td><td>${p.desc}</td>
            <td>${p.status==="正常"?`<span class="pill ok">正常</span>`:`<span class="pill warn">维护</span>`}</td>
            <td><span class="pill">编辑</span> <span class="pill">删除</span></td>
          </tr>`).join("");
      $("#projBody").innerHTML = body || `<tr><td colspan="6" class="small">无匹配数据</td></tr>`;
    };
  }
  if(state.view === "inspections"){
    $("#btnInspQuery").onclick = ()=>{
      const p = $("#inspProj").value;
      const body = DATA.inspections.filter(x=>!p || x.project===p).map(x=>`
        <tr>
          <td>${x.project}</td><td>${x.inspector}</td><td>${x.content}</td>
          <td>${x.result==="正常"?`<span class="pill ok">正常</span>`:`<span class="pill warn">需维护</span>`}</td>
          <td>${x.time}</td><td>${x.file}</td>
          <td><span class="pill">编辑</span> <span class="pill">删除</span></td>
        </tr>`).join("");
      $("#inspBody").innerHTML = body || `<tr><td colspan="7" class="small">无匹配数据</td></tr>`;
    };
  }
  if(state.view === "upload"){
    $("#btnUpload").onclick = ()=>{
      const f = $("#fileInput").files?.[0];
      const proj = $("#uploadProj").value;
      const insp = ($("#uploadInspector").value||"").trim() || "（未填写）";
      const now = new Date();
      const ts = now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0")+" "+String(now.getHours()).padStart(2,"0")+":"+String(now.getMinutes()).padStart(2,"0");
      if(!f){
        $("#uploadHint").textContent = "请先选择文件";
        return;
      }
      $("#uploadHint").textContent = "上传成功（演示）";
      $("#uploadLog").insertAdjacentHTML("afterbegin", `<tr><td>${proj}</td><td>${insp}</td><td>${f.name}</td><td>${ts}</td></tr>`);
      $("#fileInput").value = "";
    };
  }
}

function openLogin(){
  $("#loginBackdrop").style.display = "flex";
}

function closeLogin(){
  $("#loginBackdrop").style.display = "none";
}

function doLogin(){
  const u = ($("#loginUser").value||"").trim();
  const p = ($("#loginPass").value||"").trim();
  if(u==="admin" && p==="123456"){
    state.authed = true;
    state.user = {name:"管理员", role:"管理员"};
    closeLogin();
    render();
  }else if(u && p){
    state.authed = true;
    state.user = {name:u, role:"普通用户"};
    closeLogin();
    render();
  }else{
    $("#loginTip").textContent = "请输入账号与密码";
  }
}

window.addEventListener("DOMContentLoaded", async ()=>{
  await loadData();

  // nav click
  $all(".navitem").forEach(el=>{
    el.addEventListener("click", ()=>{
      if(!state.authed){ openLogin(); return; }
      showView(el.dataset.view);
    });
  });

  $("#btnOpenLogin").onclick = openLogin;
  $("#btnLogin").onclick = doLogin;
  $("#btnCancelLogin").onclick = closeLogin;

  setActiveNav();
  render();
});
