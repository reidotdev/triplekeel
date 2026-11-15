import type { Metadata } from "next";
import type { ReactNode } from "react";
// Relative imports, so the render test runs without path aliases.
import { Card } from "../../components/ui/card";
import { Link } from "../../components/ui/link";

const REPO_URL = "https://github.com/reidotdev/triplekeel";
const LAST_UPDATED = "2026-11-15";

export const metadata: Metadata = {
  title: "Privacy notice — TripleKeel",
  description:
    "What the TripleKeel extension reads, what leaves your browser, what we store and how to delete it.",
};

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid gap-3">
      <h2
        className="font-display text-2xl font-normal leading-tight tracking-[-0.02em]"
        id={id}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function List({ children }: { children: ReactNode }) {
  return <ul className="m-0 grid list-disc gap-2 pl-5">{children}</ul>;
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-2xl content-start gap-10 px-6 py-12 leading-relaxed">
      <header className="grid gap-3">
        <Link className="justify-self-start text-sm text-muted" href="/">
          TripleKeel
        </Link>
        <h1 className="font-display text-4xl font-normal leading-tight tracking-[-0.03em]">
          Privacy notice
        </h1>
        <p className="text-sm text-muted">
          Last updated <time dateTime={LAST_UPDATED}>15 November 2026</time>
        </p>
        <p>
          TripleKeel scores your AI prompts in your browser. This page says what
          it reads, what it sends, what we keep and who helps us run it. It
          describes what the code does today.
        </p>
      </header>

      <Card className="grid gap-3">
        <h2 className="text-base font-semibold">The short version</h2>
        <List>
          <li>Your prompt text stays in your browser.</li>
          <li>
            Only score reports reach our server. They hold answers to fixed
            questions, never your words.
          </li>
          <li>Your levels are yours. There is no employer or team view.</li>
        </List>
      </Card>

      <Section id="extension-reads" title="What the extension reads">
        <p>
          The extension works only on claude.ai and chatgpt.com. It has no
          access to other sites.
        </p>
        <List>
          <li>
            When you click <strong>Score this chat</strong>, it reads your own
            messages in that chat, up to the last 20. It doesn't read the AI's
            replies. It reads only what the page shows.
          </li>
          <li>
            It won't score shared chat links, because they can hold someone
            else's prompts.
          </li>
          <li>
            Live scoring is being built. When it's ready, the extension will
            also read each prompt as you send it. The last 20 prompts you sent
            will be kept in your browser, so you can see what was scored. They
            won't leave your browser.
          </li>
        </List>
        <p>
          Before scoring, it drops prompts that aren't about your track and
          anything that looks personal. Scoring happens in your browser. Score
          this chat uses the text to score, then drops it. It doesn't save, log
          or send the text.
        </p>
        <p>
          The extension also keeps a few things in your browser: a device token
          that links it to your account, your email and track for the popup,
          your track's questions, and a random secret for import keys. Removing
          the extension deletes them.
        </p>
      </Section>

      <Section id="what-leaves" title="What leaves your browser">
        <p>Only score reports. Never the text of your prompts.</p>
        <p>A score report holds:</p>
        <List>
          <li>your track, for example Product manager</li>
          <li>the site: Claude or ChatGPT</li>
          <li>whether it came from a past chat or a live prompt</li>
          <li>the hour it was scored, in UTC</li>
          <li>a length bucket, such as 200 to 500 characters</li>
          <li>
            for each question: its ID, the answer (yes, partly, no or n/a) and a
            probability
          </li>
          <li>for past chats, an import key</li>
        </List>
        <p>
          The import key stops the same chat from counting twice. It's a keyed
          hash made in your browser, with a secret that never leaves it. It
          can't be turned back into text.
        </p>
        <p>
          Our server checks every report against a strict format and rejects
          anything else. Free text has nowhere to go.
        </p>
        <p>
          With each request, the extension sends its device token, so we know
          whose reports they are. It also asks the app for your email, your
          track and your track's questions.
        </p>
      </Section>

      <Section id="what-we-store" title="What we store">
        <p>Our database holds:</p>
        <List>
          <li>
            Your account details from Clerk: your name, email and profile
            picture link.
          </li>
          <li>
            Your profile: job title, track, current level and goal. If we don't
            support your job title yet, a note that you're on the waitlist.
          </li>
          <li>Your score reports, as listed above, and when they arrived.</li>
          <li>
            Your levels for each skill area, with how sure we are and how many
            prompts they're based on.
          </li>
          <li>
            Your connected devices: when each one was connected or revoked, and
            a hash of its token. We never store the token itself.
          </li>
          <li>
            Soon, your keel check cards and your replies to them. Keel checks
            are being built.
          </li>
        </List>
        <p>We don't store prompt text.</p>
      </Section>

      <Section id="processors" title="Who processes data">
        <p>We use these services to run TripleKeel:</p>
        <List>
          <li>
            <strong>Clerk</strong> for sign-in. It holds your email, name and
            sign-in details.
          </li>
          <li>
            <strong>Supabase</strong> for our database. It holds what's listed
            under What we store.
          </li>
          <li>
            <strong>Cloudflare</strong> for hosting. Every request to the app
            goes through it.
          </li>
          <li>
            <strong>Exa</strong> and <strong>Anthropic</strong> for finding and
            picking public sources. Once a day, a job uses Exa to search for
            recent podcasts and posts, and Anthropic's Claude to pick the best
            ones. They get only skill area names, descriptions and search
            queries. They never get user data.
          </li>
        </List>
      </Section>

      <Section id="personal-only" title="Personal only">
        <p>
          TripleKeel is for you, not your employer. There is no employer or team
          view.
        </p>
        <p>
          Your levels are visible only to you. The same goes for your profile
          and score reports. The database checks this on every request. The
          people who run TripleKeel can access the database to keep the service
          working.
        </p>
      </Section>

      <Section id="delete" title="Delete your account">
        <p>
          There is no delete button yet. Full account deletion is being built.
          Here is what you can do today:
        </p>
        <List>
          <li>
            Disconnect the extension in{" "}
            <Link href="/settings/devices">Settings → Devices</Link>. A revoked
            device stops working at once.
          </li>
          <li>
            Remove the extension from Chrome. That deletes everything it kept in
            your browser.
          </li>
          <li>
            Ask us to delete your data.{" "}
            <Link href={`${REPO_URL}/issues`}>Open an issue on GitHub</Link>,
            and leave personal details out of it. We'll find a private way to
            confirm it's you.
          </li>
        </List>
        <p>
          When a sign-in account is deleted in Clerk today, we delete its name,
          email and picture link from our database. Its profile, score reports,
          levels and device records aren't deleted yet. Full account deletion
          will remove them too.
        </p>
      </Section>

      <Section id="open-source" title="Open source">
        <p>
          TripleKeel's code is open source, so you can check every claim on this
          page. It's on GitHub at{" "}
          <Link href={REPO_URL}>github.com/reidotdev/triplekeel</Link>.
        </p>
      </Section>

      <Section id="questions" title="Questions">
        <p>
          Ask on <Link href={`${REPO_URL}/issues`}>GitHub issues</Link>. To
          report a privacy bug privately, use{" "}
          <Link href={`${REPO_URL}/security/advisories/new`}>
            GitHub security advisories
          </Link>
          .
        </p>
        <p>When this page changes, we update the date at the top.</p>
      </Section>
    </main>
  );
}
