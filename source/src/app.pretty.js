var nJ = () => ({ revision: 0, products: [], categories: [], sales: [], movements: [], markets: [], stocktakes: [] }),
  KO;
function iJ() {
  return (KO ??= new Promise((e, t) => {
    let a = indexedDB.open("little-shop-offline", 1);
    ((a.onupgradeneeded = () => a.result.createObjectStore("shop")),
      (a.onsuccess = () => {
        let db = a.result,
          p = KO;
        // iPad Safari can close the storage connection (e.g. after the app was in the background
        // or the iPad was locked). Forget the closed connection so the next save opens a fresh one.
        let forget = () => KO === p && (KO = void 0);
        ((db.onclose = forget),
          (db.onversionchange = () => {
            (db.close(), forget());
          }),
          e(db));
      }),
      (a.onerror = () => {
        ((KO = void 0),
          t(Error("Device storage is unavailable. Open the installed app outside private browsing.")));
      }),
      (a.onblocked = () => {
        ((KO = void 0), t(Error("Storage is busy. Close other Little Shop windows and try again.")));
      }));
  }));
}
// Read (and optionally change) the saved shop. If the connection has been closed by the browser,
// reconnect and try once more. A failed transaction saves nothing, so retrying is safe.
async function G5(e, again = !0) {
  let t, n;
  try {
    ((t = await iJ()), (n = t.transaction("shop", e ? "readwrite" : "readonly")));
  } catch (err) {
    KO = void 0;
    if (again) return G5(e, !1);
    throw Error("Could not reach this device's storage. Close the app fully and open it again.");
  }
  return new Promise((a, r) => {
    let i = n.objectStore("shop"),
      o = i.get("state"),
      A,
      s;
    ((o.onsuccess = () => {
      try {
        let l = o.result || nJ();
        ((A = e ? e(l) : l), e && i.put(l, "state"));
      } catch (l) {
        ((s = l), n.abort());
      }
    }),
      (n.oncomplete = () => a(A)),
      (n.onabort = n.onerror =
        (ev) => {
          ev && ev.preventDefault && ev.preventDefault();
          // Our own validation error: report it. Otherwise the connection failed mid-way: reconnect and retry once.
          if (s) return r(s);
          if (again) return ((KO = void 0), G5(e, !1).then(a, r));
          r(Error("Could not save on this device. Free some storage and try again."));
        }));
  });
}
var GO = () => G5();
function oJ(e, t) {
  if (t.action === "sale") {
    let n = e.sales.find((i) => i.id === t.id);
    if (n) return { ...e, receipt: n };
  }
  if (t.revision !== e.revision) throw Error("The shop changed in another window. Refresh and try again.");
  let a = new Date().toISOString(),
    r;
  if (t.action === "product") {
    let n = t.product;
    if (
      !n ||
      typeof n.name != "string" ||
      !n.name.trim() ||
      n.name.trim().length > 100 ||
      !Number.isSafeInteger(n.price) ||
      n.price < 0 ||
      n.price > 1e8 ||
      !Number.isSafeInteger(n.stock) ||
      n.stock < 0 ||
      n.stock > 1e6 ||
      !WO(n.image)
    )
      throw Error("Please check the item name, price and photo.");
    if (n.category_id && !e.categories.some((s) => s.id === n.category_id))
      throw Error("Choose an existing category.");
    let i = e.products.find((s) => s.id === n.id);
    if (n.id && !i) throw Error("This item has been removed.");
    let o = {
      id: n.id || crypto.randomUUID(),
      name: n.name.trim(),
      price: n.price,
      stock: n.stock,
      unit: "each",
      image: n.image,
      archived: n.archived ? 1 : 0,
      category_id: n.category_id || null,
    };
    e.products = e.products
      .filter((s) => s.id !== o.id)
      .concat(o)
      .sort((s, l) => s.name.localeCompare(l.name));
    let A = o.stock - (i?.stock || 0);
    A &&
      e.movements.unshift({
        id: crypto.randomUUID(),
        product_id: o.id,
        product_name: o.name,
        at: a,
        delta: A,
        reason: i ? "Stock adjustment" : "Opening stock",
      });
  } else if (t.action === "category") {
    let n = t.category,
      i = e.categories.find((o) => o.id === n.id);
    if (!n || typeof n.name != "string" || !n.name.trim() || n.name.trim().length > 80)
      throw Error("Enter a category name, up to 80 characters.");
    if (n.id && !i) throw Error("This category has been removed.");
    if (n.parent_id && !e.categories.some((o) => o.id === n.parent_id && !o.parent_id))
      throw Error("Choose a main heading.");
    if (i && i.parent_id !== n.parent_id) throw Error("The parent heading cannot be changed here.");
    if (
      e.categories.some(
        (o) =>
          o.id !== n.id &&
          o.parent_id === n.parent_id &&
          o.name.toLowerCase() === n.name.trim().toLowerCase(),
      )
    )
      throw Error("That category name is already used.");
    e.categories = e.categories
      .filter((o) => o.id !== n.id)
      .concat({ id: n.id || crypto.randomUUID(), name: n.name.trim(), parent_id: n.parent_id || null })
      .sort((o, A) => o.name.localeCompare(A.name));
  } else if (t.action === "market") {
    // Preset markets, managed in the Editing tab
    let n = t.market,
      ms = (e.markets ||= []),
      i = n && ms.find((o) => o.id === n.id);
    if (!n || typeof n.name != "string" || !n.name.trim() || n.name.trim().length > 100)
      throw Error("Enter a market name, up to 100 characters.");
    if (n.id && !i) throw Error("This market has been removed.");
    if (ms.some((o) => o.id !== n.id && o.name.toLowerCase() === n.name.trim().toLowerCase()))
      throw Error("That market name is already used.");
    if (i) i.name = n.name.trim();
    else ms.push({ id: crypto.randomUUID(), name: n.name.trim() });
  } else if (t.action === "delete-market") {
    let ms = e.markets || [];
    if (!ms.some((o) => o.id === t.id)) throw Error("This market has already been removed.");
    e.markets = ms.filter((o) => o.id !== t.id);
  } else if (t.action === "delete-product" || t.action === "delete-category") {
    let n = e.products.find((s) => s.id === t.id),
      i = e.categories.find((s) => s.id === t.id);
    if (t.action === "delete-product" ? !n : !i)
      throw Error("This item or category has already been removed.");
    let o =
        t.action === "delete-category"
          ? [t.id, ...e.categories.filter((s) => s.parent_id === t.id).map((s) => s.id)]
          : [],
      A = e.products.filter((s) =>
        t.action === "delete-product" ? s.id === t.id : o.includes(s.category_id),
      );
    for (let s of e.sales)
      for (let l of s.lines) {
        let u = A.find((p) => p.id === l.id);
        u && typeof l.heading != "string" && Object.assign(l, Ow(u.category_id, e.categories));
      }
    if (t.action === "delete-product") e.products = e.products.filter((s) => s.id !== t.id);
    else {
      e.categories = e.categories.filter((s) => !o.includes(s.id));
      for (let s of A) s.category_id = i.parent_id || null;
    }
  } else if (t.action === "sale") {
    // Sale: cash (automatic 5% off, rounded to 5c) or card (optional staff 20% / stallholder 10%)
    let mk = typeof t.market == "string" ? t.market.trim() : "",
      dtype = t.method === "card" && (t.discount === "staff20" || t.discount === "stall10") ? t.discount : null,
      isCustom = t.discount === "custom",
      cust = isCustom && t.custom && typeof t.custom == "object" ? t.custom : {},
      nm = typeof t.staffName == "string" ? t.staffName.trim() : "";
    if (
      !["cash", "card"].includes(t.method) ||
      !mk ||
      mk.length > 100 ||
      typeof t.id != "string" ||
      !Array.isArray(t.lines) ||
      !t.lines.length ||
      t.lines.length > 200 ||
      (t.discount != null && t.method === "card" && !dtype && !isCustom) ||
      (dtype && (!nm || nm.length > 60))
    )
      throw Error("Check the payment details and staff name.");
    let day = lsDay(a),
      left = lsRemaining(e, day, mk),
      n = new Set(),
      i = t.lines.map((s) => {
        let l = e.products.find((u) => u.id === s.id);
        if (!l || l.archived || n.has(s.id) || !Number.isSafeInteger(s.qty) || s.qty < 1 || s.qty > 9999)
          throw Error("Some items are unavailable. Refresh the basket.");
        if (s.qty > (left[l.id] || 0))
          throw Error(`Not enough ${l.name} left in today's stocktake (${Math.max(0, left[l.id] || 0)} left).`);
        // Custom discount: amount off each one of this item (cents), no more than its price
        let off = cust[l.id] ?? 0;
        if (!Number.isSafeInteger(off) || off < 0 || off > l.price) throw Error(`The discount on ${l.name} must be between $0 and its price.`);
        return (
          n.add(s.id),
          {
            id: l.id,
            name: l.name,
            unit: "each",
            price: l.price,
            qty: s.qty,
            total: l.price * s.qty,
            ...(off > 0 ? { discount_each: off, discount_total: off * s.qty } : {}),
            category_id: l.category_id,
            ...Ow(l.category_id, e.categories),
          }
        );
      }),
      o = i.reduce((s, l) => s + l.total, 0),
      co = i.reduce((s, l) => s + (l.discount_total || 0), 0);
    if (!Number.isSafeInteger(o) || o > 1e8) throw Error("The basket total is too large.");
    if (isCustom && co <= 0) throw Error("Enter an amount off for at least one item.");
    let pr = lsPrice(o, t.method, dtype, co);
    r = {
      id: t.id,
      at: a,
      date: day,
      market: mk,
      method: t.method,
      subtotal: o,
      discount_type: pr.type,
      discount_pct: pr.pct,
      // discount_amount = everything taken off (custom + percentage); custom_amount = per-item custom part
      discount_amount: pr.discount,
      pct_amount: pr.pctOff,
      custom_amount: pr.custom,
      staff_name: dtype ? nm : "",
      rounding: pr.rounding,
      total: pr.total,
      cash: 0,
      change: 0,
      lines: i,
    };
    e.sales.unshift(r);
  } else if (t.action === "stocktake") {
    // Morning stocktake for one day + market
    let mk = typeof t.market == "string" ? t.market.trim() : "";
    if (!mk || mk.length > 100 || typeof t.date != "string" || !/^\d{4}-\d{2}-\d{2}$/.test(t.date) || !t.counts || typeof t.counts != "object")
      throw Error("Check the stocktake details.");
    let counts = {};
    for (let [pid, v] of Object.entries(t.counts)) {
      if (!e.products.some((p) => p.id === pid)) continue;
      if (!Number.isSafeInteger(v) || v < 0 || v > 1e6) throw Error("Stock counts must be whole numbers.");
      counts[pid] = v;
    }
    e.stocktakes = (e.stocktakes || []).filter((x) => !(x.date === t.date && x.market === mk));
    e.stocktakes.push({ id: t.date + "|" + mk, date: t.date, market: mk, counts, at: a });
  } else if (t.action === "stock-preset") {
    // Saved stock preset (e.g. "Usual weekend"): add, or update one with the same id or name
    let n = t.preset,
      nm = n && typeof n.name == "string" ? n.name.trim() : "",
      ps = (e.stockPresets ||= []);
    if (!nm || nm.length > 60 || !n.counts || typeof n.counts != "object") throw Error("Enter a preset name, up to 60 characters.");
    let counts = {};
    for (let [pid, v] of Object.entries(n.counts)) {
      if (!e.products.some((p) => p.id === pid)) continue;
      if (!Number.isSafeInteger(v) || v < 0 || v > 1e6) throw Error("Stock counts must be whole numbers.");
      counts[pid] = v;
    }
    // Update by id when given (allows renaming); otherwise a matching name updates that preset
    let byId = n.id ? ps.find((x) => x.id === n.id) : null,
      byName = ps.find((x) => x.name.toLowerCase() === nm.toLowerCase());
    if (n.id && !byId) throw Error("This preset has been removed.");
    if (byId && byName && byName !== byId) throw Error("Another preset already uses that name.");
    let hit = byId || byName;
    hit ? ((hit.name = nm), (hit.counts = counts), (hit.at = a)) : ps.push({ id: crypto.randomUUID(), name: nm, counts, at: a });
  } else if (t.action === "delete-stock-preset") {
    e.stockPresets = (e.stockPresets || []).filter((x) => x.id !== t.id);
  } else if (t.action === "delete-sales") {
    // Delete one day's sales for a market, or all sales. Today's stocktakes are kept.
    let today = lsDay(a),
      hit = (d, m) => t.all || (d === t.date && m === t.market);
    e.sales = e.sales.filter((s) => !hit(lsSaleDay(s), s.market));
    e.stocktakes = (e.stocktakes || []).filter((x) => x.date === today || !hit(x.date, x.market));
  } else if (t.action === "sales-password") {
    if (e.salesPw && t.oldHash !== e.salesPw.hash) throw Error("The current password is not correct.");
    if (typeof t.hash != "string" || !/^[0-9a-f]{64}$/.test(t.hash) || typeof t.salt != "string" || !t.salt)
      throw Error("Could not set the password.");
    e.salesPw = { hash: t.hash, salt: t.salt };
  } else if (t.action === "reset-sales") {
    // Forgotten password: remove the password and every sales record
    let today = lsDay(a);
    ((e.sales = []), (e.stocktakes = (e.stocktakes || []).filter((x) => x.date === today)), delete e.salesPw);
  } else throw Error("Unknown action.");
  return (e.revision++, { ...e, receipt: r });
}
var jO = (e) => G5((t) => oJ(t, e)),
  WO = (e) =>
    typeof e == "string" &&
    (!e || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(e)) &&
    e.length < 7e6;
async function j5(e) {
  if (e.size > 5e6 || !["image/jpeg", "image/png", "image/webp"].includes(e.type))
    throw Error("Choose a JPEG, PNG or WebP photo under 5 MB.");
  return new Promise((t, a) => {
    let r = new Image(),
      n = URL.createObjectURL(e);
    ((r.onload = () => {
      try {
        let i = Math.min(1, 1024 / Math.max(r.width, r.height)),
          o = document.createElement("canvas");
        ((o.width = Math.max(1, Math.round(r.width * i))),
          (o.height = Math.max(1, Math.round(r.height * i))));
        let A = o.getContext("2d");
        ((A.fillStyle = "#ffffff"),
          A.fillRect(0, 0, o.width, o.height),
          A.drawImage(r, 0, 0, o.width, o.height),
          t(o.toDataURL("image/jpeg", 0.85)));
      } catch {
        a(Error("This photo could not be saved."));
      } finally {
        URL.revokeObjectURL(n);
      }
    }),
      (r.onerror = () => {
        (URL.revokeObjectURL(n), a(Error("This photo could not be opened.")));
      }),
      (r.src = n));
  });
}
function Nw(e) {
  let t = new Blob([JSON.stringify({ format: "little-shop-backup", version: 1, data: e })], {
      type: "application/json",
    }),
    a = URL.createObjectURL(t),
    r = document.createElement("a");
  ((r.href = a),
    (r.download = "little-shop-backup.json"),
    r.click(),
    setTimeout(() => URL.revokeObjectURL(a), 1e3));
}
async function XO(e) {
  let t = structuredClone(e);
  for (let a of t.products)
    if (a.image) {
      if (!/^\/api\/photo\?id=[a-zA-Z0-9-]+$/.test(a.image))
        throw Error("An item photo could not be exported.");
      let r = await fetch(a.image);
      if (!r.ok) throw Error("An item photo could not be exported.");
      a.image = await j5(
        new File([await r.blob()], "photo", { type: r.headers.get("content-type") || "image/jpeg" }),
      );
    }
  Nw(t);
}
function YO(e) {
  if (e?.format !== "little-shop-backup" || e.version !== 1) throw Error("Choose a Little Shop backup file.");
  let t = e.data;
  if (
    !t ||
    !Number.isSafeInteger(t.revision) ||
    t.revision < 0 ||
    !["products", "categories", "sales", "movements"].every((i) => Array.isArray(t[i]))
  )
    throw Error("This backup is incomplete.");
  let a = (i, o = 100) => typeof i == "string" && i.length <= o,
    r = (i) => Number.isSafeInteger(i) && i >= 0,
    n = (i) => a(i, 40) && Number.isFinite(Date.parse(i));
  for (let i of ["products", "categories", "sales", "movements"])
    if (
      t[i].length > 1e5 ||
      new Set(t[i].map((o) => o.id)).size !== t[i].length ||
      t[i].some((o) => !a(o.id, 100) || !o.id)
    )
      throw Error("This backup has invalid records.");
  for (let i of t.categories)
    if (
      !a(i.name, 80) ||
      !i.name.trim() ||
      (i.parent_id !== null && !t.categories.some((o) => o.id === i.parent_id && o.parent_id === null))
    )
      throw Error("This backup has invalid categories.");
  for (let i of t.products)
    if (
      !a(i.name) ||
      !i.name.trim() ||
      !r(i.price) ||
      i.price > 1e8 ||
      !r(i.stock) ||
      i.stock > 1e6 ||
      ![0, 1].includes(i.archived) ||
      !WO(i.image) ||
      (i.category_id !== null && !t.categories.some((o) => o.id === i.category_id))
    )
      throw Error("This backup has invalid items or photos.");
  for (let i of t.sales) {
    if (
      !n(i.at) ||
      !a(i.market) ||
      !i.market.trim() ||
      !["cash", "card", "none"].includes(i.method) ||
      !["subtotal", "total", "cash", "change"].every((o) => r(i[o])) ||
      !Array.isArray(i.lines) ||
      !i.lines.length ||
      i.lines.some(
        (o) =>
          !a(o.id) ||
          !a(o.name) ||
          !r(o.price) ||
          !r(o.qty) ||
          o.qty < 1 ||
          !r(o.total) ||
          o.total !== o.price * o.qty ||
          (o.heading !== void 0 && !a(o.heading, 80)) ||
          (o.subcategory !== void 0 && !a(o.subcategory, 80)),
      )
    )
      throw Error("This backup has invalid sales.");
    if (
      i.subtotal !== i.lines.reduce((o, A) => o + A.total, 0) ||
      i.total !== (i.method === "cash" ? Math.round(i.subtotal / 5) * 5 : i.subtotal) ||
      (i.method === "cash"
        ? i.cash < i.total || i.cash - i.total !== i.change || i.cash % 5 !== 0
        : i.cash !== 0 || i.change !== 0)
    )
      throw Error("The backup sale totals do not match.");
  }
  for (let i of t.movements)
    if (!a(i.product_id) || !n(i.at) || !Number.isSafeInteger(i.delta) || !a(i.reason, 150))
      throw Error("This backup has invalid stock history.");
  // Markets are optional (older backups don't have them)
  if (
    t.markets !== void 0 &&
    (!Array.isArray(t.markets) ||
      t.markets.length > 1e3 ||
      new Set(t.markets.map((i) => i?.id)).size !== t.markets.length ||
      t.markets.some((i) => !i || !a(i.id) || !i.id || !a(i.name) || !i.name.trim()))
  )
    throw Error("This backup has invalid markets.");
  return structuredClone(t);
}
var ZO = (e, t) =>
  G5((a) => {
    if (a.revision !== t) throw Error("Records changed. Refresh before restoring.");
    return (Object.assign(a, e, { revision: a.revision + 1 }), a);
  });
var wa = Me(Qt(), 1);
var Mw = Me(Qt(), 1);
var kw = (...e) =>
  e
    .filter((t, a, r) => !!t && t.trim() !== "" && r.indexOf(t) === a)
    .join(" ")
    .trim();
var JO = (e) => e.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
var $O = (e) => e.replace(/^([A-Z])|[\s-_]+(\w)/g, (t, a, r) => (r ? r.toUpperCase() : a.toLowerCase()));
var W5 = (e) => {
  let t = $O(e);
  return t.charAt(0).toUpperCase() + t.slice(1);
};
var x0 = Me(Qt(), 1);
var Pw = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};
var eD = (e) => {
  for (let t in e) if (t.startsWith("aria-") || t === "role" || t === "title") return !0;
  return !1;
};
var Pp = Me(Qt(), 1);
var AJ = (0, Pp.createContext)({});
var tD = () => (0, Pp.useContext)(AJ);
var aD = (0, x0.forwardRef)(
  (
    {
      color: e,
      size: t,
      strokeWidth: a,
      absoluteStrokeWidth: r,
      className: n = "",
      children: i,
      iconNode: o,
      ...A
    },
    s,
  ) => {
    let {
        size: l = 24,
        strokeWidth: u = 2,
        absoluteStrokeWidth: p = !1,
        color: v = "currentColor",
        className: c = "",
      } = tD() ?? {},
      B = (r ?? p) ? (Number(a ?? u) * 24) / Number(t ?? l) : (a ?? u);
    return (0, x0.createElement)(
      "svg",
      {
        ref: s,
        ...Pw,
        width: t ?? l ?? Pw.width,
        height: t ?? l ?? Pw.height,
        stroke: e ?? v,
        strokeWidth: B,
        className: kw("lucide", c, n),
        ...(!i && !eD(A) && { "aria-hidden": "true" }),
        ...A,
      },
      [...o.map(([C, x]) => (0, x0.createElement)(C, x)), ...(Array.isArray(i) ? i : [i])],
    );
  },
);
var Pa = (e, t) => {
  let a = (0, Mw.forwardRef)(({ className: r, ...n }, i) =>
    (0, Mw.createElement)(aD, {
      ref: i,
      iconNode: t,
      className: kw(`lucide-${JO(W5(e))}`, `lucide-${e}`, r),
      ...n,
    }),
  );
  return ((a.displayName = W5(e)), a);
};
var sJ = [
    [
      "path",
      {
        d: "M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z",
        key: "18u6gg",
      },
    ],
    ["circle", { cx: "12", cy: "13", r: "3", key: "1vg3eu" }],
  ],
  S0 = Pa("camera", sJ);
var lJ = [["path", { d: "M20 6 9 17l-5-5", key: "1gmf2c" }]],
  md = Pa("check", lJ);
var uJ = [["path", { d: "m6 9 6 6 6-6", key: "qrunsl" }]],
  Mp = Pa("chevron-down", uJ);
var cJ = [["path", { d: "m18 15-6-6-6 6", key: "153udz" }]],
  L0 = Pa("chevron-up", cJ);
var fJ = [
    ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
    ["path", { d: "m9 12 2 2 4-4", key: "dzmm74" }],
  ],
  sf = Pa("circle-check", fJ);
var dJ = [
    ["path", { d: "M12 15V3", key: "m9g1x1" }],
    ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", key: "ih7n3h" }],
    ["path", { d: "m7 10 5 5 5-5", key: "brsn70" }],
  ],
  zo = Pa("download", dJ);
var hJ = [
    [
      "path",
      {
        d: "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z",
        key: "zw3jo",
      },
    ],
    [
      "path",
      { d: "M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12", key: "1wduqc" },
    ],
    [
      "path",
      { d: "M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17", key: "kqbvx6" },
    ],
  ],
  Ou = Pa("layers", hJ);
var pJ = [["path", { d: "M5 12h14", key: "1ays0h" }]],
  I0 = Pa("minus", pJ);
var gJ = [
    [
      "path",
      {
        d: "M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z",
        key: "1a0edw",
      },
    ],
    ["path", { d: "M12 22V12", key: "d0xqtd" }],
    ["polyline", { points: "3.29 7 12 12 20.71 7", key: "ousv84" }],
    ["path", { d: "m7.5 4.27 9 5.15", key: "1c824w" }],
  ],
  Du = Pa("package", gJ);
var mJ = [
    ["path", { d: "M5 12h14", key: "1ays0h" }],
    ["path", { d: "M12 5v14", key: "s699le" }],
  ],
  ts = Pa("plus", mJ);
var vJ = [
    ["path", { d: "M13 16H8", key: "wsln4y" }],
    ["path", { d: "M14 8H8", key: "1l3xfs" }],
    ["path", { d: "M16 12H8", key: "1fr5h0" }],
    [
      "path",
      {
        d: "M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z",
        key: "ycz6yz",
      },
    ],
  ],
  Hp = Pa("receipt-text", vJ);
var yJ = [
    ["path", { d: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", key: "v9h5vc" }],
    ["path", { d: "M21 3v5h-5", key: "1q7to0" }],
    ["path", { d: "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", key: "3uifl3" }],
    ["path", { d: "M8 16H3v5", key: "1cv678" }],
  ],
  qp = Pa("refresh-cw", yJ);
var wJ = [
    ["path", { d: "m21 21-4.34-4.34", key: "14j7rj" }],
    ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }],
  ],
  E0 = Pa("search", wJ);
var BJ = [
    ["path", { d: "m15 11-1 9", key: "5wnq3a" }],
    ["path", { d: "m19 11-4-7", key: "cnml18" }],
    ["path", { d: "M2 11h20", key: "3eubbj" }],
    ["path", { d: "m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4", key: "yiazzp" }],
    ["path", { d: "M4.5 15.5h15", key: "13mye1" }],
    ["path", { d: "m5 11 4-7", key: "116ra9" }],
    ["path", { d: "m9 11 1 9", key: "1ojof7" }],
  ],
  zp = Pa("shopping-basket", BJ);
var bJ = [
    ["path", { d: "M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5", key: "slp6dd" }],
    [
      "path",
      {
        d: "M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244",
        key: "o0xfot",
      },
    ],
    ["path", { d: "M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05", key: "wn3emo" }],
  ],
  vd = Pa("store", bJ);
// Icons added for the Editing tab (lucide "pencil" and "map-pin")
var LsPencil = Pa("pencil", [
    [
      "path",
      {
        d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
        key: "1a8usu",
      },
    ],
    ["path", { d: "m15 5 4 4", key: "1mk7zo" }],
  ]),
  // lucide "clipboard-list" for the Stocktake tab
  LsClipboard = Pa("clipboard-list", [
    ["rect", { width: "8", height: "4", x: "8", y: "2", rx: "1", ry: "1", key: "tgr4d6" }],
    ["path", { d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2", key: "116196" }],
    ["path", { d: "M12 11h4", key: "1jrz19" }],
    ["path", { d: "M12 16h4", key: "n85exb" }],
    ["path", { d: "M8 11h.01", key: "1dfujw" }],
    ["path", { d: "M8 16h.01", key: "18s6g9" }],
  ]),
  LsMapPin = Pa("map-pin", [
    [
      "path",
      {
        d: "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",
        key: "1r0f0z",
      },
    ],
    ["circle", { cx: "12", cy: "10", r: "3", key: "ilqhr7" }],
  ]);
var CJ = [
    ["path", { d: "M10 11v6", key: "nco0om" }],
    ["path", { d: "M14 11v6", key: "outv1u" }],
    ["path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", key: "miytrc" }],
    ["path", { d: "M3 6h18", key: "d0wm0j" }],
    ["path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", key: "e791ji" }],
  ],
  yd = Pa("trash-2", CJ);
var xJ = [
    ["path", { d: "M18 6 6 18", key: "1bl5f8" }],
    ["path", { d: "m6 6 12 12", key: "d8bk6v" }],
  ],
  F0 = Pa("x", xJ);
function rD(e) {
  var t,
    a,
    r = "";
  if (typeof e == "string" || typeof e == "number") r += e;
  else if (typeof e == "object")
    if (Array.isArray(e)) {
      var n = e.length;
      for (t = 0; t < n; t++) e[t] && (a = rD(e[t])) && (r && (r += " "), (r += a));
    } else for (a in e) e[a] && (r && (r += " "), (r += a));
  return r;
}
function Hw() {
  for (var e, t, a = 0, r = "", n = arguments.length; a < n; a++)
    (e = arguments[a]) && (t = rD(e)) && (r && (r += " "), (r += t));
  return r;
}
var nD = (e) => (typeof e == "boolean" ? `${e}` : e === 0 ? "0" : e),
  iD = Hw,
  qw = (e, t) => (a) => {
    var r;
    if (t?.variants == null) return iD(e, a?.class, a?.className);
    let { variants: n, defaultVariants: i } = t,
      o = Object.keys(n).map((l) => {
        let u = a?.[l],
          p = i?.[l];
        if (u === null) return null;
        let v = nD(u) || nD(p);
        return n[l][v];
      }),
      A =
        a &&
        Object.entries(a).reduce((l, u) => {
          let [p, v] = u;
          return (v === void 0 || (l[p] = v), l);
        }, {}),
      s =
        t == null || (r = t.compoundVariants) === null || r === void 0
          ? void 0
          : r.reduce((l, u) => {
              let { class: p, className: v, ...c } = u;
              return Object.entries(c).every((B) => {
                let [C, x] = B;
                return Array.isArray(x) ? x.includes({ ...i, ...A }[C]) : { ...i, ...A }[C] === x;
              })
                ? [...l, p, v]
                : l;
            }, []);
    return iD(e, o, s, a?.class, a?.className);
  };
var NJ = Me(Qt(), 1);
var gD = Me(Qt(), 1),
  mD = Me(Yh(), 1);
var Ei = Me(Qt(), 1);
var oD = Me(Qt(), 1),
  SJ = Object.defineProperty,
  Y5 = (e, t) => SJ(e, "name", { value: t, configurable: !0 });
function X5(e, t) {
  if (typeof e == "function") return e(t);
  e != null && (e.current = t);
}
Y5(X5, "setRef");
function AD(...e) {
  return (t) => {
    let a = !1,
      r = e.map((n) => {
        let i = X5(n, t);
        return (!a && typeof i == "function" && (a = !0), i);
      });
    if (a)
      return () => {
        for (let n = 0; n < r.length; n++) {
          let i = r[n];
          typeof i == "function" ? i() : X5(e[n], null);
        }
      };
  };
}
Y5(AD, "composeRefs");
function Z5(...e) {
  return oD.useCallback(AD(...e), e);
}
Y5(Z5, "useComposedRefs");
var LJ = Object.defineProperty,
  Ns = (e, t) => LJ(e, "name", { value: t, configurable: !0 });
function $5(e) {
  let t = Ei.forwardRef((a, r) => {
    let { children: n, ...i } = a,
      o = null,
      A = !1,
      s = [];
    (J5(n) && typeof zw == "function" && (n = zw(n._payload)),
      Ei.Children.forEach(n, (v) => {
        if (cD(v)) {
          A = !0;
          let c = v,
            B = "child" in c.props ? c.props.child : c.props.children;
          (J5(B) && typeof zw == "function" && (B = zw(B._payload)),
            (o = EJ(c, B)),
            s.push(o?.props?.children));
        } else s.push(v);
      }),
      o
        ? (o = Ei.cloneElement(o, void 0, s))
        : !A && Ei.Children.count(n) === 1 && Ei.isValidElement(n) && (o = n));
    let l = o ? uD(o) : void 0,
      u = Z5(r, l);
    if (!o) {
      if (n || n === 0) throw new Error(A ? _J(e) : UJ(e));
      return n;
    }
    let p = lD(i, o.props ?? {});
    return (o.type !== Ei.Fragment && (p.ref = r ? u : l), Ei.cloneElement(o, p));
  });
  return ((t.displayName = `${e}.Slot`), t);
}
Ns($5, "createSlot");
var sD = Symbol.for("radix.slottable");
function IJ(e) {
  let t = Ns((a) => ("child" in a ? a.children(a.child) : a.children), "Slottable");
  return ((t.displayName = `${e}.Slottable`), (t.__radixId = sD), t);
}
Ns(IJ, "createSlottable");
var EJ = Ns((e, t) => {
  if ("child" in e.props) {
    let a = e.props.child;
    return Ei.isValidElement(a) ? Ei.cloneElement(a, void 0, e.props.children(a.props.children)) : null;
  }
  return Ei.isValidElement(t) ? t : null;
}, "getSlottableElementFromSlottable");
function lD(e, t) {
  let a = { ...t };
  for (let r in t) {
    let n = e[r],
      i = t[r];
    /^on[A-Z]/.test(r)
      ? n && i
        ? (a[r] = (...A) => {
            let s = i(...A);
            return (n(...A), s);
          })
        : n && (a[r] = n)
      : r === "style"
        ? (a[r] = { ...n, ...i })
        : r === "className" && (a[r] = [n, i].filter(Boolean).join(" "));
  }
  return { ...e, ...a };
}
Ns(lD, "mergeProps");
function uD(e) {
  let t = Object.getOwnPropertyDescriptor(e.props, "ref")?.get,
    a = t && "isReactWarning" in t && t.isReactWarning;
  return a
    ? e.ref
    : ((t = Object.getOwnPropertyDescriptor(e, "ref")?.get),
      (a = t && "isReactWarning" in t && t.isReactWarning),
      a ? e.props.ref : e.props.ref || e.ref);
}
Ns(uD, "getElementRef");
function cD(e) {
  return (
    Ei.isValidElement(e) && typeof e.type == "function" && "__radixId" in e.type && e.type.__radixId === sD
  );
}
Ns(cD, "isSlottable");
var FJ = Symbol.for("react.lazy");
function J5(e) {
  return (
    e != null &&
    typeof e == "object" &&
    "$$typeof" in e &&
    e.$$typeof === FJ &&
    "_payload" in e &&
    fD(e._payload)
  );
}
Ns(J5, "isLazyComponent");
function fD(e) {
  return typeof e == "object" && e !== null && "then" in e;
}
Ns(fD, "isPromiseLike");
var UJ = Ns(
    (e) => `${e} failed to slot onto its children. Expected a single React element child or \`Slottable\`.`,
    "createSlotError",
  ),
  _J = Ns(
    (e) =>
      `${e} failed to slot onto its \`Slottable\`. Expected \`Slottable\` to receive a single React element child.`,
    "createSlottableError",
  ),
  zw = Ei[" use ".trim().toString()];
var vD = Me(_a(), 1),
  QJ = Object.defineProperty,
  OJ = (e, t) => QJ(e, "name", { value: t, configurable: !0 }),
  DJ = [
    "a",
    "button",
    "div",
    "form",
    "h2",
    "h3",
    "img",
    "input",
    "label",
    "li",
    "nav",
    "ol",
    "p",
    "select",
    "span",
    "svg",
    "ul",
  ],
  ca = DJ.reduce((e, t) => {
    let a = $5(`Primitive.${t}`),
      r = gD.forwardRef((n, i) => {
        let { asChild: o, ...A } = n,
          s = o ? a : t;
        return (
          typeof window < "u" && (window[Symbol.for("radix-ui")] = !0),
          (0, vD.jsx)(s, { ...A, ref: i })
        );
      });
    return ((r.displayName = `Primitive.${t}`), { ...e, [t]: r });
  }, {});
function eL(e, t) {
  e && mD.flushSync(() => e.dispatchEvent(t));
}
OJ(eL, "dispatchDiscreteCustomEvent");
var kJ = Me(_a(), 1);
var yD = Object.freeze({
  position: "absolute",
  border: 0,
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  wordWrap: "normal",
});
var rs = Me(Qt(), 1),
  tL = Me(_a(), 1),
  PJ = Object.defineProperty,
  as = (e, t) => PJ(e, "name", { value: t, configurable: !0 });
function MJ(e, t) {
  let a = rs.createContext(t);
  a.displayName = e + "Context";
  let r = as((i) => {
    let { children: o, ...A } = i,
      s = rs.useMemo(() => A, Object.values(A));
    return (0, tL.jsx)(a.Provider, { value: s, children: o });
  }, "Provider");
  r.displayName = e + "Provider";
  function n(i, o = {}) {
    let { optional: A = !1 } = o,
      s = rs.useContext(a);
    if (s) return s;
    if (t !== void 0) return t;
    if (!A) throw new Error(`\`${i}\` must be used within \`${e}\``);
  }
  return (as(n, "useContext"), [r, n]);
}
as(MJ, "createContext");
function Xn(e, t = []) {
  let a = [];
  function r(i, o) {
    let A = rs.createContext(o);
    A.displayName = i + "Context";
    let s = a.length;
    a = [...a, o];
    let l = as((p) => {
      let { scope: v, children: c, ...B } = p,
        C = v?.[e]?.[s] || A,
        x = rs.useMemo(() => B, Object.values(B));
      return (0, tL.jsx)(C.Provider, { value: x, children: c });
    }, "Provider");
    l.displayName = i + "Provider";
    function u(p, v, c = {}) {
      let { optional: B = !1 } = c,
        C = v?.[e]?.[s] || A,
        x = rs.useContext(C);
      if (x) return x;
      if (o !== void 0) return o;
      if (!B) throw new Error(`\`${p}\` must be used within \`${i}\``);
    }
    return (as(u, "useContext"), [l, u]);
  }
  as(r, "createContext");
  let n = as(() => {
    let i = a.map((o) => rs.createContext(o));
    return as(function (A) {
      let s = A?.[e] || i;
      return rs.useMemo(() => ({ [`__scope${e}`]: { ...A, [e]: s } }), [A, s]);
    }, "useScope");
  }, "createScope");
  return ((n.scopeName = e), [r, wD(n, ...t)]);
}
as(Xn, "createContextScope");
function wD(...e) {
  let t = e[0];
  if (e.length === 1) return t;
  let a = as(() => {
    let r = e.map((n) => ({ useScope: n(), scopeName: n.scopeName }));
    return as(function (i) {
      let o = r.reduce((A, { useScope: s, scopeName: l }) => {
        let p = s(i)[`__scope${l}`];
        return { ...A, ...p };
      }, {});
      return rs.useMemo(() => ({ [`__scope${t.scopeName}`]: o }), [o]);
    }, "useComposedScopes");
  }, "createScope");
  return ((a.scopeName = t.scopeName), a);
}
as(wD, "composeContextScopes");
var Ps = Me(Qt(), 1);
var BD = Me(Qt(), 1),
  HJ = Object.defineProperty,
  rL = (e, t) => HJ(e, "name", { value: t, configurable: !0 });
function aL(e, t) {
  if (typeof e == "function") return e(t);
  e != null && (e.current = t);
}
rL(aL, "setRef");
function bD(...e) {
  return (t) => {
    let a = !1,
      r = e.map((n) => {
        let i = aL(n, t);
        return (!a && typeof i == "function" && (a = !0), i);
      });
    if (a)
      return () => {
        for (let n = 0; n < r.length; n++) {
          let i = r[n];
          typeof i == "function" ? i() : aL(e[n], null);
        }
      };
  };
}
rL(bD, "composeRefs");
function _l(...e) {
  return BD.useCallback(bD(...e), e);
}
rL(_l, "useComposedRefs");
var Fi = Me(Qt(), 1);
var qJ = Object.defineProperty,
  ks = (e, t) => qJ(e, "name", { value: t, configurable: !0 });
function wd(e) {
  let t = Fi.forwardRef((a, r) => {
    let { children: n, ...i } = a,
      o = null,
      A = !1,
      s = [];
    (nL(n) && typeof Kw == "function" && (n = Kw(n._payload)),
      Fi.Children.forEach(n, (v) => {
        if (LD(v)) {
          A = !0;
          let c = v,
            B = "child" in c.props ? c.props.child : c.props.children;
          (nL(B) && typeof Kw == "function" && (B = Kw(B._payload)),
            (o = VJ(c, B)),
            s.push(o?.props?.children));
        } else s.push(v);
      }),
      o
        ? (o = Fi.cloneElement(o, void 0, s))
        : !A && Fi.Children.count(n) === 1 && Fi.isValidElement(n) && (o = n));
    let l = o ? SD(o) : void 0,
      u = _l(r, l);
    if (!o) {
      if (n || n === 0) throw new Error(A ? jJ(e) : GJ(e));
      return n;
    }
    let p = xD(i, o.props ?? {});
    return (o.type !== Fi.Fragment && (p.ref = r ? u : l), Fi.cloneElement(o, p));
  });
  return ((t.displayName = `${e}.Slot`), t);
}
ks(wd, "createSlot");
var CD = Symbol.for("radix.slottable");
function zJ(e) {
  let t = ks((a) => ("child" in a ? a.children(a.child) : a.children), "Slottable");
  return ((t.displayName = `${e}.Slottable`), (t.__radixId = CD), t);
}
ks(zJ, "createSlottable");
var VJ = ks((e, t) => {
  if ("child" in e.props) {
    let a = e.props.child;
    return Fi.isValidElement(a) ? Fi.cloneElement(a, void 0, e.props.children(a.props.children)) : null;
  }
  return Fi.isValidElement(t) ? t : null;
}, "getSlottableElementFromSlottable");
function xD(e, t) {
  let a = { ...t };
  for (let r in t) {
    let n = e[r],
      i = t[r];
    /^on[A-Z]/.test(r)
      ? n && i
        ? (a[r] = (...A) => {
            let s = i(...A);
            return (n(...A), s);
          })
        : n && (a[r] = n)
      : r === "style"
        ? (a[r] = { ...n, ...i })
        : r === "className" && (a[r] = [n, i].filter(Boolean).join(" "));
  }
  return { ...e, ...a };
}
ks(xD, "mergeProps");
function SD(e) {
  let t = Object.getOwnPropertyDescriptor(e.props, "ref")?.get,
    a = t && "isReactWarning" in t && t.isReactWarning;
  return a
    ? e.ref
    : ((t = Object.getOwnPropertyDescriptor(e, "ref")?.get),
      (a = t && "isReactWarning" in t && t.isReactWarning),
      a ? e.props.ref : e.props.ref || e.ref);
}
ks(SD, "getElementRef");
function LD(e) {
  return (
    Fi.isValidElement(e) && typeof e.type == "function" && "__radixId" in e.type && e.type.__radixId === CD
  );
}
ks(LD, "isSlottable");
var KJ = Symbol.for("react.lazy");
function nL(e) {
  return (
    e != null &&
    typeof e == "object" &&
    "$$typeof" in e &&
    e.$$typeof === KJ &&
    "_payload" in e &&
    ID(e._payload)
  );
}
ks(nL, "isLazyComponent");
function ID(e) {
  return typeof e == "object" && e !== null && "then" in e;
}
ks(ID, "isPromiseLike");
var GJ = ks(
    (e) => `${e} failed to slot onto its children. Expected a single React element child or \`Slottable\`.`,
    "createSlotError",
  ),
  jJ = ks(
    (e) =>
      `${e} failed to slot onto its \`Slottable\`. Expected \`Slottable\` to receive a single React element child.`,
    "createSlottableError",
  ),
  Kw = Fi[" use ".trim().toString()];
var Gw = Me(_a(), 1),
  Vo = Me(Qt(), 1);
var Bd = Me(_a(), 1);
var WJ = Object.defineProperty,
  si = (e, t) => WJ(e, "name", { value: t, configurable: !0 });
function U0(e) {
  let t = e + "CollectionProvider",
    [a, r] = Xn(t),
    [n, i] = a(t, { collectionRef: { current: null }, itemMap: new Map() }),
    o = si((C) => {
      let { scope: x, children: w } = C,
        S = Ps.useRef(null),
        L = Ps.useRef(new Map()).current;
      return (0, Gw.jsx)(n, { scope: x, itemMap: L, collectionRef: S, children: w });
    }, "CollectionProvider");
  o.displayName = t;
  let A = e + "CollectionSlot",
    s = wd(A),
    l = Ps.forwardRef((C, x) => {
      let { scope: w, children: S } = C,
        L = i(A, w),
        F = _l(x, L.collectionRef);
      return (0, Gw.jsx)(s, { ref: F, children: S });
    });
  l.displayName = A;
  let u = e + "CollectionItemSlot",
    p = "data-radix-collection-item",
    v = wd(u),
    c = Ps.forwardRef((C, x) => {
      let { scope: w, children: S, ...L } = C,
        F = Ps.useRef(null),
        q = _l(x, F),
        j = i(u, w);
      return (
        Ps.useEffect(
          () => (
            j.itemMap.set(F, { ref: F, ...L }),
            () => {
              j.itemMap.delete(F);
            }
          ),
        ),
        (0, Gw.jsx)(v, { [p]: "", ref: q, children: S })
      );
    });
  c.displayName = u;
  function B(C) {
    let x = i(e + "CollectionConsumer", C);
    return Ps.useCallback(() => {
      let S = x.collectionRef.current;
      if (!S) return [];
      let L = Array.from(S.querySelectorAll(`[${p}]`));
      return Array.from(x.itemMap.values()).sort(
        (j, z) => L.indexOf(j.ref.current) - L.indexOf(z.ref.current),
      );
    }, [x.collectionRef, x.itemMap]);
  }
  return (si(B, "useCollection"), [{ Provider: o, Slot: l, ItemSlot: c }, B, r]);
}
si(U0, "createCollection");
var ED = new WeakMap(),
  Tn,
  xA,
  iL =
    ((xA = class extends Map {
      constructor(a) {
        super(a);
        e3(this, Tn);
        (ox(this, Tn, [...super.keys()]), ED.set(this, !0));
      }
      set(a, r) {
        return (
          ED.get(this) && (this.has(a) ? (Vi(this, Tn)[Vi(this, Tn).indexOf(a)] = a) : Vi(this, Tn).push(a)),
          super.set(a, r),
          this
        );
      }
      insert(a, r, n) {
        let i = this.has(r),
          o = Vi(this, Tn).length,
          A = AL(a),
          s = A >= 0 ? A : o + A,
          l = s < 0 || s >= o ? -1 : s;
        if (l === this.size || (i && l === this.size - 1) || l === -1) return (this.set(r, n), this);
        let u = this.size + (i ? 0 : 1);
        A < 0 && s++;
        let p = [...Vi(this, Tn)],
          v,
          c = !1;
        for (let B = s; B < u; B++)
          if (s === B) {
            let C = p[B];
            (p[B] === r && (C = p[B + 1]), i && this.delete(r), (v = this.get(C)), this.set(r, n));
          } else {
            !c && p[B - 1] === r && (c = !0);
            let C = p[c ? B : B - 1],
              x = v;
            ((v = this.get(C)), this.delete(C), this.set(C, x));
          }
        return this;
      }
      with(a, r, n) {
        let i = new xA(this);
        return (i.insert(a, r, n), i);
      }
      before(a) {
        let r = Vi(this, Tn).indexOf(a) - 1;
        if (!(r < 0)) return this.entryAt(r);
      }
      setBefore(a, r, n) {
        let i = Vi(this, Tn).indexOf(a);
        return i === -1 ? this : this.insert(i, r, n);
      }
      after(a) {
        let r = Vi(this, Tn).indexOf(a);
        if (((r = r === -1 || r === this.size - 1 ? -1 : r + 1), r !== -1)) return this.entryAt(r);
      }
      setAfter(a, r, n) {
        let i = Vi(this, Tn).indexOf(a);
        return i === -1 ? this : this.insert(i + 1, r, n);
      }
      first() {
        return this.entryAt(0);
      }
      last() {
        return this.entryAt(-1);
      }
      clear() {
        return (ox(this, Tn, []), super.clear());
      }
      delete(a) {
        let r = super.delete(a);
        return (r && Vi(this, Tn).splice(Vi(this, Tn).indexOf(a), 1), r);
      }
      deleteAt(a) {
        let r = this.keyAt(a);
        return r !== void 0 ? this.delete(r) : !1;
      }
      at(a) {
        let r = jw(Vi(this, Tn), a);
        if (r !== void 0) return this.get(r);
      }
      entryAt(a) {
        let r = jw(Vi(this, Tn), a);
        if (r !== void 0) return [r, this.get(r)];
      }
      indexOf(a) {
        return Vi(this, Tn).indexOf(a);
      }
      keyAt(a) {
        return jw(Vi(this, Tn), a);
      }
      from(a, r) {
        let n = this.indexOf(a);
        if (n === -1) return;
        let i = n + r;
        return (i < 0 && (i = 0), i >= this.size && (i = this.size - 1), this.at(i));
      }
      keyFrom(a, r) {
        let n = this.indexOf(a);
        if (n === -1) return;
        let i = n + r;
        return (i < 0 && (i = 0), i >= this.size && (i = this.size - 1), this.keyAt(i));
      }
      find(a, r) {
        let n = 0;
        for (let i of this) {
          if (Reflect.apply(a, r, [i, n, this])) return i;
          n++;
        }
      }
      findIndex(a, r) {
        let n = 0;
        for (let i of this) {
          if (Reflect.apply(a, r, [i, n, this])) return n;
          n++;
        }
        return -1;
      }
      filter(a, r) {
        let n = [],
          i = 0;
        for (let o of this) (Reflect.apply(a, r, [o, i, this]) && n.push(o), i++);
        return new xA(n);
      }
      map(a, r) {
        let n = [],
          i = 0;
        for (let o of this) (n.push([o[0], Reflect.apply(a, r, [o, i, this])]), i++);
        return new xA(n);
      }
      reduce(...a) {
        let [r, n] = a,
          i = 0,
          o = n ?? this.at(0);
        for (let A of this)
          (i === 0 && a.length === 1 ? (o = A) : (o = Reflect.apply(r, this, [o, A, i, this])), i++);
        return o;
      }
      reduceRight(...a) {
        let [r, n] = a,
          i = n ?? this.at(-1);
        for (let o = this.size - 1; o >= 0; o--) {
          let A = this.at(o);
          o === this.size - 1 && a.length === 1 ? (i = A) : (i = Reflect.apply(r, this, [i, A, o, this]));
        }
        return i;
      }
      toSorted(a) {
        let r = [...this.entries()].sort(a);
        return new xA(r);
      }
      toReversed() {
        let a = new xA();
        for (let r = this.size - 1; r >= 0; r--) {
          let n = this.keyAt(r),
            i = this.get(n);
          a.set(n, i);
        }
        return a;
      }
      toSpliced(...a) {
        let r = [...this.entries()];
        return (r.splice(...a), new xA(r));
      }
      slice(a, r) {
        let n = new xA(),
          i = this.size - 1;
        if (a === void 0) return n;
        (a < 0 && (a = a + this.size), r !== void 0 && r > 0 && (i = r - 1));
        for (let o = a; o <= i; o++) {
          let A = this.keyAt(o),
            s = this.get(A);
          n.set(A, s);
        }
        return n;
      }
      every(a, r) {
        let n = 0;
        for (let i of this) {
          if (!Reflect.apply(a, r, [i, n, this])) return !1;
          n++;
        }
        return !0;
      }
      some(a, r) {
        let n = 0;
        for (let i of this) {
          if (Reflect.apply(a, r, [i, n, this])) return !0;
          n++;
        }
        return !1;
      }
    }),
    (Tn = new WeakMap()),
    si(xA, "OrderedDict"),
    xA);
function jw(e, t) {
  if ("at" in Array.prototype) return Array.prototype.at.call(e, t);
  let a = FD(e, t);
  return a === -1 ? void 0 : e[a];
}
si(jw, "at");
function FD(e, t) {
  let a = e.length,
    r = AL(t),
    n = r >= 0 ? r : a + r;
  return n < 0 || n >= a ? -1 : n;
}
si(FD, "toSafeIndex");
function AL(e) {
  return e !== e || e === 0 ? 0 : Math.trunc(e);
}
si(AL, "toSafeInteger");
function XJ(e) {
  let t = e + "CollectionProvider",
    [a, r] = Xn(t),
    [n, i] = a(t, {
      collectionElement: null,
      collectionRef: { current: null },
      collectionRefObject: { current: null },
      itemMap: new iL(),
      setItemMap: si(() => {}, "setItemMap"),
    }),
    o = si(
      ({ state: L, ...F }) => (L ? (0, Bd.jsx)(s, { ...F, state: L }) : (0, Bd.jsx)(A, { ...F })),
      "CollectionProvider",
    );
  o.displayName = t;
  let A = si((L) => {
    let F = x();
    return (0, Bd.jsx)(s, { ...L, state: F });
  }, "CollectionInit");
  A.displayName = t + "Init";
  let s = si((L) => {
    let { scope: F, children: q, state: j } = L,
      z = Vo.useRef(null),
      [k, O] = Vo.useState(null),
      ne = _l(z, O),
      [D, H] = j;
    return (
      Vo.useEffect(() => {
        if (!k) return;
        let te = TD(() => {});
        return (
          te.observe(k, { childList: !0, subtree: !0 }),
          () => {
            te.disconnect();
          }
        );
      }, [k]),
      (0, Bd.jsx)(n, {
        scope: F,
        itemMap: D,
        setItemMap: H,
        collectionRef: ne,
        collectionRefObject: z,
        collectionElement: k,
        children: q,
      })
    );
  }, "CollectionProviderImpl");
  s.displayName = t + "Impl";
  let l = e + "CollectionSlot",
    u = wd(l),
    p = Vo.forwardRef((L, F) => {
      let { scope: q, children: j } = L,
        z = i(l, q),
        k = _l(F, z.collectionRef);
      return (0, Bd.jsx)(u, { ref: k, children: j });
    });
  p.displayName = l;
  let v = e + "CollectionItemSlot",
    c = "data-radix-collection-item",
    B = wd(v),
    C = Vo.forwardRef((L, F) => {
      let { scope: q, children: j, ...z } = L,
        k = Vo.useRef(null),
        [O, ne] = Vo.useState(null),
        D = _l(F, k, ne),
        H = i(v, q),
        { setItemMap: te } = H,
        ee = Vo.useRef(z);
      UD(ee.current, z) || (ee.current = z);
      let ce = ee.current;
      return (
        Vo.useEffect(() => {
          let de = ce;
          return (
            te((fe) =>
              O
                ? fe.has(O)
                  ? fe.set(O, { ...de, element: O }).toSorted(oL)
                  : (fe.set(O, { ...de, element: O }), fe.toSorted(oL))
                : fe,
            ),
            () => {
              te((fe) => (!O || !fe.has(O) ? fe : (fe.delete(O), new iL(fe))));
            }
          );
        }, [O, ce, te]),
        (0, Bd.jsx)(B, { [c]: "", ref: D, children: j })
      );
    });
  C.displayName = v;
  function x() {
    return Vo.useState(new iL());
  }
  si(x, "useInitCollection");
  function w(L) {
    let { itemMap: F } = i(e + "CollectionConsumer", L);
    return F;
  }
  return (
    si(w, "useCollection"),
    [
      { Provider: o, Slot: p, ItemSlot: C },
      { createCollectionScope: r, useCollection: w, useInitCollection: x },
    ]
  );
}
si(XJ, "createCollection");
function UD(e, t) {
  if (e === t) return !0;
  if (typeof e != "object" || typeof t != "object" || e == null || t == null) return !1;
  let a = Object.keys(e),
    r = Object.keys(t);
  if (a.length !== r.length) return !1;
  for (let n of a) if (!Object.prototype.hasOwnProperty.call(t, n) || e[n] !== t[n]) return !1;
  return !0;
}
si(UD, "shallowEqual");
function _D(e, t) {
  return !!(t.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_PRECEDING);
}
si(_D, "isElementPreceding");
function oL(e, t) {
  return !e[1].element || !t[1].element ? 0 : _D(e[1].element, t[1].element) ? -1 : 1;
}
si(oL, "sortByDocumentPosition");
function TD(e) {
  return new MutationObserver((a) => {
    for (let r of a)
      if (r.type === "childList") {
        e();
        return;
      }
  });
}
si(TD, "getChildListObserver");
var YJ = Object.defineProperty,
  Vp = (e, t) => YJ(e, "name", { value: t, configurable: !0 }),
  RD = !!(typeof window < "u" && window.document && window.document.createElement);
function na(e, t, { checkForDefaultPrevented: a = !0 } = {}) {
  return Vp(function (n) {
    if ((e?.(n), a === !1 || !n || !n.defaultPrevented)) return t?.(n);
  }, "handleEvent");
}
Vp(na, "composeEventHandlers");
function ZJ(e) {
  if (!RD) throw new Error("Cannot access window outside of the DOM");
  return e?.ownerDocument?.defaultView ?? window;
}
Vp(ZJ, "getOwnerWindow");
function sL(e) {
  if (!RD) throw new Error("Cannot access document outside of the DOM");
  return e?.ownerDocument ?? document;
}
Vp(sL, "getOwnerDocument");
function QD(e, t = !1) {
  let { activeElement: a } = sL(e);
  if (!a?.nodeName) return null;
  if (OD(a) && a.contentDocument) return QD(a.contentDocument.body, t);
  if (t) {
    let r = a.getAttribute("aria-activedescendant");
    if (r) {
      let n = sL(a).getElementById(r);
      if (n) return n;
    }
  }
  return a;
}
Vp(QD, "getActiveElement");
function OD(e) {
  return e.tagName === "IFRAME";
}
Vp(OD, "isFrame");
var ns = Me(Qt(), 1);
var Ww = !1;
var DD = Me(Qt(), 1),
  Wa = globalThis?.document ? DD.useLayoutEffect : () => {};
var Ms = Me(Qt(), 1);
var Kp = Me(Qt(), 1),
  JJ = Object.defineProperty,
  $J = (e, t) => JJ(e, "name", { value: t, configurable: !0 }),
  ND = Kp[" useEffectEvent ".trim().toString()],
  kD = Kp[" useInsertionEffect ".trim().toString()];
function lL(e) {
  if (typeof ND == "function") return ND(e);
  let t = Kp.useRef(() => {
    throw new Error("Cannot call an event handler while rendering.");
  });
  return (
    typeof kD == "function"
      ? kD(() => {
          t.current = e;
        })
      : Wa(() => {
          t.current = e;
        }),
    Kp.useMemo(
      () =>
        (...a) =>
          t.current?.(...a),
      [],
    )
  );
}
$J(lL, "useEffectEvent");
var e$ = Object.defineProperty,
  _0 = (e, t) => e$(e, "name", { value: t, configurable: !0 }),
  t$ = ns[" useInsertionEffect ".trim().toString()] || Wa;
function is({ prop: e, defaultProp: t, onChange: a = _0(() => {}, "onChange"), caller: r }) {
  let [n, i, o] = MD({ defaultProp: t, onChange: a }),
    A = e !== void 0,
    s = A ? e : n;
  if (Ww) {
    let u = ns.useRef(e !== void 0);
    ns.useEffect(() => {
      let p = u.current;
      (p !== A &&
        console.warn(
          `${r} is changing from ${p ? "controlled" : "uncontrolled"} to ${A ? "controlled" : "uncontrolled"}. Components should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component.`,
        ),
        (u.current = A));
    }, [A, r]);
  }
  let l = ns.useCallback(
    (u) => {
      if (A) {
        let p = HD(u) ? u(e) : u;
        p !== e && o.current?.(p);
      } else i(u);
    },
    [A, e, i, o],
  );
  return [s, l];
}
_0(is, "useControllableState");
function MD({ defaultProp: e, onChange: t }) {
  let [a, r] = ns.useState(e),
    n = ns.useRef(a),
    i = ns.useRef(t);
  return (
    t$(() => {
      i.current = t;
    }, [t]),
    ns.useEffect(() => {
      n.current !== a && (i.current?.(a), (n.current = a));
    }, [a, n]),
    [a, r, i]
  );
}
_0(MD, "useUncontrolledState");
function HD(e) {
  return typeof e == "function";
}
_0(HD, "isFunction");
var PD = Symbol("RADIX:SYNC_STATE");
function a$(e, t, a, r) {
  let { prop: n, defaultProp: i, onChange: o, caller: A } = t,
    s = n !== void 0,
    l = lL(o);
  if (Ww) {
    let x = Ms.useRef(n !== void 0);
    Ms.useEffect(() => {
      let w = x.current;
      (w !== s &&
        console.warn(
          `${A} is changing from ${w ? "controlled" : "uncontrolled"} to ${s ? "controlled" : "uncontrolled"}. Components should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component.`,
        ),
        (x.current = s));
    }, [s, A]);
  }
  let u = [{ ...a, state: i }];
  r && u.push(r);
  let [p, v] = Ms.useReducer(
      (x, w) => {
        if (w.type === PD) return { ...x, state: w.state };
        let S = e(x, w);
        return (s && !Object.is(S.state, x.state) && l(S.state), S);
      },
      ...u,
    ),
    c = p.state,
    B = Ms.useRef(c);
  Ms.useEffect(() => {
    B.current !== c && ((B.current = c), s || l(c));
  }, [c, B, s]);
  let C = Ms.useMemo(() => (n !== void 0 ? { ...p, state: n } : p), [p, n]);
  return (
    Ms.useEffect(() => {
      s && !Object.is(n, p.state) && v({ type: PD, state: n });
    }, [n, p.state, s]),
    [C, v]
  );
}
_0(a$, "useControllableStateReducer");
var Ui = Me(Qt(), 1);
var qD = Me(Qt(), 1),
  r$ = Object.defineProperty,
  Nu = (e, t) => r$(e, "name", { value: t, configurable: !0 });
function zD(e, t) {
  return qD.useReducer((a, r) => t[a][r] ?? a, e);
}
Nu(zD, "useStateMachine");
var Tl = Nu((e) => {
  let { present: t, children: a } = e,
    r = VD(t),
    n = typeof a == "function" ? a({ present: r.isPresent }) : Ui.Children.only(a),
    i = KD(r.ref, GD(n));
  return typeof a == "function" || r.isPresent ? Ui.cloneElement(n, { ref: i }) : null;
}, "Presence");
function VD(e) {
  let [t, a] = Ui.useState(),
    r = Ui.useRef(null),
    n = Ui.useRef(e),
    i = Ui.useRef("none"),
    o = Ui.useRef(void 0),
    A = e ? "mounted" : "unmounted",
    [s, l] = zD(A, {
      mounted: { UNMOUNT: "unmounted", ANIMATION_OUT: "unmountSuspended" },
      unmountSuspended: { MOUNT: "mounted", ANIMATION_END: "unmounted" },
      unmounted: { MOUNT: "mounted" },
    });
  return (
    Ui.useEffect(() => {
      s === "mounted"
        ? ((i.current = o.current ?? Gp(r.current)), (o.current = void 0))
        : (i.current = "none");
    }, [s]),
    Wa(() => {
      let u = r.current,
        p = n.current;
      if (p !== e) {
        let c = i.current,
          B = Gp(u);
        (e
          ? ((o.current = B), l("MOUNT"))
          : B === "none" || u?.display === "none"
            ? l("UNMOUNT")
            : l(p && c !== B ? "ANIMATION_OUT" : "UNMOUNT"),
          (n.current = e));
      }
    }, [e, l]),
    Wa(() => {
      if (t) {
        let u,
          p = t.ownerDocument.defaultView ?? window,
          v = Nu((B) => {
            let x = Gp(r.current).includes(CSS.escape(B.animationName));
            if (B.target === t && x && (l("ANIMATION_END"), !n.current)) {
              let w = t.style.animationFillMode;
              ((t.style.animationFillMode = "forwards"),
                (u = p.setTimeout(() => {
                  t.style.animationFillMode === "forwards" && (t.style.animationFillMode = w);
                })));
            }
          }, "handleAnimationEnd"),
          c = Nu((B) => {
            B.target === t && (i.current = Gp(r.current));
          }, "handleAnimationStart");
        return (
          t.addEventListener("animationstart", c),
          t.addEventListener("animationcancel", v),
          t.addEventListener("animationend", v),
          () => {
            (p.clearTimeout(u),
              t.removeEventListener("animationstart", c),
              t.removeEventListener("animationcancel", v),
              t.removeEventListener("animationend", v));
          }
        );
      } else l("ANIMATION_END");
    }, [t, l]),
    {
      isPresent: ["mounted", "unmountSuspended"].includes(s),
      ref: Ui.useCallback((u) => {
        if (u) {
          let p = getComputedStyle(u);
          ((r.current = p), (o.current = Gp(p)));
        } else r.current = null;
        a(u);
      }, []),
    }
  );
}
Nu(VD, "usePresence");
function uL(e, t) {
  if (typeof e == "function") return e(t);
  e != null && (e.current = t);
}
Nu(uL, "setRef");
function KD(...e) {
  let t = Ui.useRef(e);
  return (
    (t.current = e),
    Ui.useCallback((a) => {
      let r = t.current,
        n = !1,
        i = r.map((o) => {
          let A = uL(o, a);
          return (!n && typeof A == "function" && (n = !0), A);
        });
      if (n)
        return () => {
          for (let o = 0; o < i.length; o++) {
            let A = i[o];
            typeof A == "function" ? A() : uL(r[o], null);
          }
        };
    }, [])
  );
}
Nu(KD, "useStableComposedRefs");
function Gp(e) {
  return e?.animationName || "none";
}
Nu(Gp, "getAnimationName");
function GD(e) {
  let t = Object.getOwnPropertyDescriptor(e.props, "ref")?.get,
    a = t && "isReactWarning" in t && t.isReactWarning;
  return a
    ? e.ref
    : ((t = Object.getOwnPropertyDescriptor(e, "ref")?.get),
      (a = t && "isReactWarning" in t && t.isReactWarning),
      a ? e.props.ref : e.props.ref || e.ref);
}
Nu(GD, "getElementRef");
var cL = Me(Qt(), 1);
var n$ = Object.defineProperty,
  i$ = (e, t) => n$(e, "name", { value: t, configurable: !0 }),
  o$ = cL[" useId ".trim().toString()] || (() => {}),
  A$ = 0;
function SA(e) {
  let [t, a] = cL.useState(o$());
  return (
    Wa(() => {
      e || a((r) => r ?? String(A$++));
    }, [e]),
    e || (t ? `radix-${t}` : "")
  );
}
i$(SA, "useId");
var Xw = Me(Qt(), 1),
  u$ = Me(_a(), 1),
  s$ = Object.defineProperty,
  l$ = (e, t) => s$(e, "name", { value: t, configurable: !0 }),
  c$ = Xw.createContext(void 0);
function bd(e) {
  let t = Xw.useContext(c$);
  return e || t || "ltr";
}
l$(bd, "useDirection");
var Gs = {};
hu(Gs, {
  Action: () => Eee,
  AlertDialog: () => jN,
  AlertDialogAction: () => ek,
  AlertDialogCancel: () => tk,
  AlertDialogContent: () => ZN,
  AlertDialogDescription: () => $N,
  AlertDialogOverlay: () => YN,
  AlertDialogPortal: () => XN,
  AlertDialogTitle: () => JN,
  AlertDialogTrigger: () => WN,
  Cancel: () => Fee,
  Content: () => Iee,
  Description: () => _ee,
  Overlay: () => Lee,
  Portal: () => See,
  Root: () => Cee,
  Title: () => Uee,
  Trigger: () => xee,
  createAlertDialogScope: () => vee,
});
var Vs = Me(Qt(), 1);
var jD = Me(Qt(), 1),
  f$ = Object.defineProperty,
  dL = (e, t) => f$(e, "name", { value: t, configurable: !0 });
function fL(e, t) {
  if (typeof e == "function") return e(t);
  e != null && (e.current = t);
}
dL(fL, "setRef");
function WD(...e) {
  return (t) => {
    let a = !1,
      r = e.map((n) => {
        let i = fL(n, t);
        return (!a && typeof i == "function" && (a = !0), i);
      });
    if (a)
      return () => {
        for (let n = 0; n < r.length; n++) {
          let i = r[n];
          typeof i == "function" ? i() : fL(e[n], null);
        }
      };
  };
}
dL(WD, "composeRefs");
function Yw(...e) {
  return jD.useCallback(WD(...e), e);
}
dL(Yw, "useComposedRefs");
var zs = {};
hu(zs, {
  Close: () => d2,
  Content: () => tI,
  Description: () => rI,
  Dialog: () => ZL,
  DialogClose: () => d2,
  DialogContent: () => tI,
  DialogDescription: () => rI,
  DialogOverlay: () => eI,
  DialogPortal: () => $L,
  DialogTitle: () => aI,
  DialogTrigger: () => JL,
  Overlay: () => eI,
  Portal: () => $L,
  Root: () => ZL,
  Title: () => aI,
  Trigger: () => JL,
  WarningProvider: () => hee,
  createDialogScope: () => f2,
});
var xr = Me(Qt(), 1);
var XD = Me(Qt(), 1),
  d$ = Object.defineProperty,
  pL = (e, t) => d$(e, "name", { value: t, configurable: !0 });
function hL(e, t) {
  if (typeof e == "function") return e(t);
  e != null && (e.current = t);
}
pL(hL, "setRef");
function YD(...e) {
  return (t) => {
    let a = !1,
      r = e.map((n) => {
        let i = hL(n, t);
        return (!a && typeof i == "function" && (a = !0), i);
      });
    if (a)
      return () => {
        for (let n = 0; n < r.length; n++) {
          let i = r[n];
          typeof i == "function" ? i() : hL(e[n], null);
        }
      };
  };
}
pL(YD, "composeRefs");
function Cd(...e) {
  return XD.useCallback(YD(...e), e);
}
pL(Cd, "useComposedRefs");
var vr = Me(Qt(), 1);
var ZD = Me(Qt(), 1),
  h$ = Object.defineProperty,
  mL = (e, t) => h$(e, "name", { value: t, configurable: !0 });
function gL(e, t) {
  if (typeof e == "function") return e(t);
  e != null && (e.current = t);
}
mL(gL, "setRef");
function JD(...e) {
  return (t) => {
    let a = !1,
      r = e.map((n) => {
        let i = gL(n, t);
        return (!a && typeof i == "function" && (a = !0), i);
      });
    if (a)
      return () => {
        for (let n = 0; n < r.length; n++) {
          let i = r[n];
          typeof i == "function" ? i() : gL(e[n], null);
        }
      };
  };
}
mL(JD, "composeRefs");
function vL(...e) {
  return ZD.useCallback(JD(...e), e);
}
mL(vL, "useComposedRefs");
var jp = Me(Qt(), 1),
  p$ = Object.defineProperty,
  g$ = (e, t) => p$(e, "name", { value: t, configurable: !0 });
function Gi(e) {
  let t = jp.useRef(e);
  return (
    jp.useEffect(() => {
      t.current = e;
    }),
    jp.useMemo(
      () =>
        (...a) =>
          t.current?.(...a),
      [],
    )
  );
}
g$(Gi, "useCallbackRef");
var eN = Me(_a(), 1),
  m$ = Object.defineProperty,
  li = (e, t) => m$(e, "name", { value: t, configurable: !0 }),
  yL = "dismissableLayer.update",
  v$ = "dismissableLayer.pointerDownOutside",
  y$ = "dismissableLayer.focusOutside",
  $D,
  tN = vr.createContext({
    layers: new Set(),
    layersWithOutsidePointerEventsDisabled: new Set(),
    branches: new Set(),
    dismissableSurfaces: new Set(),
  }),
  Zw = vr.forwardRef(
    li(function (t, a) {
      let {
          disableOutsidePointerEvents: r = !1,
          deferPointerDownOutside: n = !1,
          onEscapeKeyDown: i,
          onPointerDownOutside: o,
          onFocusOutside: A,
          onInteractOutside: s,
          onDismiss: l,
          ...u
        } = t,
        p = vr.useContext(tN),
        [v, c] = vr.useState(null),
        B = v?.ownerDocument ?? globalThis?.document,
        [, C] = vr.useState({}),
        x = vL(a, c),
        w = Array.from(p.layers),
        [S] = [...p.layersWithOutsidePointerEventsDisabled].slice(-1),
        L = S ? w.indexOf(S) : -1,
        F = v ? w.indexOf(v) : -1,
        q = p.layersWithOutsidePointerEventsDisabled.size > 0,
        j = F >= L,
        z = vr.useRef(!1),
        k = aN(
          (H) => {
            (o?.(H), s?.(H), H.defaultPrevented || l?.());
          },
          {
            ownerDocument: B,
            deferPointerDownOutside: n,
            isDeferredPointerDownOutsideRef: z,
            dismissableSurfaces: p.dismissableSurfaces,
            shouldHandlePointerDownOutside: vr.useCallback(
              (H) => {
                if (!(H instanceof Node)) return !1;
                let te = [...p.branches].some((ee) => ee.contains(H));
                return j && !te;
              },
              [p.branches, j],
            ),
          },
        ),
        O = rN((H) => {
          if (n && z.current) return;
          let te = H.target;
          [...p.branches].some((ce) => ce.contains(te)) || (A?.(H), s?.(H), H.defaultPrevented || l?.());
        }, B),
        ne = v ? F === w.length - 1 : !1,
        D = Gi((H) => {
          H.key === "Escape" && (i?.(H), !H.defaultPrevented && l && (H.preventDefault(), l()));
        });
      return (
        vr.useEffect(() => {
          if (ne)
            return (
              B.addEventListener("keydown", D, { capture: !0 }),
              () => B.removeEventListener("keydown", D, { capture: !0 })
            );
        }, [B, ne, D]),
        vr.useEffect(() => {
          if (v)
            return (
              r &&
                (p.layersWithOutsidePointerEventsDisabled.size === 0 &&
                  (($D = B.body.style.pointerEvents), (B.body.style.pointerEvents = "none")),
                p.layersWithOutsidePointerEventsDisabled.add(v)),
              p.layers.add(v),
              wL(),
              () => {
                r &&
                  (p.layersWithOutsidePointerEventsDisabled.delete(v),
                  p.layersWithOutsidePointerEventsDisabled.size === 0 && (B.body.style.pointerEvents = $D));
              }
            );
        }, [v, B, r, p]),
        vr.useEffect(
          () => () => {
            v && (p.layers.delete(v), p.layersWithOutsidePointerEventsDisabled.delete(v), wL());
          },
          [v, p],
        ),
        vr.useEffect(() => {
          let H = li(() => C({}), "handleUpdate");
          return (document.addEventListener(yL, H), () => document.removeEventListener(yL, H));
        }, []),
        (0, eN.jsx)(ca.div, {
          ...u,
          ref: x,
          style: { pointerEvents: q ? (j ? "auto" : "none") : void 0, ...t.style },
          onFocusCapture: na(t.onFocusCapture, O.onFocusCapture),
          onBlurCapture: na(t.onBlurCapture, O.onBlurCapture),
          onPointerDownCapture: na(t.onPointerDownCapture, k.onPointerDownCapture),
        })
      );
    }, "DismissableLayer"),
  );
function BL() {
  let e = vr.useContext(tN),
    [t, a] = vr.useState(null);
  return (
    vr.useEffect(() => {
      if (t)
        return (
          e.dismissableSurfaces.add(t),
          () => {
            e.dismissableSurfaces.delete(t);
          }
        );
    }, [t, e.dismissableSurfaces]),
    a
  );
}
li(BL, "useDismissableLayerSurface");
var w$ = li(() => !0, "IS_TRUE");
function aN(e, t) {
  let {
      ownerDocument: a = globalThis?.document,
      deferPointerDownOutside: r = !1,
      isDeferredPointerDownOutsideRef: n,
      dismissableSurfaces: i,
      shouldHandlePointerDownOutside: o = w$,
    } = t,
    A = Gi(e),
    s = vr.useRef(!1),
    l = vr.useRef(!1),
    u = vr.useRef(new Map()),
    p = vr.useRef(() => {});
  return (
    vr.useEffect(() => {
      function v() {
        ((l.current = !1), (n.current = !1), u.current.clear());
      }
      li(v, "resetOutsideInteraction");
      function c() {
        return Array.from(u.current.values()).some(Boolean);
      }
      li(c, "isOutsideInteractionIntercepted");
      function B(L) {
        if (!l.current) return;
        let F = L.target;
        ((F instanceof Node && [...i].some((j) => j.contains(F))) || u.current.set(L.type, !0),
          L.type === "click" &&
            window.setTimeout(() => {
              l.current && p.current();
            }, 0));
      }
      li(B, "handleInteractionCapture");
      function C(L) {
        l.current && u.current.set(L.type, !1);
      }
      li(C, "handleInteractionBubble");
      let x = li((L) => {
          if (L.target && !s.current) {
            let q = function () {
              a.removeEventListener("click", p.current);
              let z = c();
              (v(), z || bL(v$, A, j, { discrete: !0 }));
            };
            var F = q;
            if ((li(q, "handleAndDispatchPointerDownOutsideEvent"), !o(L.target))) {
              (a.removeEventListener("click", p.current), v(), (s.current = !1));
              return;
            }
            let j = { originalEvent: L };
            ((l.current = !0),
              (n.current = r && L.button === 0),
              u.current.clear(),
              !r || L.button !== 0
                ? q()
                : (a.removeEventListener("click", p.current),
                  (p.current = q),
                  a.addEventListener("click", p.current, { once: !0 })));
          } else (a.removeEventListener("click", p.current), v());
          s.current = !1;
        }, "handlePointerDown"),
        w = ["pointerup", "mousedown", "mouseup", "touchstart", "touchend", "click"];
      for (let L of w) (a.addEventListener(L, B, !0), a.addEventListener(L, C));
      let S = window.setTimeout(() => {
        a.addEventListener("pointerdown", x);
      }, 0);
      return () => {
        (window.clearTimeout(S),
          a.removeEventListener("pointerdown", x),
          a.removeEventListener("click", p.current));
        for (let L of w) (a.removeEventListener(L, B, !0), a.removeEventListener(L, C));
      };
    }, [a, A, r, n, i, o]),
    { onPointerDownCapture: li(() => (s.current = !0), "onPointerDownCapture") }
  );
}
li(aN, "usePointerDownOutside");
function rN(e, t = globalThis?.document) {
  let a = Gi(e),
    r = vr.useRef(!1);
  return (
    vr.useEffect(() => {
      let n = li((i) => {
        i.target && !r.current && bL(y$, a, { originalEvent: i }, { discrete: !1 });
      }, "handleFocus");
      return (t.addEventListener("focusin", n), () => t.removeEventListener("focusin", n));
    }, [t, a]),
    {
      onFocusCapture: li(() => (r.current = !0), "onFocusCapture"),
      onBlurCapture: li(() => (r.current = !1), "onBlurCapture"),
    }
  );
}
li(rN, "useFocusOutside");
function wL() {
  let e = new CustomEvent(yL);
  document.dispatchEvent(e);
}
li(wL, "dispatchUpdate");
function bL(e, t, a, { discrete: r }) {
  let n = a.originalEvent.target,
    i = new CustomEvent(e, { bubbles: !1, cancelable: !0, detail: a });
  (t && n.addEventListener(e, t, { once: !0 }), r ? eL(n, i) : n.dispatchEvent(i));
}
li(bL, "handleAndDispatchCustomEvent");
var os = Me(Qt(), 1);
var nN = Me(Qt(), 1),
  B$ = Object.defineProperty,
  xL = (e, t) => B$(e, "name", { value: t, configurable: !0 });
function CL(e, t) {
  if (typeof e == "function") return e(t);
  e != null && (e.current = t);
}
xL(CL, "setRef");
function iN(...e) {
  return (t) => {
    let a = !1,
      r = e.map((n) => {
        let i = CL(n, t);
        return (!a && typeof i == "function" && (a = !0), i);
      });
    if (a)
      return () => {
        for (let n = 0; n < r.length; n++) {
          let i = r[n];
          typeof i == "function" ? i() : CL(e[n], null);
        }
      };
  };
}
xL(iN, "composeRefs");
function SL(...e) {
  return nN.useCallback(iN(...e), e);
}
xL(SL, "useComposedRefs");
var sN = Me(_a(), 1),
  b$ = Object.defineProperty,
  vo = (e, t) => b$(e, "name", { value: t, configurable: !0 }),
  LL = "focusScope.autoFocusOnMount",
  IL = "focusScope.autoFocusOnUnmount",
  oN = { bubbles: !1, cancelable: !0 },
  Jw = os.forwardRef(
    vo(function (t, a) {
      let { loop: r = !1, trapped: n = !1, onMountAutoFocus: i, onUnmountAutoFocus: o, ...A } = t,
        [s, l] = os.useState(null),
        u = Gi(i),
        p = Gi(o),
        v = os.useRef(null),
        c = SL(a, l),
        B = os.useRef({
          paused: !1,
          pause() {
            this.paused = !0;
          },
          resume() {
            this.paused = !1;
          },
        }).current;
      (os.useEffect(() => {
        if (n) {
          let L = function (z) {
              if (B.paused || !s) return;
              let k = z.target;
              s.contains(k) ? (v.current = k) : ku(v.current, { select: !0 });
            },
            F = function (z) {
              if (B.paused || !s) return;
              let k = z.relatedTarget;
              k !== null && (s.contains(k) || ku(v.current, { select: !0 }));
            },
            q = function (z) {
              if (document.activeElement === document.body)
                for (let O of z) O.removedNodes.length > 0 && ku(s);
            };
          var x = L,
            w = F,
            S = q;
          (vo(L, "handleFocusIn"),
            vo(F, "handleFocusOut"),
            vo(q, "handleMutations"),
            document.addEventListener("focusin", L),
            document.addEventListener("focusout", F));
          let j = new MutationObserver(q);
          return (
            s && j.observe(s, { childList: !0, subtree: !0 }),
            () => {
              (document.removeEventListener("focusin", L),
                document.removeEventListener("focusout", F),
                j.disconnect());
            }
          );
        }
      }, [n, s, B.paused]),
        os.useEffect(() => {
          if (s) {
            AN.add(B);
            let x = document.activeElement;
            if (!s.contains(x)) {
              let S = new CustomEvent(LL, oN);
              (s.addEventListener(LL, u),
                s.dispatchEvent(S),
                S.defaultPrevented || (lN(hN(UL(s)), { select: !0 }), document.activeElement === x && ku(s)));
            }
            return () => {
              (s.removeEventListener(LL, u),
                setTimeout(() => {
                  let S = new CustomEvent(IL, oN);
                  (s.addEventListener(IL, p),
                    s.dispatchEvent(S),
                    S.defaultPrevented || ku(x ?? document.body, { select: !0 }),
                    s.removeEventListener(IL, p),
                    AN.remove(B));
                }, 0));
            };
          }
        }, [s, u, p, B]));
      let C = os.useCallback(
        (x) => {
          if ((!r && !n) || B.paused) return;
          let w = x.key === "Tab" && !x.altKey && !x.ctrlKey && !x.metaKey,
            S = document.activeElement;
          if (w && S) {
            let L = x.currentTarget,
              [F, q] = uN(L);
            F && q
              ? !x.shiftKey && S === q
                ? (x.preventDefault(), r && ku(F, { select: !0 }))
                : x.shiftKey && S === F && (x.preventDefault(), r && ku(q, { select: !0 }))
              : S === L && x.preventDefault();
          }
        },
        [r, n, B.paused],
      );
      return (0, sN.jsx)(ca.div, { tabIndex: -1, ...A, ref: c, onKeyDown: C });
    }, "FocusScope"),
  );
function lN(e, { select: t = !1 } = {}) {
  let a = document.activeElement;
  for (let r of e) if ((ku(r, { select: t }), document.activeElement !== a)) return;
}
vo(lN, "focusFirst");
function uN(e) {
  let t = UL(e),
    a = EL(t, e),
    r = EL(t.reverse(), e);
  return [a, r];
}
vo(uN, "getTabbableEdges");
function UL(e) {
  let t = [],
    a = document.createTreeWalker(e, NodeFilter.SHOW_ELEMENT, {
      acceptNode: vo((r) => {
        let n = r.tagName === "INPUT" && r.type === "hidden";
        return r.disabled || r.hidden || n
          ? NodeFilter.FILTER_SKIP
          : r.tabIndex >= 0
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
      }, "acceptNode"),
    });
  for (; a.nextNode(); ) t.push(a.currentNode);
  return t;
}
vo(UL, "getTabbableCandidates");
function EL(e, t) {
  let a = typeof t.checkVisibility == "function" && t.checkVisibility({ checkVisibilityCSS: !0 });
  for (let r of e) if (!(a ? !r.checkVisibility({ checkVisibilityCSS: !0 }) : cN(r, { upTo: t }))) return r;
}
vo(EL, "findVisible");
function cN(e, { upTo: t }) {
  if (getComputedStyle(e).visibility === "hidden") return !0;
  for (; e; ) {
    if (t !== void 0 && e === t) return !1;
    if (getComputedStyle(e).display === "none") return !0;
    e = e.parentElement;
  }
  return !1;
}
vo(cN, "isHidden");
function fN(e) {
  return e instanceof HTMLInputElement && "select" in e;
}
vo(fN, "isSelectableInput");
function ku(e, { select: t = !1 } = {}) {
  if (e && e.focus) {
    let a = document.activeElement;
    (e.focus({ preventScroll: !0 }), e !== a && fN(e) && t && e.select());
  }
}
vo(ku, "focus");
var AN = dN();
function dN() {
  let e = [];
  return {
    add(t) {
      let a = e[0];
      (t !== a && a?.pause(), (e = FL(e, t)), e.unshift(t));
    },
    remove(t) {
      ((e = FL(e, t)), e[0]?.resume());
    },
  };
}
vo(dN, "createFocusScopesStack");
function FL(e, t) {
  let a = [...e],
    r = a.indexOf(t);
  return (r !== -1 && a.splice(r, 1), a);
}
vo(FL, "arrayRemove");
function hN(e) {
  return e.filter((t) => t.tagName !== "A");
}
vo(hN, "removeLinks");
var $w = Me(Qt(), 1),
  pN = Me(Yh(), 1);
var gN = Me(_a(), 1),
  C$ = Object.defineProperty,
  x$ = (e, t) => C$(e, "name", { value: t, configurable: !0 }),
  e2 = $w.forwardRef(
    x$(function (t, a) {
      let { container: r, ...n } = t,
        [i, o] = $w.useState(!1);
      Wa(() => o(!0), []);
      let A = r || (i && globalThis?.document?.body);
      return A ? pN.createPortal((0, gN.jsx)(ca.div, { ...n, ref: a }), A) : null;
    }, "Portal"),
  );
var mN = Me(Qt(), 1),
  S$ = Object.defineProperty,
  TL = (e, t) => S$(e, "name", { value: t, configurable: !0 }),
  t2 = 0,
  Wp = null;
function L$(e) {
  return (Xp(), e.children);
}
TL(L$, "FocusGuards");
function Xp() {
  mN.useEffect(() => {
    Wp || (Wp = { start: _L(), end: _L() });
    let { start: e, end: t } = Wp;
    return (
      document.body.firstElementChild !== e && document.body.insertAdjacentElement("afterbegin", e),
      document.body.lastElementChild !== t && document.body.insertAdjacentElement("beforeend", t),
      t2++,
      () => {
        (t2 === 1 && (Wp?.start.remove(), Wp?.end.remove(), (Wp = null)), (t2 = Math.max(0, t2 - 1)));
      }
    );
  }, []);
}
TL(Xp, "useFocusGuards");
function _L() {
  let e = document.createElement("span");
  return (
    e.setAttribute("data-radix-focus-guard", ""),
    (e.tabIndex = 0),
    (e.style.outline = "none"),
    (e.style.opacity = "0"),
    (e.style.position = "fixed"),
    (e.style.pointerEvents = "none"),
    e
  );
}
TL(_L, "createFocusGuard");
var Ko = function () {
  return (
    (Ko =
      Object.assign ||
      function (t) {
        for (var a, r = 1, n = arguments.length; r < n; r++) {
          a = arguments[r];
          for (var i in a) Object.prototype.hasOwnProperty.call(a, i) && (t[i] = a[i]);
        }
        return t;
      }),
    Ko.apply(this, arguments)
  );
};
function a2(e, t) {
  var a = {};
  for (var r in e) Object.prototype.hasOwnProperty.call(e, r) && t.indexOf(r) < 0 && (a[r] = e[r]);
  if (e != null && typeof Object.getOwnPropertySymbols == "function")
    for (var n = 0, r = Object.getOwnPropertySymbols(e); n < r.length; n++)
      t.indexOf(r[n]) < 0 && Object.prototype.propertyIsEnumerable.call(e, r[n]) && (a[r[n]] = e[r[n]]);
  return a;
}
function vN(e, t, a) {
  if (a || arguments.length === 2)
    for (var r = 0, n = t.length, i; r < n; r++)
      (i || !(r in t)) && (i || (i = Array.prototype.slice.call(t, 0, r)), (i[r] = t[r]));
  return e.concat(i || Array.prototype.slice.call(t));
}
var A2 = Me(Qt());
var ji = Me(Qt());
var xd = "right-scroll-bar-position",
  Sd = "width-before-scroll-bar",
  RL = "with-scroll-bars-hidden",
  QL = "--removed-body-scroll-bar-size";
function r2(e, t) {
  return (typeof e == "function" ? e(t) : e && (e.current = t), e);
}
var yN = Me(Qt());
function wN(e, t) {
  var a = (0, yN.useState)(function () {
    return {
      value: e,
      callback: t,
      facade: {
        get current() {
          return a.value;
        },
        set current(r) {
          var n = a.value;
          n !== r && ((a.value = r), a.callback(r, n));
        },
      },
    };
  })[0];
  return ((a.callback = t), a.facade);
}
var n2 = Me(Qt());
var I$ = typeof window < "u" ? n2.useLayoutEffect : n2.useEffect,
  BN = new WeakMap();
function OL(e, t) {
  var a = wN(t || null, function (r) {
    return e.forEach(function (n) {
      return r2(n, r);
    });
  });
  return (
    I$(
      function () {
        var r = BN.get(a);
        if (r) {
          var n = new Set(r),
            i = new Set(e),
            o = a.current;
          (n.forEach(function (A) {
            i.has(A) || r2(A, null);
          }),
            i.forEach(function (A) {
              n.has(A) || r2(A, o);
            }));
        }
        BN.set(a, e);
      },
      [e],
    ),
    a
  );
}
function E$(e) {
  return e;
}
function F$(e, t) {
  t === void 0 && (t = E$);
  var a = [],
    r = !1,
    n = {
      read: function () {
        if (r)
          throw new Error(
            "Sidecar: could not `read` from an `assigned` medium. `read` could be used only with `useMedium`.",
          );
        return a.length ? a[a.length - 1] : e;
      },
      useMedium: function (i) {
        var o = t(i, r);
        return (
          a.push(o),
          function () {
            a = a.filter(function (A) {
              return A !== o;
            });
          }
        );
      },
      assignSyncMedium: function (i) {
        for (r = !0; a.length; ) {
          var o = a;
          ((a = []), o.forEach(i));
        }
        a = {
          push: function (A) {
            return i(A);
          },
          filter: function () {
            return a;
          },
        };
      },
      assignMedium: function (i) {
        r = !0;
        var o = [];
        if (a.length) {
          var A = a;
          ((a = []), A.forEach(i), (o = a));
        }
        var s = function () {
            var u = o;
            ((o = []), u.forEach(i));
          },
          l = function () {
            return Promise.resolve().then(s);
          };
        (l(),
          (a = {
            push: function (u) {
              (o.push(u), l());
            },
            filter: function (u) {
              return ((o = o.filter(u)), a);
            },
          }));
      },
    };
  return n;
}
function DL(e) {
  e === void 0 && (e = {});
  var t = F$(null);
  return ((t.options = Ko({ async: !0, ssr: !1 }, e)), t);
}
var bN = Me(Qt()),
  CN = function (e) {
    var t = e.sideCar,
      a = a2(e, ["sideCar"]);
    if (!t) throw new Error("Sidecar: please provide `sideCar` property to import the right car");
    var r = t.read();
    if (!r) throw new Error("Sidecar medium not found");
    return bN.createElement(r, Ko({}, a));
  };
CN.isSideCarExport = !0;
function NL(e, t) {
  return (e.useMedium(t), CN);
}
var i2 = DL();
var kL = function () {},
  T0 = ji.forwardRef(function (e, t) {
    var a = ji.useRef(null),
      r = ji.useState({ onScrollCapture: kL, onWheelCapture: kL, onTouchMoveCapture: kL }),
      n = r[0],
      i = r[1],
      o = e.forwardProps,
      A = e.children,
      s = e.className,
      l = e.removeScrollBar,
      u = e.enabled,
      p = e.shards,
      v = e.sideCar,
      c = e.noRelative,
      B = e.noIsolation,
      C = e.inert,
      x = e.allowPinchZoom,
      w = e.as,
      S = w === void 0 ? "div" : w,
      L = e.gapMode,
      F = a2(e, [
        "forwardProps",
        "children",
        "className",
        "removeScrollBar",
        "enabled",
        "shards",
        "sideCar",
        "noRelative",
        "noIsolation",
        "inert",
        "allowPinchZoom",
        "as",
        "gapMode",
      ]),
      q = v,
      j = OL([a, t]),
      z = Ko(Ko({}, F), n);
    return ji.createElement(
      ji.Fragment,
      null,
      u &&
        ji.createElement(q, {
          sideCar: i2,
          removeScrollBar: l,
          shards: p,
          noRelative: c,
          noIsolation: B,
          inert: C,
          setCallbacks: i,
          allowPinchZoom: !!x,
          lockRef: a,
          gapMode: L,
        }),
      o
        ? ji.cloneElement(ji.Children.only(A), Ko(Ko({}, z), { ref: j }))
        : ji.createElement(S, Ko({}, z, { className: s, ref: j }), A),
    );
  });
T0.defaultProps = { enabled: !0, removeScrollBar: !0, inert: !1 };
T0.classNames = { fullWidth: Sd, zeroRight: xd };
var Tr = Me(Qt());
var Zp = Me(Qt());
var LN = Me(Qt());
var xN;
var SN = function () {
  if (xN) return xN;
  if (typeof __webpack_nonce__ < "u") return __webpack_nonce__;
};
function U$() {
  if (!document) return null;
  var e = document.createElement("style");
  e.type = "text/css";
  var t = SN();
  return (t && e.setAttribute("nonce", t), e);
}
function _$(e, t) {
  e.styleSheet ? (e.styleSheet.cssText = t) : e.appendChild(document.createTextNode(t));
}
function T$(e) {
  var t = document.head || document.getElementsByTagName("head")[0];
  t.appendChild(e);
}
var PL = function () {
  var e = 0,
    t = null;
  return {
    add: function (a) {
      (e == 0 && (t = U$()) && (_$(t, a), T$(t)), e++);
    },
    remove: function () {
      (e--, !e && t && (t.parentNode && t.parentNode.removeChild(t), (t = null)));
    },
  };
};
var ML = function () {
  var e = PL();
  return function (t, a) {
    LN.useEffect(
      function () {
        return (
          e.add(t),
          function () {
            e.remove();
          }
        );
      },
      [t && a],
    );
  };
};
var R0 = function () {
  var e = ML(),
    t = function (a) {
      var r = a.styles,
        n = a.dynamic;
      return (e(r, n), null);
    };
  return t;
};
var R$ = { left: 0, top: 0, right: 0, gap: 0 },
  HL = function (e) {
    return parseInt(e || "", 10) || 0;
  },
  Q$ = function (e) {
    var t = window.getComputedStyle(document.body),
      a = t[e === "padding" ? "paddingLeft" : "marginLeft"],
      r = t[e === "padding" ? "paddingTop" : "marginTop"],
      n = t[e === "padding" ? "paddingRight" : "marginRight"];
    return [HL(a), HL(r), HL(n)];
  },
  qL = function (e) {
    if ((e === void 0 && (e = "margin"), typeof window > "u")) return R$;
    var t = Q$(e),
      a = document.documentElement.clientWidth,
      r = window.innerWidth;
    return { left: t[0], top: t[1], right: t[2], gap: Math.max(0, r - a + t[2] - t[0]) };
  };
var O$ = R0(),
  Yp = "data-scroll-locked",
  D$ = function (e, t, a, r) {
    var n = e.left,
      i = e.top,
      o = e.right,
      A = e.gap;
    return (
      a === void 0 && (a = "margin"),
      `
  .`
        .concat(
          RL,
          ` {
   overflow: hidden `,
        )
        .concat(
          r,
          `;
   padding-right: `,
        )
        .concat(A, "px ")
        .concat(
          r,
          `;
  }
  body[`,
        )
        .concat(
          Yp,
          `] {
    overflow: hidden `,
        )
        .concat(
          r,
          `;
    overscroll-behavior: contain;
    `,
        )
        .concat(
          [
            t && "position: relative ".concat(r, ";"),
            a === "margin" &&
              `
    padding-left: `
                .concat(
                  n,
                  `px;
    padding-top: `,
                )
                .concat(
                  i,
                  `px;
    padding-right: `,
                )
                .concat(
                  o,
                  `px;
    margin-left:0;
    margin-top:0;
    margin-right: `,
                )
                .concat(A, "px ")
                .concat(
                  r,
                  `;
    `,
                ),
            a === "padding" && "padding-right: ".concat(A, "px ").concat(r, ";"),
          ]
            .filter(Boolean)
            .join(""),
          `
  }
  
  .`,
        )
        .concat(
          xd,
          ` {
    right: `,
        )
        .concat(A, "px ")
        .concat(
          r,
          `;
  }
  
  .`,
        )
        .concat(
          Sd,
          ` {
    margin-right: `,
        )
        .concat(A, "px ")
        .concat(
          r,
          `;
  }
  
  .`,
        )
        .concat(xd, " .")
        .concat(
          xd,
          ` {
    right: 0 `,
        )
        .concat(
          r,
          `;
  }
  
  .`,
        )
        .concat(Sd, " .")
        .concat(
          Sd,
          ` {
    margin-right: 0 `,
        )
        .concat(
          r,
          `;
  }
  
  body[`,
        )
        .concat(
          Yp,
          `] {
    `,
        )
        .concat(QL, ": ")
        .concat(
          A,
          `px;
  }
`,
        )
    );
  },
  IN = function () {
    var e = parseInt(document.body.getAttribute(Yp) || "0", 10);
    return isFinite(e) ? e : 0;
  },
  N$ = function () {
    Zp.useEffect(function () {
      return (
        document.body.setAttribute(Yp, (IN() + 1).toString()),
        function () {
          var e = IN() - 1;
          e <= 0 ? document.body.removeAttribute(Yp) : document.body.setAttribute(Yp, e.toString());
        }
      );
    }, []);
  },
  zL = function (e) {
    var t = e.noRelative,
      a = e.noImportant,
      r = e.gapMode,
      n = r === void 0 ? "margin" : r;
    N$();
    var i = Zp.useMemo(
      function () {
        return qL(n);
      },
      [n],
    );
    return Zp.createElement(O$, { styles: D$(i, !t, n, a ? "" : "!important") });
  };
var VL = !1;
if (typeof window < "u")
  try {
    ((Q0 = Object.defineProperty({}, "passive", {
      get: function () {
        return ((VL = !0), !0);
      },
    })),
      window.addEventListener("test", Q0, Q0),
      window.removeEventListener("test", Q0, Q0));
  } catch {
    VL = !1;
  }
var Q0,
  Ld = VL ? { passive: !1 } : !1;
var k$ = function (e) {
    return e.tagName === "TEXTAREA";
  },
  EN = function (e, t) {
    if (!(e instanceof Element)) return !1;
    var a = window.getComputedStyle(e);
    return a[t] !== "hidden" && !(a.overflowY === a.overflowX && !k$(e) && a[t] === "visible");
  },
  P$ = function (e) {
    return EN(e, "overflowY");
  },
  M$ = function (e) {
    return EN(e, "overflowX");
  },
  KL = function (e, t) {
    var a = t.ownerDocument,
      r = t;
    do {
      typeof ShadowRoot < "u" && r instanceof ShadowRoot && (r = r.host);
      var n = FN(e, r);
      if (n) {
        var i = UN(e, r),
          o = i[1],
          A = i[2];
        if (o > A) return !0;
      }
      r = r.parentNode;
    } while (r && r !== a.body);
    return !1;
  },
  H$ = function (e) {
    var t = e.scrollTop,
      a = e.scrollHeight,
      r = e.clientHeight;
    return [t, a, r];
  },
  q$ = function (e) {
    var t = e.scrollLeft,
      a = e.scrollWidth,
      r = e.clientWidth;
    return [t, a, r];
  },
  FN = function (e, t) {
    return e === "v" ? P$(t) : M$(t);
  },
  UN = function (e, t) {
    return e === "v" ? H$(t) : q$(t);
  },
  z$ = function (e, t) {
    return e === "h" && t === "rtl" ? -1 : 1;
  },
  _N = function (e, t, a, r, n) {
    var i = z$(e, window.getComputedStyle(t).direction),
      o = i * r,
      A = a.target,
      s = t.contains(A),
      l = !1,
      u = o > 0,
      p = 0,
      v = 0;
    do {
      if (!A) break;
      var c = UN(e, A),
        B = c[0],
        C = c[1],
        x = c[2],
        w = C - x - i * B;
      (B || w) && FN(e, A) && ((p += w), (v += B));
      var S = A.parentNode;
      A = S && S.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? S.host : S;
    } while ((!s && A !== document.body) || (s && (t.contains(A) || t === A)));
    return (
      ((u && ((n && Math.abs(p) < 1) || (!n && o > p))) ||
        (!u && ((n && Math.abs(v) < 1) || (!n && -o > v)))) &&
        (l = !0),
      l
    );
  };
var o2 = function (e) {
    return "changedTouches" in e ? [e.changedTouches[0].clientX, e.changedTouches[0].clientY] : [0, 0];
  },
  TN = function (e) {
    return [e.deltaX, e.deltaY];
  },
  RN = function (e) {
    return e && "current" in e ? e.current : e;
  },
  V$ = function (e, t) {
    return e[0] === t[0] && e[1] === t[1];
  },
  K$ = function (e) {
    return `
  .block-interactivity-`
      .concat(
        e,
        ` {pointer-events: none;}
  .allow-interactivity-`,
      )
      .concat(
        e,
        ` {pointer-events: all;}
`,
      );
  },
  G$ = 0,
  Jp = [];
function QN(e) {
  var t = Tr.useRef([]),
    a = Tr.useRef([0, 0]),
    r = Tr.useRef(),
    n = Tr.useState(G$++)[0],
    i = Tr.useState(R0)[0],
    o = Tr.useRef(e);
  (Tr.useEffect(
    function () {
      o.current = e;
    },
    [e],
  ),
    Tr.useEffect(
      function () {
        if (e.inert) {
          document.body.classList.add("block-interactivity-".concat(n));
          var C = vN([e.lockRef.current], (e.shards || []).map(RN), !0).filter(Boolean);
          return (
            C.forEach(function (x) {
              return x.classList.add("allow-interactivity-".concat(n));
            }),
            function () {
              (document.body.classList.remove("block-interactivity-".concat(n)),
                C.forEach(function (x) {
                  return x.classList.remove("allow-interactivity-".concat(n));
                }));
            }
          );
        }
      },
      [e.inert, e.lockRef.current, e.shards],
    ));
  var A = Tr.useCallback(function (C, x) {
      if (("touches" in C && C.touches.length === 2) || (C.type === "wheel" && C.ctrlKey))
        return !o.current.allowPinchZoom;
      var w = o2(C),
        S = a.current,
        L = "deltaX" in C ? C.deltaX : S[0] - w[0],
        F = "deltaY" in C ? C.deltaY : S[1] - w[1],
        q,
        j = C.target,
        z = Math.abs(L) > Math.abs(F) ? "h" : "v";
      if ("touches" in C && z === "h" && j.type === "range") return !1;
      var k = window.getSelection(),
        O = k && k.anchorNode,
        ne = O ? O === j || O.contains(j) : !1;
      if (ne) return !1;
      var D = KL(z, j);
      if (!D) return !0;
      if ((D ? (q = z) : ((q = z === "v" ? "h" : "v"), (D = KL(z, j))), !D)) return !1;
      if ((!r.current && "changedTouches" in C && (L || F) && (r.current = q), !q)) return !0;
      var H = r.current || q;
      return _N(H, x, C, H === "h" ? L : F, !0);
    }, []),
    s = Tr.useCallback(function (C) {
      var x = C;
      if (!(!Jp.length || Jp[Jp.length - 1] !== i)) {
        var w = "deltaY" in x ? TN(x) : o2(x),
          S = t.current.filter(function (q) {
            return (
              q.name === x.type && (q.target === x.target || x.target === q.shadowParent) && V$(q.delta, w)
            );
          })[0];
        if (S && S.should) {
          x.cancelable && x.preventDefault();
          return;
        }
        if (!S) {
          var L = (o.current.shards || [])
              .map(RN)
              .filter(Boolean)
              .filter(function (q) {
                return q.contains(x.target);
              }),
            F = L.length > 0 ? A(x, L[0]) : !o.current.noIsolation;
          F && x.cancelable && x.preventDefault();
        }
      }
    }, []),
    l = Tr.useCallback(function (C, x, w, S) {
      var L = { name: C, delta: x, target: w, should: S, shadowParent: j$(w) };
      (t.current.push(L),
        setTimeout(function () {
          t.current = t.current.filter(function (F) {
            return F !== L;
          });
        }, 1));
    }, []),
    u = Tr.useCallback(function (C) {
      ((a.current = o2(C)), (r.current = void 0));
    }, []),
    p = Tr.useCallback(function (C) {
      l(C.type, TN(C), C.target, A(C, e.lockRef.current));
    }, []),
    v = Tr.useCallback(function (C) {
      l(C.type, o2(C), C.target, A(C, e.lockRef.current));
    }, []);
  Tr.useEffect(function () {
    return (
      Jp.push(i),
      e.setCallbacks({ onScrollCapture: p, onWheelCapture: p, onTouchMoveCapture: v }),
      document.addEventListener("wheel", s, Ld),
      document.addEventListener("touchmove", s, Ld),
      document.addEventListener("touchstart", u, Ld),
      function () {
        ((Jp = Jp.filter(function (C) {
          return C !== i;
        })),
          document.removeEventListener("wheel", s, Ld),
          document.removeEventListener("touchmove", s, Ld),
          document.removeEventListener("touchstart", u, Ld));
      }
    );
  }, []);
  var c = e.removeScrollBar,
    B = e.inert;
  return Tr.createElement(
    Tr.Fragment,
    null,
    B ? Tr.createElement(i, { styles: K$(n) }) : null,
    c ? Tr.createElement(zL, { noRelative: e.noRelative, gapMode: e.gapMode }) : null,
  );
}
function j$(e) {
  for (var t = null; e !== null; )
    (e instanceof ShadowRoot && ((t = e.host), (e = e.host)), (e = e.parentNode));
  return t;
}
var ON = NL(i2, QN);
var DN = A2.forwardRef(function (e, t) {
  return A2.createElement(T0, Ko({}, e, { ref: t, sideCar: ON }));
});
DN.classNames = T0.classNames;
var O0 = DN;
var W$ = function (e) {
    if (typeof document > "u") return null;
    var t = Array.isArray(e) ? e[0] : e;
    return t.ownerDocument.body;
  },
  $p = new WeakMap(),
  s2 = new WeakMap(),
  l2 = {},
  GL = 0,
  NN = function (e) {
    return e && (e.host || NN(e.parentNode));
  },
  X$ = function (e, t) {
    return t
      .map(function (a) {
        if (e.contains(a)) return a;
        var r = NN(a);
        return r && e.contains(r)
          ? r
          : (console.error("aria-hidden", a, "in not contained inside", e, ". Doing nothing"), null);
      })
      .filter(function (a) {
        return !!a;
      });
  },
  Y$ = function (e, t, a, r) {
    var n = X$(t, Array.isArray(e) ? e : [e]);
    l2[a] || (l2[a] = new WeakMap());
    var i = l2[a],
      o = [],
      A = new Set(),
      s = new Set(n),
      l = function (p) {
        !p || A.has(p) || (A.add(p), l(p.parentNode));
      };
    n.forEach(l);
    var u = function (p) {
      !p ||
        s.has(p) ||
        Array.prototype.forEach.call(p.children, function (v) {
          if (A.has(v)) u(v);
          else
            try {
              var c = v.getAttribute(r),
                B = c !== null && c !== "false",
                C = ($p.get(v) || 0) + 1,
                x = (i.get(v) || 0) + 1;
              ($p.set(v, C),
                i.set(v, x),
                o.push(v),
                C === 1 && B && s2.set(v, !0),
                x === 1 && v.setAttribute(a, "true"),
                B || v.setAttribute(r, "true"));
            } catch (w) {
              console.error("aria-hidden: cannot operate on ", v, w);
            }
        });
    };
    return (
      u(t),
      A.clear(),
      GL++,
      function () {
        (o.forEach(function (p) {
          var v = $p.get(p) - 1,
            c = i.get(p) - 1;
          ($p.set(p, v),
            i.set(p, c),
            v || (s2.has(p) || p.removeAttribute(r), s2.delete(p)),
            c || p.removeAttribute(a));
        }),
          GL--,
          GL || (($p = new WeakMap()), ($p = new WeakMap()), (s2 = new WeakMap()), (l2 = {})));
      }
    );
  },
  u2 = function (e, t, a) {
    a === void 0 && (a = "data-aria-hidden");
    var r = Array.from(Array.isArray(e) ? e : [e]),
      n = t || W$(e);
    return n
      ? (r.push.apply(r, Array.from(n.querySelectorAll("[aria-live], script"))), Y$(r, n, a, "aria-hidden"))
      : function () {
          return null;
        };
  };
var _i = Me(Qt(), 1);
var Z$ = Object.defineProperty,
  Hs = (e, t) => Z$(e, "name", { value: t, configurable: !0 });
function WL(e) {
  let t = _i.forwardRef((a, r) => {
    let { children: n, ...i } = a,
      o = null,
      A = !1,
      s = [];
    (jL(n) && typeof c2 == "function" && (n = c2(n._payload)),
      _i.Children.forEach(n, (v) => {
        if (HN(v)) {
          A = !0;
          let c = v,
            B = "child" in c.props ? c.props.child : c.props.children;
          (jL(B) && typeof c2 == "function" && (B = c2(B._payload)),
            (o = $$(c, B)),
            s.push(o?.props?.children));
        } else s.push(v);
      }),
      o
        ? (o = _i.cloneElement(o, void 0, s))
        : !A && _i.Children.count(n) === 1 && _i.isValidElement(n) && (o = n));
    let l = o ? MN(o) : void 0,
      u = Cd(r, l);
    if (!o) {
      if (n || n === 0) throw new Error(A ? aee(e) : tee(e));
      return n;
    }
    let p = PN(i, o.props ?? {});
    return (o.type !== _i.Fragment && (p.ref = r ? u : l), _i.cloneElement(o, p));
  });
  return ((t.displayName = `${e}.Slot`), t);
}
Hs(WL, "createSlot");
var kN = Symbol.for("radix.slottable");
function J$(e) {
  let t = Hs((a) => ("child" in a ? a.children(a.child) : a.children), "Slottable");
  return ((t.displayName = `${e}.Slottable`), (t.__radixId = kN), t);
}
Hs(J$, "createSlottable");
var $$ = Hs((e, t) => {
  if ("child" in e.props) {
    let a = e.props.child;
    return _i.isValidElement(a) ? _i.cloneElement(a, void 0, e.props.children(a.props.children)) : null;
  }
  return _i.isValidElement(t) ? t : null;
}, "getSlottableElementFromSlottable");
function PN(e, t) {
  let a = { ...t };
  for (let r in t) {
    let n = e[r],
      i = t[r];
    /^on[A-Z]/.test(r)
      ? n && i
        ? (a[r] = (...A) => {
            let s = i(...A);
            return (n(...A), s);
          })
        : n && (a[r] = n)
      : r === "style"
        ? (a[r] = { ...n, ...i })
        : r === "className" && (a[r] = [n, i].filter(Boolean).join(" "));
  }
  return { ...e, ...a };
}
Hs(PN, "mergeProps");
function MN(e) {
  let t = Object.getOwnPropertyDescriptor(e.props, "ref")?.get,
    a = t && "isReactWarning" in t && t.isReactWarning;
  return a
    ? e.ref
    : ((t = Object.getOwnPropertyDescriptor(e, "ref")?.get),
      (a = t && "isReactWarning" in t && t.isReactWarning),
      a ? e.props.ref : e.props.ref || e.ref);
}
Hs(MN, "getElementRef");
function HN(e) {
  return (
    _i.isValidElement(e) && typeof e.type == "function" && "__radixId" in e.type && e.type.__radixId === kN
  );
}
Hs(HN, "isSlottable");
var eee = Symbol.for("react.lazy");
function jL(e) {
  return (
    e != null &&
    typeof e == "object" &&
    "$$typeof" in e &&
    e.$$typeof === eee &&
    "_payload" in e &&
    qN(e._payload)
  );
}
Hs(jL, "isLazyComponent");
function qN(e) {
  return typeof e == "object" && e !== null && "then" in e;
}
Hs(qN, "isPromiseLike");
var tee = Hs(
    (e) => `${e} failed to slot onto its children. Expected a single React element child or \`Slottable\`.`,
    "createSlotError",
  ),
  aee = Hs(
    (e) =>
      `${e} failed to slot onto its \`Slottable\`. Expected \`Slottable\` to receive a single React element child.`,
    "createSlottableError",
  ),
  c2 = _i[" use ".trim().toString()];
var Jr = Me(_a(), 1),
  ree = Object.defineProperty,
  Go = (e, t) => ree(e, "name", { value: t, configurable: !0 }),
  YL = "Dialog",
  [zN, f2] = Xn(YL),
  [nee, qs] = zN(YL),
  ZL = Go((e) => {
    let { __scopeDialog: t, children: a, open: r, defaultOpen: n, onOpenChange: i, modal: o = !0 } = e,
      A = xr.useRef(null),
      s = xr.useRef(null),
      [l, u] = is({ prop: r, defaultProp: n ?? !1, onChange: i, caller: YL }),
      [p, v] = xr.useState(0),
      [c, B] = xr.useState(0);
    return (0, Jr.jsx)(nee, {
      scope: t,
      triggerRef: A,
      contentRef: s,
      contentId: SA(),
      titleId: SA(),
      descriptionId: SA(),
      titlePresent: p > 0,
      descriptionPresent: c > 0,
      setTitleCount: v,
      setDescriptionCount: B,
      open: l,
      onOpenChange: u,
      onOpenToggle: xr.useCallback(() => u((C) => !C), [u]),
      modal: o,
      children: a,
    });
  }, "Dialog"),
  iee = "DialogTrigger",
  JL = xr.forwardRef(
    Go(function (t, a) {
      let { __scopeDialog: r, ...n } = t,
        i = qs(iee, r),
        o = Cd(a, i.triggerRef);
      return (0, Jr.jsx)(ca.button, {
        type: "button",
        "aria-haspopup": "dialog",
        "aria-expanded": i.open,
        "aria-controls": i.open ? i.contentId : void 0,
        "data-state": h2(i.open),
        ...n,
        ref: o,
        onClick: na(t.onClick, i.onOpenToggle),
      });
    }, "DialogTrigger"),
  ),
  VN = "DialogPortal",
  [oee, KN] = zN(VN, { forceMount: void 0 }),
  $L = Go((e) => {
    let { __scopeDialog: t, forceMount: a, children: r, container: n } = e,
      i = qs(VN, t);
    return (0, Jr.jsx)(oee, {
      scope: t,
      forceMount: a,
      children: xr.Children.map(r, (o) =>
        (0, Jr.jsx)(Tl, {
          present: a || i.open,
          children: (0, Jr.jsx)(e2, { asChild: !0, container: n, children: o }),
        }),
      ),
    });
  }, "DialogPortal"),
  XL = "DialogOverlay",
  eI = xr.forwardRef(
    Go(function (t, a) {
      let r = KN(XL, t.__scopeDialog),
        { forceMount: n = r.forceMount, ...i } = t,
        o = qs(XL, t.__scopeDialog);
      return o.modal
        ? (0, Jr.jsx)(Tl, { present: n || o.open, children: (0, Jr.jsx)(see, { ...i, ref: a }) })
        : null;
    }, "DialogOverlay"),
  ),
  Aee = WL("DialogOverlay.RemoveScroll"),
  see = xr.forwardRef(
    Go(function (t, a) {
      let { __scopeDialog: r, ...n } = t,
        i = qs(XL, r),
        o = BL(),
        A = Cd(a, o);
      return (0, Jr.jsx)(O0, {
        as: Aee,
        allowPinchZoom: !0,
        shards: [i.contentRef],
        children: (0, Jr.jsx)(ca.div, {
          "data-state": h2(i.open),
          ...n,
          ref: A,
          style: { pointerEvents: "auto", ...n.style },
        }),
      });
    }, "DialogOverlayImpl"),
  ),
  D0 = "DialogContent",
  tI = xr.forwardRef(
    Go(function (t, a) {
      let r = KN(D0, t.__scopeDialog),
        { forceMount: n = r.forceMount, ...i } = t,
        o = qs(D0, t.__scopeDialog);
      return (0, Jr.jsx)(Tl, {
        present: n || o.open,
        children: o.modal ? (0, Jr.jsx)(lee, { ...i, ref: a }) : (0, Jr.jsx)(uee, { ...i, ref: a }),
      });
    }, "DialogContent"),
  ),
  lee = xr.forwardRef(
    Go(function (t, a) {
      let r = qs(D0, t.__scopeDialog),
        n = xr.useRef(null),
        i = Cd(a, r.contentRef, n);
      return (
        xr.useEffect(() => {
          let o = n.current;
          if (o) return u2(o);
        }, []),
        (0, Jr.jsx)(GN, {
          ...t,
          ref: i,
          trapFocus: r.open,
          disableOutsidePointerEvents: r.open,
          onCloseAutoFocus: na(t.onCloseAutoFocus, (o) => {
            (o.preventDefault(), r.triggerRef.current?.focus());
          }),
          onPointerDownOutside: na(t.onPointerDownOutside, (o) => {
            let A = o.detail.originalEvent,
              s = A.button === 0 && A.ctrlKey === !0;
            (A.button === 2 || s) && o.preventDefault();
          }),
          onFocusOutside: na(t.onFocusOutside, (o) => o.preventDefault()),
        })
      );
    }, "DialogContentModal"),
  ),
  uee = xr.forwardRef(
    Go(function (t, a) {
      let r = qs(D0, t.__scopeDialog),
        n = xr.useRef(!1),
        i = xr.useRef(!1);
      return (0, Jr.jsx)(GN, {
        ...t,
        ref: a,
        trapFocus: !1,
        disableOutsidePointerEvents: !1,
        onCloseAutoFocus: (o) => {
          (t.onCloseAutoFocus?.(o),
            o.defaultPrevented || (n.current || r.triggerRef.current?.focus(), o.preventDefault()),
            (n.current = !1),
            (i.current = !1));
        },
        onInteractOutside: (o) => {
          (t.onInteractOutside?.(o),
            o.defaultPrevented ||
              ((n.current = !0), o.detail.originalEvent.type === "pointerdown" && (i.current = !0)));
          let A = o.target;
          (r.triggerRef.current?.contains(A) && o.preventDefault(),
            o.detail.originalEvent.type === "focusin" && i.current && o.preventDefault());
        },
      });
    }, "DialogContentNonModal"),
  ),
  GN = xr.forwardRef(
    Go(function (t, a) {
      let { __scopeDialog: r, trapFocus: n, onOpenAutoFocus: i, onCloseAutoFocus: o, ...A } = t,
        s = qs(D0, r);
      return (
        Xp(),
        (0, Jr.jsx)(Jr.Fragment, {
          children: (0, Jr.jsx)(Jw, {
            asChild: !0,
            loop: !0,
            trapped: n,
            onMountAutoFocus: i,
            onUnmountAutoFocus: o,
            children: (0, Jr.jsx)(Zw, {
              role: "dialog",
              id: s.contentId,
              "aria-describedby": s.descriptionPresent ? s.descriptionId : void 0,
              "aria-labelledby": s.titlePresent ? s.titleId : void 0,
              "data-state": h2(s.open),
              ...A,
              ref: a,
              deferPointerDownOutside: !0,
              onDismiss: () => s.onOpenChange(!1),
            }),
          }),
        })
      );
    }, "DialogContentImpl"),
  ),
  cee = "DialogTitle",
  aI = xr.forwardRef(
    Go(function (t, a) {
      let { __scopeDialog: r, ...n } = t,
        i = qs(cee, r),
        { setTitleCount: o } = i;
      return (
        Wa(() => (o((A) => A + 1), () => o((A) => A - 1)), [o]),
        (0, Jr.jsx)(ca.h2, { id: i.titleId, ...n, ref: a })
      );
    }, "DialogTitle"),
  ),
  fee = "DialogDescription",
  rI = xr.forwardRef(
    Go(function (t, a) {
      let { __scopeDialog: r, ...n } = t,
        i = qs(fee, r),
        { setDescriptionCount: o } = i;
      return (
        Wa(() => (o((A) => A + 1), () => o((A) => A - 1)), [o]),
        (0, Jr.jsx)(ca.p, { id: i.descriptionId, ...n, ref: a })
      );
    }, "DialogDescription"),
  ),
  dee = "DialogClose",
  d2 = xr.forwardRef(
    Go(function (t, a) {
      let { __scopeDialog: r, ...n } = t,
        i = qs(dee, r);
      return (0, Jr.jsx)(ca.button, {
        type: "button",
        ...n,
        ref: a,
        onClick: na(t.onClick, () => i.onOpenChange(!1)),
      });
    }, "DialogClose"),
  ),
  hee = Go((e) => e.children, "WarningProvider");
function h2(e) {
  return e ? "open" : "closed";
}
Go(h2, "getState");
var Ks = Me(_a(), 1),
  pee = Object.defineProperty,
  Pu = (e, t) => pee(e, "name", { value: t, configurable: !0 }),
  gee = "AlertDialog",
  [mee, vee] = Xn(gee, [f2]),
  Mu = f2(),
  jN = Pu((e) => {
    let { __scopeAlertDialog: t, ...a } = e,
      r = Mu(t);
    return (0, Ks.jsx)(ZL, { ...r, ...a, modal: !0 });
  }, "AlertDialog"),
  WN = Vs.forwardRef(
    Pu(function (t, a) {
      let { __scopeAlertDialog: r, ...n } = t,
        i = Mu(r);
      return (0, Ks.jsx)(JL, { ...i, ...n, ref: a });
    }, "AlertDialogTrigger"),
  ),
  XN = Pu((e) => {
    let { __scopeAlertDialog: t, ...a } = e,
      r = Mu(t);
    return (0, Ks.jsx)($L, { ...r, ...a });
  }, "AlertDialogPortal"),
  YN = Vs.forwardRef(
    Pu(function (t, a) {
      let { __scopeAlertDialog: r, ...n } = t,
        i = Mu(r);
      return (0, Ks.jsx)(eI, { ...i, ...n, ref: a });
    }, "AlertDialogOverlay"),
  ),
  yee = "AlertDialogContent",
  [wee, Bee] = mee(yee),
  ZN = Vs.forwardRef(
    Pu(function (t, a) {
      let { __scopeAlertDialog: r, children: n, ...i } = t,
        o = Mu(r),
        A = Vs.useRef(null),
        s = Yw(a, A),
        l = Vs.useRef(null);
      return (0, Ks.jsx)(wee, {
        scope: r,
        cancelRef: l,
        children: (0, Ks.jsx)(tI, {
          role: "alertdialog",
          ...o,
          ...i,
          ref: s,
          onOpenAutoFocus: na(i.onOpenAutoFocus, (u) => {
            (u.preventDefault(), l.current?.focus({ preventScroll: !0 }));
          }),
          onPointerDownOutside: (u) => u.preventDefault(),
          onInteractOutside: (u) => u.preventDefault(),
          children: n,
        }),
      });
    }, "AlertDialogContent"),
  ),
  JN = Vs.forwardRef(
    Pu(function (t, a) {
      let { __scopeAlertDialog: r, ...n } = t,
        i = Mu(r);
      return (0, Ks.jsx)(aI, { ...i, ...n, ref: a });
    }, "AlertDialogTitle"),
  ),
  $N = Vs.forwardRef(
    Pu(function (t, a) {
      let { __scopeAlertDialog: r, ...n } = t,
        i = Mu(r);
      return (0, Ks.jsx)(rI, { ...i, ...n, ref: a });
    }, "AlertDialogDescription"),
  ),
  ek = Vs.forwardRef(
    Pu(function (t, a) {
      let { __scopeAlertDialog: r, ...n } = t,
        i = Mu(r);
      return (0, Ks.jsx)(d2, { ...i, ...n, ref: a });
    }, "AlertDialogAction"),
  ),
  bee = "AlertDialogCancel",
  tk = Vs.forwardRef(
    Pu(function (t, a) {
      let { __scopeAlertDialog: r, ...n } = t,
        { cancelRef: i } = Bee(bee, r),
        o = Mu(r),
        A = Yw(a, i);
      return (0, Ks.jsx)(d2, { ...o, ...n, ref: A });
    }, "AlertDialogCancel"),
  ),
  Cee = jN,
  xee = WN,
  See = XN,
  Lee = YN,
  Iee = ZN,
  Eee = ek,
  Fee = tk,
  Uee = JN,
  _ee = $N;
var k0 = {};
hu(k0, {
  Checkbox: () => Mee,
  CheckboxIndicator: () => qee,
  Indicator: () => qee,
  Root: () => Mee,
  createCheckboxScope: () => Nee,
  unstable_BubbleInput: () => ok,
  unstable_CheckboxBubbleInput: () => ok,
  unstable_CheckboxProvider: () => sI,
  unstable_CheckboxTrigger: () => ik,
  unstable_Provider: () => sI,
  unstable_Trigger: () => ik,
});
var Rn = Me(Qt(), 1);
var ak = Me(Qt(), 1),
  Tee = Object.defineProperty,
  iI = (e, t) => Tee(e, "name", { value: t, configurable: !0 });
function nI(e, t) {
  if (typeof e == "function") return e(t);
  e != null && (e.current = t);
}
iI(nI, "setRef");
function rk(...e) {
  return (t) => {
    let a = !1,
      r = e.map((n) => {
        let i = nI(n, t);
        return (!a && typeof i == "function" && (a = !0), i);
      });
    if (a)
      return () => {
        for (let n = 0; n < r.length; n++) {
          let i = r[n];
          typeof i == "function" ? i() : nI(e[n], null);
        }
      };
  };
}
iI(rk, "composeRefs");
function p2(...e) {
  return ak.useCallback(rk(...e), e);
}
iI(p2, "useComposedRefs");
var nk = Me(Qt(), 1);
var Ree = Object.defineProperty,
  Qee = (e, t) => Ree(e, "name", { value: t, configurable: !0 });
function N0(e) {
  let [t, a] = nk.useState(void 0);
  return (
    Wa(() => {
      if (e) {
        a({ width: e.offsetWidth, height: e.offsetHeight });
        let r = new ResizeObserver((n) => {
          if (!Array.isArray(n) || !n.length) return;
          let i = n[0],
            o,
            A;
          if ("borderBoxSize" in i) {
            let s = i.borderBoxSize,
              l = Array.isArray(s) ? s[0] : s;
            ((o = l.inlineSize), (A = l.blockSize));
          } else ((o = e.offsetWidth), (A = e.offsetHeight));
          a({ width: o, height: A });
        });
        return (r.observe(e, { box: "border-box" }), () => r.unobserve(e));
      } else a(void 0);
    }, [e]),
    t
  );
}
Qee(N0, "useSize");
var LA = Me(_a(), 1),
  Oee = Object.defineProperty,
  qu = (e, t) => Oee(e, "name", { value: t, configurable: !0 }),
  oI = "Checkbox",
  [Dee, Nee] = Xn(oI),
  [kee, AI] = Dee(oI);
function sI(e) {
  let {
      __scopeCheckbox: t,
      checked: a,
      children: r,
      defaultChecked: n,
      disabled: i,
      form: o,
      name: A,
      onCheckedChange: s,
      required: l,
      value: u = "on",
      internal_do_not_use_render: p,
    } = e,
    [v, c] = is({ prop: a, defaultProp: n ?? !1, onChange: s, caller: oI }),
    [B, C] = Rn.useState(null),
    [x, w] = Rn.useState(null),
    S = Rn.useRef(!1),
    [L, F] = Rn.useReducer((z) => z + 1, 0),
    q = B ? !!o || !!B.closest("form") : !0,
    j = {
      checked: v,
      disabled: i,
      setChecked: c,
      control: B,
      setControl: C,
      name: A,
      form: o,
      value: u,
      hasConsumerStoppedPropagationRef: S,
      userInteractionCount: L,
      onUserInteraction: F,
      required: l,
      defaultChecked: Hu(n) ? !1 : n,
      isFormControl: q,
      bubbleInput: x,
      setBubbleInput: w,
    };
  return (0, LA.jsx)(kee, { scope: t, ...j, children: Ak(p) ? p(j) : r });
}
qu(sI, "CheckboxProvider");
var Pee = "CheckboxTrigger",
  ik = Rn.forwardRef(
    qu(function ({ __scopeCheckbox: t, onKeyDown: a, onClick: r, ...n }, i) {
      let {
          control: o,
          value: A,
          disabled: s,
          checked: l,
          required: u,
          setControl: p,
          setChecked: v,
          hasConsumerStoppedPropagationRef: c,
          onUserInteraction: B,
          isFormControl: C,
          bubbleInput: x,
        } = AI(Pee, t),
        w = p2(i, p),
        S = Rn.useRef(l);
      return (
        Rn.useEffect(() => {
          let L = o?.form;
          if (L) {
            let F = qu(() => v(S.current), "reset");
            return (L.addEventListener("reset", F), () => L.removeEventListener("reset", F));
          }
        }, [o, v]),
        (0, LA.jsx)(ca.button, {
          type: "button",
          role: "checkbox",
          "aria-checked": Hu(l) ? "mixed" : l,
          "aria-required": u,
          "data-state": lI(l),
          "data-disabled": s ? "" : void 0,
          disabled: s,
          value: A,
          ...n,
          ref: w,
          onKeyDown: na(a, (L) => {
            L.key === "Enter" && L.preventDefault();
          }),
          onClick: na(r, (L) => {
            (B(),
              v((F) => (Hu(F) ? !0 : !F)),
              x && C && ((c.current = L.isPropagationStopped()), c.current || L.stopPropagation()));
          }),
        })
      );
    }, "CheckboxTrigger"),
  ),
  Mee = Rn.forwardRef(
    qu(function (t, a) {
      let {
        __scopeCheckbox: r,
        name: n,
        checked: i,
        defaultChecked: o,
        required: A,
        disabled: s,
        value: l,
        onCheckedChange: u,
        form: p,
        ...v
      } = t;
      return (0, LA.jsx)(sI, {
        __scopeCheckbox: r,
        checked: i,
        defaultChecked: o,
        disabled: s,
        required: A,
        onCheckedChange: u,
        name: n,
        form: p,
        value: l,
        internal_do_not_use_render: ({ isFormControl: c }) =>
          (0, LA.jsxs)(LA.Fragment, {
            children: [
              (0, LA.jsx)(ik, { ...v, ref: a, __scopeCheckbox: r }),
              c && (0, LA.jsx)(ok, { __scopeCheckbox: r }),
            ],
          }),
      });
    }, "Checkbox"),
  ),
  Hee = "CheckboxIndicator",
  qee = Rn.forwardRef(
    qu(function (t, a) {
      let { __scopeCheckbox: r, forceMount: n, ...i } = t,
        o = AI(Hee, r);
      return (0, LA.jsx)(Tl, {
        present: n || Hu(o.checked) || o.checked === !0,
        children: (0, LA.jsx)(ca.span, {
          "data-state": lI(o.checked),
          "data-disabled": o.disabled ? "" : void 0,
          ...i,
          ref: a,
          style: { pointerEvents: "none", ...t.style },
        }),
      });
    }, "CheckboxIndicator"),
  ),
  zee = "CheckboxBubbleInput",
  ok = Rn.forwardRef(
    qu(function ({ __scopeCheckbox: t, onClick: a, ...r }, n) {
      let {
          control: i,
          hasConsumerStoppedPropagationRef: o,
          userInteractionCount: A,
          checked: s,
          defaultChecked: l,
          required: u,
          disabled: p,
          name: v,
          value: c,
          form: B,
          bubbleInput: C,
          setBubbleInput: x,
        } = AI(zee, t),
        w = p2(n, x),
        S = N0(i),
        L = Rn.useRef(!1),
        F = Rn.useRef(s),
        q = Rn.useRef(A);
      Rn.useEffect(() => {
        let z = C;
        if (!z) return;
        let k = window.HTMLInputElement.prototype,
          ne = Object.getOwnPropertyDescriptor(k, "checked").set,
          D = A !== q.current;
        q.current = A;
        let H = F.current !== s;
        F.current = s;
        let te = !(D && o.current);
        if (H && ne) {
          L.current = !D;
          let ee = new Event("click", { bubbles: te });
          ((z.indeterminate = Hu(s)), ne.call(z, Hu(s) ? !1 : s), z.dispatchEvent(ee), (L.current = !1));
        }
      }, [C, s, o, A]);
      let j = Rn.useRef(Hu(s) ? !1 : s);
      return (0, LA.jsx)(ca.input, {
        type: "checkbox",
        "aria-hidden": !0,
        defaultChecked: l ?? j.current,
        required: u,
        disabled: p,
        name: v,
        value: c,
        form: B,
        ...r,
        tabIndex: -1,
        ref: w,
        onClick: na(a, (z) => {
          L.current && z.stopPropagation();
        }),
        style: {
          ...r.style,
          ...S,
          position: "absolute",
          pointerEvents: "none",
          opacity: 0,
          margin: 0,
          transform: "translateX(-100%)",
        },
      });
    }, "CheckboxBubbleInput"),
  );
function Ak(e) {
  return typeof e == "function";
}
qu(Ak, "isFunction");
function Hu(e) {
  return e === "indeterminate";
}
qu(Hu, "isIndeterminate");
function lI(e) {
  return Hu(e) ? "indeterminate" : e ? "checked" : "unchecked";
}
qu(lI, "getState");
var Ti = Me(Qt(), 1);
var uk = ["top", "right", "bottom", "left"];
var Rl = Math.min,
  js = Math.max,
  M0 = Math.round,
  H0 = Math.floor,
  Ql = (e) => ({ x: e, y: e }),
  Vee = { left: "right", right: "left", bottom: "top", top: "bottom" };
function uI(e, t, a) {
  return js(e, Rl(t, a));
}
function Ol(e, t) {
  return typeof e == "function" ? e(t) : e;
}
function zu(e) {
  return e.split("-")[0];
}
function Id(e) {
  return e.split("-")[1];
}
function m2(e) {
  return e === "x" ? "y" : "x";
}
function v2(e) {
  return e === "y" ? "height" : "width";
}
function Ws(e) {
  let t = e[0];
  return t === "t" || t === "b" ? "y" : "x";
}
function y2(e) {
  return m2(Ws(e));
}
function ck(e, t, a) {
  a === void 0 && (a = !1);
  let r = Id(e),
    n = y2(e),
    i = v2(n),
    o = n === "x" ? (r === (a ? "end" : "start") ? "right" : "left") : r === "start" ? "bottom" : "top";
  return (t.reference[i] > t.floating[i] && (o = P0(o)), [o, P0(o)]);
}
function fk(e) {
  let t = P0(e);
  return [g2(e), t, g2(t)];
}
function g2(e) {
  return e.includes("start") ? e.replace("start", "end") : e.replace("end", "start");
}
var sk = ["left", "right"],
  lk = ["right", "left"],
  Kee = ["top", "bottom"],
  Gee = ["bottom", "top"];
function jee(e, t, a) {
  switch (e) {
    case "top":
    case "bottom":
      return a ? (t ? lk : sk) : t ? sk : lk;
    case "left":
    case "right":
      return t ? Kee : Gee;
    default:
      return [];
  }
}
function dk(e, t, a, r) {
  let n = Id(e),
    i = jee(zu(e), a === "start", r);
  return (n && ((i = i.map((o) => o + "-" + n)), t && (i = i.concat(i.map(g2)))), i);
}
function P0(e) {
  let t = zu(e);
  return Vee[t] + e.slice(t.length);
}
function Wee(e) {
  var t, a, r, n;
  return {
    top: (t = e.top) != null ? t : 0,
    right: (a = e.right) != null ? a : 0,
    bottom: (r = e.bottom) != null ? r : 0,
    left: (n = e.left) != null ? n : 0,
  };
}
function cI(e) {
  return typeof e != "number" ? Wee(e) : { top: e, right: e, bottom: e, left: e };
}
function Ed(e) {
  let { x: t, y: a, width: r, height: n } = e;
  return { width: r, height: n, top: a, left: t, right: t + r, bottom: a + n, x: t, y: a };
}
function hk(e, t, a) {
  let { reference: r, floating: n } = e,
    i = Ws(t),
    o = y2(t),
    A = v2(o),
    s = zu(t),
    l = i === "y",
    u = r.x + r.width / 2 - n.width / 2,
    p = r.y + r.height / 2 - n.height / 2,
    v = r[A] / 2 - n[A] / 2,
    c;
  switch (s) {
    case "top":
      c = { x: u, y: r.y - n.height };
      break;
    case "bottom":
      c = { x: u, y: r.y + r.height };
      break;
    case "right":
      c = { x: r.x + r.width, y: p };
      break;
    case "left":
      c = { x: r.x - n.width, y: p };
      break;
    default:
      c = { x: r.x, y: r.y };
  }
  let B = Id(t);
  return (B && (c[o] += v * (B === "end" ? 1 : -1) * (a && l ? -1 : 1)), c);
}
async function mk(e, t) {
  var a;
  t === void 0 && (t = {});
  let { x: r, y: n, platform: i, rects: o, elements: A, strategy: s } = e,
    {
      boundary: l = "clippingAncestors",
      rootBoundary: u = "viewport",
      elementContext: p = "floating",
      altBoundary: v = !1,
      padding: c = 0,
    } = Ol(t, e),
    B = cI(c),
    x = A[v ? (p === "floating" ? "reference" : "floating") : p],
    w = Ed(
      await i.getClippingRect({
        element:
          (a = await (i.isElement == null ? void 0 : i.isElement(x))) == null || a
            ? x
            : x.contextElement ||
              (await (i.getDocumentElement == null ? void 0 : i.getDocumentElement(A.floating))),
        boundary: l,
        rootBoundary: u,
        strategy: s,
      }),
    ),
    S = p === "floating" ? { x: r, y: n, width: o.floating.width, height: o.floating.height } : o.reference,
    L = await (i.getOffsetParent == null ? void 0 : i.getOffsetParent(A.floating)),
    F = ((await (i.isElement == null ? void 0 : i.isElement(L))) &&
      (await (i.getScale == null ? void 0 : i.getScale(L)))) || { x: 1, y: 1 },
    q = Ed(
      i.convertOffsetParentRelativeRectToViewportRelativeRect
        ? await i.convertOffsetParentRelativeRectToViewportRelativeRect({
            elements: A,
            rect: S,
            offsetParent: L,
            strategy: s,
          })
        : S,
    );
  return {
    top: (w.top - q.top + B.top) / F.y,
    bottom: (q.bottom - w.bottom + B.bottom) / F.y,
    left: (w.left - q.left + B.left) / F.x,
    right: (q.right - w.right + B.right) / F.x,
  };
}
var Xee = 50,
  vk = async (e, t, a) => {
    let { placement: r = "bottom", strategy: n = "absolute", middleware: i = [], platform: o } = a,
      A = o.detectOverflow ? o : { ...o, detectOverflow: mk },
      s = await (o.isRTL == null ? void 0 : o.isRTL(t)),
      l = await o.getElementRects({ reference: e, floating: t, strategy: n }),
      { x: u, y: p } = hk(l, r, s),
      v = r,
      c = 0,
      B = {};
    for (let C = 0; C < i.length; C++) {
      let x = i[C];
      if (!x) continue;
      let { name: w, fn: S } = x,
        {
          x: L,
          y: F,
          data: q,
          reset: j,
        } = await S({
          x: u,
          y: p,
          initialPlacement: r,
          placement: v,
          strategy: n,
          middlewareData: B,
          rects: l,
          platform: A,
          elements: { reference: e, floating: t },
        });
      ((u = L ?? u),
        (p = F ?? p),
        (B[w] = { ...B[w], ...q }),
        j &&
          c < Xee &&
          (c++,
          typeof j == "object" &&
            (j.placement && (v = j.placement),
            j.rects &&
              (l =
                j.rects === !0
                  ? await o.getElementRects({ reference: e, floating: t, strategy: n })
                  : j.rects),
            ({ x: u, y: p } = hk(l, v, s))),
          (C = -1)));
    }
    return { x: u, y: p, placement: v, strategy: n, middlewareData: B };
  },
  yk = (e) => ({
    name: "arrow",
    options: e,
    async fn(t) {
      let { x: a, y: r, placement: n, rects: i, platform: o, elements: A, middlewareData: s } = t,
        { element: l, padding: u = 0 } = Ol(e, t) || {};
      if (l == null) return {};
      let p = cI(u),
        v = { x: a, y: r },
        c = y2(n),
        B = v2(c),
        C = await o.getDimensions(l),
        x = c === "y",
        w = x ? "top" : "left",
        S = x ? "bottom" : "right",
        L = x ? "clientHeight" : "clientWidth",
        F = i.reference[B] + i.reference[c] - v[c] - i.floating[B],
        q = v[c] - i.reference[c],
        j = await (o.getOffsetParent == null ? void 0 : o.getOffsetParent(l)),
        z = j ? j[L] : 0;
      (!z || !(await (o.isElement == null ? void 0 : o.isElement(j)))) &&
        (z = A.floating[L] || i.floating[B]);
      let k = F / 2 - q / 2,
        O = z / 2 - C[B] / 2 - 1,
        ne = Rl(p[w], O),
        D = Rl(p[S], O),
        H = z - C[B] - D,
        te = z / 2 - C[B] / 2 + k,
        ee = uI(ne, te, H),
        ce = !s.arrow && Id(n) != null && te !== ee && i.reference[B] / 2 - (te < ne ? ne : D) - C[B] / 2 < 0,
        de = ce ? (te < ne ? te - ne : te - H) : 0;
      return {
        [c]: v[c] + de,
        data: { [c]: ee, centerOffset: te - ee - de, ...(ce && { alignmentOffset: de }) },
        reset: ce,
      };
    },
  });
var wk = function (e) {
  return (
    e === void 0 && (e = {}),
    {
      name: "flip",
      options: e,
      async fn(t) {
        var a, r;
        let { placement: n, middlewareData: i, rects: o, initialPlacement: A, platform: s, elements: l } = t,
          {
            mainAxis: u = !0,
            crossAxis: p = !0,
            fallbackPlacements: v,
            fallbackStrategy: c = "bestFit",
            fallbackAxisSideDirection: B = "none",
            flipAlignment: C = !0,
            ...x
          } = Ol(e, t);
        if ((a = i.arrow) != null && a.alignmentOffset) return {};
        let w = zu(n),
          S = Ws(A),
          L = zu(A) === A,
          F = await (s.isRTL == null ? void 0 : s.isRTL(l.floating)),
          q = v || (L || !C ? [P0(A)] : fk(A)),
          j = B !== "none";
        !v && j && q.push(...dk(A, C, B, F));
        let z = [A, ...q],
          k = await s.detectOverflow(t, x),
          O = [],
          ne = ((r = i.flip) == null ? void 0 : r.overflows) || [];
        if ((u && O.push(k[w]), p)) {
          let ee = ck(n, o, F);
          O.push(k[ee[0]], k[ee[1]]);
        }
        if (((ne = [...ne, { placement: n, overflows: O }]), !O.every((ee) => ee <= 0))) {
          var D, H;
          let ee = (((D = i.flip) == null ? void 0 : D.index) || 0) + 1,
            ce = z[ee];
          if (
            ce &&
            (!(p === "alignment" ? S !== Ws(ce) : !1) ||
              ne.every((se) => (Ws(se.placement) === S ? se.overflows[0] > 0 : !0)))
          )
            return { data: { index: ee, overflows: ne }, reset: { placement: ce } };
          let de =
            (H = ne
              .filter((fe) => fe.overflows[0] <= 0)
              .sort((fe, se) => fe.overflows[1] - se.overflows[1])[0]) == null
              ? void 0
              : H.placement;
          if (!de)
            switch (c) {
              case "bestFit": {
                var te;
                let fe =
                  (te = ne
                    .filter((se) => {
                      if (j) {
                        let ge = Ws(se.placement);
                        return ge === S || ge === "y";
                      }
                      return !0;
                    })
                    .map((se) => [
                      se.placement,
                      se.overflows.filter((ge) => ge > 0).reduce((ge, me) => ge + me, 0),
                    ])
                    .sort((se, ge) => se[1] - ge[1])[0]) == null
                    ? void 0
                    : te[0];
                fe && (de = fe);
                break;
              }
              case "initialPlacement":
                de = A;
                break;
            }
          if (n !== de) return { reset: { placement: de } };
        }
        return {};
      },
    }
  );
};
function pk(e, t) {
  return {
    top: e.top - t.height,
    right: e.right - t.width,
    bottom: e.bottom - t.height,
    left: e.left - t.width,
  };
}
function gk(e) {
  return uk.some((t) => e[t] >= 0);
}
var Bk = function (e) {
  return (
    e === void 0 && (e = {}),
    {
      name: "hide",
      options: e,
      async fn(t) {
        let { rects: a, platform: r } = t,
          { strategy: n = "referenceHidden", ...i } = Ol(e, t);
        switch (n) {
          case "referenceHidden": {
            let o = await r.detectOverflow(t, { ...i, elementContext: "reference" }),
              A = pk(o, a.reference);
            return { data: { referenceHiddenOffsets: A, referenceHidden: gk(A) } };
          }
          case "escaped": {
            let o = await r.detectOverflow(t, { ...i, altBoundary: !0 }),
              A = pk(o, a.floating);
            return { data: { escapedOffsets: A, escaped: gk(A) } };
          }
          default:
            return {};
        }
      },
    }
  );
};
var bk = new Set(["left", "top"]);
async function Yee(e, t) {
  let { placement: a, platform: r, elements: n } = e,
    i = await (r.isRTL == null ? void 0 : r.isRTL(n.floating)),
    o = zu(a),
    A = Id(a),
    s = Ws(a) === "y",
    l = bk.has(o) ? -1 : 1,
    u = i && s ? -1 : 1,
    p = Ol(t, e),
    {
      mainAxis: v,
      crossAxis: c,
      alignmentAxis: B,
    } = typeof p == "number"
      ? { mainAxis: p, crossAxis: 0, alignmentAxis: null }
      : { mainAxis: p.mainAxis || 0, crossAxis: p.crossAxis || 0, alignmentAxis: p.alignmentAxis };
  return (
    A && typeof B == "number" && (c = A === "end" ? B * -1 : B),
    s ? { x: c * u, y: v * l } : { x: v * l, y: c * u }
  );
}
var Ck = function (e) {
    return (
      e === void 0 && (e = 0),
      {
        name: "offset",
        options: e,
        async fn(t) {
          var a, r;
          let { x: n, y: i, placement: o, middlewareData: A } = t,
            s = await Yee(t, e);
          return o === ((a = A.offset) == null ? void 0 : a.placement) &&
            (r = A.arrow) != null &&
            r.alignmentOffset
            ? {}
            : { x: n + s.x, y: i + s.y, data: { ...s, placement: o } };
        },
      }
    );
  },
  xk = function (e) {
    return (
      e === void 0 && (e = {}),
      {
        name: "shift",
        options: e,
        async fn(t) {
          let { x: a, y: r, placement: n, platform: i } = t,
            {
              mainAxis: o = !0,
              crossAxis: A = !1,
              limiter: s = {
                fn: (S) => {
                  let { x: L, y: F } = S;
                  return { x: L, y: F };
                },
              },
              ...l
            } = Ol(e, t),
            u = { x: a, y: r },
            p = await i.detectOverflow(t, l),
            v = Ws(n),
            c = m2(v),
            B = u[c],
            C = u[v],
            x = (S, L) => uI(L + p[S === "y" ? "top" : "left"], L, L - p[S === "y" ? "bottom" : "right"]);
          (o && (B = x(c, B)), A && (C = x(v, C)));
          let w = s.fn({ ...t, [c]: B, [v]: C });
          return { ...w, data: { x: w.x - a, y: w.y - r, enabled: { [c]: o, [v]: A } } };
        },
      }
    );
  },
  Sk = function (e) {
    return (
      e === void 0 && (e = {}),
      {
        options: e,
        fn(t) {
          var a, r;
          let { x: n, y: i, placement: o, rects: A, middlewareData: s } = t,
            { offset: l = 0, mainAxis: u = !0, crossAxis: p = !0 } = Ol(e, t),
            v = { x: n, y: i },
            c = Ws(o),
            B = m2(c),
            C = v[B],
            x = v[c],
            w = Ol(l, t),
            S =
              typeof w == "number"
                ? { mainAxis: w, crossAxis: 0 }
                : {
                    mainAxis: (a = w.mainAxis) != null ? a : 0,
                    crossAxis: (r = w.crossAxis) != null ? r : 0,
                  };
          if (u) {
            let q = B === "y" ? "height" : "width",
              j = A.reference[B] - A.floating[q] + S.mainAxis,
              z = A.reference[B] + A.reference[q] - S.mainAxis;
            C < j ? (C = j) : C > z && (C = z);
          }
          if (p) {
            var L, F;
            let q = B === "y" ? "width" : "height",
              j = bk.has(zu(o)),
              z =
                A.reference[c] -
                A.floating[q] +
                ((j && ((L = s.offset) == null ? void 0 : L[c])) || 0) +
                (j ? 0 : S.crossAxis),
              k =
                A.reference[c] +
                A.reference[q] +
                (j ? 0 : ((F = s.offset) == null ? void 0 : F[c]) || 0) -
                (j ? S.crossAxis : 0);
            x < z ? (x = z) : x > k && (x = k);
          }
          return { [B]: C, [c]: x };
        },
      }
    );
  },
  Lk = function (e) {
    return (
      e === void 0 && (e = {}),
      {
        name: "size",
        options: e,
        async fn(t) {
          let { placement: a, rects: r, platform: n, elements: i } = t,
            { apply: o = () => {}, ...A } = Ol(e, t),
            s = await n.detectOverflow(t, A),
            l = zu(a),
            u = Id(a),
            p = Ws(a) === "y",
            { width: v, height: c } = r.floating,
            B,
            C;
          l === "top" || l === "bottom"
            ? ((B = l),
              (C =
                u === ((await (n.isRTL == null ? void 0 : n.isRTL(i.floating))) ? "start" : "end")
                  ? "left"
                  : "right"))
            : ((C = l), (B = u === "end" ? "top" : "bottom"));
          let x = c - s.top - s.bottom,
            w = v - s.left - s.right,
            S = Rl(c - s[B], x),
            L = Rl(v - s[C], w),
            F = t.middlewareData.shift,
            q = !F,
            j = S,
            z = L;
          (F != null && F.enabled.x && (z = w),
            F != null && F.enabled.y && (j = x),
            q && !u && (p ? (z = v - 2 * js(s.left, s.right)) : (j = c - 2 * js(s.top, s.bottom))),
            await o({ ...t, availableWidth: z, availableHeight: j }));
          let k = await n.getDimensions(i.floating);
          return v !== k.width || c !== k.height ? { reset: { rects: !0 } } : {};
        },
      }
    );
  };
function w2() {
  return typeof window < "u";
}
function _d(e) {
  return Ek(e) ? (e.nodeName || "").toLowerCase() : "#document";
}
function yo(e) {
  var t;
  return (e == null || (t = e.ownerDocument) == null ? void 0 : t.defaultView) || window;
}
function Dl(e) {
  var t;
  return (t = (Ek(e) ? e.ownerDocument : e.document) || window.document) == null ? void 0 : t.documentElement;
}
function Ek(e) {
  return w2() ? e instanceof Node || e instanceof yo(e).Node : !1;
}
function Xs(e) {
  return w2() ? e instanceof Element || e instanceof yo(e).Element : !1;
}
function Vu(e) {
  return w2() ? e instanceof HTMLElement || e instanceof yo(e).HTMLElement : !1;
}
function Ik(e) {
  return !w2() || typeof ShadowRoot > "u" ? !1 : e instanceof ShadowRoot || e instanceof yo(e).ShadowRoot;
}
function q0(e) {
  let { overflow: t, overflowX: a, overflowY: r, display: n } = Ys(e);
  return /auto|scroll|overlay|hidden|clip/.test(t + r + a) && n !== "inline" && n !== "contents";
}
function Fk(e) {
  return /^(table|td|th)$/.test(_d(e));
}
function z0(e) {
  try {
    if (e.matches(":popover-open")) return !0;
  } catch {}
  try {
    return e.matches(":modal");
  } catch {
    return !1;
  }
}
var Zee = /transform|translate|scale|rotate|perspective|filter/,
  Jee = /paint|layout|strict|content/,
  Fd = (e) => !!e && e !== "none",
  fI;
function B2(e) {
  let t = Xs(e) ? Ys(e) : e;
  return (
    Fd(t.transform) ||
    Fd(t.translate) ||
    Fd(t.scale) ||
    Fd(t.rotate) ||
    Fd(t.perspective) ||
    (!b2() && (Fd(t.backdropFilter) || Fd(t.filter))) ||
    Zee.test(t.willChange || "") ||
    Jee.test(t.contain || "")
  );
}
function Uk(e) {
  let t = lf(e);
  for (; Vu(t) && !eg(t); ) {
    if (B2(t)) return t;
    if (z0(t)) return null;
    t = lf(t);
  }
  return null;
}
function b2() {
  return (
    fI == null && (fI = typeof CSS < "u" && CSS.supports && CSS.supports("-webkit-backdrop-filter", "none")),
    fI
  );
}
function eg(e) {
  return /^(html|body|#document)$/.test(_d(e));
}
function Ys(e) {
  return yo(e).getComputedStyle(e);
}
function V0(e) {
  return Xs(e)
    ? { scrollLeft: e.scrollLeft, scrollTop: e.scrollTop }
    : { scrollLeft: e.scrollX, scrollTop: e.scrollY };
}
function lf(e) {
  if (_d(e) === "html") return e;
  let t = e.assignedSlot || e.parentNode || (Ik(e) && e.host) || Dl(e);
  return Ik(t) ? t.host : t;
}
function _k(e) {
  let t = lf(e);
  return eg(t) ? (e.ownerDocument || e).body : Vu(t) && q0(t) ? t : _k(t);
}
function Ud(e, t, a) {
  var r;
  (t === void 0 && (t = []), a === void 0 && (a = !0));
  let n = _k(e),
    i = n === ((r = e.ownerDocument) == null ? void 0 : r.body),
    o = yo(n);
  if (i) {
    let A = C2(o);
    return t.concat(o, o.visualViewport || [], q0(n) ? n : [], A && a ? Ud(A) : []);
  } else return t.concat(n, Ud(n, [], a));
}
function C2(e) {
  return e.parent && Object.getPrototypeOf(e.parent) ? e.frameElement : null;
}
function Qk(e) {
  let t = Ys(e),
    a = parseFloat(t.width) || 0,
    r = parseFloat(t.height) || 0,
    n = Vu(e),
    i = n ? e.offsetWidth : a,
    o = n ? e.offsetHeight : r,
    A = M0(a) !== i || M0(r) !== o;
  return (A && ((a = i), (r = o)), { width: a, height: r, $: A });
}
function hI(e) {
  return Xs(e) ? e : e.contextElement;
}
function tg(e) {
  let t = hI(e);
  if (!Vu(t)) return Ql(1);
  let a = t.getBoundingClientRect(),
    { width: r, height: n, $: i } = Qk(t),
    o = (i ? M0(a.width) : a.width) / r,
    A = (i ? M0(a.height) : a.height) / n;
  return ((!o || !Number.isFinite(o)) && (o = 1), (!A || !Number.isFinite(A)) && (A = 1), { x: o, y: A });
}
var $ee = Ql(0);
function Ok(e) {
  let t = yo(e);
  return !b2() || !t.visualViewport ? $ee : { x: t.visualViewport.offsetLeft, y: t.visualViewport.offsetTop };
}
function ete(e, t, a) {
  return (t === void 0 && (t = !1), !!a && t && a === yo(e));
}
function Td(e, t, a, r) {
  (t === void 0 && (t = !1), a === void 0 && (a = !1));
  let n = e.getBoundingClientRect(),
    i = hI(e),
    o = Ql(1);
  t && (r ? Xs(r) && (o = tg(r)) : (o = tg(e)));
  let A = ete(i, a, r) ? Ok(i) : Ql(0),
    s = (n.left + A.x) / o.x,
    l = (n.top + A.y) / o.y,
    u = n.width / o.x,
    p = n.height / o.y;
  if (i && r) {
    let v = yo(i),
      c = Xs(r) ? yo(r) : r,
      B = v,
      C = C2(B);
    for (; C && c !== B; ) {
      let x = tg(C),
        w = C.getBoundingClientRect(),
        S = Ys(C),
        L = w.left + (C.clientLeft + parseFloat(S.paddingLeft)) * x.x,
        F = w.top + (C.clientTop + parseFloat(S.paddingTop)) * x.y;
      ((s *= x.x), (l *= x.y), (u *= x.x), (p *= x.y), (s += L), (l += F), (B = yo(C)), (C = C2(B)));
    }
  }
  return Ed({ width: u, height: p, x: s, y: l });
}
function x2(e, t) {
  let a = V0(e).scrollLeft;
  return t ? t.left + a : Td(Dl(e)).left + a;
}
function Dk(e, t) {
  let a = e.getBoundingClientRect(),
    r = a.left + t.scrollLeft - x2(e, a),
    n = a.top + t.scrollTop;
  return { x: r, y: n };
}
function tte(e) {
  let { elements: t, rect: a, offsetParent: r, strategy: n } = e,
    i = n === "fixed",
    o = Dl(r),
    A = t ? z0(t.floating) : !1;
  if (r === o || (A && i)) return a;
  let s = { scrollLeft: 0, scrollTop: 0 },
    l = Ql(1),
    u = Ql(0),
    p = Vu(r);
  if ((p || !i) && ((_d(r) !== "body" || q0(o)) && (s = V0(r)), p)) {
    let c = Td(r);
    ((l = tg(r)), (u.x = c.x + r.clientLeft), (u.y = c.y + r.clientTop));
  }
  let v = o && !p && !i ? Dk(o, s) : Ql(0);
  return {
    width: a.width * l.x,
    height: a.height * l.y,
    x: a.x * l.x - s.scrollLeft * l.x + u.x + v.x,
    y: a.y * l.y - s.scrollTop * l.y + u.y + v.y,
  };
}
function ate(e) {
  return e.getClientRects ? Array.from(e.getClientRects()) : [];
}
function rte(e) {
  let t = V0(e),
    a = e.ownerDocument.body,
    r = js(e.scrollWidth, e.clientWidth, a.scrollWidth, a.clientWidth),
    n = js(e.scrollHeight, e.clientHeight, a.scrollHeight, a.clientHeight),
    i = -t.scrollLeft + x2(e),
    o = -t.scrollTop;
  return (
    Ys(a).direction === "rtl" && (i += js(e.clientWidth, a.clientWidth) - r),
    { width: r, height: n, x: i, y: o }
  );
}
var nte = 25;
function ite(e, t, a) {
  a === void 0 && (a = "viewport");
  let r = a === "layoutViewport",
    n = yo(e),
    i = Dl(e),
    o = n.visualViewport,
    A = i.clientWidth,
    s = i.clientHeight,
    l = 0,
    u = 0;
  if (o) {
    let v = !b2() || t === "fixed";
    r
      ? v || ((l = -o.offsetLeft), (u = -o.offsetTop))
      : ((A = o.width), (s = o.height), v && ((l = o.offsetLeft), (u = o.offsetTop)));
  }
  if (x2(i) <= 0) {
    let v = i.ownerDocument,
      c = v.body,
      B = getComputedStyle(c),
      C = (v.compatMode === "CSS1Compat" && parseFloat(B.marginLeft) + parseFloat(B.marginRight)) || 0,
      x = Math.abs(i.clientWidth - c.clientWidth - C),
      w = getComputedStyle(i).scrollbarGutter === "stable both-edges" ? x / 2 : x;
    w <= nte && (A -= w);
  }
  return { width: A, height: s, x: l, y: u };
}
function ote(e, t) {
  let a = Td(e, !0, t === "fixed"),
    r = a.top + e.clientTop,
    n = a.left + e.clientLeft,
    i = tg(e),
    o = e.clientWidth * i.x,
    A = e.clientHeight * i.y,
    s = n * i.x,
    l = r * i.y;
  return { width: o, height: A, x: s, y: l };
}
function Tk(e, t, a) {
  let r;
  if (t === "viewport" || t === "layoutViewport") r = ite(e, a, t);
  else if (t === "document") r = rte(Dl(e));
  else if (Xs(t)) r = ote(t, a);
  else {
    let n = Ok(e);
    r = { x: t.x - n.x, y: t.y - n.y, width: t.width, height: t.height };
  }
  return Ed(r);
}
function Ate(e, t) {
  let a = t.get(e);
  if (a) return a;
  let r = Ud(e, [], !1).filter((A) => Xs(A) && _d(A) !== "body"),
    n = null,
    i = Ys(e).position === "fixed",
    o = i ? lf(e) : e;
  for (; Xs(o) && !eg(o); ) {
    let A = Ys(o),
      s = B2(o),
      l = n ? n.position : i ? "fixed" : "";
    (!s && (l === "fixed" || (l === "absolute" && A.position === "static"))
      ? (r = r.filter((p) => p !== o))
      : (n = A),
      (o = lf(o)));
  }
  return (t.set(e, r), r);
}
function ste(e) {
  let { element: t, boundary: a, rootBoundary: r, strategy: n } = e,
    o = [...(a === "clippingAncestors" ? (z0(t) ? [] : Ate(t, this._c)) : [].concat(a)), r],
    A = Tk(t, o[0], n),
    s = A.top,
    l = A.right,
    u = A.bottom,
    p = A.left;
  for (let v = 1; v < o.length; v++) {
    let c = Tk(t, o[v], n);
    ((s = js(c.top, s)), (l = Rl(c.right, l)), (u = Rl(c.bottom, u)), (p = js(c.left, p)));
  }
  return { width: l - p, height: u - s, x: p, y: s };
}
function lte(e) {
  let { width: t, height: a } = Qk(e);
  return { width: t, height: a };
}
function ute(e, t, a) {
  let r = Vu(t),
    n = Dl(t),
    i = a === "fixed",
    o = Td(e, !0, i, t),
    A = { scrollLeft: 0, scrollTop: 0 },
    s = Ql(0);
  if ((r || !i) && ((_d(t) !== "body" || q0(n)) && (A = V0(t)), r)) {
    let v = Td(t, !0, i, t);
    ((s.x = v.x + t.clientLeft), (s.y = v.y + t.clientTop));
  }
  !r && n && (s.x = x2(n));
  let l = n && !r && !i ? Dk(n, A) : Ql(0),
    u = o.left + A.scrollLeft - s.x - l.x,
    p = o.top + A.scrollTop - s.y - l.y;
  return { x: u, y: p, width: o.width, height: o.height };
}
function dI(e) {
  return Ys(e).position === "static";
}
function Rk(e, t) {
  if (!Vu(e) || Ys(e).position === "fixed") return null;
  if (t) return t(e);
  let a = e.offsetParent;
  return (Dl(e) === a && (a = a.ownerDocument.body), a);
}
function Nk(e, t) {
  let a = yo(e);
  if (z0(e)) return a;
  if (!Vu(e)) {
    let n = lf(e);
    for (; n && !eg(n); ) {
      if (Xs(n) && !dI(n)) return n;
      n = lf(n);
    }
    return a;
  }
  let r = Rk(e, t);
  for (; r && Fk(r) && dI(r); ) r = Rk(r, t);
  return r && eg(r) && dI(r) && !B2(r) ? a : r || Uk(e) || a;
}
var cte = async function (e) {
  let t = this.getOffsetParent || Nk,
    a = this.getDimensions,
    r = await a(e.floating);
  return {
    reference: ute(e.reference, await t(e.floating), e.strategy),
    floating: { x: 0, y: 0, width: r.width, height: r.height },
  };
};
function fte(e) {
  return Ys(e).direction === "rtl";
}
var kk = {
  convertOffsetParentRelativeRectToViewportRelativeRect: tte,
  getDocumentElement: Dl,
  getClippingRect: ste,
  getOffsetParent: Nk,
  getElementRects: cte,
  getClientRects: ate,
  getDimensions: lte,
  getScale: tg,
  isElement: Xs,
  isRTL: fte,
};
function Pk(e, t) {
  return e.x === t.x && e.y === t.y && e.width === t.width && e.height === t.height;
}
function dte(e, t, a) {
  let r = null,
    n,
    i = Dl(e);
  function o() {
    var u;
    (clearTimeout(n), (u = r) == null || u.disconnect(), (r = null));
  }
  function A(u, p) {
    (u === void 0 && (u = !1), p === void 0 && (p = 1), o());
    let v = e.getBoundingClientRect(),
      { left: c, top: B, width: C, height: x } = v;
    if ((u || t(), !C || !x)) return;
    let w = H0(B),
      S = H0(i.clientWidth - (c + C)),
      L = H0(i.clientHeight - (B + x)),
      F = H0(c),
      j = { rootMargin: -w + "px " + -S + "px " + -L + "px " + -F + "px", threshold: js(0, Rl(1, p)) || 1 },
      z = !0;
    function k(O) {
      let ne = O[0].intersectionRatio;
      if (!Pk(v, e.getBoundingClientRect())) return A();
      if (ne !== p) {
        if (!z) return A();
        ne
          ? A(!1, ne)
          : (n = setTimeout(() => {
              A(!1, 1e-7);
            }, 1e3));
      }
      z = !1;
    }
    try {
      r = new IntersectionObserver(k, { ...j, root: i.ownerDocument });
    } catch {
      r = new IntersectionObserver(k, j);
    }
    r.observe(e);
  }
  let s = yo(e),
    l = () => A(a);
  return (
    s.addEventListener("resize", l),
    A(!0),
    () => {
      (s.removeEventListener("resize", l), o());
    }
  );
}
function pI(e, t, a, r) {
  r === void 0 && (r = {});
  let {
      ancestorScroll: n = !0,
      ancestorResize: i = !0,
      elementResize: o = typeof ResizeObserver == "function",
      layoutShift: A = typeof IntersectionObserver == "function",
      animationFrame: s = !1,
    } = r,
    l = hI(e),
    u = n || i ? [...(l ? Ud(l) : []), ...(t ? Ud(t) : [])] : [];
  u.forEach((w) => {
    (n && w.addEventListener("scroll", a), i && w.addEventListener("resize", a));
  });
  let p = l && A ? dte(l, a, i) : null,
    v = -1,
    c = null;
  o &&
    ((c = new ResizeObserver((w) => {
      let [S] = w;
      (S &&
        S.target === l &&
        c &&
        t &&
        (c.unobserve(t),
        cancelAnimationFrame(v),
        (v = requestAnimationFrame(() => {
          var L;
          (L = c) == null || L.observe(t);
        }))),
        a());
    })),
    l && !s && c.observe(l),
    t && c.observe(t));
  let B,
    C = s ? Td(e) : null;
  s && x();
  function x() {
    let w = Td(e);
    (C && !Pk(C, w) && a(), (C = w), (B = requestAnimationFrame(x)));
  }
  return (
    a(),
    () => {
      var w;
      (u.forEach((S) => {
        (n && S.removeEventListener("scroll", a), i && S.removeEventListener("resize", a));
      }),
        p?.(),
        (w = c) == null || w.disconnect(),
        (c = null),
        s && cancelAnimationFrame(B));
    }
  );
}
var Mk = Ck;
var Hk = xk,
  qk = wk,
  zk = Lk,
  Vk = Bk,
  gI = yk;
var Kk = Sk,
  mI = (e, t, a) => {
    let r = new Map(),
      n = a ?? {},
      i = { ...kk, ...n.platform, _c: r };
    return vk(e, t, { ...n, platform: i });
  };
var Qn = Me(Qt(), 1),
  jk = Me(Qt(), 1),
  Wk = Me(Yh(), 1),
  hte = typeof document < "u",
  pte = function () {},
  S2 = hte ? jk.useLayoutEffect : pte;
function L2(e, t) {
  if (e === t) return !0;
  if (typeof e != typeof t) return !1;
  if (typeof e == "function" && e.toString() === t.toString()) return !0;
  let a, r, n;
  if (e && t && typeof e == "object") {
    if (Array.isArray(e)) {
      if (((a = e.length), a !== t.length)) return !1;
      for (r = a; r-- !== 0; ) if (!L2(e[r], t[r])) return !1;
      return !0;
    }
    if (((n = Object.keys(e)), (a = n.length), a !== Object.keys(t).length)) return !1;
    for (r = a; r-- !== 0; ) if (!{}.hasOwnProperty.call(t, n[r])) return !1;
    for (r = a; r-- !== 0; ) {
      let i = n[r];
      if (!(i === "_owner" && e.$$typeof) && !L2(e[i], t[i])) return !1;
    }
    return !0;
  }
  return e !== e && t !== t;
}
function Xk(e) {
  return typeof window > "u" ? 1 : (e.ownerDocument.defaultView || window).devicePixelRatio || 1;
}
function Gk(e, t) {
  let a = Xk(e);
  return Math.round(t * a) / a;
}
function vI(e) {
  let t = Qn.useRef(e);
  return (
    S2(() => {
      t.current = e;
    }),
    t
  );
}
function Yk(e) {
  e === void 0 && (e = {});
  let {
      placement: t = "bottom",
      strategy: a = "absolute",
      middleware: r = [],
      platform: n,
      elements: { reference: i, floating: o } = {},
      transform: A = !0,
      whileElementsMounted: s,
      open: l,
    } = e,
    [u, p] = Qn.useState({ x: 0, y: 0, strategy: a, placement: t, middlewareData: {}, isPositioned: !1 }),
    [v, c] = Qn.useState(r);
  L2(v, r) || c(r);
  let [B, C] = Qn.useState(null),
    [x, w] = Qn.useState(null),
    S = Qn.useCallback((se) => {
      se !== j.current && ((j.current = se), C(se));
    }, []),
    L = Qn.useCallback((se) => {
      se !== z.current && ((z.current = se), w(se));
    }, []),
    F = i || B,
    q = o || x,
    j = Qn.useRef(null),
    z = Qn.useRef(null),
    k = Qn.useRef(u),
    O = s != null,
    ne = vI(s),
    D = vI(n),
    H = vI(l),
    te = Qn.useCallback(() => {
      if (!j.current || !z.current) return;
      let se = { placement: t, strategy: a, middleware: v };
      (D.current && (se.platform = D.current),
        mI(j.current, z.current, se).then((ge) => {
          let me = { ...ge, isPositioned: H.current !== !1 };
          ee.current &&
            !L2(k.current, me) &&
            ((k.current = me),
            Wk.flushSync(() => {
              p(me);
            }));
        }));
    }, [v, t, a, D, H]);
  S2(() => {
    l === !1 &&
      k.current.isPositioned &&
      ((k.current.isPositioned = !1), p((se) => ({ ...se, isPositioned: !1 })));
  }, [l]);
  let ee = Qn.useRef(!1);
  (S2(
    () => (
      (ee.current = !0),
      () => {
        ee.current = !1;
      }
    ),
    [],
  ),
    S2(() => {
      if ((F && (j.current = F), q && (z.current = q), F && q)) {
        if (ne.current) return ne.current(F, q, te);
        te();
      }
    }, [F, q, te, ne, O]));
  let ce = Qn.useMemo(() => ({ reference: j, floating: z, setReference: S, setFloating: L }), [S, L]),
    de = Qn.useMemo(() => ({ reference: F, floating: q }), [F, q]),
    fe = Qn.useMemo(() => {
      let se = { position: a, left: 0, top: 0 };
      if (!de.floating) return se;
      let ge = Gk(de.floating, u.x),
        me = Gk(de.floating, u.y);
      return A
        ? {
            ...se,
            transform: "translate(" + ge + "px, " + me + "px)",
            ...(Xk(de.floating) >= 1.5 && { willChange: "transform" }),
          }
        : { position: a, left: ge, top: me };
    }, [a, A, de.floating, u.x, u.y]);
  return Qn.useMemo(
    () => ({ ...u, update: te, refs: ce, elements: de, floatingStyles: fe }),
    [u, te, ce, de, fe],
  );
}
var gte = (e) => {
    function t(a) {
      return {}.hasOwnProperty.call(a, "current");
    }
    return {
      name: "arrow",
      options: e,
      fn(a) {
        let { element: r, padding: n } = typeof e == "function" ? e(a) : e;
        return r && t(r)
          ? r.current != null
            ? gI({ element: r.current, padding: n }).fn(a)
            : {}
          : r
            ? gI({ element: r, padding: n }).fn(a)
            : {};
      },
    };
  },
  Zk = (e, t) => {
    let a = Mk(e);
    return { name: a.name, fn: a.fn, options: [e, t] };
  },
  Jk = (e, t) => {
    let a = Hk(e);
    return { name: a.name, fn: a.fn, options: [e, t] };
  },
  $k = (e, t) => ({ fn: Kk(e).fn, options: [e, t] }),
  eP = (e, t) => {
    let a = qk(e);
    return { name: a.name, fn: a.fn, options: [e, t] };
  },
  tP = (e, t) => {
    let a = zk(e);
    return { name: a.name, fn: a.fn, options: [e, t] };
  };
var aP = (e, t) => {
  let a = Vk(e);
  return { name: a.name, fn: a.fn, options: [e, t] };
};
var rP = (e, t) => {
  let a = gte(e);
  return { name: a.name, fn: a.fn, options: [e, t] };
};
var nP = Me(Qt(), 1);
var yI = Me(_a(), 1),
  mte = Object.defineProperty,
  vte = (e, t) => mte(e, "name", { value: t, configurable: !0 }),
  yte = nP.forwardRef(
    vte(function (t, a) {
      let { children: r, width: n = 10, height: i = 5, ...o } = t;
      return (0, yI.jsx)(ca.svg, {
        ...o,
        ref: a,
        width: n,
        height: i,
        viewBox: "0 0 30 10",
        preserveAspectRatio: "none",
        children: t.asChild ? r : (0, yI.jsx)("polygon", { points: "0,0 30,0 15,10" }),
      });
    }, "Arrow"),
  ),
  iP = yte;
var oP = Me(Qt(), 1),
  Bte = Object.defineProperty,
  BI = (e, t) => Bte(e, "name", { value: t, configurable: !0 });
function wI(e, t) {
  if (typeof e == "function") return e(t);
  e != null && (e.current = t);
}
BI(wI, "setRef");
function AP(...e) {
  return (t) => {
    let a = !1,
      r = e.map((n) => {
        let i = wI(n, t);
        return (!a && typeof i == "function" && (a = !0), i);
      });
    if (a)
      return () => {
        for (let n = 0; n < r.length; n++) {
          let i = r[n];
          typeof i == "function" ? i() : wI(e[n], null);
        }
      };
  };
}
BI(AP, "composeRefs");
function I2(...e) {
  return oP.useCallback(AP(...e), e);
}
BI(I2, "useComposedRefs");
var uf = Me(_a(), 1),
  bte = Object.defineProperty,
  Ku = (e, t) => bte(e, "name", { value: t, configurable: !0 });
var sP = "Popper",
  [lP, bI] = Xn(sP),
  [Cte, uP] = lP(sP),
  xte = Ku((e) => {
    let { __scopePopper: t, children: a } = e,
      [r, n] = Ti.useState(null),
      [i, o] = Ti.useState(void 0);
    return (0, uf.jsx)(Cte, {
      scope: t,
      anchor: r,
      onAnchorChange: n,
      placementState: i,
      setPlacementState: o,
      children: a,
    });
  }, "Popper"),
  Ste = "PopperAnchor",
  Lte = Ti.forwardRef(
    Ku(function (t, a) {
      let { __scopePopper: r, virtualRef: n, ...i } = t,
        o = uP(Ste, r),
        A = Ti.useRef(null),
        s = o.onAnchorChange,
        l = Ti.useCallback(
          (C) => {
            ((A.current = C), C && s(C));
          },
          [s],
        ),
        u = I2(a, l),
        p = Ti.useRef(null);
      Ti.useEffect(() => {
        if (!n) return;
        let C = p.current;
        ((p.current = n.current), C !== p.current && s(p.current));
      });
      let v = o.placementState && E2(o.placementState),
        c = v?.[0],
        B = v?.[1];
      return n
        ? null
        : (0, uf.jsx)(ca.div, { "data-radix-popper-side": c, "data-radix-popper-align": B, ...i, ref: u });
    }, "PopperAnchor"),
  ),
  cP = "PopperContent",
  [Ite, Ete] = lP(cP),
  Fte = Ti.forwardRef(
    Ku(function (t, a) {
      let {
          __scopePopper: r,
          side: n = "bottom",
          sideOffset: i = 0,
          align: o = "center",
          alignOffset: A = 0,
          arrowPadding: s = 0,
          avoidCollisions: l = !0,
          collisionBoundary: u = [],
          collisionPadding: p = 0,
          sticky: v = "partial",
          hideWhenDetached: c = !1,
          updatePositionStrategy: B = "optimized",
          onPlaced: C,
          ...x
        } = t,
        w = uP(cP, r),
        [S, L] = Ti.useState(null),
        F = I2(a, L),
        [q, j] = Ti.useState(null),
        z = N0(q),
        k = z?.width ?? 0,
        O = z?.height ?? 0,
        ne = n + (o !== "center" ? "-" + o : ""),
        D = typeof p == "number" ? p : { top: 0, right: 0, bottom: 0, left: 0, ...p },
        H = Array.isArray(u) ? u : [u],
        te = H.length > 0,
        ee = { padding: D, boundary: H.filter(fP), altBoundary: te },
        {
          refs: ce,
          floatingStyles: de,
          placement: fe,
          isPositioned: se,
          middlewareData: ge,
        } = Yk({
          strategy: "fixed",
          placement: ne,
          whileElementsMounted: Ku(
            (...be) => pI(...be, { animationFrame: B === "always" }),
            "whileElementsMounted",
          ),
          elements: { reference: w.anchor },
          middleware: [
            Zk({ mainAxis: i + O, alignmentAxis: A }),
            l && Jk({ mainAxis: !0, crossAxis: !1, limiter: v === "partial" ? $k() : void 0, ...ee }),
            l && eP({ ...ee }),
            tP({
              ...ee,
              apply: Ku(({ elements: be, rects: Ue, availableWidth: Re, availableHeight: Ve }) => {
                let { width: Ke, height: je } = Ue.reference,
                  W = be.floating.style;
                (W.setProperty("--radix-popper-available-width", `${Re}px`),
                  W.setProperty("--radix-popper-available-height", `${Ve}px`),
                  W.setProperty("--radix-popper-anchor-width", `${Ke}px`),
                  W.setProperty("--radix-popper-anchor-height", `${je}px`));
              }, "apply"),
            }),
            q && rP({ element: q, padding: s }),
            Rte({ arrowWidth: k, arrowHeight: O }),
            c && aP({ strategy: "referenceHidden", ...ee, boundary: te ? ee.boundary : void 0 }),
          ],
        }),
        me = w.setPlacementState;
      Wa(
        () => (
          me(fe),
          () => {
            me(void 0);
          }
        ),
        [fe, me],
      );
      let [_e, N] = E2(fe),
        Y = Gi(C);
      Wa(() => {
        se && Y?.();
      }, [se, Y]);
      let ae = ge.arrow?.x,
        Ae = ge.arrow?.y,
        ue = ge.arrow?.centerOffset !== 0,
        [ve, we] = Ti.useState();
      return (
        Wa(() => {
          S && we(window.getComputedStyle(S).zIndex);
        }, [S]),
        (0, uf.jsx)("div", {
          ref: ce.setFloating,
          "data-radix-popper-content-wrapper": "",
          style: {
            ...de,
            transform: se ? de.transform : "translate(0, -200%)",
            minWidth: "max-content",
            zIndex: ve,
            "--radix-popper-transform-origin": [ge.transformOrigin?.x, ge.transformOrigin?.y].join(" "),
            ...(ge.hide?.referenceHidden && { visibility: "hidden", pointerEvents: "none" }),
          },
          dir: t.dir,
          children: (0, uf.jsx)(Ite, {
            scope: r,
            placedSide: _e,
            placedAlign: N,
            onArrowChange: j,
            arrowX: ae,
            arrowY: Ae,
            shouldHideArrow: ue,
            children: (0, uf.jsx)(ca.div, {
              "data-side": _e,
              "data-align": N,
              ...x,
              ref: F,
              style: { ...x.style, animation: se ? x.style?.animation : "none" },
            }),
          }),
        })
      );
    }, "PopperContent"),
  ),
  Ute = "PopperArrow",
  _te = { top: "bottom", right: "left", bottom: "top", left: "right" },
  Tte = Ti.forwardRef(
    Ku(function (t, a) {
      let { __scopePopper: r, ...n } = t,
        i = Ete(Ute, r),
        o = _te[i.placedSide];
      return (0, uf.jsx)("span", {
        ref: i.onArrowChange,
        style: {
          position: "absolute",
          left: i.arrowX,
          top: i.arrowY,
          [o]: 0,
          transformOrigin: { top: "", right: "0 0", bottom: "center 0", left: "100% 0" }[i.placedSide],
          transform: {
            top: "translateY(100%)",
            right: "translateY(50%) rotate(90deg) translateX(-50%)",
            bottom: "rotate(180deg)",
            left: "translateY(50%) rotate(-90deg) translateX(50%)",
          }[i.placedSide],
          visibility: i.shouldHideArrow ? "hidden" : void 0,
        },
        children: (0, uf.jsx)(iP, { ...n, ref: a, style: { ...n.style, display: "block" } }),
      });
    }, "PopperArrow"),
  );
function fP(e) {
  return e !== null;
}
Ku(fP, "isNotNull");
var Rte = Ku(
  (e) => ({
    name: "transformOrigin",
    options: e,
    fn(t) {
      let { placement: a, rects: r, middlewareData: n } = t,
        o = n.arrow?.centerOffset !== 0,
        A = o ? 0 : e.arrowWidth,
        s = o ? 0 : e.arrowHeight,
        [l, u] = E2(a),
        p = { start: "0%", center: "50%", end: "100%" }[u],
        v = (n.arrow?.x ?? 0) + A / 2,
        c = (n.arrow?.y ?? 0) + s / 2,
        B = "",
        C = "";
      return (
        l === "bottom"
          ? ((B = o ? p : `${v}px`), (C = `${-s}px`))
          : l === "top"
            ? ((B = o ? p : `${v}px`), (C = `${r.floating.height + s}px`))
            : l === "right"
              ? ((B = `${-s}px`), (C = o ? p : `${c}px`))
              : l === "left" && ((B = `${r.floating.width + s}px`), (C = o ? p : `${c}px`)),
        { data: { x: B, y: C } }
      );
    },
  }),
  "transformOrigin",
);
function E2(e) {
  let [t, a = "center"] = e.split("-");
  return [t, a];
}
Ku(E2, "getSideAndAlignFromPlacement");
var dP = xte,
  hP = Lte,
  pP = Fte,
  gP = Tte;
var ui = Me(Qt(), 1);
var mP = Me(Qt(), 1),
  Ote = Object.defineProperty,
  xI = (e, t) => Ote(e, "name", { value: t, configurable: !0 });
function CI(e, t) {
  if (typeof e == "function") return e(t);
  e != null && (e.current = t);
}
xI(CI, "setRef");
function vP(...e) {
  return (t) => {
    let a = !1,
      r = e.map((n) => {
        let i = CI(n, t);
        return (!a && typeof i == "function" && (a = !0), i);
      });
    if (a)
      return () => {
        for (let n = 0; n < r.length; n++) {
          let i = r[n];
          typeof i == "function" ? i() : CI(e[n], null);
        }
      };
  };
}
xI(vP, "composeRefs");
function SI(...e) {
  return mP.useCallback(vP(...e), e);
}
xI(SI, "useComposedRefs");
var Nte = Me(Qt(), 1),
  F2 = Me(Qt(), 1),
  Dte = Object.defineProperty,
  II = (e, t) => Dte(e, "name", { value: t, configurable: !0 }),
  LI = !1;
function yP() {
  let [e, t] = F2.useState(LI);
  return (
    F2.useEffect(() => {
      LI || ((LI = !0), t(!0));
    }, []),
    e
  );
}
II(yP, "useIsHydrated");
var wP = Nte[" useSyncExternalStore ".trim().toString()];
function BP() {
  return () => {};
}
II(BP, "subscribe");
function bP() {
  return wP(
    BP,
    () => !0,
    () => !1,
  );
}
II(bP, "useIsHydratedModern");
var CP = typeof wP == "function" ? bP : yP;
var cf = Me(_a(), 1),
  kte = Object.defineProperty,
  Rd = (e, t) => kte(e, "name", { value: t, configurable: !0 }),
  EI = "rovingFocusGroup.onEntryFocus",
  Pte = { bubbles: !1, cancelable: !0 },
  U2 = "RovingFocusGroup",
  [FI, xP, Mte] = U0(U2),
  [Hte, UI] = Xn(U2, [Mte]),
  [qte, zte] = Hte(U2),
  Vte = ui.forwardRef(
    Rd(function (t, a) {
      return (0, cf.jsx)(FI.Provider, {
        scope: t.__scopeRovingFocusGroup,
        children: (0, cf.jsx)(FI.Slot, {
          scope: t.__scopeRovingFocusGroup,
          children: (0, cf.jsx)(Kte, { ...t, ref: a }),
        }),
      });
    }, "RovingFocusGroup"),
  ),
  Kte = ui.forwardRef(
    Rd(function (t, a) {
      let {
          __scopeRovingFocusGroup: r,
          orientation: n,
          loop: i = !1,
          dir: o,
          currentTabStopId: A,
          defaultCurrentTabStopId: s,
          onCurrentTabStopIdChange: l,
          onEntryFocus: u,
          preventScrollOnEntryFocus: p = !1,
          ...v
        } = t,
        c = ui.useRef(null),
        B = SI(a, c),
        C = bd(o),
        [x, w] = is({ prop: A, defaultProp: s ?? null, onChange: l, caller: U2 }),
        [S, L] = ui.useState(!1),
        F = Gi(u),
        q = xP(r),
        j = ui.useRef(!1),
        [z, k] = ui.useState(0);
      return (
        ui.useEffect(() => {
          let O = c.current;
          if (O) return (O.addEventListener(EI, F), () => O.removeEventListener(EI, F));
        }, [F]),
        (0, cf.jsx)(qte, {
          scope: r,
          orientation: n,
          dir: C,
          loop: i,
          currentTabStopId: x,
          onItemFocus: ui.useCallback((O) => w(O), [w]),
          onItemShiftTab: ui.useCallback(() => L(!0), []),
          onFocusableItemAdd: ui.useCallback(() => k((O) => O + 1), []),
          onFocusableItemRemove: ui.useCallback(() => k((O) => O - 1), []),
          children: (0, cf.jsx)(ca.div, {
            tabIndex: S || z === 0 ? -1 : 0,
            "data-orientation": n,
            ...v,
            ref: B,
            style: { outline: "none", ...t.style },
            onMouseDown: na(t.onMouseDown, () => {
              j.current = !0;
            }),
            onFocus: na(t.onFocus, (O) => {
              let ne = !j.current;
              if (O.target === O.currentTarget && ne && !S) {
                let D = new CustomEvent(EI, Pte);
                if ((O.currentTarget.dispatchEvent(D), !D.defaultPrevented)) {
                  let H = q().filter((fe) => fe.focusable),
                    te = H.find((fe) => fe.active),
                    ee = H.find((fe) => fe.id === x),
                    de = [te, ee, ...H].filter(Boolean).map((fe) => fe.ref.current);
                  _I(de, p);
                }
              }
              j.current = !1;
            }),
            onBlur: na(t.onBlur, () => L(!1)),
          }),
        })
      );
    }, "RovingFocusGroupImpl"),
  ),
  Gte = "RovingFocusGroupItem",
  jte = ui.forwardRef(
    Rd(function (t, a) {
      let {
          __scopeRovingFocusGroup: r,
          focusable: n = !0,
          active: i = !1,
          tabStopId: o,
          children: A,
          ...s
        } = t,
        l = SA(),
        u = o || l,
        p = zte(Gte, r),
        v = p.currentTabStopId === u,
        c = xP(r),
        { onFocusableItemAdd: B, onFocusableItemRemove: C, currentTabStopId: x } = p,
        w = CP();
      return (
        Wa(() => {
          if (!(!w || !n)) return (B(), () => C());
        }, [w, n, B, C]),
        ui.useEffect(() => {
          if (!(w || !n)) return (B(), () => C());
        }, [w, n, B, C]),
        (0, cf.jsx)(FI.ItemSlot, {
          scope: r,
          id: u,
          focusable: n,
          active: i,
          children: (0, cf.jsx)(ca.span, {
            tabIndex: v ? 0 : -1,
            "data-orientation": p.orientation,
            ...s,
            ref: a,
            onMouseDown: na(t.onMouseDown, (S) => {
              n ? p.onItemFocus(u) : S.preventDefault();
            }),
            onFocus: na(t.onFocus, () => p.onItemFocus(u)),
            onKeyDown: na(t.onKeyDown, (S) => {
              if (S.key === "Tab" && S.shiftKey) {
                p.onItemShiftTab();
                return;
              }
              if (S.target !== S.currentTarget) return;
              let L = LP(S, p.orientation, p.dir);
              if (L !== void 0) {
                if (S.metaKey || S.ctrlKey || S.altKey || S.shiftKey) return;
                S.preventDefault();
                let q = c()
                  .filter((j) => j.focusable)
                  .map((j) => j.ref.current);
                if (L === "last") q.reverse();
                else if (L === "prev" || L === "next") {
                  L === "prev" && q.reverse();
                  let j = q.indexOf(S.currentTarget);
                  q = p.loop ? IP(q, j + 1) : q.slice(j + 1);
                }
                setTimeout(() => _I(q));
              }
            }),
            children: typeof A == "function" ? A({ isCurrentTabStop: v, hasTabStop: x != null }) : A,
          }),
        })
      );
    }, "RovingFocusGroupItem"),
  ),
  Wte = {
    ArrowLeft: "prev",
    ArrowUp: "prev",
    ArrowRight: "next",
    ArrowDown: "next",
    PageUp: "first",
    Home: "first",
    PageDown: "last",
    End: "last",
  };
function SP(e, t) {
  return t !== "rtl" ? e : e === "ArrowLeft" ? "ArrowRight" : e === "ArrowRight" ? "ArrowLeft" : e;
}
Rd(SP, "getDirectionAwareKey");
function LP(e, t, a) {
  let r = SP(e.key, a);
  if (
    !(t === "vertical" && ["ArrowLeft", "ArrowRight"].includes(r)) &&
    !(t === "horizontal" && ["ArrowUp", "ArrowDown"].includes(r))
  )
    return Wte[r];
}
Rd(LP, "getFocusIntent");
function _I(e, t = !1) {
  let a = document.activeElement;
  for (let r of e) if (r === a || (r.focus({ preventScroll: t }), document.activeElement !== a)) return;
}
Rd(_I, "focusFirst");
function IP(e, t) {
  return e.map((a, r) => e[(t + r) % e.length]);
}
Rd(IP, "wrapArray");
var EP = Vte,
  FP = jte;
var _2 = Me(Qt(), 1),
  Yte = Object.defineProperty,
  Zte = (e, t) => Yte(e, "name", { value: t, configurable: !0 });
function TI(e) {
  let t = _2.useRef({ value: e, previous: e });
  return _2.useMemo(
    () => (
      t.current.value !== e && ((t.current.previous = t.current.value), (t.current.value = e)),
      t.current.previous
    ),
    [e],
  );
}
Zte(TI, "usePrevious");
var Jte = Object.defineProperty,
  $te = (e, t) => Jte(e, "name", { value: t, configurable: !0 });
function T2(e, [t, a]) {
  return Math.min(a, Math.max(t, e));
}
$te(T2, "clamp");
var wo = {};
hu(wo, {
  Arrow: () => jae,
  Content: () => Sae,
  Group: () => Oae,
  Icon: () => wae,
  Item: () => Pae,
  ItemIndicator: () => qae,
  ItemText: () => Mae,
  Label: () => Nae,
  Portal: () => xae,
  Root: () => pae,
  ScrollDownButton: () => Vae,
  ScrollUpButton: () => zae,
  Select: () => pae,
  SelectArrow: () => jae,
  SelectContent: () => Sae,
  SelectGroup: () => Oae,
  SelectIcon: () => wae,
  SelectItem: () => Pae,
  SelectItemIndicator: () => qae,
  SelectItemText: () => Mae,
  SelectLabel: () => Nae,
  SelectPortal: () => xae,
  SelectScrollDownButton: () => Vae,
  SelectScrollUpButton: () => zae,
  SelectSeparator: () => Kae,
  SelectTrigger: () => mae,
  SelectValue: () => yae,
  SelectViewport: () => _ae,
  Separator: () => Kae,
  Trigger: () => mae,
  Value: () => yae,
  Viewport: () => _ae,
  createSelectScope: () => cae,
  unstable_BubbleInput: () => VP,
  unstable_Provider: () => PI,
  unstable_SelectBubbleInput: () => VP,
  unstable_SelectProvider: () => PI,
});
var ot = Me(Qt(), 1),
  kI = Me(Yh(), 1);
var UP = Me(Qt(), 1),
  eae = Object.defineProperty,
  QI = (e, t) => eae(e, "name", { value: t, configurable: !0 });
function RI(e, t) {
  if (typeof e == "function") return e(t);
  e != null && (e.current = t);
}
QI(RI, "setRef");
function _P(...e) {
  return (t) => {
    let a = !1,
      r = e.map((n) => {
        let i = RI(n, t);
        return (!a && typeof i == "function" && (a = !0), i);
      });
    if (a)
      return () => {
        for (let n = 0; n < r.length; n++) {
          let i = r[n];
          typeof i == "function" ? i() : RI(e[n], null);
        }
      };
  };
}
QI(_P, "composeRefs");
function jo(...e) {
  return UP.useCallback(_P(...e), e);
}
QI(jo, "useComposedRefs");
var Ri = Me(Qt(), 1);
var tae = Object.defineProperty,
  Zs = (e, t) => tae(e, "name", { value: t, configurable: !0 });
function DI(e) {
  let t = Ri.forwardRef((a, r) => {
    let { children: n, ...i } = a,
      o = null,
      A = !1,
      s = [];
    (OI(n) && typeof R2 == "function" && (n = R2(n._payload)),
      Ri.Children.forEach(n, (v) => {
        if (OP(v)) {
          A = !0;
          let c = v,
            B = "child" in c.props ? c.props.child : c.props.children;
          (OI(B) && typeof R2 == "function" && (B = R2(B._payload)),
            (o = rae(c, B)),
            s.push(o?.props?.children));
        } else s.push(v);
      }),
      o
        ? (o = Ri.cloneElement(o, void 0, s))
        : !A && Ri.Children.count(n) === 1 && Ri.isValidElement(n) && (o = n));
    let l = o ? QP(o) : void 0,
      u = jo(r, l);
    if (!o) {
      if (n || n === 0) throw new Error(A ? oae(e) : iae(e));
      return n;
    }
    let p = RP(i, o.props ?? {});
    return (o.type !== Ri.Fragment && (p.ref = r ? u : l), Ri.cloneElement(o, p));
  });
  return ((t.displayName = `${e}.Slot`), t);
}
Zs(DI, "createSlot");
var TP = Symbol.for("radix.slottable");
function aae(e) {
  let t = Zs((a) => ("child" in a ? a.children(a.child) : a.children), "Slottable");
  return ((t.displayName = `${e}.Slottable`), (t.__radixId = TP), t);
}
Zs(aae, "createSlottable");
var rae = Zs((e, t) => {
  if ("child" in e.props) {
    let a = e.props.child;
    return Ri.isValidElement(a) ? Ri.cloneElement(a, void 0, e.props.children(a.props.children)) : null;
  }
  return Ri.isValidElement(t) ? t : null;
}, "getSlottableElementFromSlottable");
function RP(e, t) {
  let a = { ...t };
  for (let r in t) {
    let n = e[r],
      i = t[r];
    /^on[A-Z]/.test(r)
      ? n && i
        ? (a[r] = (...A) => {
            let s = i(...A);
            return (n(...A), s);
          })
        : n && (a[r] = n)
      : r === "style"
        ? (a[r] = { ...n, ...i })
        : r === "className" && (a[r] = [n, i].filter(Boolean).join(" "));
  }
  return { ...e, ...a };
}
Zs(RP, "mergeProps");
function QP(e) {
  let t = Object.getOwnPropertyDescriptor(e.props, "ref")?.get,
    a = t && "isReactWarning" in t && t.isReactWarning;
  return a
    ? e.ref
    : ((t = Object.getOwnPropertyDescriptor(e, "ref")?.get),
      (a = t && "isReactWarning" in t && t.isReactWarning),
      a ? e.props.ref : e.props.ref || e.ref);
}
Zs(QP, "getElementRef");
function OP(e) {
  return (
    Ri.isValidElement(e) && typeof e.type == "function" && "__radixId" in e.type && e.type.__radixId === TP
  );
}
Zs(OP, "isSlottable");
var nae = Symbol.for("react.lazy");
function OI(e) {
  return (
    e != null &&
    typeof e == "object" &&
    "$$typeof" in e &&
    e.$$typeof === nae &&
    "_payload" in e &&
    DP(e._payload)
  );
}
Zs(OI, "isLazyComponent");
function DP(e) {
  return typeof e == "object" && e !== null && "then" in e;
}
Zs(DP, "isPromiseLike");
var iae = Zs(
    (e) => `${e} failed to slot onto its children. Expected a single React element child or \`Slottable\`.`,
    "createSlotError",
  ),
  oae = Zs(
    (e) =>
      `${e} failed to slot onto its \`Slottable\`. Expected \`Slottable\` to receive a single React element child.`,
    "createSlottableError",
  ),
  R2 = Ri[" use ".trim().toString()];
var zt = Me(_a(), 1),
  Aae = Object.defineProperty,
  Sa = (e, t) => Aae(e, "name", { value: t, configurable: !0 }),
  sae = [" ", "Enter", "ArrowUp", "ArrowDown"],
  lae = [" ", "Enter"],
  ag = "Select",
  [O2, D2, uae] = U0(ag),
  [Od, cae] = Xn(ag, [uae, bI]),
  N2 = bI(),
  [fae, ff] = Od(ag),
  [dae, hae] = Od(ag);
function PI(e) {
  let {
      __scopeSelect: t,
      children: a,
      open: r,
      defaultOpen: n,
      onOpenChange: i,
      value: o,
      defaultValue: A,
      onValueChange: s,
      dir: l,
      name: u,
      autoComplete: p,
      disabled: v,
      required: c,
      form: B,
      internal_do_not_use_render: C,
    } = e,
    x = N2(t),
    [w, S] = ot.useState(null),
    [L, F] = ot.useState(null),
    [q, j] = ot.useState(!1),
    z = bd(l),
    [k, O] = is({ prop: r, defaultProp: n ?? !1, onChange: i, caller: ag }),
    [ne, D] = is({ prop: o, defaultProp: A, onChange: s, caller: ag }),
    H = ot.useRef(null),
    te = ot.useRef(ne);
  ot.useEffect(() => {
    let N = B ? w?.ownerDocument.getElementById(B) : w?.form;
    if (N instanceof HTMLFormElement) {
      let Y = Sa(() => D(te.current), "reset");
      return (N.addEventListener("reset", Y), () => N.removeEventListener("reset", Y));
    }
  }, [B, w, D]);
  let ee = w ? !!B || !!w.closest("form") : !0,
    [ce, de] = ot.useState(new Set()),
    fe = SA(),
    se = Array.from(ce)
      .map((N) => N.props.value)
      .join(";"),
    ge = ot.useCallback((N) => {
      de((Y) => new Set(Y).add(N));
    }, []),
    me = ot.useCallback((N) => {
      de((Y) => {
        let ae = new Set(Y);
        return (ae.delete(N), ae);
      });
    }, []),
    _e = {
      required: c,
      trigger: w,
      onTriggerChange: S,
      valueNode: L,
      onValueNodeChange: F,
      valueNodeHasChildren: q,
      onValueNodeHasChildrenChange: j,
      contentId: fe,
      value: ne,
      onValueChange: D,
      open: k,
      onOpenChange: O,
      dir: z,
      triggerPointerDownPosRef: H,
      disabled: v,
      name: u,
      autoComplete: p,
      form: B,
      nativeOptions: ce,
      nativeSelectKey: se,
      isFormControl: ee,
    };
  return (0, zt.jsx)(dP, {
    ...x,
    children: (0, zt.jsx)(fae, {
      scope: t,
      ..._e,
      children: (0, zt.jsx)(O2.Provider, {
        scope: t,
        children: (0, zt.jsx)(dae, {
          scope: t,
          onNativeOptionAdd: ge,
          onNativeOptionRemove: me,
          children: KP(C) ? C(_e) : a,
        }),
      }),
    }),
  });
}
Sa(PI, "SelectProvider");
var pae = Sa((e) => {
    let { __scopeSelect: t, children: a, ...r } = e;
    return (0, zt.jsx)(PI, {
      __scopeSelect: t,
      ...r,
      internal_do_not_use_render: ({ isFormControl: n }) =>
        (0, zt.jsxs)(zt.Fragment, { children: [a, n ? (0, zt.jsx)(VP, { __scopeSelect: t }) : null] }),
    });
  }, "Select"),
  gae = "SelectTrigger",
  mae = ot.forwardRef(
    Sa(function (t, a) {
      let { __scopeSelect: r, disabled: n = !1, ...i } = t,
        o = N2(r),
        A = ff(gae, r),
        s = A.disabled || n,
        l = jo(a, A.onTriggerChange),
        u = D2(r),
        p = ot.useRef("touch"),
        [v, c, B] = HI((x) => {
          let w = u().filter((F) => !F.disabled),
            S = w.find((F) => F.value === A.value),
            L = qI(w, x, S);
          L !== void 0 && A.onValueChange(L.value);
        }),
        C = Sa((x) => {
          (s || (A.onOpenChange(!0), B()),
            x && (A.triggerPointerDownPosRef.current = { x: Math.round(x.pageX), y: Math.round(x.pageY) }));
        }, "handleOpen");
      return (0, zt.jsx)(hP, {
        asChild: !0,
        ...o,
        children: (0, zt.jsx)(ca.button, {
          type: "button",
          role: "combobox",
          "aria-controls": A.open ? A.contentId : void 0,
          "aria-expanded": A.open,
          "aria-required": A.required,
          "aria-autocomplete": "none",
          dir: A.dir,
          "data-state": A.open ? "open" : "closed",
          disabled: s,
          "data-disabled": s ? "" : void 0,
          "data-placeholder": K0(A.value) ? "" : void 0,
          ...i,
          ref: l,
          onClick: na(i.onClick, (x) => {
            (x.currentTarget.focus(), p.current !== "mouse" && C(x));
          }),
          onPointerDown: na(i.onPointerDown, (x) => {
            p.current = x.pointerType;
            let w = x.target;
            (w.hasPointerCapture(x.pointerId) && w.releasePointerCapture(x.pointerId),
              x.button === 0 && x.ctrlKey === !1 && x.pointerType === "mouse" && (C(x), x.preventDefault()));
          }),
          onKeyDown: na(i.onKeyDown, (x) => {
            let w = v.current !== "";
            (!(x.ctrlKey || x.altKey || x.metaKey) && x.key.length === 1 && c(x.key),
              !(w && x.key === " ") && sae.includes(x.key) && (C(), x.preventDefault()));
          }),
        }),
      });
    }, "SelectTrigger"),
  ),
  vae = "SelectValue",
  yae = ot.forwardRef(
    Sa(function (t, a) {
      let { __scopeSelect: r, className: n, style: i, children: o, placeholder: A = "", ...s } = t,
        l = ff(vae, r),
        { onValueNodeHasChildrenChange: u } = l,
        p = o !== void 0,
        v = jo(a, l.onValueNodeChange);
      Wa(() => {
        u(p);
      }, [u, p]);
      let c = K0(l.value);
      return (0, zt.jsx)(ca.span, {
        ...s,
        asChild: c ? !1 : s.asChild,
        ref: v,
        style: { pointerEvents: "none" },
        children: (0, zt.jsx)(ot.Fragment, { children: c ? A : o }, c ? "placeholder" : "value"),
      });
    }, "SelectValue"),
  ),
  wae = ot.forwardRef(
    Sa(function (t, a) {
      let { __scopeSelect: r, children: n, ...i } = t;
      return (0, zt.jsx)(ca.span, { "aria-hidden": !0, ...i, ref: a, children: n || "\u25BC" });
    }, "SelectIcon"),
  ),
  Bae = "SelectPortal",
  [bae, Cae] = Od(Bae, { forceMount: void 0 }),
  xae = Sa((e) => {
    let { __scopeSelect: t, forceMount: a, ...r } = e;
    return (0, zt.jsx)(bae, {
      scope: e.__scopeSelect,
      forceMount: a,
      children: (0, zt.jsx)(e2, { asChild: !0, ...r }),
    });
  }, "SelectPortal"),
  Qd = "SelectContent",
  Sae = ot.forwardRef(
    Sa(function (t, a) {
      let r = Cae(Qd, t.__scopeSelect),
        { forceMount: n = r.forceMount, ...i } = t,
        o = ff(Qd, t.__scopeSelect),
        [A, s] = ot.useState();
      return (
        Wa(() => {
          s(new DocumentFragment());
        }, []),
        (0, zt.jsx)(Tl, {
          present: n || o.open,
          children: ({ present: l }) =>
            l ? (0, zt.jsx)(Eae, { ...i, ref: a }) : (0, zt.jsx)(Lae, { ...i, fragment: A }),
        })
      );
    }, "SelectContent"),
  ),
  Lae = ot.forwardRef(
    Sa(function (t, a) {
      let { __scopeSelect: r, children: n, fragment: i } = t;
      return i
        ? kI.createPortal(
            (0, zt.jsx)(HP, {
              scope: r,
              children: (0, zt.jsx)(O2.Slot, {
                scope: r,
                children: (0, zt.jsx)("div", { ref: a, children: n }),
              }),
            }),
            i,
          )
        : null;
    }, "SelectContentFragment"),
  ),
  Js = 10,
  [HP, df] = Od(Qd),
  Iae = DI("SelectContent.RemoveScroll"),
  Eae = ot.forwardRef(
    Sa(function (t, a) {
      let { __scopeSelect: r } = t,
        {
          position: n = "item-aligned",
          onCloseAutoFocus: i,
          onEscapeKeyDown: o,
          onPointerDownOutside: A,
          side: s,
          sideOffset: l,
          align: u,
          alignOffset: p,
          arrowPadding: v,
          collisionBoundary: c,
          collisionPadding: B,
          sticky: C,
          hideWhenDetached: x,
          avoidCollisions: w,
          ...S
        } = t,
        L = ff(Qd, r),
        [F, q] = ot.useState(null),
        [j, z] = ot.useState(null),
        k = jo(a, q),
        [O, ne] = ot.useState(null),
        [D, H] = ot.useState(null),
        te = D2(r),
        [ee, ce] = ot.useState(!1),
        de = ot.useRef(!1);
      (ot.useEffect(() => {
        if (F) return u2(F);
      }, [F]),
        Xp());
      let fe = ot.useCallback(
          (we) => {
            let [be, ...Ue] = te().map((Ke) => Ke.ref.current),
              [Re] = Ue.slice(-1),
              Ve = document.activeElement;
            for (let Ke of we)
              if (
                Ke === Ve ||
                (Ke?.scrollIntoView({ block: "nearest" }),
                Ke === be && j && (j.scrollTop = 0),
                Ke === Re && j && (j.scrollTop = j.scrollHeight),
                Ke?.focus(),
                document.activeElement !== Ve)
              )
                return;
          },
          [te, j],
        ),
        se = ot.useCallback(() => fe([O, F]), [fe, O, F]);
      ot.useEffect(() => {
        ee && se();
      }, [ee, se]);
      let { onOpenChange: ge, triggerPointerDownPosRef: me } = L;
      (ot.useEffect(() => {
        if (F) {
          let we = { x: 0, y: 0 },
            be = Sa((Re) => {
              we = {
                x: Math.abs(Math.round(Re.pageX) - (me.current?.x ?? 0)),
                y: Math.abs(Math.round(Re.pageY) - (me.current?.y ?? 0)),
              };
            }, "handlePointerMove"),
            Ue = Sa((Re) => {
              (we.x <= 10 && we.y <= 10 ? Re.preventDefault() : Re.composedPath().includes(F) || ge(!1),
                document.removeEventListener("pointermove", be),
                (me.current = null));
            }, "handlePointerUp");
          return (
            me.current !== null &&
              (document.addEventListener("pointermove", be),
              document.addEventListener("pointerup", Ue, { capture: !0, once: !0 })),
            () => {
              (document.removeEventListener("pointermove", be),
                document.removeEventListener("pointerup", Ue, { capture: !0 }));
            }
          );
        }
      }, [F, ge, me]),
        ot.useEffect(() => {
          let we = Sa(() => ge(!1), "close");
          return (
            window.addEventListener("blur", we),
            window.addEventListener("resize", we),
            () => {
              (window.removeEventListener("blur", we), window.removeEventListener("resize", we));
            }
          );
        }, [ge]));
      let [_e, N] = HI((we) => {
          let be = te().filter((Ve) => !Ve.disabled),
            Ue = be.find((Ve) => Ve.ref.current === document.activeElement),
            Re = qI(be, we, Ue);
          Re && setTimeout(() => Re.ref.current?.focus());
        }),
        Y = ot.useCallback(
          (we, be, Ue) => {
            let Re = !de.current && !Ue;
            ((L.value !== void 0 && L.value === be) || Re) && (ne(we), Re && (de.current = !0));
          },
          [L.value],
        ),
        ae = ot.useCallback(() => F?.focus(), [F]),
        Ae = ot.useCallback(
          (we, be, Ue) => {
            let Re = !de.current && !Ue;
            ((L.value !== void 0 && L.value === be) || Re) && H(we);
          },
          [L.value],
        ),
        ue = n === "popper" ? NP : Fae,
        ve =
          ue === NP
            ? {
                side: s,
                sideOffset: l,
                align: u,
                alignOffset: p,
                arrowPadding: v,
                collisionBoundary: c,
                collisionPadding: B,
                sticky: C,
                hideWhenDetached: x,
                avoidCollisions: w,
              }
            : {};
      return (0, zt.jsx)(HP, {
        scope: r,
        content: F,
        viewport: j,
        onViewportChange: z,
        itemRefCallback: Y,
        selectedItem: O,
        onItemLeave: ae,
        itemTextRefCallback: Ae,
        focusSelectedItem: se,
        selectedItemText: D,
        position: n,
        isPositioned: ee,
        searchRef: _e,
        children: (0, zt.jsx)(O0, {
          as: Iae,
          allowPinchZoom: !0,
          children: (0, zt.jsx)(Jw, {
            asChild: !0,
            trapped: L.open,
            onMountAutoFocus: (we) => {
              we.preventDefault();
            },
            onUnmountAutoFocus: na(i, (we) => {
              (L.trigger?.focus({ preventScroll: !0 }), we.preventDefault());
            }),
            children: (0, zt.jsx)(Zw, {
              asChild: !0,
              disableOutsidePointerEvents: !0,
              onEscapeKeyDown: o,
              onPointerDownOutside: A,
              onFocusOutside: (we) => we.preventDefault(),
              onDismiss: () => L.onOpenChange(!1),
              children: (0, zt.jsx)(ue, {
                role: "listbox",
                id: L.contentId,
                "data-state": L.open ? "open" : "closed",
                dir: L.dir,
                onContextMenu: (we) => we.preventDefault(),
                ...S,
                ...ve,
                onPlaced: () => ce(!0),
                ref: k,
                style: { display: "flex", flexDirection: "column", outline: "none", ...S.style },
                onKeyDown: na(S.onKeyDown, (we) => {
                  let be = we.ctrlKey || we.altKey || we.metaKey;
                  if (
                    (we.key === "Tab" && we.preventDefault(),
                    !be && we.key.length === 1 && N(we.key),
                    ["ArrowUp", "ArrowDown", "Home", "End"].includes(we.key))
                  ) {
                    let Re = te()
                      .filter((Ve) => !Ve.disabled)
                      .map((Ve) => Ve.ref.current);
                    if (
                      (["ArrowUp", "End"].includes(we.key) && (Re = Re.slice().reverse()),
                      ["ArrowUp", "ArrowDown"].includes(we.key))
                    ) {
                      let Ve = we.target,
                        Ke = Re.indexOf(Ve);
                      Re = Re.slice(Ke + 1);
                    }
                    (setTimeout(() => fe(Re)), we.preventDefault());
                  }
                }),
              }),
            }),
          }),
        }),
      });
    }, "SelectContentImpl"),
  ),
  Fae = ot.forwardRef(
    Sa(function (t, a) {
      let { __scopeSelect: r, onPlaced: n, ...i } = t,
        o = ff(Qd, r),
        A = df(Qd, r),
        [s, l] = ot.useState(null),
        [u, p] = ot.useState(null),
        v = jo(a, p),
        c = D2(r),
        B = ot.useRef(!1),
        C = ot.useRef(!0),
        { viewport: x, selectedItem: w, selectedItemText: S, focusSelectedItem: L } = A,
        F = ot.useCallback(() => {
          if (o.trigger && o.valueNode && s && u && x && w && S) {
            let k = o.trigger.getBoundingClientRect(),
              O = u.getBoundingClientRect(),
              ne = o.valueNode.getBoundingClientRect(),
              D = S.getBoundingClientRect();
            if (o.dir !== "rtl") {
              let Ve = D.left - O.left,
                Ke = ne.left - Ve,
                je = k.left - Ke,
                W = k.width + je,
                Pe = Math.max(W, O.width),
                vt = window.innerWidth - Js,
                lt = T2(Ke, [Js, Math.max(Js, vt - Pe)]);
              ((s.style.minWidth = W + "px"), (s.style.left = lt + "px"));
            } else {
              let Ve = O.right - D.right,
                Ke = window.innerWidth - ne.right - Ve,
                je = window.innerWidth - k.right - Ke,
                W = k.width + je,
                Pe = Math.max(W, O.width),
                vt = window.innerWidth - Js,
                lt = T2(Ke, [Js, Math.max(Js, vt - Pe)]);
              ((s.style.minWidth = W + "px"), (s.style.right = lt + "px"));
            }
            let H = c(),
              te = window.innerHeight - Js * 2,
              ee = x.scrollHeight,
              ce = window.getComputedStyle(u),
              de = parseInt(ce.borderTopWidth, 10),
              fe = parseInt(ce.paddingTop, 10),
              se = parseInt(ce.borderBottomWidth, 10),
              ge = parseInt(ce.paddingBottom, 10),
              me = de + fe + ee + ge + se,
              _e = Math.min(w.offsetHeight * 5, me),
              N = window.getComputedStyle(x),
              Y = parseInt(N.paddingTop, 10),
              ae = parseInt(N.paddingBottom, 10),
              Ae = k.top + k.height / 2 - Js,
              ue = te - Ae,
              ve = w.offsetHeight / 2,
              we = w.offsetTop + ve,
              be = de + fe + we,
              Ue = me - be;
            if (be <= Ae) {
              let Ve = H.length > 0 && w === H[H.length - 1].ref.current;
              s.style.bottom = "0px";
              let Ke = u.clientHeight - x.offsetTop - x.offsetHeight,
                je = Math.max(ue, ve + (Ve ? ae : 0) + Ke + se),
                W = be + je;
              s.style.height = W + "px";
            } else {
              let Ve = H.length > 0 && w === H[0].ref.current;
              s.style.top = "0px";
              let je = Math.max(Ae, de + x.offsetTop + (Ve ? Y : 0) + ve) + Ue;
              ((s.style.height = je + "px"), (x.scrollTop = be - Ae + x.offsetTop));
            }
            ((s.style.margin = `${Js}px 0`),
              (s.style.minHeight = _e + "px"),
              (s.style.maxHeight = te + "px"),
              n?.(),
              requestAnimationFrame(() => (B.current = !0)));
          }
        }, [c, o.trigger, o.valueNode, s, u, x, w, S, o.dir, n]);
      Wa(() => F(), [F]);
      let [q, j] = ot.useState();
      Wa(() => {
        u && j(window.getComputedStyle(u).zIndex);
      }, [u]);
      let z = ot.useCallback(
        (k) => {
          k && C.current === !0 && (F(), L?.(), (C.current = !1));
        },
        [F, L],
      );
      return (0, zt.jsx)(Uae, {
        scope: r,
        contentWrapper: s,
        shouldExpandOnScrollRef: B,
        onScrollButtonChange: z,
        children: (0, zt.jsx)("div", {
          ref: l,
          style: { display: "flex", flexDirection: "column", position: "fixed", zIndex: q },
          children: (0, zt.jsx)(ca.div, {
            ...i,
            ref: v,
            style: { boxSizing: "border-box", maxHeight: "100%", ...i.style },
          }),
        }),
      });
    }, "SelectItemAlignedPosition"),
  ),
  NP = ot.forwardRef(
    Sa(function (t, a) {
      let { __scopeSelect: r, align: n = "start", collisionPadding: i = Js, ...o } = t,
        A = N2(r);
      return (0, zt.jsx)(pP, {
        ...A,
        ...o,
        ref: a,
        align: n,
        collisionPadding: i,
        style: {
          boxSizing: "border-box",
          ...o.style,
          "--radix-select-content-transform-origin": "var(--radix-popper-transform-origin)",
          "--radix-select-content-available-width": "var(--radix-popper-available-width)",
          "--radix-select-content-available-height": "var(--radix-popper-available-height)",
          "--radix-select-trigger-width": "var(--radix-popper-anchor-width)",
          "--radix-select-trigger-height": "var(--radix-popper-anchor-height)",
        },
      });
    }, "SelectPopperPosition"),
  ),
  [Uae, MI] = Od(Qd, {}),
  kP = "SelectViewport",
  _ae = ot.forwardRef(
    Sa(function (t, a) {
      let { __scopeSelect: r, nonce: n, ...i } = t,
        o = df(kP, r),
        A = MI(kP, r),
        s = jo(a, o.onViewportChange),
        l = ot.useRef(0);
      return (0, zt.jsxs)(zt.Fragment, {
        children: [
          (0, zt.jsx)("style", {
            dangerouslySetInnerHTML: {
              __html:
                "[data-radix-select-viewport]{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;}[data-radix-select-viewport]::-webkit-scrollbar{display:none}",
            },
            nonce: n,
          }),
          (0, zt.jsx)(O2.Slot, {
            scope: r,
            children: (0, zt.jsx)(ca.div, {
              "data-radix-select-viewport": "",
              role: "presentation",
              ...i,
              ref: s,
              style: { position: "relative", flex: 1, overflow: "hidden auto", ...i.style },
              onScroll: na(i.onScroll, (u) => {
                let p = u.currentTarget,
                  { contentWrapper: v, shouldExpandOnScrollRef: c } = A;
                if (c?.current && v) {
                  let B = Math.abs(l.current - p.scrollTop);
                  if (B > 0) {
                    let C = window.innerHeight - Js * 2,
                      x = parseFloat(v.style.minHeight),
                      w = parseFloat(v.style.height),
                      S = Math.max(x, w);
                    if (S < C) {
                      let L = S + B,
                        F = Math.min(C, L),
                        q = L - F;
                      ((v.style.height = F + "px"),
                        v.style.bottom === "0px" &&
                          ((p.scrollTop = q > 0 ? q : 0), (v.style.justifyContent = "flex-end")));
                    }
                  }
                }
                l.current = p.scrollTop;
              }),
            }),
          }),
        ],
      });
    }, "SelectViewport"),
  ),
  Tae = "SelectGroup",
  [Rae, Qae] = Od(Tae),
  Oae = ot.forwardRef(
    Sa(function (t, a) {
      let { __scopeSelect: r, ...n } = t,
        i = SA();
      return (0, zt.jsx)(Rae, {
        scope: r,
        id: i,
        children: (0, zt.jsx)(ca.div, { role: "group", "aria-labelledby": i, ...n, ref: a }),
      });
    }, "SelectGroup"),
  ),
  Dae = "SelectLabel",
  Nae = ot.forwardRef(
    Sa(function (t, a) {
      let { __scopeSelect: r, ...n } = t,
        i = Qae(Dae, r);
      return (0, zt.jsx)(ca.div, { id: i.id, ...n, ref: a });
    }, "SelectLabel"),
  ),
  NI = "SelectItem",
  [kae, qP] = Od(NI),
  Pae = ot.forwardRef(
    Sa(function (t, a) {
      let { __scopeSelect: r, value: n, disabled: i = !1, textValue: o, ...A } = t,
        s = ff(NI, r),
        l = df(NI, r),
        u = s.value === n,
        [p, v] = ot.useState(o ?? ""),
        [c, B] = ot.useState(!1),
        C = Gi((F) => l.itemRefCallback?.(F, n, i)),
        x = jo(a, C),
        w = SA(),
        S = ot.useRef("touch"),
        L = Sa(() => {
          i || (s.onValueChange(n), s.onOpenChange(!1));
        }, "handleSelect");
      return (0, zt.jsx)(kae, {
        scope: r,
        value: n,
        disabled: i,
        textId: w,
        isSelected: u,
        onItemTextChange: ot.useCallback((F) => {
          v((q) => q || (F?.textContent ?? "").trim());
        }, []),
        children: (0, zt.jsx)(O2.ItemSlot, {
          scope: r,
          value: n,
          disabled: i,
          textValue: p,
          children: (0, zt.jsx)(ca.div, {
            role: "option",
            "aria-labelledby": w,
            "data-highlighted": c ? "" : void 0,
            "aria-selected": u && c,
            "data-state": u ? "checked" : "unchecked",
            "aria-disabled": i || void 0,
            "data-disabled": i ? "" : void 0,
            tabIndex: i ? void 0 : -1,
            ...A,
            ref: x,
            onFocus: na(A.onFocus, () => B(!0)),
            onBlur: na(A.onBlur, () => B(!1)),
            onClick: na(A.onClick, () => {
              S.current !== "mouse" && L();
            }),
            onPointerUp: na(A.onPointerUp, () => {
              S.current === "mouse" && L();
            }),
            onPointerDown: na(A.onPointerDown, (F) => {
              S.current = F.pointerType;
            }),
            onPointerMove: na(A.onPointerMove, (F) => {
              ((S.current = F.pointerType),
                i
                  ? l.onItemLeave?.()
                  : S.current === "mouse" && F.currentTarget.focus({ preventScroll: !0 }));
            }),
            onPointerLeave: na(A.onPointerLeave, (F) => {
              F.currentTarget === document.activeElement && l.onItemLeave?.();
            }),
            onKeyDown: na(A.onKeyDown, (F) => {
              i ||
                F.target !== F.currentTarget ||
                (l.searchRef?.current !== "" && F.key === " ") ||
                (lae.includes(F.key) && L(), F.key === " " && F.preventDefault());
            }),
          }),
        }),
      });
    }, "SelectItem"),
  ),
  Q2 = "SelectItemText",
  Mae = ot.forwardRef(
    Sa(function (t, a) {
      let { __scopeSelect: r, className: n, style: i, ...o } = t,
        A = ff(Q2, r),
        s = df(Q2, r),
        l = qP(Q2, r),
        u = hae(Q2, r),
        [p, v] = ot.useState(null),
        c = Gi((L) => s.itemTextRefCallback?.(L, l.value, l.disabled)),
        B = jo(a, v, l.onItemTextChange, c),
        C = p?.textContent,
        x = ot.useMemo(
          () => (0, zt.jsx)("option", { value: l.value, disabled: l.disabled, children: C }, l.value),
          [l.disabled, l.value, C],
        ),
        { onNativeOptionAdd: w, onNativeOptionRemove: S } = u;
      return (
        Wa(() => (w(x), () => S(x)), [w, S, x]),
        (0, zt.jsxs)(zt.Fragment, {
          children: [
            (0, zt.jsx)(ca.span, { id: l.textId, ...o, ref: B }),
            l.isSelected && A.valueNode && !A.valueNodeHasChildren && !K0(A.value)
              ? kI.createPortal(o.children, A.valueNode)
              : null,
          ],
        })
      );
    }, "SelectItemText"),
  ),
  Hae = "SelectItemIndicator",
  qae = ot.forwardRef(
    Sa(function (t, a) {
      let { __scopeSelect: r, ...n } = t;
      return qP(Hae, r).isSelected ? (0, zt.jsx)(ca.span, { "aria-hidden": !0, ...n, ref: a }) : null;
    }, "SelectItemIndicator"),
  ),
  PP = "SelectScrollUpButton",
  zae = ot.forwardRef(
    Sa(function (t, a) {
      let r = df(PP, t.__scopeSelect),
        n = MI(PP, t.__scopeSelect),
        [i, o] = ot.useState(!1),
        A = jo(a, n.onScrollButtonChange);
      return (
        Wa(() => {
          if (r.viewport && r.isPositioned) {
            let l = function () {
              let p = u.scrollTop > 0;
              o(p);
            };
            var s = l;
            Sa(l, "handleScroll");
            let u = r.viewport;
            return (l(), u.addEventListener("scroll", l), () => u.removeEventListener("scroll", l));
          }
        }, [r.viewport, r.isPositioned]),
        i
          ? (0, zt.jsx)(zP, {
              ...t,
              ref: A,
              onAutoScroll: () => {
                let { viewport: s, selectedItem: l } = r;
                s && l && (s.scrollTop = s.scrollTop - l.offsetHeight);
              },
            })
          : null
      );
    }, "SelectScrollUpButton"),
  ),
  MP = "SelectScrollDownButton",
  Vae = ot.forwardRef(
    Sa(function (t, a) {
      let r = df(MP, t.__scopeSelect),
        n = MI(MP, t.__scopeSelect),
        [i, o] = ot.useState(!1),
        A = jo(a, n.onScrollButtonChange);
      return (
        Wa(() => {
          if (r.viewport && r.isPositioned) {
            let l = function () {
              let p = u.scrollHeight - u.clientHeight,
                v = Math.ceil(u.scrollTop) < p;
              o(v);
            };
            var s = l;
            Sa(l, "handleScroll");
            let u = r.viewport;
            return (l(), u.addEventListener("scroll", l), () => u.removeEventListener("scroll", l));
          }
        }, [r.viewport, r.isPositioned]),
        i
          ? (0, zt.jsx)(zP, {
              ...t,
              ref: A,
              onAutoScroll: () => {
                let { viewport: s, selectedItem: l } = r;
                s && l && (s.scrollTop = s.scrollTop + l.offsetHeight);
              },
            })
          : null
      );
    }, "SelectScrollDownButton"),
  ),
  zP = ot.forwardRef(
    Sa(function (t, a) {
      let { __scopeSelect: r, onAutoScroll: n, ...i } = t,
        o = df("SelectScrollButton", r),
        A = ot.useRef(null),
        s = D2(r),
        l = ot.useCallback(() => {
          A.current !== null && (window.clearInterval(A.current), (A.current = null));
        }, []);
      return (
        ot.useEffect(() => () => l(), [l]),
        Wa(() => {
          s()
            .find((p) => p.ref.current === document.activeElement)
            ?.ref.current?.scrollIntoView({ block: "nearest" });
        }, [s]),
        (0, zt.jsx)(ca.div, {
          "aria-hidden": !0,
          ...i,
          ref: a,
          style: { flexShrink: 0, ...i.style },
          onPointerDown: na(i.onPointerDown, () => {
            A.current === null && (A.current = window.setInterval(n, 50));
          }),
          onPointerMove: na(i.onPointerMove, () => {
            (o.onItemLeave?.(), A.current === null && (A.current = window.setInterval(n, 50)));
          }),
          onPointerLeave: na(i.onPointerLeave, () => {
            l();
          }),
        })
      );
    }, "SelectScrollButtonImpl"),
  ),
  Kae = ot.forwardRef(
    Sa(function (t, a) {
      let { __scopeSelect: r, ...n } = t;
      return (0, zt.jsx)(ca.div, { "aria-hidden": !0, ...n, ref: a });
    }, "SelectSeparator"),
  ),
  Gae = "SelectArrow",
  jae = ot.forwardRef(
    Sa(function (t, a) {
      let { __scopeSelect: r, ...n } = t,
        i = N2(r);
      return df(Gae, r).position === "popper" ? (0, zt.jsx)(gP, { ...i, ...n, ref: a }) : null;
    }, "SelectArrow"),
  ),
  Wae = "SelectBubbleInput",
  VP = ot.forwardRef(
    Sa(function ({ __scopeSelect: t, ...a }, r) {
      let n = ff(Wae, t),
        { value: i, onValueChange: o, required: A, disabled: s, name: l, autoComplete: u, form: p } = n,
        { nativeOptions: v, nativeSelectKey: c } = n,
        B = ot.useRef(null),
        C = jo(r, B),
        x = i ?? "",
        w = TI(x),
        S = Array.from(v).some((L) => (L.props.value ?? "") === "");
      return (
        ot.useEffect(() => {
          let L = B.current;
          if (!L) return;
          let F = window.HTMLSelectElement.prototype,
            j = Object.getOwnPropertyDescriptor(F, "value").set;
          if (w !== x && j) {
            let z = new Event("change", { bubbles: !0 });
            (j.call(L, x), L.dispatchEvent(z));
          }
        }, [w, x]),
        (0, zt.jsxs)(
          ca.select,
          {
            "aria-hidden": !0,
            required: A,
            tabIndex: -1,
            name: l,
            autoComplete: u,
            disabled: s,
            form: p,
            onChange: (L) => o(L.target.value),
            ...a,
            style: { ...yD, ...a.style },
            ref: C,
            defaultValue: x,
            children: [K0(i) && !S ? (0, zt.jsx)("option", { value: "" }) : null, Array.from(v)],
          },
          c,
        )
      );
    }, "SelectBubbleInput"),
  );
function KP(e) {
  return typeof e == "function";
}
Sa(KP, "isFunction");
function K0(e) {
  return e === "" || e === void 0;
}
Sa(K0, "shouldShowPlaceholder");
function HI(e) {
  let t = Gi(e),
    a = ot.useRef(""),
    r = ot.useRef(0),
    n = ot.useCallback(
      (o) => {
        let A = a.current + o;
        (t(A),
          Sa(function s(l) {
            ((a.current = l),
              window.clearTimeout(r.current),
              l !== "" && (r.current = window.setTimeout(() => s(""), 1e3)));
          }, "updateSearch")(A));
      },
      [t],
    ),
    i = ot.useCallback(() => {
      ((a.current = ""), window.clearTimeout(r.current));
    }, []);
  return (ot.useEffect(() => () => window.clearTimeout(r.current), []), [a, n, i]);
}
Sa(HI, "useTypeaheadSearch");
function qI(e, t, a) {
  let n = t.length > 1 && Array.from(t).every((l) => l === t[0]) ? t[0] : t,
    i = a ? e.indexOf(a) : -1,
    o = GP(e, Math.max(i, 0));
  n.length === 1 && (o = o.filter((l) => l !== a));
  let s = o.find((l) => l.textValue.toLowerCase().startsWith(n.toLowerCase()));
  return s !== a ? s : void 0;
}
Sa(qI, "findNextItem");
function GP(e, t) {
  return e.map((a, r) => e[(t + r) % e.length]);
}
Sa(GP, "wrapArray");
var P2 = {};
hu(P2, {
  Root: () => Zae,
  Slot: () => Zae,
  Slottable: () => Jae,
  createSlot: () => jI,
  createSlottable: () => WI,
});
var Qi = Me(Qt(), 1);
var jP = Me(Qt(), 1),
  Xae = Object.defineProperty,
  VI = (e, t) => Xae(e, "name", { value: t, configurable: !0 });
function zI(e, t) {
  if (typeof e == "function") return e(t);
  e != null && (e.current = t);
}
VI(zI, "setRef");
function WP(...e) {
  return (t) => {
    let a = !1,
      r = e.map((n) => {
        let i = zI(n, t);
        return (!a && typeof i == "function" && (a = !0), i);
      });
    if (a)
      return () => {
        for (let n = 0; n < r.length; n++) {
          let i = r[n];
          typeof i == "function" ? i() : zI(e[n], null);
        }
      };
  };
}
VI(WP, "composeRefs");
function KI(...e) {
  return jP.useCallback(WP(...e), e);
}
VI(KI, "useComposedRefs");
var Yae = Object.defineProperty,
  $s = (e, t) => Yae(e, "name", { value: t, configurable: !0 });
function jI(e) {
  let t = Qi.forwardRef((a, r) => {
    let { children: n, ...i } = a,
      o = null,
      A = !1,
      s = [];
    (GI(n) && typeof k2 == "function" && (n = k2(n._payload)),
      Qi.Children.forEach(n, (v) => {
        if (JP(v)) {
          A = !0;
          let c = v,
            B = "child" in c.props ? c.props.child : c.props.children;
          (GI(B) && typeof k2 == "function" && (B = k2(B._payload)),
            (o = $ae(c, B)),
            s.push(o?.props?.children));
        } else s.push(v);
      }),
      o
        ? (o = Qi.cloneElement(o, void 0, s))
        : !A && Qi.Children.count(n) === 1 && Qi.isValidElement(n) && (o = n));
    let l = o ? ZP(o) : void 0,
      u = KI(r, l);
    if (!o) {
      if (n || n === 0) throw new Error(A ? are(e) : tre(e));
      return n;
    }
    let p = YP(i, o.props ?? {});
    return (o.type !== Qi.Fragment && (p.ref = r ? u : l), Qi.cloneElement(o, p));
  });
  return ((t.displayName = `${e}.Slot`), t);
}
$s(jI, "createSlot");
var Zae = jI("Slot"),
  XP = Symbol.for("radix.slottable");
function WI(e) {
  let t = $s((a) => ("child" in a ? a.children(a.child) : a.children), "Slottable");
  return ((t.displayName = `${e}.Slottable`), (t.__radixId = XP), t);
}
$s(WI, "createSlottable");
var Jae = WI("Slottable"),
  $ae = $s((e, t) => {
    if ("child" in e.props) {
      let a = e.props.child;
      return Qi.isValidElement(a) ? Qi.cloneElement(a, void 0, e.props.children(a.props.children)) : null;
    }
    return Qi.isValidElement(t) ? t : null;
  }, "getSlottableElementFromSlottable");
function YP(e, t) {
  let a = { ...t };
  for (let r in t) {
    let n = e[r],
      i = t[r];
    /^on[A-Z]/.test(r)
      ? n && i
        ? (a[r] = (...A) => {
            let s = i(...A);
            return (n(...A), s);
          })
        : n && (a[r] = n)
      : r === "style"
        ? (a[r] = { ...n, ...i })
        : r === "className" && (a[r] = [n, i].filter(Boolean).join(" "));
  }
  return { ...e, ...a };
}
$s(YP, "mergeProps");
function ZP(e) {
  let t = Object.getOwnPropertyDescriptor(e.props, "ref")?.get,
    a = t && "isReactWarning" in t && t.isReactWarning;
  return a
    ? e.ref
    : ((t = Object.getOwnPropertyDescriptor(e, "ref")?.get),
      (a = t && "isReactWarning" in t && t.isReactWarning),
      a ? e.props.ref : e.props.ref || e.ref);
}
$s(ZP, "getElementRef");
function JP(e) {
  return (
    Qi.isValidElement(e) && typeof e.type == "function" && "__radixId" in e.type && e.type.__radixId === XP
  );
}
$s(JP, "isSlottable");
var ere = Symbol.for("react.lazy");
function GI(e) {
  return (
    e != null &&
    typeof e == "object" &&
    "$$typeof" in e &&
    e.$$typeof === ere &&
    "_payload" in e &&
    $P(e._payload)
  );
}
$s(GI, "isLazyComponent");
function $P(e) {
  return typeof e == "object" && e !== null && "then" in e;
}
$s($P, "isPromiseLike");
var tre = $s(
    (e) => `${e} failed to slot onto its children. Expected a single React element child or \`Slottable\`.`,
    "createSlotError",
  ),
  are = $s(
    (e) =>
      `${e} failed to slot onto its \`Slottable\`. Expected \`Slottable\` to receive a single React element child.`,
    "createSlottableError",
  ),
  k2 = Qi[" use ".trim().toString()];
var Dd = {};
hu(Dd, {
  Content: () => dre,
  List: () => cre,
  Root: () => ure,
  Tabs: () => tM,
  TabsContent: () => nM,
  TabsList: () => aM,
  TabsTrigger: () => rM,
  Trigger: () => fre,
  createTabsScope: () => ire,
});
var ju = Me(Qt(), 1);
var Gu = Me(_a(), 1),
  rre = Object.defineProperty,
  rg = (e, t) => rre(e, "name", { value: t, configurable: !0 }),
  XI = "Tabs",
  [nre, ire] = Xn(XI, [UI]),
  eM = UI(),
  [ore, YI] = nre(XI),
  tM = ju.forwardRef(
    rg(function (t, a) {
      let {
          __scopeTabs: r,
          value: n,
          onValueChange: i,
          defaultValue: o,
          orientation: A = "horizontal",
          dir: s,
          activationMode: l = "automatic",
          ...u
        } = t,
        p = bd(s),
        [v, c] = is({ prop: n, onChange: i, defaultProp: o ?? "", caller: XI });
      return (0, Gu.jsx)(ore, {
        scope: r,
        baseId: SA(),
        value: v,
        onValueChange: c,
        orientation: A,
        dir: p,
        activationMode: l,
        children: (0, Gu.jsx)(ca.div, { dir: p, "data-orientation": A, ...u, ref: a }),
      });
    }, "Tabs"),
  ),
  Are = "TabsList",
  aM = ju.forwardRef(
    rg(function (t, a) {
      let { __scopeTabs: r, loop: n = !0, ...i } = t,
        o = YI(Are, r),
        A = eM(r);
      return (0, Gu.jsx)(EP, {
        asChild: !0,
        ...A,
        orientation: o.orientation,
        dir: o.dir,
        loop: n,
        children: (0, Gu.jsx)(ca.div, { role: "tablist", "aria-orientation": o.orientation, ...i, ref: a }),
      });
    }, "TabsList"),
  ),
  sre = "TabsTrigger",
  rM = ju.forwardRef(
    rg(function (t, a) {
      let { __scopeTabs: r, value: n, disabled: i = !1, ...o } = t,
        A = YI(sre, r),
        s = eM(r),
        l = ZI(A.baseId, n),
        u = JI(A.baseId, n),
        p = n === A.value;
      return (0, Gu.jsx)(FP, {
        asChild: !0,
        ...s,
        focusable: !i,
        active: p,
        children: (0, Gu.jsx)(ca.button, {
          type: "button",
          role: "tab",
          "aria-selected": p,
          "aria-controls": u,
          "data-state": p ? "active" : "inactive",
          "data-disabled": i ? "" : void 0,
          disabled: i,
          id: l,
          ...o,
          ref: a,
          onMouseDown: na(t.onMouseDown, (v) => {
            !i && v.button === 0 && v.ctrlKey === !1 ? A.onValueChange(n) : v.preventDefault();
          }),
          onKeyDown: na(t.onKeyDown, (v) => {
            i || v.target !== v.currentTarget || ([" ", "Enter"].includes(v.key) && A.onValueChange(n));
          }),
          onFocus: na(t.onFocus, () => {
            let v = A.activationMode !== "manual";
            !p && !i && v && A.onValueChange(n);
          }),
        }),
      });
    }, "TabsTrigger"),
  ),
  lre = "TabsContent",
  nM = ju.forwardRef(
    rg(function (t, a) {
      let { __scopeTabs: r, value: n, forceMount: i, children: o, ...A } = t,
        s = YI(lre, r),
        l = ZI(s.baseId, n),
        u = JI(s.baseId, n),
        p = n === s.value,
        v = ju.useRef(p);
      return (
        ju.useEffect(() => {
          let c = requestAnimationFrame(() => (v.current = !1));
          return () => cancelAnimationFrame(c);
        }, []),
        (0, Gu.jsx)(Tl, {
          present: i || p,
          children: ({ present: c }) =>
            (0, Gu.jsx)(ca.div, {
              "data-state": p ? "active" : "inactive",
              "data-orientation": s.orientation,
              role: "tabpanel",
              "aria-labelledby": l,
              hidden: !c,
              id: u,
              tabIndex: 0,
              ...A,
              ref: a,
              style: { ...t.style, animationDuration: v.current ? "0s" : void 0 },
              children: c && o,
            }),
        })
      );
    }, "TabsContent"),
  );
function ZI(e, t) {
  return `${e}-trigger-${t}`;
}
rg(ZI, "makeTriggerId");
function JI(e, t) {
  return `${e}-content-${t}`;
}
rg(JI, "makeContentId");
var ure = tM,
  cre = aM,
  fre = rM,
  dre = nM;
var hre = (e, t) => {
    let a = new Array(e.length + t.length);
    for (let r = 0; r < e.length; r++) a[r] = e[r];
    for (let r = 0; r < t.length; r++) a[e.length + r] = t[r];
    return a;
  },
  pre = (e, t) => ({ classGroupId: e, validator: t }),
  uM = (e = new Map(), t = null, a) => ({ nextPart: e, validators: t, classGroupId: a });
var iM = [],
  gre = "arbitrary..",
  mre = (e) => {
    let t = yre(e),
      { conflictingClassGroups: a, conflictingClassGroupModifiers: r } = e;
    return {
      getClassGroupId: (o) => {
        if (o.startsWith("[") && o.endsWith("]")) return vre(o);
        let A = o.split("-"),
          s = A[0] === "" && A.length > 1 ? 1 : 0;
        return cM(A, s, t);
      },
      getConflictingClassGroupIds: (o, A) => {
        if (A) {
          let s = r[o],
            l = a[o];
          return s ? (l ? hre(l, s) : s) : l || iM;
        }
        return a[o] || iM;
      },
    };
  },
  cM = (e, t, a) => {
    if (e.length - t === 0) return a.classGroupId;
    let n = e[t],
      i = a.nextPart.get(n);
    if (i) {
      let l = cM(e, t + 1, i);
      if (l) return l;
    }
    let o = a.validators;
    if (o === null) return;
    let A = t === 0 ? e.join("-") : e.slice(t).join("-"),
      s = o.length;
    for (let l = 0; l < s; l++) {
      let u = o[l];
      if (u.validator(A)) return u.classGroupId;
    }
  },
  vre = (e) =>
    e.slice(1, -1).indexOf(":") === -1
      ? void 0
      : (() => {
          let t = e.slice(1, -1),
            a = t.indexOf(":"),
            r = t.slice(0, a);
          return r ? gre + r : void 0;
        })(),
  yre = (e) => {
    let { theme: t, classGroups: a } = e;
    return wre(a, t);
  },
  wre = (e, t) => {
    let a = uM();
    for (let r in e) {
      let n = e[r];
      eE(n, a, r, t);
    }
    return a;
  },
  eE = (e, t, a, r) => {
    let n = e.length;
    for (let i = 0; i < n; i++) {
      let o = e[i];
      Bre(o, t, a, r);
    }
  },
  Bre = (e, t, a, r) => {
    if (typeof e == "string") {
      bre(e, t, a);
      return;
    }
    if (typeof e == "function") {
      Cre(e, t, a, r);
      return;
    }
    xre(e, t, a, r);
  },
  bre = (e, t, a) => {
    let r = e === "" ? t : fM(t, e);
    r.classGroupId = a;
  },
  Cre = (e, t, a, r) => {
    if (Sre(e)) {
      eE(e(r), t, a, r);
      return;
    }
    (t.validators === null && (t.validators = []), t.validators.push(pre(a, e)));
  },
  xre = (e, t, a, r) => {
    let n = Object.entries(e),
      i = n.length;
    for (let o = 0; o < i; o++) {
      let [A, s] = n[o];
      eE(s, fM(t, A), a, r);
    }
  },
  fM = (e, t) => {
    let a = e,
      r = t.split("-"),
      n = r.length;
    for (let i = 0; i < n; i++) {
      let o = r[i],
        A = a.nextPart.get(o);
      (A || ((A = uM()), a.nextPart.set(o, A)), (a = A));
    }
    return a;
  },
  Sre = (e) => "isThemeGetter" in e && e.isThemeGetter === !0,
  Lre = (e) => {
    if (e < 1) return { get: () => {}, set: () => {} };
    let t = 0,
      a = Object.create(null),
      r = Object.create(null),
      n = (i, o) => {
        ((a[i] = o), t++, t > e && ((t = 0), (r = a), (a = Object.create(null))));
      };
    return {
      get(i) {
        let o = a[i];
        if (o !== void 0) return o;
        if ((o = r[i]) !== void 0) return (n(i, o), o);
      },
      set(i, o) {
        i in a ? (a[i] = o) : n(i, o);
      },
    };
  };
var Ire = [],
  oM = (e, t, a, r, n) => ({
    modifiers: e,
    hasImportantModifier: t,
    baseClassName: a,
    maybePostfixModifierPosition: r,
    isExternal: n,
  }),
  Ere = (e) => {
    let { prefix: t, experimentalParseClassName: a } = e,
      r = (n) => {
        let i = [],
          o = 0,
          A = 0,
          s = 0,
          l,
          u = n.length;
        for (let C = 0; C < u; C++) {
          let x = n[C];
          if (o === 0 && A === 0) {
            if (x === ":") {
              (i.push(n.slice(s, C)), (s = C + 1));
              continue;
            }
            if (x === "/") {
              l = C;
              continue;
            }
          }
          x === "[" ? o++ : x === "]" ? o-- : x === "(" ? A++ : x === ")" && A--;
        }
        let p = i.length === 0 ? n : n.slice(s),
          v = p,
          c = !1;
        p.endsWith("!")
          ? ((v = p.slice(0, -1)), (c = !0))
          : p.startsWith("!") && ((v = p.slice(1)), (c = !0));
        let B = l && l > s ? l - s : void 0;
        return oM(i, c, v, B);
      };
    if (t) {
      let n = t + ":",
        i = r;
      r = (o) => (o.startsWith(n) ? i(o.slice(n.length)) : oM(Ire, !1, o, void 0, !0));
    }
    if (a) {
      let n = r;
      r = (i) => a({ className: i, parseClassName: n });
    }
    return r;
  },
  Fre = (e) => {
    let t = new Map();
    return (
      e.orderSensitiveModifiers.forEach((a, r) => {
        t.set(a, 1e6 + r);
      }),
      (a) => {
        let r = [],
          n = [];
        for (let i = 0; i < a.length; i++) {
          let o = a[i],
            A = o[0] === "[",
            s = t.has(o);
          A || s ? (n.length > 0 && (n.sort(), r.push(...n), (n = [])), r.push(o)) : n.push(o);
        }
        return (n.length > 0 && (n.sort(), r.push(...n)), r);
      }
    );
  },
  Ure = (e) => ({
    cache: Lre(e.cacheSize),
    parseClassName: Ere(e),
    sortModifiers: Fre(e),
    postfixLookupClassGroupIds: _re(e),
    ...mre(e),
  }),
  _re = (e) => {
    let t = Object.create(null),
      a = e.postfixLookupClassGroups;
    if (a) for (let r = 0; r < a.length; r++) t[a[r]] = !0;
    return t;
  },
  Tre = /\s+/,
  Rre = (e, t) => {
    let {
        parseClassName: a,
        getClassGroupId: r,
        getConflictingClassGroupIds: n,
        sortModifiers: i,
        postfixLookupClassGroupIds: o,
      } = t,
      A = [],
      s = e.trim().split(Tre),
      l = "";
    for (let u = s.length - 1; u >= 0; u -= 1) {
      let p = s[u],
        {
          isExternal: v,
          modifiers: c,
          hasImportantModifier: B,
          baseClassName: C,
          maybePostfixModifierPosition: x,
        } = a(p);
      if (v) {
        l = p + (l.length > 0 ? " " + l : l);
        continue;
      }
      let w = !!x,
        S;
      if (w) {
        let z = C.substring(0, x);
        S = r(z);
        let k = S && o[S] ? r(C) : void 0;
        k && k !== S && ((S = k), (w = !1));
      } else S = r(C);
      if (!S) {
        if (!w) {
          l = p + (l.length > 0 ? " " + l : l);
          continue;
        }
        if (((S = r(C)), !S)) {
          l = p + (l.length > 0 ? " " + l : l);
          continue;
        }
        w = !1;
      }
      let L = c.length === 0 ? "" : c.length === 1 ? c[0] : i(c).join(":"),
        F = B ? L + "!" : L,
        q = F + S;
      if (A.indexOf(q) > -1) continue;
      A.push(q);
      let j = n(S, w);
      for (let z = 0; z < j.length; ++z) {
        let k = j[z];
        A.push(F + k);
      }
      l = p + (l.length > 0 ? " " + l : l);
    }
    return l;
  },
  Qre = (...e) => {
    let t = 0,
      a,
      r,
      n = "";
    for (; t < e.length; ) (a = e[t++]) && (r = dM(a)) && (n && (n += " "), (n += r));
    return n;
  },
  dM = (e) => {
    if (typeof e == "string") return e;
    let t,
      a = "";
    for (let r = 0; r < e.length; r++) e[r] && (t = dM(e[r])) && (a && (a += " "), (a += t));
    return a;
  },
  Ore = (e, ...t) => {
    let a,
      r,
      n,
      i,
      o = (s) => {
        let l = t.reduce((u, p) => p(u), e());
        return ((a = Ure(l)), (r = a.cache.get), (n = a.cache.set), (i = A), A(s));
      },
      A = (s) => {
        let l = r(s);
        if (l) return l;
        let u = Rre(s, a);
        return (n(s, u), u);
      };
    return ((i = o), (...s) => i(Qre(...s)));
  },
  Dre = [],
  Yn = (e) => {
    let t = (a) => a[e] || Dre;
    return ((t.isThemeGetter = !0), t);
  },
  hM = /^\[(?:(\w[\w-]*):)?(.+)\]$/i,
  pM = /^\((?:(\w[\w-]*):)?(.+)\)$/i,
  Nre = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/,
  kre = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/,
  Pre =
    /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/,
  Mre = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/,
  Hre = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/,
  qre = /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/,
  hf = (e) => Nre.test(e),
  ba = (e) => !!e && !Number.isNaN(Number(e)),
  Nl = (e) => !!e && Number.isInteger(Number(e)),
  $I = (e) => e.endsWith("%") && ba(e.slice(0, -1)),
  Wu = (e) => kre.test(e),
  gM = () => !0,
  zre = (e) => Pre.test(e) && !Mre.test(e),
  tE = () => !1,
  Vre = (e) => Hre.test(e),
  Kre = (e) => qre.test(e),
  Gre = (e) => !bt(e) && !St(e),
  jre = (e) =>
    e.startsWith("@container") &&
    ((e[10] === "/" && e[11] !== void 0) ||
      (e[11] === "s" && e[16] !== void 0 && e.startsWith("-size/", 10)) ||
      (e[11] === "n" && e[18] !== void 0 && e.startsWith("-normal/", 10))),
  Wre = (e) => pf(e, yM, tE),
  bt = (e) => hM.test(e),
  Nd = (e) => pf(e, wM, zre),
  AM = (e) => pf(e, ane, ba),
  Xre = (e) => pf(e, bM, gM),
  Yre = (e) => pf(e, BM, tE),
  sM = (e) => pf(e, mM, tE),
  Zre = (e) => pf(e, vM, Kre),
  M2 = (e) => pf(e, CM, Vre),
  St = (e) => pM.test(e),
  G0 = (e) => kd(e, wM),
  Jre = (e) => kd(e, BM),
  lM = (e) => kd(e, mM),
  $re = (e) => kd(e, yM),
  ene = (e) => kd(e, vM),
  H2 = (e) => kd(e, CM, !0),
  tne = (e) => kd(e, bM, !0),
  pf = (e, t, a) => {
    let r = hM.exec(e);
    return r ? (r[1] ? t(r[1]) : a(r[2])) : !1;
  },
  kd = (e, t, a = !1) => {
    let r = pM.exec(e);
    return r ? (r[1] ? t(r[1]) : a) : !1;
  },
  mM = (e) => e === "position" || e === "percentage",
  vM = (e) => e === "image" || e === "url",
  yM = (e) => e === "length" || e === "size" || e === "bg-size",
  wM = (e) => e === "length",
  ane = (e) => e === "number",
  BM = (e) => e === "family-name",
  bM = (e) => e === "number" || e === "weight",
  CM = (e) => e === "shadow";
var rne = () => {
  let e = Yn("color"),
    t = Yn("font"),
    a = Yn("text"),
    r = Yn("font-weight"),
    n = Yn("tracking"),
    i = Yn("leading"),
    o = Yn("breakpoint"),
    A = Yn("container"),
    s = Yn("spacing"),
    l = Yn("radius"),
    u = Yn("shadow"),
    p = Yn("inset-shadow"),
    v = Yn("text-shadow"),
    c = Yn("drop-shadow"),
    B = Yn("blur"),
    C = Yn("perspective"),
    x = Yn("aspect"),
    w = Yn("ease"),
    S = Yn("animate"),
    L = () => ["auto", "avoid", "all", "avoid-page", "page", "left", "right", "column"],
    F = () => [
      "center",
      "top",
      "bottom",
      "left",
      "right",
      "top-left",
      "left-top",
      "top-right",
      "right-top",
      "bottom-right",
      "right-bottom",
      "bottom-left",
      "left-bottom",
    ],
    q = () => [...F(), St, bt],
    j = () => ["auto", "hidden", "clip", "visible", "scroll"],
    z = () => ["auto", "contain", "none"],
    k = () => [St, bt, s],
    O = () => [hf, "full", "auto", ...k()],
    ne = () => [Nl, "none", "subgrid", St, bt],
    D = () => ["auto", { span: ["full", Nl, St, bt] }, Nl, St, bt],
    H = () => [Nl, "auto", St, bt],
    te = () => ["auto", "min", "max", "fr", St, bt],
    ee = () => [
      "start",
      "end",
      "center",
      "between",
      "around",
      "evenly",
      "stretch",
      "baseline",
      "center-safe",
      "end-safe",
    ],
    ce = () => ["start", "end", "center", "stretch", "center-safe", "end-safe"],
    de = () => ["auto", ...k()],
    fe = () => [hf, "auto", "full", "dvw", "dvh", "lvw", "lvh", "svw", "svh", "min", "max", "fit", ...k()],
    se = () => [hf, "screen", "full", "dvw", "lvw", "svw", "min", "max", "fit", ...k()],
    ge = () => [hf, "screen", "full", "lh", "dvh", "lvh", "svh", "min", "max", "fit", ...k()],
    me = () => [e, St, bt],
    _e = () => [...F(), lM, sM, { position: [St, bt] }],
    N = () => ["no-repeat", { repeat: ["", "x", "y", "space", "round"] }],
    Y = () => ["auto", "cover", "contain", $re, Wre, { size: [St, bt] }],
    ae = () => [$I, G0, Nd],
    Ae = () => ["", "none", "full", l, St, bt],
    ue = () => ["", ba, G0, Nd],
    ve = () => ["solid", "dashed", "dotted", "double"],
    we = () => [
      "normal",
      "multiply",
      "screen",
      "overlay",
      "darken",
      "lighten",
      "color-dodge",
      "color-burn",
      "hard-light",
      "soft-light",
      "difference",
      "exclusion",
      "hue",
      "saturation",
      "color",
      "luminosity",
    ],
    be = () => [ba, $I, lM, sM],
    Ue = () => ["", "none", B, St, bt],
    Re = () => ["none", ba, St, bt],
    Ve = () => ["none", ba, St, bt],
    Ke = () => [ba, St, bt],
    je = () => [hf, "full", ...k()];
  return {
    cacheSize: 500,
    theme: {
      animate: ["spin", "ping", "pulse", "bounce"],
      aspect: ["video"],
      blur: [Wu],
      breakpoint: [Wu],
      color: [gM],
      container: [Wu],
      "drop-shadow": [Wu],
      ease: ["in", "out", "in-out"],
      font: [Gre],
      "font-weight": [
        "thin",
        "extralight",
        "light",
        "normal",
        "medium",
        "semibold",
        "bold",
        "extrabold",
        "black",
      ],
      "inset-shadow": [Wu],
      leading: ["none", "tight", "snug", "normal", "relaxed", "loose"],
      perspective: ["dramatic", "near", "normal", "midrange", "distant", "none"],
      radius: [Wu],
      shadow: [Wu],
      spacing: ["px", ba],
      text: [Wu],
      "text-shadow": [Wu],
      tracking: ["tighter", "tight", "normal", "wide", "wider", "widest"],
    },
    classGroups: {
      aspect: [{ aspect: ["auto", "square", hf, bt, St, x] }],
      container: ["container"],
      "container-type": [{ "@container": ["", "normal", "size", St, bt] }],
      "container-named": [jre],
      columns: [{ columns: [ba, bt, St, A] }],
      "break-after": [{ "break-after": L() }],
      "break-before": [{ "break-before": L() }],
      "break-inside": [{ "break-inside": ["auto", "avoid", "avoid-page", "avoid-column"] }],
      "box-decoration": [{ "box-decoration": ["slice", "clone"] }],
      box: [{ box: ["border", "content"] }],
      display: [
        "block",
        "inline-block",
        "inline",
        "flex",
        "inline-flex",
        "table",
        "inline-table",
        "table-caption",
        "table-cell",
        "table-column",
        "table-column-group",
        "table-footer-group",
        "table-header-group",
        "table-row-group",
        "table-row",
        "flow-root",
        "grid",
        "inline-grid",
        "contents",
        "list-item",
        "hidden",
      ],
      sr: ["sr-only", "not-sr-only"],
      float: [{ float: ["right", "left", "none", "start", "end"] }],
      clear: [{ clear: ["left", "right", "both", "none", "start", "end"] }],
      isolation: ["isolate", "isolation-auto"],
      "object-fit": [{ object: ["contain", "cover", "fill", "none", "scale-down"] }],
      "object-position": [{ object: q() }],
      overflow: [{ overflow: j() }],
      "overflow-x": [{ "overflow-x": j() }],
      "overflow-y": [{ "overflow-y": j() }],
      overscroll: [{ overscroll: z() }],
      "overscroll-x": [{ "overscroll-x": z() }],
      "overscroll-y": [{ "overscroll-y": z() }],
      position: ["static", "fixed", "absolute", "relative", "sticky"],
      inset: [{ inset: O() }],
      "inset-x": [{ "inset-x": O() }],
      "inset-y": [{ "inset-y": O() }],
      start: [{ "inset-s": O(), start: O() }],
      end: [{ "inset-e": O(), end: O() }],
      "inset-bs": [{ "inset-bs": O() }],
      "inset-be": [{ "inset-be": O() }],
      top: [{ top: O() }],
      right: [{ right: O() }],
      bottom: [{ bottom: O() }],
      left: [{ left: O() }],
      visibility: ["visible", "invisible", "collapse"],
      z: [{ z: [Nl, "auto", St, bt] }],
      basis: [{ basis: [hf, "full", "auto", A, ...k()] }],
      "flex-direction": [{ flex: ["row", "row-reverse", "col", "col-reverse"] }],
      "flex-wrap": [{ flex: ["nowrap", "wrap", "wrap-reverse"] }],
      flex: [{ flex: [ba, hf, "auto", "initial", "none", bt] }],
      grow: [{ grow: ["", ba, St, bt] }],
      shrink: [{ shrink: ["", ba, St, bt] }],
      order: [{ order: [Nl, "first", "last", "none", St, bt] }],
      "grid-cols": [{ "grid-cols": ne() }],
      "col-start-end": [{ col: D() }],
      "col-start": [{ "col-start": H() }],
      "col-end": [{ "col-end": H() }],
      "grid-rows": [{ "grid-rows": ne() }],
      "row-start-end": [{ row: D() }],
      "row-start": [{ "row-start": H() }],
      "row-end": [{ "row-end": H() }],
      "grid-flow": [{ "grid-flow": ["row", "col", "dense", "row-dense", "col-dense"] }],
      "auto-cols": [{ "auto-cols": te() }],
      "auto-rows": [{ "auto-rows": te() }],
      gap: [{ gap: k() }],
      "gap-x": [{ "gap-x": k() }],
      "gap-y": [{ "gap-y": k() }],
      "justify-content": [{ justify: [...ee(), "normal"] }],
      "justify-items": [{ "justify-items": [...ce(), "normal"] }],
      "justify-self": [{ "justify-self": ["auto", ...ce()] }],
      "align-content": [{ content: ["normal", ...ee()] }],
      "align-items": [{ items: [...ce(), { baseline: ["", "last"] }] }],
      "align-self": [{ self: ["auto", ...ce(), { baseline: ["", "last"] }] }],
      "place-content": [{ "place-content": ee() }],
      "place-items": [{ "place-items": [...ce(), "baseline"] }],
      "place-self": [{ "place-self": ["auto", ...ce()] }],
      p: [{ p: k() }],
      px: [{ px: k() }],
      py: [{ py: k() }],
      ps: [{ ps: k() }],
      pe: [{ pe: k() }],
      pbs: [{ pbs: k() }],
      pbe: [{ pbe: k() }],
      pt: [{ pt: k() }],
      pr: [{ pr: k() }],
      pb: [{ pb: k() }],
      pl: [{ pl: k() }],
      m: [{ m: de() }],
      mx: [{ mx: de() }],
      my: [{ my: de() }],
      ms: [{ ms: de() }],
      me: [{ me: de() }],
      mbs: [{ mbs: de() }],
      mbe: [{ mbe: de() }],
      mt: [{ mt: de() }],
      mr: [{ mr: de() }],
      mb: [{ mb: de() }],
      ml: [{ ml: de() }],
      "space-x": [{ "space-x": k() }],
      "space-x-reverse": ["space-x-reverse"],
      "space-y": [{ "space-y": k() }],
      "space-y-reverse": ["space-y-reverse"],
      size: [{ size: fe() }],
      "inline-size": [{ inline: ["auto", ...se()] }],
      "min-inline-size": [{ "min-inline": ["auto", ...se()] }],
      "max-inline-size": [{ "max-inline": ["none", ...se()] }],
      "block-size": [{ block: ["auto", ...ge()] }],
      "min-block-size": [{ "min-block": ["auto", ...ge()] }],
      "max-block-size": [{ "max-block": ["none", ...ge()] }],
      w: [{ w: [A, "screen", ...fe()] }],
      "min-w": [{ "min-w": [A, "screen", "none", ...fe()] }],
      "max-w": [{ "max-w": [A, "screen", "none", "prose", { screen: [o] }, ...fe()] }],
      h: [{ h: ["screen", "lh", ...fe()] }],
      "min-h": [{ "min-h": ["screen", "lh", "none", ...fe()] }],
      "max-h": [{ "max-h": ["screen", "lh", ...fe()] }],
      "font-size": [{ text: ["base", a, G0, Nd] }],
      "font-smoothing": ["antialiased", "subpixel-antialiased"],
      "font-style": ["italic", "not-italic"],
      "font-weight": [{ font: [r, tne, Xre] }],
      "font-stretch": [
        {
          "font-stretch": [
            "ultra-condensed",
            "extra-condensed",
            "condensed",
            "semi-condensed",
            "normal",
            "semi-expanded",
            "expanded",
            "extra-expanded",
            "ultra-expanded",
            $I,
            bt,
          ],
        },
      ],
      "font-family": [{ font: [Jre, Yre, t] }],
      "font-features": [{ "font-features": [bt] }],
      "fvn-normal": ["normal-nums"],
      "fvn-ordinal": ["ordinal"],
      "fvn-slashed-zero": ["slashed-zero"],
      "fvn-figure": ["lining-nums", "oldstyle-nums"],
      "fvn-spacing": ["proportional-nums", "tabular-nums"],
      "fvn-fraction": ["diagonal-fractions", "stacked-fractions"],
      tracking: [{ tracking: [n, St, bt] }],
      "line-clamp": [{ "line-clamp": [ba, "none", St, AM] }],
      leading: [{ leading: [i, ...k()] }],
      "list-image": [{ "list-image": ["none", St, bt] }],
      "list-style-position": [{ list: ["inside", "outside"] }],
      "list-style-type": [{ list: ["disc", "decimal", "none", St, bt] }],
      "text-alignment": [{ text: ["left", "center", "right", "justify", "start", "end"] }],
      "placeholder-color": [{ placeholder: me() }],
      "text-color": [{ text: me() }],
      "text-decoration": ["underline", "overline", "line-through", "no-underline"],
      "text-decoration-style": [{ decoration: [...ve(), "wavy"] }],
      "text-decoration-thickness": [{ decoration: [ba, "from-font", "auto", St, Nd] }],
      "text-decoration-color": [{ decoration: me() }],
      "underline-offset": [{ "underline-offset": [ba, "auto", St, bt] }],
      "text-transform": ["uppercase", "lowercase", "capitalize", "normal-case"],
      "text-overflow": ["truncate", "text-ellipsis", "text-clip"],
      "text-wrap": [{ text: ["wrap", "nowrap", "balance", "pretty"] }],
      indent: [{ indent: k() }],
      "tab-size": [{ tab: [Nl, St, bt] }],
      "vertical-align": [
        { align: ["baseline", "top", "middle", "bottom", "text-top", "text-bottom", "sub", "super", St, bt] },
      ],
      whitespace: [{ whitespace: ["normal", "nowrap", "pre", "pre-line", "pre-wrap", "break-spaces"] }],
      break: [{ break: ["normal", "words", "all", "keep"] }],
      wrap: [{ wrap: ["break-word", "anywhere", "normal"] }],
      hyphens: [{ hyphens: ["none", "manual", "auto"] }],
      content: [{ content: ["none", St, bt] }],
      "bg-attachment": [{ bg: ["fixed", "local", "scroll"] }],
      "bg-clip": [{ "bg-clip": ["border", "padding", "content", "text"] }],
      "bg-origin": [{ "bg-origin": ["border", "padding", "content"] }],
      "bg-position": [{ bg: _e() }],
      "bg-repeat": [{ bg: N() }],
      "bg-size": [{ bg: Y() }],
      "bg-image": [
        {
          bg: [
            "none",
            {
              linear: [{ to: ["t", "tr", "r", "br", "b", "bl", "l", "tl"] }, Nl, St, bt],
              radial: ["", St, bt],
              conic: [Nl, St, bt],
            },
            ene,
            Zre,
          ],
        },
      ],
      "bg-color": [{ bg: me() }],
      "gradient-from-pos": [{ from: ae() }],
      "gradient-via-pos": [{ via: ae() }],
      "gradient-to-pos": [{ to: ae() }],
      "gradient-from": [{ from: me() }],
      "gradient-via": [{ via: me() }],
      "gradient-to": [{ to: me() }],
      rounded: [{ rounded: Ae() }],
      "rounded-s": [{ "rounded-s": Ae() }],
      "rounded-e": [{ "rounded-e": Ae() }],
      "rounded-t": [{ "rounded-t": Ae() }],
      "rounded-r": [{ "rounded-r": Ae() }],
      "rounded-b": [{ "rounded-b": Ae() }],
      "rounded-l": [{ "rounded-l": Ae() }],
      "rounded-ss": [{ "rounded-ss": Ae() }],
      "rounded-se": [{ "rounded-se": Ae() }],
      "rounded-ee": [{ "rounded-ee": Ae() }],
      "rounded-es": [{ "rounded-es": Ae() }],
      "rounded-tl": [{ "rounded-tl": Ae() }],
      "rounded-tr": [{ "rounded-tr": Ae() }],
      "rounded-br": [{ "rounded-br": Ae() }],
      "rounded-bl": [{ "rounded-bl": Ae() }],
      "border-w": [{ border: ue() }],
      "border-w-x": [{ "border-x": ue() }],
      "border-w-y": [{ "border-y": ue() }],
      "border-w-s": [{ "border-s": ue() }],
      "border-w-e": [{ "border-e": ue() }],
      "border-w-bs": [{ "border-bs": ue() }],
      "border-w-be": [{ "border-be": ue() }],
      "border-w-t": [{ "border-t": ue() }],
      "border-w-r": [{ "border-r": ue() }],
      "border-w-b": [{ "border-b": ue() }],
      "border-w-l": [{ "border-l": ue() }],
      "divide-x": [{ "divide-x": ue() }],
      "divide-x-reverse": ["divide-x-reverse"],
      "divide-y": [{ "divide-y": ue() }],
      "divide-y-reverse": ["divide-y-reverse"],
      "border-style": [{ border: [...ve(), "hidden", "none"] }],
      "divide-style": [{ divide: [...ve(), "hidden", "none"] }],
      "border-color": [{ border: me() }],
      "border-color-x": [{ "border-x": me() }],
      "border-color-y": [{ "border-y": me() }],
      "border-color-s": [{ "border-s": me() }],
      "border-color-e": [{ "border-e": me() }],
      "border-color-bs": [{ "border-bs": me() }],
      "border-color-be": [{ "border-be": me() }],
      "border-color-t": [{ "border-t": me() }],
      "border-color-r": [{ "border-r": me() }],
      "border-color-b": [{ "border-b": me() }],
      "border-color-l": [{ "border-l": me() }],
      "divide-color": [{ divide: me() }],
      "outline-style": [{ outline: [...ve(), "none", "hidden"] }],
      "outline-offset": [{ "outline-offset": [ba, St, bt] }],
      "outline-w": [{ outline: ["", ba, G0, Nd] }],
      "outline-color": [{ outline: me() }],
      shadow: [{ shadow: ["", "none", u, H2, M2] }],
      "shadow-color": [{ shadow: me() }],
      "inset-shadow": [{ "inset-shadow": ["none", p, H2, M2] }],
      "inset-shadow-color": [{ "inset-shadow": me() }],
      "ring-w": [{ ring: ue() }],
      "ring-w-inset": ["ring-inset"],
      "ring-color": [{ ring: me() }],
      "ring-offset-w": [{ "ring-offset": [ba, Nd] }],
      "ring-offset-color": [{ "ring-offset": me() }],
      "inset-ring-w": [{ "inset-ring": ue() }],
      "inset-ring-color": [{ "inset-ring": me() }],
      "text-shadow": [{ "text-shadow": ["none", v, H2, M2] }],
      "text-shadow-color": [{ "text-shadow": me() }],
      opacity: [{ opacity: [ba, St, bt] }],
      "mix-blend": [{ "mix-blend": [...we(), "plus-darker", "plus-lighter"] }],
      "bg-blend": [{ "bg-blend": we() }],
      "mask-clip": [
        { "mask-clip": ["border", "padding", "content", "fill", "stroke", "view"] },
        "mask-no-clip",
      ],
      "mask-composite": [{ mask: ["add", "subtract", "intersect", "exclude"] }],
      "mask-image-linear-pos": [{ "mask-linear": [ba] }],
      "mask-image-linear-from-pos": [{ "mask-linear-from": be() }],
      "mask-image-linear-to-pos": [{ "mask-linear-to": be() }],
      "mask-image-linear-from-color": [{ "mask-linear-from": me() }],
      "mask-image-linear-to-color": [{ "mask-linear-to": me() }],
      "mask-image-t-from-pos": [{ "mask-t-from": be() }],
      "mask-image-t-to-pos": [{ "mask-t-to": be() }],
      "mask-image-t-from-color": [{ "mask-t-from": me() }],
      "mask-image-t-to-color": [{ "mask-t-to": me() }],
      "mask-image-r-from-pos": [{ "mask-r-from": be() }],
      "mask-image-r-to-pos": [{ "mask-r-to": be() }],
      "mask-image-r-from-color": [{ "mask-r-from": me() }],
      "mask-image-r-to-color": [{ "mask-r-to": me() }],
      "mask-image-b-from-pos": [{ "mask-b-from": be() }],
      "mask-image-b-to-pos": [{ "mask-b-to": be() }],
      "mask-image-b-from-color": [{ "mask-b-from": me() }],
      "mask-image-b-to-color": [{ "mask-b-to": me() }],
      "mask-image-l-from-pos": [{ "mask-l-from": be() }],
      "mask-image-l-to-pos": [{ "mask-l-to": be() }],
      "mask-image-l-from-color": [{ "mask-l-from": me() }],
      "mask-image-l-to-color": [{ "mask-l-to": me() }],
      "mask-image-x-from-pos": [{ "mask-x-from": be() }],
      "mask-image-x-to-pos": [{ "mask-x-to": be() }],
      "mask-image-x-from-color": [{ "mask-x-from": me() }],
      "mask-image-x-to-color": [{ "mask-x-to": me() }],
      "mask-image-y-from-pos": [{ "mask-y-from": be() }],
      "mask-image-y-to-pos": [{ "mask-y-to": be() }],
      "mask-image-y-from-color": [{ "mask-y-from": me() }],
      "mask-image-y-to-color": [{ "mask-y-to": me() }],
      "mask-image-radial": [{ "mask-radial": [St, bt] }],
      "mask-image-radial-from-pos": [{ "mask-radial-from": be() }],
      "mask-image-radial-to-pos": [{ "mask-radial-to": be() }],
      "mask-image-radial-from-color": [{ "mask-radial-from": me() }],
      "mask-image-radial-to-color": [{ "mask-radial-to": me() }],
      "mask-image-radial-shape": [{ "mask-radial": ["circle", "ellipse"] }],
      "mask-image-radial-size": [
        { "mask-radial": [{ closest: ["side", "corner"], farthest: ["side", "corner"] }] },
      ],
      "mask-image-radial-pos": [{ "mask-radial-at": F() }],
      "mask-image-conic-pos": [{ "mask-conic": [ba] }],
      "mask-image-conic-from-pos": [{ "mask-conic-from": be() }],
      "mask-image-conic-to-pos": [{ "mask-conic-to": be() }],
      "mask-image-conic-from-color": [{ "mask-conic-from": me() }],
      "mask-image-conic-to-color": [{ "mask-conic-to": me() }],
      "mask-mode": [{ mask: ["alpha", "luminance", "match"] }],
      "mask-origin": [{ "mask-origin": ["border", "padding", "content", "fill", "stroke", "view"] }],
      "mask-position": [{ mask: _e() }],
      "mask-repeat": [{ mask: N() }],
      "mask-size": [{ mask: Y() }],
      "mask-type": [{ "mask-type": ["alpha", "luminance"] }],
      "mask-image": [{ mask: ["none", St, bt] }],
      filter: [{ filter: ["", "none", St, bt] }],
      blur: [{ blur: Ue() }],
      brightness: [{ brightness: [ba, St, bt] }],
      contrast: [{ contrast: [ba, St, bt] }],
      "drop-shadow": [{ "drop-shadow": ["", "none", c, H2, M2] }],
      "drop-shadow-color": [{ "drop-shadow": me() }],
      grayscale: [{ grayscale: ["", ba, St, bt] }],
      "hue-rotate": [{ "hue-rotate": [ba, St, bt] }],
      invert: [{ invert: ["", ba, St, bt] }],
      saturate: [{ saturate: [ba, St, bt] }],
      sepia: [{ sepia: ["", ba, St, bt] }],
      "backdrop-filter": [{ "backdrop-filter": ["", "none", St, bt] }],
      "backdrop-blur": [{ "backdrop-blur": Ue() }],
      "backdrop-brightness": [{ "backdrop-brightness": [ba, St, bt] }],
      "backdrop-contrast": [{ "backdrop-contrast": [ba, St, bt] }],
      "backdrop-grayscale": [{ "backdrop-grayscale": ["", ba, St, bt] }],
      "backdrop-hue-rotate": [{ "backdrop-hue-rotate": [ba, St, bt] }],
      "backdrop-invert": [{ "backdrop-invert": ["", ba, St, bt] }],
      "backdrop-opacity": [{ "backdrop-opacity": [ba, St, bt] }],
      "backdrop-saturate": [{ "backdrop-saturate": [ba, St, bt] }],
      "backdrop-sepia": [{ "backdrop-sepia": ["", ba, St, bt] }],
      "border-collapse": [{ border: ["collapse", "separate"] }],
      "border-spacing": [{ "border-spacing": k() }],
      "border-spacing-x": [{ "border-spacing-x": k() }],
      "border-spacing-y": [{ "border-spacing-y": k() }],
      "table-layout": [{ table: ["auto", "fixed"] }],
      caption: [{ caption: ["top", "bottom"] }],
      transition: [{ transition: ["", "all", "colors", "opacity", "shadow", "transform", "none", St, bt] }],
      "transition-behavior": [{ transition: ["normal", "discrete"] }],
      duration: [{ duration: [ba, "initial", St, bt] }],
      ease: [{ ease: ["linear", "initial", w, St, bt] }],
      delay: [{ delay: [ba, St, bt] }],
      animate: [{ animate: ["none", S, St, bt] }],
      backface: [{ backface: ["hidden", "visible"] }],
      perspective: [{ perspective: [C, St, bt] }],
      "perspective-origin": [{ "perspective-origin": q() }],
      rotate: [{ rotate: Re() }],
      "rotate-x": [{ "rotate-x": Re() }],
      "rotate-y": [{ "rotate-y": Re() }],
      "rotate-z": [{ "rotate-z": Re() }],
      scale: [{ scale: Ve() }],
      "scale-x": [{ "scale-x": Ve() }],
      "scale-y": [{ "scale-y": Ve() }],
      "scale-z": [{ "scale-z": Ve() }],
      "scale-3d": ["scale-3d"],
      skew: [{ skew: Ke() }],
      "skew-x": [{ "skew-x": Ke() }],
      "skew-y": [{ "skew-y": Ke() }],
      transform: [{ transform: [St, bt, "", "none", "gpu", "cpu"] }],
      "transform-origin": [{ origin: q() }],
      "transform-style": [{ transform: ["3d", "flat"] }],
      translate: [{ translate: je() }],
      "translate-x": [{ "translate-x": je() }],
      "translate-y": [{ "translate-y": je() }],
      "translate-z": [{ "translate-z": je() }],
      "translate-none": ["translate-none"],
      zoom: [{ zoom: [Nl, St, bt] }],
      accent: [{ accent: me() }],
      appearance: [{ appearance: ["none", "auto"] }],
      "caret-color": [{ caret: me() }],
      "color-scheme": [{ scheme: ["normal", "dark", "light", "light-dark", "only-dark", "only-light"] }],
      cursor: [
        {
          cursor: [
            "auto",
            "default",
            "pointer",
            "wait",
            "text",
            "move",
            "help",
            "not-allowed",
            "none",
            "context-menu",
            "progress",
            "cell",
            "crosshair",
            "vertical-text",
            "alias",
            "copy",
            "no-drop",
            "grab",
            "grabbing",
            "all-scroll",
            "col-resize",
            "row-resize",
            "n-resize",
            "e-resize",
            "s-resize",
            "w-resize",
            "ne-resize",
            "nw-resize",
            "se-resize",
            "sw-resize",
            "ew-resize",
            "ns-resize",
            "nesw-resize",
            "nwse-resize",
            "zoom-in",
            "zoom-out",
            St,
            bt,
          ],
        },
      ],
      "field-sizing": [{ "field-sizing": ["fixed", "content"] }],
      "pointer-events": [{ "pointer-events": ["auto", "none"] }],
      resize: [{ resize: ["none", "", "y", "x"] }],
      "scroll-behavior": [{ scroll: ["auto", "smooth"] }],
      "scrollbar-thumb-color": [{ "scrollbar-thumb": me() }],
      "scrollbar-track-color": [{ "scrollbar-track": me() }],
      "scrollbar-gutter": [{ "scrollbar-gutter": ["auto", "stable", "both"] }],
      "scrollbar-w": [{ scrollbar: ["auto", "thin", "none"] }],
      "scroll-m": [{ "scroll-m": k() }],
      "scroll-mx": [{ "scroll-mx": k() }],
      "scroll-my": [{ "scroll-my": k() }],
      "scroll-ms": [{ "scroll-ms": k() }],
      "scroll-me": [{ "scroll-me": k() }],
      "scroll-mbs": [{ "scroll-mbs": k() }],
      "scroll-mbe": [{ "scroll-mbe": k() }],
      "scroll-mt": [{ "scroll-mt": k() }],
      "scroll-mr": [{ "scroll-mr": k() }],
      "scroll-mb": [{ "scroll-mb": k() }],
      "scroll-ml": [{ "scroll-ml": k() }],
      "scroll-p": [{ "scroll-p": k() }],
      "scroll-px": [{ "scroll-px": k() }],
      "scroll-py": [{ "scroll-py": k() }],
      "scroll-ps": [{ "scroll-ps": k() }],
      "scroll-pe": [{ "scroll-pe": k() }],
      "scroll-pbs": [{ "scroll-pbs": k() }],
      "scroll-pbe": [{ "scroll-pbe": k() }],
      "scroll-pt": [{ "scroll-pt": k() }],
      "scroll-pr": [{ "scroll-pr": k() }],
      "scroll-pb": [{ "scroll-pb": k() }],
      "scroll-pl": [{ "scroll-pl": k() }],
      "snap-align": [{ snap: ["start", "end", "center", "align-none"] }],
      "snap-stop": [{ snap: ["normal", "always"] }],
      "snap-type": [{ snap: ["none", "x", "y", "both"] }],
      "snap-strictness": [{ snap: ["mandatory", "proximity"] }],
      touch: [{ touch: ["auto", "none", "manipulation"] }],
      "touch-x": [{ "touch-pan": ["x", "left", "right"] }],
      "touch-y": [{ "touch-pan": ["y", "up", "down"] }],
      "touch-pz": ["touch-pinch-zoom"],
      select: [{ select: ["none", "text", "all", "auto"] }],
      "will-change": [{ "will-change": ["auto", "scroll", "contents", "transform", St, bt] }],
      fill: [{ fill: ["none", ...me()] }],
      "stroke-w": [{ stroke: [ba, G0, Nd, AM] }],
      stroke: [{ stroke: ["none", ...me()] }],
      "forced-color-adjust": [{ "forced-color-adjust": ["auto", "none"] }],
    },
    conflictingClassGroups: {
      "container-named": ["container-type"],
      overflow: ["overflow-x", "overflow-y"],
      overscroll: ["overscroll-x", "overscroll-y"],
      inset: ["inset-x", "inset-y", "inset-bs", "inset-be", "start", "end", "top", "right", "bottom", "left"],
      "inset-x": ["right", "left"],
      "inset-y": ["top", "bottom"],
      flex: ["basis", "grow", "shrink"],
      gap: ["gap-x", "gap-y"],
      p: ["px", "py", "ps", "pe", "pbs", "pbe", "pt", "pr", "pb", "pl"],
      px: ["pr", "pl"],
      py: ["pt", "pb"],
      m: ["mx", "my", "ms", "me", "mbs", "mbe", "mt", "mr", "mb", "ml"],
      mx: ["mr", "ml"],
      my: ["mt", "mb"],
      size: ["w", "h"],
      "font-size": ["leading"],
      "fvn-normal": ["fvn-ordinal", "fvn-slashed-zero", "fvn-figure", "fvn-spacing", "fvn-fraction"],
      "fvn-ordinal": ["fvn-normal"],
      "fvn-slashed-zero": ["fvn-normal"],
      "fvn-figure": ["fvn-normal"],
      "fvn-spacing": ["fvn-normal"],
      "fvn-fraction": ["fvn-normal"],
      "line-clamp": ["display", "overflow"],
      rounded: [
        "rounded-s",
        "rounded-e",
        "rounded-t",
        "rounded-r",
        "rounded-b",
        "rounded-l",
        "rounded-ss",
        "rounded-se",
        "rounded-ee",
        "rounded-es",
        "rounded-tl",
        "rounded-tr",
        "rounded-br",
        "rounded-bl",
      ],
      "rounded-s": ["rounded-ss", "rounded-es"],
      "rounded-e": ["rounded-se", "rounded-ee"],
      "rounded-t": ["rounded-tl", "rounded-tr"],
      "rounded-r": ["rounded-tr", "rounded-br"],
      "rounded-b": ["rounded-br", "rounded-bl"],
      "rounded-l": ["rounded-tl", "rounded-bl"],
      "border-spacing": ["border-spacing-x", "border-spacing-y"],
      "border-w": [
        "border-w-x",
        "border-w-y",
        "border-w-s",
        "border-w-e",
        "border-w-bs",
        "border-w-be",
        "border-w-t",
        "border-w-r",
        "border-w-b",
        "border-w-l",
      ],
      "border-w-x": ["border-w-r", "border-w-l"],
      "border-w-y": ["border-w-t", "border-w-b"],
      "border-color": [
        "border-color-x",
        "border-color-y",
        "border-color-s",
        "border-color-e",
        "border-color-bs",
        "border-color-be",
        "border-color-t",
        "border-color-r",
        "border-color-b",
        "border-color-l",
      ],
      "border-color-x": ["border-color-r", "border-color-l"],
      "border-color-y": ["border-color-t", "border-color-b"],
      translate: ["translate-x", "translate-y", "translate-none"],
      "translate-none": ["translate", "translate-x", "translate-y", "translate-z"],
      "scroll-m": [
        "scroll-mx",
        "scroll-my",
        "scroll-ms",
        "scroll-me",
        "scroll-mbs",
        "scroll-mbe",
        "scroll-mt",
        "scroll-mr",
        "scroll-mb",
        "scroll-ml",
      ],
      "scroll-mx": ["scroll-mr", "scroll-ml"],
      "scroll-my": ["scroll-mt", "scroll-mb"],
      "scroll-p": [
        "scroll-px",
        "scroll-py",
        "scroll-ps",
        "scroll-pe",
        "scroll-pbs",
        "scroll-pbe",
        "scroll-pt",
        "scroll-pr",
        "scroll-pb",
        "scroll-pl",
      ],
      "scroll-px": ["scroll-pr", "scroll-pl"],
      "scroll-py": ["scroll-pt", "scroll-pb"],
      touch: ["touch-x", "touch-y", "touch-pz"],
      "touch-x": ["touch"],
      "touch-y": ["touch"],
      "touch-pz": ["touch"],
    },
    conflictingClassGroupModifiers: { "font-size": ["leading"] },
    postfixLookupClassGroups: ["container-type"],
    orderSensitiveModifiers: [
      "*",
      "**",
      "after",
      "backdrop",
      "before",
      "details-content",
      "file",
      "first-letter",
      "first-line",
      "marker",
      "placeholder",
      "selection",
    ],
  };
};
var xM = Ore(rne);
function Ta(...e) {
  return xM(Hw(e));
}
var W0 = Me(_a(), 1);
function aE({ className: e, orientation: t = "horizontal", ...a }) {
  return (0, W0.jsx)(Dd.Root, {
    "data-slot": "tabs",
    "data-orientation": t,
    orientation: t,
    className: Ta("group/tabs flex gap-2 data-[orientation=horizontal]:flex-col", e),
    ...a,
  });
}
var nne = qw(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: { variant: { default: "bg-muted", line: "gap-1 bg-transparent" } },
    defaultVariants: { variant: "default" },
  },
);
function rE({ className: e, variant: t = "default", ...a }) {
  return (0, W0.jsx)(Dd.List, {
    "data-slot": "tabs-list",
    "data-variant": t,
    className: Ta(nne({ variant: t }), e),
    ...a,
  });
}
function Pd({ className: e, ...t }) {
  return (0, W0.jsx)(Dd.Trigger, {
    "data-slot": "tabs-trigger",
    className: Ta(
      "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
      "data-[state=active]:bg-background data-[state=active]:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground",
      "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
      e,
    ),
    ...t,
  });
}
function j0({ className: e, ...t }) {
  return (0, W0.jsx)(Dd.Content, {
    "data-slot": "tabs-content",
    className: Ta("flex-1 outline-none", e),
    ...t,
  });
}
var SM = Me(_a(), 1),
  ine = qw(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    {
      variants: {
        variant: {
          default: "bg-primary text-primary-foreground hover:bg-primary/90",
          destructive:
            "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
          outline:
            "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
          secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
          link: "text-primary underline-offset-4 hover:underline",
        },
        size: {
          default: "h-9 px-4 py-2 has-[>svg]:px-3",
          xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
          sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
          lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
          icon: "size-9",
          "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
          "icon-sm": "size-8",
          "icon-lg": "size-10",
        },
      },
      defaultVariants: { variant: "default", size: "default" },
    },
  );
function q2({ className: e, variant: t = "default", size: a = "default", asChild: r = !1, ...n }) {
  let i = r ? P2.Root : "button";
  return (0, SM.jsx)(i, {
    "data-slot": "button",
    "data-variant": t,
    "data-size": a,
    className: Ta(ine({ variant: t, size: a, className: e })),
    ...n,
  });
}
var IA = Me(_a(), 1);
function Md({ ...e }) {
  return (0, IA.jsx)(zs.Root, { "data-slot": "dialog", ...e });
}
function one({ ...e }) {
  return (0, IA.jsx)(zs.Portal, { "data-slot": "dialog-portal", ...e });
}
function Ane({ className: e, ...t }) {
  return (0, IA.jsx)(zs.Overlay, {
    "data-slot": "dialog-overlay",
    className: Ta(
      "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
      e,
    ),
    ...t,
  });
}
function Hd({ className: e, children: t, showCloseButton: a = !0, ...r }) {
  return (0, IA.jsxs)(one, {
    "data-slot": "dialog-portal",
    children: [
      (0, IA.jsx)(Ane, {}),
      (0, IA.jsxs)(zs.Content, {
        "data-slot": "dialog-content",
        className: Ta(
          "fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
          e,
        ),
        ...r,
        children: [
          t,
          a &&
            (0, IA.jsxs)(zs.Close, {
              "data-slot": "dialog-close",
              className:
                "absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
              children: [
                (0, IA.jsx)(F0, {}),
                (0, IA.jsx)("span", { className: "sr-only", children: "Close" }),
              ],
            }),
        ],
      }),
    ],
  });
}
function qd({ className: e, ...t }) {
  return (0, IA.jsx)(zs.Title, {
    "data-slot": "dialog-title",
    className: Ta("text-lg leading-none font-semibold", e),
    ...t,
  });
}
function zd({ className: e, ...t }) {
  return (0, IA.jsx)(zs.Description, {
    "data-slot": "dialog-description",
    className: Ta("text-sm text-muted-foreground", e),
    ...t,
  });
}
var gf = Me(_a(), 1);
function nE({ className: e, ...t }) {
  return (0, gf.jsx)("div", {
    "data-slot": "table-container",
    className: "relative w-full overflow-x-auto",
    children: (0, gf.jsx)("table", {
      "data-slot": "table",
      className: Ta("w-full caption-bottom text-sm", e),
      ...t,
    }),
  });
}
function iE({ className: e, ...t }) {
  return (0, gf.jsx)("thead", { "data-slot": "table-header", className: Ta("[&_tr]:border-b", e), ...t });
}
function oE({ className: e, ...t }) {
  return (0, gf.jsx)("tbody", {
    "data-slot": "table-body",
    className: Ta("[&_tr:last-child]:border-0", e),
    ...t,
  });
}
function X0({ className: e, ...t }) {
  return (0, gf.jsx)("tr", {
    "data-slot": "table-row",
    className: Ta(
      "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
      e,
    ),
    ...t,
  });
}
function As({ className: e, ...t }) {
  return (0, gf.jsx)("th", {
    "data-slot": "table-head",
    className: Ta(
      "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      e,
    ),
    ...t,
  });
}
function ss({ className: e, ...t }) {
  return (0, gf.jsx)("td", {
    "data-slot": "table-cell",
    className: Ta(
      "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      e,
    ),
    ...t,
  });
}
var wn = Me(_a(), 1);
function Y0({ ...e }) {
  return (0, wn.jsx)(wo.Root, { "data-slot": "select", ...e });
}
function Z0({ ...e }) {
  return (0, wn.jsx)(wo.Value, { "data-slot": "select-value", ...e });
}
function J0({ className: e, size: t = "default", children: a, ...r }) {
  return (0, wn.jsxs)(wo.Trigger, {
    "data-slot": "select-trigger",
    "data-size": t,
    className: Ta(
      "flex w-fit items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[placeholder]:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
      e,
    ),
    ...r,
    children: [
      a,
      (0, wn.jsx)(wo.Icon, { asChild: !0, children: (0, wn.jsx)(Mp, { className: "size-4 opacity-50" }) }),
    ],
  });
}
function $0({ className: e, children: t, position: a = "item-aligned", align: r = "center", ...n }) {
  return (0, wn.jsx)(wo.Portal, {
    children: (0, wn.jsxs)(wo.Content, {
      "data-slot": "select-content",
      className: Ta(
        "relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        a === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        e,
      ),
      position: a,
      align: r,
      ...n,
      children: [
        (0, wn.jsx)(sne, {}),
        (0, wn.jsx)(wo.Viewport, {
          className: Ta(
            "p-1",
            a === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1",
          ),
          children: t,
        }),
        (0, wn.jsx)(lne, {}),
      ],
    }),
  });
}
function kl({ className: e, children: t, ...a }) {
  return (0, wn.jsxs)(wo.Item, {
    "data-slot": "select-item",
    className: Ta(
      "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
      e,
    ),
    ...a,
    children: [
      (0, wn.jsx)("span", {
        "data-slot": "select-item-indicator",
        className: "absolute right-2 flex size-3.5 items-center justify-center",
        children: (0, wn.jsx)(wo.ItemIndicator, { children: (0, wn.jsx)(md, { className: "size-4" }) }),
      }),
      (0, wn.jsx)(wo.ItemText, { children: t }),
    ],
  });
}
function sne({ className: e, ...t }) {
  return (0, wn.jsx)(wo.ScrollUpButton, {
    "data-slot": "select-scroll-up-button",
    className: Ta("flex cursor-default items-center justify-center py-1", e),
    ...t,
    children: (0, wn.jsx)(L0, { className: "size-4" }),
  });
}
function lne({ className: e, ...t }) {
  return (0, wn.jsx)(wo.ScrollDownButton, {
    "data-slot": "select-scroll-down-button",
    className: Ta("flex cursor-default items-center justify-center py-1", e),
    ...t,
    children: (0, wn.jsx)(Mp, { className: "size-4" }),
  });
}
var Bo = Me(_a(), 1);
function AE({ ...e }) {
  return (0, Bo.jsx)(Gs.Root, { "data-slot": "alert-dialog", ...e });
}
function une({ ...e }) {
  return (0, Bo.jsx)(Gs.Portal, { "data-slot": "alert-dialog-portal", ...e });
}
function cne({ className: e, ...t }) {
  return (0, Bo.jsx)(Gs.Overlay, {
    "data-slot": "alert-dialog-overlay",
    className: Ta(
      "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
      e,
    ),
    ...t,
  });
}
function sE({ className: e, size: t = "default", ...a }) {
  return (0, Bo.jsxs)(une, {
    children: [
      (0, Bo.jsx)(cne, {}),
      (0, Bo.jsx)(Gs.Content, {
        "data-slot": "alert-dialog-content",
        "data-size": t,
        className: Ta(
          "group/alert-dialog-content fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 data-[size=sm]:max-w-xs data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[size=default]:sm:max-w-lg",
          e,
        ),
        ...a,
      }),
    ],
  });
}
function lE({ className: e, ...t }) {
  return (0, Bo.jsx)("div", {
    "data-slot": "alert-dialog-footer",
    className: Ta(
      "flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end",
      e,
    ),
    ...t,
  });
}
function uE({ className: e, ...t }) {
  return (0, Bo.jsx)(Gs.Title, {
    "data-slot": "alert-dialog-title",
    className: Ta(
      "text-lg font-semibold sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
      e,
    ),
    ...t,
  });
}
function cE({ className: e, ...t }) {
  return (0, Bo.jsx)(Gs.Description, {
    "data-slot": "alert-dialog-description",
    className: Ta("text-sm text-muted-foreground", e),
    ...t,
  });
}
function fE({ className: e, variant: t = "default", size: a = "default", ...r }) {
  return (0, Bo.jsx)(q2, {
    variant: t,
    size: a,
    asChild: !0,
    children: (0, Bo.jsx)(Gs.Action, { "data-slot": "alert-dialog-action", className: Ta(e), ...r }),
  });
}
function dE({ className: e, variant: t = "outline", size: a = "default", ...r }) {
  return (0, Bo.jsx)(q2, {
    variant: t,
    size: a,
    asChild: !0,
    children: (0, Bo.jsx)(Gs.Cancel, { "data-slot": "alert-dialog-cancel", className: Ta(e), ...r }),
  });
}
var z2 = Me(_a(), 1);
function LM({ className: e, ...t }) {
  return (0, z2.jsx)(k0.Root, {
    "data-slot": "checkbox",
    className: Ta(
      "peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs transition-shadow outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:bg-input/30 dark:aria-invalid:ring-destructive/40 dark:data-[state=checked]:bg-primary",
      e,
    ),
    ...t,
    children: (0, z2.jsx)(k0.Indicator, {
      "data-slot": "checkbox-indicator",
      className: "grid place-content-center text-current transition-none",
      children: (0, z2.jsx)(md, { className: "size-3.5" }),
    }),
  });
}
var T = Me(_a(), 1),
  Gj = (e) => `${e} ${e === 1 ? "item" : "items"}`,
  ln = (e) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(e / 100),
  Rf = (e) => (/^\d+(\.\d{0,2})?$/.test(e) ? Math.round(Number(e) * 100) : NaN),
  R1e = { revision: 0, categories: [], products: [], sales: [], movements: [], markets: [] },
  Q1e = [
    ["Apples", "3.50", "bag", "1639328946611-6f274e05a5f5"],
    ["Bananas", "2.80", "bunch", "1571771894821-ce9b6c11b08e"],
    ["Fresh bread", "4.50", "loaf", "1719851615094-272d2251e20d"],
    ["Free-range eggs", "6.00", "carton", "1552418322-3855ef830d11"],
  ];
function Wg(e, t) {
  let a = (o) => {
      let A = String(o ?? "");
      return (
        /^[\s]*[=+@-]/.test(A) && typeof o == "string" && (A = "'" + A),
        '"' + A.replaceAll('"', '""') + '"'
      );
    },
    r = new Blob(
      [
        "\uFEFF" +
          t.map((o) => o.map(a).join(",")).join(`\r
`),
      ],
      { type: "text/csv;charset=utf-8" },
    ),
    n = URL.createObjectURL(r),
    i = document.createElement("a");
  ((i.href = n),
    (i.download = "little-shop-" + e + ".csv"),
    i.click(),
    setTimeout(() => URL.revokeObjectURL(n), 1e3));
}
// ===================== Little Shop: days, stock, discounts, reports =====================
var LS_TZ = "Australia/Brisbane";
// Business day (Brisbane) as YYYY-MM-DD
var lsDay = (d) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: LS_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    d ? new Date(d) : new Date(),
  );
var lsDayLabel = (day) =>
  new Intl.DateTimeFormat("en-AU", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(day + "T00:00:00Z"));
var lsTime = (iso) =>
  new Intl.DateTimeFormat("en-AU", { timeZone: LS_TZ, hour: "numeric", minute: "2-digit", hour12: !0 }).format(
    new Date(iso),
  );
var lsHour = (iso) =>
  Number(new Intl.DateTimeFormat("en-AU", { timeZone: LS_TZ, hour: "numeric", hour12: !1 }).format(new Date(iso))) % 24;
var lsMoney = (c) => "$" + (c / 100).toFixed(2);
var lsRound5 = (c) => Math.round(c / 5) * 5;
var LS_DISCOUNTS = {
  cash5: { pct: 5, label: "Cash sale 5%" },
  staff20: { pct: 20, label: "Staff 20%" },
  stall10: { pct: 10, label: "Stallholder 10%" },
};
var lsMethod = (m) => (m === "cash" ? "Cash" : m === "card" ? "Card" : "Not recorded");
// Custom (per-item dollar) discount taken off a sale
var lsCustomOff = (s) => s.custom_amount || 0;
var lsDiscountLabel = (s) => {
  let base = s.discount_type && LS_DISCOUNTS[s.discount_type] ? LS_DISCOUNTS[s.discount_type].label : "",
    cu = lsCustomOff(s) > 0 ? "Custom" : "";
  return base && cu ? base + " + custom" : base || (cu ? "Custom discount" : "None");
};
var lsIsDiscounted = (s) => !!s.discount_type || lsCustomOff(s) > 0;
// Price a basket.
// custom = total dollars-off from per-item custom discounts (cents). It comes off first.
// Cash: then 5% off, then round to nearest 5c. Card: then optional staff 20% / stallholder 10% (not with custom).
function lsPrice(subtotal, method, dtype, custom = 0) {
  let type = method === "cash" ? "cash5" : method === "card" && (dtype === "staff20" || dtype === "stall10") ? dtype : null,
    pct = type ? LS_DISCOUNTS[type].pct : 0,
    base = Math.max(0, subtotal - custom),
    pctOff = Math.round((base * pct) / 100),
    after = base - pctOff,
    total = method === "cash" ? lsRound5(after) : after;
  return { type, pct, pctOff, custom, discount: custom + pctOff, rounding: total - after, total };
}
var lsSaleDay = (s) => s.date || lsDay(s.at);
var lsStocktake = (state, day, market) =>
  (state.stocktakes || []).find((x) => x.date === day && x.market === market) || null;
function lsSold(state, day, market) {
  let sold = {};
  for (let s of state.sales)
    if (lsSaleDay(s) === day && s.market === market) for (let l of s.lines) sold[l.id] = (sold[l.id] || 0) + l.qty;
  return sold;
}
// Stock left today at this market. Items not counted in the stocktake count as 0.
function lsRemaining(state, day, market) {
  let st = lsStocktake(state, day, market),
    sold = lsSold(state, day, market),
    out = {};
  for (let p of state.products) out[p.id] = ((st && st.counts[p.id]) || 0) - (sold[p.id] || 0);
  return out;
}
// All day+market groups that have sales, newest first
function lsSaleGroups(state) {
  let m = new Map();
  for (let s of state.sales) {
    let day = lsSaleDay(s),
      k = day + "|" + s.market;
    m.has(k) || m.set(k, { key: k, day, market: s.market, sales: [] });
    m.get(k).sales.push(s);
  }
  return [...m.values()].sort((a, b) => (a.day === b.day ? a.market.localeCompare(b.market) : b.day.localeCompare(a.day)));
}
// Password hashing for the Sales tab (stored on the device only)
async function lsHash(salt, pw) {
  let buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pw));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
var lsSalt = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");

// ---------- PDF sheets ----------
var lsCategory = (state, line) => {
  if (typeof line.heading == "string") return { heading: line.heading || "Uncategorised", sub: line.subcategory || "" };
  let o = Ow(state.products.find((p) => p.id === line.id)?.category_id ?? null, state.categories);
  return { heading: o.heading, sub: o.subcategory };
};
var lsFileName = (day, market, purpose) =>
  ("Little-Shop_" + day + "_" + market + "_" + purpose).replace(/[^A-Za-z0-9_-]+/g, "-").replace(/-+/g, "-") + ".pdf";
var LS_TBL = {
  styles: { fontSize: 9, cellPadding: 2.5, overflow: "linebreak" },
  headStyles: { fillColor: [18, 100, 72] },
  margin: { top: 16, right: 14, bottom: 18, left: 14 },
  rowPageBreak: "avoid",
};
function lsDoc(purpose, day, market, landscape) {
  Kj(); // initialise the bundled jsPDF + table plugin
  let d = new Pt({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
  d.setTextColor(18, 100, 72);
  d.setFont("helvetica", "bold");
  d.setFontSize(18);
  d.text(purpose, 14, 18);
  d.setTextColor(40, 55, 46);
  d.setFontSize(12);
  d.text(lsDayLabel(day) + "  |  " + market, 14, 26);
  d.setFont("helvetica", "normal");
  d.setFontSize(8.5);
  d.setTextColor(95, 110, 101);
  d.text("Little Shop  |  Times are Brisbane time  |  Created " + lsDayLabel(lsDay()) + " " + lsTime(new Date()), 14, 32);
  d.lsTitle = purpose + " - " + lsDayLabel(day) + " - " + market;
  d.lsY = 38;
  return d;
}
function lsHeading(d, text) {
  let y = (d.lastAutoTable && d.lastAutoTable.finalY ? d.lastAutoTable.finalY + 10 : d.lsY + 2);
  y > d.internal.pageSize.getHeight() - 40 && (d.addPage(), (y = 20));
  d.setFont("helvetica", "bold");
  d.setFontSize(12);
  d.setTextColor(40, 55, 46);
  d.text(text, 14, y);
  return y + 3;
}
function lsTable(d, title, head, body, opts) {
  let y = lsHeading(d, title);
  v1(d, { ...LS_TBL, ...(opts || {}), startY: y, head: [head], body: body.length ? body : [[{ content: "None", colSpan: head.length }]] });
}
function lsFinish(d) {
  let n = d.getNumberOfPages(),
    w = d.internal.pageSize.getWidth(),
    h = d.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i++) {
    d.setPage(i);
    d.setFont("helvetica", "normal");
    d.setFontSize(8);
    d.setTextColor(95, 110, 101);
    d.text(d.lsTitle, 14, h - 8);
    d.text("Page " + i + " of " + n, w - 14, h - 8, { align: "right" });
  }
  return d;
}
// Percentage part of a sale's discount (older sales stored it all in discount_amount)
var lsPctOff = (s) => (s.pct_amount ?? (s.discount_type ? s.discount_amount || 0 : 0));
// Summary rows by discount type: Cash 5% / Staff 20% / Stallholder 10% / Custom
function lsDiscountRows(sales, withTotals) {
  let rows = Object.keys(LS_DISCOUNTS)
    .map((k) => {
      let l = sales.filter((s) => s.discount_type === k && lsPctOff(s) > 0);
      if (!l.length) return null;
      let t = (f) => lsMoney(l.reduce((a, s) => a + f(s), 0));
      return withTotals
        ? [LS_DISCOUNTS[k].label, String(l.length), t((s) => s.subtotal), t(lsPctOff)]
        : [LS_DISCOUNTS[k].label, String(l.length), t(lsPctOff)];
    })
    .filter(Boolean),
    cu = sales.filter((s) => lsCustomOff(s) > 0);
  if (cu.length) {
    let t = (f) => lsMoney(cu.reduce((a, s) => a + f(s), 0));
    rows.push(withTotals ? ["Custom discount (per item)", String(cu.length), t((s) => s.subtotal), t(lsCustomOff)] : ["Custom discount (per item)", String(cu.length), t(lsCustomOff)]);
  }
  return rows;
}
function lsOverallPdf(state, day, market) {
  let sales = state.sales.filter((s) => lsSaleDay(s) === day && s.market === market).sort((a, b) => a.at.localeCompare(b.at)),
    sum = (f, list) => (list || sales).reduce((t, s) => t + f(s), 0),
    items = sum((s) => s.lines.reduce((t, l) => t + l.qty, 0)),
    gross = sum((s) => s.subtotal),
    disc = sum((s) => s.discount_amount || 0),
    rounding = sum((s) => s.rounding ?? (s.method === "cash" && !s.discount_type ? s.total - s.subtotal : 0)),
    taken = sum((s) => s.total),
    d = lsDoc("Overall sales of the day", day, market);
  lsTable(
    d,
    "Summary",
    ["", ""],
    [
      ["Number of sales", String(sales.length)],
      ["Items sold", String(items)],
      ["Sales before discounts", lsMoney(gross)],
      ["Discounts given", "-" + lsMoney(disc)],
      ["Cash rounding", (rounding < 0 ? "-" : "") + lsMoney(Math.abs(rounding))],
      ["Total takings", lsMoney(taken)],
      ["Average sale", sales.length ? lsMoney(Math.round(taken / sales.length)) : "-"],
    ],
    { showHead: "never", columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 } } },
  );
  let methods = ["cash", "card", "none"].filter((m) => sales.some((s) => (s.method || "none") === m));
  lsTable(
    d,
    "Takings by payment",
    ["Payment", "Sales", "Takings"],
    methods.map((m) => {
      let l = sales.filter((s) => (s.method || "none") === m);
      return [lsMethod(m), String(l.length), lsMoney(sum((s) => s.total, l))];
    }),
  );
  lsTable(
    d,
    "Discounts",
    ["Discount", "Sales", "Amount given"],
    lsDiscountRows(sales, !1),
  );
  let byItem = new Map();
  for (let s of sales)
    for (let l of s.lines) {
      let c = lsCategory(state, l),
        k = c.heading + "|" + c.sub + "|" + l.name;
      byItem.has(k) || byItem.set(k, { ...c, name: l.name, qty: 0, value: 0 });
      let r = byItem.get(k);
      ((r.qty += l.qty), (r.value += l.total));
    }
  lsTable(
    d,
    "Items sold (value before discounts)",
    ["Heading", "Subheading", "Item", "Qty", "Value"],
    [...byItem.values()]
      .sort((a, b) => a.heading.localeCompare(b.heading) || a.sub.localeCompare(b.sub) || a.name.localeCompare(b.name))
      .map((r) => [r.heading, r.sub, r.name, String(r.qty), lsMoney(r.value)]),
  );
  let hours = new Map();
  for (let s of sales) {
    let h = lsHour(s.at);
    hours.has(h) || hours.set(h, { n: 0, t: 0 });
    let r = hours.get(h);
    ((r.n += 1), (r.t += s.total));
  }
  let hl = (h) => ((h % 12) || 12) + (h < 12 ? "am" : "pm");
  lsTable(
    d,
    "Sales by hour",
    ["Time", "Sales", "Takings"],
    [...hours.entries()].sort((a, b) => a[0] - b[0]).map(([h, r]) => [hl(h) + " - " + hl((h + 1) % 24), String(r.n), lsMoney(r.t)]),
  );
  return lsFinish(d);
}
function lsDiscountPdf(state, day, market) {
  let sales = state.sales
      .filter((s) => lsSaleDay(s) === day && s.market === market && lsIsDiscounted(s))
      .sort((a, b) => a.at.localeCompare(b.at)),
    d = lsDoc("Discounted sales", day, market, !0);
  lsTable(d, "Summary", ["Discount", "Sales", "Sales value before discount", "Discount given"], lsDiscountRows(sales, !0));
  // How much was taken off each product (custom discounts)
  let perItem = sales.flatMap((s) => s.lines.filter((l) => (l.discount_each || 0) > 0).map((l) => ({ s, l })));
  perItem.length &&
    lsTable(
      d,
      "Custom discounts by product",
      ["Time", "Product", "Qty", "Price each", "Off each", "Total off", "Payment"],
      perItem.map(({ s, l }) => [
        lsTime(s.at),
        l.name,
        String(l.qty),
        lsMoney(l.price),
        "-" + lsMoney(l.discount_each),
        "-" + lsMoney(l.discount_total ?? l.discount_each * l.qty),
        lsMethod(s.method),
      ]),
    );
  if (perItem.length) {
    let tot = new Map();
    for (let { l } of perItem) {
      tot.has(l.name) || tot.set(l.name, { qty: 0, off: 0 });
      let r = tot.get(l.name);
      ((r.qty += l.qty), (r.off += l.discount_total ?? l.discount_each * l.qty));
    }
    lsTable(
      d,
      "Custom discount totals per product",
      ["Product", "Qty discounted", "Total taken off"],
      [...tot.entries()].sort((a, b) => b[1].off - a[1].off).map(([n, r]) => [n, String(r.qty), "-" + lsMoney(r.off)]),
    );
  }
  lsTable(
    d,
    "All discounted sales",
    ["Time", "Discount", "Payment", "Name logged", "Items", "Before discount", "Discount", "Paid"],
    sales.map((s) => [
      lsTime(s.at),
      lsDiscountLabel(s),
      lsMethod(s.method),
      s.staff_name || "-",
      s.lines
        .map((l) => l.qty + " x " + l.name + ((l.discount_each || 0) > 0 ? " (-" + lsMoney(l.discount_each) + " each)" : ""))
        .join(", "),
      lsMoney(s.subtotal),
      "-" + lsMoney(s.discount_amount || 0),
      lsMoney(s.total),
    ]),
    { columnStyles: { 4: { cellWidth: 80 } } },
  );
  return lsFinish(d);
}
function lsSelloutPdf(state, day, market) {
  let st = lsStocktake(state, day, market),
    counts = (st && st.counts) || {},
    sales = state.sales.filter((s) => lsSaleDay(s) === day && s.market === market).sort((a, b) => a.at.localeCompare(b.at)),
    running = {},
    soldOut = {};
  for (let s of sales)
    for (let l of s.lines) {
      running[l.id] = (running[l.id] || 0) + l.qty;
      counts[l.id] > 0 && !soldOut[l.id] && running[l.id] >= counts[l.id] && (soldOut[l.id] = s.at);
    }
  let name = (id) => state.products.find((p) => p.id === id)?.name || sales.flatMap((s) => s.lines).find((l) => l.id === id)?.name || "Removed item",
    cat = (id) => {
      let p = state.products.find((x) => x.id === id),
        o = Ow(p?.category_id ?? null, state.categories);
      return o.heading + (o.subcategory ? " / " + o.subcategory : "");
    },
    d = lsDoc("Sell-out report", day, market);
  st ||
    (d.setFontSize(10), d.setTextColor(161, 47, 53), d.text("No morning stocktake was recorded for this day and market.", 14, d.lsY), (d.lsY += 6));
  lsTable(
    d,
    "Items that sold out",
    ["Sell-out time", "Item", "Heading", "Starting stock"],
    Object.entries(soldOut)
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, at]) => [lsTime(at), name(id), cat(id), String(counts[id])]),
  );
  lsTable(
    d,
    "Stock summary (items counted that morning)",
    ["Item", "Heading", "Start", "Sold", "Left"],
    Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => [name(id), cat(id), String(n), String(running[id] || 0), String(Math.max(0, n - (running[id] || 0)))])
      .sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0])),
  );
  return lsFinish(d);
}
// Hand the PDF to the iPad share sheet (Save to Files, AirDrop, Mail...), or download it elsewhere.
function lsDeliver(doc, filename) {
  let blob = doc.output("blob"),
    file = typeof File == "function" ? new File([blob], filename, { type: "application/pdf" }) : null;
  if (file && navigator.canShare && navigator.canShare({ files: [file] }))
    return navigator.share({ files: [file], title: doc.lsTitle }).catch(() => {});
  doc.save(filename);
}
// =======================================================================================

function m_({ offline: e = !1 } = {}) {
  let [t, a] = (0, wa.useState)(R1e),
    [r, n] = (0, wa.useState)(!1),
    [i, o] = (0, wa.useState)(""),
    [A, s] = (0, wa.useState)(!1),
    [l, u] = (0, wa.useState)("checkout"),
    [p, v] = (0, wa.useState)(""),
    [c, B] = (0, wa.useState)({}),
    [C, x] = (0, wa.useState)(null),
    [w, S] = (0, wa.useState)(!1),
    [L, F] = (0, wa.useState)(""),
    [q, j] = (0, wa.useState)(null),
    [z, k] = (0, wa.useState)(null),
    [O, ne] = (0, wa.useState)(null),
    [D, H] = (0, wa.useState)(""),
    [te, ee] = (0, wa.useState)(""),
    [ce, de] = (0, wa.useState)("all"),
    [fe, se] = (0, wa.useState)("all"),
    [ge, me] = (0, wa.useState)(null),
    [_e, N] = (0, wa.useState)(""),
    [Y, ae] = (0, wa.useState)(null),
    [Ae, ue] = (0, wa.useState)(""),
    [ve, we] = (0, wa.useState)(""),
    [be, Ue] = (0, wa.useState)(!1),
    [Re, Ve] = (0, wa.useState)(""),
    [Ke, je] = (0, wa.useState)("all"),
    [W, Pe] = (0, wa.useState)("all"),
    [vt, lt] = (0, wa.useState)(""),
    [He, Ct] = (0, wa.useState)(!1),
    [et, gt] = (0, wa.useState)(!1),
    [At, Nt] = (0, wa.useState)(null),
    // Editing tab: which section is showing ("items" | "headings" | "markets" | "backup")
    [es, setEs] = (0, wa.useState)("items"),
    // Market being added/renamed in Editing, and its error message
    [mk, setMk] = (0, wa.useState)(null),
    [mkErr, setMkErr] = (0, wa.useState)(""),
    // Business day (Brisbane). A new day asks for the market again.
    [today, setToday] = (0, wa.useState)(lsDay()),
    // Process sale: card discount option and the staff name logged with it
    [dsc, setDsc] = (0, wa.useState)("none"),
    [dName, setDName] = (0, wa.useState)(""),
    // Custom discount: dollars off each item, typed per basket line { productId: "1.50" }
    [cust, setCust] = (0, wa.useState)({}),
    // Inventory (morning stocktake)
    [invQ, setInvQ] = (0, wa.useState)(""),
    [stDraft, setStDraft] = (0, wa.useState)({}),
    [stKey, setStKey] = (0, wa.useState)(""),
    [stMsg, setStMsg] = (0, wa.useState)(""),
    // Sales tab (password protected)
    [salesOk, setSalesOk] = (0, wa.useState)(!1),
    // Editing tab uses the same password as Sales
    [editOk, setEditOk] = (0, wa.useState)(!1),
    // Inventory and Stocktake use the same password too
    [invOk, setInvOk] = (0, wa.useState)(!1),
    [stkOk, setStkOk] = (0, wa.useState)(!1),
    // Inventory heading / subheading filters (same as the checkout)
    [invCat, setInvCat] = (0, wa.useState)("all"),
    [invSub, setInvSub] = (0, wa.useState)("all"),
    // Stock presets dialog (save / manage)
    [presetDlg, setPresetDlg] = (0, wa.useState)(!1),
    [presetErr, setPresetErr] = (0, wa.useState)(""),
    // Stocktake tab: build and save base stocktake presets
    [stkSel, setStkSel] = (0, wa.useState)(""),
    [stkName, setStkName] = (0, wa.useState)(""),
    [stkDraft, setStkDraft] = (0, wa.useState)({}),
    [stkBase, setStkBase] = (0, wa.useState)(""),
    [stkMsg, setStkMsg] = (0, wa.useState)(""),
    [stkQ, setStkQ] = (0, wa.useState)(""),
    [stkCat, setStkCat] = (0, wa.useState)("all"),
    [stkSub, setStkSub] = (0, wa.useState)("all"),
    [pwErr, setPwErr] = (0, wa.useState)(""),
    [selGrp, setSelGrp] = (0, wa.useState)(""),
    [pwDlg, setPwDlg] = (0, wa.useState)(!1),
    Gt = (0, wa.useRef)(""),
    ut = (0, wa.useRef)(!1);
  // The chosen market only lasts for the day it was chosen on
  let MK = e ? "little-shop-offline-market" : "little-shop-market",
    MKD = MK + "-day";
  (0, wa.useEffect)(() => {
    let G = "",
      d = "";
    try {
      ((G = localStorage.getItem(MK) || ""), (d = localStorage.getItem(MKD) || ""));
    } catch {}
    G.trim() && d === lsDay() ? we(G) : (we(""), Ue(!0));
    // When the app is brought back on a new day (e.g. Sunday after Saturday), ask for the market again
    let check = () => {
      let now = lsDay();
      setToday((old) => {
        if (old !== now) (we(""), Ue(!0), B({}), S(!1), u((tab) => (tab === "inventory" ? tab : "checkout")));
        return now;
      });
    };
    let iv = setInterval(check, 6e4);
    (document.addEventListener("visibilitychange", check), window.addEventListener("focus", check));
    return () => (clearInterval(iv), document.removeEventListener("visibilitychange", check), window.removeEventListener("focus", check));
  }, []);
  // Choose the current market (from the preset list) for today
  function pickMarket(name) {
    we(name);
    try {
      name ? (localStorage.setItem(MK, name), localStorage.setItem(MKD, lsDay())) : (localStorage.removeItem(MK), localStorage.removeItem(MKD));
    } catch {}
    (name && Ue(!1), setToday(lsDay()));
  }
  let mkts = t.markets || [];
  // Save a market added or renamed in the Editing tab
  async function saveMarket(G) {
    if ((G.preventDefault(), ut.current)) return;
    ((ut.current = !0), s(!0), setMkErr(""));
    let Te = String(new FormData(G.currentTarget).get("marketName")).trim(),
      old = mk.id ? mkts.find((Xt) => Xt.id === mk.id)?.name : null;
    try {
      (await ha({ action: "market", market: { ...mk, name: Te } }),
        old && old === ve && pickMarket(Te),
        setMk(null));
    } catch (st) {
      setMkErr(st.message);
    } finally {
      ((ut.current = !1), s(!1));
    }
  }
  let Mt = Array.from(new Set([...t.sales.map((G) => G.market), ...(ve ? [ve] : [])])).sort((G, Te) =>
      G.localeCompare(Te, "en-AU"),
    ),
    it = VO(t.sales, Ke, W),
    xt = t.categories.filter((G) => !G.parent_id),
    at = t.products.filter((G) => !G.archived),
    fa = at.filter(
      (G) =>
        G.name.toLowerCase().includes(p.toLowerCase()) &&
        (ce === "all" ||
          G.category_id === ce ||
          t.categories.some((Te) => Te.id === G.category_id && Te.parent_id === ce)) &&
        (fe === "all" || G.category_id === fe),
    );
  function qt(G) {
    let Te = t.categories.find((Xt) => Xt.id === G),
      st = t.categories.find((Xt) => Xt.id === Te?.parent_id);
    return { heading: st?.name || Te?.name || "", subcategory: st ? Te.name : "" };
  }
  let Ht = [
      ...xt.flatMap((G) => [
        { id: G.id, heading: G.name, subcategory: "", products: fa.filter((Te) => Te.category_id === G.id) },
        ...t.categories
          .filter((Te) => Te.parent_id === G.id)
          .map((Te) => ({
            id: Te.id,
            heading: G.name,
            subcategory: Te.name,
            products: fa.filter((st) => st.category_id === Te.id),
          })),
      ]),
      {
        id: "uncategorised",
        heading: "Uncategorised",
        subcategory: "",
        products: fa.filter((G) => !G.category_id),
      },
    ].filter((G) => G.products.length),
    Vt = t.categories.find((G) => G.id === C?.category_id),
    ia = Vt?.parent_id || Vt?.id || "none",
    dt = Object.entries(c).flatMap(([G, Te]) => {
      let st = t.products.find((Xt) => Xt.id === G);
      return st ? [{ ...st, qty: Te, total: st.price * Te }] : [];
    }),
    Jt = dt.reduce((G, Te) => G + Te.total, 0),
    // Stock left today at the chosen market (items not counted = 0)
    stToday = ve ? lsStocktake(t, today, ve) : null,
    rem = ve ? lsRemaining(t, today, ve) : {},
    left = (id) => Math.max(0, rem[id] || 0),
    // Custom discount per item (capped at the item's price)
    custEach = (G) => {
      let v = Rf(String(cust[G.id] ?? "").trim() || "0");
      return Number.isFinite(v) ? Math.min(v, G.price) : 0;
    },
    custBad =
      dsc === "custom" &&
      dt.some((G) => {
        let raw = String(cust[G.id] ?? "").trim();
        return raw !== "" && (!Number.isFinite(Rf(raw)) || Rf(raw) > G.price);
      }),
    custTotal = dsc === "custom" ? dt.reduce((a2, G) => a2 + custEach(G) * G.qty, 0) : 0,
    pr = lsPrice(Jt, vt, dsc, custTotal),
    ft = pr.total,
    kt = dt.reduce((G, Te) => G + Te.qty, 0),
    da = dt.some((G) => G.archived || G.qty > left(G.id)),
    yt = (0, wa.useRef)({ active: at, lines: dt, cart: c, payment: w });
  yt.current = { active: at, lines: dt, cart: c, payment: w };
  // ----- Inventory: morning stocktake for today + chosen market -----
  let stSavedKey = today + "|" + ve,
    stSaved = (stToday && stToday.counts) || {},
    stCounts = (d) => {
      let o = {};
      for (let [k, v] of Object.entries(d)) String(v).trim() !== "" && (o[k] = Math.max(0, Math.floor(Number(v)) || 0));
      return o;
    },
    stCanon = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]])),
    stDirty = !!ve && stKey === stSavedKey && stCanon(stCounts(stDraft)) !== stCanon(stSaved),
    invList = at.filter(
      (G) =>
        G.name.toLowerCase().includes(invQ.trim().toLowerCase()) &&
        (invCat === "all" || G.category_id === invCat || t.categories.some((Te) => Te.id === G.category_id && Te.parent_id === invCat)) &&
        (invSub === "all" || G.category_id === invSub),
    ),
    invGroups = [
      ...xt.flatMap((G) => [
        { id: G.id, heading: G.name, subcategory: "", products: invList.filter((Te) => Te.category_id === G.id) },
        ...t.categories
          .filter((Te) => Te.parent_id === G.id)
          .map((Te) => ({ id: Te.id, heading: G.name, subcategory: Te.name, products: invList.filter((st) => st.category_id === Te.id) })),
      ]),
      { id: "uncategorised", heading: "Uncategorised", subcategory: "", products: invList.filter((G) => !G.category_id) },
    ].filter((G) => G.products.length),
    soldToday = ve ? lsSold(t, today, ve) : {};
  (0, wa.useEffect)(() => {
    // Load the saved stocktake whenever the day or market changes
    r &&
      ve &&
      stKey !== stSavedKey &&
      (setStDraft(Object.fromEntries(Object.entries(stSaved).map(([k, v]) => [k, String(v)]))), setStKey(stSavedKey), setStMsg(""));
  }, [stSavedKey, r, stKey]);
  let presets = t.stockPresets || [];
  // Fill today's counts from a preset; they can be edited before saving
  function loadPreset(P) {
    (setStDraft(Object.fromEntries(Object.entries(P.counts).filter(([k]) => at.some((x) => x.id === k)).map(([k, v]) => [k, String(v)]))),
      setStMsg("preset:" + P.name));
  }
  async function savePreset(G) {
    G.preventDefault();
    if (ut.current) return;
    let nm = String(new FormData(G.currentTarget).get("presetName") || "").trim(),
      counts = stCounts(stDraft);
    if (!Object.values(counts).some((v) => v > 0)) return setPresetErr("Enter some stock counts first, then save them as a preset.");
    ((ut.current = !0), s(!0), setPresetErr(""));
    try {
      (await ha({ action: "stock-preset", preset: { name: nm, counts } }), setPresetDlg(!1), setStMsg("presetSaved:" + nm));
    } catch (st) {
      setPresetErr(st.message);
    } finally {
      ((ut.current = !1), s(!1));
    }
  }
  async function deletePreset(P) {
    if (ut.current) return;
    ((ut.current = !0), s(!0), setPresetErr(""));
    try {
      await ha({ action: "delete-stock-preset", id: P.id });
    } catch (st) {
      setPresetErr(st.message);
    } finally {
      ((ut.current = !1), s(!1));
    }
  }
  // ----- Stocktake tab -----
  let groupsOf = (list) =>
      [
        ...xt.flatMap((G) => [
          { id: G.id, heading: G.name, subcategory: "", products: list.filter((Te) => Te.category_id === G.id) },
          ...t.categories
            .filter((Te) => Te.parent_id === G.id)
            .map((Te) => ({ id: Te.id, heading: G.name, subcategory: Te.name, products: list.filter((st) => st.category_id === Te.id) })),
        ]),
        { id: "uncategorised", heading: "Uncategorised", subcategory: "", products: list.filter((G) => !G.category_id) },
      ].filter((G) => G.products.length),
    stkList = at.filter(
      (G) =>
        G.name.toLowerCase().includes(stkQ.trim().toLowerCase()) &&
        (stkCat === "all" || G.category_id === stkCat || t.categories.some((Te) => Te.id === G.category_id && Te.parent_id === stkCat)) &&
        (stkSub === "all" || G.category_id === stkSub),
    ),
    stkGroups = groupsOf(stkList),
    stkPreset = presets.find((P) => P.id === stkSel) || null,
    stkDirty =
      !!stkSel &&
      (stkSel === "new"
        ? !!stkName.trim() || Object.keys(stCounts(stkDraft)).length > 0
        : !!stkPreset && (stkName.trim() !== stkPreset.name || stCanon(stCounts(stkDraft)) !== stCanon(stkPreset.counts))),
    savedDays = [...(t.stocktakes || [])]
      .filter((x) => Object.values(x.counts || {}).some((v) => v > 0))
      .sort((x, y) => (x.at < y.at ? 1 : -1));
  // Open a preset for editing ("new" = blank, or copied counts)
  function openPreset(id, counts, name) {
    let P = presets.find((x) => x.id === id);
    (setStkSel(id),
      setStkName(name ?? (P ? P.name : "")),
      setStkDraft(Object.fromEntries(Object.entries(counts ?? (P ? P.counts : {})).map(([k, v]) => [k, String(v)]))),
      setStkMsg(""));
  }
  // Start from the first preset when the tab is opened
  (0, wa.useEffect)(() => {
    !stkSel && presets.length && openPreset(presets[0].id);
  }, [stkSel, presets.length]);
  async function saveStk() {
    if (ut.current) return;
    let nm = stkName.trim(),
      counts = stCounts(stkDraft);
    if (!nm) return setStkMsg("Give the preset a name first.");
    if (!Object.values(counts).some((v) => v > 0)) return setStkMsg("Enter some counts before saving the preset.");
    ((ut.current = !0), s(!0), setStkMsg(""));
    try {
      let G = await ha({ action: "stock-preset", preset: { id: stkSel !== "new" ? stkSel : void 0, name: nm, counts } }),
        P = (G.stockPresets || []).find((x) => x.name.toLowerCase() === nm.toLowerCase());
      (P && (setStkSel(P.id), setStkName(P.name)), setStkMsg("saved"));
    } catch (st) {
      setStkMsg(st.message);
    } finally {
      ((ut.current = !1), s(!1));
    }
  }
  async function saveStock() {
    if (ut.current || !ve) return;
    ((ut.current = !0), s(!0), setStMsg(""));
    try {
      (await ha({ action: "stocktake", date: today, market: ve, counts: stCounts(stDraft) }), setStMsg("saved"));
    } catch (G) {
      setStMsg(G.message || "Could not save the stocktake.");
    } finally {
      ((ut.current = !1), s(!1));
    }
  }
  // ----- Sales tab: password -----
  async function unlockSales(G, where = "sales") {
    G.preventDefault();
    let open = () =>
      where === "editing" ? setEditOk(!0) : where === "inventory" ? setInvOk(!0) : where === "stocktake" ? setStkOk(!0) : setSalesOk(!0);
    setPwErr("");
    let f = new FormData(G.currentTarget),
      pw = String(f.get("pw") || "");
    try {
      if (!t.salesPw) {
        if (pw.length < 4) return setPwErr("Use at least 4 characters.");
        if (pw !== String(f.get("pw2") || "")) return setPwErr("The two passwords don\u2019t match.");
        let salt = lsSalt();
        (await ha({ action: "sales-password", hash: await lsHash(salt, pw), salt }), open());
      } else (await lsHash(t.salesPw.salt, pw)) === t.salesPw.hash ? open() : setPwErr("That password is not correct.");
    } catch (st) {
      setPwErr(st.message || "Something went wrong. Try again.");
    }
  }
  async function changePw(G) {
    G.preventDefault();
    setPwErr("");
    let f = new FormData(G.currentTarget),
      cur = String(f.get("cur") || ""),
      nw = String(f.get("nw") || "");
    if (nw.length < 4) return setPwErr("Use at least 4 characters.");
    if (nw !== String(f.get("nw2") || "")) return setPwErr("The new passwords don\u2019t match.");
    try {
      let oldHash = await lsHash(t.salesPw.salt, cur);
      if (oldHash !== t.salesPw.hash) return setPwErr("The current password is not correct.");
      let salt = lsSalt();
      (await ha({ action: "sales-password", oldHash, hash: await lsHash(salt, nw), salt }), setPwDlg(!1));
    } catch (st) {
      setPwErr(st.message);
    }
  }
  function makePdf(kind, g) {
    o("");
    try {
      let doc =
        kind === "overall" ? lsOverallPdf(t, g.day, g.market) : kind === "discounts" ? lsDiscountPdf(t, g.day, g.market) : lsSelloutPdf(t, g.day, g.market);
      lsDeliver(doc, lsFileName(g.day, g.market, kind === "overall" ? "Overall-sales" : kind === "discounts" ? "Discounted-sales" : "Sell-out-report"));
    } catch (err) {
      (console.error(err), o("The PDF could not be created. Please try again."));
    }
  }
  // Password screen shared by Editing and Sales (one password for both)
  function lockForm(where) {
    let name = { editing: "Editing", inventory: "Inventory", stocktake: "Stocktake" }[where] || "Sales";
    return (0, T.jsxs)(
      "form",
      {
        className: "sales-lock",
        onSubmit: (G) => unlockSales(G, where),
        children: [
          (0, T.jsx)("h2", { children: t.salesPw ? "Enter the password to open " + name : "Create a password" }),
          (0, T.jsx)("p", {
            className: "muted",
            children: t.salesPw
              ? name === "Editing"
                ? "Changing items, headings and markets is protected."
                : name === "Inventory"
                ? "The day\u2019s stock counts are protected."
                : name === "Stocktake"
                ? "The stocktake presets are protected."
                : "Sales records are protected."
              : "One password protects Inventory, Stocktake, Editing and Sales. You will need it each time you open them.",
          }),
          (0, T.jsxs)("label", {
            className: "field",
            children: [
              t.salesPw ? "Password" : "New password",
              (0, T.jsx)("input", { name: "pw", type: "password", autoComplete: "off", required: !0 }, "pw-" + where + !!t.salesPw),
            ],
          }),
          !t.salesPw &&
            (0, T.jsxs)("label", {
              className: "field",
              children: ["Type it again", (0, T.jsx)("input", { name: "pw2", type: "password", autoComplete: "off", required: !0 })],
            }),
          pwErr && (0, T.jsx)("p", { role: "alert", className: "form-error", children: pwErr }),
          (0, T.jsx)("button", { className: "primary", disabled: !r, children: t.salesPw ? "Open " + name : "Create password" }),
          t.salesPw &&
            (0, T.jsx)("button", {
              type: "button",
              className: "text-button",
              onClick: () => Gr({ kind: "reset-sales", item: { id: "reset", name: "the password and all sales records" } }),
              children: "Forgot the password?",
            }),
        ],
      },
      "lock-" + where,
    );
  }
  // Heading for a locked tab: title, plus Change password / Lock when open
  let lockedHead = (key, eyebrow, title, sub, isOpen, lock) =>
    (0, T.jsxs)(
      "div",
      {
        className: "section-heading locked-head",
        children: [
          (0, T.jsxs)("div", {
            children: [
              (0, T.jsx)("p", { className: "eyebrow", children: eyebrow }),
              (0, T.jsx)("h1", { children: title }),
              sub,
            ],
          }),
          isOpen &&
            (0, T.jsxs)("div", {
              className: "row-actions",
              children: [
                (0, T.jsx)("button", { className: "secondary", onClick: () => (setPwErr(""), setPwDlg(!0)), children: "Change password" }),
                (0, T.jsx)("button", { className: "secondary", onClick: lock, children: "Lock" }),
              ],
            }),
        ],
      },
      key,
    );
  let invHead = lockedHead(
      "inv-head",
      "MORNING STOCKTAKE",
      "Inventory",
      ve && (0, T.jsxs)("p", { className: "stock-day", children: [lsDayLabel(today), " \xB7 ", ve] }),
      invOk,
      () => (stDirty && ve && saveStock(), setInvOk(!1)),
    ),
    stkHead = lockedHead("stk-head", "BASE STOCKTAKE PRESETS", "Stocktake", null, stkOk, () => setStkOk(!1));
  let editHead = (0, T.jsxs)(
    "div",
    {
      className: "section-heading",
      children: [
        (0, T.jsxs)("div", {
          children: [
            (0, T.jsx)("p", { className: "eyebrow", children: "BEHIND THE COUNTER" }),
            (0, T.jsx)("h1", { children: "Editing" }),
          ],
        }),
        editOk &&
          (0, T.jsxs)("div", {
            className: "row-actions",
            children: [
              (0, T.jsx)("button", { className: "secondary", onClick: () => (setPwErr(""), setPwDlg(!0)), children: "Change password" }),
              (0, T.jsx)("button", { className: "secondary", onClick: () => setEditOk(!1), children: "Lock" }),
            ],
          }),
      ],
    },
    "edit-head",
  );
  let groups = lsSaleGroups(t),
    grp = groups.find((G) => G.key === selGrp) || groups[0] || null;
  async function wt() {
    o("");
    try {
      let G = e ? null : await fetch("/api/shop", { cache: "no-store" }),
        Te = e ? await GO() : await G.json();
      if (G && !G.ok) throw Error(Te.error || "Please try again.");
      (a(Te),
        de((st) => (st === "all" || Te.categories.some((Xt) => Xt.id === st) ? st : "all")),
        se((st) => (st === "all" || Te.categories.some((Xt) => Xt.id === st) ? st : "all")),
        setInvCat((st) => (st === "all" || Te.categories.some((Xt) => Xt.id === st) ? st : "all")),
        setInvSub((st) => (st === "all" || Te.categories.some((Xt) => Xt.id === st) ? st : "all")),
        B((st) =>
          Object.fromEntries(Object.entries(st).filter(([Xt]) => Te.products.some((Sr) => Sr.id === Xt))),
        ),
        n(!0));
    } catch (G) {
      o(G.message || "Could not load your shop.");
    }
  }
  ((0, wa.useEffect)(() => {
    wt();
  }, []),
    (0, wa.useEffect)(() => {
      let G = document.modelContext;
      if (!G?.registerTool) return;
      let Te = new AbortController();
      for (let st of [
        {
          name: "read_shop_inventory",
          description: "Read the current inventory and basket without changing data.",
          inputSchema: { type: "object", properties: {}, additionalProperties: !1 },
          annotations: { readOnlyHint: !0 },
          execute: () => ({ products: yt.current.active, basket: yt.current.lines }),
        },
        {
          name: "stage_basket_item",
          description: "Add an available item to the visible basket. Does not record payment.",
          inputSchema: {
            type: "object",
            properties: { id: { type: "string" }, quantity: { type: "integer", minimum: 1 } },
            required: ["id", "quantity"],
            additionalProperties: !1,
          },
          annotations: { readOnlyHint: !1 },
          execute: (Xt) => {
            let { active: Sr, cart: ao, payment: $o } = yt.current,
              Pn = Sr.find((OA) => OA.id === Xt.id);
            if (
              !Pn ||
              !Number.isInteger(Xt.quantity) ||
              Xt.quantity < 1 ||
              Xt.quantity + (ao[Pn.id] || 0) > 9999 ||
              $o
            )
              throw Error("Item or quantity is unavailable.");
            return (
              (Gt.current = ""),
              B((OA) => ({ ...OA, [Pn.id]: (OA[Pn.id] || 0) + Xt.quantity })),
              { id: Pn.id, quantity: (ao[Pn.id] || 0) + Xt.quantity }
            );
          },
        },
      ])
        try {
          Promise.resolve(G.registerTool(st, { signal: Te.signal })).catch(() => {});
        } catch {}
      return () => Te.abort();
    }, []),
    (0, wa.useEffect)(() => {
      if (!O) {
        H("");
        return;
      }
      let G = URL.createObjectURL(O);
      return (H(G), () => URL.revokeObjectURL(G));
    }, [O]));
  async function ha(G) {
    if (e) {
      let Xt = await jO({ ...G, revision: t.revision });
      return (a(Xt), Xt);
    }
    let Te = await fetch("/api/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...G, revision: t.revision }),
      }),
      st = await Te.json();
    if (!Te.ok) throw Error(st.error || "Please try again.");
    return (a(st), st);
  }
  function Sn(G) {
    (ne(null),
      ee(""),
      x(
        G || {
          id: "",
          name: "",
          price: 0,
          stock: 0,
          unit: "each",
          image: "",
          archived: 0,
          category_id: null,
        },
      ));
  }
  function sr(G, Te = 1) {
    ((Gt.current = ""),
      B((st) => {
        let Xt = Math.max(0, Math.min(left(G.id), (st[G.id] || 0) + Te)),
          Sr = { ...st };
        return (Xt ? (Sr[G.id] = Xt) : delete Sr[G.id], Sr);
      }));
  }
  async function $n(G) {
    if ((G.preventDefault(), ut.current)) return;
    ((ut.current = !0), s(!0), ee(""));
    let Te = new FormData(G.currentTarget);
    try {
      let st = C.image;
      if (O && e) st = await j5(O);
      else if (O) {
        let Xt = await fetch("/api/photo", { method: "POST", headers: { "Content-Type": O.type }, body: O }),
          Sr = await Xt.json();
        if (!Xt.ok) throw Error(Sr.error);
        st = Sr.image;
      }
      (await ha({
        action: "product",
        product: {
          ...C,
          name: Te.get("name"),
          price: Rf(String(Te.get("price"))),
          stock: Number.isSafeInteger(C.stock) && C.stock >= 0 ? C.stock : 0,
          unit: C.unit || "each",
          image: st,
        },
      }),
        x(null));
    } catch (st) {
      ee(st.message);
    } finally {
      ((ut.current = !1), s(!1));
    }
  }
  async function Ln() {
    if (!ut.current) {
      ((ut.current = !0), s(!0), ee(""));
      try {
        let G = await ha({
          action: "sale",
          id: Gt.current,
          cash: 0,
          method: vt,
          discount: dsc === "custom" ? "custom" : vt === "card" && dsc !== "none" ? dsc : null,
          staffName: vt === "card" && (dsc === "staff20" || dsc === "stall10") ? dName.trim() : "",
          custom:
            dsc === "custom" ? Object.fromEntries(dt.map((G) => [G.id, custEach(G)]).filter(([, v]) => v > 0)) : void 0,
          market: ve,
          lines: dt.map((Te) => ({ id: Te.id, qty: Te.qty })),
        });
        // Straight back to a clean checkout for the next customer
        ((Gt.current = ""), B({}), S(!1), F(""));
      } catch (G) {
        ee(G.message);
      } finally {
        ((ut.current = !1), s(!1));
      }
    }
  }
  function Rt(G, Te = null) {
    (N(""), me(G || { id: "", name: "", parent_id: Te }));
  }
  async function Or(G) {
    if ((G.preventDefault(), ut.current)) return;
    ((ut.current = !0), s(!0), N(""));
    let Te = new FormData(G.currentTarget);
    try {
      (await ha({ action: "category", category: { ...ge, name: String(Te.get("categoryName")) } }), me(null));
    } catch (st) {
      N(st.message);
    } finally {
      ((ut.current = !1), s(!1));
    }
  }
  function Gr(G) {
    (ue(""), ae(G));
  }
  async function Kt() {
    if (!(!Y || ut.current)) {
      ((ut.current = !0), s(!0), ue(""));
      try {
        let G = await ha(
          Y.kind === "preset"
            ? { action: "delete-stock-preset", id: Y.item.id }
            : Y.kind === "sales-day"
            ? { action: "delete-sales", date: Y.item.day, market: Y.item.market }
            : Y.kind === "sales-all"
              ? { action: "delete-sales", all: !0 }
              : Y.kind === "reset-sales"
                ? { action: "reset-sales" }
                : {
                    action:
                      Y.kind === "product" ? "delete-product" : Y.kind === "market" ? "delete-market" : "delete-category",
                    id: Y.item.id,
                  },
        );
        (Y.kind === "preset" && setStkSel(""),
          Y.kind === "reset-sales" && (setSalesOk(!1), setEditOk(!1), setInvOk(!1), setStkOk(!1)), Y.kind.startsWith("sales") && setSelGrp(""));
        Y.kind === "market" && Y.item.name === ve && pickMarket("");
        (Y.kind === "product" &&
          ((Gt.current = ""),
          B((Te) => {
            let st = { ...Te };
            return (delete st[Y.item.id], st);
          }),
          C?.id === Y.item.id && x(null)),
          de((Te) => (Te === "all" || G.categories.some((st) => st.id === Te) ? Te : "all")),
          se((Te) => (Te === "all" || G.categories.some((st) => st.id === Te) ? Te : "all")),
          ae(null));
      } catch (G) {
        ue(G.message);
      } finally {
        ((ut.current = !1), s(!1));
      }
    }
  }
  let jr =
    Y?.kind === "product"
      ? "This removes the item from the checkout and the current basket."
      : Y?.kind === "preset"
        ? "This deletes the preset. Stocktakes already saved for past days are not affected."
      : Y?.kind === "market"
        ? "This removes the market from the list you choose from at the checkout."
        : Y?.kind === "sales-day"
          ? "This permanently deletes every sale recorded for this day and market. Download any sheets you need first."
          : Y?.kind === "sales-all"
            ? "This permanently deletes every sale recorded in the app. Download any sheets you need first."
            : Y?.kind === "reset-sales"
              ? "Without the password, the only way back into the locked tabs is to delete every sales record. Items, headings, markets and today’s stocktake are kept. You will then create a new password."
        : Y?.kind === "category" && Y.item.parent_id
          ? `Items in this subheading will move to ${t.categories.find((G) => G.id === Y.item.parent_id)?.name || "the main heading"}.`
          : "This also removes its subheadings. Its items stay, listed as Uncategorised.";
  function Za() {
    Wg("categories", [
      ["Heading", "Subcategory"],
      ...t.categories.map((G) => [qt(G.id).heading, qt(G.id).subcategory]),
    ]);
  }
  function Da(G) {
    return (0, T.jsxs)(
      "button",
      {
        className: "product" + (left(G.id) < 1 ? " no-stock" : ""),
        disabled: left(G.id) < 1 || (c[G.id] || 0) >= left(G.id),
        onClick: () => sr(G),
        "aria-label": `Add ${G.name}, ${ln(G.price)}`,
        children: [
          (0, T.jsx)("div", {
            className: "product-image",
            children: G.image
              ? (0, T.jsx)("img", { src: G.image, alt: G.name })
              : (0, T.jsx)(Du, { size: 48, color: "#8aa392" }),
          }),
          (0, T.jsx)("span", { className: "add-mark", children: (0, T.jsx)(ts, { size: 18 }) }),
          (0, T.jsxs)("div", {
            className: "product-info",
            children: [
              (0, T.jsx)("h3", { children: G.name }),
              (0, T.jsx)("span", { className: "price", children: ln(G.price) }),
              left(G.id) < 1
                ? (0, T.jsx)("span", { className: "stock none", children: "No stock" })
                : c[G.id]
                  ? (0, T.jsx)("span", { className: "stock in-basket", children: `${c[G.id]} in basket` })
                  : null,
            ],
          }),
        ],
      },
      G.id,
    );
  }
  function lr() {
    Wg("inventory", [
      ["Item", "Heading", "Subcategory", "Price", "Stock", "Photo URL"],
      ...t.products.map((G) => [
        G.name,
        qt(G.category_id).heading,
        qt(G.category_id).subcategory,
        G.price / 100,
        G.stock,
        G.image ? new URL(G.image, location.origin).href : "",
      ]),
    ]);
  }
  function to() {
    Wg("payment-totals", [
      [
        "Market",
        "Time (Brisbane)",
        "Method",
        "Item total",
        "Cash rounding",
        "Total",
        "Cash received",
        "Change",
      ],
      ...it.map((G) => [
        G.market,
        Af(G.at),
        Ds(G.method),
        G.subtotal / 100,
        (G.total - G.subtotal) / 100,
        G.total / 100,
        G.method === "cash" ? G.cash / 100 : "",
        G.method === "cash" ? G.change / 100 : "",
      ]),
    ]);
  }
  function pi() {
    Wg("sales", C0(it, t.products, t.categories).detailRows);
  }
  function gi() {
    Wg("sales-by-category", C0(it, t.products, t.categories).summaryRows);
  }
  function un() {
    Wg("stock-history", [
      ["Item", "Market", "Time (Brisbane)", "Quantity change", "Reason"],
      ...t.movements.map((G) => {
        let Te = t.sales.find((st) => "Sale " + st.id === G.reason);
        return [
          G.product_name || t.products.find((st) => st.id === G.product_id)?.name || "",
          Te?.market || "",
          Af(G.at),
          G.delta,
          G.reason.startsWith("Sale ") ? "Sale" : G.reason,
        ];
      }),
    ]);
  }
  async function mi() {
    (Ct(!0), o(""));
    try {
      let { salesPdf: G } = await Promise.resolve().then(() => (Kj(), Vj));
      G(it, t.products, t.categories, Ke, W).save("little-shop-sales.pdf");
    } catch {
      o("The PDF could not be created. Please try again.");
    } finally {
      Ct(!1);
    }
  }
  return (0, T.jsxs)("main", {
    children: [
      (0, T.jsxs)("header", {
        children: [
          (0, T.jsxs)("div", {
            className: "brand",
            children: [
              (0, T.jsx)("span", { className: "brandmark", children: (0, T.jsx)(vd, {}) }),
              (0, T.jsxs)("div", {
                children: ["Little Shop", (0, T.jsx)("small", { children: "YOUR EVERYDAY COUNTER" })],
              }),
            ],
          }),
          (0, T.jsxs)("button", {
            className: "market-button",
            onClick: () => {
              (l !== "inventory" && u("checkout"), Ue(!0));
            },
            children: [
              (0, T.jsx)("span", { children: ve || "Choose a market" }),
              (0, T.jsx)("small", { children: "Change market" }),
            ],
          }),
        ],
      }),
      i &&
        (0, T.jsxs)("div", {
          role: "alert",
          className: "error",
          children: [
            i,
            " ",
            (0, T.jsx)("button", { className: "text-button", onClick: wt, children: "Try again" }),
          ],
        }),
      (0, T.jsxs)(aE, {
        value: l,
        onValueChange: (G) => {
          // Leaving Inventory with unsaved counts saves them; leaving Sales locks it again
          (l === "inventory" && stDirty && ve && saveStock(),
            l === "stocktake" && stkDirty && stkName.trim() && Object.values(stCounts(stkDraft)).some((v) => v > 0) && saveStk(), l === "sales" && G !== "sales" && setSalesOk(!1), l === "editing" && G !== "editing" && setEditOk(!1),
            l === "inventory" && G !== "inventory" && setInvOk(!1),
            l === "stocktake" && G !== "stocktake" && setStkOk(!1),
            setPwErr(""),
            u(G));
        },
        children: [
          (0, T.jsxs)(rE, {
            className: "navigation",
            children: [
              (0, T.jsxs)(Pd, { value: "checkout", children: [(0, T.jsx)(zp, {}), "Checkout"] }),
              (0, T.jsxs)(Pd, { value: "inventory", children: [(0, T.jsx)(Du, {}), "Inventory"] }),
              (0, T.jsxs)(Pd, { value: "stocktake", children: [(0, T.jsx)(LsClipboard, {}), "Stocktake"] }),
              (0, T.jsxs)(Pd, { value: "editing", children: [(0, T.jsx)(LsPencil, {}), "Editing"] }),
              (0, T.jsxs)(Pd, { value: "sales", children: [(0, T.jsx)(Hp, {}), "Sales"] }),
            ],
          }),
          (0, T.jsx)(j0, {
            value: "checkout",
            children: (0, T.jsxs)("div", {
              className: "workspace",
              children: [
                (0, T.jsxs)("section", {
                  className: "catalog",
                  children: [
                    (0, T.jsxs)("div", {
                      className: "section-heading",
                      children: [
                        (0, T.jsxs)("div", {
                          children: [
                            (0, T.jsx)("p", { className: "eyebrow", children: "THE SHOP COUNTER" }),
                            (0, T.jsx)("h1", { children: "Let\u2019s make a sale." }),
                          ],
                        }),
                      ],
                    }),
                    ve &&
                      r &&
                      !stToday &&
                      (0, T.jsxs)("div", {
                        className: "notice stock-notice",
                        children: [
                          "No stocktake entered for today at ",
                          (0, T.jsx)("strong", { children: ve }),
                          ", so every item shows No stock. ",
                          (0, T.jsx)("button", {
                            className: "text-button",
                            onClick: () => u("inventory"),
                            children: "Enter today’s stock in Inventory",
                          }),
                        ],
                      }),
                    (0, T.jsxs)("div", {
                      className: "search",
                      children: [
                        (0, T.jsx)(E0, { size: 20 }),
                        (0, T.jsx)("input", {
                          placeholder: "Find an item\u2026",
                          value: p,
                          onChange: (G) => v(G.target.value),
                          "aria-label": "Find an item",
                        }),
                      ],
                    }),
                    r &&
                      xt.length > 0 &&
                      (0, T.jsxs)("div", {
                        className: "category-browser",
                        children: [
                          (0, T.jsxs)("div", {
                            className: "category-chips",
                            "aria-label": "Filter by heading",
                            children: [
                              (0, T.jsx)("button", {
                                "aria-pressed": ce === "all",
                                onClick: () => {
                                  (de("all"), se("all"));
                                },
                                children: "All items",
                              }),
                              xt.map((G) =>
                                (0, T.jsx)(
                                  "button",
                                  {
                                    "aria-pressed": ce === G.id,
                                    onClick: () => {
                                      (de(G.id), se("all"));
                                    },
                                    children: G.name,
                                  },
                                  G.id,
                                ),
                              ),
                            ],
                          }),
                          ce !== "all" &&
                            t.categories.some((G) => G.parent_id === ce) &&
                            (0, T.jsxs)("div", {
                              className: "category-chips subcategory-chips",
                              "aria-label": "Filter by subcategory",
                              children: [
                                (0, T.jsxs)("button", {
                                  "aria-pressed": fe === "all",
                                  onClick: () => se("all"),
                                  children: ["All ", t.categories.find((G) => G.id === ce)?.name],
                                }),
                                t.categories
                                  .filter((G) => G.parent_id === ce)
                                  .map((G) =>
                                    (0, T.jsx)(
                                      "button",
                                      {
                                        "aria-pressed": fe === G.id,
                                        onClick: () => se(G.id),
                                        children: G.name,
                                      },
                                      G.id,
                                    ),
                                  ),
                              ],
                            }),
                        ],
                      }),
                    r
                      ? at.length
                        ? (0, T.jsxs)(T.Fragment, {
                            children: [
                              t.categories.length
                                ? Ht.map((G, Te) =>
                                    (0, T.jsxs)(
                                      "section",
                                      {
                                        className: "catalog-group",
                                        children: [
                                          (Te === 0 || Ht[Te - 1].heading !== G.heading) &&
                                            (0, T.jsx)("h2", { children: G.heading }),
                                          G.subcategory &&
                                            (0, T.jsx)("h3", {
                                              className: "subcategory-heading",
                                              children: G.subcategory,
                                            }),
                                          (0, T.jsx)("div", {
                                            className: "product-grid",
                                            children: G.products.map(Da),
                                          }),
                                        ],
                                      },
                                      G.id,
                                    ),
                                  )
                                : (0, T.jsx)("div", { className: "product-grid", children: fa.map(Da) }),
                              !fa.length &&
                                (0, T.jsxs)("div", {
                                  className: "welcome",
                                  children: [
                                    (0, T.jsx)("h2", { children: "No items in this view" }),
                                    (0, T.jsx)("button", {
                                      className: "text-button",
                                      onClick: () => {
                                        (v(""), de("all"), se("all"));
                                      },
                                      children: "Show all items",
                                    }),
                                  ],
                                }),
                            ],
                          })
                        : (0, T.jsxs)("div", {
                            className: "welcome",
                            children: [
                              (0, T.jsx)("span", {
                                className: "welcome-icon",
                                children: (0, T.jsx)(vd, { size: 36 }),
                              }),
                              (0, T.jsx)("h2", { children: "No items yet" }),
                              (0, T.jsx)("p", { children: "Items added in the Editing tab will appear here." }),
                            ],
                          })
                      : (0, T.jsxs)("div", {
                          className: "welcome",
                          children: [
                            (0, T.jsx)(vd, { size: 40 }),
                            (0, T.jsx)("h2", {
                              children: i ? "Your shop is unavailable" : "Opening your shop\u2026",
                            }),
                            (0, T.jsx)("p", {
                              children: i
                                ? "Try again to load your saved items."
                                : "Your products will appear here.",
                            }),
                          ],
                        }),
                  ],
                }),
                (0, T.jsxs)("aside", {
                  className: "basket",
                  children: [
                    (0, T.jsxs)("div", {
                      className: "basket-heading",
                      children: [
                        (0, T.jsx)("h2", { children: "Current basket" }),
                        (0, T.jsxs)("span", { children: [kt, " ", kt === 1 ? "item" : "items"] }),
                      ],
                    }),
                    dt.length
                      ? (0, T.jsxs)("div", {
                          className: "basket-lines",
                          children: [
                            dt.map((G) =>
                              (0, T.jsxs)(
                                "div",
                                {
                                  className: "basket-line",
                                  children: [
                                    (0, T.jsxs)("div", {
                                      className: "line-title",
                                      children: [
                                        (0, T.jsx)("span", { children: G.name }),
                                        (0, T.jsx)("span", { children: ln(G.total) }),
                                      ],
                                    }),
                                    (0, T.jsxs)("div", {
                                      className: "line-controls",
                                      children: [
                                        (0, T.jsx)("small", { children: ln(G.price) }),
                                        (0, T.jsxs)("div", {
                                          className: "stepper",
                                          children: [
                                            (0, T.jsx)("button", {
                                              "aria-label": "Remove one " + G.name,
                                              onClick: () => sr(G, -1),
                                              children: (0, T.jsx)(I0, {}),
                                            }),
                                            (0, T.jsx)("span", { children: G.qty }),
                                            (0, T.jsx)("button", {
                                              "aria-label": "Add one " + G.name,
                                              disabled: G.qty >= left(G.id),
                                              onClick: () => sr(G),
                                              children: (0, T.jsx)(ts, {}),
                                            }),
                                          ],
                                        }),
                                      ],
                                    }),
                                    (!!G.archived || G.qty > left(G.id)) &&
                                      (0, T.jsx)("p", {
                                        className: "muted",
                                        children: G.archived
                                          ? "This item is hidden. Remove it before processing the sale."
                                          : `Only ${left(G.id)} left. Reduce the quantity before processing the sale.`,
                                      }),
                                  ],
                                },
                                G.id,
                              ),
                            ),
                            (0, T.jsx)("button", {
                              className: "text-button",
                              onClick: () => B({}),
                              children: "Clear basket",
                            }),
                          ],
                        })
                      : (0, T.jsxs)("div", {
                          className: "basket-empty",
                          children: [
                            (0, T.jsx)(zp, { size: 48 }),
                            (0, T.jsx)("h3", { children: "Your basket is empty" }),
                            (0, T.jsx)("p", { children: "Tap an item to add it here." }),
                          ],
                        }),
                    (0, T.jsxs)("div", {
                      className: "basket-footer",
                      children: [
                        (0, T.jsxs)("div", {
                          className: "total",
                          children: [
                            (0, T.jsx)("span", { children: "Total" }),
                            (0, T.jsx)("strong", { children: ln(Jt) }),
                          ],
                        }),
                        (0, T.jsx)("button", {
                          className: "primary checkout",
                          disabled: !dt.length || da || !!i || !ve,
                          onClick: () => {
                            (Gt.current || (Gt.current = crypto.randomUUID()), F(""), lt(""), setDsc("none"), setDName(""), setCust({}), ee(""), S(!0));
                          },
                          children: "Process sale",
                        }),
                        (0, T.jsx)("p", { children: ve || "Choose a market to start" }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          }),
          (0, T.jsx)(j0, {
            value: "inventory",
            children: (0, T.jsxs)("section", {
              className: "page inventory-page",
              // Locked: heading + password screen only
              children: !invOk
                ? [invHead, lockForm("inventory")]
                : [
                invHead,
                !ve
                  ? (0, T.jsxs)("div", {
                      className: "welcome",
                      children: [
                        (0, T.jsx)(LsMapPin, { size: 40, style: { margin: "auto" } }),
                        (0, T.jsx)("h2", { children: "Choose today’s market first" }),
                        (0, T.jsx)("p", { children: "The stocktake is kept separately for each market and day." }),
                        (0, T.jsx)("button", { className: "primary", onClick: () => Ue(!0), children: "Choose market" }),
                      ],
                    })
                  : (0, T.jsxs)(T.Fragment, {
                      children: [
                        (0, T.jsx)("div", {
                          className: "notice",
                          children:
                            "Enter how many of each item you have at the start of the day. Items left blank count as 0 and show No stock at the checkout.",
                        }),
                        // Stock presets (made in the Stocktake tab): fill all counts in one tap, then adjust
                        (0, T.jsxs)("div", {
                          className: "preset-bar",
                          children: [
                            (0, T.jsxs)("div", {
                              className: "preset-bar-text",
                              children: [
                                (0, T.jsx)("strong", { children: "Load a stocktake preset" }),
                                (0, T.jsx)("span", {
                                  children: presets.length
                                    ? "Fills in today\u2019s counts from the preset. Then change any that are different and tap Save stocktake."
                                    : "No presets yet. Create the usual weekly stocktake in the Stocktake tab.",
                                }),
                              ],
                            }),
                            (0, T.jsxs)("div", {
                              className: "preset-buttons",
                              children: [
                                ...presets.map((P) =>
                                  (0, T.jsxs)(
                                    "button",
                                    { className: "preset-load", disabled: A, onClick: () => loadPreset(P), children: ["Load ", (0, T.jsx)("strong", { children: P.name })] },
                                    P.id,
                                  ),
                                ),
                                (0, T.jsx)("button", {
                                  className: "secondary",
                                  onClick: () => (stDirty && saveStock(), u("stocktake")),
                                  children: presets.length ? "Edit presets" : "Go to Stocktake",
                                }),
                              ],
                            }),
                          ],
                        }),
                        (0, T.jsxs)("div", {
                          className: "search",
                          children: [
                            (0, T.jsx)(E0, { size: 20 }),
                            (0, T.jsx)("input", {
                              placeholder: "Find an item…",
                              value: invQ,
                              onChange: (G) => setInvQ(G.target.value),
                              "aria-label": "Find an item to count",
                            }),
                          ],
                        }),
                        // Heading and subheading buttons, the same as the checkout
                        xt.length > 0 &&
                          (0, T.jsxs)("div", {
                            className: "category-browser inventory-browser",
                            children: [
                              (0, T.jsxs)("div", {
                                className: "category-chips",
                                "aria-label": "Show heading",
                                children: [
                                  (0, T.jsx)("button", {
                                    "aria-pressed": invCat === "all",
                                    onClick: () => (setInvCat("all"), setInvSub("all")),
                                    children: "All items",
                                  }),
                                  xt.map((G) =>
                                    (0, T.jsx)(
                                      "button",
                                      { "aria-pressed": invCat === G.id, onClick: () => (setInvCat(G.id), setInvSub("all")), children: G.name },
                                      G.id,
                                    ),
                                  ),
                                ],
                              }),
                              invCat !== "all" &&
                                t.categories.some((G) => G.parent_id === invCat) &&
                                (0, T.jsxs)("div", {
                                  className: "category-chips subcategory-chips",
                                  "aria-label": "Show subheading",
                                  children: [
                                    (0, T.jsxs)("button", {
                                      "aria-pressed": invSub === "all",
                                      onClick: () => setInvSub("all"),
                                      children: ["All ", t.categories.find((G) => G.id === invCat)?.name],
                                    }),
                                    t.categories
                                      .filter((G) => G.parent_id === invCat)
                                      .map((G) =>
                                        (0, T.jsx)(
                                          "button",
                                          { "aria-pressed": invSub === G.id, onClick: () => setInvSub(G.id), children: G.name },
                                          G.id,
                                        ),
                                      ),
                                  ],
                                }),
                            ],
                          }),
                        at.length
                          ? invGroups.length
                            ? (0, T.jsx)("div", {
                                className: "stock-list",
                                children: invGroups.map((g, gi) =>
                                  (0, T.jsxs)(
                                    "section",
                                    {
                                      className: "stock-group",
                                      children: [
                                        (gi === 0 || invGroups[gi - 1].heading !== g.heading) && (0, T.jsx)("h2", { children: g.heading }),
                                        g.subcategory && (0, T.jsx)("h3", { className: "subcategory-heading", children: g.subcategory }),
                                        (0, T.jsxs)("div", {
                                          className: "stock-table",
                                          children: [
                                            (0, T.jsxs)("div", {
                                              className: "stock-row stock-head",
                                              children: [
                                                (0, T.jsx)("span", { children: "Item" }),
                                                (0, T.jsx)("span", { children: "Start count" }),
                                                (0, T.jsx)("span", { children: "Sold" }),
                                                (0, T.jsx)("span", { children: "Left" }),
                                              ],
                                            }),
                                            g.products.map((P) => {
                                              let startN = stCounts(stDraft)[P.id] || 0,
                                                soldN = soldToday[P.id] || 0,
                                                leftN = Math.max(0, startN - soldN);
                                              return (0, T.jsxs)(
                                                "div",
                                                {
                                                  className: "stock-row" + (leftN < 1 ? " is-empty" : ""),
                                                  children: [
                                                    (0, T.jsxs)("span", {
                                                      className: "stock-name",
                                                      children: [
                                                        (0, T.jsx)("strong", { children: P.name }),
                                                        (0, T.jsx)("small", { children: ln(P.price) }),
                                                      ],
                                                    }),
                                                    (0, T.jsx)("span", {
                                                      children: (0, T.jsx)("input", {
                                                        type: "number",
                                                        inputMode: "numeric",
                                                        min: "0",
                                                        step: "1",
                                                        placeholder: "0",
                                                        "aria-label": "Start count for " + P.name,
                                                        value: stDraft[P.id] ?? "",
                                                        onChange: (G) => {
                                                          let v = G.target.value;
                                                          (setStDraft((d) => ({ ...d, [P.id]: v })), setStMsg(""));
                                                        },
                                                      }),
                                                    }),
                                                    (0, T.jsx)("span", { className: "stock-num", children: soldN }),
                                                    (0, T.jsx)("span", {
                                                      className: "stock-num" + (leftN < 1 ? " none" : ""),
                                                      children: leftN < 1 ? "No stock" : leftN,
                                                    }),
                                                  ],
                                                },
                                                P.id,
                                              );
                                            }),
                                          ],
                                        }),
                                      ],
                                    },
                                    g.id,
                                  ),
                                ),
                              })
                            : (0, T.jsxs)("div", {
                                className: "welcome",
                                children: [
                                  (0, T.jsx)("h2", { children: "No items match" }),
                                  (0, T.jsx)("button", {
                                    className: "text-button",
                                    onClick: () => (setInvQ(""), setInvCat("all"), setInvSub("all")),
                                    children: "Show all items",
                                  }),
                                ],
                              })
                          : (0, T.jsxs)("div", {
                              className: "welcome",
                              children: [
                                (0, T.jsx)("h2", { children: "No items yet" }),
                                (0, T.jsx)("p", { children: "Add items in the Editing tab first." }),
                              ],
                            }),
                        // Save bar
                        (0, T.jsxs)("div", {
                          className: "stock-save-bar",
                          children: [
                            (0, T.jsx)("span", {
                              className:
                                "stock-save-status" + (stMsg && stMsg !== "saved" && !stMsg.startsWith("preset") ? " error" : ""),
                              children:
                                stMsg.startsWith("preset:") && stDirty
                                  ? "Loaded \u201c" + stMsg.slice(7) + "\u201d \u2014 check the counts, then Save stocktake"
                                  : stMsg.startsWith("presetSaved:")
                                    ? "Saved preset \u201c" + stMsg.slice(12) + "\u201d" + (stDirty ? " \u2014 today\u2019s stocktake not saved yet" : "")
                                    : stMsg && stMsg !== "saved" && !stMsg.startsWith("preset")
                                      ? stMsg
                                      : stDirty
                                    ? "Unsaved changes"
                                    : stToday
                                      ? "Stocktake saved"
                                      : "No stocktake saved for today yet",
                            }),
                            (0, T.jsx)("button", {
                              className: "primary",
                              disabled: A || (!stDirty && !!stToday),
                              onClick: saveStock,
                              children: A ? "Saving…" : "Save stocktake",
                            }),
                          ],
                        }),
                      ],
                    }),
              ],
            }),
          }),
          (0, T.jsx)(j0, {
            value: "stocktake",
            children: (0, T.jsxs)("section", {
              className: "page inventory-page stocktake-page",
              children: !stkOk
                ? [stkHead, lockForm("stocktake")]
                : [
                stkHead,
                (0, T.jsx)("div", {
                  className: "notice",
                  children:
                    "Save the usual weekly stocktake here as a preset. Each market day, load it in the Inventory tab, then adjust the counts for that day.",
                }),
                // Preset chooser
                (0, T.jsxs)("div", {
                  className: "stk-presets",
                  children: [
                    (0, T.jsx)("p", { className: "sale-step", children: "Presets" }),
                    (0, T.jsxs)("div", {
                      className: "category-chips",
                      children: [
                        ...presets.map((P) =>
                          (0, T.jsx)(
                            "button",
                            { "aria-pressed": stkSel === P.id, disabled: A, onClick: () => openPreset(P.id), children: P.name },
                            P.id,
                          ),
                        ),
                        (0, T.jsxs)("button", {
                          "aria-pressed": stkSel === "new",
                          className: "stk-new",
                          disabled: A,
                          onClick: () => openPreset("new", {}, presets.length ? "" : "Usual weekly stocktake"),
                          children: [(0, T.jsx)(ts, { size: 16 }), "New preset"],
                        }),
                      ],
                    }),
                  ],
                }),
                // Copy from a day that was already counted (e.g. today's West End stocktake)
                savedDays.length > 0 &&
                  (0, T.jsxs)("details", {
                    className: "stk-copy",
                    open: !presets.length,
                    children: [
                      (0, T.jsx)("summary", { children: "Copy counts from a saved day’s stocktake" }),
                      (0, T.jsx)("p", {
                        className: "muted",
                        children: presets.length
                          ? "Copies that day’s starting counts into the preset below (or a new one), ready to check and save."
                          : "Start your base preset from a stocktake you have already entered.",
                      }),
                      (0, T.jsx)("div", {
                        className: "stk-copy-list",
                        children: savedDays.slice(0, 12).map((x) =>
                          (0, T.jsxs)(
                            "button",
                            {
                              className: "secondary",
                              disabled: A,
                              onClick: () =>
                                stkSel && stkSel !== ""
                                  ? (setStkDraft(Object.fromEntries(Object.entries(x.counts).map(([k, v]) => [k, String(v)]))),
                                    stkSel === "new" && !stkName.trim() && setStkName(x.market + " weekly stocktake"),
                                    setStkMsg("copied:" + lsDayLabel(x.date) + " · " + x.market))
                                  : (openPreset("new", x.counts, x.market + " weekly stocktake"), setStkMsg("copied:" + lsDayLabel(x.date) + " · " + x.market)),
                              children: [
                                (0, T.jsx)("strong", { children: x.market }),
                                (0, T.jsxs)("span", {
                                  children: [lsDayLabel(x.date), " · ", Object.values(x.counts).filter((v) => v > 0).length, " items"],
                                }),
                              ],
                            },
                            x.id,
                          ),
                        ),
                      }),
                    ],
                  }),
                !stkSel
                  ? (0, T.jsxs)("div", {
                      className: "welcome",
                      children: [
                        (0, T.jsx)(LsClipboard, { size: 40, style: { margin: "auto" } }),
                        (0, T.jsx)("h2", { children: "No presets yet" }),
                        (0, T.jsx)("p", {
                          children: savedDays.length
                            ? "Copy a saved day’s stocktake above, or start a new blank preset."
                            : "Start a new preset and enter the usual stock for a market day.",
                        }),
                        (0, T.jsxs)("button", {
                          className: "primary",
                          onClick: () => openPreset("new", {}, "Usual weekly stocktake"),
                          children: [(0, T.jsx)(ts, {}), "New preset"],
                        }),
                      ],
                    })
                  : (0, T.jsxs)(T.Fragment, {
                      children: [
                        (0, T.jsxs)("div", {
                          className: "stk-name-row",
                          children: [
                            (0, T.jsxs)("label", {
                              className: "field",
                              children: [
                                "Preset name",
                                (0, T.jsx)("input", {
                                  value: stkName,
                                  maxLength: 60,
                                  autoComplete: "off",
                                  placeholder: "e.g. Usual weekly stocktake",
                                  onChange: (G) => (setStkName(G.target.value), setStkMsg("")),
                                }),
                              ],
                            }),
                            stkSel !== "new" &&
                              stkPreset &&
                              (0, T.jsxs)("button", {
                                className: "danger-outline",
                                disabled: A,
                                onClick: () => Gr({ kind: "preset", item: { id: stkPreset.id, name: stkPreset.name } }),
                                children: [(0, T.jsx)(yd, {}), "Delete preset"],
                              }),
                          ],
                        }),
                        (0, T.jsxs)("div", {
                          className: "search",
                          children: [
                            (0, T.jsx)(E0, { size: 20 }),
                            (0, T.jsx)("input", {
                              placeholder: "Find an item…",
                              value: stkQ,
                              onChange: (G) => setStkQ(G.target.value),
                              "aria-label": "Find an item in the preset",
                            }),
                          ],
                        }),
                        xt.length > 0 &&
                          (0, T.jsxs)("div", {
                            className: "category-browser inventory-browser",
                            children: [
                              (0, T.jsxs)("div", {
                                className: "category-chips",
                                children: [
                                  (0, T.jsx)("button", {
                                    "aria-pressed": stkCat === "all",
                                    onClick: () => (setStkCat("all"), setStkSub("all")),
                                    children: "All items",
                                  }),
                                  xt.map((G) =>
                                    (0, T.jsx)(
                                      "button",
                                      { "aria-pressed": stkCat === G.id, onClick: () => (setStkCat(G.id), setStkSub("all")), children: G.name },
                                      G.id,
                                    ),
                                  ),
                                ],
                              }),
                              stkCat !== "all" &&
                                t.categories.some((G) => G.parent_id === stkCat) &&
                                (0, T.jsxs)("div", {
                                  className: "category-chips subcategory-chips",
                                  children: [
                                    (0, T.jsxs)("button", {
                                      "aria-pressed": stkSub === "all",
                                      onClick: () => setStkSub("all"),
                                      children: ["All ", t.categories.find((G) => G.id === stkCat)?.name],
                                    }),
                                    t.categories
                                      .filter((G) => G.parent_id === stkCat)
                                      .map((G) =>
                                        (0, T.jsx)(
                                          "button",
                                          { "aria-pressed": stkSub === G.id, onClick: () => setStkSub(G.id), children: G.name },
                                          G.id,
                                        ),
                                      ),
                                  ],
                                }),
                            ],
                          }),
                        at.length
                          ? stkGroups.length
                            ? (0, T.jsx)("div", {
                                className: "stock-list",
                                children: stkGroups.map((g, gi) =>
                                  (0, T.jsxs)(
                                    "section",
                                    {
                                      className: "stock-group",
                                      children: [
                                        (gi === 0 || stkGroups[gi - 1].heading !== g.heading) && (0, T.jsx)("h2", { children: g.heading }),
                                        g.subcategory && (0, T.jsx)("h3", { className: "subcategory-heading", children: g.subcategory }),
                                        (0, T.jsxs)("div", {
                                          className: "stock-table",
                                          children: [
                                            (0, T.jsxs)("div", {
                                              className: "stock-row stk-row stock-head",
                                              children: [(0, T.jsx)("span", { children: "Item" }), (0, T.jsx)("span", { children: "Usual count" })],
                                            }),
                                            g.products.map((P) =>
                                              (0, T.jsxs)(
                                                "div",
                                                {
                                                  className: "stock-row stk-row",
                                                  children: [
                                                    (0, T.jsxs)("span", {
                                                      className: "stock-name",
                                                      children: [(0, T.jsx)("strong", { children: P.name }), (0, T.jsx)("small", { children: ln(P.price) })],
                                                    }),
                                                    (0, T.jsx)("span", {
                                                      children: (0, T.jsx)("input", {
                                                        type: "number",
                                                        inputMode: "numeric",
                                                        min: "0",
                                                        step: "1",
                                                        placeholder: "0",
                                                        "aria-label": "Preset count for " + P.name,
                                                        value: stkDraft[P.id] ?? "",
                                                        onChange: (G) => {
                                                          let v = G.target.value;
                                                          (setStkDraft((d) => ({ ...d, [P.id]: v })), setStkMsg(""));
                                                        },
                                                      }),
                                                    }),
                                                  ],
                                                },
                                                P.id,
                                              ),
                                            ),
                                          ],
                                        }),
                                      ],
                                    },
                                    g.id,
                                  ),
                                ),
                              })
                            : (0, T.jsxs)("div", {
                                className: "welcome",
                                children: [
                                  (0, T.jsx)("h2", { children: "No items match" }),
                                  (0, T.jsx)("button", {
                                    className: "text-button",
                                    onClick: () => (setStkQ(""), setStkCat("all"), setStkSub("all")),
                                    children: "Show all items",
                                  }),
                                ],
                              })
                          : (0, T.jsxs)("div", {
                              className: "welcome",
                              children: [(0, T.jsx)("h2", { children: "No items yet" }), (0, T.jsx)("p", { children: "Add items in the Editing tab first." })],
                            }),
                        (0, T.jsxs)("div", {
                          className: "stock-save-bar",
                          children: [
                            (0, T.jsx)("span", {
                              className:
                                "stock-save-status" + (stkMsg && stkMsg !== "saved" && !stkMsg.startsWith("copied:") ? " error" : ""),
                              children: stkMsg.startsWith("copied:")
                                ? "Copied counts from " + stkMsg.slice(7) + " — check them, then Save preset"
                                : stkMsg && stkMsg !== "saved"
                                  ? stkMsg
                                  : stkDirty
                                    ? "Unsaved changes"
                                    : stkMsg === "saved"
                                      ? "Preset saved"
                                      : stkPreset
                                        ? Object.values(stkPreset.counts).filter((v) => v > 0).length + " items in this preset"
                                        : "New preset",
                            }),
                            (0, T.jsx)("button", {
                              className: "primary",
                              disabled: A || !stkDirty,
                              onClick: saveStk,
                              children: A ? "Saving…" : "Save preset",
                            }),
                          ],
                        }),
                      ],
                    }),
              ],
            }),
          }),
          (0, T.jsx)(j0, {
            value: "editing",
            children: (0, T.jsxs)("section", {
              className: "page editing-page",
              // Locked: just the heading and the password screen
              children: !editOk
                ? [editHead, lockForm("editing")]
                : [
                editHead,
                (0, T.jsx)("div", {
                  className: "notice",
                  children:
                    "Set up your items, headings and markets here, outside of trading hours. Changes appear on the checkout straight away.",
                }),
                // Section switcher
                (0, T.jsx)("div", {
                  className: "category-chips editing-sections",
                  role: "tablist",
                  "aria-label": "Editing sections",
                  children: [
                    ["items", "Items", Du],
                    ["headings", "Headings", Ou],
                    ["markets", "Markets", LsMapPin],
                  ].map(([key, label, Icon]) =>
                    (0, T.jsxs)(
                      "button",
                      {
                        role: "tab",
                        "aria-selected": es === key,
                        "aria-pressed": es === key,
                        onClick: () => setEs(key),
                        children: [(0, T.jsx)(Icon, { size: 18 }), label],
                      },
                      key,
                    ),
                  ),
                }),
                // ---------- Items ----------
                es === "items" &&
                  (0, T.jsxs)("div", {
                    className: "editing-section",
                    children: [
                      (0, T.jsxs)("div", {
                        className: "editing-section-heading",
                        children: [
                          (0, T.jsx)("h2", { children: "Items" }),
                          (0, T.jsxs)("button", {
                            className: "primary",
                            onClick: () => Sn(),
                            disabled: !r,
                            children: [(0, T.jsx)(ts, {}), "Add item"],
                          }),
                        ],
                      }),
                      t.products.length
                        ? (0, T.jsx)("div", {
                            className: "table-wrap",
                            children: (0, T.jsxs)(nE, {
                              children: [
                                (0, T.jsx)(iE, {
                                  children: (0, T.jsxs)(X0, {
                                    children: [
                                      (0, T.jsx)(As, { children: "Item" }),
                                      (0, T.jsx)(As, { children: "Heading" }),
                                      (0, T.jsx)(As, { children: "Price" }),
                                      (0, T.jsx)(As, {
                                        children: (0, T.jsx)("span", { className: "sr-only", children: "Edit" }),
                                      }),
                                    ],
                                  }),
                                }),
                                (0, T.jsx)(oE, {
                                  children: t.products.map((G) =>
                                    (0, T.jsxs)(
                                      X0,
                                      {
                                        className: G.archived ? "item-hidden" : "",
                                        children: [
                                          (0, T.jsx)(ss, {
                                            children: (0, T.jsxs)("div", {
                                              className: "item-name",
                                              children: [
                                                G.image
                                                  ? (0, T.jsx)("img", { className: "thumb", src: G.image, alt: "" })
                                                  : (0, T.jsx)("span", {
                                                      className: "thumb",
                                                      style: { display: "grid", placeItems: "center" },
                                                      children: (0, T.jsx)(Du, {}),
                                                    }),
                                                (0, T.jsxs)("span", {
                                                  children: [
                                                    G.name,
                                                    G.archived
                                                      ? (0, T.jsx)("small", {
                                                          className: "hidden-tag",
                                                          children: "Hidden from checkout",
                                                        })
                                                      : null,
                                                  ],
                                                }),
                                              ],
                                            }),
                                          }),
                                          (0, T.jsx)(ss, {
                                            children:
                                              [qt(G.category_id).heading, qt(G.category_id).subcategory]
                                                .filter(Boolean)
                                                .join(" / ") || "Uncategorised",
                                          }),
                                          (0, T.jsx)(ss, { children: ln(G.price) }),
                                          (0, T.jsx)(ss, {
                                            children: (0, T.jsxs)("div", {
                                              className: "row-actions",
                                              children: [
                                                (0, T.jsx)("button", {
                                                  className: "secondary",
                                                  onClick: () => Sn(G),
                                                  "aria-label": "Edit " + G.name,
                                                  children: "Edit",
                                                }),
                                                (0, T.jsxs)("button", {
                                                  className: "danger-outline",
                                                  onClick: () => Gr({ kind: "product", item: G }),
                                                  "aria-label": "Delete " + G.name,
                                                  children: [(0, T.jsx)(yd, {}), "Delete"],
                                                }),
                                              ],
                                            }),
                                          }),
                                        ],
                                      },
                                      G.id,
                                    ),
                                  ),
                                }),
                              ],
                            }),
                          })
                        : (0, T.jsxs)("div", {
                            className: "welcome",
                            children: [
                              (0, T.jsx)(Du, { size: 40, style: { margin: "auto" } }),
                              (0, T.jsx)("h2", { children: "No items yet" }),
                              (0, T.jsx)("p", { children: "Add each product with its name, price and a photo." }),
                              (0, T.jsxs)("button", {
                                className: "primary",
                                disabled: !r,
                                onClick: () => Sn(),
                                children: [(0, T.jsx)(ts, {}), "Add your first item"],
                              }),
                            ],
                          }),
                    ],
                  }),
                // ---------- Headings & subheadings ----------
                es === "headings" &&
                  (0, T.jsxs)("div", {
                    className: "editing-section",
                    children: [
                      (0, T.jsxs)("div", {
                        className: "editing-section-heading",
                        children: [
                          (0, T.jsx)("h2", { children: "Headings & subheadings" }),
                          (0, T.jsxs)("button", {
                            className: "primary",
                            disabled: !r,
                            onClick: () => Rt(),
                            children: [(0, T.jsx)(ts, {}), "Add heading"],
                          }),
                        ],
                      }),
                      (0, T.jsx)("p", {
                        className: "muted editing-help",
                        children:
                          "Headings group items on the checkout, e.g. Breads. Subheadings sit inside a heading, e.g. Gluten-free bread. Choose an item’s heading when you add or edit it.",
                      }),
                      xt.length
                        ? (0, T.jsx)("div", {
                            className: "category-list",
                            children: xt.map((G) =>
                              (0, T.jsxs)(
                                "section",
                                {
                                  className: "category-panel",
                                  children: [
                                    (0, T.jsxs)("div", {
                                      className: "category-panel-heading",
                                      children: [
                                        (0, T.jsxs)("div", {
                                          children: [
                                            (0, T.jsx)("h2", { children: G.name }),
                                            (0, T.jsx)("p", {
                                              children: Gj(
                                                at.filter(
                                                  (Te) =>
                                                    Te.category_id === G.id ||
                                                    t.categories.some(
                                                      (st) => st.id === Te.category_id && st.parent_id === G.id,
                                                    ),
                                                ).length,
                                              ),
                                            }),
                                          ],
                                        }),
                                        (0, T.jsxs)("div", {
                                          className: "row-actions",
                                          children: [
                                            (0, T.jsx)("button", {
                                              className: "secondary",
                                              onClick: () => Rt(G),
                                              "aria-label": "Rename " + G.name,
                                              children: "Rename",
                                            }),
                                            (0, T.jsxs)("button", {
                                              className: "danger-outline",
                                              onClick: () => Gr({ kind: "category", item: G }),
                                              "aria-label": "Delete " + G.name,
                                              children: [(0, T.jsx)(yd, {}), "Delete"],
                                            }),
                                          ],
                                        }),
                                      ],
                                    }),
                                    t.categories
                                      .filter((Te) => Te.parent_id === G.id)
                                      .map((Te) =>
                                        (0, T.jsxs)(
                                          "div",
                                          {
                                            className: "category-child",
                                            children: [
                                              (0, T.jsxs)("div", {
                                                children: [
                                                  (0, T.jsx)("strong", { children: Te.name }),
                                                  (0, T.jsx)("small", {
                                                    children: Gj(
                                                      at.filter((st) => st.category_id === Te.id).length,
                                                    ),
                                                  }),
                                                ],
                                              }),
                                              (0, T.jsxs)("div", {
                                                className: "row-actions",
                                                children: [
                                                  (0, T.jsx)("button", {
                                                    className: "text-button",
                                                    onClick: () => Rt(Te),
                                                    "aria-label": "Rename " + Te.name,
                                                    children: "Rename",
                                                  }),
                                                  (0, T.jsxs)("button", {
                                                    className: "danger-outline",
                                                    onClick: () => Gr({ kind: "category", item: Te }),
                                                    "aria-label": "Delete " + Te.name,
                                                    children: [(0, T.jsx)(yd, {}), "Delete"],
                                                  }),
                                                ],
                                              }),
                                            ],
                                          },
                                          Te.id,
                                        ),
                                      ),
                                    (0, T.jsxs)("button", {
                                      className: "category-add",
                                      onClick: () => Rt(void 0, G.id),
                                      children: [(0, T.jsx)(ts, {}), "Add subheading"],
                                    }),
                                  ],
                                },
                                G.id,
                              ),
                            ),
                          })
                        : (0, T.jsxs)("div", {
                            className: "welcome",
                            children: [
                              (0, T.jsx)(Ou, { size: 40, style: { margin: "auto" } }),
                              (0, T.jsx)("h2", { children: "Group your items your way" }),
                              (0, T.jsx)("p", {
                                children: "Start with a heading, then add the subheadings you need.",
                              }),
                              (0, T.jsxs)("button", {
                                className: "primary",
                                disabled: !r,
                                onClick: () => Rt(),
                                children: [(0, T.jsx)(ts, {}), "Add your first heading"],
                              }),
                            ],
                          }),
                    ],
                  }),
                // ---------- Markets ----------
                es === "markets" &&
                  (0, T.jsxs)("div", {
                    className: "editing-section",
                    children: [
                      (0, T.jsxs)("div", {
                        className: "editing-section-heading",
                        children: [
                          (0, T.jsx)("h2", { children: "Markets" }),
                          (0, T.jsxs)("button", {
                            className: "primary",
                            disabled: !r,
                            onClick: () => {
                              (setMkErr(""), setMk({ id: "", name: "" }));
                            },
                            children: [(0, T.jsx)(ts, {}), "Add market"],
                          }),
                        ],
                      }),
                      (0, T.jsx)("p", {
                        className: "muted editing-help",
                        children: "These are the markets you can choose from at the checkout.",
                      }),
                      mkts.length
                        ? (0, T.jsx)("section", {
                            className: "category-panel market-list",
                            children: mkts.map((G) =>
                              (0, T.jsxs)(
                                "div",
                                {
                                  className: "category-child",
                                  children: [
                                    (0, T.jsxs)("div", {
                                      className: "market-row-name",
                                      children: [
                                        (0, T.jsx)(LsMapPin, { size: 18 }),
                                        (0, T.jsx)("strong", { children: G.name }),
                                      ],
                                    }),
                                    (0, T.jsxs)("div", {
                                      className: "row-actions",
                                      children: [
                                        (0, T.jsx)("button", {
                                          className: "secondary",
                                          onClick: () => {
                                            (setMkErr(""), setMk(G));
                                          },
                                          "aria-label": "Rename " + G.name,
                                          children: "Rename",
                                        }),
                                        (0, T.jsxs)("button", {
                                          className: "danger-outline",
                                          onClick: () => Gr({ kind: "market", item: G }),
                                          "aria-label": "Delete " + G.name,
                                          children: [(0, T.jsx)(yd, {}), "Delete"],
                                        }),
                                      ],
                                    }),
                                  ],
                                },
                                G.id,
                              ),
                            ),
                          })
                        : (0, T.jsxs)("div", {
                            className: "welcome",
                            children: [
                              (0, T.jsx)(LsMapPin, { size: 40, style: { margin: "auto" } }),
                              (0, T.jsx)("h2", { children: "No markets yet" }),
                              (0, T.jsx)("p", {
                                children: "Add the markets you sell at, e.g. Saturday farmers market.",
                              }),
                              (0, T.jsxs)("button", {
                                className: "primary",
                                disabled: !r,
                                onClick: () => {
                                  (setMkErr(""), setMk({ id: "", name: "" }));
                                },
                                children: [(0, T.jsx)(ts, {}), "Add your first market"],
                              }),
                            ],
                          }),
                    ],
                  }),
              ],
            }),
          }),
          (0, T.jsx)(j0, {
            value: "sales",
            children: (0, T.jsxs)("section", {
              className: "page sales-page",
              children: [
                (0, T.jsxs)("div", {
                  className: "section-heading",
                  children: [
                    (0, T.jsx)("div", {
                      children: [
                        (0, T.jsx)("p", { className: "eyebrow", children: "SALES RECORDS" }),
                        (0, T.jsx)("h1", { children: "Sales" }),
                      ],
                    }),
                    salesOk &&
                      (0, T.jsxs)("div", {
                        className: "row-actions",
                        children: [
                          (0, T.jsx)("button", {
                            className: "secondary",
                            onClick: () => (setPwErr(""), setPwDlg(!0)),
                            children: "Change password",
                          }),
                          (0, T.jsx)("button", { className: "secondary", onClick: () => setSalesOk(!1), children: "Lock" }),
                        ],
                      }),
                  ],
                }),
                !salesOk
                  ? lockForm("sales")
                  : // ---------- Unlocked ----------
                    groups.length
                    ? (0, T.jsxs)(T.Fragment, {
                        children: [
                          (0, T.jsx)("p", { className: "sale-step", children: "Choose a market day" }),
                          (0, T.jsx)("div", {
                            className: "category-chips day-chips",
                            children: groups.map((g) =>
                              (0, T.jsxs)(
                                "button",
                                {
                                  "aria-pressed": grp && g.key === grp.key,
                                  onClick: () => setSelGrp(g.key),
                                  children: [(0, T.jsx)("strong", { children: lsDayLabel(g.day) }), (0, T.jsx)("span", { children: g.market })],
                                },
                                g.key,
                              ),
                            ),
                          }),
                          grp &&
                            (() => {
                              let daySales = grp.sales,
                                tk = daySales.reduce((a2, x2) => a2 + x2.total, 0),
                                it2 = daySales.reduce((a2, x2) => a2 + x2.lines.reduce((b2, l2) => b2 + l2.qty, 0), 0),
                                dc = daySales.reduce((a2, x2) => a2 + (x2.discount_amount || 0), 0);
                              return (0, T.jsxs)(T.Fragment, {
                                children: [
                                  (0, T.jsxs)("h2", { className: "sales-day-title", children: [lsDayLabel(grp.day), " \xB7 ", grp.market] }),
                                  (0, T.jsx)("div", {
                                    className: "stats",
                                    children: [
                                      ["Takings", ln(tk)],
                                      ["Sales", daySales.length],
                                      ["Items sold", it2],
                                      ["Discounts given", ln(dc)],
                                    ].map(([k2, v2]) =>
                                      (0, T.jsxs)(
                                        "div",
                                        { className: "stat", children: [(0, T.jsx)("p", { children: k2 }), (0, T.jsx)("strong", { children: v2 })] },
                                        k2,
                                      ),
                                    ),
                                  }),
                                  (0, T.jsx)("p", { className: "sale-step", children: "Download sheets (PDF)" }),
                                  (0, T.jsx)("div", {
                                    className: "export-buttons",
                                    children: [
                                      ["overall", "Overall sales of the day"],
                                      ["discounts", "Discounted sales"],
                                      ["sellout", "Sell-out report"],
                                    ].map(([k2, lbl]) =>
                                      (0, T.jsxs)(
                                        "button",
                                        {
                                          className: k2 === "overall" ? "primary" : "secondary",
                                          onClick: () => makePdf(k2, grp),
                                          children: [(0, T.jsx)(zo, {}), lbl],
                                        },
                                        k2,
                                      ),
                                    ),
                                  }),
                                  (0, T.jsx)("h2", { style: { marginTop: 28 }, children: "Sales on this day" }),
                                  (0, T.jsx)("div", {
                                    className: "table-wrap",
                                    children: (0, T.jsxs)(nE, {
                                      children: [
                                        (0, T.jsx)(iE, {
                                          children: (0, T.jsxs)(X0, {
                                            children: ["Time", "Items", "Payment", "Discount", "Total", ""].map((h2, hi) =>
                                              (0, T.jsx)(As, { children: h2 }, hi),
                                            ),
                                          }),
                                        }),
                                        (0, T.jsx)(oE, {
                                          children: [...daySales]
                                            .sort((a2, b2) => b2.at.localeCompare(a2.at))
                                            .map((x2) =>
                                              (0, T.jsxs)(
                                                X0,
                                                {
                                                  children: [
                                                    (0, T.jsx)(ss, { children: lsTime(x2.at) }),
                                                    (0, T.jsx)(ss, { children: x2.lines.reduce((b2, l2) => b2 + l2.qty, 0) }),
                                                    (0, T.jsx)(ss, { children: lsMethod(x2.method) }),
                                                    (0, T.jsx)(ss, {
                                                      children: lsIsDiscounted(x2)
                                                        ? lsDiscountLabel(x2) + (x2.staff_name ? " \xB7 " + x2.staff_name : "")
                                                        : "—",
                                                    }),
                                                    (0, T.jsx)(ss, { children: ln(x2.total) }),
                                                    (0, T.jsx)(ss, {
                                                      children: (0, T.jsx)("button", { className: "secondary", onClick: () => k(x2), children: "View" }),
                                                    }),
                                                  ],
                                                },
                                                x2.id,
                                              ),
                                            ),
                                        }),
                                      ],
                                    }),
                                  }),
                                  (0, T.jsxs)("div", {
                                    className: "sales-danger",
                                    children: [
                                      (0, T.jsxs)("button", {
                                        className: "danger-outline",
                                        onClick: () =>
                                          Gr({
                                            kind: "sales-day",
                                            item: { id: grp.key, name: "sales for " + lsDayLabel(grp.day) + " \xB7 " + grp.market, day: grp.day, market: grp.market },
                                          }),
                                        children: [(0, T.jsx)(yd, {}), "Delete this day’s sales"],
                                      }),
                                      (0, T.jsxs)("button", {
                                        className: "danger-outline",
                                        onClick: () => Gr({ kind: "sales-all", item: { id: "all", name: "all sales" } }),
                                        children: [(0, T.jsx)(yd, {}), "Delete all sales"],
                                      }),
                                    ],
                                  }),
                                ],
                              });
                            })(),
                        ],
                      })
                    : (0, T.jsxs)("div", {
                        className: "welcome",
                        children: [
                          (0, T.jsx)(Hp, { size: 36, style: { margin: "auto" } }),
                          (0, T.jsx)("h2", { children: "No sales recorded" }),
                          (0, T.jsx)("p", { children: "Completed sales will appear here, grouped by day and market." }),
                        ],
                      }),
              ],
            }),
          }),
        ],
      }),
      (0, T.jsx)(Md, {
        open: !!C,
        onOpenChange: (G) => {
          !G && !A && x(null);
        },
        children: (0, T.jsxs)(Hd, {
          className: "dialog-box",
          children: [
            (0, T.jsx)(qd, { children: C?.id ? "Edit item" : "Add a new item" }),
            (0, T.jsx)(zd, { children: "Use a clear photo so it\u2019s easy to find at checkout." }),
            C &&
              (0, T.jsxs)("form", {
                onSubmit: $n,
                className: "form-grid",
                children: [
                  (0, T.jsxs)("label", {
                    className: "field wide",
                    children: [
                      "Item name",
                      (0, T.jsx)("input", {
                        name: "name",
                        autoFocus: !0,
                        required: !0,
                        maxLength: 100,
                        defaultValue: C.name,
                        placeholder: "e.g. Free-range eggs",
                      }),
                    ],
                  }),
                  (0, T.jsxs)("label", {
                    className: "field",
                    children: [
                      "Selling price",
                      (0, T.jsx)("input", {
                        name: "price",
                        required: !0,
                        type: "number",
                        inputMode: "decimal",
                        min: "0",
                        max: "1000000",
                        step: "0.01",
                        defaultValue: C.id ? (C.price / 100).toFixed(2) : "",
                        placeholder: "0.00",
                      }),
                    ],
                  }),
                  (0, T.jsxs)("div", {
                    className: "field wide category-fields",
                    children: [
                      (0, T.jsx)("label", { htmlFor: "item-heading", children: "Heading (optional)" }),
                      (0, T.jsxs)(Y0, {
                        value: ia,
                        onValueChange: (G) => x({ ...C, category_id: G === "none" ? null : G }),
                        children: [
                          (0, T.jsx)(J0, {
                            id: "item-heading",
                            className: "category-select",
                            children: (0, T.jsx)(Z0, {}),
                          }),
                          (0, T.jsxs)($0, {
                            position: "popper",
                            children: [
                              (0, T.jsx)(kl, { value: "none", children: "Uncategorised" }),
                              xt.map((G) => (0, T.jsx)(kl, { value: G.id, children: G.name }, G.id)),
                            ],
                          }),
                        ],
                      }),
                      ia !== "none" &&
                        t.categories.some((G) => G.parent_id === ia) &&
                        (0, T.jsxs)(T.Fragment, {
                          children: [
                            (0, T.jsx)("label", {
                              htmlFor: "item-subcategory",
                              children: "Subheading (optional)",
                            }),
                            (0, T.jsxs)(Y0, {
                              value: Vt?.parent_id ? Vt.id : "none",
                              onValueChange: (G) => x({ ...C, category_id: G === "none" ? ia : G }),
                              children: [
                                (0, T.jsx)(J0, {
                                  id: "item-subcategory",
                                  className: "category-select",
                                  children: (0, T.jsx)(Z0, {}),
                                }),
                                (0, T.jsxs)($0, {
                                  position: "popper",
                                  children: [
                                    (0, T.jsx)(kl, { value: "none", children: "No subheading" }),
                                    t.categories
                                      .filter((G) => G.parent_id === ia)
                                      .map((G) => (0, T.jsx)(kl, { value: G.id, children: G.name }, G.id)),
                                  ],
                                }),
                              ],
                            }),
                          ],
                        }),
                      (0, T.jsx)("button", {
                        type: "button",
                        className: "text-button category-manage-link",
                        onClick: () => {
                          (x(null), u("editing"), setEs("headings"));
                        },
                        children: "Manage headings & subheadings",
                      }),
                    ],
                  }),
                  (0, T.jsxs)("label", {
                    className: "field wide",
                    children: [
                      "Item photo (optional)",
                      (0, T.jsxs)("div", {
                        className: "photo-field",
                        children: [
                          D || C.image
                            ? (0, T.jsx)("img", {
                                className: "photo-preview",
                                src: D || C.image,
                                alt: "Item preview",
                              })
                            : (0, T.jsx)(S0, { size: 34 }),
                          (0, T.jsx)("input", {
                            type: "file",
                            accept: "image/jpeg,image/png,image/webp",
                            onChange: (G) => {
                              let Te = G.target.files?.[0];
                              if (Te && Te.size > 5e6) {
                                (ee("Choose a photo smaller than 5 MB."), (G.target.value = ""));
                                return;
                              }
                              (ne(Te || null), ee(""));
                            },
                          }),
                        ],
                      }),
                      (0, T.jsx)("span", {
                        className: "muted",
                        style: { fontWeight: 400 },
                        children: "JPEG, PNG or WebP \xB7 up to 5 MB",
                      }),
                    ],
                  }),
                  C.id &&
                    (0, T.jsxs)("label", {
                      className: "wide",
                      style: { display: "flex", alignItems: "center", gap: 12, minHeight: 44, fontSize: 14 },
                      children: [
                        (0, T.jsx)(LM, {
                          checked: !!C.archived,
                          onCheckedChange: (G) => x({ ...C, archived: G ? 1 : 0 }),
                        }),
                        "Hide this item from the checkout",
                      ],
                    }),
                  te &&
                    (0, T.jsxs)("p", {
                      role: "alert",
                      className: "wide",
                      style: { color: "#a12f35" },
                      children: [
                        te,
                        " ",
                        (0, T.jsx)("button", {
                          type: "button",
                          className: "text-button",
                          onClick: wt,
                          children: "Refresh shop",
                        }),
                      ],
                    }),
                  (0, T.jsxs)("div", {
                    className: "dialog-actions wide",
                    children: [
                      (0, T.jsx)("button", {
                        type: "button",
                        className: "secondary",
                        disabled: A,
                        onClick: () => x(null),
                        children: "Cancel",
                      }),
                      (0, T.jsx)("button", {
                        className: "primary",
                        disabled: A,
                        children: A ? "Saving\u2026" : "Save item",
                      }),
                    ],
                  }),
                ],
              }),
          ],
        }),
      }),
      (0, T.jsx)(Md, {
        open: !!ge,
        onOpenChange: (G) => {
          !G && !A && me(null);
        },
        children: (0, T.jsxs)(Hd, {
          className: "dialog-box",
          children: [
            (0, T.jsx)(qd, {
              children: ge?.id ? "Rename" : ge?.parent_id ? "Add subheading" : "Add heading",
            }),
            (0, T.jsx)(zd, {
              children: ge?.parent_id
                ? `Under ${t.categories.find((G) => G.id === ge.parent_id)?.name}`
                : "Headings group your items at checkout.",
            }),
            ge &&
              (0, T.jsxs)("form", {
                onSubmit: Or,
                children: [
                  (0, T.jsxs)("label", {
                    className: "field",
                    children: [
                      ge.parent_id ? "Subheading name" : "Heading name",
                      (0, T.jsx)("input", {
                        name: "categoryName",
                        autoFocus: !0,
                        required: !0,
                        maxLength: 80,
                        defaultValue: ge.name,
                        placeholder: ge.parent_id ? "e.g. Gluten-free bread" : "e.g. Breads",
                      }),
                    ],
                  }),
                  _e &&
                    (0, T.jsxs)("p", {
                      role: "alert",
                      style: { color: "#a12f35", margin: "16px 0" },
                      children: [
                        _e,
                        (0, T.jsx)("button", {
                          type: "button",
                          className: "text-button",
                          onClick: wt,
                          children: "Refresh shop",
                        }),
                      ],
                    }),
                  (0, T.jsxs)("div", {
                    className: "dialog-actions",
                    children: [
                      (0, T.jsx)("button", {
                        type: "button",
                        className: "secondary",
                        disabled: A,
                        onClick: () => me(null),
                        children: "Cancel",
                      }),
                      (0, T.jsx)("button", {
                        className: "primary",
                        disabled: A,
                        children: A ? "Saving\u2026" : "Save " + (ge.parent_id ? "subheading" : "heading"),
                      }),
                    ],
                  }),
                ],
              }),
          ],
        }),
      }),
      (0, T.jsx)(AE, {
        open: !!Y,
        onOpenChange: (G) => {
          !G && !A && ae(null);
        },
        children: (0, T.jsxs)(sE, {
          className: "dialog-box",
          children: [
            (0, T.jsxs)(uE, { children: ["Delete ", Y?.item.name, "?"] }),
            (0, T.jsx)(cE, { children: jr }),
            Ae &&
              (0, T.jsxs)("p", {
                role: "alert",
                className: "delete-error",
                children: [
                  Ae,
                  (0, T.jsx)("button", {
                    className: "text-button",
                    disabled: A,
                    onClick: async () => {
                      (await wt(), ae(null));
                    },
                    children: "Refresh shop",
                  }),
                ],
              }),
            (0, T.jsxs)(lE, {
              children: [
                (0, T.jsx)(dE, { disabled: A, className: "secondary", children: "Cancel" }),
                (0, T.jsx)(fE, {
                  variant: "destructive",
                  disabled: A,
                  className: "danger-button",
                  onClick: (G) => {
                    (G.preventDefault(), Kt());
                  },
                  children: A
                    ? "Deleting\u2026"
                    : "Delete " +
                      (Y?.kind === "product"
                        ? "item"
                        : Y?.kind === "preset"
                          ? "preset"
                        : Y?.kind === "market"
                          ? "market"
                          : Y?.kind === "sales-day"
                            ? "these sales"
                            : Y?.kind === "sales-all"
                              ? "all sales"
                              : Y?.kind === "reset-sales"
                                ? "sales and reset"
                          : Y?.kind === "category" && Y.item.parent_id
                            ? "subheading"
                            : "heading"),
                }),
              ],
            }),
          ],
        }),
      }),
      (0, T.jsx)(AE, {
        open: !!At,
        onOpenChange: (G) => {
          !G && !A && Nt(null);
        },
        children: (0, T.jsxs)(sE, {
          className: "dialog-box",
          children: [
            (0, T.jsx)(uE, { children: "Restore this backup?" }),
            (0, T.jsxs)(cE, {
              children: [
                "This replaces everything on this device with the backup, which has ",
                At?.products.length,
                " items and ",
                (At?.markets || []).length,
                " markets. Save a backup of your current setup first.",
              ],
            }),
            (0, T.jsxs)(lE, {
              children: [
                (0, T.jsx)(dE, { className: "secondary", disabled: A, children: "Cancel" }),
                (0, T.jsx)("button", {
                  className: "secondary",
                  disabled: A,
                  onClick: () => Nw(t),
                  children: "Save current backup",
                }),
                (0, T.jsx)(fE, {
                  className: "primary",
                  disabled: A,
                  onClick: async (G) => {
                    if ((G.preventDefault(), !(!At || ut.current))) {
                      ((ut.current = !0), s(!0));
                      try {
                        let Te = await ZO(At, t.revision);
                        (a(Te), B({}), (Gt.current = ""), Nt(null), o(""));
                      } catch (Te) {
                        (o(Te.message), Nt(null));
                      } finally {
                        ((ut.current = !1), s(!1));
                      }
                    }
                  },
                  children: "Restore backup",
                }),
              ],
            }),
          ],
        }),
      }),
      // Market picker (checkout only): choose from the preset markets set up in Editing
      (0, T.jsx)(Md, {
        open: be && (l === "checkout" || l === "inventory") && r,
        onOpenChange: (G) => {
          ve && Ue(G);
        },
        children: (0, T.jsxs)(Hd, {
          className: "dialog-box market-picker",
          showCloseButton: !!ve,
          onEscapeKeyDown: (G) => {
            ve || G.preventDefault();
          },
          onInteractOutside: (G) => {
            ve || G.preventDefault();
          },
          children: [
            (0, T.jsx)(qd, { children: ve ? "Change market" : "Which market are you selling at?" }),
            (0, T.jsx)(zd, {
              children: mkts.length
                ? "Tap your market to start selling."
                : "No markets have been set up yet.",
            }),
            mkts.length
              ? (0, T.jsx)("div", {
                  className: "market-options",
                  children: mkts.map((G) =>
                    (0, T.jsxs)(
                      "button",
                      {
                        type: "button",
                        className: "market-option",
                        "aria-pressed": G.name === ve,
                        onClick: () => pickMarket(G.name),
                        children: [
                          (0, T.jsx)(LsMapPin, { size: 20 }),
                          (0, T.jsx)("span", { children: G.name }),
                          G.name === ve ? (0, T.jsx)(md, { size: 20, className: "market-option-check" }) : null,
                        ],
                      },
                      G.id,
                    ),
                  ),
                })
              : (0, T.jsx)("p", {
                  className: "muted",
                  style: { margin: "8px 0 4px" },
                  children: "Add your markets in the Editing tab, then come back to the checkout.",
                }),
            (!!ve || !mkts.length) &&
            (0, T.jsxs)("div", {
              className: "dialog-actions",
              children: [
                ve &&
                  (0, T.jsx)("button", {
                    type: "button",
                    className: "secondary",
                    onClick: () => Ue(!1),
                    children: "Cancel",
                  }),
                !mkts.length &&
                  (0, T.jsx)("button", {
                    type: "button",
                    className: "primary",
                    onClick: () => {
                      (u("editing"), setEs("markets"));
                    },
                    children: "Go to Editing",
                  }),
              ],
            }),
          ],
        }),
      }),
      // Add / rename a market (Editing tab)
      (0, T.jsx)(Md, {
        open: !!mk,
        onOpenChange: (G) => {
          !G && !A && setMk(null);
        },
        children: (0, T.jsxs)(Hd, {
          className: "dialog-box",
          children: [
            (0, T.jsx)(qd, { children: mk?.id ? "Rename market" : "Add market" }),
            (0, T.jsx)(zd, { children: "Markets appear as options when you choose a market at the checkout." }),
            mk &&
              (0, T.jsxs)("form", {
                onSubmit: saveMarket,
                children: [
                  (0, T.jsxs)("label", {
                    className: "field",
                    children: [
                      "Market name",
                      (0, T.jsx)("input", {
                        name: "marketName",
                        autoFocus: !0,
                        required: !0,
                        maxLength: 100,
                        defaultValue: mk.name,
                        placeholder: "e.g. Saturday farmers market",
                      }),
                    ],
                  }),
                  mkErr &&
                    (0, T.jsx)("p", { role: "alert", style: { color: "#a12f35", margin: "16px 0" }, children: mkErr }),
                  (0, T.jsxs)("div", {
                    className: "dialog-actions",
                    children: [
                      (0, T.jsx)("button", {
                        type: "button",
                        className: "secondary",
                        disabled: A,
                        onClick: () => setMk(null),
                        children: "Cancel",
                      }),
                      (0, T.jsx)("button", {
                        className: "primary",
                        disabled: A,
                        children: A ? "Saving…" : "Save market",
                      }),
                    ],
                  }),
                ],
              }),
          ],
        }),
      }),
      // Change the Sales password
      (0, T.jsx)(Md, {
        open: pwDlg,
        onOpenChange: (G) => !G && !A && setPwDlg(!1),
        children: (0, T.jsxs)(Hd, {
          className: "dialog-box",
          children: [
            (0, T.jsx)(qd, { children: "Change the password" }),
            (0, T.jsx)(zd, { children: "This password opens Inventory, Stocktake, Editing and Sales. Enter the current password, then the new one twice." }),
            (0, T.jsxs)("form", {
              onSubmit: changePw,
              children: [
                (0, T.jsxs)("label", { className: "field", children: ["Current password", (0, T.jsx)("input", { name: "cur", type: "password", required: !0 })] }),
                (0, T.jsxs)("label", { className: "field", children: ["New password", (0, T.jsx)("input", { name: "nw", type: "password", required: !0 })] }),
                (0, T.jsxs)("label", { className: "field", children: ["New password again", (0, T.jsx)("input", { name: "nw2", type: "password", required: !0 })] }),
                pwErr && (0, T.jsx)("p", { role: "alert", className: "form-error", children: pwErr }),
                (0, T.jsxs)("div", {
                  className: "dialog-actions",
                  children: [
                    (0, T.jsx)("button", { type: "button", className: "secondary", onClick: () => setPwDlg(!1), children: "Cancel" }),
                    (0, T.jsx)("button", { className: "primary", disabled: A, children: "Save new password" }),
                  ],
                }),
              ],
            }),
          ],
        }),
      }),
      (0, T.jsx)(Md, {
        open: w,
        onOpenChange: (G) => {
          A || S(G);
        },
        children: (0, T.jsxs)(Hd, {
          className: "dialog-box",
          children: [
            (0, T.jsx)(qd, { children: "Process sale" }),
            (0, T.jsx)(zd, { children: ve }),
            // Step 1: cash or card
            (0, T.jsx)("p", { className: "sale-step", children: "1. How is the customer paying?" }),
            (0, T.jsx)(aE, {
              value: vt,
              // Only a tap chooses the payment type (focus alone must not pick Cash)
              activationMode: "manual",
              onValueChange: (G) => {
                A || (lt(G), ee(""), G === "cash" && dsc !== "custom" && (setDsc("none"), setDName("")));
              },
              children: (0, T.jsxs)(rE, {
                className: "payment-methods",
                children: [
                  (0, T.jsx)(Pd, { value: "cash", disabled: A, children: "Cash" }),
                  (0, T.jsx)(Pd, { value: "card", disabled: A, children: "Card" }),
                ],
              }),
            }),
            vt === "" && (0, T.jsx)("p", { className: "muted", children: "Choose cash or card to continue." }),
            // Step 2: sale options (cash: 5% automatic, or custom + 5%; card: none / staff / stallholder / custom)
            vt !== "" &&
              (0, T.jsxs)(T.Fragment, {
                children: [
                  (0, T.jsx)("p", { className: "sale-step", children: "2. Sale option" }),
                  (0, T.jsx)("div", {
                    className: "category-chips sale-options",
                    children: (vt === "cash"
                      ? [
                          ["none", "Cash 5% (automatic)"],
                          ["custom", "Custom discount"],
                        ]
                      : [
                          ["none", "No discount"],
                          ["staff20", "Staff 20%"],
                          ["stall10", "Stallholder 10%"],
                          ["custom", "Custom discount"],
                        ]
                    ).map(([k, lbl]) =>
                      (0, T.jsx)(
                        "button",
                        { type: "button", "aria-pressed": dsc === k, disabled: A, onClick: () => (setDsc(k), ee("")), children: lbl },
                        k,
                      ),
                    ),
                  }),
                  vt === "card" &&
                    (dsc === "staff20" || dsc === "stall10") &&
                    (0, T.jsxs)("label", {
                      className: "field",
                      children: [
                        dsc === "staff20" ? "Staff member’s name" : "Name of staff member completing the sale",
                        (0, T.jsx)("input", {
                          value: dName,
                          maxLength: 60,
                          autoComplete: "off",
                          onChange: (G) => setDName(G.target.value),
                          placeholder: "Type a name",
                        }),
                      ],
                    }),
                  // Custom discount: choose the items and the dollars off each
                  dsc === "custom" &&
                    (0, T.jsxs)("div", {
                      className: "custom-discount",
                      children: [
                        (0, T.jsx)("p", {
                          className: "muted custom-help",
                          children:
                            vt === "cash"
                              ? "Type the amount off each item that gets a discount. The 5% cash discount is then taken off the new total."
                              : "Type the amount off each item that gets a discount. Leave the others blank.",
                        }),
                        dt.map((G) => {
                          let raw = String(cust[G.id] ?? ""),
                            each = custEach(G),
                            bad = raw.trim() !== "" && (!Number.isFinite(Rf(raw.trim())) || Rf(raw.trim()) > G.price);
                          return (0, T.jsxs)(
                            "div",
                            {
                              className: "custom-row" + (each > 0 ? " has-discount" : ""),
                              children: [
                                (0, T.jsxs)("div", {
                                  className: "custom-item",
                                  children: [
                                    (0, T.jsx)("strong", { children: G.name }),
                                    (0, T.jsxs)("small", { children: [G.qty, " × ", ln(G.price)] }),
                                  ],
                                }),
                                (0, T.jsxs)("label", {
                                  className: "custom-input",
                                  children: [
                                    (0, T.jsx)("span", { children: "$ off each" }),
                                    (0, T.jsx)("input", {
                                      type: "number",
                                      inputMode: "decimal",
                                      min: "0",
                                      max: (G.price / 100).toFixed(2),
                                      step: "0.05",
                                      placeholder: "0.00",
                                      "aria-label": "Amount off each " + G.name,
                                      value: raw,
                                      onChange: (ev) => {
                                        let v = ev.target.value;
                                        (setCust((c) => ({ ...c, [G.id]: v })), ee(""));
                                      },
                                    }),
                                  ],
                                }),
                                (0, T.jsx)("span", {
                                  className: "custom-line" + (bad ? " bad" : ""),
                                  children: bad
                                    ? "Max " + ln(G.price)
                                    : each > 0
                                      ? "−" + ln(each * G.qty) + (G.qty > 1 ? " total" : "")
                                      : "",
                                }),
                              ],
                            },
                            G.id,
                          );
                        }),
                      ],
                    }),
                ],
              }),
            // Price breakdown
            vt !== "" &&
              (0, T.jsxs)("div", {
                className: "price-breakdown",
                children: [
                  (0, T.jsxs)("div", { children: [(0, T.jsx)("span", { children: "Items" }), (0, T.jsx)("span", { children: ln(Jt) })] }),
                  pr.custom > 0 &&
                    (0, T.jsxs)("div", {
                      className: "discount-row",
                      children: [(0, T.jsx)("span", { children: "Custom discount" }), (0, T.jsx)("span", { children: "\u2212" + ln(pr.custom) })],
                    }),
                  pr.pctOff > 0 &&
                    (0, T.jsxs)("div", {
                      className: "discount-row",
                      children: [
                        (0, T.jsx)("span", { children: LS_DISCOUNTS[pr.type].label + (vt === "cash" ? " (automatic)" : "") }),
                        (0, T.jsx)("span", { children: "\u2212" + ln(pr.pctOff) }),
                      ],
                    }),
                  pr.rounding !== 0 &&
                    (0, T.jsxs)("div", {
                      children: [
                        (0, T.jsx)("span", { children: "Cash rounding" }),
                        (0, T.jsx)("span", { children: (pr.rounding < 0 ? "−" : "+") + ln(Math.abs(pr.rounding)) }),
                      ],
                    }),
                ],
              }),
            vt !== "" &&
              (0, T.jsxs)("div", {
                className: "payment-total",
                children: [(0, T.jsx)("p", { children: "Customer pays" }), (0, T.jsx)("strong", { children: ln(ft) })],
              }),
            // Cash: optional change calculator
            vt === "cash" &&
              (0, T.jsxs)(T.Fragment, {
                children: [
                  (0, T.jsxs)("label", {
                    className: "field",
                    children: [
                      "Cash received (optional, to work out change)",
                      (0, T.jsx)("input", {
                        type: "number",
                        inputMode: "decimal",
                        min: "0",
                        step: "0.05",
                        value: L,
                        onChange: (G) => F(G.target.value),
                        placeholder: "0.00",
                      }),
                    ],
                  }),
                  (0, T.jsx)("div", {
                    className: "quick-cash",
                    children: Array.from(new Set([ft, ...[500, 1e3, 2e3, 5e3, 1e4].filter((G) => G > ft)]))
                      .slice(0, 4)
                      .map((G) =>
                        (0, T.jsx)(
                          "button",
                          { className: "secondary", onClick: () => F((G / 100).toFixed(2)), children: G === ft ? "Exact" : ln(G) },
                          G,
                        ),
                      ),
                  }),
                  (0, T.jsxs)("div", {
                    className: "change",
                    children: [
                      (0, T.jsx)("span", { children: "Change to give" }),
                      (0, T.jsx)("strong", {
                        "aria-live": "polite",
                        children: L === "" ? "—" : Number.isFinite(Rf(L)) && Rf(L) >= ft ? ln(Rf(L) - ft) : "Not enough",
                      }),
                    ],
                  }),
                ],
              }),
            vt === "card" &&
              (0, T.jsxs)("div", {
                className: "notice",
                children: ["Take ", ln(ft), " on the card reader, then confirm below."],
              }),
            te &&
              (0, T.jsxs)("p", {
                role: "alert",
                style: { color: "#a12f35" },
                children: [
                  te,
                  " ",
                  (0, T.jsx)("button", {
                    className: "text-button",
                    onClick: async () => {
                      (await wt(), S(!1));
                    },
                    children: "Refresh basket",
                  }),
                ],
              }),
            vt !== "" &&
              (0, T.jsx)("button", {
                className: "primary checkout",
                disabled:
                  A ||
                  da ||
                  (vt === "card" && (dsc === "staff20" || dsc === "stall10") && !dName.trim()) ||
                  (dsc === "custom" && (custBad || custTotal <= 0)),
                onClick: Ln,
                children: A
                  ? "Saving\u2026"
                  : dsc === "custom" && custBad
                    ? "A discount is more than the item\u2019s price"
                    : dsc === "custom" && custTotal <= 0
                      ? "Enter an amount off for at least one item"
                      : vt === "card"
                        ? (dsc === "staff20" || dsc === "stall10") && !dName.trim()
                          ? "Enter the staff name to continue"
                          : "Card payment received \u2014 complete sale"
                        : "Complete cash sale",
              }),
          ],
        }),
      }),
      (0, T.jsx)(Md, {
        open: !!q,
        onOpenChange: (G) => !G && j(null),
        children: (0, T.jsxs)(Hd, {
          className: "dialog-box",
          children: [
            (0, T.jsx)(qd, { className: "sr-only", children: "Sale complete" }),
            (0, T.jsx)(zd, { className: "sr-only", children: "Payment recorded." }),
            q &&
              (0, T.jsxs)("div", {
                className: "success",
                children: [
                  (0, T.jsx)(sf, { size: 56 }),
                  (0, T.jsx)("h2", { children: "All done. Thank you!" }),
                  (0, T.jsxs)("p", {
                    className: "muted",
                    style: { margin: "10px 0 26px" },
                    children: [Ds(q.method), " payment recorded."],
                  }),
                  q.method === "cash" &&
                    (0, T.jsxs)("div", {
                      className: "change",
                      children: [
                        (0, T.jsx)("span", { children: "Give change" }),
                        (0, T.jsx)("strong", { children: ln(q.change) }),
                      ],
                    }),
                  (0, T.jsxs)("p", { style: { margin: "20px 0" }, children: ["Sale total: ", ln(q.total)] }),
                  (0, T.jsx)("button", {
                    className: "primary checkout",
                    onClick: () => j(null),
                    children: "Start next sale",
                  }),
                ],
              }),
          ],
        }),
      }),
      (0, T.jsx)(Md, {
        open: !!z,
        onOpenChange: (G) => !G && k(null),
        children: (0, T.jsxs)(Hd, {
          className: "dialog-box",
          children: [
            (0, T.jsx)(qd, { children: "Sale details" }),
            (0, T.jsx)(zd, { children: z && `${z.market} \xB7 ${lsDayLabel(lsSaleDay(z))} ${lsTime(z.at)} \xB7 ${lsMethod(z.method)}` }),
            z &&
              (0, T.jsxs)(T.Fragment, {
                children: [
                  (0, T.jsx)("div", {
                    children: z.lines.map((G) =>
                      (0, T.jsxs)(
                        "div",
                        {
                          className: "basket-line",
                          children: [
                            (0, T.jsxs)("div", {
                              className: "line-title",
                              children: [
                                (0, T.jsxs)("span", { children: [G.qty, " \xD7 ", G.name] }),
                                (0, T.jsx)("span", { children: ln(G.total) }),
                              ],
                            }),
                            (0, T.jsx)("small", {
                              className: "muted",
                              children:
                                ln(G.price) +
                                ((G.discount_each || 0) > 0
                                  ? "  \u00b7  custom \u2212" + ln(G.discount_each) + " each (\u2212" + ln(G.discount_total ?? G.discount_each * G.qty) + ")"
                                  : ""),
                            }),
                          ],
                        },
                        G.id,
                      ),
                    ),
                  }),
                  lsCustomOff(z) > 0 &&
                    (0, T.jsxs)("div", {
                      className: "line-title",
                      children: [(0, T.jsx)("span", { children: "Custom discount" }), (0, T.jsx)("span", { children: "\u2212" + ln(lsCustomOff(z)) })],
                    }),
                  lsPctOff(z) > 0 &&
                    (0, T.jsxs)("div", {
                      className: "line-title",
                      children: [
                        (0, T.jsx)("span", {
                          children: (LS_DISCOUNTS[z.discount_type]?.label || "Discount") + (z.staff_name ? " \xB7 " + z.staff_name : ""),
                        }),
                        (0, T.jsx)("span", { children: "\u2212" + ln(lsPctOff(z)) }),
                      ],
                    }),
                  !!z.rounding &&
                    (0, T.jsxs)("div", {
                      className: "line-title",
                      children: [(0, T.jsx)("span", { children: "Cash rounding" }), (0, T.jsx)("span", { children: ln(z.rounding) })],
                    }),
                  (0, T.jsxs)("div", {
                    className: "total",
                    children: [
                      (0, T.jsx)("span", { children: "Total" }),
                      (0, T.jsx)("strong", { children: ln(z.total) }),
                    ],
                  }),

                ],
              }),
          ],
        }),
      }),
    ],
  });
}
var Wj = Me(_a(), 1);
document.body.classList.add("offline-app");
(0, jj.createRoot)(document.getElementById("root")).render((0, Wj.jsx)(m_, { offline: !0 }));
var yC = document.getElementById("install-status");
location.protocol === "file:"
  ? (yC.textContent =
      "Local file version. Use a browser that supports local HTML and device storage. On iPad, use the Home Screen installation from the link in the setup guide.")
  : "serviceWorker" in navigator
    ? navigator.serviceWorker
        .register("./sw.js", { updateViaCache: "none" })
        .then(async (reg) => {
          // When online, check for a newer version of the app each time it opens.
          // Offline this simply fails quietly and the cached app keeps running.
          navigator.onLine !== !1 && reg.update().catch(() => {});
          (await new Promise((e, t) => {
            let a = setTimeout(() => t(Error("Install timed out")), 15e3);
            navigator.serviceWorker.ready.then(
              (r) => {
                (clearTimeout(a), e(r));
              },
              (r) => {
                (clearTimeout(a), t(r));
              },
            );
          }),
            (yC.textContent =
              "Ready for offline use. Add to Home Screen in Safari, open the icon once, then you can disconnect."),
            navigator.storage?.persist?.().catch(() => {}));
        })
        .catch(() => {
          yC.textContent =
            "Offline installation could not finish. Reopen this page while online and try again.";
        })
    : (yC.textContent =
        "This browser cannot install the offline app. Open this page in Safari on your iPad.");
