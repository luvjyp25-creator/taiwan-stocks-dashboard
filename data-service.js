/**
 * 台股雷達 — Data Service
 * Priority: FinMind → TWSE → Mock Data
 */
const DataService = (() => {
  const FINMIND_URL = 'https://api.finmindtrade.com/api/v4/data';
  const TWSE_URL    = 'https://opendata.twse.com.tw/v1';
  const CACHE_TTL   = 15 * 60 * 1000; // 15 min

  // ── Storage ─────────────────────────────────────────────────────────────
  const getToken    = ()  => localStorage.getItem('finmind_token') || '';
  const setToken    = t   => localStorage.setItem('finmind_token', t);
  const clearToken  = ()  => localStorage.removeItem('finmind_token');
  const useTWSE     = ()  => localStorage.getItem('use_twse') !== 'false';
  const setUseTWSE  = v   => localStorage.setItem('use_twse', v);

  function getCache(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL) return null;
      return data;
    } catch { return null; }
  }
  function setCache(key, data) {
    try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
  }
  function clearCache() { sessionStorage.clear(); }

  // ── Date helpers ─────────────────────────────────────────────────────────
  function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  }

  // ── Candidate stocks (used for daily screening) ──────────────────────────
  const CANDIDATES = [
    { code:'2330', name:'台積電',     sector:'半導體'    }, { code:'2317', name:'鴻海',      sector:'電子製造'  },
    { code:'2454', name:'聯發科',     sector:'半導體'    }, { code:'2382', name:'廣達',      sector:'電子製造'  },
    { code:'2308', name:'台達電',     sector:'電子零組件'}, { code:'2303', name:'聯電',      sector:'半導體'    },
    { code:'3034', name:'聯詠',       sector:'半導體'    }, { code:'2379', name:'瑞昱',      sector:'半導體'    },
    { code:'3008', name:'大立光',     sector:'電子零組件'}, { code:'2395', name:'研華',      sector:'電子零組件'},
    { code:'3443', name:'創意',       sector:'半導體'    }, { code:'2881', name:'富邦金',    sector:'金融'      },
    { code:'2882', name:'國泰金',     sector:'金融'      }, { code:'2886', name:'兆豐金',    sector:'金融'      },
    { code:'2884', name:'玉山金',     sector:'金融'      }, { code:'2891', name:'中信金',    sector:'金融'      },
    { code:'2412', name:'中華電',     sector:'電信'      }, { code:'3045', name:'台灣大',    sector:'電信'      },
    { code:'2002', name:'中鋼',       sector:'鋼鐵石化'  }, { code:'1301', name:'台塑',      sector:'鋼鐵石化'  },
    { code:'1303', name:'南亞',       sector:'鋼鐵石化'  }, { code:'6505', name:'台塑化',    sector:'鋼鐵石化'  },
    { code:'3711', name:'日月光投控', sector:'半導體'    }, { code:'3231', name:'緯創',      sector:'電子製造'  },
    { code:'2356', name:'英業達',     sector:'電子製造'  }, { code:'2324', name:'仁寶',      sector:'電子製造'  },
    { code:'6415', name:'矽力-KY',    sector:'半導體'    }, { code:'2474', name:'可成',      sector:'電子零組件'},
    { code:'2207', name:'和泰車',     sector:'汽車'      }, { code:'2201', name:'裕隆',      sector:'汽車'      },
    // 31–50
    { code:'2357', name:'華碩',       sector:'電腦周邊'  }, { code:'2353', name:'宏碁',      sector:'電腦周邊'  },
    { code:'2377', name:'微星',       sector:'電腦周邊'  }, { code:'2376', name:'技嘉',      sector:'電腦周邊'  },
    { code:'6669', name:'緯穎',       sector:'電子製造'  }, { code:'3017', name:'奇鋐',      sector:'電子零組件'},
    { code:'2059', name:'川湖',       sector:'電子零組件'}, { code:'2301', name:'光寶科',    sector:'電子製造'  },
    { code:'2408', name:'南亞科',     sector:'半導體'    }, { code:'6770', name:'力積電',    sector:'半導體'    },
    { code:'3661', name:'世芯-KY',    sector:'半導體'    }, { code:'3037', name:'欣興',      sector:'電子零組件'},
    { code:'2885', name:'元大金',     sector:'金融'      }, { code:'5880', name:'合庫金',    sector:'金融'      },
    { code:'2892', name:'第一金',     sector:'金融'      }, { code:'2890', name:'永豐金',    sector:'金融'      },
    { code:'2880', name:'華南金',     sector:'金融'      }, { code:'4904', name:'遠傳',      sector:'電信'      },
    { code:'1216', name:'統一',       sector:'食品'      }, { code:'1101', name:'台泥',      sector:'水泥'      },
  ];

  // ── Extended local stock list for offline name search ────────────────────
  // Used as fallback when TWSE live data is unavailable (weekends / API down)
  const STOCK_LIST = [
    ...CANDIDATES,
    // Semiconductors
    { code:'3481', name:'群創光電', sector:'電子零組件' }, { code:'2409', name:'友達',      sector:'電子零組件' },
    { code:'2408', name:'南亞科',   sector:'半導體'     }, { code:'2344', name:'華邦電',    sector:'半導體'     },
    { code:'2363', name:'矽統',     sector:'半導體'     }, { code:'3592', name:'瑞鼎',      sector:'半導體'     },
    { code:'6770', name:'力積電',   sector:'半導體'     }, { code:'8046', name:'南電',       sector:'電子零組件' },
    { code:'3661', name:'世芯-KY',  sector:'半導體'     }, { code:'3533', name:'嘉澤',      sector:'電子零組件' },
    { code:'2458', name:'義隆',     sector:'半導體'     }, { code:'6274', name:'台燿',      sector:'電子零組件' },
    { code:'4966', name:'譜瑞-KY',  sector:'半導體'     }, { code:'3406', name:'玉晶光',    sector:'電子零組件' },
    { code:'2449', name:'京元電子', sector:'半導體'     }, { code:'6415', name:'矽力-KY',   sector:'半導體'     },
    { code:'3260', name:'威剛',     sector:'半導體'     }, { code:'5483', name:'中美晶',    sector:'半導體'     },
    // Electronics / Computers
    { code:'2357', name:'華碩',     sector:'電腦周邊'   }, { code:'2353', name:'宏碁',      sector:'電腦周邊'   },
    { code:'2377', name:'微星',     sector:'電腦周邊'   }, { code:'2376', name:'技嘉',      sector:'電腦周邊'   },
    { code:'2399', name:'映泰',     sector:'電腦周邊'   }, { code:'2347', name:'聯強',      sector:'電子製造'   },
    { code:'2345', name:'智邦',     sector:'通訊網路'   }, { code:'3704', name:'合勤控',    sector:'通訊網路'   },
    { code:'5388', name:'中磊',     sector:'通訊網路'   }, { code:'4904', name:'遠傳',      sector:'電信'       },
    { code:'3037', name:'欣興',     sector:'電子零組件' }, { code:'2367', name:'燿華',      sector:'電子零組件' },
    { code:'6147', name:'頎邦',     sector:'電子零組件' }, { code:'2337', name:'旺宏',      sector:'半導體'     },
    // Servers / AI
    { code:'2301', name:'光寶科',   sector:'電子製造'   }, { code:'6669', name:'緯穎',      sector:'電子製造'   },
    { code:'3017', name:'奇鋐',     sector:'電子零組件' }, { code:'2059', name:'川湖',      sector:'電子零組件' },
    { code:'6415', name:'矽力-KY',  sector:'半導體'     }, { code:'6803', name:'崇越電通',  sector:'電子製造'   },
    // Finance
    { code:'2885', name:'元大金',   sector:'金融'       }, { code:'5880', name:'合庫金',    sector:'金融'       },
    { code:'2892', name:'第一金',   sector:'金融'       }, { code:'2887', name:'台新金',    sector:'金融'       },
    { code:'2890', name:'永豐金',   sector:'金融'       }, { code:'2801', name:'彰銀',      sector:'金融'       },
    { code:'2834', name:'臺企銀',   sector:'金融'       }, { code:'2823', name:'中壽',      sector:'金融'       },
    { code:'2880', name:'華南金',   sector:'金融'       }, { code:'2883', name:'開發金',    sector:'金融'       },
    // Petrochemical / Material
    { code:'1326', name:'台化',     sector:'鋼鐵石化'   }, { code:'1102', name:'亞泥',      sector:'水泥'       },
    { code:'1101', name:'台泥',     sector:'水泥'       }, { code:'2015', name:'豐興',      sector:'鋼鐵石化'   },
    { code:'1402', name:'遠東新',   sector:'紡織'       }, { code:'9910', name:'豐泰',      sector:'橡膠'       },
    // Consumer / Retail
    { code:'2912', name:'統一超',   sector:'零售'       }, { code:'2882', name:'國泰金',    sector:'金融'       },
    { code:'1216', name:'統一',     sector:'食品'       }, { code:'2105', name:'正新',      sector:'橡膠'       },
    // Auto / Transportation
    { code:'2603', name:'長榮',     sector:'航運'       }, { code:'2609', name:'陽明',      sector:'航運'       },
    { code:'2615', name:'萬海',     sector:'航運'       }, { code:'2610', name:'華航',      sector:'航空'       },
    { code:'2618', name:'長榮航',   sector:'航空'       },
    // ETF
    { code:'0050',  name:'元大台灣50',          sector:'ETF' },
    { code:'0056',  name:'元大高股息',           sector:'ETF' },
    { code:'00878', name:'國泰永續高股息',       sector:'ETF' },
    { code:'00881', name:'國泰台灣5G+',          sector:'ETF' },
    { code:'006208',name:'富邦台50',             sector:'ETF' },
    { code:'00900', name:'富邦特選高股息30',     sector:'ETF' },
    { code:'00905', name:'FT臺灣Smart',          sector:'ETF' },
    { code:'00919', name:'群益台灣精選高息',     sector:'ETF' },
    { code:'00929', name:'復華台灣科技優息',     sector:'ETF' },
  ];

  // ── TWSE: All stocks today ────────────────────────────────────────────────
  async function fetchTWSEAll() {
    const cached = getCache('twse_all');
    if (cached) return cached;

    const res = await fetch(`${TWSE_URL}/exchangeReport/STOCK_DAY_ALL`);
    if (!res.ok) throw new Error(`TWSE HTTP ${res.status}`);
    const raw = await res.json();

    const map = {};
    for (const r of raw) {
      const code = r.Code;
      if (!code) continue;
      const close    = parseFloat((r.ClosingPrice || '').replace(/,/g,'')) || 0;
      const rawChg   = (r.Change || '0').replace(/,/g,'');
      let changeAmt  = 0;
      if      (rawChg.includes('▲')) changeAmt =  parseFloat(rawChg.replace('▲','')) || 0;
      else if (rawChg.includes('▼')) changeAmt = -(parseFloat(rawChg.replace('▼','')) || 0);
      else if (rawChg !== 'X')       changeAmt =  parseFloat(rawChg) || 0;
      const prevClose  = close - changeAmt;
      const changePct  = prevClose > 0 ? (changeAmt / prevClose * 100) : 0;
      map[code] = {
        close, changeAmt, changePct,
        volume : parseFloat((r.TradeVolume  || '').replace(/,/g,'')) || 0,
        high   : parseFloat((r.HighestPrice || '').replace(/,/g,'')) || 0,
        low    : parseFloat((r.LowestPrice  || '').replace(/,/g,'')) || 0,
        open   : parseFloat((r.OpeningPrice || '').replace(/,/g,'')) || 0,
        name   : r.Name || '',
      };
    }
    setCache('twse_all', map);
    return map;
  }

  // ── TWSE: Market index ────────────────────────────────────────────────────
  async function fetchTWSEIndex() {
    const cached = getCache('twse_idx');
    if (cached) return cached;
    const res = await fetch(`${TWSE_URL}/exchangeReport/MI_INDEX`);
    if (!res.ok) return null;
    const raw = await res.json();
    const idx = raw.find(r => r.Index_Name && r.Index_Name.includes('加權'));
    if (!idx) return null;
    const rawChg = (idx.Change || '0').replace(/,/g,'');
    let chgAmt = 0;
    if      (rawChg.includes('▲')) chgAmt =  parseFloat(rawChg.replace('▲','')) || 0;
    else if (rawChg.includes('▼')) chgAmt = -(parseFloat(rawChg.replace('▼','')) || 0);
    const value = parseFloat((idx.ClosingIndex || '').replace(/,/g,'')) || 0;
    const prevVal = value - chgAmt;
    const result = { value, chgAmt, chgPct: prevVal > 0 ? (chgAmt/prevVal*100) : 0 };
    setCache('twse_idx', result);
    return result;
  }

  // ── TWSE: Institutional buy/sell via T86 (all stocks, no token) ─────────────
  async function fetchTWSEInstAll() {
    const cached = getCache('twse_inst');
    if (cached) return cached;

    const map = {}; // { stockCode: [{ name, buy, sell }] }
    const today = new Date();
    for (let i = 0; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const dateStr = d.toISOString().split('T')[0].replace(/-/g, '');
      try {
        const url = `https://www.twse.com.tw/rwd/zh/fund/T86?response=json&date=${dateStr}&selectType=ALLBUT0999`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const json = await res.json();
        if (json.stat !== 'OK' || !Array.isArray(json.data) || json.data.length === 0) continue;

        const fields = json.fields || [];
        const fi = (kw1, kw2) => fields.findIndex(f => f.includes(kw1) && (!kw2 || f.includes(kw2)));
        const fBuyIdx  = fi('外資', '買進');
        const fSellIdx = fi('外資', '賣出');
        const tBuyIdx  = fi('投信', '買進');
        const tSellIdx = fi('投信', '賣出');
        if (fBuyIdx < 0 || tBuyIdx < 0) continue;

        const n = s => parseInt((s || '0').replace(/,/g, '')) || 0;
        for (const row of json.data) {
          const code = (row[0] || '').trim();
          if (!code || !/^\d{4}/.test(code)) continue;
          if (!map[code]) map[code] = [];
          map[code].push(
            { name: '外資及陸資', buy: n(row[fBuyIdx]),  sell: n(row[fSellIdx]) },
            { name: '投信',       buy: n(row[tBuyIdx]),  sell: n(row[tSellIdx]) }
          );
        }
        break; // got data, stop
      } catch {}
    }

    setCache('twse_inst', map);
    return map;
  }

  // ── FinMind: Historical prices ────────────────────────────────────────────
  async function fetchFMPrice(code) {
    const key = `fm_p_${code}`;
    const cached = getCache(key);
    if (cached) return cached;
    const token = getToken();
    if (!token) throw new Error('NO_TOKEN');
    const url = `${FINMIND_URL}?dataset=TaiwanStockPrice&data_id=${code}&start_date=${daysAgo(90)}&token=${encodeURIComponent(token)}`;
    const res  = await fetch(url);
    const json = await res.json();
    if (json.status !== 200) throw new Error(json.msg || 'FinMind API error');
    const data = (json.data || []).sort((a,b) => a.date.localeCompare(b.date));
    setCache(key, data);
    return data;
  }

  // ── FinMind: Institutional buy/sell ──────────────────────────────────────
  async function fetchFMInst(code) {
    const key = `fm_i_${code}`;
    const cached = getCache(key);
    if (cached) return cached;
    const token = getToken();
    if (!token) throw new Error('NO_TOKEN');
    const url = `${FINMIND_URL}?dataset=TaiwanStockInstitutionalInvestorsBuySell&data_id=${code}&start_date=${daysAgo(20)}&token=${encodeURIComponent(token)}`;
    const res  = await fetch(url);
    const json = await res.json();
    if (json.status !== 200) throw new Error(json.msg || 'FinMind API error');
    setCache(key, json.data || []);
    return json.data || [];
  }

  // ── Math helpers ──────────────────────────────────────────────────────────
  function avg(arr) {
    return arr.length ? arr.reduce((a,b) => a+b, 0) / arr.length : 0;
  }

  // ── Entry Score (0–100) ───────────────────────────────────────────────────
  function calcEntryScore(prices, instData, close, volume) {
    if (!prices || prices.length < 25) return null;
    const closes  = prices.map(d => parseFloat(d.close));
    const volumes = prices.map(d => parseFloat(d.Trading_Volume));
    const n = closes.length;

    const ma5   = avg(closes.slice(n - 5));
    const ma20  = avg(closes.slice(n - 20));
    const ma60  = n >= 60 ? avg(closes.slice(n - 60)) : null;
    const v20   = avg(volumes.slice(n - 20));

    const c   = close  || closes[n-1];
    const vol = volume || volumes[n-1];
    const vr  = v20 > 0 ? vol / v20 : 1;

    // Volume (35 pts)
    let volScore = vr >= 3 ? 35 : vr >= 2 ? 28 : vr >= 1.5 ? 20 : vr >= 1.2 ? 12 : 5;

    // Technical (40 pts)
    let techScore = 0;
    if (c > ma5)              techScore += 8;
    if (c > ma20)             techScore += 12;
    if (ma60 && c > ma60)     techScore += 8;
    if (ma5  > ma20)          techScore += 6;
    if (ma60 && ma20 > ma60)  techScore += 6;

    // Institutional (25 pts)
    let instScore = 13; // neutral default
    if (instData && instData.length > 0) {
      instScore = 0;
      const recent = instData.slice(-15);
      const fNet = recent.filter(d => d.name?.includes('外資'))
        .reduce((s,d) => s + (+d.buy - +d.sell), 0);
      const tNet = recent.filter(d => d.name?.includes('投信'))
        .reduce((s,d) => s + (+d.buy - +d.sell), 0);
      if (fNet > 0) instScore += 10;
      if (tNet > 0) instScore += 8;
      if (fNet > 0 && tNet > 0) instScore += 7;
      instScore = Math.min(25, instScore);
    }

    // Risk deduction
    let deduct = 0;
    const ret20d = closes[n-20] > 0 ? (c - closes[n-20]) / closes[n-20] * 100 : 0;
    if (ret20d > 15) deduct -= 5;
    if (vr > 5)      deduct -= 3;

    const support  = Math.round(Math.min(...closes.slice(n - 20)));
    const pressure = Math.round(Math.max(...closes.slice(n - 20)));
    const total = Math.round(Math.min(100, Math.max(0, volScore + techScore + instScore + deduct)));
    return { total, volScore, techScore, instScore, deduct, vr: +vr.toFixed(1), ma5:Math.round(ma5), ma20:Math.round(ma20), ma60:ma60?Math.round(ma60):null, support, pressure };
  }

  // ── Exit Score (0–100) ────────────────────────────────────────────────────
  function calcExitScore(prices, instData, close, volume) {
    if (!prices || prices.length < 25) return null;
    const closes  = prices.map(d => parseFloat(d.close));
    const volumes = prices.map(d => parseFloat(d.Trading_Volume));
    const n = closes.length;

    const ma5  = avg(closes.slice(n - 5));
    const ma20 = avg(closes.slice(n - 20));
    const ma60 = n >= 60 ? avg(closes.slice(n - 60)) : null;
    const v20  = avg(volumes.slice(n - 20));
    const c    = close  || closes[n-1];
    const vol  = volume || volumes[n-1];
    const vr   = v20 > 0 ? vol / v20 : 1;

    // Trend weakness (30)
    let trendScore = 0;
    if (c < ma20)            trendScore += 15;
    if (ma60 && c < ma60)    trendScore += 10;
    if (ma5  < ma20)         trendScore += 5;

    // Institutional (25)
    let instScore = 0;
    if (instData && instData.length > 0) {
      const recent = instData.slice(-15);
      const fNet = recent.filter(d => d.name?.includes('外資'))
        .reduce((s,d) => s + (+d.buy - +d.sell), 0);
      const tNet = recent.filter(d => d.name?.includes('投信'))
        .reduce((s,d) => s + (+d.buy - +d.sell), 0);
      if (fNet < 0) instScore += 15;
      if (tNet < 0) instScore += 10;
      instScore = Math.min(25, instScore);
    }

    // Price-volume risk (25)
    let pvScore = 0;
    const prevClose = closes[n-1];
    if (c < prevClose && vr > 1.5) pvScore += 15;
    const redDays = closes.slice(n-5).filter((cl,i,a) => i > 0 && cl < a[i-1]).length;
    pvScore += Math.min(10, redDays * 3);

    // Stop loss risk (20)
    let stopScore = 0;
    const h60 = Math.max(...closes.slice(Math.max(0,n-60)));
    const drop = h60 > 0 ? (h60 - c) / h60 * 100 : 0;
    if (drop > 5)  stopScore += 10;
    if (drop > 10) stopScore += 5;
    if (drop > 15) stopScore += 5;

    const ma20ref = Math.round(avg(closes.slice(n - 20)));
    const total = Math.round(Math.min(100, trendScore + instScore + pvScore + stopScore));
    return { total, trendScore, instScore, pvScore, stopScore, ma20: ma20ref };
  }

  // ── Tag generators ────────────────────────────────────────────────────────
  function entryTags(sc) {
    const t = [];
    if (sc.vr >= 2)              t.push('放量突破');
    else if (sc.vr >= 1.5)       t.push('量能放大');
    if (sc.techScore >= 30)      t.push('均線多排');
    else if (sc.techScore >= 18) t.push('站上MA20');
    if (sc.instScore >= 20)      t.push('法人大買');
    else if (sc.instScore >= 15) t.push('法人買超');
    if (t.length < 3)            t.push('訊號明確');
    return t.slice(0,3);
  }
  function exitTags(sc) {
    const t = [];
    if (sc.trendScore >= 20)    t.push('跌破MA20');
    else if (sc.trendScore >= 10) t.push('趨勢轉弱');
    if (sc.instScore >= 20)     t.push('法人賣超');
    else if (sc.instScore >= 10) t.push('外資賣超');
    if (sc.pvScore >= 15)       t.push('爆量收黑');
    if (t.length < 3)           t.push('動能轉弱');
    return t.slice(0,3);
  }

  function sigFromScore(score, type) {
    if (type === 'entry') return score >= 78 ? 'green' : score >= 65 ? 'yellow' : 'red';
    return score >= 72 ? 'red' : score >= 55 ? 'yellow' : 'green';
  }

  function fmtPct(n) {
    return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
  }

  // ── TWSE-only fallback score (no price history, but uses real inst data) ─────
  function twseOnlyScore(today, instData) {
    const pct = today.changePct;
    const pBase = pct >= 3 ? 57 : pct >= 1 ? 47 : pct >= 0 ? 40 : 27;
    const xBase = pct <= -3 ? 57 : pct <= -1 ? 47 : pct < 0 ? 40 : 27;

    let eInst = 13, xInst = 0;
    if (instData && instData.length > 0) {
      eInst = 0;
      const fNet = instData.filter(d => d.name?.includes('外資')).reduce((s,d) => s + (+d.buy - +d.sell), 0);
      const tNet = instData.filter(d => d.name?.includes('投信')).reduce((s,d) => s + (+d.buy - +d.sell), 0);
      if (fNet > 0) eInst += 10;
      if (tNet > 0) eInst += 8;
      if (fNet > 0 && tNet > 0) eInst += 7;
      eInst = Math.min(25, eInst);
      if (fNet < 0) xInst += 15;
      if (tNet < 0) xInst += 10;
      xInst = Math.min(25, xInst);
    }

    return {
      entry: { total: Math.round(Math.min(100, pBase + eInst)), volScore: 15, techScore: Math.max(0, pBase - 15), instScore: eInst, deduct: 0, vr: '—', ma5: 0, ma20: 0, ma60: null },
      exit:  { total: Math.round(Math.min(100, xBase + xInst)), trendScore: 20, instScore: xInst, pvScore: 15, stopScore: 10 },
    };
  }

  // ── Main loader ───────────────────────────────────────────────────────────
  async function loadStocks(onProgress) {
    const report = { entry:[], exit:[], index:null, source:'mock', errors:[], warnings:[] };

    // Step 1 – TWSE today prices
    let twseMap = {};
    if (useTWSE()) {
      try {
        twseMap = await fetchTWSEAll();
        report.source = 'twse';
        onProgress?.('TWSE 當日行情載入完成', 20);
      } catch(e) {
        report.errors.push('TWSE 行情: ' + e.message);
        onProgress?.('TWSE 失敗，改用模擬資料', 10);
      }
    }

    // Step 2 – TWSE index
    if (useTWSE()) {
      try { report.index = await fetchTWSEIndex(); } catch {}
    }

    // Step 3 – TWSE institutional data via T86 (free, all stocks, no token)
    let twseInstMap = {};
    try {
      twseInstMap = await fetchTWSEInstAll();
      onProgress?.('三大法人資料載入完成', 40);
    } catch(e) {
      report.warnings.push('T86 法人: ' + e.message);
    }

    // Step 4 – FinMind historical prices (optional, for MA/volume scoring)
    const token = getToken();
    const allScored = [];
    const total = CANDIDATES.length;

    for (let i = 0; i < total; i++) {
      const stock = CANDIDATES[i];
      const today = twseMap[stock.code];
      let close = today?.close     || 0;
      let vol   = today?.volume    || 0;
      let pct   = today?.changePct || 0;
      const name = today?.name || stock.name;

      const inst   = twseInstMap[stock.code] || [];
      let prices   = [];

      if (token) {
        try {
          prices = await fetchFMPrice(stock.code);
          report.source = 'finmind';
          // If TWSE didn't return a price, derive from FinMind history
          if (close === 0 && prices.length >= 2) {
            const last = prices[prices.length - 1];
            const prev = prices[prices.length - 2];
            close = parseFloat(last.close)          || 0;
            vol   = parseFloat(last.Trading_Volume) || 0;
            const prevClose = parseFloat(prev.close) || 0;
            pct   = prevClose > 0 ? (close - prevClose) / prevClose * 100 : 0;
          }
        } catch(e) {
          if (e.message !== 'NO_TOKEN') report.warnings.push(`${stock.code}: ${e.message}`);
        }
      }

      let eScore, xScore;
      if (prices.length >= 25) {
        eScore = calcEntryScore(prices, inst, close, vol);
        xScore = calcExitScore(prices, inst, close, vol);
      } else if (today) {
        const fb = twseOnlyScore(today, inst);
        eScore = fb.entry; xScore = fb.exit;
      } else {
        continue;
      }

      // Liquidity filter: exclude stocks with avg daily volume < 1,000,000 shares (1000 lots)
      const v20check = prices.length >= 20
        ? avg(prices.slice(-20).map(d => parseFloat(d.Trading_Volume) || 0))
        : vol;
      if (v20check > 0 && v20check < 1000000) continue;

      allScored.push({
        code: stock.code, name,
        sector: stock.sector || '',
        close, changePct: pct,
        eScore, xScore,
      });

      onProgress?.(`分析 ${name}（${i+1}/${total}）`, 40 + Math.round(i / total * 55));
    }

    // Rank — return ALL stocks (no slice limit)
    allScored.sort((a,b) => b.eScore.total - a.eScore.total);
    report.entry = allScored.map(s => ({
      name:       s.name,
      code:       s.code,
      sector:     s.sector,
      sig:        sigFromScore(s.eScore.total, 'entry'),
      chg:        fmtPct(s.changePct),
      price:      s.close,
      score:      s.eScore.total,
      support:    s.eScore.support  || (s.eScore.ma20 ? Math.round(s.eScore.ma20 * 0.99) : 0),
      pressure:   s.eScore.pressure || (s.close ? Math.round(s.close * 1.02) : 0),
      tags:       entryTags(s.eScore),
    }));

    allScored.sort((a,b) => b.xScore.total - a.xScore.total);
    report.exit = allScored.map(s => ({
      name:      s.name,
      code:      s.code,
      sector:    s.sector,
      action:    exitAction(s.xScore.total),
      chg:       fmtPct(s.changePct),
      price:     s.close,
      score:     s.xScore.total,
      stopLoss:  s.xScore.ma20 || (s.eScore.ma20 ? Math.round(s.eScore.ma20 * 0.96) : (s.close ? Math.round(s.close * 0.95) : 0)),
      tags:      exitTags(s.xScore),
    }));

    // Persist today's results to history
    saveHistory(report.entry, report.exit);

    onProgress?.('完成', 100);
    return report;
  }

  // ── Exit action (NOT traffic lights) ─────────────────────────────────────
  function exitAction(score) {
    if (score >= 72) return { icon:'🚨', label:'建議立即出場', cls:'urgent' };
    if (score >= 58) return { icon:'⛔', label:'建議出場',    cls:'exit'   };
    return                 { icon:'⚠️', label:'建議減碼',    cls:'reduce' };
  }

  // ── History (localStorage) ────────────────────────────────────────────────
  function todayKey() { return new Date().toISOString().split('T')[0]; }

  function saveHistory(entry, exit) {
    const validEntry = entry.filter(s => s.price > 0);
    const validExit  = exit.filter(s => s.price > 0);
    if (validEntry.length === 0 && validExit.length === 0) return;

    // localStorage backup
    try {
      const key  = todayKey();
      const hist = JSON.parse(localStorage.getItem('stock_history') || '{}');
      hist[key]  = { entry: validEntry, exit: validExit, ts: Date.now(), _v: 2 };
      const keys = Object.keys(hist).sort().reverse().slice(0, 30);
      const out  = {};
      keys.forEach(k => out[k] = hist[k]);
      localStorage.setItem('stock_history', JSON.stringify(out));
    } catch {}

    // Cloud sync (non-blocking)
    cloudSaveHistory(validEntry, validExit);
  }

  function getHistory() {
    try {
      const hist = JSON.parse(localStorage.getItem('stock_history') || '{}');
      // Filter out old-format entries (no _v:2 version marker = potentially mock/wrong prices)
      const filtered = {};
      for (const [k, v] of Object.entries(hist)) {
        if (v && v._v === 2) filtered[k] = v;
      }
      return filtered;
    }
    catch { return {}; }
  }

  // Generate mock history for past N days (demo when no real history)
  function getMockHistory(days = 7) {
    const hist = {};
    const names = ['台積電','鴻海','聯發科','廣達','台達電','聯電','瑞昱','富邦金','中鋼','南亞'];
    const codes = ['2330','2317','2454','2382','2308','2303','2379','2881','2002','1303'];
    for (let d = 1; d <= days; d++) {
      const dt = new Date(); dt.setDate(dt.getDate() - d);
      const k  = dt.toISOString().split('T')[0];
      const rng = (seed) => { let x = Math.sin(seed+d)*9999; return x-Math.floor(x); };
      hist[k] = {
        entry: codes.slice(0,5).map((code,i) => ({
          name: names[i], code,
          price: Math.round(100+rng(i)*900),
          chg:   (rng(i+10)*6-2).toFixed(2)+'%',
          score: Math.round(65+rng(i+20)*30),
          entryPrice: Math.round(100+rng(i+30)*900),
          sig: rng(i+40) > 0.6 ? 'green' : rng(i+40) > 0.3 ? 'yellow' : 'red',
          tags: ['放量','突破','法人買'].slice(0, 2+Math.round(rng(i+50))),
        })),
        exit: codes.slice(5,10).map((code,i) => ({
          name: names[i+5], code,
          price: Math.round(50+rng(i+60)*500),
          chg:   '-'+(rng(i+70)*4+0.5).toFixed(2)+'%',
          score: Math.round(55+rng(i+80)*30),
          exitPrice: Math.round(50+rng(i+90)*500),
          action: exitAction(Math.round(55+rng(i+80)*30)),
          tags: ['跌破','賣超','轉弱'].slice(0, 2+Math.round(rng(i+100))),
        })),
      };
    }
    return hist;
  }

  // ── Combined stock analysis (entry + exit) ────────────────────────────────
  async function loadStockAnalysis(codeOrName) {
    const result = { ok: false };

    // Step 0 — resolve name → code if needed
    let code = (codeOrName || '').trim();
    if (!/^\d{4,}$/.test(code)) {
      const matches = await searchStocks(code);
      if (matches.length > 0) {
        code = matches[0].code;
      } else {
        result.code  = codeOrName;
        result.error = `找不到「${codeOrName}」，請直接輸入股票代號（例：3481）`;
        return result;
      }
    }
    result.code = code;

    // Step 1 — TWSE today price
    let twsePrice = null;
    if (useTWSE()) {
      try {
        const map = await fetchTWSEAll();
        twsePrice = map[code] || null;
      } catch {}
    }

    // Step 2 — institutional data
    let inst = [];
    try {
      const instMap = await fetchTWSEInstAll();
      inst = instMap[code] || [];
    } catch {}

    // Step 3 — FinMind historical prices
    const token = getToken();
    let prices = [];
    if (token) {
      try { prices = await fetchFMPrice(code); } catch {}
    }

    let close     = twsePrice?.close     || 0;
    let vol       = twsePrice?.volume    || 0;
    let changePct = twsePrice?.changePct || 0;
    let changeAmt = twsePrice?.changeAmt || 0;
    const name    = twsePrice?.name || CANDIDATES.find(c => c.code === code)?.name || code;

    if (close === 0 && prices.length >= 2) {
      const last = prices[prices.length - 1];
      const prev = prices[prices.length - 2];
      close     = parseFloat(last.close) || 0;
      vol       = parseFloat(last.Trading_Volume) || 0;
      const pc  = parseFloat(prev.close) || 0;
      changeAmt = close - pc;
      changePct = pc > 0 ? changeAmt / pc * 100 : 0;
    }

    if (!close && !prices.length) {
      result.error = `查無「${code}」資料。可能原因：①代號有誤 ②上櫃股票需 FinMind Token ③今日無交易（假日/下市）`;
      return result;
    }

    const n       = prices.length;
    const closes  = prices.map(d => parseFloat(d.close));
    const volumes = prices.map(d => parseFloat(d.Trading_Volume));
    const ma5     = n >= 5  ? avg(closes.slice(n-5))  : close;
    const ma20    = n >= 20 ? avg(closes.slice(n-20)) : close;
    const ma60    = n >= 60 ? avg(closes.slice(n-60)) : null;
    const v20     = n >= 20 ? avg(volumes.slice(n-20)) : vol;
    const vr      = v20 > 0 ? vol / v20 : 1;

    let eScore = n >= 25 ? calcEntryScore(prices, inst, close, vol) : null;
    let xScore = n >= 25 ? calcExitScore(prices, inst, close, vol)  : null;
    if (!eScore && twsePrice) {
      const fb = twseOnlyScore(twsePrice, inst);
      eScore = fb.entry; xScore = fb.exit;
    }
    if (!eScore) { result.error = '資料不足，無法計算分析分數'; return result; }

    const recentInst = inst.slice(-15);
    const fNet = recentInst.filter(d=>d.name?.includes('外資')).reduce((s,d)=>s+(+d.buy-+d.sell),0);
    const tNet = recentInst.filter(d=>d.name?.includes('投信')).reduce((s,d)=>s+(+d.buy-+d.sell),0);

    const support  = n >= 20 ? Math.round(Math.min(...closes.slice(n-20))) : (ma20 > 0 ? Math.round(ma20 * 0.99) : null);
    const pressure = n >= 20 ? Math.round(Math.max(...closes.slice(n-20))) : null;
    const stopLoss = Math.round(ma20);

    result.ok        = true;
    result.name      = name;
    result.close     = close;
    result.changePct = changePct;
    result.changeAmt = changeAmt;
    result.entry     = {
      score: eScore.total, detail: eScore,
      support, pressure,
      tags:    entryTags(eScore),
      reasons: buildEntryReasons(close, ma5, ma20, ma60, vr, fNet, tNet),
    };
    result.exit = {
      score:   xScore.total, detail: xScore,
      action:  exitAction(xScore.total),
      stopLoss,
      tags:    exitTags(xScore),
      reasons: buildExitReasons(close, ma5, ma20, ma60, vr, fNet, tNet),
    };
    result.ma       = { ma5: Math.round(ma5), ma20: Math.round(ma20), ma60: ma60 ? Math.round(ma60) : null };
    result.vr       = +vr.toFixed(1);
    result.instNet  = { foreign: fNet, trust: tNet };
    result.source   = token && prices.length ? 'finmind' : (twsePrice ? 'twse' : 'mock');
    result.priceHistory = prices.slice(-30).map(d => ({ date: d.date, close: parseFloat(d.close) }));
    return result;
  }

  async function searchStocks(query) {
    if (!query || query.length < 1) return [];
    const q = query.toLowerCase().trim();

    // Try TWSE live data (full market, cached after first load)
    let source = [];
    if (useTWSE()) {
      try {
        const map = await fetchTWSEAll();
        if (Object.keys(map).length > 0) {
          source = Object.entries(map)
            .map(([code, d]) => ({ code, name: d.name || '' }))
            .filter(s => s.name);
        }
      } catch {}
    }

    // Fallback: use the extended local STOCK_LIST (covers weekends / TWSE down)
    if (source.length === 0) source = STOCK_LIST;

    const filtered = source.filter(s =>
      s.code.startsWith(q) || s.name.toLowerCase().includes(q)
    );

    // Deduplicate by code (TWSE might have duplicates)
    const seen = new Set();
    return filtered.filter(s => {
      if (seen.has(s.code)) return false;
      seen.add(s.code);
      return true;
    }).slice(0, 8);
  }

  // ── Firebase cloud sync ───────────────────────────────────────────────────
  let _fbDb = null, _fbUser = null;

  function initFirebaseService(db) { _fbDb = db; }
  function setFirebaseUser(user)   { _fbUser = user || null; }

  async function cloudSaveHistory(entry, exit) {
    if (!_fbDb || !_fbUser) return;
    const e = entry.filter(s => s.price > 0);
    const x = exit.filter(s => s.price > 0);
    if (!e.length && !x.length) return;
    try {
      await _fbDb.collection('users').doc(_fbUser.uid)
        .collection('history').doc(todayKey())
        .set({ entry: e, exit: x, ts: Date.now(), _v: 2 });
    } catch(err) { console.warn('[Firebase] write:', err.message); }
  }

  async function cloudLoadHistory() {
    if (!_fbDb || !_fbUser) return null;
    try {
      const snap = await _fbDb
        .collection('users').doc(_fbUser.uid)
        .collection('history')
        .orderBy('ts', 'desc').limit(30).get();
      const out = {};
      snap.forEach(d => { out[d.id] = d.data(); });
      return out;
    } catch(err) { console.warn('[Firebase] read:', err.message); return null; }
  }

  // ── Connection tests ──────────────────────────────────────────────────────
  async function testFinMind(token) {
    try {
      const url = `${FINMIND_URL}?dataset=TaiwanStockPrice&data_id=2330&start_date=${daysAgo(5)}&token=${encodeURIComponent(token)}`;
      const res  = await fetch(url);
      const json = await res.json();
      return { ok: json.status === 200, msg: json.status === 200 ? '連線成功' : (json.msg || '驗證失敗') };
    } catch(e) { return { ok: false, msg: e.message }; }
  }

  async function testTWSE() {
    try {
      const res = await fetch(`${TWSE_URL}/exchangeReport/STOCK_DAY_ALL`);
      return { ok: res.ok, msg: res.ok ? '連線成功' : `HTTP ${res.status}` };
    } catch(e) { return { ok: false, msg: e.message }; }
  }

  // ── Single stock detail loader ────────────────────────────────────────────
  async function loadStockDetail(code, type) {
    const result = { code, type, source: 'mock', ok: false };

    // TWSE today price
    let twsePrice = null;
    if (useTWSE()) {
      try {
        const map = await fetchTWSEAll();
        twsePrice = map[code] || null;
      } catch {}
    }

    // TWSE institutional data via T86 (free, no token)
    let inst = [];
    try {
      const instMap = await fetchTWSEInstAll();
      inst = instMap[code] || [];
    } catch {}

    // FinMind historical prices (if token, for MA scoring)
    const token = getToken();
    let prices = [];
    if (token) {
      try {
        prices = await fetchFMPrice(code);
        result.source = 'finmind';
      } catch(e) {
        if (e.message !== 'NO_TOKEN') result.warnings = e.message;
      }
    }

    // Resolve close + changePct
    let close   = twsePrice?.close     || 0;
    let vol     = twsePrice?.volume    || 0;
    let changePct = twsePrice?.changePct || 0;
    let changeAmt = twsePrice?.changeAmt || 0;
    const name  = twsePrice?.name || CANDIDATES.find(c=>c.code===code)?.name || code;

    if (close === 0 && prices.length >= 2) {
      const last = prices[prices.length - 1];
      const prev = prices[prices.length - 2];
      close     = parseFloat(last.close) || 0;
      vol       = parseFloat(last.Trading_Volume) || 0;
      const pc  = parseFloat(prev.close) || 0;
      changeAmt = close - pc;
      changePct = pc > 0 ? changeAmt / pc * 100 : 0;
      result.source = result.source === 'finmind' ? 'finmind' : 'twse';
    }

    // Scores
    const n = prices.length;
    const closes  = prices.map(d => parseFloat(d.close));
    const volumes = prices.map(d => parseFloat(d.Trading_Volume));
    const ma5  = n >= 5  ? avg(closes.slice(n-5))  : close;
    const ma20 = n >= 20 ? avg(closes.slice(n-20)) : close;
    const ma60 = n >= 60 ? avg(closes.slice(n-60)) : null;
    const v20  = n >= 20 ? avg(volumes.slice(n-20)) : vol;
    const vr   = v20 > 0 ? vol / v20 : 1;

    const eScore = n >= 25 ? calcEntryScore(prices, inst, close, vol) : null;
    const xScore = n >= 25 ? calcExitScore(prices, inst, close, vol)  : null;

    // Suggested prices — aligned with dashboard formulas
    const support  = n >= 20 ? Math.round(Math.min(...closes.slice(n - 20))) : (ma20 > 0 ? Math.round(ma20 * 0.99) : null);
    const resist   = n >= 20 ? Math.round(Math.max(...closes.slice(n - 20))) : null;
    const stopLoss = ma20 > 0 ? Math.round(ma20 * 0.96) : (close > 0 ? Math.round(close * 0.95) : null);
    const entryRef = close > 0 ? Math.round(close) : null;
    const exitRef  = close > 0 ? Math.round(close) : null;

    // Institutional net (last 5 days)
    const recentInst = inst.slice(-15);
    const fNet = recentInst.filter(d=>d.name?.includes('外資')).reduce((s,d)=>s+(+d.buy-+d.sell),0);
    const tNet = recentInst.filter(d=>d.name?.includes('投信')).reduce((s,d)=>s+(+d.buy-+d.sell),0);

    // Summary text
    const isEntry = type !== 'exit';
    let summary = '';
    if (isEntry) {
      const volStr  = vr >= 2 ? `成交量放大至均量 ${vr.toFixed(1)} 倍` : '成交量正常';
      const maStr   = close > ma20 ? '股價站上MA20均線' : '股價低於MA20';
      const instStr = fNet > 0 ? '外資近期買超' : fNet < 0 ? '外資近期賣超' : '外資持平';
      summary = `${volStr}，${maStr}，${instStr}。${eScore && eScore.total >= 78 ? '系統訊號明確，可考慮進場觀察。' : eScore && eScore.total >= 65 ? '系統訊號中等，建議持續觀察確認。' : '系統訊號偏弱，建議謹慎。'}`;
    } else {
      const maStr   = close < ma20 ? '股價跌破MA20均線' : '股價仍在MA20上方';
      const instStr = fNet < 0 ? `外資近期賣超 ${Math.abs(fNet).toLocaleString()} 張` : '外資未明顯賣超';
      summary = `${maStr}，${instStr}。${xScore && xScore.total >= 72 ? '出場風險偏高，建議審慎評估是否出場。' : xScore && xScore.total >= 55 ? '出場訊號中等，建議密切追蹤。' : '目前風險訊號不明顯，可繼續觀察。'}`;
    }

    // Key reasons
    const reasons = isEntry ? buildEntryReasons(close, ma5, ma20, ma60, vr, fNet, tNet)
                             : buildExitReasons(close, ma5, ma20, ma60, vr, fNet, tNet);

    result.ok = true;
    result.name = name;
    result.close = close;
    result.changePct = changePct;
    result.changeAmt = changeAmt;
    result.sig = eScore ? sigFromScore(isEntry ? eScore.total : xScore.total, type) : 'yellow';
    result.prices = { entry: isEntry ? entryRef : null, exit: isEntry ? null : exitRef, support, resist, stop: stopLoss };
    result.eScore = eScore;
    result.xScore = xScore;
    result.summary = summary;
    result.reasons = reasons;
    result.ma = { ma5: Math.round(ma5), ma20: Math.round(ma20), ma60: ma60 ? Math.round(ma60) : null };
    result.vr = +vr.toFixed(1);
    result.instNet = { foreign: fNet, trust: tNet };
    result.priceHistory = prices.slice(-30).map(d => ({ date: d.date, close: parseFloat(d.close) }));
    return result;
  }

  function buildEntryReasons(close, ma5, ma20, ma60, vr, fNet, tNet) {
    const r = [];
    if (vr >= 2)        r.push(`成交量達20日均量 ${vr.toFixed(1)} 倍，量能明顯放大`);
    else if (vr >= 1.5) r.push(`成交量達20日均量 ${vr.toFixed(1)} 倍，量能回升`);
    if (close > ma20)   r.push(`收盤價（$${Math.round(close)}）站上20日均線（$${Math.round(ma20)}）`);
    if (ma60 && close > ma60) r.push(`股價站上60日均線（$${Math.round(ma60)}），中期趨勢偏多`);
    if (ma5 > ma20)     r.push('MA5 突破 MA20，短線均線轉多頭排列');
    if (fNet > 0)       r.push(`外資近5日合計買超 ${fNet.toLocaleString()} 張`);
    if (tNet > 0)       r.push(`投信近5日合計買超 ${tNet.toLocaleString()} 張`);
    if (r.length === 0) r.push('技術面訊號待觀察，建議搭配其他指標確認');
    return r.slice(0, 5);
  }

  function buildExitReasons(close, ma5, ma20, ma60, vr, fNet, tNet) {
    const r = [];
    if (close < ma20)   r.push(`收盤價（$${Math.round(close)}）跌破20日均線（$${Math.round(ma20)}），短線轉弱`);
    if (ma60 && close < ma60) r.push(`股價跌破60日均線（$${Math.round(ma60)}），中期趨勢偏空`);
    if (ma5 < ma20)     r.push('MA5 跌破 MA20，均線死亡交叉');
    if (vr >= 1.5 && close < ma20) r.push(`跌破均線時伴隨放量（${vr.toFixed(1)}倍），賣壓沉重`);
    if (fNet < 0)       r.push(`外資近5日合計賣超 ${Math.abs(fNet).toLocaleString()} 張`);
    if (tNet < 0)       r.push(`投信近5日合計賣超 ${Math.abs(tNet).toLocaleString()} 張`);
    if (r.length === 0) r.push('目前出場訊號不明確，建議繼續觀察');
    return r.slice(0, 5);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return { getToken, setToken, clearToken, useTWSE, setUseTWSE, clearCache,
           loadStocks, loadStockDetail, loadStockAnalysis, searchStocks, exitAction,
           getHistory, getMockHistory, todayKey,
           testFinMind, testTWSE,
           initFirebaseService, setFirebaseUser, cloudSaveHistory, cloudLoadHistory,
           scanAllMarket };
})();

