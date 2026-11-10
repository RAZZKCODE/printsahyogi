"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, BadgeCheck, CircleHelp, Crown, Mail, MessageCircle, RefreshCw, Send, ShoppingBag, WalletCards, Zap } from "lucide-react";

const panel = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";

export function CardDashboardPage() {
  const monthNow = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(monthNow);
  const [rate, setRate] = useState(50);
  const [editing, setEditing] = useState(false);
  const [draftRate, setDraftRate] = useState("50");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const saved = window.localStorage.getItem("printsahyogi-card-cost");
    if (saved && Number.isFinite(Number(saved))) {
      setRate(Number(saved));
      setDraftRate(saved);
    }
  }, []);

  const saveRate = (event: FormEvent) => {
    event.preventDefault();
    const next = Number(draftRate);
    if (!Number.isFinite(next) || next < 0) {
      setNotice("Enter a valid non-negative cost.");
      return;
    }
    window.localStorage.setItem("printsahyogi-card-cost", String(next));
    setRate(next);
    setEditing(false);
    setNotice("Cost per card saved in this browser.");
  };

  const title = new Date(`${month}-01T00:00:00`).toLocaleString("en", { month: "long", year: "numeric" });
  return <main className="mx-auto min-h-full max-w-6xl px-4 py-7 sm:px-7">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><h1 className="font-serif text-3xl font-semibold">Card Analytics &amp; Earnings</h1><p className="mt-2 text-sm text-slate-500">Track the card processing volume and estimate your print earnings.</p></div><label className="text-xs text-slate-500">Month<input aria-label="Analytics month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 block h-9 rounded-md border bg-white px-3 text-sm text-slate-800 dark:bg-slate-900 dark:text-slate-100"/></label></header>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["TODAY", "0", "Cards Created Today"], ["TODAY REVENUE", `₹0`, "Estimated Earnings Today"], ["MONTHLY TOTAL", "0", "Total Cards This Month"], ["MONTHLY REVENUE", "₹0", "Total Revenue This Month"]].map(([label, value, caption]) => <section key={label} className={panel}><p className="text-[10px] font-bold tracking-[.12em] text-slate-500">{label}</p><p className="mt-3 text-3xl font-semibold">{value}</p><p className="mt-1 text-xs text-slate-500">{caption}</p></section>)}</div>
    <section className={`${panel} mt-5 flex flex-wrap items-center justify-between gap-4`}><div><p className="text-sm font-semibold">Current Rate Setting</p><p className="mt-1 text-xs text-slate-500">Default ₹{rate} per card print</p></div><div className="flex gap-2"><button type="button" onClick={() => { setRevision((n) => n + 1); setNotice("Analytics refreshed."); }} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"><RefreshCw size={14}/>Refresh Data</button><button type="button" onClick={() => { setDraftRate(String(rate)); setEditing(true); }} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-slate-900">Edit Pricing</button></div></section>
    <div className="mt-5 grid gap-4 lg:grid-cols-2"><section className={panel}><h2 className="font-serif text-xl font-semibold">Daily Creation &amp; Revenue Trend</h2><p className="mt-1 text-xs text-slate-500">Daily cards created and earnings for {title}</p><div className="mt-7 grid min-h-36 place-items-center rounded-xl border border-dashed text-sm text-slate-400">No activity recorded yet <span className="sr-only">Refresh {revision}</span></div></section><section className={panel}><h2 className="font-serif text-xl font-semibold">Breakdown by Card Type</h2><p className="mt-1 text-xs text-slate-500">Distribution of processed cards by category</p><div className="mt-6 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 text-sm dark:bg-slate-800"><span>Aadhaar Card</span><span className="text-slate-500">0 cards · ₹0</span></div></section></div>
    {notice && <p role="status" className="mt-4 text-sm text-cyan-800 dark:text-cyan-200">{notice}</p>}
    {editing && <div className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-4"><form onSubmit={saveRate} className={`${panel} w-full max-w-sm`}><h2 className="font-serif text-xl font-semibold">Set Cost per Card</h2><label className="mt-4 block text-sm">Cost in ₹<input autoFocus type="number" min="0" step="0.01" value={draftRate} onChange={(event) => setDraftRate(event.target.value)} className="mt-1 h-10 w-full rounded-lg border bg-transparent px-3"/></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditing(false)} className="rounded-lg border px-3 py-2 text-sm">Cancel</button><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">Save</button></div></form></div>}
  </main>;
}

const plans = [
  { name: "Free", caption: "Perfect for trying out our services", monthly: 0, features: ["Ad-supported experience", "1 Credit / Day on Cards"] },
  { name: "Pro", caption: "For Beginners", monthly: 69, features: ["10 Credits / Day per Card — 90 Total", "10 Credits / Day on Background removal", "Zero ads", "Access to All Premium Features"] },
  { name: "Pro Plus", caption: "For Power Users", monthly: 99, features: ["30 Credits / Day per Card — 270 Total", "30 Credits / Day on Background removal", "Zero ads", "Access to All Premium Features", "Priority Support"] },
  { name: "Ultra", caption: "No card limits. Ever.", monthly: 119, features: ["Unlimited Credits / Day on All Cards", "40 Credits / Day on Background removal", "Zero ads", "Access to All Premium Features", "Priority Support"] }
];

