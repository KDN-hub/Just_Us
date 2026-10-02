import Image from "next/image";
import Link from "next/link";

export default function Welcome() {
  return (
    <main
      className="mx-auto flex h-dvh w-full max-w-md flex-col items-center justify-between px-8 pb-10 pt-16 text-center font-sans"
      style={{
        background: "linear-gradient(180deg, #1A1210 0%, #3B1520 50%, #5C1E2D 100%)",
      }}
    >
      {/* Top spacer */}
      <div />

      {/* Main content */}
      <div className="flex flex-col items-center gap-6">
        {/* Circular couple photo */}
        <div className="relative h-28 w-28 overflow-hidden rounded-full ring-2 ring-[#7A2C3B]/40">
          <Image
            src="/images/welcome-couple.jpeg"
            alt="Just Us"
            fill
            priority
            className="object-cover"
            sizes="112px"
          />
        </div>

        {/* Heading */}
        <h1
          className="text-[30px] font-normal leading-[1.25] text-[#F5F0E8]"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          Made for just
          <br />
          the two of us
        </h1>

        {/* Subtext */}
        <p className="max-w-[260px] text-[15px] leading-relaxed text-[#8A8177]">
          No strangers, no groups.
          <br />
          Just a space for you and your person.
        </p>

        {/* CTA */}
        <Link
          href="/signin"
          className="mt-4 block w-full rounded-[20px] bg-[#7A2C3B] py-4 text-center text-[15px] font-medium text-[#F5F0E8] transition-opacity active:opacity-80"
        >
          Get started
        </Link>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2.5">
        <span className="h-[7px] w-[7px] rounded-full bg-[#C9A66B]" />
        <span className="h-[6px] w-[6px] rounded-full bg-white/20" />
        <span className="h-[6px] w-[6px] rounded-full bg-white/20" />
        <span className="h-[6px] w-[6px] rounded-full bg-white/20" />
      </div>
    </main>
  );
}
