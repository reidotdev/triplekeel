import Link from "next/link";

function KeelMark() {
  return (
    <svg
      aria-hidden="true"
      className="keel-mark"
      fill="none"
      viewBox="0 0 32 32"
    >
      <path d="M5 6v20l11-6V12L5 6Z" />
      <path d="m19 10 8-4v20l-8-4" />
      <path d="M5 16h22" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <path d="M3.5 10h12m-5-5 5 5-5 5" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="marketing-site">
      <header className="site-header">
        <Link aria-label="TripleKeel home" className="brand" href="/">
          <KeelMark />
          <span>triplekeel</span>
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
            Get started <ArrowIcon />
          </Link>
        </div>
      </header>

      <section aria-labelledby="hero-title" className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">
            <span /> A personal coach for knowledge work
          </p>
          <h1 id="hero-title">
            Get better at your job <em>on autopilot.</em>
          </h1>
          <p className="hero-description">
            Your everyday AI chats can help you grow. TripleKeel spots the
            skills you use and gives you one small thing to practice next.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/sign-up">
              Start getting better <ArrowIcon />
            </Link>
            <a className="text-link" href="#how-it-works">
              See how it works <span aria-hidden="true">↓</span>
            </a>
          </div>
          <p className="hero-note">
            <span aria-hidden="true" className="lock-icon">
              ◆
            </span>
            Your prompts stay on your device
          </p>
        </div>
        <div aria-hidden="true" className="hero-art">
          <div className="art-orbit art-orbit-outer" />
          <div className="art-orbit art-orbit-inner" />
          <div className="art-sun" />
          <div className="art-keel">
            <span />
            <span />
            <span />
          </div>
          <div className="art-caption">small steps. steady progress.</div>
        </div>
      </section>

      <section aria-label="Product preview space" className="preview-space">
        <div className="preview-topline">
          <span>PERSONAL SKILL PRACTICE</span>
          <span>01 — 03</span>
        </div>
        <div aria-hidden="true" className="preview-canvas">
          <span className="preview-axis preview-axis-horizontal" />
          <span className="preview-axis preview-axis-vertical" />
          <span className="preview-orb preview-orb-one" />
          <span className="preview-orb preview-orb-two" />
          <span className="preview-orb preview-orb-three" />
        </div>
      </section>

      <section
        aria-labelledby="problem-title"
        className="problem-section"
        id="problem"
      >
        <div className="section-kicker">
          <span className="section-number">01</span>
          <span>The missing feedback loop</span>
        </div>
        <div className="problem-content">
          <h2 id="problem-title">
            You use AI every day. <em>Are you getting better?</em>
          </h2>
          <div className="problem-detail">
            <p>
              It’s easy to finish the work and move on. But useful habits are
              hard to spot in the moment, and growth gets left to chance.
            </p>
            <p>
              The best feedback is already in the way you work. It just needs to
              become a little easier to see.
            </p>
          </div>
        </div>
        <div aria-hidden="true" className="problem-rule">
          <span />
          <span />
          <span />
        </div>
      </section>

      <section
        aria-labelledby="solution-title"
        className="solution-section"
        id="how-it-works"
      >
        <div className="solution-intro">
          <div className="section-kicker section-kicker-light">
            <span className="section-number">02</span>
            <span>A quieter kind of coaching</span>
          </div>
          <h2 id="solution-title">
            Notice the patterns. <em>Practice what matters.</em>
          </h2>
          <p>
            TripleKeel privately scores your prompts in your browser, then turns
            the patterns into a personal skill picture and a simple suggestion
            for the week ahead.
          </p>
          <Link className="button button-light" href="/sign-up">
            Find your next step <ArrowIcon />
          </Link>
        </div>
        <section aria-label="How TripleKeel helps" className="solution-steps">
          <article className="solution-step">
            <span className="step-index">01</span>
            <div>
              <h3>Work as usual</h3>
              <p>Use Claude or ChatGPT for the work already on your plate.</p>
            </div>
            <span aria-hidden="true" className="step-symbol step-symbol-wave">
              ≈
            </span>
          </article>
          <article className="solution-step" id="privacy">
            <span className="step-index">02</span>
            <div>
              <h3>See your patterns</h3>
              <p>
                Your browser checks for useful work habits. The prompt itself
                stays right where it is.
              </p>
            </div>
            <span aria-hidden="true" className="step-symbol step-symbol-dot">
              ●
            </span>
          </article>
          <article className="solution-step">
            <span className="step-index">03</span>
            <div>
              <h3>Choose one small practice</h3>
              <p>Get a focused idea to try in your work this week.</p>
            </div>
            <span aria-hidden="true" className="step-symbol step-symbol-arrow">
              ↗
            </span>
          </article>
        </section>
      </section>

      <footer className="site-footer">
        <Link
          aria-label="TripleKeel home"
          className="brand brand-footer"
          href="/"
        >
          <KeelMark />
          <span>triplekeel</span>
        </Link>
        <p>Better work, one small practice at a time.</p>
        <Link className="footer-cta" href="/sign-up">
          Get started <ArrowIcon />
        </Link>
      </footer>
    </main>
  );
}