export function PlansPage() {
  const [yearly, setYearly] = useState(false);
  const [promo, setPromo] = useState("");
  const [notice, setNotice] = useState("");
  const [trialOpen, setTrialOpen] = useState(false);
  const discount = yearly ? 0.8 : 1;
  return <main className="mx-auto min-h-full max-w-7xl px-4 py-8 sm:px-7"><header className="text-center"><h1 className="font-serif text-4xl font-semibold">Simple, Transparent Pricing</h1><div className="mx-auto mt-5 inline-flex rounded-full border bg-white p-1 dark:bg-slate-900"><button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)} className={`rounded-full px-5 py-2 text-sm ${!yearly ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-500"}`}>Monthly</button><button type="button" aria-pressed={yearly} onClick={() => setYearly(true)} className={`rounded-full px-5 py-2 text-sm ${yearly ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-500"}`}>Yearly · Save 20%</button></div>
    <form onSubmit={(event) => { event.preventDefault(); setNotice(promo.trim() ? "Promo code validation is unavailable in this local build." : "Enter a promo code first."); }} className="mx-auto mt-4 flex max-w-sm gap-2"><input aria-label="Enter promo code" value={promo} onChange={(event) => setPromo(event.target.value)} placeholder="Enter promo code" className="h-10 min-w-0 flex-1 rounded-lg border bg-transparent px-3 text-sm"/><button className="rounded-lg border px-4 text-sm font-medium">Apply</button></form>{notice && <p role="status" className="mt-2 text-xs text-amber-700 dark:text-amber-300">{notice}</p>}</header>
    <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{plans.map((plan) => <section key={plan.name} className={`${panel} flex flex-col`}><h2 className="font-serif text-2xl font-semibold">{plan.name}</h2><p className="mt-2 min-h-10 text-xs text-slate-500">{plan.caption}</p><p className="mt-3 text-3xl font-semibold">₹{Math.round(plan.monthly * discount)}<span className="text-sm font-normal text-slate-500">{plan.monthly > 0 ? "/ month" : ""}</span></p>{yearly && plan.monthly > 0 && <p className="mt-1 text-xs text-emerald-700">20% off billed yearly</p>}<button type="button" onClick={() => setNotice(plan.monthly ? "Checkout is not connected in this local build." : "Free plan selected.")} className="mt-5 h-11 rounded-full border bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900">{plan.monthly ? "Buy Now" : "Get Started"}</button><ul className="mt-5 space-y-3 border-t pt-4 text-xs">{plan.features.map((feature) => <li key={feature} className="flex gap-2"><BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600"/>{feature}</li>)}</ul></section>)}</div>
    <section className={`${panel} mt-5 flex flex-wrap items-center justify-between gap-4`}><div><p className="text-xs font-bold tracking-wider text-slate-500">HIGH VOLUME &amp; ENTERPRISE</p><h2 className="mt-1 font-serif text-2xl font-semibold">Custom Plan</h2><p className="mt-1 text-sm text-slate-500">Bespoke solutions for high-scale organizations · Starting from ₹99/month</p></div><button type="button" onClick={() => setNotice("Contact sales is not connected in this local build.")} className="rounded-lg border px-4 py-2 text-sm font-semibold">Contact Sales</button></section>
    <section className="mx-auto mt-7 max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900 dark:bg-amber-950/30"><Crown className="mx-auto text-amber-600"/><h2 className="mt-2 font-serif text-2xl font-semibold">Claim Your 7-Day Free Trial</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Try premium features for a week. No card details are requested in this local preview.</p><button type="button" onClick={() => setTrialOpen(true)} className="mt-4 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-bold text-white"><Zap className="mr-1 inline" size={15}/>Get Premium Free</button></section>
    {trialOpen && <div className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-4"><div className={`${panel} w-full max-w-sm text-center`}><h2 className="font-serif text-xl font-semibold">Free trial unavailable</h2><p className="mt-2 text-sm text-slate-500">Trial enrollment requires the production account service.</p><button type="button" onClick={() => setTrialOpen(false)} className="mt-4 rounded-lg border px-4 py-2 text-sm">Close</button></div></div>}
  </main>;
}

const products = [
  ["Wireless Mouse", "Wireless mouse with multi-device switching for everyday counter work."],
  ["Compact Keyboard", "Compact wireless keyboard with device switching and shortcut keys."],
  ["Desk Organizer", "Desk organizer with drawer and pen holder."],
  ["A4 Glossy Photo Paper", "200 GSM glossy paper for inkjet printers."],
  ["Desk Mat", "Water-resistant desk mat for office and counter setups."],
  ["Laptop Riser", "Foldable laptop stand with adjustable viewing angles."],
  ["Photo Paper Cutter", "A4 paper cutter with alignment grid for precise trimming."]
];

export function ShopPage() {
  return <main className="mx-auto min-h-full max-w-6xl px-4 py-8 sm:px-7"><header className="mb-7 text-center"><ShoppingBag className="mx-auto mb-3 text-cyan-700" size={38}/><h1 className="font-serif text-3xl font-semibold">Recommended Products</h1><p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">Useful printers, paper, ink, and accessories for photo printing and service counters.</p></header><p className="mb-4 text-center text-xs text-slate-500">Product availability and affiliate pricing are not connected in this local preview.</p><h2 className="mb-3 font-serif text-xl font-semibold">Shop Essentials</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{products.map(([name, description]) => <article key={name} className={panel}><div className="mb-4 grid h-28 place-items-center rounded-xl bg-slate-50 text-slate-400 dark:bg-slate-800"><ShoppingBag size={32}/></div><h3 className="font-semibold">{name}</h3><p className="mt-2 min-h-10 text-xs leading-5 text-slate-500">{description}</p><button type="button" disabled className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-400">Check Price <ArrowUpRight size={14}/></button></article>)}</div></main>;
}

export function SuggestFeaturePage() {
  const [phone, setPhone] = useState("");
  const [idea, setIdea] = useState("");
  const [notice, setNotice] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{10}$/.test(phone)) { setNotice("Enter a 10-digit mobile number."); return; }
    if (idea.trim().length < 8) { setNotice("Describe your idea in at least 8 characters."); return; }
    setItems((current) => [idea.trim(), ...current]);
    setPhone("");
    setIdea("");
    setNotice("Saved in this browser preview only. No suggestion or phone number was sent.");
  };
  return <main className="mx-auto min-h-full max-w-3xl px-4 py-8 sm:px-7"><header className="mb-6 text-center"><Send className="mx-auto mb-3 text-cyan-700"/><h1 className="font-serif text-3xl font-semibold">Suggest a Feature</h1><p className="mt-2 text-sm text-slate-500">Share ideas to improve the PrintSahyogi tools.</p></header><form onSubmit={submit} className={panel}><label className="block text-sm font-medium">Mobile Number<input inputMode="numeric" autoComplete="tel-national" maxLength={10} value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Enter your 10-digit number" className="mt-1 h-10 w-full rounded-lg border bg-transparent px-3"/></label><label className="mt-4 block text-sm font-medium">Your Idea<textarea value={idea} onChange={(event) => setIdea(event.target.value)} minLength={8} maxLength={1000} placeholder="Describe the feature you'd like to see…" className="mt-1 min-h-28 w-full resize-y rounded-lg border bg-transparent px-3 py-2"/></label><button className="mt-4 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">Submit Suggestion</button>{notice && <p role="status" className="mt-3 text-sm text-cyan-800 dark:text-cyan-200">{notice}</p>}</form><section className={`${panel} mt-5`}><h2 className="font-serif text-xl font-semibold">Community Suggestions</h2><p className="mt-1 text-xs text-slate-500">Vote for ideas you would like to see next.</p>{items.length ? <ul className="mt-4 space-y-2">{items.map((item, index) => <li key={`${item}-${index}`} className="rounded-lg border p-3 text-sm">{item}</li>)}</ul> : <p className="mt-5 rounded-xl border border-dashed p-8 text-center text-sm text-slate-400">No suggestions yet. Be the first to share an idea.</p>}</section></main>;
}

