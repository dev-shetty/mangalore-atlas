/* Non-modal welcome: map navigation stays available. Deep links skip the introduction. */
(() => {
  const params = new URLSearchParams(location.search);
  if (params.has('stats')) {
    const output = document.createElement('output');
    output.id = 'atlas-performance'; output.setAttribute('aria-label', 'Rendering performance');
    document.body.appendChild(output);
  }
  let dismissed = false;
  try { dismissed = sessionStorage.getItem('atlas-intro-dismissed') === 'yes'; } catch {}
  if (params.has('cam') || params.has('place') || (dismissed && !params.has('intro'))) return;
  const intro = document.createElement('section');
  intro.className = 'city-intro'; intro.setAttribute('aria-labelledby', 'city-intro-title');
  intro.innerHTML = `<button class="intro-close" aria-label="Dismiss introduction">×</button>
    <p class="intro-eyebrow">KUDLA · COASTAL KARNATAKA</p>
    <h2 id="city-intro-title">A little closer to <em>Mangalore.</em></h2>
    <p>Between the rivers and the sea. Explore temple hills, tiled rooftops, and a city that never quite stands still.</p>
    <div class="intro-actions"><button class="intro-explore">Explore Mangalore <span aria-hidden="true">↗</span></button><button class="intro-tour">Take a tour</button></div>
    <small>Drag to orbit · Pinch or scroll to move closer</small>`;
  document.body.appendChild(intro);
  function dismiss() {
    intro.remove();
    try { sessionStorage.setItem('atlas-intro-dismissed', 'yes'); } catch {}
  }
  intro.querySelector('.intro-close').onclick = dismiss;
  intro.querySelector('.intro-explore').onclick = () => { dismiss(); document.getElementById('toggle').focus(); };
  intro.querySelector('.intro-tour').onclick = () => { dismiss(); startStory(); };
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && intro.isConnected) dismiss(); });
})();
