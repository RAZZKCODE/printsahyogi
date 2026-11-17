"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { SUPPORT_EMAIL as supportEmail, SUPPORT_WHATSAPP as supportWhatsApp } from "@/lib/support";
import { ArrowRight, ArrowUpRight, BadgeCheck, Check, ChevronDown, CircleHelp, Crown, FileText, Lightbulb, Mail, MessageCircle, RefreshCw, Save, Send, ShoppingBag, Zap } from "lucide-react";

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

const suggestionDraftKey = "printsathi-feature-draft";
const field = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-cyan-400";
const primaryAction = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-cyan-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 dark:bg-cyan-700 dark:hover:bg-cyan-600";
const secondaryAction = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 dark:border-slate-700 dark:hover:bg-slate-800";
const featureCategories = ["Photo tools", "Card crop & print", "Print & PDF", "Account & plans", "Something else"];

function emailDraft(subject: string, body: string) {
  return `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function SuggestFeaturePage() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(featureCategories[0]);
  const [idea, setIdea] = useState("");
  const [notice, setNotice] = useState("");
  const [preparedDraft, setPreparedDraft] = useState("");

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(suggestionDraftKey) || "null");
      if (saved && typeof saved === "object" && "title" in saved && "idea" in saved && "category" in saved) {
        if (typeof saved.title === "string") setTitle(saved.title.slice(0, 100));
        if (typeof saved.idea === "string") setIdea(saved.idea.slice(0, 2000));
        if (typeof saved.category === "string" && featureCategories.includes(saved.category)) setCategory(saved.category);
      }
    } catch { setNotice("Your saved draft could not be loaded. You can still write and email an idea."); }
  }, []);

  const saveDraft = () => {
    try {
      window.localStorage.setItem(suggestionDraftKey, JSON.stringify({ title, category, idea }));
      setNotice("Draft saved on this device. It has not been sent to the PrintSathi team.");
    } catch { setNotice("Browser storage is unavailable. Prepare an email to keep your idea."); }
  };

  const prepare = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (title.trim().length < 4 || idea.trim().length < 20) {
      setNotice("Add a title of at least 4 characters and a description of at least 20 characters.");
      return;
    }
    const body = `Feature suggestion for PrintSathi\n\nCategory: ${category}\nTitle: ${title.trim()}\n\n${idea.trim()}`;
    setPreparedDraft(emailDraft(`Feature idea: ${title.trim()}`, body));
    setNotice("Email draft ready. Open it below, then send it from your email app.");
  };

  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
    <header className="mb-8 max-w-2xl">
      <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-300"><Lightbulb size={24} strokeWidth={1.5}/></span>
      <h1 className="font-serif text-3xl font-semibold text-slate-900 dark:text-white sm:text-4xl">Suggest a Feature</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">What would make your next print job easier? Tell us about a tool, a shortcut, or an improvement you would like in PrintSathi.</p>
    </header>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <form onSubmit={prepare} className={`${panel} sm:p-7`} onChange={() => { setPreparedDraft(""); setNotice(""); }}>
        <h2 className="text-lg font-semibold">Tell us your idea</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">A little detail helps us understand what you need.</p>
        <label className="mt-6 block text-sm font-medium" htmlFor="feature-title">Give it a name<input id="feature-title" required minLength={4} maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Save my favourite print layouts" className={field}/></label>
        <label className="mt-5 block text-sm font-medium" htmlFor="feature-category">Which part of PrintSathi?<select id="feature-category" value={category} onChange={(event) => setCategory(event.target.value)} className={field}>{featureCategories.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="mt-5 block text-sm font-medium" htmlFor="feature-idea">How would it help?<textarea id="feature-idea" required minLength={20} maxLength={2000} rows={6} value={idea} onChange={(event) => setIdea(event.target.value)} aria-describedby="feature-hint" placeholder="What are you trying to do? What takes too long? How would your idea make it easier?" className={`${field} resize-y`}/></label>
        <div id="feature-hint" className="mt-2 flex justify-between gap-4 text-xs text-slate-500 dark:text-slate-400"><span>Please leave out personal documents and ID numbers.</span><span className="shrink-0 tabular-nums">{idea.length}/2000</span></div>
        <div className="mt-6 flex flex-wrap gap-3"><button type="submit" className={primaryAction}><Send size={16}/>Prepare email</button><button type="button" onClick={saveDraft} className={secondaryAction}><Save size={16}/>Save draft</button></div>
        {notice && <p role="status" className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{notice}</p>}
        {preparedDraft && <a href={preparedDraft} className={`${primaryAction} mt-4`}><Mail size={16}/>Open email draft<ArrowUpRight size={16}/></a>}
        <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">Ideas are sent through your email app. Saving a draft only keeps it in this browser.</p>
      </form>
      <aside className="space-y-5">
        <section className={panel}><h2 className="font-semibold">A useful suggestion includes</h2><ul className="mt-4 space-y-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{["The job you are trying to finish", "What feels slow or difficult today", "An example of the result you need"].map((item) => <li key={item} className="flex gap-2"><Check size={16} className="mt-1 shrink-0 text-cyan-700 dark:text-cyan-400"/>{item}</li>)}</ul></section>
        <section className="rounded-2xl border border-dashed border-slate-300 p-5 dark:border-slate-700"><CircleHelp className="mb-3 text-slate-500" size={20}/><h2 className="font-semibold">Something not working?</h2><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">For a failed export, printing issue, or account question, visit Support.</p><Link href="/app/support" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-800 dark:text-cyan-300">Get help<ArrowRight size={16}/></Link></section>
      </aside>
    </div>
  </main>;
}

const supportFaqs = [
  { question: "My file will not upload. What should I try?", answer: "Check the supported file types and size limit shown on the tool page. Try a smaller file, or export the image as JPG or PNG before uploading again. For a PDF tool, use an unlocked PDF." },
  { question: "Why is my print size different from the preview?", answer: "Match the printer paper size to the sheet you created. Select Actual size or 100% scale in the print dialog and turn off Fit to page. Print a test sheet before using photo paper." },
  { question: "An export or download did not finish", answer: "Keep the tool tab open until the export finishes. Check your browser downloads and any blocked-download message. If it still fails, try fewer images or a smaller file and include the tool name when you contact support." },
  { question: "What should I include in a support message?", answer: "Tell us which tool you used, what you expected, and what happened instead. Include your browser, device, and the exact error text. Remove personal information from any screenshot before sharing it." },
  { question: "Where can I find my account and plan?", answer: "Open My Account from the link below or your sidebar profile. For a payment question, include a transaction reference in a private support message. Never share a password, OTP, or full card number." }
];

export function SupportPage() {
  const [topic, setTopic] = useState("Upload or file issue");
  const [tool, setTool] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState("");
  const prepare = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (message.trim().length < 20) return;
    setDraft(emailDraft(`PrintSathi support: ${topic}`, `Topic: ${topic}\nTool: ${tool.trim() || "Not specified"}\n\n${message.trim()}`));
  };

  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
    <header className="mb-8 max-w-2xl"><span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50 text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-300"><CircleHelp size={24} strokeWidth={1.5}/></span><h1 className="font-serif text-3xl font-semibold text-slate-900 dark:text-white sm:text-4xl">How can we help?</h1><p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">Find a quick fix, ask about a tool, or get in touch with PrintSathi support.</p></header>
    <div className="mb-8 grid gap-4 sm:grid-cols-2">
      <a href={`${supportWhatsApp}?text=${encodeURIComponent("Hi PrintSathi, I need help with a tool.")}`} target="_blank" rel="noreferrer" className={`${panel} group flex items-start gap-4 transition-colors hover:border-cyan-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600`}><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-cyan-800 dark:bg-slate-800 dark:text-cyan-300"><MessageCircle size={22}/></span><span className="min-w-0 flex-1"><span className="block font-semibold">Chat on WhatsApp</span><span className="mt-1 block text-sm leading-6 text-slate-500 dark:text-slate-400">Open a conversation and describe your issue.</span><span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-cyan-800 dark:text-cyan-300">Open WhatsApp<ArrowUpRight size={16}/></span></span></a>
      <a href={emailDraft("PrintSathi support", "Hi PrintSathi team,\n\nI need help with: ")} className={`${panel} group flex items-start gap-4 transition-colors hover:border-cyan-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600`}><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-cyan-800 dark:bg-slate-800 dark:text-cyan-300"><Mail size={22}/></span><span className="min-w-0 flex-1"><span className="block font-semibold">Email support</span><span className="mt-1 block break-all text-sm leading-6 text-slate-500 dark:text-slate-400">{supportEmail}</span><span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-cyan-800 dark:text-cyan-300">Write an email<ArrowUpRight size={16}/></span></span></a>
    </div>
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <section className={panel}><h2 className="text-lg font-semibold">Quick answers</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">A few checks before you contact us.</p><div className="mt-5 divide-y divide-slate-200 dark:divide-slate-800">{supportFaqs.map((faq) => <details key={faq.question} className="group py-4"><summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-sm font-medium [&::-webkit-details-marker]:hidden">{faq.question}<ChevronDown size={16} className="mt-0.5 shrink-0 text-slate-500 transition-transform group-open:rotate-180 motion-reduce:transition-none"/></summary><p className="mt-3 pr-5 text-sm leading-6 text-slate-600 dark:text-slate-400">{faq.answer}</p></details>)}</div><Link href="/app/card-dashboard?tab=profile" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-800 dark:text-cyan-300">Open My Account<ArrowRight size={16}/></Link></section>
      <form onSubmit={prepare} onChange={() => setDraft("")} className={panel}><div className="flex items-center gap-2"><FileText size={20} className="text-cyan-800 dark:text-cyan-300"/><h2 className="text-lg font-semibold">Describe your issue</h2></div><p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Prepare a message, then send it from your email app.</p>
        <label htmlFor="support-topic" className="mt-5 block text-sm font-medium">What do you need help with?<select id="support-topic" value={topic} onChange={(event) => setTopic(event.target.value)} className={field}>{["Upload or file issue", "Crop or photo editing", "Print or download", "Account or payment", "Something else"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label htmlFor="support-tool" className="mt-4 block text-sm font-medium">Tool name <span className="font-normal text-slate-500">(optional)</span><input id="support-tool" maxLength={100} value={tool} onChange={(event) => setTool(event.target.value)} placeholder="e.g. Aadhaar crop" className={field}/></label>
        <label htmlFor="support-message" className="mt-4 block text-sm font-medium">What happened?<textarea id="support-message" required minLength={20} maxLength={2000} rows={5} value={message} onChange={(event) => setMessage(event.target.value)} aria-describedby="support-privacy" placeholder="Describe the steps, what happened, and any error message." className={`${field} resize-y`}/></label>
        <p id="support-privacy" className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">Do not include Aadhaar numbers, passwords, OTPs, or payment card details.</p>
        <button type="submit" className={`${primaryAction} mt-5`}><Mail size={16}/>Prepare support email</button>
        {draft && <div role="status" className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm dark:border-cyan-900 dark:bg-cyan-950/40"><p>Your message is ready. Open the draft and send it from your email app.</p><a href={draft} className="mt-3 inline-flex items-center gap-2 font-semibold text-cyan-800 underline underline-offset-4 dark:text-cyan-300">Open email draft<ArrowUpRight size={16}/></a></div>}
      </form>
    </div>
    <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 px-5 py-5 dark:border-slate-800"><div><h2 className="text-sm font-semibold">Have an idea instead?</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Help shape the tools you use every day.</p></div><Link href="/app/suggest-a-feature" className={secondaryAction}><Lightbulb size={16}/>Suggest a Feature<ArrowRight size={16}/></Link></section>
  </main>;
}