// ── Full Market Scanner (TWSE bulk, no token needed) ──────────────────────────
async function scanAllMarket(onProgress) {
  onProgress?.('連線 TWSE 全市場資料…', 5);

  // Use correct TWSE OpenData URL (same as data-service.js uses internally)
  const TWSE_ALL_URL = 'https://opendata.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';
  let res;
  try { res = await fetch(TWSE_ALL_URL); }
  catch { throw new Error('網路無法連線 TWSE（請確認網路狀態）'); }
  if (!res.ok) throw new Error(`TWSE API 錯誤（HTTP ${res.status}）`);
  const raw = await res.json();
  if (!Array.isArray(raw) || raw.length === 0) {
    const h = new Date().getHours();
    const afterClose = h >= 15 || h < 5;  // after 3PM or late night (previous day data)
    throw new Error(afterClose
      ? '今日無交易資料（非交易日或資料尚未更新）'
      : '交易時間尚未結束，資料將於今日收盤後（15:30）更新');
  }

  onProgress?.(`取得 ${raw.length} 筆資料，開始篩選…`, 30);

  const p = s => parseFloat((s || '').toString().replace(/,/g, '')) || 0;

  const stocks = raw
    .filter(s => /^\d{4}$/.test(s.Code)             // 只取4位數代號
               && !s.Code.startsWith('00')           // 排除 ETF（0050, 0056…）
               && !/[A-Za-z]/.test(s.Change || '')) // 排除停牌（Change 含字母如 X）
    .map(s => {
      const close  = p(s.ClosingPrice);
      const open   = p(s.OpeningPrice);
      const high   = p(s.HighestPrice);
      const low    = p(s.LowestPrice);
      const change = p(s.Change);
      const tv     = p(s.TradeValue);               // 成交金額（元）

      // 排除低價股（< $10）、低流動性（< 2億），確保代表性
      if (close < 10 || tv < 200_000_000) return null;

      const prevClose = close - change;
      const chgPct    = prevClose > 0 ? change / prevClose * 100 : 0;
      const hi2lo     = high - low;
      const closeHigh = high > 0 ? close / high : 1;         // 收盤強度
      const closeLow  = hi2lo > 0 ? (close - low) / hi2lo : 0.5; // 0=最低 1=最高
      const momentum  = open > 0 ? (close - open) / open * 100 : 0;

      // ── 進場分 (0–100) ──
      let eScore = 0;
      // 漲幅：+1%~+5% 最佳訊號
      if      (chgPct >= 5 && chgPct <= 9.5) eScore += 28;
      else if (chgPct >= 2 && chgPct <  5)   eScore += 35;
      else if (chgPct >= 0.5 && chgPct < 2)  eScore += 20;
      else if (chgPct > 0 && chgPct < 0.5)   eScore += 8;
      // 收盤強度
      if      (closeHigh >= 0.99) eScore += 28;
      else if (closeHigh >= 0.97) eScore += 18;
      else if (closeHigh >= 0.93) eScore += 8;
      // 動能（開低走高 or 開高走更高）
      if      (momentum >= 3)  eScore += 22;
      else if (momentum >= 1)  eScore += 14;
      else if (momentum >= 0)  eScore += 5;
      // 成交金額（活躍度）
      if      (tv >= 5e9)  eScore += 15;   // > 50億
      else if (tv >= 1e9)  eScore += 10;   // > 10億
      else if (tv >= 3e8)  eScore += 5;    // > 3億

      // ── 出場分 (0–100) ──
      let xScore = 0;
      if      (chgPct <= -5)  xScore += 38;
      else if (chgPct <= -2)  xScore += 26;
      else if (chgPct < 0)    xScore += 14;
      if      (closeLow <= 0.1)  xScore += 30;   // 收在最低附近
      else if (closeLow <= 0.3)  xScore += 18;
      if      (momentum <= -3)   xScore += 22;
      else if (momentum <= -1)   xScore += 12;
      if (tv >= 1e9 && chgPct < -2) xScore += 10; // 大量急跌

      // ── 標籤 ──
      const eTags = [], xTags = [];
      if (chgPct >= 3)        eTags.push('強勢上漲');
      if (closeHigh >= 0.99)  eTags.push('強勢收盤');
      if (tv >= 2e9)          eTags.push('大量');
      if (momentum >= 2)      eTags.push('開低走高');
      if (eTags.length === 0) eTags.push('偏弱觀察');

      if (chgPct <= -3)       xTags.push('急跌');
      if (closeLow <= 0.2)    xTags.push('弱勢收盤');
      if (tv >= 1e9 && chgPct < 0) xTags.push('大量賣壓');
      if (momentum < -2)      xTags.push('開高走低');
      if (xTags.length === 0) xTags.push('動能轉弱');

      const chgStr = (chgPct >= 0 ? '+' : '') + chgPct.toFixed(2) + '%';

      return { code: s.Code, name: s.Name.trim(), sector: '—',
               price: close, chg: chgStr, chgPct,
               eScore, xScore, eTags, xTags,
               support: Math.round(low), pressure: Math.round(high) };
    })
    .filter(Boolean);

  onProgress?.(`篩選 ${stocks.length} 檔，計算排名…`, 70);

  const sig   = s => s >= 80 ? 'green' : s >= 65 ? 'yellow' : 'red';
  const xAct  = s => s >= 70 ? { icon:'🚨', label:'建議立即出場', cls:'urgent' }
                   : s >= 50 ? { icon:'⛔', label:'建議出場',    cls:'exit'   }
                   :           { icon:'⚠️', label:'建議減碼',    cls:'reduce' };

  const entry = [...stocks]
    .filter(s => s.eScore >= 20)          // 最低進場門檻
    .sort((a, b) => b.eScore - a.eScore)
    .slice(0, 50)
    .map(s => ({ code:s.code, name:s.name, sector:s.sector, price:s.price, chg:s.chg,
                 sig:sig(s.eScore), score:s.eScore, support:s.support,
                 pressure:s.pressure, tags:s.eTags }));

  const exit = [...stocks]
    .filter(s => s.xScore >= 20)          // 最低風險門檻
    .sort((a, b) => b.xScore - a.xScore)
    .slice(0, 50)
    .map(s => ({ code:s.code, name:s.name, sector:s.sector, price:s.price, chg:s.chg,
                 action:xAct(s.xScore), score:s.xScore,
                 stopLoss:s.support, tags:s.xTags }));

  onProgress?.('完成', 100);
  return { entry, exit, source:'twse_all', total: stocks.length };
}
