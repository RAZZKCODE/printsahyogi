"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRight, BadgeCheck, Check, ChevronDown, CircleHelp,
  CloudOff, FileImage, FileText, Images, LockKeyhole,
  MousePointer2, Printer, ScanLine, ShieldCheck, Sparkles, UsersRound, Zap,
  Camera, CreditCard, HeartPulse, ContactRound, ShieldPlus, PanelsTopLeft, UserRound,
  BriefcaseBusiness, Minimize2, type LucideIcon
} from "lucide-react";

const toolCards: Array<{ slug: string; title: string; description: string; icon: LucideIcon; iconClass: string }> = [
  { slug: "aadhaar-crop", title: "toolAadhaar", description: "descAadhaar", icon: ScanLine, iconClass: "bg-amber-100 text-amber-700" },
  { slug: "ayushman-crop", title: "toolAyushman", description: "descAyushman", icon: HeartPulse, iconClass: "bg-rose-100 text-rose-700" },
  { slug: "pan-card-crop", title: "toolPan", description: "descPan", icon: CreditCard, iconClass: "bg-violet-100 text-violet-700" },
  { slug: "voter-card-crop", title: "toolVoter", description: "descVoter", icon: ContactRound, iconClass: "bg-blue-100 text-blue-700" },
  { slug: "punjab-health-card", title: "toolPunjab", description: "descPunjab", icon: ShieldPlus, iconClass: "bg-cyan-100 text-cyan-700" },
  { slug: "abha-card-crop", title: "toolAbha", description: "descAbha", icon: BadgeCheck, iconClass: "bg-emerald-100 text-emerald-700" },
  { slug: "ration-card-crop", title: "toolRation", description: "descRation", icon: PanelsTopLeft, iconClass: "bg-orange-100 text-orange-700" },
  { slug: "e-shram-card-crop", title: "toolShram", description: "descShram", icon: BriefcaseBusiness, iconClass: "bg-sky-100 text-sky-700" },
  { slug: "passport-photo", title: "toolPassport", description: "descPassport", icon: Camera, iconClass: "bg-pink-100 text-pink-700" },
  { slug: "collage", title: "toolCollage", description: "descCollage", icon: Images, iconClass: "bg-indigo-100 text-indigo-700" },
  { slug: "pdf-image-extractor", title: "toolPdf", description: "descPdf", icon: FileImage, iconClass: "bg-rose-100 text-rose-700" },
  { slug: "compress-image", title: "toolCompressor", description: "descCompressor", icon: Minimize2, iconClass: "bg-teal-100 text-teal-700" }
];

const plans = [
  { id: "free", name: "freeName", description: "freeDesc", price: "0", perDay: null, features: ["freeFeature1", "freeFeature2"], free: true },
  { id: "starter", name: "plan69", description: "plan69Desc", price: "69", perDay: "2.30", features: ["plan69Feature1", "plan69Feature2", "plan69Feature3", "plan69Feature4"] },
  { id: "pro", name: "plan99", description: "plan99Desc", price: "99", perDay: "3.30", features: ["plan99Feature1", "plan99Feature2", "plan69Feature3", "plan69Feature4", "priority"] },
  { id: "unlimited", name: "plan119", description: "plan119Desc", price: "119", perDay: "3.97", oldPrice: "149", features: ["plan119Feature1", "plan119Feature2", "plan69Feature3", "allPremium", "priority"] }
];

const faqItems = [
  { question: "faq1q", answer: "faq1a" },
  { question: "faq2q", answer: "faq2a" },
  { question: "faq3q", answer: "faq3a" },
  { question: "faq4q", answer: "faq4a" },
  { question: "faq5q", answer: "faq5a" },
  { question: "faq6q", answer: "faq6a" }
];