export function SupportPage() {
  return <main className="mx-auto min-h-full max-w-3xl px-4 py-10 sm:px-7"><header className="mb-7 text-center"><CircleHelp className="mx-auto mb-3 text-cyan-700"/><h1 className="font-serif text-3xl font-semibold">Support</h1><p className="mt-2 text-sm text-slate-500">Get help with photo, card, and PDF tools.</p></header><div className="grid gap-4 sm:grid-cols-2"><a href="mailto:printsahyogi@gmail.com" className={`${panel} block`}><Mail className="mb-3 text-cyan-700"/><h2 className="font-semibold">Email support</h2><p className="mt-1 text-sm text-slate-500">printsahyogi@gmail.com</p></a><a href="https://wa.me/919318380767" target="_blank" rel="noreferrer" className={`${panel} block`}><MessageCircle className="mb-3 text-emerald-700"/><h2 className="font-semibold">WhatsApp support</h2><p className="mt-1 text-sm text-slate-500">Typical response time: 24–48 hours.</p></a></div><section className={`${panel} mt-4`}><div className="flex items-center gap-3"><WalletCards className="text-cyan-700"/><div><h2 className="font-semibold">Using the tools</h2><p className="mt-1 text-sm text-slate-500">Upload a file on the tool page, edit the output, then export or print. Local preview does not include the production payment and account services.</p></div></div></section></main>;
}
