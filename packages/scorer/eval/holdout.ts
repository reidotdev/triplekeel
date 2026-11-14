// Held-out prompts for the keyword scorer (REI-275).
//
// Written and labelled on 2026-11-14 BEFORE the scorer's rules were ported or
// tuned. Never change rules to fit these prompts: that would make the
// agreement number meaningless. To tune, use dev.ts. To add held-out data,
// add new prompts here and label them before running the scorer on them.
//
// Labelling guide (one answer per question):
// - target_user: yes = names a specific user or audience. no otherwise.
// - problem: yes = states a problem, pain or reason. no otherwise.
// - success_metric: yes = a measurable target. no otherwise.
// - acceptance: yes = gives criteria for done. partly = asks the AI to write them.
// - scope_cut: yes = says what's out of scope, MVP-only or "only X". no otherwise.
// - decomposed: yes = splits the task into steps or an order. no otherwise.
// - context_given: yes = pastes or names existing material, data or examples.
// - specific_feedback: follow-ups only. yes = says exactly what to change.
// - asks_tests: yes = asks for tests or a way to check the result.
// - cost_latency: yes = mentions cost, speed, time or other limits.
// - edge_cases: yes = mentions errors, empty states, odd inputs or small screens.
// - constraints: yes = gives technical constraints: stack, platform, data source.
// - no_why: first prompts only. yes = asks for something with no user and no reason.
// - kitchen_sink: first prompts only. yes = many features at once with no
//   priorities. partly = a whole product in one line.
// - vague_fix: follow-ups only. yes = only says "fix it" or similar.
// - blind_accept: yes = accepts or ships output without checking it.
//
// Defaults: every question is "no", except that first prompts get "n/a" for
// specific_feedback and vague_fix, and follow-ups get "n/a" for no_why and
// kitchen_sink. Each prompt lists only its differences from the defaults.

import type { Answer, QuestionId } from "@triplekeel/schema";

export type LabelledPrompt = {
  id: string;
  followUp: boolean;
  text: string;
  labels: Partial<Record<QuestionId, Answer>>;
};

export const HOLDOUT: LabelledPrompt[] = [
  {
    id: "h01",
    followUp: false,
    text: "Build me a CRM.",
    labels: { no_why: "yes", kitchen_sink: "partly" },
  },
  {
    id: "h02",
    followUp: false,
    text: "Write a PRD for a reminder feature for home care nurses who miss patient medication rounds. Success is 90% of rounds logged on time within a month. Out of scope: billing. Include acceptance criteria and what happens when the nurse is offline.",
    labels: {
      target_user: "yes",
      problem: "yes",
      success_metric: "yes",
      acceptance: "partly",
      scope_cut: "yes",
      edge_cases: "yes",
    },
  },
  {
    id: "h03",
    followUp: false,
    text: "Can you prioritize this backlog for me? Here's the list: dark mode, CSV export, SSO, onboarding checklist, Slack alerts.",
    labels: { context_given: "yes" },
  },
  {
    id: "h04",
    followUp: true,
    text: "fix it",
    labels: { vague_fix: "yes" },
  },
  {
    id: "h05",
    followUp: true,
    text: "The save button is still hidden behind the keyboard on iPhone SE. Move it above the keyboard and keep the form's scroll position.",
    labels: { specific_feedback: "yes", edge_cases: "yes" },
  },
  {
    id: "h06",
    followUp: false,
    text: "Make a landing page for my app with pricing, testimonials, a blog, a chatbot, user accounts, an admin panel and analytics.",
    labels: { no_why: "yes", kitchen_sink: "yes" },
  },
  {
    id: "h07",
    followUp: false,
    text: "Draft a user interview script for freelance designers who stopped using our invoicing tool after the trial. I want to learn why they churned. Keep it to 30 minutes and 8 questions.",
    labels: { target_user: "yes", problem: "yes", cost_latency: "yes" },
  },
  {
    id: "h08",
    followUp: true,
    text: "Looks good, I'll send this to the team as is.",
    labels: { blind_accept: "yes" },
  },
  {
    id: "h09",
    followUp: false,
    text: "Create a Next.js page that lists open support tickets from our Postgres table, sorted by age. Ops managers use it to spot tickets older than 48 hours. Show an empty state when there are none and write a Playwright test for the sort order.",
    labels: {
      target_user: "yes",
      problem: "yes",
      context_given: "yes",
      asks_tests: "yes",
      edge_cases: "yes",
      constraints: "yes",
    },
  },
  {
    id: "h10",
    followUp: false,
    text: "Improve our onboarding.",
    labels: { no_why: "yes" },
  },
  {
    id: "h11",
    followUp: false,
    text: "We need to cut cloud costs for the analytics pipeline by 20% this quarter without slowing the daily report past 7am. Suggest three options with trade-offs.",
    labels: { problem: "yes", success_metric: "yes", cost_latency: "yes" },
  },
  {
    id: "h12",
    followUp: false,
    text: "Write release notes for version 2.3. Changes: faster search, new filters, bug fixes for exports.",
    labels: { context_given: "yes" },
  },
  {
    id: "h13",
    followUp: true,
    text: "That's wrong again, try again.",
    labels: { vague_fix: "yes" },
  },
  {
    id: "h14",
    followUp: false,
    text: "Turn these meeting notes into a one-page product brief for the sales team. Customers in logistics keep asking for route exports.\n\nNotes:\n- 4 logistics customers asked for exports this month\n- they copy routes by hand into spreadsheets",
    labels: { target_user: "yes", problem: "yes", context_given: "yes" },
  },
  {
    id: "h15",
    followUp: false,
    text: "Design an A/B test for the new checkout button. Primary metric: checkout conversion. We have about 4,000 sessions a day, so tell me how long to run it.",
    labels: { success_metric: "yes", context_given: "yes" },
  },
  {
    id: "h16",
    followUp: false,
    text: "Build an MVP of a habit tracker for students. Only daily check-ins and a streak counter for now, no social features. Steps: 1. data model 2. check-in screen 3. streak logic.",
    labels: { target_user: "yes", scope_cut: "yes", decomposed: "yes" },
  },
  {
    id: "h17",
    followUp: false,
    text: "Generate the full app: auth, payments, chat, notifications, search, profiles, dashboards and an AI assistant. Don't bother with tests, just ship it.",
    labels: { no_why: "yes", kitchen_sink: "yes", blind_accept: "yes" },
  },
  {
    id: "h18",
    followUp: false,
    text: "Summarize the top complaints from these 50 app store reviews and group them by theme.",
    labels: { context_given: "yes" },
  },
  {
    id: "h19",
    followUp: true,
    text: "The chart labels overlap on mobile. Rotate them 45 degrees and hide every other label under 400px wide.",
    labels: { specific_feedback: "yes", edge_cases: "yes" },
  },
  {
    id: "h20",
    followUp: false,
    text: "Write a SQL query to find users who signed up last month but never created a project. Use our events table; it can have duplicate rows, so dedupe by user_id. It needs to run in under 5 seconds.",
    labels: {
      context_given: "yes",
      cost_latency: "yes",
      edge_cases: "yes",
      constraints: "yes",
    },
  },
];
