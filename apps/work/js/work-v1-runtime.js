(function(){
  'use strict';
  const ROOT=document.documentElement;
  const KEYS={theme:'nosmo-work:v1:theme',lang:'nosmo-work:v1:language',availability:'nosmo-work:v1:availability',jobSearch:'nosmo-work:v1:job-search'};
  const LANGS=[
    ['en','🇬🇧','English'],['pl','🇵🇱','Polski'],['ro','🇷🇴','Română'],['ur','🇵🇰','اردو'],['pa','🇬🇧','ਪੰਜਾਬੀ'],['bn','🇧🇩','বাংলা'],['gu','🇮🇳','ગુજરાતી'],['ar','🇬🇧','العربية'],['pt','🇵🇹','Português'],['es','🇪🇸','Español'],['fr','🇫🇷','Français'],['lt','🇱🇹','Lietuvių'],['bg','🇧🇬','Български'],['uk','🇺🇦','Українська'],['zh','🇨🇳','中文'],['tr','🇹🇷','Türkçe'],['it','🇮🇹','Italiano']
  ];
  const T={
    en:{person:'Person',documents:'Documents',work:'Work',workMode:'Work Mode',availability:'Availability',available:'Available',busy:'Busy',ready:'Ready on date',selectDate:'Select ready date',done:'Done',language:'Language',appearance:'Appearance',dark:'Dark',light:'Light',install:'Install app',installed:'Installed',installReady:'Install NOSMO Work on this device.',installUnavailable:'Install becomes available when the browser confirms PWA eligibility.',ask:'Ask Nexus',menu:'Menu',myCv:'My CV',certificates:'Certificates',references:'References',findWork:'Find Work',matches:'Matches',agencies:'Agencies',inbox:'Inbox',settings:'Settings',search:'Search',apply:'Apply',save:'Save',jobs:'Jobs',applications:'Applications',original:'Original source / Open page',profile:'Profile',currentLanguage:'Current language'},
    pl:{person:'Profil',documents:'Dokumenty',work:'Praca',workMode:'Tryb pracy',availability:'Dostępność',available:'Dostępny',busy:'Zajęty',ready:'Gotowy od daty',selectDate:'Wybierz datę gotowości',done:'Gotowe',language:'Język',appearance:'Wygląd',dark:'Ciemny',light:'Jasny',install:'Zainstaluj aplikację',installed:'Zainstalowana',installReady:'Zainstaluj NOSMO Work na tym urządzeniu.',installUnavailable:'Instalacja pojawi się, gdy przeglądarka potwierdzi gotowość PWA.',ask:'Zapytaj Nexus',menu:'Menu',myCv:'Moje CV',certificates:'Certyfikaty',references:'Referencje',findWork:'Znajdź pracę',matches:'Dopasowania',agencies:'Agencje',inbox:'Wiadomości',settings:'Ustawienia',search:'Szukaj',apply:'Aplikuj',save:'Zapisz',jobs:'Oferty',applications:'Aplikacje',original:'Otwórz oryginalną ofertę',profile:'Profil',currentLanguage:'Aktualny język'},
    ro:{person:'Profil',documents:'Documente',work:'Muncă',workMode:'Mod de lucru',availability:'Disponibilitate',available:'Disponibil',busy:'Ocupat',ready:'Disponibil de la data',selectDate:'Alege data',done:'Gata',language:'Limbă',appearance:'Aspect',dark:'Întunecat',light:'Luminos',install:'Instalează aplicația',installed:'Instalată',ask:'Întreabă Nexus',menu:'Meniu',myCv:'CV-ul meu',certificates:'Certificate',references:'Referințe',findWork:'Caută lucru',matches:'Potriviri',agencies:'Agenții',inbox:'Mesaje',settings:'Setări',search:'Caută',apply:'Aplică',save:'Salvează',jobs:'Locuri de muncă',applications:'Aplicații',profile:'Profil'},
    ur:{person:'پروفائل',documents:'دستاویزات',work:'کام',workMode:'ورک موڈ',availability:'دستیابی',available:'دستیاب',busy:'مصروف',ready:'تاریخ سے تیار',selectDate:'تاریخ منتخب کریں',done:'مکمل',language:'زبان',appearance:'ظاہری شکل',dark:'ڈارک',light:'لائٹ',install:'ایپ انسٹال کریں',installed:'انسٹال شدہ',ask:'Nexus سے پوچھیں',menu:'مینو',myCv:'میرا CV',certificates:'سرٹیفکیٹس',references:'حوالہ جات',findWork:'کام تلاش کریں',matches:'میچز',agencies:'ایجنسیاں',inbox:'پیغامات',settings:'سیٹنگز',search:'تلاش',apply:'درخواست دیں',save:'محفوظ کریں',jobs:'نوکریاں',applications:'درخواستیں',profile:'پروفائل'},
    pa:{person:'ਪ੍ਰੋਫਾਈਲ',documents:'ਦਸਤਾਵੇਜ਼',work:'ਕੰਮ',workMode:'ਵਰਕ ਮੋਡ',availability:'ਉਪਲਬਧਤਾ',available:'ਉਪਲਬਧ',busy:'ਵਿਆਸਤ',ready:'ਤਾਰੀਖ ਤੋਂ ਤਿਆਰ',selectDate:'ਤਾਰੀਖ ਚੁਣੋ',done:'ਹੋ ਗਿਆ',language:'ਭਾਸ਼ਾ',appearance:'ਦਿੱਖ',dark:'ਡਾਰਕ',light:'ਲਾਈਟ',install:'ਐਪ ਇੰਸਟਾਲ ਕਰੋ',installed:'ਇੰਸਟਾਲ',ask:'Nexus ਨੂੰ ਪੁੱਛੋ',menu:'ਮੇਨੂ',myCv:'ਮੇਰਾ CV',certificates:'ਸਰਟੀਫਿਕੇਟ',references:'ਹਵਾਲੇ',findWork:'ਕੰਮ ਲੱਭੋ',matches:'ਮੈਚ',agencies:'ਏਜੰਸੀਆਂ',inbox:'ਸੁਨੇਹੇ',settings:'ਸੈਟਿੰਗਾਂ',search:'ਖੋਜ',apply:'ਅਪਲਾਈ',save:'ਸੇਵ',jobs:'ਨੌਕਰੀਆਂ',applications:'ਅਰਜ਼ੀਆਂ',profile:'ਪ੍ਰੋਫਾਈਲ'},
    bn:{person:'প্রোফাইল',documents:'ডকুমেন্ট',work:'কাজ',workMode:'ওয়ার্ক মোড',availability:'উপলভ্যতা',available:'উপলভ্য',busy:'ব্যস্ত',ready:'তারিখ থেকে প্রস্তুত',selectDate:'তারিখ বেছে নিন',done:'সম্পন্ন',language:'ভাষা',appearance:'চেহারা',dark:'ডার্ক',light:'লাইট',install:'অ্যাপ ইনস্টল করুন',installed:'ইনস্টল হয়েছে',ask:'Nexus-কে জিজ্ঞাসা করুন',menu:'মেনু',myCv:'আমার CV',certificates:'সার্টিফিকেট',references:'রেফারেন্স',findWork:'কাজ খুঁজুন',matches:'ম্যাচ',agencies:'এজেন্সি',inbox:'বার্তা',settings:'সেটিংস',search:'খুঁজুন',apply:'আবেদন',save:'সেভ',jobs:'চাকরি',applications:'আবেদনসমূহ',profile:'প্রোফাইল'},
    gu:{person:'પ્રોફાઇલ',documents:'દસ્તાવેજો',work:'કામ',workMode:'વર્ક મોડ',availability:'ઉપલબ્ધતા',available:'ઉપલબ્ધ',busy:'વ્યસ્ત',ready:'તારીખથી તૈયાર',selectDate:'તારીખ પસંદ કરો',done:'પૂર્ણ',language:'ભાષા',appearance:'દેખાવ',dark:'ડાર્ક',light:'લાઇટ',install:'એપ ઇન્સ્ટોલ કરો',installed:'ઇન્સ્ટોલ',ask:'Nexus ને પૂછો',menu:'મેનુ',myCv:'મારું CV',certificates:'પ્રમાણપત્રો',references:'સંદર્ભો',findWork:'કામ શોધો',matches:'મેચ',agencies:'એજન્સીઓ',inbox:'સંદેશા',settings:'સેટિંગ્સ',search:'શોધો',apply:'અરજી કરો',save:'સાચવો',jobs:'નોકરીઓ',applications:'અરજીઓ',profile:'પ્રોફાઇલ'},
    ar:{person:'الملف',documents:'المستندات',work:'العمل',workMode:'وضع العمل',availability:'التوفر',available:'متاح',busy:'مشغول',ready:'جاهز من تاريخ',selectDate:'اختر التاريخ',done:'تم',language:'اللغة',appearance:'المظهر',dark:'داكن',light:'فاتح',install:'تثبيت التطبيق',installed:'مثبت',ask:'اسأل Nexus',menu:'القائمة',myCv:'سيرتي الذاتية',certificates:'الشهادات',references:'المراجع',findWork:'ابحث عن عمل',matches:'المطابقات',agencies:'الوكالات',inbox:'الرسائل',settings:'الإعدادات',search:'بحث',apply:'تقدم',save:'حفظ',jobs:'الوظائف',applications:'الطلبات',profile:'الملف'},
    pt:{person:'Perfil',documents:'Documentos',work:'Trabalho',workMode:'Modo Trabalho',availability:'Disponibilidade',available:'Disponível',busy:'Ocupado',ready:'Disponível a partir de',selectDate:'Selecionar data',done:'Concluído',language:'Idioma',appearance:'Aparência',dark:'Escuro',light:'Claro',install:'Instalar aplicação',installed:'Instalada',ask:'Perguntar ao Nexus',menu:'Menu',myCv:'O meu CV',certificates:'Certificados',references:'Referências',findWork:'Procurar trabalho',matches:'Correspondências',agencies:'Agências',inbox:'Mensagens',settings:'Definições',search:'Pesquisar',apply:'Candidatar',save:'Guardar',jobs:'Empregos',applications:'Candidaturas',profile:'Perfil'},
    es:{person:'Perfil',documents:'Documentos',work:'Trabajo',workMode:'Modo Trabajo',availability:'Disponibilidad',available:'Disponible',busy:'Ocupado',ready:'Disponible desde fecha',selectDate:'Seleccionar fecha',done:'Listo',language:'Idioma',appearance:'Apariencia',dark:'Oscuro',light:'Claro',install:'Instalar app',installed:'Instalada',ask:'Preguntar a Nexus',menu:'Menú',myCv:'Mi CV',certificates:'Certificados',references:'Referencias',findWork:'Buscar trabajo',matches:'Coincidencias',agencies:'Agencias',inbox:'Mensajes',settings:'Ajustes',search:'Buscar',apply:'Solicitar',save:'Guardar',jobs:'Empleos',applications:'Solicitudes',profile:'Perfil'},
    fr:{person:'Profil',documents:'Documents',work:'Travail',workMode:'Mode Travail',availability:'Disponibilité',available:'Disponible',busy:'Occupé',ready:'Disponible à partir du',selectDate:'Choisir la date',done:'Terminé',language:'Langue',appearance:'Apparence',dark:'Sombre',light:'Clair',install:'Installer l’app',installed:'Installée',ask:'Demander à Nexus',menu:'Menu',myCv:'Mon CV',certificates:'Certificats',references:'Références',findWork:'Trouver du travail',matches:'Correspondances',agencies:'Agences',inbox:'Messages',settings:'Paramètres',search:'Rechercher',apply:'Postuler',save:'Enregistrer',jobs:'Emplois',applications:'Candidatures',profile:'Profil'},
    lt:{person:'Profilis',documents:'Dokumentai',work:'Darbas',workMode:'Darbo režimas',availability:'Užimtumas',available:'Laisvas',busy:'Užimtas',ready:'Laisvas nuo datos',selectDate:'Pasirinkti datą',done:'Baigta',language:'Kalba',appearance:'Išvaizda',dark:'Tamsi',light:'Šviesi',install:'Įdiegti programėlę',installed:'Įdiegta',ask:'Klausti Nexus',menu:'Meniu',myCv:'Mano CV',certificates:'Sertifikatai',references:'Rekomendacijos',findWork:'Rasti darbą',matches:'Atitikmenys',agencies:'Agentūros',inbox:'Žinutės',settings:'Nustatymai',search:'Ieškoti',apply:'Kandidatuoti',save:'Išsaugoti',jobs:'Darbai',applications:'Paraiškos',profile:'Profilis'},
    bg:{person:'Профил',documents:'Документи',work:'Работа',workMode:'Работен режим',availability:'Наличност',available:'Свободен',busy:'Зает',ready:'Свободен от дата',selectDate:'Избери дата',done:'Готово',language:'Език',appearance:'Изглед',dark:'Тъмен',light:'Светъл',install:'Инсталирай приложението',installed:'Инсталирано',ask:'Попитай Nexus',menu:'Меню',myCv:'Моето CV',certificates:'Сертификати',references:'Препоръки',findWork:'Намери работа',matches:'Съвпадения',agencies:'Агенции',inbox:'Съобщения',settings:'Настройки',search:'Търси',apply:'Кандидатствай',save:'Запази',jobs:'Работа',applications:'Кандидатури',profile:'Профил'},
    uk:{person:'Профіль',documents:'Документи',work:'Робота',workMode:'Робочий режим',availability:'Доступність',available:'Доступний',busy:'Зайнятий',ready:'Готовий з дати',selectDate:'Виберіть дату',done:'Готово',language:'Мова',appearance:'Вигляд',dark:'Темна',light:'Світла',install:'Встановити застосунок',installed:'Встановлено',ask:'Запитати Nexus',menu:'Меню',myCv:'Моє CV',certificates:'Сертифікати',references:'Рекомендації',findWork:'Знайти роботу',matches:'Збіги',agencies:'Агенції',inbox:'Повідомлення',settings:'Налаштування',search:'Пошук',apply:'Подати заявку',save:'Зберегти',jobs:'Вакансії',applications:'Заявки',profile:'Профіль'},
    zh:{person:'个人资料',documents:'文件',work:'工作',workMode:'工作模式',availability:'可用状态',available:'可工作',busy:'忙碌',ready:'指定日期可工作',selectDate:'选择日期',done:'完成',language:'语言',appearance:'外观',dark:'深色',light:'浅色',install:'安装应用',installed:'已安装',ask:'询问 Nexus',menu:'菜单',myCv:'我的简历',certificates:'证书',references:'推荐人',findWork:'找工作',matches:'匹配',agencies:'中介',inbox:'消息',settings:'设置',search:'搜索',apply:'申请',save:'保存',jobs:'职位',applications:'申请记录',profile:'个人资料'},
    tr:{person:'Profil',documents:'Belgeler',work:'İş',workMode:'İş Modu',availability:'Uygunluk',available:'Müsait',busy:'Meşgul',ready:'Tarihten itibaren hazır',selectDate:'Tarih seç',done:'Tamam',language:'Dil',appearance:'Görünüm',dark:'Koyu',light:'Açık',install:'Uygulamayı yükle',installed:'Yüklendi',ask:'Nexus’a sor',menu:'Menü',myCv:'CV’m',certificates:'Sertifikalar',references:'Referanslar',findWork:'İş bul',matches:'Eşleşmeler',agencies:'Ajanslar',inbox:'Mesajlar',settings:'Ayarlar',search:'Ara',apply:'Başvur',save:'Kaydet',jobs:'İşler',applications:'Başvurular',profile:'Profil'},
    it:{person:'Profilo',documents:'Documenti',work:'Lavoro',workMode:'Modalità Lavoro',availability:'Disponibilità',available:'Disponibile',busy:'Occupato',ready:'Disponibile dalla data',selectDate:'Seleziona data',done:'Fatto',language:'Lingua',appearance:'Aspetto',dark:'Scuro',light:'Chiaro',install:'Installa app',installed:'Installata',ask:'Chiedi a Nexus',menu:'Menu',myCv:'Il mio CV',certificates:'Certificati',references:'Referenze',findWork:'Trova lavoro',matches:'Corrispondenze',agencies:'Agenzie',inbox:'Messaggi',settings:'Impostazioni',search:'Cerca',apply:'Candidati',save:'Salva',jobs:'Lavori',applications:'Candidature',profile:'Profilo'}
  };
  const fallback=T.en;
  const get=(key)=>{const lang=localStorage.getItem(KEYS.lang)||'en';return (T[lang]&&T[lang][key])||fallback[key]||key};
  const safeJson=(value,fallbackValue)=>{try{return JSON.parse(value)||fallbackValue}catch(_){return fallbackValue}};
  const langInfo=()=>LANGS.find(x=>x[0]===(localStorage.getItem(KEYS.lang)||'en'))||LANGS[0];

  function applyTheme(theme){
    const next=theme==='light'?'light':'dark';
    ROOT.dataset.workTheme=next;
    localStorage.setItem(KEYS.theme,next);
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.content=next==='light'?'#f9fafc':'#000000';
    document.querySelectorAll('[data-work-theme-label]').forEach(el=>el.textContent=next==='dark'?get('light'):get('dark'));
  }
  function toggleTheme(){applyTheme((ROOT.dataset.workTheme||'dark')==='dark'?'light':'dark')}

  const exactKeys={
    'Person':'person','Documents':'documents','Work':'work','Work Mode':'workMode','Availability':'availability','Available':'available','Available now':'available','Busy':'busy','Ready on date':'ready',
    'My CV':'myCv','Certificates':'certificates','References':'references','Find Work':'findWork','Matches':'matches','Agencies':'agencies','Inbox':'inbox','Messages':'inbox','Settings':'settings','Search':'search','Jobs':'jobs','Applications':'applications','Profile':'profile',
    'Original source / Open page':'original','Ask Nexus':'ask'
  };
  function translateExact(root=document){
    const lang=localStorage.getItem(KEYS.lang)||'en';
    document.documentElement.lang=lang==='uk'?'uk':lang;
    document.documentElement.dir=['ar','ur'].includes(lang)?'rtl':'ltr';
    root.querySelectorAll('[data-i18n]').forEach(el=>{const key=el.dataset.i18n,value=get(key);if(value&&el.textContent!==value)el.textContent=value});
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
      if(!node.parentElement||['SCRIPT','STYLE','TEXTAREA','INPUT','OPTION'].includes(node.parentElement.tagName))return NodeFilter.FILTER_REJECT;
      const text=node.nodeValue.trim();return exactKeys[text]?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
    }});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{const raw=node.nodeValue,trim=raw.trim(),key=exactKeys[trim];node.nodeValue=raw.replace(trim,get(key))});
    document.querySelectorAll('#availabilityState,#availability').forEach(select=>{
      Array.from(select.options).forEach(opt=>{const value=opt.value==='available'?get('available'):(opt.value==='busy'||opt.value==='not-looking')?get('busy'):opt.value==='from-date'?get('ready'):null;if(value&&opt.textContent!==value)opt.textContent=value});
    });
  }
  function setLanguage(lang){
    if(!LANGS.some(x=>x[0]===lang))lang='en';
    localStorage.setItem(KEYS.lang,lang);
    translateExact();
    const info=langInfo();
    document.querySelectorAll('.workLangButton').forEach(btn=>{btn.textContent=info[1];btn.title=get('currentLanguage')+': '+info[2];btn.setAttribute('aria-label',get('language')+': '+info[2])});
    document.querySelectorAll('.workLanguageOption').forEach(btn=>btn.setAttribute('aria-current',String(btn.dataset.lang===lang)));
    document.querySelectorAll('[data-work-language-title]').forEach(el=>el.textContent=get('language'));
    document.querySelectorAll('[data-work-theme-label]').forEach(el=>el.textContent=(ROOT.dataset.workTheme||'dark')==='dark'?get('light'):get('dark'));
    renderAvailabilityCompact();
  }

  let deferredInstallPrompt=null;
  const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  function updateInstallUi(){
    const buttons=[document.getElementById('workInstallButton'),document.getElementById('settingsInstallButton')].filter(Boolean);
    const states=[document.getElementById('workInstallState'),document.getElementById('settingsInstallState')].filter(Boolean);
    const lang=localStorage.getItem(KEYS.lang)||'en';
    const installed=standalone();
    const status=installed?get('installed'):(deferredInstallPrompt?(T[lang]?.installReady||fallback.installReady):(T[lang]?.installUnavailable||fallback.installUnavailable));
    buttons.forEach(btn=>{btn.hidden=installed||!deferredInstallPrompt;btn.textContent=get('install')});
    states.forEach(state=>state.textContent=status);
  }
  async function installApp(){
    if(!deferredInstallPrompt)return;
    const prompt=deferredInstallPrompt;deferredInstallPrompt=null;
    prompt.prompt();
    try{await prompt.userChoice}catch(_){}
    updateInstallUi();
  }

  function createControls(){
    if(document.querySelector('.workLangButton'))return;
    const top=document.querySelector('.top');if(!top)return;
    const info=langInfo();
    const langBtn=document.createElement('button');langBtn.type='button';langBtn.className='workLangButton';langBtn.textContent=info[1];langBtn.setAttribute('aria-haspopup','dialog');
    const menuBtn=document.getElementById('menuBtn');
    const ghost=top.querySelector('.topGhost');
    if(ghost)ghost.replaceWith(langBtn);else if(menuBtn)top.insertBefore(langBtn,menuBtn);else top.appendChild(langBtn);
    const pop=document.createElement('div');pop.className='workControlPopover';pop.id='workControlPopover';pop.setAttribute('role','dialog');pop.setAttribute('aria-label','NOSMO Work settings');
    pop.innerHTML='<div class="workControlTitle" data-work-language-title>'+get('language')+'</div><div class="workLanguageList">'+LANGS.map(([code,flag,name])=>'<button type="button" class="workLanguageOption" data-lang="'+code+'"><span>'+flag+'</span><span>'+name+'</span></button>').join('')+'</div><div class="workControlRow"><button type="button" id="workThemeButton"><span data-work-theme-label>'+((ROOT.dataset.workTheme||'dark')==='dark'?get('light'):get('dark'))+'</span></button><button type="button" id="workInstallButton" hidden>'+get('install')+'</button></div><div class="workInstallState" id="workInstallState"></div>';
    document.body.appendChild(pop);
    langBtn.addEventListener('click',e=>{e.stopPropagation();pop.classList.toggle('open')});
    pop.addEventListener('click',e=>e.stopPropagation());
    document.addEventListener('click',()=>pop.classList.remove('open'));
    pop.querySelectorAll('.workLanguageOption').forEach(btn=>btn.addEventListener('click',()=>setLanguage(btn.dataset.lang)));
    pop.querySelector('#workThemeButton')?.addEventListener('click',toggleTheme);
    pop.querySelector('#workInstallButton')?.addEventListener('click',installApp);
    document.getElementById('settingsInstallButton')?.addEventListener('click',installApp);
    setLanguage(localStorage.getItem(KEYS.lang)||'en');updateInstallUi();
  }

  let availabilitySyncing=false;
  function currentAvailability(){
    const stored=safeJson(localStorage.getItem(KEYS.availability),{});
    let state=stored.state||stored.status||'';let date=stored.date||stored.availableFrom||'';
    if(!state){
      const select=document.querySelector('#availabilityState,#availability');state=select?.value||'available';
      const dateInput=document.querySelector('#availabilityDate,#availableFrom');date=dateInput?.value||'';
    }
    if(state==='not-looking')state='busy';
    if(!['available','busy','from-date'].includes(state))state='available';
    return {state,date};
  }
  function saveAvailability(next){
    if(availabilitySyncing)return;
    availabilitySyncing=true;
    try{
      const value={state:next.state,date:next.state==='from-date'?(next.date||''):''};
    localStorage.setItem(KEYS.availability,JSON.stringify(value));
    document.querySelectorAll('#availabilityState,#availability').forEach(select=>{ensureAvailabilityOptions(select);select.value=value.state;select.dispatchEvent(new Event('change',{bubbles:true}))});
    document.querySelectorAll('#availabilityDate,#availableFrom').forEach(input=>{input.value=value.date;input.dispatchEvent(new Event('change',{bubbles:true}))});
    const personId=window.NEXUS_WORK_PROFILE?.personId||new URLSearchParams(location.search).get('draft');
    if(personId){
      const legacyKey='nexus-work-availability:'+personId;
      const legacy=safeJson(localStorage.getItem(legacyKey),{});
      localStorage.setItem(legacyKey,JSON.stringify(Object.assign({},legacy,{status:value.state,availableFrom:value.date,label:value.state==='busy'?'Busy':value.state==='from-date'?'Ready on date':'Available'})));
    }
    window.dispatchEvent(new CustomEvent('nosmo:availability-change',{detail:value}));
      renderAvailabilityCompact();syncAvailabilityFields();
    } finally { availabilitySyncing=false; }
  }
  function availabilityLabel(value=currentAvailability()){
    if(value.state==='busy')return get('busy');
    if(value.state==='from-date')return value.date?get('ready')+' · '+value.date:get('ready');
    return get('available');
  }
  function ensureAvailabilityOptions(select){
    if(!select)return;
    const previous=select.value==='not-looking'?'busy':select.value;
    select.innerHTML='<option value="available">'+get('available')+'</option><option value="busy">'+get('busy')+'</option><option value="from-date">'+get('ready')+'</option>';
    select.value=['available','busy','from-date'].includes(previous)?previous:'available';
  }
  function syncAvailabilityFields(){
    const current=currentAvailability();
    document.querySelectorAll('#availabilityState,#availability').forEach(select=>{ensureAvailabilityOptions(select);select.value=current.state});
    document.querySelectorAll('#availabilityDate,#availableFrom').forEach(input=>{
      input.value=current.date||'';
      const container=input.closest('label,.workChip,.formField');
      if(container)container.style.display=current.state==='from-date'?'':'none';
    });
    const labels=document.querySelectorAll('#workAvailabilityLabel');labels.forEach(el=>el.textContent=availabilityLabel(current));
  }
  function renderAvailabilityCompact(){
    const current=currentAvailability();
    let btn=document.getElementById('workAvailabilityCompact');
    if(!btn){
      const legacyStatus=document.querySelector('.status');
      const first=legacyStatus?.firstElementChild;
      btn=document.createElement('button');btn.type='button';btn.id='workAvailabilityCompact';btn.className='workAvailabilityCompact';
      if(first)first.replaceWith(btn);else{
        const hero=document.querySelector('.hero,.workCardPanel');
        if(hero)hero.insertAdjacentElement('afterbegin',btn);else return;
      }
      btn.addEventListener('click',openAvailabilitySheet);
    }
    btn.dataset.state=current.state;btn.innerHTML='<span class="workStatusLed"></span><span>'+availabilityLabel(current)+'</span>';
  }
  function openAvailabilitySheet(){
    let sheet=document.getElementById('workAvailabilitySheet');
    if(!sheet){
      sheet=document.createElement('div');sheet.id='workAvailabilitySheet';sheet.className='workAvailabilitySheet';sheet.innerHTML='<div class="workAvailabilityPanel" role="dialog" aria-modal="true"><h3>'+get('availability')+'</h3><div class="workAvailabilityChoices"><button type="button" class="workAvailabilityChoice" data-state="available"><span class="workStatusLed"></span><span>'+get('available')+'</span></button><button type="button" class="workAvailabilityChoice" data-state="busy"><span class="workStatusLed"></span><span>'+get('busy')+'</span></button><button type="button" class="workAvailabilityChoice" data-state="from-date"><span class="workStatusLed"></span><span>'+get('ready')+'</span></button></div><div class="workReadyDate"><label>'+get('selectDate')+'</label><input type="date" id="workReadyDateInput"></div><button class="workAvailabilityDone" type="button">'+get('done')+'</button></div>';
      document.body.appendChild(sheet);
      sheet.addEventListener('click',e=>{if(e.target===sheet)sheet.classList.remove('open')});
      sheet.querySelectorAll('.workAvailabilityChoice').forEach(choice=>choice.addEventListener('click',()=>{
        sheet.dataset.pendingState=choice.dataset.state;
        sheet.querySelector('.workReadyDate').classList.toggle('visible',choice.dataset.state==='from-date');
      }));
      sheet.querySelector('.workAvailabilityDone').addEventListener('click',()=>{
        const state=sheet.dataset.pendingState||currentAvailability().state;
        const date=sheet.querySelector('#workReadyDateInput').value;
        if(state==='from-date'&&!date){sheet.querySelector('#workReadyDateInput').focus();return}
        saveAvailability({state,date});sheet.classList.remove('open');
      });
    }
    const current=currentAvailability();sheet.dataset.pendingState=current.state;sheet.querySelector('#workReadyDateInput').value=current.date||'';sheet.querySelector('.workReadyDate').classList.toggle('visible',current.state==='from-date');sheet.classList.add('open');
  }
  function bindLegacyAvailability(){
    document.querySelectorAll('#availabilityState,#availability').forEach(select=>{
      ensureAvailabilityOptions(select);
      select.addEventListener('change',()=>{const date=document.querySelector(select.id==='availability'?'#availableFrom':'#availabilityDate')?.value||'';saveAvailability({state:select.value,date})});
    });
    document.querySelectorAll('#availabilityDate,#availableFrom').forEach(input=>input.addEventListener('change',()=>{const state=document.querySelector(input.id==='availableFrom'?'#availability':'#availabilityState')?.value||currentAvailability().state;saveAvailability({state,date:input.value})}));
    syncAvailabilityFields();renderAvailabilityCompact();
  }

  function persistJobSearch(){
    const ids=['jobSearchInput','jobStatusFilter','constructionTradeFilter'];
    const state=safeJson(localStorage.getItem(KEYS.jobSearch),{});
    ids.forEach(id=>{const el=document.getElementById(id);if(!el)return;if(state[id]!=null)el.value=state[id];el.addEventListener(el.tagName==='INPUT'?'input':'change',()=>{
      const next=safeJson(localStorage.getItem(KEYS.jobSearch),{});next[id]=el.value;localStorage.setItem(KEYS.jobSearch,JSON.stringify(next));
    })});
    setTimeout(()=>ids.forEach(id=>{const el=document.getElementById(id);if(el&&state[id]!=null)el.dispatchEvent(new Event(el.tagName==='INPUT'?'input':'change',{bubbles:true}))}),0);
  }

  function bindAskNexus(){
    const brand=document.querySelector('.top .brand');if(!brand)return;
    brand.tabIndex=0;brand.setAttribute('role','button');brand.setAttribute('aria-label',get('ask'));brand.title=get('ask');
    const open=()=>{
      if(location.pathname.endsWith('/index.html')||!location.pathname.split('/').pop()){
        if(typeof window.NEXUS_OPEN_WORK_PANEL==='function')window.NEXUS_OPEN_WORK_PANEL('ai');
        else document.querySelector('[data-work-action="ai"]')?.click();
        const title=document.getElementById('workTitle');if(title)title.textContent=get('ask');
      }else location.href='./index.html#ask-nexus';
    };
    brand.addEventListener('click',open);brand.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});
    if(location.hash==='#ask-nexus')setTimeout(open,100);
  }

  function registerPwa(){
    if(!document.querySelector('link[rel="manifest"]')){const link=document.createElement('link');link.rel='manifest';link.href='./manifest.webmanifest';document.head.appendChild(link)}
    window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstallPrompt=event;updateInstallUi()});
    window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;updateInstallUi()});
    if('serviceWorker'in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){
      navigator.serviceWorker.register('./sw.js',{scope:'./'}).then(reg=>{
        reg.update().catch(()=>{});
        reg.addEventListener('updatefound',()=>{const worker=reg.installing;if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)worker.postMessage({type:'SKIP_WAITING'})})});
      }).catch(()=>{});
      let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)return;reloading=true;location.reload()});
    }
  }

  function init(){
    applyTheme(localStorage.getItem(KEYS.theme)||((window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches)?'light':'dark'));
    createControls();bindLegacyAvailability();persistJobSearch();bindAskNexus();translateExact();registerPwa();
    const observer=new MutationObserver(mutations=>{if(mutations.some(m=>m.addedNodes.length))translateExact()});
    observer.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
