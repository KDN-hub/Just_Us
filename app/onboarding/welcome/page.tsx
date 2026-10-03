import Image from "next/image";
import Link from "next/link";

export default function Welcome() {
  return (
    <main
      className="mx-auto flex h-dvh w-full max-w-md flex-col items-center justify-center gap-5 px-8 text-center font-sans"
      style={{
        background: "var(--gradient)",
      }}
    >
      {/* Circular couple photo */}
      <div className="relative h-24 w-24 overflow-hidden rounded-full ring-2 ring-[#C9A66B]/35">
        <Image
          src="/images/welcome-couple.jpeg"
          alt="Just Us"
          fill
          priority
          className="object-cover"
          sizes="96px"
        />
      </div>

      {/* Heading */}
      <h1
        className="text-[28px] font-normal leading-[1.3] text-[#F5F0E8]"
        style={{ fontFamily: "var(--font-fraunces), serif" }}
      >
        Made for just
        <br />
        the two of us
      </h1>

      {/* Subtext */}
      <p className="text-[14px] leading-relaxed text-[#8A8177]">
        No strangers, no groups.
        <br />
        Just a space for you and your person.
      </p>

      {/* CTA */}
      <Link
        href="/signin"
        className="block w-full rounded-[12px] bg-[#7A2C3B] py-3.5 text-center text-[14px] font-medium text-[#F5F0E8] transition-opacity active:opacity-80"
      >
        Get started
      </Link>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-[5px]">
        <span className="h-[5px] w-[5px] rounded-full bg-[#C9A66B]" />
        <span className="h-[5px] w-[5px] rounded-full bg-white/20" />
        <span className="h-[5px] w-[5px] rounded-full bg-white/20" />
        <span className="h-[5px] w-[5px] rounded-full bg-white/20" />
      </div>
    </main>
  );
}
