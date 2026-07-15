
(function(){
  var rm = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  // Cursor — instant tracking
  var cur = document.getElementById('cur');
  if(cur){
    document.addEventListener('mousemove', function(e){
      cur.style.transform = 'translate(' + (e.clientX-4) + 'px,' + (e.clientY-4) + 'px)';
    }, {passive:true});
    var chDepth=0;
    function enterCh(){chDepth++;document.body.classList.add('ch');}
    function leaveCh(){if(--chDepth<=0){chDepth=0;document.body.classList.remove('ch');}}
    document.querySelectorAll('a,.svc-card,.dg-item,.news-card,.project,.vpath').forEach(function(el){
      el.addEventListener('mouseenter',enterCh);
      el.addEventListener('mouseleave',leaveCh);
    });
    document.querySelectorAll('button,.btn-p,.btn-s,.section-btn,.nav-cta').forEach(function(el){
      el.addEventListener('mouseenter',function(){document.body.classList.add('cb');});
      el.addEventListener('mouseleave',function(){document.body.classList.remove('cb');});
    });
    var navEl=document.getElementById('nav');
    if(navEl){
      navEl.addEventListener('mouseenter',function(){document.body.classList.add('cn');});
      navEl.addEventListener('mouseleave',function(){document.body.classList.remove('cn');});
    }
    // Light cursor on paper sections — shared state so sections don't fight each other
    var lightState={};
    function syncCursorLight(){document.body.classList.toggle('cl',Object.keys(lightState).some(function(k){return lightState[k];}));}
    ['services','web','about-story'].forEach(function(id){
      var el = document.getElementById(id);
      if(!el) return;
      lightState[id]=false;
      new IntersectionObserver(function(en){
        lightState[id]=en[0].isIntersecting;
        syncCursorLight();
      },{threshold:0.1}).observe(el);
    });
  }
  // Nav elevation
  var nav = document.getElementById('nav');
  window.addEventListener('scroll', function(){
    nav.classList.toggle('elevated', window.scrollY > 60);
  }, {passive:true});
  // Video hover (desktop) / autoplay-on-scroll (touch)
  var noHover = window.matchMedia('(hover:none)').matches;
  [{'p':'vp-int','v':'vid-int'},{'p':'vp-pro','v':'vid-pro'}].forEach(function(o){
    var panel = document.getElementById(o.p), vid = document.getElementById(o.v);
    if(!panel||!vid||rm) return;
    new IntersectionObserver(function(en){
      if(en[0].isIntersecting){
        vid.preload='auto';
        if(noHover) vid.play().catch(function(){});
      } else {
        if(noHover) vid.pause();
      }
    },{threshold:0.3}).observe(panel);
    if(!noHover){
      panel.addEventListener('mouseenter',function(){vid.play().catch(function(){});});
      panel.addEventListener('mouseleave',function(){vid.pause();});
      panel.addEventListener('focus',function(){vid.play().catch(function(){});});
      panel.addEventListener('blur',function(){vid.pause();});
    }
  });
  // Lightbox
  var lb=document.getElementById('lightbox'),lbv=document.getElementById('lb-video'),
      lbt=document.getElementById('lb-title'),lbc=document.getElementById('lb-close'),lf=null;
  function openLb(title,src){lf=document.activeElement;lbt.textContent=title;lbv.src=src;lb.classList.add('open');document.body.style.overflow='hidden';lbc.focus();}
  function closeLb(){lb.classList.remove('open');lbv.pause();lbv.src='';document.body.style.overflow='';if(lf)lf.focus();}
  document.querySelectorAll('.vpath-play').forEach(function(btn){
    btn.addEventListener('click',function(){
      var p=btn.closest('.vpath'),v=p.querySelector('video'),t=p.querySelector('.vpath-title');
      if(v&&t) openLb(t.textContent.trim().replace(/\s+/g,' '),v.src||v.getAttribute('src'));
    });
    btn.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();btn.click();}});
  });
  if(lb){
    lbc.addEventListener('click',closeLb);
    lb.addEventListener('click',function(e){if(e.target===lb)closeLb();});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&lb.classList.contains('open'))closeLb();});
  }

  // Equalize testimonial card heights to tallest card
  function equalizeTestimonials(){
    var cards=document.querySelectorAll('.testimonial-card');
    if(!cards.length) return;
    cards.forEach(function(c){c.style.height='';});
    if(window.innerWidth<=1024) return;
    var maxH=0;
    cards.forEach(function(c){if(c.offsetHeight>maxH)maxH=c.offsetHeight;});
    if(maxH>0) cards.forEach(function(c){c.style.height=maxH+'px';});
  }
  if(document.fonts){document.fonts.ready.then(equalizeTestimonials);}
  else{window.addEventListener('load',equalizeTestimonials);}
  var eqTimer;
  window.addEventListener('resize',function(){clearTimeout(eqTimer);eqTimer=setTimeout(equalizeTestimonials,150);},{passive:true});

  // Scroll reveal — add class names here to animate new elements on any page.
  // rev(selector, staggerMs) — stagger staggers children by index.
  // Elements already carrying 'reveal' are skipped (safe to call multiple times).
  if(!rm){
    var revObs=new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){e.target.classList.add('in');revObs.unobserve(e.target);}
      });
    },{rootMargin:'0px 0px -48px 0px',threshold:0.08});
    function rev(sel,stagger){
      document.querySelectorAll(sel).forEach(function(el,i){
        if(el.classList.contains('reveal'))return;
        el.classList.add('reveal');
        if(stagger)el.style.transitionDelay=Math.min(i*stagger,400)+'ms';
        revObs.observe(el);
      });
    }
    // Homepage: staggered section header groups (run first to claim elements before generic pass)
    rev('#services .eyebrow,#services .h-sec,#services .body-lg',80);
    rev('#video .eyebrow,#video .h-sec',80);
    rev('#web .eyebrow,#web .h-sec',80);
    rev('#design .eyebrow,#design .h-sec',80);
    rev('#testimonials .eyebrow,#testimonials .h-sec',80);
    rev('#newsworthy .eyebrow,#newsworthy .h-sec',80);
    rev('#contact .eyebrow,#contact h2,#contact p,#contact .btn-p',80);
    rev('.as-headline,.as-body',80);
    rev('.as-block',100);
    rev('.section-btn-wrap',0);
    rev('.svc-card',70);
    rev('.dg-item',80);
    rev('.testimonial-card',90);
    rev('.news-card',80);
    rev('.vpath',90);
    rev('.project',0);
    // All pages: page hero
    rev('.page-hero h1,.page-hero .eyebrow',80);
    rev('.page-hero-sub',0);
    // All pages: generic section headers (skip already-claimed above)
    rev('.eyebrow',0);
    rev('.h-sec,.h-disp',0);
    // About page
    rev('.chapter-inner',0);
    rev('.value-item',70);
    // Services overview
    rev('.pillar-card',80);
    rev('.process-strip',80);
    // Services: video
    rev('.reel-panel',90);
    rev('.cap-card',80);
    rev('.work-item',0);
    // Services: web
    rev('.tier-card',90);
    rev('.project-card',0);
    // Services: content
    rev('.content-card',80);
    rev('.sample-strip',80);
    // Services: design
    rev('.deliv-card',80);
    // Services: strategy
    rev('.offering',80);
    rev('.strat-case',90);
    // Work + blog
    rev('.work-card',80);
    rev('.blog-card',80);
    // Rail labels (all pages)
    rev('.rail-label',0);
  }

  // Design grid masonry — shortest-column placement so items always pack to the top
  function masonryDesignGrid(){
    var grid=document.querySelector('.design-grid');
    if(!grid) return;
    var items=Array.from(grid.querySelectorAll('.dg-item'));
    if(!items.length) return;
    // Reset to auto so getBoundingClientRect gives correct widths
    items.forEach(function(it){it.style.gridColumn='';it.style.gridRow='';});
    var rowUnit=4, rowGap=14;
    var numCols=window.innerWidth<=640?1:window.innerWidth<=1024?2:3;
    var colH=new Array(numCols).fill(0);
    items.forEach(function(it){
      var img=it.querySelector('img');
      if(!img||!img.naturalWidth) return;
      var span=it.classList.contains('dg-spread')?Math.min(2,numCols):1;
      var w=it.getBoundingClientRect().width;
      var h=w*(img.naturalHeight/img.naturalWidth);
      var rowSpan=Math.ceil((h+rowGap)/(rowUnit+rowGap));
      // Find starting column whose max height across spanned cols is lowest
      var bestCol=0, bestH=Infinity;
      for(var c=0;c<=numCols-span;c++){
        var top=0;
        for(var s=0;s<span;s++) top=Math.max(top,colH[c+s]);
        if(top<bestH){bestH=top;bestCol=c;}
      }
      it.style.gridColumn=(bestCol+1)+' / span '+span;
      it.style.gridRow=(bestH+1)+' / span '+rowSpan;
      for(var s=0;s<span;s++) colH[bestCol+s]=bestH+rowSpan;
    });
  }
  window.addEventListener('load',masonryDesignGrid);
  window.addEventListener('resize',function(){requestAnimationFrame(masonryDesignGrid);},{passive:true});
  document.querySelectorAll('.dg-item img').forEach(function(img){
    if(!img.complete) img.addEventListener('load',function(){requestAnimationFrame(masonryDesignGrid);});
  });
})();

