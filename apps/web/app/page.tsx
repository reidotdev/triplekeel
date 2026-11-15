import { ArrowDownRight, ArrowUpRight, LockKeyhole } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AccountDeletedNotice } from "@/components/account/account-deleted-notice";
import { ProcessTabs } from "@/components/marketing/process-tabs";

const comparison = [
  {
    title: "The usual way",
    quote: "You finish the work. The lessons disappear into the next task.",
    tags: [
      "No clear pattern",
      "Practice when there's time",
      "Start over each week",
    ],
  },
  {
    title: "With Triplekeel",
    quote: "Small signals become a clearer picture of how you work.",
    tags: [
      "See what is growing",
      "One useful next step",
      "Built around your work",
    ],
  },
];

export default function HomePage() {
  return (
    <main className="marketing-site">
      <header className="site-header">
        <Link aria-label="Triplekeel home" className="brand" href="/">
          <Image
            alt="Triplekeel"
            height={32}
            priority
            src="/brand/logo.svg"
            width={142}
          />
        </Link>
        <nav aria-label="Main navigation" className="site-nav">
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
          <a href="#privacy">Privacy</a>
        </nav>
        <div className="header-actions">
          <Link className="sign-in-link" href="/sign-in">
            Sign in
          </Link>
          <Link className="button button-small" href="/sign-up">
            Get started <ArrowUpRight aria-hidden="true" size={18} />
          </Link>
        </div>
      </header>

      <Suspense fallback={null}>
        <AccountDeletedNotice />
      </Suspense>

      <section aria-labelledby="hero-title" className="hero-section">
        <div className="hero-copy">
          <h1 id="hero-title">Get better at your job on autopilot.</h1>
          <p className="hero-description">
            Triplekeel finds the skills in your AI chats and gives you one
            useful thing to practice next.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/sign-up">
              Get started <ArrowUpRight aria-hidden="true" size={19} />
            </Link>
            <a className="text-link" href="#how-it-works">
              See how it works <ArrowDownRight aria-hidden="true" size={18} />
            </a>
          </div>
        </div>
        <div className="hero-visual">
          <div
            aria-label="Product preview placeholder"
            className="dotted-placeholder hero-placeholder"
            role="img"
          >
            <span className="placeholder-label">Your work, taking shape</span>
            <div className="preview-card preview-card-main">
              <span className="preview-kicker">Your skill picture</span>
              <span className="preview-title">Product thinking</span>
              <span className="skill-bar">
                <span />
              </span>
              <span className="preview-meta">Growing steadily</span>
            </div>
            <div className="preview-card preview-card-float">
              <span className="preview-kicker">This week</span>
              <span className="preview-title">Try a clearer brief</span>
              <span className="preview-meta">A 5 minute practice</span>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="problem-title"
        className="manifesto-section"
        id="problem"
      >
        <h2 id="problem-title">The work moves on. The learning gets lost.</h2>
        <p>
          Everyday AI chats hold clues to how you work, but it is hard to spot
          patterns while you are busy getting things done.
        </p>
      </section>

      <section
        aria-labelledby="how-title"
        className="split-section"
        id="how-it-works"
      >
        <div
          aria-label="A private prompt scoring illustration placeholder"
          className="dotted-placeholder split-placeholder"
          role="img"
        >
          <div className="signal-stack">
            <span>your prompt</span>
            <i aria-hidden="true" />
            <span>local score</span>
            <i aria-hidden="true" />
            <span>skill signal</span>
          </div>
          <span className="placeholder-label">Scored on your device</span>
        </div>
        <div className="split-copy">
          <h2 id="how-title">Turn your work into your next practice.</h2>
          <p>
            Triplekeel scores prompts in your browser, then turns the patterns
            into a personal skill picture and a focused suggestion for the week.
          </p>
          <a className="text-link" href="#features">
            Explore the features <ArrowDownRight aria-hidden="true" size={18} />
          </a>
        </div>
      </section>

      <section
        aria-label="A comparison of working without and with Triplekeel"
        className="comparison-section"
      >
        <div className="comparison-grid">
          {comparison.map((item) => (
            <article className="comparison-card" key={item.title}>
              <h3>{item.title}</h3>
              <p className="comparison-quote">“{item.quote}”</p>
              <ul>
                {item.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="exa-title" className="exa-section">
        <h2 id="exa-title">Powered by Exa</h2>
        <p>
          Exa searches the web for recent articles, podcasts, and examples of
          the skills you want to build. Triplekeel uses what it finds to shape a
          focused practice suggestion for your week.
        </p>
      </section>

      <section
        aria-labelledby="features-title"
        className="features-section"
        id="features"
      >
        <div className="features-heading">
          <h2 id="features-title">Turn your work into your next practice.</h2>
        </div>
        <ProcessTabs />
      </section>

      <section
        aria-labelledby="privacy-title"
        className="privacy-section"
        id="privacy"
      >
        <div aria-hidden="true" className="privacy-icon-wrap">
          <LockKeyhole className="privacy-icon" size={26} strokeWidth={1.6} />
        </div>
        <div className="privacy-copy">
          <h2 id="privacy-title">Your prompt text stays on your device.</h2>
          <p>
            Triplekeel scores prompts in your browser. Only score reports leave
            your device, never the words you wrote.
          </p>
        </div>
        <Link className="button button-outline" href="/sign-up">
          Start with privacy <ArrowUpRight aria-hidden="true" size={18} />
        </Link>
      </section>

      <footer className="site-footer">
        <Link aria-label="Triplekeel home" className="brand" href="/">
          <Image
            alt="Triplekeel"
            height={32}
            src="/brand/logo.svg"
            width={142}
          />
        </Link>
        <Link href="/privacy">Privacy</Link>
      </footer>
    </main>
  );
}
