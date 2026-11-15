"use client";

import { useActionState, useState } from "react";
import { Button, ComboBox, Link, RadioGroup } from "@/components/ui";
import {
  JOB_TITLE_MAX_LENGTH,
  LEVELS,
  type Level,
  type ProfileFormState,
  type UnsupportedChoice,
} from "@/src/lib/profile";
import {
  matchTrack,
  type TrackSummary,
  titleSuggestions,
} from "@/src/lib/tracks";

type ProfileFormProps = {
  action: (
    state: ProfileFormState,
    formData: FormData,
  ) => Promise<ProfileFormState>;
  catalog: TrackSummary[];
  submitLabel: string;
  initial?: {
    jobTitle: string;
    currentLevel: Level;
    targetLevel: Level;
    choice: UnsupportedChoice;
  };
};

const LEVEL_LABELS: Record<Level, string> = {
  junior: "Junior",
  mid: "Mid",
  senior: "Senior",
};

const LEVEL_OPTIONS = LEVELS.map((level) => ({
  id: level,
  label: LEVEL_LABELS[level],
}));

export function ProfileForm({
  action,
  catalog,
  submitLabel,
  initial,
}: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState(action, {
    status: "idle",
  });
  // The fields are controlled so they keep their values after a submit.
  const [jobTitle, setJobTitle] = useState(initial?.jobTitle ?? "");
  const [currentLevel, setCurrentLevel] = useState<string>(
    initial?.currentLevel ?? "",
  );
  const [targetLevel, setTargetLevel] = useState<string>(
    initial?.targetLevel ?? "",
  );
  const [choice, setChoice] = useState<string>(initial?.choice ?? "wait");

  const track = matchTrack(jobTitle, catalog);
  const fallbackTrack = catalog[0];
  const isUnsupported = jobTitle.trim() !== "" && !track;
  const suggestions = titleSuggestions(catalog).map((title) => ({
    id: title,
    label: title,
  }));

  return (
    <form action={formAction} className="grid gap-6">
      <input type="hidden" name="job_title" value={jobTitle} />
      <input type="hidden" name="current_level" value={currentLevel} />
      <input type="hidden" name="target_level" value={targetLevel} />
      <input type="hidden" name="unsupported_choice" value={choice} />

      <div className="grid gap-2">
        <ComboBox
          label="Job title"
          placeholder="Product manager"
          options={suggestions}
          allowsCustomValue
          allowsEmptyCollection={false}
          inputValue={jobTitle}
          onInputChange={(value) =>
            setJobTitle(value.slice(0, JOB_TITLE_MAX_LENGTH))
          }
          errorMessage={state.errors?.job_title}
        />
        {track ? (
          <p className="text-sm text-muted">Track: {track.name}</p>
        ) : null}
      </div>

      {isUnsupported ? (
        <div className="grid gap-3 rounded-card border border-border bg-surface p-4">
          <p className="text-sm">
            <span className="font-medium">Not supported yet.</span> We will put
            this title on the waitlist.
          </p>
          <RadioGroup
            label="What next?"
            options={[
              { id: "wait", label: "Wait for my role" },
              ...(fallbackTrack
                ? [
                    {
                      id: "try",
                      label: `Try the ${fallbackTrack.name.toLowerCase()} track anyway`,
                    },
                  ]
                : []),
            ]}
            value={choice}
            onChange={setChoice}
            errorMessage={state.errors?.unsupported_choice}
          />
        </div>
      ) : null}

      <RadioGroup
        label="Current level"
        options={LEVEL_OPTIONS}
        value={currentLevel}
        onChange={setCurrentLevel}
        errorMessage={state.errors?.current_level}
      />
      <RadioGroup
        label="Goal"
        options={LEVEL_OPTIONS}
        value={targetLevel}
        onChange={setTargetLevel}
        errorMessage={state.errors?.target_level}
      />

      <p className="text-sm text-muted">
        Your prompt text never leaves your device. Only scores do.{" "}
        <Link href="/privacy">Privacy</Link>
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" isDisabled={isPending}>
          {isPending ? "Saving…" : submitLabel}
        </Button>
        <p role="status" className="text-sm font-medium">
          {state.status === "saved" ? "Saved." : (state.message ?? "")}
        </p>
      </div>
    </form>
  );
}