// Hamburger menu
(function(){
  var burger=document.querySelector('.nav-burger');
  var menu=document.getElementById('mobile-menu');
  if(!burger||!menu) return;
  burger.addEventListener('click',function(){
    var open=burger.classList.toggle('is-open');
    burger.setAttribute('aria-expanded',String(open));
    menu.classList.toggle('is-open');
    menu.setAttribute('aria-hidden',String(!open));
  });
  menu.querySelectorAll('a').forEach(function(a){
    a.addEventListener('click',function(){
      burger.classList.remove('is-open');
      burger.setAttribute('aria-expanded','false');
      menu.classList.remove('is-open');
      menu.setAttribute('aria-hidden','true');
    });
  });
})();

// Active nav link
(function(){
  var path=window.location.pathname;
  function mark(sel){document.querySelectorAll(sel).forEach(function(a){a.classList.add('is-active');});}
  if(path.indexOf('/services')===0){
    mark('.nav-links>.nav-item>a[href="/services/"]');
    mark('.mobile-menu>a[href="/services/"]');
  } else if(path.indexOf('/about')===0){
    mark('.nav-links a[href="/about/"]');
    mark('.mobile-menu>a[href="/about/"]');
  } else if(path.indexOf('/work')===0){
    mark('.nav-links a[href="/work/"]');
    mark('.mobile-menu>a[href="/work/"]');
  } else if(path.indexOf('/blog')===0){
    mark('.nav-links a[href="/blog/"]');
    mark('.mobile-menu>a[href="/blog/"]');
  }
})();
