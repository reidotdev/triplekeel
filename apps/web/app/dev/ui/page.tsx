import { notFound } from "next/navigation";
import {
  Button,
  Card,
  ComboBox,
  Dialog,
  Link,
  RadioGroup,
  Select,
  TextField,
} from "@/components/ui";

export default function UiPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-6 py-12">
      <header>
        <p className="text-sm text-muted">Development only</p>
        <h1 className="text-3xl font-semibold">UI foundation</h1>
      </header>
      <Card className="grid gap-5">
        <Button>Button</Button>
        <Link href="/">Link</Link>
        <TextField label="Text field" placeholder="Type something" />
        <Select
          label="Select"
          options={[
            { id: "beginner", label: "Beginner" },
            { id: "intermediate", label: "Intermediate" },
          ]}
        />
        <ComboBox
          label="Combo box"
          placeholder="Type or pick"
          allowsCustomValue
          options={[
            { id: "first", label: "First suggestion" },
            { id: "second", label: "Second suggestion" },
          ]}
        />
        <RadioGroup
          label="Radio group"
          defaultValue="mid"
          options={[
            { id: "junior", label: "Junior" },
            { id: "mid", label: "Mid" },
            { id: "senior", label: "Senior" },
          ]}
        />
        <Dialog title="Dialog" trigger="Open dialog">
          <p className="text-sm text-muted">
            A small accessible dialog built with React Aria Components.
          </p>
        </Dialog>
      </Card>
    </main>
  );
}