export function LandingContent() {
  const t = useTranslations("landing");
  const whyItems = [
    { icon: UserRound, label: "whySignup" },
    { icon: Zap, label: "whyUnlimited" },
    { icon: LockKeyhole, label: "whyPrivacy" },
    { icon: Images, label: "whyVersatile" },
    { icon: UsersRound, label: "whyCafe" }
  ];

  return (
    <>
      <main>
        <section id="about" className="relative overflow-hidden px-4 pb-14 pt-14 sm:pb-20 sm:pt-20">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(103,232,249,0.20),_transparent_62%)]" />
          <div className="mx-auto max-w-6xl text-center">
            <p className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/60 dark:text-cyan-200"><Sparkles className="h-3.5 w-3.5" />{t("heroEyebrow")}</p>
            <h1 className="mx-auto max-w-4xl text-balance font-serif text-4xl font-semibold leading-[1.12] tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-[58px]">{t("heroTitle")}</h1>
            <p className="mx-auto mt-5 max-w-3xl text-pretty text-lg leading-8 text-slate-700 dark:text-slate-300 sm:text-xl">
              {t.rich("heroLead", { accent: (chunks) => <span className="font-semibold text-cyan-700 dark:text-cyan-300">{chunks}</span>, collage: t("toolCollage"), passport: t("toolPassport"), aadhaar: t("toolAadhaar"), pan: t("toolPan"), ayushman: t("toolAyushman") })}
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t("heroNote")}</p>

            <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
              {toolCards.map((tool) => {
                const Icon = tool.icon;
                return <Link key={tool.slug} href={`/app/${tool.slug}`} className="group min-h-[150px] rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_4px_14px_-12px_rgba(15,23,42,0.5)] transition duration-200 hover:-translate-y-1 hover:border-cyan-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-cyan-800">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tool.iconClass}`}><Icon className="h-5 w-5" /></span>
                  <h2 className="mt-3 text-[15px] font-semibold text-slate-900 group-hover:text-cyan-800 dark:text-white dark:group-hover:text-cyan-300">{t(tool.title)}</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{t(tool.description)}</p>
                </Link>;
              })}
            </div>
          </div>
        </section>

        <section id="how-to" className="bg-slate-50 px-4 py-16 dark:bg-slate-900/50 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto mb-10 max-w-xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">PrintSahyogi</p>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-slate-950 dark:text-white sm:text-4xl">{t("howTitle")}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">{t("howIntro")}</p>
            </div>
            <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[26px] bg-gradient-to-br from-cyan-100 via-sky-50 to-indigo-100 p-4 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 sm:p-6">
                <DemoWorkspace />
              </div>
              <div className="space-y-4">
                <FeatureBlock icon={Camera} title={t("featurePassportTitle")} body={t("featurePassportText")} cta={t("createPhotos")} href="/app/passport-photo" />
                <FeatureBlock icon={FileText} title={t("featurePdfTitle")} body={t("featurePdfText")} cta={t("tryAadhaar")} href="/app/aadhaar-crop-a4-double-side-glossy" />
              </div>
            </div>
          </div>
        </section>

        <section id="privacy" className="px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-gradient-to-br from-cyan-50 via-sky-50 to-emerald-50 px-6 py-12 text-center dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/40 sm:px-12 sm:py-16">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-slate-900/70 dark:text-emerald-300"><ShieldCheck className="h-4 w-4" />{t("privacyChip")}</span>
            <h2 className="mx-auto mt-5 max-w-3xl font-serif text-3xl font-semibold leading-tight text-slate-900 dark:text-white sm:text-4xl">{t("privacyTitle")}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base">{t("privacyText")}</p>
            <div className="mx-auto mt-7 flex max-w-lg flex-wrap justify-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              {[<><CloudOff className="h-4 w-4" />{t("privacyNoUploads")}</>, <><LockKeyhole className="h-4 w-4" />{t("privacyBrowser")}</>, <><ShieldCheck className="h-4 w-4" />{t("privacyPrivate")}</>].map((item, i) => <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-2 dark:bg-slate-800/80">{item}</span>)}
            </div>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-20 bg-slate-50 px-4 py-16 dark:bg-slate-900/50 sm:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto mb-10 max-w-xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">{t("pricingEyebrow")}</p>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-slate-950 dark:text-white sm:text-4xl">{t("pricingTitle")}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">{t("pricingText")}</p>
              <span className="mt-4 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{t("monthlyPlans")}</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {plans.map((plan) => <article key={plan.id} className={`flex min-h-[395px] flex-col rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900 ${plan.id === "pro" ? "border-cyan-300 ring-2 ring-cyan-100 dark:border-cyan-800 dark:ring-cyan-950" : "border-slate-200 dark:border-slate-800"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{t(plan.name)}</h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t(plan.description)}</p>
                  </div>
                  {plan.id === "pro" && <span className="rounded-full bg-cyan-100 px-2 py-1 text-[10px] font-bold text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">{t("popular")}</span>}
                </div>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">₹{plan.price}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{t("monthly")}</span>
                  {plan.oldPrice && <span className="ml-1 text-xs text-slate-400 line-through">₹{plan.oldPrice}</span>}
                </div>
                {plan.perDay ? <span className="mt-2 w-fit rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">{t("onlyDay", { price: `₹${plan.perDay}` })}</span> : <span className="mt-2 w-fit rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{t("freeForever")}</span>}
                <Link href={plan.free ? "/app" : "/app/plans"} className={`mt-5 flex h-11 items-center justify-center rounded-full text-sm font-semibold transition hover:-translate-y-0.5 ${plan.free ? "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white" : "bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-300 text-slate-950 shadow-sm hover:shadow-md"}`}>{t(plan.free ? "getStarted" : "buyNow")}</Link>
                <div className="my-5 border-t border-slate-100 dark:border-slate-800" />
                <ul className="space-y-3">
                  {plan.features.map((feature) => <li key={feature} className="flex gap-2.5 text-xs leading-5 text-slate-700 dark:text-slate-300"><span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Check className="h-3 w-3" /></span>{t(feature)}</li>)}
                </ul>
              </article>)}
            </div>

            <div className="relative mt-6 grid gap-7 overflow-hidden rounded-3xl border border-emerald-200 bg-white p-6 shadow-[0_16px_42px_-30px_rgba(16,185,129,0.6)] dark:border-emerald-900 dark:bg-slate-900 sm:grid-cols-[1fr_1fr] sm:p-9">
              <span className="absolute right-0 top-0 rounded-bl-xl bg-emerald-500 px-4 py-2 text-[10px] font-bold tracking-wide text-white"><Sparkles className="mr-1 inline h-3 w-3" />{t("enterprise")}</span>
              <div className="pt-3">
                <h3 className="font-serif text-2xl font-semibold text-emerald-600 dark:text-emerald-300">{t("customName")}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("customDesc")}</p>
                <p className="mt-5 text-xl font-bold text-slate-900 dark:text-white">{t("fromPrice")}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href="/app/plans" className="rounded-full border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800">{t("buildPlan")}</Link>
                  <Link href="/app/support" className="rounded-full bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700">{t("contactSales")}</Link>
                </div>
              </div>
              <ul className="space-y-3 self-center">
                {["customFeature1", "customFeature2", "customFeature3"].map((key) => <li key={key} className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Check className="h-3.5 w-3.5" /></span>{t(key)}</li>)}
              </ul>
            </div>

            <div className="mx-auto mt-8 max-w-4xl rounded-[28px] bg-gradient-to-r from-cyan-100 via-sky-50 to-blue-100 p-6 dark:from-slate-800 dark:via-slate-800 dark:to-slate-700 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-8">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white/70 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-300"><Sparkles className="h-3 w-3" />{t("trialEyebrow")}</span>
                <h3 className="mt-3 font-serif text-2xl font-semibold text-slate-950 dark:text-white">{t("trialTitle")}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t("trialText")}</p>
              </div>
              <Link href="/app/plans" className="mt-5 inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-slate-950 px-6 text-sm font-semibold text-white shadow-md hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 sm:mt-0">{t("trialCta")}<ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center font-serif text-3xl font-semibold text-slate-950 dark:text-white sm:text-4xl">{t("whyTitle")}</h2>
            <div className="mt-9 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {whyItems.map(({ icon: Icon, label }) => <div key={label} className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-center dark:border-slate-800 dark:bg-slate-900">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300"><Icon className="h-5 w-5" /></span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t(label)}</span>
              </div>)}
            </div>
          </div>
        </section>

        <section id="faq" className="bg-white px-4 py-16 dark:bg-slate-950 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <div className="mb-8 text-center"><span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"><CircleHelp className="h-5 w-5" /></span><h2 className="mt-3 font-serif text-3xl font-semibold text-slate-950 dark:text-white sm:text-4xl">{t("faqTitle")}</h2></div>
            <div className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {faqItems.map(({ question, answer }) => <details key={question} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-4 text-sm font-medium text-slate-800 marker:hidden [&::-webkit-details-marker]:hidden dark:text-slate-100"><span>{t(question)}</span><ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" /></summary>
                <p className="max-w-2xl pb-4 pr-8 text-sm leading-6 text-slate-600 dark:text-slate-400">{t(answer)}</p>
              </details>)}
            </div>
          </div>
        </section>
      </main>

      <footer id="footer" className="bg-cyan-100 px-4 pb-8 pt-12 dark:bg-slate-900">
        <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-[1fr_1fr_1.3fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 font-bold text-slate-900 dark:text-white"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-700 text-[10px] font-black text-white">PM</span>PrintSahyogi</Link>
            <p className="mt-3 max-w-xs text-xs leading-5 text-slate-600 dark:text-slate-400">Simple browser tools for cards, photos, and print work.</p>
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white">{t("footerAbout")}</h2>
            <div className="mt-3 flex flex-col items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
              <Link href="#about" className="hover:text-cyan-800 dark:hover:text-cyan-300">{t("footerAbout")}</Link>
              <Link href="/app/support" className="hover:text-cyan-800 dark:hover:text-cyan-300">{t("footerContact")}</Link>
              <Link href="#privacy" className="hover:text-cyan-800 dark:hover:text-cyan-300">{t("footerPrivacy")}</Link>
              <Link href="#legal" className="hover:text-cyan-800 dark:hover:text-cyan-300">{t("footerTerms")}</Link>
              <Link href="#legal" className="hover:text-cyan-800 dark:hover:text-cyan-300">{t("footerDisclaimer")}</Link>
              <Link href="#blogs" className="hover:text-cyan-800 dark:hover:text-cyan-300">{t("footerBlogs")}</Link>
              <Link href="/app/shop" className="hover:text-cyan-800 dark:hover:text-cyan-300">{t("navShop")}</Link>
            </div>
          </div>
          <div id="blogs">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white">{t("footerQuick")}</h2>
            <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 text-xs text-slate-600 dark:text-slate-400">
              {toolCards.slice(0, 8).map((tool) => <Link key={tool.slug} href={`/app/${tool.slug}`} className="hover:text-cyan-800 dark:hover:text-cyan-300">{t(tool.title)}</Link>)}
            </div>
          </div>
        </div>
        <div id="legal" className="mx-auto mt-10 max-w-6xl border-t border-cyan-200 pt-5 text-center text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">{t("footerCopyright", { year: new Date().getFullYear() })}</div>
      </footer>
    </>
  );
}

