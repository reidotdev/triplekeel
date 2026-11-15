import Image from "next/image";
import Link from "next/link";

export function BrandMark() {
  return (
    <Link
      aria-label="Triplekeel home"
      className="app-brand-mark"
      href="/dashboard"
    >
      <Image alt="Triplekeel" height={40} src="/brand/mark.svg" width={40} />
    </Link>
  );
}
