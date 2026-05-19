// ── TURBO ARCADE CODE DISPLAY ──────────────────────────
// Drop this in every game alongside code-engine.js
// Call: showArcadeCode('game-id', score) on new PB

(function(){
  const CSS = `
    .ta-code-wrap {
      display:none; margin:16px auto 0; max-width:340px;
      background:#1a47b8; border-radius:14px;
      padding:14px 18px 12px; text-align:center;
      animation:taPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both;
      position:relative; overflow:hidden;
    }
    .ta-code-wrap::before {
      content:''; position:absolute; inset:0;
      background:linear-gradient(135deg,rgba(255,230,0,0.08),transparent 60%);
      pointer-events:none;
    }
    @keyframes taPop{from{transform:scale(0.8);opacity:0}to{transform:scale(1);opacity:1}}
    .ta-code-bell{font-size:26px;display:block;margin-bottom:4px;
      animation:taBell 0.7s ease;}
    @keyframes taBell{
      0%{transform:rotate(-25deg)} 20%{transform:rotate(22deg)}
      40%{transform:rotate(-16deg)} 60%{transform:rotate(14deg)}
      80%{transform:rotate(-7deg)} 100%{transform:rotate(0)}
    }
    .ta-code-label{font-size:9px;font-weight:800;letter-spacing:0.22em;
      text-transform:uppercase;color:rgba(255,255,255,0.6);margin-bottom:6px;}
    .ta-code-value{
      font-family:'Courier New',monospace;font-size:28px;font-weight:900;
      color:#ffe600;letter-spacing:0.22em;
      text-shadow:0 0 14px rgba(255,230,0,0.55);
      cursor:pointer;user-select:all;display:block;margin-bottom:6px;
    }
    .ta-code-hint{font-size:11px;color:rgba(255,255,255,0.55);font-weight:600;}
    .ta-code-copied{font-size:11px;color:#ffe600;font-weight:700;
      margin-top:3px;display:none;}
  `;

  function inject(){
    if(document.getElementById('ta-code-style')) return;
    const s=document.createElement('style');
    s.id='ta-code-style'; s.textContent=CSS;
    document.head.appendChild(s);

    const d=document.createElement('div');
    d.className='ta-code-wrap'; d.id='ta-code-wrap';
    d.innerHTML=`
      <span class="ta-code-bell">🔔</span>
      <div class="ta-code-label">⚡ New Personal Best — Arcade Code</div>
      <span class="ta-code-value" id="ta-code-value" onclick="tacopyCopy()">——————</span>
      <div class="ta-code-hint">Tap to copy · bring it to the Turbo Arcade coin slot</div>
      <div class="ta-code-copied" id="ta-code-copied">Copied! ✓</div>
    `;
    // Insert at end of body — games will reposition if needed
    document.body.appendChild(d);
  }

  window.showArcadeCode = function(gameId, score){
    inject();
    const code = generateCode(gameId, score);
    if(!code) return;
    const wrap = document.getElementById('ta-code-wrap');
    const val  = document.getElementById('ta-code-value');
    if(!wrap||!val) return;
    // Format XX-XX-XX
    val.textContent = code.slice(0,2)+'-'+code.slice(2,4)+'-'+code.slice(4,6);
    // Re-trigger bell animation
    const bell = wrap.querySelector('.ta-code-bell');
    if(bell){ bell.style.animation='none'; void bell.offsetWidth; bell.style.animation=''; }
    wrap.style.display='block';
    // Scroll into view
    setTimeout(()=>wrap.scrollIntoView({behavior:'smooth',block:'center'}), 100);
  };

  window.tacopyCopy = function(){
    const val=document.getElementById('ta-code-value');
    const copied=document.getElementById('ta-code-copied');
    if(!val) return;
    const clean=val.textContent.replace(/-/g,'');
    navigator.clipboard.writeText(clean).then(()=>{
      if(copied){copied.style.display='block';setTimeout(()=>copied.style.display='none',2000);}
    }).catch(()=>{
      const r=document.createRange(); r.selectNode(val);
      window.getSelection().removeAllRanges(); window.getSelection().addRange(r);
    });
  };
})();