function FeatureBlock({ icon: Icon, title, body, cta, href }: { icon: LucideIcon; title: string; body: string; cta: string; href: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300"><Icon className="h-5 w-5" /></span>
    <h3 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
    <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">{body}</p>
    <Link href={href} className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">{cta}<ArrowRight className="h-3.5 w-3.5" /></Link>
  </article>;
}

function DemoWorkspace() {
  const t = useTranslations("landing");
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_-25px_rgba(15,23,42,0.35)] dark:border-slate-700 dark:bg-slate-950">
    <div className="flex h-10 items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 dark:border-slate-800 dark:bg-slate-900"><span className="h-2 w-2 rounded-full bg-rose-400" /><span className="h-2 w-2 rounded-full bg-amber-400" /><span className="h-2 w-2 rounded-full bg-emerald-400" /><span className="ml-2 text-[10px] font-medium text-slate-500">PrintSahyogi · Aadhaar crop</span></div>
    <div className="flex min-h-[250px]">
      <aside className="hidden w-[104px] shrink-0 flex-col gap-2 border-r border-slate-100 bg-sky-50/80 p-3 dark:border-slate-800 dark:bg-slate-900 sm:flex">
        <span className="h-2 w-14 rounded bg-cyan-200 dark:bg-cyan-900" /><span className="mt-2 h-6 rounded bg-white shadow-sm dark:bg-slate-800" /><span className="h-6 rounded bg-white shadow-sm dark:bg-slate-800" /><span className="h-6 rounded bg-white shadow-sm dark:bg-slate-800" /><span className="mt-auto h-7 rounded-full bg-gradient-to-r from-amber-400 to-orange-400" />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-9 items-center justify-between border-b border-slate-100 px-3 dark:border-slate-800"><span className="flex items-center gap-1 text-[9px] text-slate-500"><MousePointer2 className="h-3 w-3" />{t("demoFormat")}</span><span className="rounded-md bg-cyan-100 px-2 py-1 text-[9px] font-semibold text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">A4</span></div>
        <div className="flex flex-1 items-center justify-center bg-slate-100/70 p-4 dark:bg-slate-900/70">
          <div className="flex h-[166px] w-[250px] items-center justify-center border border-dashed border-sky-400 bg-white shadow-sm dark:border-sky-700 dark:bg-slate-950">
            <div className="relative flex h-[112px] w-[178px] flex-col overflow-hidden rounded-md border border-slate-300 bg-gradient-to-br from-amber-50 to-white p-2 text-slate-700 dark:border-slate-700 dark:from-slate-800 dark:to-slate-900">
              <span className="flex items-center gap-1 text-[7px] font-bold"><span className="h-3 w-3 rounded-full bg-orange-400" />DEMO · ID CARD</span>
              <div className="mt-2 flex gap-2"><span className="h-12 w-9 rounded-sm bg-gradient-to-b from-sky-200 to-slate-300 dark:from-sky-800 dark:to-slate-700" /><span className="flex flex-1 flex-col gap-1 pt-1"><i className="h-1 w-4/5 rounded bg-slate-300 dark:bg-slate-600" /><i className="h-1 w-3/5 rounded bg-slate-200 dark:bg-slate-700" /><i className="h-1 w-2/3 rounded bg-slate-200 dark:bg-slate-700" /></span></div>
              <span className="absolute bottom-2 right-2 h-5 w-5 rounded-sm bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 dark:border-slate-800"><span className="text-[9px] text-slate-500">{t("demoReady")}</span><span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Printer className="h-3 w-3" />Print</span></div>
      </div>
    </div>
  </div>;
}

