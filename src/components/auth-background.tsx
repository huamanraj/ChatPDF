"use client";

export function AuthBackground() {
  return (
    <div className="fixed inset-0 -z-10 h-full w-full overflow-hidden bg-background">
      <svg
        className="absolute inset-0 h-full w-full stroke-primary/10 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="grid-pattern"
            width="50"
            height="50"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 50L50 0H25L0 25M50 50V25L25 50"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-pattern)">
          <animateTransform
            attributeName="transform"
            type="translate"
            from="0 0"
            to="0 -50"
            dur="60s"
            repeatCount="indefinite"
          />
        </rect>
      </svg>

      <div className="absolute -left-[20%] -top-[20%] h-[60vh] w-[60vw] rounded-full bg-primary/5 blur-[100px] animate-pulse" />
      <div className="absolute -right-[20%] bottom-[0%] h-[50vh] w-[50vw] rounded-full bg-primary/5 blur-[100px] animate-pulse delay-1000" />
    </div>
  );
}
