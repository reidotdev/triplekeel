import Link from "next/link";

const growthSteps = [
  {
    title: "Know your gaps",
    description:
      "Get your current skill levels and a career goal to identify where to improve to get there.",
  },
  {
    title: "Learn best practices",
    description:
      "Accept suggestions thoughtfully–Triplekeel won’t let you do that on autopilot so you pause to reflect.",
  },
  {
    title: "Close your gaps",
    description:
      "After several corrections, you’ll start applying new ways by yourself, growing in your career",
  },
];

const skillCards = [
  {
    title: "Skill growth monitoring",
    description:
      "See which practices you adapt quickly and which are taking time to get used to",
  },
  {
    title: "Always relevant advice",
    description:
      "Triplekeel’s skill matrices update monthly based on newly published podcast episodes",
  },
  { title: "{Title}", description: "{Description}" },
];

function LogoPlaceholders({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`logo-placeholders ${className}`}>
      {[1, 2, 3].map((logo) => (
        <div className="logo-placeholder" key={logo}>
          Logo
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="marketing-site">
      <section aria-labelledby="hero-title" className="hero-section">
        <div className="hero-copy">
          <h1 id="hero-title">Grammarly for upskilling</h1>
          <p className="hero-description">
            Triplekeel teaches you best practices by fixing your prompts.
          </p>
          <Link className="button" href="/sign-up">
            Get started
          </Link>
        </div>
        <div className="hero-visual">
          <div aria-hidden="true" className="hero-dots" />
          <div className="prompt-card">
            <span>JUNIOR</span>
            <p>“Make me a fitness app.”</p>
            <div className="prompt-tags">
              <span>Target user: no</span>
              <span>Success metric: no</span>
              <span>Scope: yes</span>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="gaps-title" className="gaps-section">
        <h2 id="gaps-title">Your prompts show your skill gaps</h2>
        <p>
          Modern knowledge work happens in AI chats. By analyzing the way your
          prompt AI in your daily work, we can understand your current skill
          levels, your gaps, and your progression over time.
        </p>
      </section>

      <section aria-labelledby="growth-title" className="growth-section">
        <h2 id="growth-title">Here’s how to close them</h2>
        <div className="growth-cards">
          {growthSteps.map((step) => (
            <article className="growth-card" key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="exa-title" className="exa-section">
        <LogoPlaceholders className="logos-top" />
        <div className="exa-copy">
          <h2 id="exa-title">Best practices form the best tech podcasts</h2>
          <p>
            Triplekeel is powered by Exa’s database of 3.2 million podcasts
            episodes from which it derives targeted hints.
          </p>
        </div>
        <LogoPlaceholders className="logos-bottom" />
      </section>

      <section aria-labelledby="skills-title" className="skills-section">
        <h2 id="skills-title">Skill management</h2>
        <div className="skill-cards">
          {skillCards.map((card) => (
            <article className="skill-card" key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
