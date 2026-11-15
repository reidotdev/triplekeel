import { ArrowUpRight, LockKeyhole } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="marketing-site">
      <header className="site-header">
        <Link aria-label="Triplekeel home" className="brand" href="/">
          Triplekeel
        </Link>
        <nav aria-label="Main navigation" className="site-nav">
          <a href="#how-it-works">How it works</a>
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

      <section aria-labelledby="hero-title" className="hero-section">
        <h1 id="hero-title">Get better at your job on autopilot.</h1>
        <p>
          Triplekeel finds the skills in your AI chats and gives you one useful
          thing to practice next.
        </p>
        <Link className="button hero-button" href="/sign-up">
          Get started <ArrowUpRight aria-hidden="true" size={19} />
        </Link>
      </section>

      <div aria-hidden="true" className="mockup-space" />

      <section
        aria-labelledby="problem-title"
        className="content-section"
        id="problem"
      >
        <h2 id="problem-title">The work moves on. The learning gets lost.</h2>
        <p>
          Everyday AI chats hold clues to how you work, but it is hard to spot
          patterns while you are busy getting things done.
        </p>
      </section>

      <section
        aria-labelledby="solution-title"
        className="content-section"
        id="how-it-works"
      >
        <h2 id="solution-title">Turn your work into your next practice.</h2>
        <p>
          Triplekeel scores prompts in your browser, then turns the patterns
          into a personal skill picture and a focused suggestion for the week.
        </p>
      </section>

      <section
        aria-labelledby="privacy-title"
        className="privacy-section"
        id="privacy"
      >
        <LockKeyhole aria-hidden="true" className="privacy-icon" size={28} />
        <h2 id="privacy-title">Your prompt text stays on your device.</h2>
        <p>
          Triplekeel scores prompts in your browser. Only score reports leave
          your device.
        </p>
      </section>
    </main>
  );
}
